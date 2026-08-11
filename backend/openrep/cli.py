"""`openrep` — start the server and open the app."""

from __future__ import annotations

import argparse
import errno
import logging
import socket
import sys
import threading
import time
import webbrowser

import uvicorn

from openrep import __version__
from openrep.core.config import settings

READY_POLL_INTERVAL = 0.15
READY_TIMEOUT = 60.0
LOOPBACK = {"127.0.0.1", "localhost", "::1"}


def display_host(host: str) -> str:
    """The host a browser should actually use, bracketed if it's IPv6.

    Binding a wildcard address is not something you can navigate to, and mixing
    up the IPv4/IPv6 loopback yields "connection refused" on a server that is
    demonstrably running.
    """
    if host in {"0.0.0.0", ""}:
        return "127.0.0.1"
    if host == "::":
        return "[::1]"
    return f"[{host}]" if ":" in host else host


def port_in_use(host: str, port: int) -> bool:
    """Try to bind the way uvicorn will, then let go."""
    for family, socktype, proto, _canonname, sockaddr in socket.getaddrinfo(
        host, port, type=socket.SOCK_STREAM
    ):
        with socket.socket(family, socktype, proto) as sock:
            # uvicorn sets SO_REUSEADDR; match it so a socket in TIME_WAIT is
            # not misreported as in use. A live listener still refuses.
            sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                sock.bind(sockaddr)
            except OSError as exc:
                if exc.errno in {errno.EADDRINUSE, errno.EACCES}:
                    return True
                raise
    return False


def open_browser_when_ready(url: str, host: str, port: int) -> None:
    """Wait for the listening socket, then open a browser.

    uvicorn awaits the ASGI lifespan — which runs migrations — before it binds,
    so a successful connect means the app is genuinely up. No arbitrary sleep,
    and no tab opened onto a half-finished first-run migration.
    """
    deadline = time.monotonic() + READY_TIMEOUT
    while time.monotonic() < deadline:
        try:
            with socket.create_connection((host, port), timeout=0.5):
                webbrowser.open(url)
                return
        except OSError:
            time.sleep(READY_POLL_INTERVAL)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="openrep",
        description="OpenRep — a local-first strength training tracker.",
        epilog=(
            f"Your data lives at {settings.database_path} (override with OPENREP_DATABASE_PATH)."
        ),
    )
    parser.add_argument(
        "--port",
        type=int,
        default=settings.port,
        help=f"port to listen on (default: {settings.port}, env: OPENREP_PORT)",
    )
    parser.add_argument(
        "--host",
        default=settings.host,
        help=(
            f"address to bind (default: {settings.host}, env: OPENREP_HOST). "
            "Anything other than a loopback address exposes your database to "
            "the network with no authentication."
        ),
    )
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="do not open a browser window on startup",
    )
    parser.add_argument("--version", action="version", version=f"openrep {__version__}")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)

    # Alembic's logging normally comes from alembic.ini, which deliberately is
    # not shipped — without this, first-run migrations are completely silent
    # and a slow start looks like a hang.
    logging.basicConfig(format="%(levelname)-5.5s [%(name)s] %(message)s", level=logging.INFO)
    logging.getLogger("alembic").setLevel(logging.INFO)

    if not 1 <= args.port <= 65535:
        print(f"error: --port must be between 1 and 65535 (got {args.port})", file=sys.stderr)
        return 2

    browser_host = display_host(args.host)
    url = f"http://{browser_host}:{args.port}/"

    if port_in_use(args.host, args.port):
        print(
            f"error: port {args.port} on {args.host} is already in use.\n\n"
            f"  If OpenRep is already running, it is at {url}\n"
            f"  Otherwise, pick another port:  openrep --port {args.port + 1}\n"
            f"  Or set one permanently:        OPENREP_PORT={args.port + 1}\n",
            file=sys.stderr,
        )
        return 1

    if args.host not in LOOPBACK:
        print(
            f"warning: binding to {args.host} makes your training database "
            "reachable from the network. OpenRep has no authentication.",
            file=sys.stderr,
        )

    print(f"OpenRep {__version__}")
    print(f"  App       {url}")
    print(f"  API docs  {url}api/docs")
    print(f"  Database  {settings.database_path}")
    print("  Press Ctrl+C to stop.\n")

    if not args.no_browser:
        threading.Thread(
            target=open_browser_when_ready,
            args=(url, browser_host, args.port),
            daemon=True,
        ).start()

    uvicorn.run("openrep.main:app", host=args.host, port=args.port, log_level="info")
    return 0
