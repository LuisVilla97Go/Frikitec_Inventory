from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import cast
from uuid import UUID
from sqlalchemy import func, or_
from sqlalchemy.orm import InstrumentedAttribute, joinedload
from app.extensions import db
from app.models.almacen import DimAlmacen
from app.models.movimiento import FactMovimiento, TipoDocumento, TipoMovimiento
from app.models.orden_compra import (
    OrdenCompra,
    OrdenCompraVersion,
    RecepcionCompra,
    RecepcionCompraLinea,
)
from app.models.producto import DimProducto
from app.models.proveedor import DimProveedor
from app.models.stock_almacen import FactStockAlmacen
from app.models.usuario import DimUsuario
from app.schemas.movimiento_schema import FiltroLibroDiario, MovimientoCreate
from app.services.busqueda import escapar_like
from app.services.errores import DatosInvalidos, ErrorDeNegocio, NoEncontrado
from app.services.fechas import fin_del_dia_utc, inicio_del_dia_utc

ENTRADAS = (TipoMovimiento.ENTRADA_COMPRA, TipoMovimiento.AJUSTE_POSITIVO)
SALIDAS = (TipoMovimiento.SALIDA_VENTA, TipoMovimiento.AJUSTE_NEGATIVO)

CENTIMO = Decimal("0.01")
DIEZMILESIMA = Decimal("0.0001")


def redondear(valor: Decimal) -> Decimal:

    return valor.quantize(CENTIMO, rounding=ROUND_HALF_UP)


def registrar(
    producto_id: UUID, datos: MovimientoCreate, usuario_id: UUID
) -> FactMovimiento:
    movimiento = registrar_sin_confirmar(producto_id, datos, usuario_id)
    db.session.commit()
    return movimiento


def registrar_sin_confirmar(
    producto_id: UUID,
    datos: MovimientoCreate,
    usuario_id: UUID,
    *,
    importe_traslado: Decimal | None = None,
    recepcion_compra_linea_id: UUID | None = None,
) -> FactMovimiento:

    producto = db.session.get(DimProducto, producto_id, with_for_update=True)
    if producto is None or not producto.is_active:
        raise NoEncontrado("Producto no encontrado")
    almacen = db.session.get(DimAlmacen, datos.almacen_id)
    if almacen is None or not almacen.is_active:
        raise NoEncontrado("Almacén no encontrado")
    if recepcion_compra_linea_id is not None:
        _validar_origen_recepcion(
            recepcion_compra_linea_id,
            producto_id,
            datos,
            proveedor_id=datos.proveedor_id,
        )

    if datos.proveedor_id is not None:
        proveedor = db.session.get(DimProveedor, datos.proveedor_id)
        if proveedor is None or (
            not proveedor.is_active and recepcion_compra_linea_id is None
        ):
            raise NoEncontrado("Proveedor no encontrado o inactivo")

    _validar(datos)

    stock = db.session.get(
        FactStockAlmacen, (producto_id, datos.almacen_id), with_for_update=True
    )
    stock_previo = stock.stock_actual if stock else 0
    valor_previo = Decimal(stock.valor_total) if stock else Decimal("0")
    if stock_previo + datos.cantidad < 0:
        raise ErrorDeNegocio("Stock insuficiente en el almacén seleccionado")

    unidades_previas, valor_global_previo = _totales_del_producto(producto_id)

    if datos.cantidad > 0:
        costo = datos.costo_unitario or Decimal("0")

        importe = (
            importe_traslado
            if importe_traslado is not None
            else redondear(Decimal(datos.cantidad) * costo * datos.tipo_cambio)
        )
    elif datos.tipo_movimiento is TipoMovimiento.REVALORIZACION:

        if stock_previo == 0:
            raise ErrorDeNegocio(
                "Sin unidades en el almacén no hay valor que corregir: "
                "la próxima compra fija el costo"
            )
        costo = datos.costo_unitario or Decimal("0")
        importe = redondear(Decimal(stock_previo) * costo) - valor_previo
        if importe == 0:
            raise ErrorDeNegocio("Con ese costo el valor del almacén no cambia")
    else:

        importe = -redondear(
            valor_previo * Decimal(-datos.cantidad) / Decimal(stock_previo)
        )
        costo = (importe / Decimal(datos.cantidad)).quantize(
            DIEZMILESIMA, rounding=ROUND_HALF_UP
        )

    movimiento = FactMovimiento()
    movimiento.producto_id = producto_id
    movimiento.almacen_id = datos.almacen_id
    movimiento.usuario_id = usuario_id
    movimiento.proveedor_id = datos.proveedor_id
    movimiento.recepcion_compra_linea_id = recepcion_compra_linea_id
    movimiento.tipo_movimiento = datos.tipo_movimiento
    movimiento.tipo_documento = datos.tipo_documento
    movimiento.numero_documento = datos.numero_documento
    movimiento.cantidad = datos.cantidad
    movimiento.costo_unitario = costo
    movimiento.moneda = datos.moneda
    movimiento.tipo_cambio = datos.tipo_cambio
    saldo_cantidad = stock_previo + datos.cantidad
    saldo_valorizado = valor_previo + importe
    movimiento.importe = importe
    movimiento.saldo_cantidad = saldo_cantidad
    movimiento.saldo_valorizado = saldo_valorizado
    db.session.add(movimiento)

    if stock is None:
        stock = FactStockAlmacen()
        stock.producto_id = producto_id
        stock.almacen_id = datos.almacen_id
        stock.costo_promedio = Decimal("0")
        db.session.add(stock)

    stock.stock_actual = saldo_cantidad
    stock.valor_total = saldo_valorizado
    if saldo_cantidad > 0:

        stock.costo_promedio = (saldo_valorizado / Decimal(saldo_cantidad)).quantize(
            DIEZMILESIMA, rounding=ROUND_HALF_UP
        )

    unidades = unidades_previas + datos.cantidad
    if unidades > 0:

        producto.precio_compra_actual = redondear(
            (valor_global_previo + importe) / unidades
        )

    db.session.flush()
    return movimiento


def _validar_origen_recepcion(
    recepcion_linea_id: UUID,
    producto_id: UUID,
    datos: MovimientoCreate,
    *,
    proveedor_id: UUID | None,
) -> None:

    linea = db.session.get(
        RecepcionCompraLinea, recepcion_linea_id, with_for_update=True
    )
    if linea is None:
        raise NoEncontrado("Línea de recepción no encontrada")
    recepcion = db.session.get(RecepcionCompra, linea.recepcion_id)
    if recepcion is None or recepcion.estado != "BORRADOR":
        raise DatosInvalidos("La recepción ya fue contabilizada o no está disponible")
    version = recepcion.version
    if (
        linea.orden_linea.producto_id != producto_id
        or linea.almacen_id != datos.almacen_id
        or linea.cantidad_aceptada != datos.cantidad
        or Decimal(linea.costo_unitario) != datos.costo_unitario
        or version.proveedor_id != proveedor_id
        or datos.tipo_movimiento != TipoMovimiento.ENTRADA_COMPRA
    ):
        raise DatosInvalidos(
            "El movimiento no coincide con la línea de recepción aprobada"
        )


def _validar(datos: MovimientoCreate) -> None:
    es_entrada = datos.tipo_movimiento in ENTRADAS or (
        datos.tipo_movimiento == TipoMovimiento.TRANSFERENCIA and datos.cantidad > 0
    )
    es_salida = datos.tipo_movimiento in SALIDAS or (
        datos.tipo_movimiento == TipoMovimiento.TRANSFERENCIA and datos.cantidad < 0
    )

    if es_entrada:
        if datos.cantidad <= 0:
            raise DatosInvalidos("Las entradas deben tener cantidad positiva")
        if datos.costo_unitario is None or datos.costo_unitario < 0:
            raise DatosInvalidos(
                "Las entradas requieren un costo unitario mayor o igual a 0"
            )
    elif es_salida:

        if datos.cantidad >= 0:
            raise DatosInvalidos("Las salidas deben tener cantidad negativa")
    elif datos.tipo_movimiento is TipoMovimiento.REVALORIZACION:
        if datos.cantidad != 0:
            raise DatosInvalidos("Una revalorización no mueve unidades: cantidad 0")
        if datos.costo_unitario is None or datos.costo_unitario < 0:
            raise DatosInvalidos(
                "La revalorización requiere el nuevo costo unitario (0 o más)"
            )

        if (
            datos.tipo_documento is not TipoDocumento.AJUSTE_INVENTARIO
            or datos.moneda != "PEN"
        ):
            raise DatosInvalidos("La revalorización va en soles, con un acta de ajuste")
    else:
        raise DatosInvalidos(
            f"Tipo de movimiento no soportado o cantidad 0: {datos.tipo_movimiento.value}"
        )

    if datos.tipo_cambio <= 0:
        raise DatosInvalidos("El tipo de cambio debe ser mayor que 0")
    if datos.moneda == "PEN" and datos.tipo_cambio != 1:
        raise DatosInvalidos("Un movimiento en soles lleva tipo de cambio 1")


def _totales_del_producto(producto_id: UUID) -> tuple[int, Decimal]:

    unidades, valor = db.session.execute(
        db.select(
            func.coalesce(func.sum(FactStockAlmacen.stock_actual), 0),
            func.coalesce(func.sum(FactStockAlmacen.valor_total), 0),
        ).where(FactStockAlmacen.producto_id == producto_id)
    ).one()
    return int(unidades), Decimal(valor)


@dataclass(frozen=True)
class LineaDiario:

    movimiento: FactMovimiento
    sku: str
    producto: str
    almacen: str
    usuario: str
    orden_compra: str | None
    orden_compra_id: UUID | None


def libro_diario(filtro: FiltroLibroDiario) -> tuple[list[LineaDiario], int]:

    consulta = (
        db.select(
            FactMovimiento,
            DimProducto.sku,
            DimProducto.nombre,
            DimAlmacen.nombre,
            DimUsuario.nombres,
            DimUsuario.apellidos,
            OrdenCompra.id,
            OrdenCompra.numero,
        )
        .join(DimProducto, FactMovimiento.producto_id == DimProducto.id)
        .join(DimAlmacen, FactMovimiento.almacen_id == DimAlmacen.id)
        .join(DimUsuario, FactMovimiento.usuario_id == DimUsuario.id)
        .outerjoin(
            RecepcionCompraLinea,
            FactMovimiento.recepcion_compra_linea_id == RecepcionCompraLinea.id,
        )
        .outerjoin(
            RecepcionCompra, RecepcionCompraLinea.recepcion_id == RecepcionCompra.id
        )
        .outerjoin(
            OrdenCompraVersion, RecepcionCompra.version_id == OrdenCompraVersion.id
        )
        .outerjoin(OrdenCompra, OrdenCompraVersion.orden_id == OrdenCompra.id)
    )
    if filtro.desde:
        consulta = consulta.where(
            FactMovimiento.fecha_movimiento >= inicio_del_dia_utc(filtro.desde)
        )
    if filtro.hasta:
        consulta = consulta.where(
            FactMovimiento.fecha_movimiento < fin_del_dia_utc(filtro.hasta)
        )
    if filtro.almacen_id:
        consulta = consulta.where(FactMovimiento.almacen_id == filtro.almacen_id)
    if filtro.tipo_movimiento:
        consulta = consulta.where(
            FactMovimiento.tipo_movimiento == filtro.tipo_movimiento
        )
    if filtro.search:
        patron = f"%{escapar_like(filtro.search.lower())}%"
        consulta = consulta.where(
            or_(
                func.lower(DimProducto.sku).like(patron, escape="\\"),
                func.lower(DimProducto.nombre).like(patron, escape="\\"),
                func.lower(FactMovimiento.numero_documento).like(patron, escape="\\"),
            )
        )

    total = db.session.execute(
        db.select(func.count()).select_from(consulta.subquery())
    ).scalar_one()
    filas = db.session.execute(
        consulta.order_by(
            FactMovimiento.fecha_movimiento.desc(), FactMovimiento.id.desc()
        )
        .limit(filtro.per_page)
        .offset((filtro.page - 1) * filtro.per_page)
    ).all()
    lineas = [
        LineaDiario(
            movimiento=m,
            sku=sku,
            producto=producto,
            almacen=almacen,
            usuario=f"{nombres} {apellidos}",
            orden_compra_id=id_orden,
            orden_compra=numero_orden,
        )
        for m, sku, producto, almacen, nombres, apellidos, id_orden, numero_orden in filas
    ]
    return lineas, total


@dataclass(frozen=True)
class LineaKardex:

    movimiento: FactMovimiento
    almacen: str
    saldo_cantidad: int
    saldo_valorizado: Decimal


@dataclass(frozen=True)
class KardexValorizado:
    producto: DimProducto
    almacenes: list[DimAlmacen]
    lineas: list[LineaKardex]


def kardex(producto_id: UUID, almacen_id: UUID | None) -> KardexValorizado:

    producto = db.session.get(DimProducto, producto_id)
    if producto is None:
        raise NoEncontrado("Producto no encontrado")
    consulta = (
        db.select(FactMovimiento, DimAlmacen.nombre)
        .join(DimAlmacen, FactMovimiento.almacen_id == DimAlmacen.id)
        .options(
            joinedload(
                cast(InstrumentedAttribute, FactMovimiento.recepcion_compra_linea)
            )
            .joinedload(RecepcionCompraLinea.recepcion)
            .joinedload(RecepcionCompra.version)
            .joinedload(OrdenCompraVersion.orden)
        )
        .where(FactMovimiento.producto_id == producto_id)
    )
    if almacen_id is not None:
        consulta = consulta.where(FactMovimiento.almacen_id == almacen_id)
    filas = db.session.execute(
        consulta.order_by(
            FactMovimiento.fecha_movimiento.asc(), FactMovimiento.id.asc()
        )
    ).all()

    saldos: dict[UUID, tuple[int, Decimal]] = {}
    lineas: list[LineaKardex] = []
    for m, almacen in filas:
        saldos[m.almacen_id] = (m.saldo_cantidad, Decimal(m.saldo_valorizado))
        lineas.append(
            LineaKardex(
                movimiento=m,
                almacen=almacen,
                saldo_cantidad=sum(cantidad for cantidad, _ in saldos.values()),
                saldo_valorizado=sum(
                    (valor for _, valor in saldos.values()), Decimal("0")
                ),
            )
        )
    almacenes = db.session.execute(
        db.select(DimAlmacen)
        .where(DimAlmacen.is_active.is_(True))
        .order_by(DimAlmacen.nombre)
    ).scalars()
    return KardexValorizado(producto=producto, almacenes=list(almacenes), lineas=lineas)
