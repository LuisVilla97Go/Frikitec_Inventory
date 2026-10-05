from datetime import UTC, datetime
from decimal import Decimal
from typing import cast
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import func
from sqlalchemy.orm import InstrumentedAttribute, selectinload
from app.extensions import db
from app.models.guia_remision import (
    EstadoGuia,
    GuiaRemision,
    GuiaRemisionDetalle,
    MotivoTraslado,
)
from app.models.movimiento import TipoDocumento, TipoMovimiento
from app.models.proveedor import DimProveedor
from app.models.stock_almacen import FactStockAlmacen
from app.schemas.movimiento_schema import MovimientoCreate
from app.services.errores import (
    DatosInvalidos,
    ErrorDeNegocio,
    NoEncontrado,
    SinPermiso,
)
from app.services.movimientos_service import registrar_sin_confirmar
from app.services.productos_service import transaccion
from app.services.usuarios_service import obtener_activo


class GuiaDetalleCreate(BaseModel):
    producto_id: UUID
    cantidad: int = Field(gt=0)


class GuiaRemisionCreate(BaseModel):

    motivo_traslado: MotivoTraslado
    almacen_origen_id: UUID | None = None
    almacen_destino_id: UUID
    proveedor_id: UUID | None = None
    fecha_traslado: datetime
    peso_bruto_total: Decimal = Field(ge=0)
    conductor_nombre: str | None = Field(default=None, max_length=100)
    conductor_dni: str | None = Field(default=None, max_length=20)
    vehiculo_placa: str | None = Field(default=None, max_length=20)
    detalles: list[GuiaDetalleCreate] = Field(min_length=1)


class AnulacionGuia(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    motivo: str = Field(min_length=5, max_length=500)


class FiltroGuias(BaseModel, extra="forbid"):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=10, ge=1, le=200)


class FiltroStockDisponible(BaseModel, extra="forbid"):
    almacen_id: UUID
    producto_ids: list[UUID] = Field(min_length=1, max_length=200)

    @field_validator("producto_ids", mode="before")
    @classmethod
    def _separar(cls, valor: object) -> object:
        return [p for p in valor.split(",") if p] if isinstance(valor, str) else valor


class StockDisponible(BaseModel):
    producto_id: UUID
    stock: int


class GuiaResumen(BaseModel):
    id: UUID
    numero_guia: str
    fecha_traslado: datetime
    motivo_traslado: str
    estado: str
    origen: str
    destino: str
    total_items: int
    total_unidades: int


class GuiaDetalleSalida(BaseModel):
    producto_id: UUID
    producto_sku: str
    producto_nombre: str
    cantidad: int


class GuiaCompleta(GuiaResumen):
    almacen_origen_id: UUID | None
    almacen_destino_id: UUID
    proveedor_id: UUID | None
    proveedor_documento: str | None
    peso_bruto_total: Decimal
    conductor_nombre: str | None
    conductor_dni: str | None
    vehiculo_placa: str | None
    motivo_anulacion: str | None
    anulada_en: datetime | None
    detalles: list[GuiaDetalleSalida]


def _con_relaciones():

    return (
        selectinload(cast(InstrumentedAttribute, GuiaRemision.almacen_origen)),
        selectinload(cast(InstrumentedAttribute, GuiaRemision.almacen_destino)),
        selectinload(cast(InstrumentedAttribute, GuiaRemision.proveedor)),
        selectinload(cast(InstrumentedAttribute, GuiaRemision.detalles)).selectinload(
            cast(InstrumentedAttribute, GuiaRemisionDetalle.producto)
        ),
    )


def _resumen(guia: GuiaRemision) -> dict:
    lineas = cast(list[GuiaRemisionDetalle], guia.detalles)
    if guia.proveedor is not None:
        origen = guia.proveedor.razon_social
    elif guia.almacen_origen is not None:
        origen = guia.almacen_origen.nombre
    else:
        origen = "—"
    return {
        "id": guia.id,
        "numero_guia": guia.numero_guia,
        "fecha_traslado": guia.fecha_traslado,
        "motivo_traslado": guia.motivo_traslado.value,
        "estado": guia.estado.value,
        "origen": origen,
        "destino": guia.almacen_destino.nombre,
        "total_items": len(lineas),
        "total_unidades": sum(linea.cantidad for linea in lineas),
    }


def listar_guias_remision(filtro: FiltroGuias) -> tuple[list[GuiaResumen], int]:
    total = db.session.scalar(db.select(func.count()).select_from(GuiaRemision)) or 0
    guias = db.session.scalars(
        db.select(GuiaRemision)
        .options(*_con_relaciones())
        .order_by(GuiaRemision.numero_guia.desc())
        .limit(filtro.per_page)
        .offset((filtro.page - 1) * filtro.per_page)
    ).all()
    return [GuiaResumen(**_resumen(g)) for g in guias], total


def detalle_guia(guia: GuiaRemision) -> GuiaCompleta:
    proveedor = guia.proveedor
    return GuiaCompleta(
        **_resumen(guia),
        almacen_origen_id=None if proveedor else guia.almacen_origen_id,
        almacen_destino_id=guia.almacen_destino_id,
        proveedor_id=guia.proveedor_id,
        proveedor_documento=(
            f"{proveedor.tipo_documento} {proveedor.numero_documento}"
            if proveedor
            else None
        ),
        peso_bruto_total=guia.peso_bruto_total,
        conductor_nombre=guia.conductor_nombre,
        conductor_dni=guia.conductor_dni,
        vehiculo_placa=guia.vehiculo_placa,
        motivo_anulacion=guia.motivo_anulacion,
        anulada_en=guia.anulada_en,
        detalles=[
            GuiaDetalleSalida(
                producto_id=linea.producto_id,
                producto_sku=linea.producto.sku,
                producto_nombre=linea.producto.nombre,
                cantidad=linea.cantidad,
            )
            for linea in cast(list[GuiaRemisionDetalle], guia.detalles)
        ],
    )


def obtener_guia(guia_id: UUID) -> GuiaCompleta:
    guia = db.session.scalar(
        db.select(GuiaRemision)
        .options(*_con_relaciones())
        .where(GuiaRemision.id == guia_id)
    )
    if guia is None:
        raise NoEncontrado("Guía de remisión no encontrada")
    return detalle_guia(guia)


def stock_disponible(filtro: FiltroStockDisponible) -> list[StockDisponible]:
    ids = list(dict.fromkeys(filtro.producto_ids))
    filas = db.session.execute(
        db.select(FactStockAlmacen.producto_id, FactStockAlmacen.stock_actual).where(
            FactStockAlmacen.almacen_id == filtro.almacen_id,
            FactStockAlmacen.producto_id.in_(ids),
        )
    ).all()
    stock = {producto_id: cantidad for producto_id, cantidad in filas}
    return [StockDisponible(producto_id=p, stock=stock.get(p, 0)) for p in ids]


def _generar_correlativo() -> str:
    db.session.execute(db.text("LOCK TABLE guia_remision IN EXCLUSIVE MODE"))

    resultado = db.session.execute(
        db.text(
            "SELECT numero_guia FROM guia_remision ORDER BY numero_guia DESC LIMIT 1"
        )
    ).scalar()

    if not resultado:
        return "EG01-000001"

    prefijo, numero = resultado.split("-")
    siguiente = int(numero) + 1
    return f"{prefijo}-{siguiente:06d}"


def _mueve_stock(motivo: MotivoTraslado) -> bool:
    return motivo is not MotivoTraslado.COMPRA


def _unidades_por_producto(lineas: list) -> dict[UUID, int]:
    unidades: dict[UUID, int] = {}
    for linea in lineas:
        unidades[linea.producto_id] = (
            unidades.get(linea.producto_id, 0) + linea.cantidad
        )
    return unidades


def _validar(datos: GuiaRemisionCreate) -> None:
    if datos.motivo_traslado is MotivoTraslado.COMPRA:
        if datos.proveedor_id is None:
            raise DatosInvalidos(
                "Una guía de compra lleva el proveedor que envía la mercadería"
            )
        proveedor = db.session.get(DimProveedor, datos.proveedor_id)
        if proveedor is None or not proveedor.is_active:
            raise NoEncontrado("Proveedor no encontrado o inactivo")
        datos.almacen_origen_id = None
        return
    if datos.almacen_origen_id is None:
        raise DatosInvalidos("Falta el almacén de origen")
    if datos.almacen_origen_id == datos.almacen_destino_id:
        raise DatosInvalidos("El almacén de origen y destino no pueden ser el mismo")
    datos.proveedor_id = None


def _origen_guardado(datos: GuiaRemisionCreate) -> UUID:
    return datos.almacen_origen_id or datos.almacen_destino_id


def _asignar_cabecera(guia: GuiaRemision, datos: GuiaRemisionCreate) -> None:
    guia.fecha_traslado = datos.fecha_traslado
    guia.motivo_traslado = datos.motivo_traslado
    guia.almacen_origen_id = _origen_guardado(datos)
    guia.almacen_destino_id = datos.almacen_destino_id
    guia.proveedor_id = datos.proveedor_id
    guia.peso_bruto_total = datos.peso_bruto_total
    guia.conductor_nombre = datos.conductor_nombre
    guia.conductor_dni = datos.conductor_dni
    guia.vehiculo_placa = datos.vehiculo_placa


def _movimiento(
    almacen_id: UUID, numero: str, cantidad: int, costo: Decimal
) -> MovimientoCreate:
    return MovimientoCreate(
        almacen_id=almacen_id,
        tipo_movimiento=TipoMovimiento.TRANSFERENCIA,
        tipo_documento=TipoDocumento.GUIA_REMISION,
        numero_documento=numero,
        cantidad=cantidad,
        costo_unitario=costo,
        moneda="PEN",
        tipo_cambio=Decimal("1.0000"),
    )


def _registrar_lineas(
    guia: GuiaRemision, detalles: list[GuiaDetalleCreate], usuario_id: UUID
) -> None:
    for detalle in detalles:
        costo_origen = Decimal("0")
        if _mueve_stock(guia.motivo_traslado):
            origen = cast(UUID, guia.almacen_origen_id)
            salida = registrar_sin_confirmar(
                detalle.producto_id,
                _movimiento(origen, guia.numero_guia, -detalle.cantidad, Decimal("0")),
                usuario_id,
            )
            costo_origen = salida.costo_unitario
            registrar_sin_confirmar(
                detalle.producto_id,
                _movimiento(
                    guia.almacen_destino_id,
                    guia.numero_guia,
                    detalle.cantidad,
                    costo_origen,
                ),
                usuario_id,
                importe_traslado=-salida.importe,
            )

        linea = GuiaRemisionDetalle()
        linea.guia_remision_id = guia.id
        linea.producto_id = detalle.producto_id
        linea.cantidad = detalle.cantidad
        linea.costo_unitario_origen = costo_origen
        db.session.add(linea)
    db.session.flush()


def _revertir_lineas(guia: GuiaRemision, usuario_id: UUID) -> None:

    if not _mueve_stock(guia.motivo_traslado):
        return
    origen = cast(UUID, guia.almacen_origen_id)

    for linea in sorted(
        cast(list[GuiaRemisionDetalle], guia.detalles), key=lambda d: str(d.producto_id)
    ):
        stock = db.session.get(
            FactStockAlmacen, (linea.producto_id, guia.almacen_destino_id)
        )
        if stock is None or stock.stock_actual < linea.cantidad:
            quedan = stock.stock_actual if stock else 0
            raise ErrorDeNegocio(
                f"{guia.almacen_destino.nombre} ya no tiene las {linea.cantidad} unidades de "
                f"{linea.producto.nombre} que llegaron con esta guía (quedan {quedan}): "
                "no se puede deshacer el traslado"
            )
        salida = registrar_sin_confirmar(
            linea.producto_id,
            _movimiento(
                guia.almacen_destino_id, guia.numero_guia, -linea.cantidad, Decimal("0")
            ),
            usuario_id,
        )
        registrar_sin_confirmar(
            linea.producto_id,
            _movimiento(
                origen, guia.numero_guia, linea.cantidad, salida.costo_unitario
            ),
            usuario_id,
            importe_traslado=-salida.importe,
        )


def _bloquear(guia_id: UUID) -> GuiaRemision:
    guia = db.session.get(GuiaRemision, guia_id, with_for_update=True)
    if guia is None:
        raise NoEncontrado("Guía de remisión no encontrada")
    if guia.estado is EstadoGuia.ANULADO:
        raise ErrorDeNegocio(f"La guía {guia.numero_guia} está anulada: ya no cambia")
    return guia


def crear_guia_remision(datos: GuiaRemisionCreate, usuario_id: UUID) -> GuiaRemision:

    with transaccion():
        _validar(datos)
        guia = GuiaRemision()
        guia.numero_guia = _generar_correlativo()
        guia.fecha_emision = datetime.now(UTC)
        guia.estado = EstadoGuia.EN_TRANSITO
        guia.usuario_creador_id = usuario_id
        _asignar_cabecera(guia, datos)
        db.session.add(guia)
        db.session.flush()
        _registrar_lineas(guia, datos.detalles, usuario_id)
        return guia


def editar_guia(
    guia_id: UUID, datos: GuiaRemisionCreate, usuario_id: UUID
) -> GuiaCompleta:

    with transaccion():
        guia = _bloquear(guia_id)
        _validar(datos)
        rehacer = (
            _unidades_por_producto(cast(list, guia.detalles))
            != _unidades_por_producto(datos.detalles)
            or _mueve_stock(guia.motivo_traslado) != _mueve_stock(datos.motivo_traslado)
            or guia.almacen_origen_id != _origen_guardado(datos)
            or guia.almacen_destino_id != datos.almacen_destino_id
        )
        if rehacer:
            _revertir_lineas(guia, usuario_id)
            cast(list[GuiaRemisionDetalle], guia.detalles).clear()
            db.session.flush()
        _asignar_cabecera(guia, datos)
        db.session.flush()
        if rehacer:
            _registrar_lineas(guia, datos.detalles, usuario_id)
        db.session.refresh(guia)
        return detalle_guia(guia)


def anular_guia(guia_id: UUID, datos: AnulacionGuia, usuario_id: UUID) -> GuiaCompleta:

    actor = obtener_activo(usuario_id)
    if actor is None or not (
        actor.is_admin or "jefe" in (actor.cargo or "").casefold()
    ):
        raise SinPermiso("Solo un administrador o un jefe puede anular una guía")
    with transaccion():
        guia = _bloquear(guia_id)
        _revertir_lineas(guia, usuario_id)
        guia.estado = EstadoGuia.ANULADO
        guia.motivo_anulacion = datos.motivo
        guia.anulada_en = datetime.now(UTC)
        guia.usuario_anulacion_id = usuario_id
        db.session.flush()
        return detalle_guia(guia)
