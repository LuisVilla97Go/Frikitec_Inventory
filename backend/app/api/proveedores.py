from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.models.proveedor import DimProveedor
from app.schemas.proveedor_schema import (
    CambioEstadoProveedor,
    FiltroProveedores,
    ProveedorActualizar,
    ProveedorCrear,
    ProveedorSalida,
)
from app.services import proveedores_service

proveedores_bp = Blueprint("proveedores", __name__)


@proveedores_bp.get("/", strict_slashes=False)
@jwt_required()
def listar_proveedores():
    filtro = FiltroProveedores.model_validate(request.args.to_dict())
    filas = proveedores_service.listar(filtro)
    return jsonify({"status": "success", "data": [_salida(p) for p in filas]}), 200


@proveedores_bp.post("/", strict_slashes=False)
@jwt_required()
def crear_proveedor():
    datos = ProveedorCrear.model_validate(request.get_json())
    proveedor = proveedores_service.crear(datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": _salida(proveedor)}), 201


@proveedores_bp.put("/<uuid:proveedor_id>")
@jwt_required()
def actualizar_proveedor(proveedor_id: UUID):
    datos = ProveedorActualizar.model_validate(request.get_json())
    proveedor = proveedores_service.actualizar(
        proveedor_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": _salida(proveedor)}), 200


@proveedores_bp.patch("/<uuid:proveedor_id>/estado")
@jwt_required()
def cambiar_estado_proveedor(proveedor_id: UUID):
    datos = CambioEstadoProveedor.model_validate(request.get_json())
    proveedor = proveedores_service.cambiar_estado(
        proveedor_id, datos.is_active, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": _salida(proveedor)}), 200


def _salida(proveedor: DimProveedor) -> dict:
    return ProveedorSalida.desde(proveedor).model_dump(mode="json")
