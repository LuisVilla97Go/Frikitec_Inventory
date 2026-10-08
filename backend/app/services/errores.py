class ErrorDeNegocio(Exception):
    codigo_http = 409

    def __init__(self, mensaje: str) -> None:
        super().__init__(mensaje)
        self.mensaje = mensaje


class NoEncontrado(ErrorDeNegocio):
    codigo_http = 404


class DatosInvalidos(ErrorDeNegocio):
    codigo_http = 422


class SinPermiso(ErrorDeNegocio):
    codigo_http = 403
