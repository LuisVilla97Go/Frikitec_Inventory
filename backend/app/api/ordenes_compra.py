from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.schemas.orden_compra_schema import (
    AdjuntarFacturaEntrada,
    CancelarOrdenEntrada,
    CerrarSaldoEntrada,
    DecidirAprobacion,
    FiltroOrdenCompra,
    OrdenCompraCrear,
    RecepcionCompraEntrada,
)
from app.services import ordenes_compra_service

ordenes_compra_bp = Blueprint("ordenes_compra", __name__)


@ordenes_compra_bp.get("/", strict_slashes=False)
@jwt_required()
def listar():
    filtro = FiltroOrdenCompra.model_validate(request.args.to_dict())
    filas, total = ordenes_compra_service.listar(filtro.page, filtro.per_page)
    return (
        jsonify(
            {
                "status": "success",
                "data": filas,
                "page": filtro.page,
                "per_page": filtro.per_page,
                "total": total,
            }
        ),
        200,
    )


@ordenes_compra_bp.post("/", strict_slashes=False)
@jwt_required()
def crear():
    datos = OrdenCompraCrear.model_validate(request.get_json())
    orden = ordenes_compra_service.crear(datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": orden}), 201


@ordenes_compra_bp.get("/<uuid:orden_id>")
@jwt_required()
def detalle(orden_id: UUID):
    return (
        jsonify(
            {"status": "success", "data": ordenes_compra_service.detalle(orden_id)}
        ),
        200,
    )


@ordenes_compra_bp.put("/<uuid:orden_id>")
@jwt_required()
def guardar_borrador(orden_id: UUID):
    datos = OrdenCompraCrear.model_validate(request.get_json())
    orden = ordenes_compra_service.guardar_borrador(
        orden_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/enviar")
@jwt_required()
def enviar(orden_id: UUID):
    orden = ordenes_compra_service.enviar(orden_id, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/aprobacion")
@jwt_required()
def decidir(orden_id: UUID):
    datos = DecidirAprobacion.model_validate(request.get_json())
    orden = ordenes_compra_service.decidir(orden_id, datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/emitir")
@jwt_required()
def emitir(orden_id: UUID):
    orden = ordenes_compra_service.emitir(orden_id, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/recepciones")
@jwt_required()
def crear_recepcion(orden_id: UUID):
    datos = RecepcionCompraEntrada.model_validate(request.get_json())
    orden = ordenes_compra_service.crear_recepcion(
        orden_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": orden}), 201


@ordenes_compra_bp.post("/<uuid:orden_id>/recepciones/<uuid:recepcion_id>/contabilizar")
@jwt_required()
def contabilizar_recepcion(orden_id: UUID, recepcion_id: UUID):
    orden = ordenes_compra_service.contabilizar_recepcion(
        orden_id, recepcion_id, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.put("/<uuid:orden_id>/recepciones/<uuid:recepcion_id>")
@jwt_required()
def editar_recepcion(orden_id: UUID, recepcion_id: UUID):
    datos = RecepcionCompraEntrada.model_validate(request.get_json())
    orden = ordenes_compra_service.editar_recepcion(
        orden_id, recepcion_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/recepciones/<uuid:recepcion_id>/factura")
@jwt_required()
def adjuntar_factura(orden_id: UUID, recepcion_id: UUID):
    datos = AdjuntarFacturaEntrada.model_validate(request.get_json())
    orden = ordenes_compra_service.adjuntar_factura(
        orden_id, recepcion_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/cerrar-saldo")
@jwt_required()
def cerrar_saldo(orden_id: UUID):
    datos = CerrarSaldoEntrada.model_validate(request.get_json())
    orden = ordenes_compra_service.cerrar_saldo(
        orden_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": orden}), 200


@ordenes_compra_bp.post("/<uuid:orden_id>/cancelar")
@jwt_required()
def cancelar(orden_id: UUID):
    datos = CancelarOrdenEntrada.model_validate(request.get_json())
    orden = ordenes_compra_service.cancelar(orden_id, datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": orden}), 200
