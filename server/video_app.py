#!/usr/bin/env python3
import argparse
import datetime
import json
import logging
import os
import queue
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import urllib.request


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


class StreamManager:
    """Manage a single MJPEG connection to ESP32 and fan-out frames.

    - Ensures ESP32 只看到一个 /stream 客户端（路由器）。
    - /router_stream 的浏览器预览和 /record_start 录制都复用这一条流。
    - 当没有浏览器预览、也没有在录制时，自动断开与 ESP32 的连接。
    """

    ROUTER_BOUNDARY = b"frame"

    def __init__(self, recorder: VideoRecorder):
        self.recorder = recorder
        self.lock = threading.Lock()
        self.stream_url: str | None = None
        self.clients: set[queue.Queue[bytes]] = set()
        self.worker_thread: threading.Thread | None = None
        self.worker_stop = threading.Event()

        # 录制相关状态
        self.recording: bool = False
        self.ffmpeg_proc: subprocess.Popen | None = None
        self.current_video_path: str | None = None
        self.current_thumb_path: str | None = None
        self.record_start_ts: float | None = None

    # ---------- 公开 API：供 HTTP handler 调用 ----------

    def set_stream_url(self, url: str) -> None:
        with self.lock:
            if self.stream_url == url:
                return
            self.stream_url = url
            # URL 变化时，重启上游拉流线程
            self._request_worker_restart_locked()

    def ensure_worker_running(self) -> None:
        with self.lock:
            if self.worker_thread and self.worker_thread.is_alive():
                return
            if not self.stream_url:
                raise RecordingError("missing_stream_url")

            self.worker_stop.clear()
            t = threading.Thread(target=self._worker_main, name="StreamWorker", daemon=True)
            self.worker_thread = t
            t.start()

    def stop_stream_gracefully(self) -> None:
        """用户点击“停止”时调用，尽快停止与 ESP32 的连接。

        真正的关闭由 worker 线程自行完成。
        """

        with self.lock:
            # 不强制清空 URL，这样后续还能复用同一地址重新加载
            self._request_worker_restart_locked(clear_url=False, stop_only=True)

    def add_client(self) -> queue.Queue:
        q: queue.Queue[bytes] = queue.Queue(maxsize=1)
        with self.lock:
            self.clients.add(q)
        # 有浏览器连上来时，确保上游拉流已启动
        try:
            self.ensure_worker_running()
        except RecordingError:
            # 由上层返回错误给客户端
            pass
        return q

    def remove_client(self, q: queue.Queue) -> None:
        with self.lock:
            self.clients.discard(q)

    # 录制生命周期：start/stop 在 HTTP handler 线程调用

    def start_recording(self) -> None:
        with self.lock:
            if self.recording:
                raise RecordingError("already_recording")
            if not self.stream_url:
                raise RecordingError("missing_stream_url")

            os.makedirs(self.recorder.video_dir, exist_ok=True)
            os.makedirs(self.recorder.snapshot_dir, exist_ok=True)

            now = datetime.datetime.now()
            ts = now.strftime("%Y%m%d-%H%M%S")
            ms = int(time.time() * 1000) % 1000
            base_name = f"video-{ts}-{ms:03d}"

            video_filename = base_name + ".mp4"
            thumb_filename = base_name + ".jpg"

            video_path = os.path.join(self.recorder.video_dir, video_filename)
            thumb_path = os.path.join(self.recorder.snapshot_dir, thumb_filename)

            cmd = [
                "ffmpeg",
                "-y",
                "-f",
                "mjpeg",
                "-i",
                "-",
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

            try:
                proc = subprocess.Popen(
                    cmd,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception as exc:
                logging.exception("failed to start ffmpeg for recording")
                raise RecordingError("ffmpeg_start_failed") from exc

            if not proc.stdin:
                proc.kill()
                raise RecordingError("ffmpeg_no_stdin")

            self.recording = True
            self.ffmpeg_proc = proc
            self.current_video_path = video_path
            self.current_thumb_path = thumb_path
            self.record_start_ts = time.time()

        # 确保上游拉流已启动，这里在锁外调用
        self.ensure_worker_running()

    def stop_recording(self) -> dict:
        with self.lock:
            if not self.recording:
                raise RecordingError("not_recording")

            proc = self.ffmpeg_proc
            video_path = self.current_video_path
            thumb_path = self.current_thumb_path
            start_ts = self.record_start_ts or time.time()

            # 提前清理状态，避免重复 stop
            self.recording = False
            self.ffmpeg_proc = None
            self.current_video_path = None
            self.current_thumb_path = None
            self.record_start_ts = None

        if not proc or not video_path or not thumb_path:
            raise RecordingError("no_active_process")

        # 关闭 stdin，等待 ffmpeg 正常退出
        try:
            if proc.stdin:
                try:
                    proc.stdin.close()
                except Exception:
                    pass
            proc.wait(timeout=30)
        except subprocess.TimeoutExpired:
            proc.kill()
            raise RecordingError("ffmpeg_timeout_on_stop")

        if not os.path.exists(video_path):
            raise RecordingError("video_not_created")

        # 生成缩略图
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
        self.recorder._run_ffmpeg(thumb_args, timeout=15)

        video_size = os.path.getsize(video_path)
        duration = max(0.1, time.time() - start_ts)

        video_filename = os.path.basename(video_path)
        thumb_filename = os.path.basename(thumb_path)

        video_url = f"{self.recorder.video_url_prefix.rstrip('/')}/{video_filename}"
        thumb_url = f"{self.recorder.snapshot_url_prefix.rstrip('/')}/{thumb_filename}"

        return {
            "ok": True,
            "video": video_url,
            "thumb": thumb_url,
            "bytes": video_size,
            "duration": duration,
        }

    # ---------- 内部实现 ----------

    def _request_worker_restart_locked(self, clear_url: bool = False, stop_only: bool = False) -> None:
        if clear_url:
            self.stream_url = None
        if self.worker_thread and self.worker_thread.is_alive():
            self.worker_stop.set()
        if stop_only:
            # 仅停止当前 worker，不在此处重启
            return
        self.worker_thread = None

    def _worker_main(self) -> None:
        logging.info("stream worker thread started")
        try:
            self._worker_loop()
        finally:
            logging.info("stream worker thread exiting")
            with self.lock:
                self.worker_thread = None

    def _worker_loop(self) -> None:
        backoff = 1.0
        while not self.worker_stop.is_set():
            with self.lock:
                url = self.stream_url
                has_demand = bool(self.clients or self.recording)

            if not url:
                # 没有配置上游地址，直接退出
                return

            if not has_demand:
                # 没有浏览器、也没有录制需求，结束拉流
                return

            try:
                logging.info("connecting to ESP32 stream %s", url)
                with urllib.request.urlopen(url, timeout=5) as resp:
                    self._read_mjpeg_stream(resp)
            except Exception:
                logging.exception("error reading MJPEG stream from %s", url)
                if self.worker_stop.wait(backoff):
                    return
                backoff = min(backoff * 2.0, 10.0)
                continue

            # _read_mjpeg_stream 正常返回：可能是上游关闭，或无需求
            backoff = 1.0
            with self.lock:
                if not self.clients and not self.recording:
                    return
            if self.worker_stop.wait(1.0):
                return

    def _read_mjpeg_stream(self, resp) -> None:
        fp = resp

        # 跳过响应头
        while True:
            line = fp.readline()
            if not line:
                return
            if line == b"\r\n":
                break

        boundary_prefix = b"--"

        while not self.worker_stop.is_set():
            # 读取边界行
            line = fp.readline()
            if not line:
                return
            if not line.startswith(boundary_prefix):
                continue

            # 读取每帧头部
            content_length = None
            while True:
                header = fp.readline()
                if not header:
                    return
                if header == b"\r\n":
                    break
                header_lower = header.lower()
                if header_lower.startswith(b"content-length:"):
                    try:
                        content_length = int(header.split(b":", 1)[1].strip())
                    except Exception:
                        content_length = None

            if not content_length or content_length <= 0:
                continue

            frame = fp.read(content_length)
            if not frame:
                return

            # 丢弃帧尾部的 CRLF
            _ = fp.read(2)

            self._broadcast_frame(frame)

            # 如果已经没有浏览器客户端且也不在录制，及时停止拉流
            with self.lock:
                if not self.clients and not self.recording:
                    return

    def _broadcast_frame(self, frame: bytes) -> None:
        with self.lock:
            clients = list(self.clients)
            proc = self.ffmpeg_proc if self.recording else None

        # 推给所有浏览器客户端（每个使用自己的 MJPEG 边界）
        for q in clients:
            try:
                q.put_nowait(frame)
            except queue.Full:
                try:
                    _ = q.get_nowait()
                except queue.Empty:
                    pass
                try:
                    q.put_nowait(frame)
                except queue.Full:
                    pass

        # 如果正在录制，把帧写入 ffmpeg stdin
        if proc and proc.stdin:
            try:
                proc.stdin.write(frame)
                proc.stdin.flush()
            except Exception:
                logging.exception("failed to write frame to ffmpeg stdin")


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
        elif (
            self.path.startswith("/start_stream")
            or self.path.startswith("/stop_stream")
            or self.path.startswith("/record_start")
            or self.path.startswith("/record_stop")
        ):
            self.send_response(204)
            self._set_cors_headers()
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path.startswith("/video_health"):
            # 简单健康检查：进程活着即认为正常
            body_obj = {"ok": True}
            data = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")
            self.send_response(200)
            self._set_cors_headers()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        elif self.path.startswith("/router_stream"):
            self._handle_router_stream()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path.startswith("/record_video"):
            self._handle_record_video()
            return
        if self.path.startswith("/start_stream"):
            self._handle_start_stream()
            return
        if self.path.startswith("/stop_stream"):
            self._handle_stop_stream()
            return
        if self.path.startswith("/record_start"):
            self._handle_record_start()
            return
        if self.path.startswith("/record_stop"):
            self._handle_record_stop()
            return

        self.send_response(404)
        self.end_headers()

    # ----- 具体 handler 实现 -----

    def _handle_record_video(self) -> None:

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

    def _handle_start_stream(self) -> None:
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

        mgr: StreamManager = self.server.stream_manager  # type: ignore[attr-defined]
        mgr.set_stream_url(stream_url)
        try:
            mgr.ensure_worker_running()
        except RecordingError as exc:
            self._send_json(500, {"ok": False, "error": str(exc) or "stream_failed"})
            return

        self._send_json(200, {"ok": True})

    def _handle_stop_stream(self) -> None:
        mgr: StreamManager = self.server.stream_manager  # type: ignore[attr-defined]
        mgr.stop_stream_gracefully()
        self._send_json(200, {"ok": True})

    def _handle_record_start(self) -> None:
        mgr: StreamManager = self.server.stream_manager  # type: ignore[attr-defined]
        try:
            mgr.start_recording()
        except RecordingError as exc:
            self._send_json(400, {"ok": False, "error": str(exc) or "recording_failed"})
            return
        except Exception:
            logging.exception("unexpected error in record_start")
            self._send_json(500, {"ok": False, "error": "internal_error"})
            return

        self._send_json(200, {"ok": True})

    def _handle_record_stop(self) -> None:
        mgr: StreamManager = self.server.stream_manager  # type: ignore[attr-defined]
        try:
            result = mgr.stop_recording()
        except RecordingError as exc:
            self._send_json(400, {"ok": False, "error": str(exc) or "recording_failed"})
            return
        except Exception:
            logging.exception("unexpected error in record_stop")
            self._send_json(500, {"ok": False, "error": "internal_error"})
            return

        self._send_json(200, result)

    def _handle_router_stream(self) -> None:
        mgr: StreamManager = self.server.stream_manager  # type: ignore[attr-defined]

        # 为当前连接注册一个帧队列
        q = mgr.add_client()

        boundary = StreamManager.ROUTER_BOUNDARY
        boundary_bytes = b"--" + boundary + b"\r\n"

        self.send_response(200)
        self._set_cors_headers()
        self.send_header(
            "Content-Type",
            f"multipart/x-mixed-replace;boundary={boundary.decode('ascii')}",
        )
        self.end_headers()

        try:
            while True:
                try:
                    frame = q.get(timeout=5.0)
                except queue.Empty:
                    # 没有新帧，继续等待；由后端自动判断是否需要停止拉流
                    continue

                try:
                    self.wfile.write(boundary_bytes)
                    headers = (
                        b"Content-Type: image/jpeg\r\n"+
                        f"Content-Length: {len(frame)}\r\n\r\n".encode("ascii")
                    )
                    self.wfile.write(headers)
                    self.wfile.write(frame)
                    self.wfile.write(b"\r\n")
                except BrokenPipeError:
                    break
                except ConnectionResetError:
                    break
                except Exception:
                    logging.exception("error while writing router_stream frame")
                    break
        finally:
            mgr.remove_client(q)

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
    def __init__(self, server_address, handler_cls, recorder, stream_manager):
        super().__init__(server_address, handler_cls)
        self.recorder = recorder
        self.stream_manager = stream_manager


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

    stream_manager = StreamManager(recorder)

    server = VideoHTTPServer((args.host, args.port), VideoHandler, recorder, stream_manager)

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
