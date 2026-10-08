from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
    set_access_cookies,
    set_refresh_cookies,
    unset_jwt_cookies,
)
from flask_limiter.util import get_remote_address
from app.extensions import limiter
from app.models.usuario import DimUsuario
from app.schemas.auth_schema import LoginRequest
from app.services import usuarios_service

auth_bp = Blueprint("auth", __name__)

CREDENCIALES_INVALIDAS = "Usuario o contraseña incorrectos"


def _usuario_publico(u: DimUsuario) -> dict:
    return {
        "id": str(u.id),
        "nombre": u.nombres,
        "email": u.email,
        "rol": u.rol,
        "cargo": u.cargo,
        "is_admin": u.is_admin,
    }


@auth_bp.post("/login")
@limiter.limit("5 per minute", key_func=get_remote_address)
def login():
    datos = LoginRequest.model_validate(request.get_json())
    usuario = usuarios_service.autenticar(datos.email, datos.password)
    if usuario is None:
        return jsonify({"status": "error", "message": CREDENCIALES_INVALIDAS}), 401

    respuesta = jsonify(
        {
            "status": "success",
            "message": "Login exitoso",
            "user": _usuario_publico(usuario),
        }
    )
    set_access_cookies(respuesta, create_access_token(identity=str(usuario.id)))
    set_refresh_cookies(respuesta, create_refresh_token(identity=str(usuario.id)))
    return respuesta, 200


@auth_bp.post("/refresh")
@jwt_required(refresh=True)
def refrescar():
    usuario = usuarios_service.obtener_activo(UUID(get_jwt_identity()))
    if usuario is None:
        respuesta = jsonify({"status": "error", "message": "Sesión inválida"})
        unset_jwt_cookies(respuesta)
        return respuesta, 401
    respuesta = jsonify({"status": "success"})
    set_access_cookies(respuesta, create_access_token(identity=str(usuario.id)))
    return respuesta, 200


@auth_bp.post("/logout")
def logout():
    respuesta = jsonify({"status": "success"})
    unset_jwt_cookies(respuesta)
    return respuesta, 200


@auth_bp.get("/me")
@jwt_required()
def usuario_actual():
    usuario = usuarios_service.obtener_activo(UUID(get_jwt_identity()))
    if usuario is None:
        return jsonify({"status": "error", "message": "Sesión inválida"}), 401
    return jsonify({"status": "success", "user": _usuario_publico(usuario)}), 200
