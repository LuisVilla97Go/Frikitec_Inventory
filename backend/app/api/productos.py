import io
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal
from uuid import UUID
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import get_jwt_identity, jwt_required
from pydantic import BaseModel
from app.models.movimiento import TipoMovimiento
from app.models.producto import DimProducto
from app.schemas.movimiento_schema import MovimientoCreate
from app.schemas.producto_schema import (
    ListadoProductos,
    ProductoActualizar,
    ProductoCrear,
    ProductoSalida,
    SugerenciasProducto,
)
from app.services import (
    importacion_productos,
    movimientos_service,
    productos_service,
    usuarios_service,
)
from app.services.errores import DatosInvalidos
from app.services.fechas import dia_de_negocio

productos_bp = Blueprint("productos", __name__)

XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class FiltroKardex(BaseModel):
    almacen_id: UUID | None = None


class ModoImportacion(BaseModel):
    modo: Literal["simular", "aplicar"] = "simular"


@productos_bp.get("/", strict_slashes=False)
@jwt_required()
def listar_productos():
    params = ListadoProductos.model_validate(request.args.to_dict())
    productos, total = productos_service.listar(params)
    ids = [p.id for p in productos]
    con_historia = productos_service.con_movimientos(ids)
    sin_costo = productos_service.sin_costo(ids)
    return (
        jsonify(
            {
                "status": "success",
                "data": [
                    ProductoSalida.desde(
                        p, p.id in con_historia, p.id in sin_costo
                    ).model_dump(mode="json")
                    for p in productos
                ],
                "page": params.page,
                "per_page": params.per_page,
                "total": total,
            }
        ),
        200,
    )


@productos_bp.get("/sugerencias")
@jwt_required()
def sugerencias_productos():
    params = SugerenciasProducto.model_validate(request.args.to_dict())
    return (
        jsonify({"status": "success", "data": productos_service.sugerencias(params)}),
        200,
    )


@productos_bp.post("/", strict_slashes=False)
@jwt_required()
def crear_producto():
    datos = ProductoCrear.model_validate(request.get_json())
    producto = productos_service.crear(datos, UUID(get_jwt_identity()))
    return jsonify({"status": "success", "data": _salida(producto)}), 201


@productos_bp.put("/<uuid:producto_id>")
@jwt_required()
def actualizar_producto(producto_id: UUID):
    datos = ProductoActualizar.model_validate(request.get_json())
    producto = productos_service.actualizar(
        producto_id, datos, UUID(get_jwt_identity())
    )
    return jsonify({"status": "success", "data": _salida(producto)}), 200


@productos_bp.get("/plantilla")
@jwt_required()
def descargar_plantilla():
    return send_file(
        io.BytesIO(importacion_productos.plantilla()),
        mimetype=XLSX,
        as_attachment=True,
        download_name="plantilla-productos.xlsx",
    )


@productos_bp.post("/importar")
@jwt_required()
def importar_productos():

    actor = usuarios_service.exigir_admin(
        UUID(get_jwt_identity()), "importar productos"
    )
    modo = ModoImportacion.model_validate(request.args.to_dict()).modo
    archivo = request.files.get("archivo")
    if archivo is None or not (archivo.filename or "").lower().endswith(".xlsx"):
        raise DatosInvalidos("Sube el catálogo como un archivo .xlsx")
    libro = importacion_productos.leer(archivo.read())
    revision = importacion_productos.revisar(libro)
    if modo == "aplicar":
        if revision.errores:
            mensaje = (
                f"El archivo tiene {len(revision.errores)} errores: no se aplicó nada"
            )
            return (
                jsonify(
                    {"status": "error", "message": mensaje, "data": revision.resumen()}
                ),
                422,
            )
        importacion_productos.aplicar(revision, actor.id)
    return jsonify({"status": "success", "data": revision.resumen()}), 200


def _salida(producto: DimProducto) -> dict:
    tiene = productos_service.tiene_movimientos(producto.id)
    sin_costo = bool(productos_service.sin_costo([producto.id]))
    return ProductoSalida.desde(producto, tiene, sin_costo).model_dump(mode="json")


@productos_bp.delete("/<uuid:producto_id>")
@jwt_required()
def desactivar_producto(producto_id: UUID):
    productos_service.desactivar(producto_id)
    return "", 204


@productos_bp.get("/<uuid:producto_id>/kardex")
@jwt_required()
def ver_kardex(producto_id: UUID):
    filtro = FiltroKardex.model_validate(request.args.to_dict())
    kardex = movimientos_service.kardex(producto_id, filtro.almacen_id)
    producto = kardex.producto
    return (
        jsonify(
            {
                "status": "success",
                "data": {
                    "id": str(producto.id),
                    "sku": producto.sku,
                    "name": producto.nombre,
                    "category": producto.categoria,
                    "unit": "UND",
                    "location": "General",
                    "minStock": 0,
                    "warehouses": [
                        {"id": str(a.id), "name": a.nombre} for a in kardex.almacenes
                    ],
                    "warehouseId": (
                        str(filtro.almacen_id) if filtro.almacen_id else None
                    ),
                    "movements": [
                        _linea_kardex_salida(linea) for linea in kardex.lineas
                    ],
                },
            }
        ),
        200,
    )


@productos_bp.post("/<uuid:producto_id>/movimientos")
@jwt_required()
def registrar_movimiento(producto_id: UUID):
    datos = MovimientoCreate.model_validate(request.get_json())
    usuario_id = UUID(get_jwt_identity())
    if datos.tipo_movimiento is TipoMovimiento.REVALORIZACION:

        usuarios_service.exigir_admin(usuario_id, "revalorizar el stock")
    movimientos_service.registrar(producto_id, datos, usuario_id)
    return jsonify({"status": "success", "message": "Movimiento registrado"}), 201


def _linea_kardex_salida(linea: movimientos_service.LineaKardex) -> dict:
    m = linea.movimiento
    importe = abs(Decimal(m.importe))
    return {
        "id": str(m.id),
        "date": dia_de_negocio(m.fecha_movimiento).isoformat(),
        "docType": m.tipo_documento.value.replace("_", " "),
        "docNumber": m.numero_documento,
        "purchaseOrderNumber": (
            m.recepcion_compra_linea.recepcion.version.orden.numero
            if m.recepcion_compra_linea is not None
            else None
        ),
        "purchaseOrderId": (
            str(m.recepcion_compra_linea.recepcion.version.orden.id)
            if m.recepcion_compra_linea is not None
            else None
        ),
        "detail": m.tipo_movimiento.value,
        "warehouse": linea.almacen,
        "type": (
            "ENTRADA"
            if m.cantidad > 0 or (m.cantidad == 0 and m.importe > 0)
            else "SALIDA"
        ),
        "qty": abs(m.cantidad),
        "unitCost": str(_unitario(importe, abs(m.cantidad))),
        "amount": str(importe),
        "balanceQty": linea.saldo_cantidad,
        "balanceCost": str(_unitario(linea.saldo_valorizado, linea.saldo_cantidad)),
        "balanceValue": str(linea.saldo_valorizado),
    }


def _unitario(valor: Decimal, unidades: int) -> Decimal:
    if unidades == 0:
        return Decimal("0.0000")
    return (valor / unidades).quantize(
        movimientos_service.DIEZMILESIMA, rounding=ROUND_HALF_UP
    )
