from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.models.toma_fisica import DocTomaFisica
from app.schemas.toma_fisica_schema import (
    AgregarProductos,
    AnularToma,
    FiltroTomas,
    GuardarConteo,
    TomaFisicaCrear,
)
from app.services import toma_fisica_service

toma_fisica_bp = Blueprint("toma_fisica", __name__)


def _usuario() -> UUID:
    return UUID(get_jwt_identity())


def _detalle(toma: DocTomaFisica) -> dict:
    return toma_fisica_service.salida(toma, _usuario(), con_lineas=True).model_dump(
        mode="json"
    )


@toma_fisica_bp.get("/", strict_slashes=False)
@jwt_required()
def listar_tomas():
    filtro = FiltroTomas.model_validate(request.args.to_dict())
    tomas, total = toma_fisica_service.listar(filtro)
    datos = [
        toma_fisica_service.salida(t, _usuario(), con_lineas=False).model_dump(
            mode="json"
        )
        for t in tomas
    ]
    return (
        jsonify(
            {
                "status": "success",
                "data": datos,
                "page": filtro.page,
                "per_page": filtro.per_page,
                "total": total,
            }
        ),
        200,
    )


@toma_fisica_bp.post("/", strict_slashes=False)
@jwt_required()
def crear_toma():
    datos = TomaFisicaCrear.model_validate(request.get_json())
    toma = toma_fisica_service.crear(datos, _usuario())
    return jsonify({"status": "success", "data": _detalle(toma)}), 201


@toma_fisica_bp.get("/<uuid:toma_id>")
@jwt_required()
def ver_toma(toma_id: UUID):
    toma = toma_fisica_service.obtener(toma_id)
    return jsonify({"status": "success", "data": _detalle(toma)}), 200


@toma_fisica_bp.post("/<uuid:toma_id>/productos")
@jwt_required()
def agregar_productos(toma_id: UUID):
    datos = AgregarProductos.model_validate(request.get_json())
    toma = toma_fisica_service.agregar_productos(
        toma_id, datos.producto_ids, _usuario()
    )
    return jsonify({"status": "success", "data": _detalle(toma)}), 200


@toma_fisica_bp.delete("/<uuid:toma_id>/lineas/<uuid:linea_id>")
@jwt_required()
def quitar_linea(toma_id: UUID, linea_id: UUID):
    toma = toma_fisica_service.quitar_linea(toma_id, linea_id, _usuario())
    return jsonify({"status": "success", "data": _detalle(toma)}), 200


@toma_fisica_bp.put("/<uuid:toma_id>/conteo")
@jwt_required()
def guardar_conteo(toma_id: UUID):
    datos = GuardarConteo.model_validate(request.get_json())
    toma = toma_fisica_service.guardar_conteo(toma_id, datos, _usuario())
    return jsonify({"status": "success", "data": _detalle(toma)}), 200


@toma_fisica_bp.post("/<uuid:toma_id>/contabilizar")
@jwt_required()
def contabilizar_toma(toma_id: UUID):
    toma = toma_fisica_service.contabilizar(toma_id, _usuario())
    return jsonify({"status": "success", "data": _detalle(toma)}), 200


@toma_fisica_bp.post("/<uuid:toma_id>/anular")
@jwt_required()
def anular_toma(toma_id: UUID):
    datos = AnularToma.model_validate(request.get_json())
    toma = toma_fisica_service.anular(toma_id, datos.motivo, _usuario())
    return jsonify({"status": "success", "data": _detalle(toma)}), 200
