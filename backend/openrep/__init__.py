"""OpenRep: a local-first strength training tracker."""

from importlib.metadata import PackageNotFoundError, version

try:
    __version__ = version("openrep")
except PackageNotFoundError:  # running from a source tree with nothing installed
    __version__ = "0.0.0+dev"

__all__ = ["__version__"]
