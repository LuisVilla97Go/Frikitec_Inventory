from dataclasses import asdict
from datetime import UTC, datetime
from decimal import Decimal
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required
from app.services import dashboard_service
from app.services.fechas import dia_de_negocio

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/resumen")
@jwt_required()
def resumen():
    datos = dashboard_service.resumen(dia_de_negocio(datetime.now(UTC)))
    return (
        jsonify(
            {
                "status": "success",
                "data": {
                    "umbral_stock_bajo": dashboard_service.UMBRAL_STOCK_BAJO,
                    **{clave: _json(valor) for clave, valor in asdict(datos).items()},
                },
            }
        ),
        200,
    )


def _json(valor):

    if valor is None:
        return None
    if isinstance(valor, dict):
        return {clave: _json(v) for clave, v in valor.items()}
    if isinstance(valor, list):
        return [_json(v) for v in valor]
    if isinstance(valor, Decimal):
        return str(valor)
    if isinstance(valor, (bool, int, str)):
        return valor
    return str(valor)
