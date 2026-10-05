from flask import current_app, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager, decode_token
from flask_jwt_extended.exceptions import JWTExtendedException
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from flask_migrate import Migrate
from flask_sqlalchemy import SQLAlchemy
from jwt.exceptions import PyJWTError

LIMITE_CON_SESION = "1000 per hour"
LIMITE_SIN_SESION = "200 per day;50 per hour"


def clave_del_limite() -> str:

    token = request.cookies.get(current_app.config["JWT_ACCESS_COOKIE_NAME"])
    if token:
        try:
            return f"usuario:{decode_token(token)['sub']}"
        except (PyJWTError, JWTExtendedException, KeyError):
            pass
    return f"ip:{get_remote_address()}"


def limite_por_defecto() -> str:
    return (
        LIMITE_CON_SESION
        if clave_del_limite().startswith("usuario:")
        else LIMITE_SIN_SESION
    )


db = SQLAlchemy()
migrate = Migrate()
jwt = JWTManager()
cors = CORS()
limiter = Limiter(key_func=clave_del_limite, default_limits=[limite_por_defecto])
