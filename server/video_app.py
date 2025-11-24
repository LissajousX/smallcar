#!/usr/bin/env python3
import argparse
import datetime
import json
import logging
import os
import subprocess
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


class RecordingError(Exception):
    pass


class VideoRecorder:
    def __init__(self, video_dir, video_url_prefix, snapshot_dir, snapshot_url_prefix):
        self.video_dir = video_dir
        self.video_url_prefix = video_url_prefix
        # 对于视频录制服务，这里的 snapshot_dir 实际代表“视频缩略图目录”，
        # snapshot_url_prefix 代表“视频缩略图 URL 前缀”（不再复用照片快照目录）。
        self.snapshot_dir = snapshot_dir
        self.snapshot_url_prefix = snapshot_url_prefix

    def _run_ffmpeg(self, args, timeout):
        logging.info("running ffmpeg: %s", " ".join(args))
        try:
            result = subprocess.run(
                args,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                timeout=timeout,
                check=False,
            )
        except subprocess.TimeoutExpired as exc:
            logging.error("ffmpeg timed out: %s", exc)
            raise RecordingError("ffmpeg_timeout") from exc

        if result.returncode != 0:
            stderr_text = result.stderr.decode("utf-8", errors="ignore")
            logging.error("ffmpeg failed with code %s: %s", result.returncode, stderr_text)
            raise RecordingError(f"ffmpeg_exit_{result.returncode}")

    def record(self, stream_url, duration_sec):
        os.makedirs(self.video_dir, exist_ok=True)
        os.makedirs(self.snapshot_dir, exist_ok=True)

        now = datetime.datetime.now()
        ts = now.strftime("%Y%m%d-%H%M%S")
        ms = int(time.time() * 1000) % 1000
        base_name = f"video-{ts}-{ms:03d}"

        video_filename = base_name + ".mp4"
        thumb_filename = base_name + ".jpg"

        video_path = os.path.join(self.video_dir, video_filename)
        thumb_path = os.path.join(self.snapshot_dir, thumb_filename)

        # 录制视频
        record_args = [
            "ffmpeg",
            "-y",
            "-i",
            stream_url,
            "-t",
            str(duration_sec),
            "-an",
            "-vf",
            "scale=640:-2",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "25",
            "-pix_fmt",
            "yuv420p",
            video_path,
        ]
        self._run_ffmpeg(record_args, timeout=duration_sec + 15)

        if not os.path.exists(video_path):
            raise RecordingError("video_not_created")

        # 从视频截取一帧作为缩略图
        thumb_args = [
            "ffmpeg",
            "-y",
            "-ss",
            "1",
            "-i",
            video_path,
            "-frames:v",
            "1",
            "-vf",
            "scale=320:-1",
            thumb_path,
        ]
        self._run_ffmpeg(thumb_args, timeout=15)

        video_size = os.path.getsize(video_path)

        video_url = f"{self.video_url_prefix.rstrip('/')}/{video_filename}"
        thumb_url = f"{self.snapshot_url_prefix.rstrip('/')}/{thumb_filename}"

        logging.info("recorded video %s (%d bytes) from %s", video_path, video_size, stream_url)

        return {
            "ok": True,
            "video": video_url,
            "thumb": thumb_url,
            "bytes": video_size,
            "duration": duration_sec,
        }


class VideoHandler(BaseHTTPRequestHandler):
    server_version = "VideoHTTP/0.1"

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        if self.path.startswith("/record_video") or self.path.startswith("/video_health"):
            self.send_response(204)
            self._set_cors_headers()
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path.startswith("/video_health"):
            body_obj = {"ok": True}
            data = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if not self.path.startswith("/record_video"):
            self.send_response(404)
            self.end_headers()
            return

        length_header = self.headers.get("Content-Length")
        try:
            length = int(length_header or "0")
        except ValueError:
            length = 0

        if length <= 0:
            self._send_json(400, {"ok": False, "error": "invalid_content_length"})
            return

        try:
            raw = self.rfile.read(length)
        except Exception:
            logging.exception("failed to read request body")
            self._send_json(500, {"ok": False, "error": "read_error"})
            return

        try:
            payload = json.loads(raw.decode("utf-8"))
        except Exception:
            self._send_json(400, {"ok": False, "error": "invalid_json"})
            return

        stream_url = payload.get("stream_url")
        duration = payload.get("duration", 5)

        if not isinstance(stream_url, str) or not stream_url:
            self._send_json(400, {"ok": False, "error": "missing_stream_url"})
            return

        try:
            parsed = urlparse(stream_url)
        except Exception:
            parsed = None
        if not parsed or parsed.scheme not in ("http", "https"):
            self._send_json(400, {"ok": False, "error": "invalid_stream_url"})
            return

        try:
            duration_int = int(duration)
        except (TypeError, ValueError):
            duration_int = 5

        if duration_int < 1:
            duration_int = 1
        if duration_int > 30:
            duration_int = 30

        recorder = self.server.recorder  # type: ignore[attr-defined]
        try:
            result = recorder.record(stream_url, duration_int)
        except RecordingError as exc:
            self._send_json(500, {"ok": False, "error": str(exc) or "recording_failed"})
            return
        except Exception:
            logging.exception("unexpected error in record()")
            self._send_json(500, {"ok": False, "error": "internal_error"})
            return

        self._send_json(200, result)

    def _send_json(self, status_code, obj):
        data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        logging.info("%s - - [%s] " + fmt, self.address_string(), self.log_date_time_string(), *args)


class VideoHTTPServer(ThreadingHTTPServer):
    def __init__(self, server_address, handler_cls, recorder):
        super().__init__(server_address, handler_cls)
        self.recorder = recorder


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5002)
    parser.add_argument("--video-dir", default="/data/camera/videos")
    parser.add_argument("--video-url-prefix", default="/videos")
    # 这里的 snapshot-dir / snapshot-url-prefix 实际用于“视频缩略图”
    parser.add_argument("--snapshot-dir", default="/data/camera/video_thumbs")
    parser.add_argument("--snapshot-url-prefix", default="/video_thumbs")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

    recorder = VideoRecorder(
        video_dir=args.video_dir,
        video_url_prefix=args.video_url_prefix,
        snapshot_dir=args.snapshot_dir,
        snapshot_url_prefix=args.snapshot_url_prefix,
    )

    server = VideoHTTPServer((args.host, args.port), VideoHandler, recorder)

    logging.info(
        "starting video record server on %s:%d, video_dir=%s, video_url_prefix=%s",
        args.host,
        args.port,
        args.video_dir,
        args.video_url_prefix,
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

