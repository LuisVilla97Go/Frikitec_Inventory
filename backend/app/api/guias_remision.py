from uuid import UUID
from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from app.services.guias_service import (
    AnulacionGuia,
    FiltroGuias,
    FiltroStockDisponible,
    GuiaRemisionCreate,
    anular_guia,
    crear_guia_remision,
    editar_guia,
    listar_guias_remision,
    obtener_guia,
    stock_disponible,
)

bp = Blueprint("guias", __name__, url_prefix="/api/guias-remision")


@bp.route("", methods=["GET"])
@jwt_required()
def listar_guias():
    filtro = FiltroGuias.model_validate(request.args.to_dict())
    guias, total = listar_guias_remision(filtro)
    return jsonify(
        {
            "status": "success",
            "data": [g.model_dump(mode="json") for g in guias],
            "page": filtro.page,
            "per_page": filtro.per_page,
            "total": total,
        }
    )


@bp.route("", methods=["POST"])
@jwt_required()
def crear_guia():
    datos = GuiaRemisionCreate.model_validate(request.get_json())
    guia = crear_guia_remision(datos, UUID(get_jwt_identity()))
    return (
        jsonify(
            {
                "status": "success",
                "data": {
                    "id": str(guia.id),
                    "numero_guia": guia.numero_guia,
                    "estado": guia.estado.value,
                },
            }
        ),
        201,
    )


@bp.route("/stock-disponible", methods=["GET"])
@jwt_required()
def ver_stock_disponible():
    filtro = FiltroStockDisponible.model_validate(request.args.to_dict())
    datos = [s.model_dump(mode="json") for s in stock_disponible(filtro)]
    return jsonify({"status": "success", "data": datos})


@bp.route("/<uuid:guia_id>", methods=["GET"])
@jwt_required()
def detalle_guia(guia_id: UUID):
    return jsonify(
        {"status": "success", "data": obtener_guia(guia_id).model_dump(mode="json")}
    )


@bp.route("/<uuid:guia_id>", methods=["PUT"])
@jwt_required()
def editar(guia_id: UUID):
    datos = GuiaRemisionCreate.model_validate(request.get_json())
    guia = editar_guia(guia_id, datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": guia.model_dump(mode="json")})


@bp.route("/<uuid:guia_id>/anular", methods=["POST"])
@jwt_required()
def anular(guia_id: UUID):
    datos = AnulacionGuia.model_validate(request.get_json())
    guia = anular_guia(guia_id, datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": guia.model_dump(mode="json")})
