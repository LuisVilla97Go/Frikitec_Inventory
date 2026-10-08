from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required
from app.schemas.movimiento_schema import FiltroLibroDiario
from app.services import movimientos_service
from app.services.fechas import dia_de_negocio

movimientos_bp = Blueprint("movimientos", __name__)


@movimientos_bp.get("/", strict_slashes=False)
@jwt_required()
def libro_diario():
    filtro = FiltroLibroDiario.model_validate(request.args.to_dict())
    lineas, total = movimientos_service.libro_diario(filtro)
    return (
        jsonify(
            {
                "status": "success",
                "data": [_linea_salida(linea) for linea in lineas],
                "page": filtro.page,
                "per_page": filtro.per_page,
                "total": total,
            }
        ),
        200,
    )


def _linea_salida(linea: movimientos_service.LineaDiario) -> dict:
    m = linea.movimiento
    return {
        "id": str(m.id),
        "date": dia_de_negocio(m.fecha_movimiento).isoformat(),
        "movementType": m.tipo_movimiento.value,
        "docType": m.tipo_documento.value,
        "docNumber": m.numero_documento,
        "purchaseOrderNumber": linea.orden_compra,
        "purchaseOrderId": (
            str(linea.orden_compra_id) if linea.orden_compra_id else None
        ),
        "productId": str(m.producto_id),
        "sku": linea.sku,
        "productName": linea.producto,
        "warehouseId": str(m.almacen_id),
        "warehouse": linea.almacen,
        "qty": m.cantidad,
        "balance": m.saldo_cantidad,
        "unitCost": str(m.costo_unitario),
        "currency": m.moneda,
        "user": linea.usuario,
    }
