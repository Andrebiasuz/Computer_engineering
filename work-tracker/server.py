#!/usr/bin/env python3
"""Tiny self-hosted server for the Work Tracker.

Serves the static app and persists all data to a single JSON file on this
machine, so your data lives on disk instead of inside one browser. Nothing is
ever sent anywhere else: the page is served with a Content-Security-Policy
that only lets it talk to this server.

Only the Python standard library is used - no install step.

    python3 server.py                      # http://localhost:8081
    python3 server.py --port 8081 --data data/work-data.json
    python3 server.py --no-browser         # don't open a browser tab

API
    GET  /api/state   -> the saved JSON (404 if nothing saved yet)
    PUT  /api/state   -> replace the saved JSON (body must be a JSON object)
"""

import argparse
import ipaddress
import json
import os
import shutil
import tempfile
import threading
import webbrowser
from datetime import datetime
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

APP_DIR = os.path.dirname(os.path.abspath(__file__))
MAX_BODY = 20 * 1024 * 1024  # 20 MB is far more than a work log will ever need
BACKUPS_KEPT = 14
CSP = ("default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
       "img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; "
       "form-action 'none'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'")

_lock = threading.Lock()


class Handler(SimpleHTTPRequestHandler):
    data_path = ""
    allowed_hosts = set()

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        # Only this server may be contacted: no fonts, CDNs, analytics or
        # third-party APIs, so work data can't leave the machine.
        self.send_header("Content-Security-Policy", CSP)
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def _send_json(self, code, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _host_allowed(self):
        """Block DNS rebinding: a hostile web page that points its own domain
        at this server so the browser lets it read /api/state. The browser
        always sends the name it used in the Host header, so only accept IP
        addresses, localhost and names passed with --allow-host."""
        host = (self.headers.get("Host") or "").strip().lower()
        if host.startswith("["):  # [::1]:8080
            name = host[1:host.find("]")] if "]" in host else ""
        else:
            name = host.rsplit(":", 1)[0] if host.count(":") == 1 else host
        if not name:
            return False
        if name == "localhost" or name in self.allowed_hosts:
            return True
        try:
            ipaddress.ip_address(name)
            return True
        except ValueError:
            return False

    def _reject_bad_host(self):
        if self._host_allowed():
            return False
        self.send_error(403, "Host not allowed (see --allow-host)")
        return True

    def send_head(self):
        # Shared by GET and HEAD for static files. Never serve anything in the
        # data folder, however the path is spelled ("/js/../data/...",
        # "/%64ata/...", symlinks), by checking where it really resolves.
        target = os.path.realpath(self.translate_path(self.path))
        data_dir = os.path.realpath(os.path.dirname(self.data_path))
        blocked = [os.path.realpath(self.data_path), os.path.join(data_dir, "backups")]
        if data_dir != os.path.realpath(APP_DIR):
            blocked.append(data_dir)
        if any(target == b or target.startswith(b + os.sep) for b in blocked):
            self.send_error(404)
            return None
        return super().send_head()

    def do_HEAD(self):
        if self._reject_bad_host():
            return
        super().do_HEAD()

    def do_GET(self):
        if self._reject_bad_host():
            return
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
        super().do_GET()

    def do_PUT(self):
        if self._reject_bad_host():
            return
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
    parser = argparse.ArgumentParser(description="Work Tracker server")
    parser.add_argument("--host", default="127.0.0.1",
                        help="keep the default (this machine only) for confidential data; "
                             "0.0.0.0 exposes it, unauthenticated, to the whole network")
    parser.add_argument("--port", type=int, default=8081)
    parser.add_argument("--data", default=os.path.join(APP_DIR, "data", "work-data.json"))
    parser.add_argument("--allow-host", action="append", default=[], metavar="NAME",
                        help="extra hostname the app may be opened under, e.g. this machine's "
                             "name or a reverse proxy's domain (repeatable); IP addresses and "
                             "localhost always work")
    parser.add_argument("--no-browser", action="store_true",
                        help="don't open the app in a browser on startup")
    args = parser.parse_args()

    Handler.data_path = os.path.abspath(args.data)
    Handler.allowed_hosts = {h.strip().lower() for h in args.allow_host if h.strip()}
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f"Work Tracker running on http://{args.host}:{args.port}")
    if args.host not in ("127.0.0.1", "localhost", "::1"):
        print("WARNING: listening beyond this machine with no authentication. "
              "Anyone who can reach this port can read and overwrite your work data.")
    print(f"Data file: {Handler.data_path}")
    if not args.no_browser:
        # 0.0.0.0 / :: aren't browsable addresses; open via localhost instead.
        host = "localhost" if args.host in ("0.0.0.0", "::", "") else args.host
        url = f"http://{host}:{server.server_address[1]}/"
        threading.Timer(0.5, webbrowser.open, args=(url,)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopped.")


if __name__ == "__main__":
    main()
