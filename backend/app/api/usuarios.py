from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.models.usuario import DimUsuario
from app.schemas.usuario_schema import (
    CambioDeEstado,
    ListadoUsuarios,
    UsuarioActualizar,
    UsuarioCrear,
    UsuarioSalida,
)
from app.services import usuarios_service
from app.services.errores import SinPermiso

usuarios_bp = Blueprint("usuarios", __name__)


@usuarios_bp.get("/", strict_slashes=False)
@jwt_required()
def listar_usuarios():
    params = ListadoUsuarios.model_validate(request.args.to_dict())
    usuarios, total = usuarios_service.listar(params.page, params.per_page)
    return (
        jsonify(
            {
                "status": "success",
                "data": [
                    UsuarioSalida.desde(u).model_dump(mode="json") for u in usuarios
                ],
                "page": params.page,
                "per_page": params.per_page,
                "total": total,
            }
        ),
        200,
    )


@usuarios_bp.post("/", strict_slashes=False)
@jwt_required()
def crear_usuario():
    datos = UsuarioCrear.model_validate(request.get_json())
    usuario = usuarios_service.crear(datos, _actor())
    return jsonify({"status": "success", "data": _salida(usuario)}), 201


@usuarios_bp.put("/<uuid:usuario_id>")
@jwt_required()
def actualizar_usuario(usuario_id: UUID):
    datos = UsuarioActualizar.model_validate(request.get_json())
    usuario = usuarios_service.actualizar(usuario_id, datos, _actor())
    return jsonify({"status": "success", "data": _salida(usuario)}), 200


@usuarios_bp.patch("/<uuid:usuario_id>/estado")
@jwt_required()
def cambiar_estado(usuario_id: UUID):
    datos = CambioDeEstado.model_validate(request.get_json())
    usuario = usuarios_service.cambiar_estado(usuario_id, datos.is_active, _actor())
    return jsonify({"status": "success", "data": _salida(usuario)}), 200


@usuarios_bp.delete("/<uuid:usuario_id>")
@jwt_required()
def eliminar_usuario(usuario_id: UUID):
    usuarios_service.eliminar(usuario_id, _actor())
    return "", 204


def _actor() -> DimUsuario:
    actor = usuarios_service.obtener_activo(UUID(get_jwt_identity()))
    if actor is None:
        raise SinPermiso("Tu usuario está desactivado")
    return actor


def _salida(usuario: DimUsuario) -> dict:
    return UsuarioSalida.desde(usuario).model_dump(mode="json")
