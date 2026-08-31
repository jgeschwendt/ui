#!/usr/bin/env python3
"""Serve this repository over HTTP, so the docs and the demo are visited rather
than file-opened.

Nothing is built and nothing is installed: the stylesheet, the pages and the
icons are already the artifacts. This exists because a page opened off disk is
a different page — an external `<use href="sprite.svg#id">` does not resolve
over `file://`, `localStorage` is per-file-origin, and, mainly, a reverse proxy
cannot wrap a URL that has no origin.

    ./serve.py                 # http://127.0.0.1:8080/ → /docs/
    ./serve.py --port 4321
    visor 8080                 # wrap the running server
    visor -- ./serve.py        # or let visor own the port and spawn it

In the second form visor keeps its own port and hands the child an ephemeral one
through $PORT, which is why the environment beats the built-in default and loses
to an explicit --port.
"""

from __future__ import annotations

import argparse
import os
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_PORT = 8080


class Handler(SimpleHTTPRequestHandler):
    """Static files, with the three corrections a dev server owes a wrapper."""

    # Keep-alive: visor proxies every subresource through one upstream client,
    # and HTTP/1.0's connection-per-request makes an iframe reload visibly slow.
    protocol_version = "HTTP/1.1"

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".map": "application/json; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
        ".svg": "image/svg+xml",
    }

    def end_headers(self) -> None:
        # Editing ui.css and reloading has to show the edit. A 304 from the
        # handler's own mtime check would be correct and still confusing.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        # "/" is the docs page, not a directory listing of the repository.
        if self.path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/docs/")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        return super().send_head()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


class Server(ThreadingHTTPServer):
    # A page pulls the stylesheet, the script and the sprite at once, and under
    # visor it does so from inside an iframe; a single-threaded server serializes
    # them behind whichever request is slowest.
    allow_reuse_address = True
    daemon_threads = True


def main() -> int:
    ap = argparse.ArgumentParser(description="serve the ui repository over HTTP")
    ap.add_argument(
        "--port",
        type=int,
        default=None,
        help=f"bind port (default: $PORT, else {DEFAULT_PORT})",
    )
    ap.add_argument(
        "--host",
        default="127.0.0.1",
        help="bind address (default: 127.0.0.1 — loopback, like visor)",
    )
    args = ap.parse_args()

    port = args.port if args.port is not None else int(os.environ.get("PORT") or DEFAULT_PORT)

    try:
        httpd = Server((args.host, port), partial(Handler, directory=str(ROOT)))
    except OSError as err:
        print(f"serve: cannot bind {args.host}:{port} — {err}", file=sys.stderr)
        return 1

    bound = httpd.socket.getsockname()[1]
    print(f"ui   → http://{args.host}:{bound}/docs/", file=sys.stderr)
    print(f"demo → http://{args.host}:{bound}/demo/", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
