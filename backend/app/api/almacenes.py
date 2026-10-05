from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.models.almacen import DimAlmacen
from app.schemas.almacen_schema import (
    AlmacenActualizar,
    AlmacenCrear,
    AlmacenSalida,
    CambioDeEstado,
    ListadoAlmacenes,
)
from app.services import almacenes_service

almacenes_bp = Blueprint("almacenes", __name__)


@almacenes_bp.get("/", strict_slashes=False)
@jwt_required()
def listar_almacenes():
    params = ListadoAlmacenes.model_validate(request.args.to_dict())
    almacenes = almacenes_service.listar(params.todos)
    stock = almacenes_service.stock_por_almacen([a.id for a in almacenes])
    return (
        jsonify(
            {
                "status": "success",
                "data": [
                    AlmacenSalida.desde(a, stock.get(a.id, 0)).model_dump(mode="json")
                    for a in almacenes
                ],
            }
        ),
        200,
    )


@almacenes_bp.post("/", strict_slashes=False)
@jwt_required()
def crear_almacen():
    datos = AlmacenCrear.model_validate(request.get_json())
    almacen = almacenes_service.crear(datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": _salida(almacen)}), 201


@almacenes_bp.put("/<uuid:almacen_id>")
@jwt_required()
def actualizar_almacen(almacen_id: UUID):
    datos = AlmacenActualizar.model_validate(request.get_json())
    almacen = almacenes_service.actualizar(almacen_id, datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": _salida(almacen)}), 200


@almacenes_bp.patch("/<uuid:almacen_id>/estado")
@jwt_required()
def cambiar_estado(almacen_id: UUID):
    datos = CambioDeEstado.model_validate(request.get_json())
    almacen = almacenes_service.cambiar_estado(
        almacen_id, datos.is_active, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": _salida(almacen)}), 200


def _salida(almacen: DimAlmacen) -> dict:
    stock = almacenes_service.stock_por_almacen([almacen.id]).get(almacen.id, 0)
    return AlmacenSalida.desde(almacen, stock).model_dump(mode="json")
