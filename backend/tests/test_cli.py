import socket

import pytest

from openrep import __version__
from openrep.cli import build_parser, display_host, port_in_use, reachable_host
from openrep.core.config import settings


def test_version_flag_prints_and_exits(capsys: pytest.CaptureFixture[str]):
    with pytest.raises(SystemExit) as exc:
        build_parser().parse_args(["--version"])
    assert exc.value.code == 0
    assert capsys.readouterr().out.strip() == f"openrep {__version__}"


def test_defaults_come_from_settings():
    args = build_parser().parse_args([])
    assert args.port == settings.port
    assert args.host == settings.host
    assert args.no_browser is False


def test_flags_override_defaults():
    args = build_parser().parse_args(["--port", "9999", "--host", "0.0.0.0", "--no-browser"])
    assert args.port == 9999
    assert args.host == "0.0.0.0"
    assert args.no_browser is True


@pytest.mark.parametrize(
    ("bound", "expected"),
    [
        ("0.0.0.0", "127.0.0.1"),  # wildcard is not navigable
        ("", "127.0.0.1"),
        ("::", "[::1]"),
        ("::1", "[::1]"),  # IPv6 literals need brackets in a URL
        ("127.0.0.1", "127.0.0.1"),
        ("localhost", "localhost"),
    ],
)
def test_display_host_normalises_bind_addresses(bound: str, expected: str):
    assert display_host(bound) == expected


@pytest.mark.parametrize(
    ("bound", "expected"),
    [
        ("0.0.0.0", "127.0.0.1"),
        ("", "127.0.0.1"),
        ("::", "::1"),
        ("::1", "::1"),
        ("127.0.0.1", "127.0.0.1"),
    ],
)
def test_reachable_host_is_unbracketed(bound: str, expected: str):
    assert reachable_host(bound) == expected


@pytest.mark.parametrize("bound", ["::", "::1", "0.0.0.0", "", "127.0.0.1", "localhost"])
def test_reachable_host_is_resolvable(bound: str):
    # display_host()'s bracketed IPv6 form is for URLs only — getaddrinfo
    # rejects it, and passing it to create_connection made the readiness
    # probe fail forever on a server that had started fine.
    socket.getaddrinfo(reachable_host(bound), 0, type=socket.SOCK_STREAM)


def test_port_in_use_accepts_the_empty_host():
    # uvicorn reads "" as every interface; getaddrinfo("") raises gaierror,
    # which used to escape as a traceback before the server ever started.
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    assert port_in_use("", port) is False


def test_port_in_use_detects_a_live_listener():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        sock.listen(1)
        port = sock.getsockname()[1]
        assert port_in_use("127.0.0.1", port) is True


def test_port_in_use_is_false_for_a_free_port():
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    # Socket closed above, so nothing is listening on `port` any more.
    assert port_in_use("127.0.0.1", port) is False
