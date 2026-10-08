import json
import os
from pydantic import ValidationError
from uuid import UUID
from flask import Flask, Response, jsonify, request
from werkzeug.exceptions import HTTPException, RequestEntityTooLarge
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv
from .services import usuarios_service
from .services.errores import ErrorDeNegocio
from .api import registrar_blueprints
from .config import aplicar_entorno, config
from .extensions import cors, db, jwt, limiter, migrate
from .proxy_firmado import IpDelProxyFirmado

_RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def create_app(config_name: str | None = None) -> Flask:
    load_dotenv(dotenv_path=os.path.join(_RAIZ, ".env"))

    nombre = config_name or os.environ.get("APP_CONFIG") or os.environ.get("FLASK_ENV")
    nombre = nombre or "development"
    if nombre not in config:
        raise RuntimeError(
            f"Configuración desconocida: {nombre!r} (usa {', '.join(config)})"
        )

    app = Flask(__name__)
    app.config.from_object(config[nombre])
    aplicar_entorno(app)

    if app.config["PROXY_SECRETO"]:

        if app.config["PROXIES_DE_CONFIANZA"] > 0:
            raise RuntimeError(
                "STOCKMASTER_PROXY_SECRET y PROXIES_DE_CONFIANZA no van juntos: usa uno de los dos"
            )
        app.wsgi_app = IpDelProxyFirmado(app.wsgi_app, app.config["PROXY_SECRETO"])

    if app.config["PROXIES_DE_CONFIANZA"] > 0:

        n = app.config["PROXIES_DE_CONFIANZA"]
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=n, x_proto=n, x_host=n)

    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, origins=app.config["CORS_ORIGINS"], supports_credentials=True)
    limiter.init_app(app)

    with app.app_context():
        from . import (
            models,
        )

    registrar_blueprints(app)

    _registrar_errores(app)
    _registrar_cabeceras_de_seguridad(app)

    @app.get("/health")
    @limiter.exempt
    def health_check():
        return (
            jsonify({"status": "success", "message": "API de StockMaster operativa"}),
            200,
        )

    return app


def _registrar_errores(app: Flask) -> None:

    @app.errorhandler(ErrorDeNegocio)
    def error_de_negocio(e: ErrorDeNegocio):
        return jsonify({"status": "error", "message": e.mensaje}), e.codigo_http

    @app.errorhandler(ValidationError)
    def error_de_validacion(e: ValidationError):

        errores = json.loads(e.json(include_url=False, include_input=False))
        return (
            jsonify(
                {"status": "error", "message": "Datos inválidos", "errors": errores}
            ),
            422,
        )

    @app.errorhandler(RequestEntityTooLarge)
    def demasiado_grande(_e: RequestEntityTooLarge):

        megas = app.config["MAX_CONTENT_LENGTH"] // (1024 * 1024)
        mensaje = f"El archivo supera el límite de {megas} MB"
        return jsonify({"status": "error", "message": mensaje}), 413

    @app.errorhandler(HTTPException)
    def error_http(e: HTTPException) -> tuple[Response, int]:
        return jsonify({"status": "error", "message": e.description}), e.code or 500

    @app.errorhandler(Exception)
    def error_inesperado(e: Exception) -> tuple[Response, int]:
        if isinstance(e, HTTPException):
            return error_http(e)
        db.session.rollback()

        app.logger.exception(
            "Error no controlado en %s %s", request.method, request.path
        )
        return (
            jsonify({"status": "error", "message": "Error interno del servidor"}),
            500,
        )

    def _no_autorizado(motivo: str):
        return jsonify({"status": "error", "message": motivo}), 401

    jwt.unauthorized_loader(lambda _motivo: _no_autorizado("Sesión requerida"))
    jwt.invalid_token_loader(lambda _motivo: _no_autorizado("Sesión inválida"))
    jwt.expired_token_loader(
        lambda _cabecera, _datos: _no_autorizado("Sesión expirada")
    )
    jwt.revoked_token_loader(
        lambda _cabecera, _datos: _no_autorizado("Sesión inválida")
    )

    @jwt.token_in_blocklist_loader
    def cuenta_eliminada(_cabecera: dict, datos: dict) -> bool:
        try:
            usuario_id = UUID(datos["sub"])
        except (ValueError, TypeError, KeyError):
            return True
        return usuarios_service.esta_eliminado(usuario_id)


def _registrar_cabeceras_de_seguridad(app: Flask) -> None:
    @app.after_request
    def cabeceras(response: Response) -> Response:
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if request.endpoint != "openapi.swagger_ui":
            response.headers["Content-Security-Policy"] = (
                "default-src 'none'; frame-ancestors 'none'"
            )
        if not app.debug and not app.testing and request.is_secure:
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response
