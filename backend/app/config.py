import os
from datetime import timedelta
from flask import Flask


class Config:

    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=15)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)
    JWT_TOKEN_LOCATION = ["cookies"]
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_COOKIE_SAMESITE = "Lax"
    JWT_COOKIE_SECURE = True
    JWT_REFRESH_COOKIE_PATH = "/api/auth/refresh"
    MAX_CONTENT_LENGTH = 1 * 1024 * 1024
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS: dict = {"pool_timeout": 30, "pool_pre_ping": True}
    PROXIES_DE_CONFIANZA = 0
    PROXY_SECRETO = ""


class DevelopmentConfig(Config):
    JWT_COOKIE_SECURE = False


class ProductionConfig(Config):
    pass


class TestingConfig(Config):

    TESTING = True
    SECRET_KEY = "clave-de-pruebas-que-no-sirve-fuera-de-pytest"
    JWT_SECRET_KEY = "jwt-de-pruebas-que-no-sirve-fuera-de-pytest"
    JWT_COOKIE_SECURE = False
    RATELIMIT_ENABLED = False
    RATELIMIT_STORAGE_URI = "memory://"
    SQLALCHEMY_ENGINE_OPTIONS: dict = {}


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
}


def _obligatoria(nombre: str) -> str:
    valor = os.environ.get(nombre, "").strip()
    if not valor:
        raise RuntimeError(
            f"Falta la variable de entorno {nombre}. Defínela en el .env de la raíz "
            "(ver .env.example); la app no arranca con secretos por defecto."
        )
    return valor


def _url_psycopg3(url: str) -> str:
    for prefijo in ("postgres://", "postgresql://"):
        if url.startswith(prefijo):
            return "postgresql+psycopg://" + url[len(prefijo) :]
    return url


def aplicar_entorno(app: Flask) -> None:
    origenes = os.environ.get("CORS_ORIGINS", "http://localhost:4200")
    app.config["CORS_ORIGINS"] = [o.strip() for o in origenes.split(",") if o.strip()]

    if app.testing:
        url = _url_psycopg3(_obligatoria("TEST_DATABASE_URL"))
        if not url.startswith("postgresql+psycopg://"):
            raise RuntimeError(
                "TEST_DATABASE_URL debe ser PostgreSQL (postgresql+psycopg://…/…_test): "
                "las pruebas corren contra el mismo motor que la app, nunca SQLite."
            )
        app.config["SQLALCHEMY_DATABASE_URI"] = url
        return

    app.config["SECRET_KEY"] = _obligatoria("SECRET_KEY")
    app.config["JWT_SECRET_KEY"] = _obligatoria("JWT_SECRET_KEY")
    app.config["SQLALCHEMY_DATABASE_URI"] = _url_psycopg3(_obligatoria("DATABASE_URL"))
    app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
        **app.config["SQLALCHEMY_ENGINE_OPTIONS"],
        "pool_size": int(os.environ.get("DB_POOL_SIZE", "5")),
        "max_overflow": int(os.environ.get("DB_MAX_OVERFLOW", "10")),
    }

    app.config["RATELIMIT_STORAGE_URI"] = os.environ.get(
        "RATELIMIT_STORAGE_URI", "memory://"
    )
    app.config["PROXIES_DE_CONFIANZA"] = int(
        os.environ.get("PROXIES_DE_CONFIANZA", "0")
    )
    app.config["PROXY_SECRETO"] = os.environ.get("STOCKMASTER_PROXY_SECRET", "")
