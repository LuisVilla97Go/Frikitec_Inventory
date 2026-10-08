import contextlib
import hmac
import ipaddress
from collections.abc import Callable, Iterable
from typing import Any

CABECERA_IP = "HTTP_X_STOCKMASTER_IP"
CABECERA_SECRETO = "HTTP_X_STOCKMASTER_PROXY"
LARGO_MINIMO_SECRETO = 32

type App = Callable[[dict[str, Any], Callable[..., Any]], Iterable[bytes]]


class IpDelProxyFirmado:

    def __init__(self, app: App, secreto: str) -> None:
        if len(secreto) < LARGO_MINIMO_SECRETO:
            raise ValueError(
                f"STOCKMASTER_PROXY_SECRET necesita al menos {LARGO_MINIMO_SECRETO} caracteres"
            )
        self.app = app

        self._secreto = secreto.encode("latin-1")

    def __call__(
        self, environ: dict[str, Any], start_response: Callable[..., Any]
    ) -> Iterable[bytes]:

        firma = environ.pop(CABECERA_SECRETO, "")
        ip = environ.pop(CABECERA_IP, "").strip()
        if firma and hmac.compare_digest(firma.encode("latin-1"), self._secreto):

            with contextlib.suppress(ValueError):
                environ["REMOTE_ADDR"] = str(ipaddress.ip_address(ip))
        return self.app(environ, start_response)
