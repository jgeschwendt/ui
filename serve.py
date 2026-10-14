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
    visor -- python3 serve.py  # or let visor own the port and spawn it

In the second form visor keeps its own port and hands the child an ephemeral one
through $PORT, which is why the environment beats the built-in default and loses
to an explicit --port.
"""

import argparse
import os
import sys
from contextlib import suppress
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class Handler(SimpleHTTPRequestHandler):
    """Static files, with the corrections a dev server owes a wrapper."""

    # Keep-alive: visor proxies every subresource through one upstream client,
    # and HTTP/1.0's connection-per-request makes an iframe reload visibly slow.
    protocol_version = "HTTP/1.1"

    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".md": "text/markdown; charset=utf-8",
    }

    def end_headers(self) -> None:
        # Editing ui.css and reloading has to show the edit. A 304 from the
        # handler's own mtime check would be correct and still confusing.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_head(self):
        # "/" is the docs page, not a directory listing of the repository.
        if self.path not in ("/", "/index.html"):
            return super().send_head()
        self.send_response(302)
        self.send_header("Location", "/docs/")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def log_message(self, fmt: str, *args) -> None:
        sys.stderr.write("%s %s\n" % (self.log_date_time_string(), fmt % args))


ap = argparse.ArgumentParser(description="serve the ui repository over HTTP")
ap.add_argument(
    "--port",
    type=int,
    default=os.environ.get("PORT") or "8080",
    help="bind port (default: $PORT, else 8080)",
)
ap.add_argument(
    "--host",
    default="127.0.0.1",
    help="bind address (default: 127.0.0.1 — loopback, like visor)",
)
args = ap.parse_args()

try:
    # Threaded: a page pulls the stylesheet, the script and the sprite at once,
    # and under visor it does so from inside an iframe; a single-threaded server
    # serializes them behind whichever request is slowest.
    httpd = ThreadingHTTPServer(
        (args.host, args.port),
        partial(Handler, directory=os.path.dirname(__file__)),
    )
except OSError as err:
    sys.exit(f"serve: cannot bind {args.host}:{args.port} — {err}")

origin = f"http://{args.host}:{httpd.server_port}"
print(f"ui   → {origin}/docs/", file=sys.stderr)
print(f"demo → {origin}/demo/", file=sys.stderr)
with httpd, suppress(KeyboardInterrupt):
    httpd.serve_forever()
