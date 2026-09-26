#!/usr/bin/env python3
"""Tiny self-hosted server for the Study Tracker.

Serves the static app and persists all data to a single JSON file, so the
tracker works from any device on your network (phone, laptop, desktop) and
your data lives on disk instead of inside one browser.

Only the Python standard library is used - no install step.

    python3 server.py                      # http://localhost:8080
    python3 server.py --host 0.0.0.0 --port 8080 --data data/study-data.json

API
    GET  /api/state   -> the saved JSON (404 if nothing saved yet)
    PUT  /api/state   -> replace the saved JSON (body must be a JSON object)
"""

import argparse
import json
import os
import shutil
import tempfile
import threading
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

APP_DIR = os.path.dirname(os.path.abspath(__file__))
MAX_BODY = 20 * 1024 * 1024  # 20 MB is far more than a study log will ever need
BACKUPS_KEPT = 14

_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    data_path = ""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split("?")[0] == "/api/state":
            with _lock:
                if not os.path.exists(self.data_path):
                    self._send_json(404, {"error": "no data yet"})
                    return
                with open(self.data_path, "rb") as f:
                    body = f.read()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        # Never serve the data folder as a static file.
        if self.path.startswith("/data/"):
            self.send_error(404)
            return
        super().do_GET()

    def do_PUT(self):
        if self.path.split("?")[0] != "/api/state":
            self.send_error(404)
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0 or length > MAX_BODY:
            self._send_json(413, {"error": "bad body size"})
            return
        raw = self.rfile.read(length)
        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise ValueError("state must be a JSON object")
        except ValueError as e:
            self._send_json(400, {"error": str(e)})
            return
        with _lock:
            _write_atomic(self.data_path, raw)
            _daily_backup(self.data_path)
        self._send_json(200, {"ok": True, "savedAt": datetime.now().isoformat()})


def _write_atomic(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(path), suffix=".tmp")
    with os.fdopen(fd, "wb") as f:
        f.write(data)
    os.replace(tmp, path)


def _daily_backup(path):
    """Keep one snapshot per day in data/backups, pruning old ones."""
    backup_dir = os.path.join(os.path.dirname(path), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    target = os.path.join(backup_dir, datetime.now().strftime("%Y-%m-%d") + ".json")
    shutil.copyfile(path, target)
    snapshots = sorted(f for f in os.listdir(backup_dir) if f.endswith(".json"))
    for old in snapshots[:-BACKUPS_KEPT]:
        os.remove(os.path.join(backup_dir, old))


def main():
    parser = argparse.ArgumentParser(description="Study Tracker server")
    parser.add_argument("--host", default="127.0.0.1",
                        help="use 0.0.0.0 to reach it from other devices on your LAN")
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--data", default=os.path.join(APP_DIR, "data", "study-data.json"))
    args = parser.parse_args()

    Handler.data_path = os.path.abspath(args.data)
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Study Tracker running on http://{args.host}:{args.port}")
    print(f"Data file: {Handler.data_path}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
