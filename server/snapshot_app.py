#!/usr/bin/env python3
import argparse
import datetime
import json
import logging
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class SnapshotHandler(BaseHTTPRequestHandler):
    server_version = "SnapshotHTTP/0.1"

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        if self.path.startswith("/upload_snapshot"):
            self.send_response(204)
            self._set_cors_headers()
            self.send_header("Content-Length", "0")
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path != "/upload_snapshot":
            self.send_response(404)
            self.end_headers()
            return

        length_header = self.headers.get("Content-Length")
        try:
            length = int(length_header or "0")
        except ValueError:
            length = 0

        if length <= 0:
            self.send_response(400)
            self._set_cors_headers()
            body = b'{"ok":false,"error":"invalid_content_length"}'
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        try:
            body = self.rfile.read(length)
        except Exception:
            logging.exception("failed to read request body")
            self.send_response(500)
            self._set_cors_headers()
            body = b'{"ok":false,"error":"read_error"}'
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        snapshot_dir = self.server.snapshot_dir
        os.makedirs(snapshot_dir, exist_ok=True)

        now = datetime.datetime.now()
        ts = now.strftime("%Y%m%d-%H%M%S")
        ms = int(time.time() * 1000) % 1000
        filename = f"snapshot-{ts}-{ms:03d}.jpg"
        out_path = os.path.join(snapshot_dir, filename)

        try:
            with open(out_path, "wb") as f:
                f.write(body)
        except Exception:
            logging.exception("failed to save snapshot to %s", out_path)
            self.send_response(500)
            self._set_cors_headers()
            body = b'{"ok":false,"error":"write_error"}'
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        rel_url = f"{self.server.snapshot_url_prefix.rstrip('/')}/{filename}"
        logging.info(
            "saved snapshot %s (%d bytes) from %s",
            out_path,
            len(body),
            self.client_address[0] if self.client_address else "?",
        )

        resp = {
            "ok": True,
            "path": rel_url,
            "bytes": len(body),
            "remote": self.client_address[0] if self.client_address else None,
        }
        data = json.dumps(resp, ensure_ascii=False).encode("utf-8")

        self.send_response(200)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        logging.info("%s - - [%s] " + fmt, self.address_string(), self.log_date_time_string(), *args)


class SnapshotHTTPServer(ThreadingHTTPServer):
    def __init__(self, server_address, handler_cls, snapshot_dir, snapshot_url_prefix):
        super().__init__(server_address, handler_cls)
        self.snapshot_dir = snapshot_dir
        self.snapshot_url_prefix = snapshot_url_prefix


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=5001)
    parser.add_argument(
        "--snapshot-dir",
        default="/data/camera/snapshots",
    )
    parser.add_argument(
        "--url-prefix",
        default="/snapshots",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )

    server = SnapshotHTTPServer(
        (args.host, args.port),
        SnapshotHandler,
        args.snapshot_dir,
        args.url_prefix,
    )

    logging.info(
        "starting snapshot upload server on %s:%d, dir=%s, url_prefix=%s",
        args.host,
        args.port,
        server.snapshot_dir,
        server.snapshot_url_prefix,
    )

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

