from collections.abc import Iterator
from contextlib import contextmanager
from decimal import Decimal
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.movimiento import FactMovimiento, TipoDocumento, TipoMovimiento
from app.models.orden_compra import OrdenCompra, OrdenCompraLinea, OrdenCompraVersion
from app.models.producto import DimProducto
from app.models.stock_almacen import FactStockAlmacen
from app.schemas.movimiento_schema import MovimientoCreate
from app.schemas.producto_schema import (
    CAMPOS_DE_CARGA,
    COLUMNA_DE_CAMPO,
    CargaInicial,
    ListadoProductos,
    ProductoActualizar,
    ProductoCrear,
    SugerenciasProducto,
)
from app.services import movimientos_service
from app.services.busqueda import escapar_like, todas_las_palabras
from app.services.errores import DatosInvalidos, ErrorDeNegocio, NoEncontrado

MAX_SUGERENCIAS = 20
_COLUMNA_SUGERIBLE = {
    "marca": DimProducto.marca,
    "sub_categoria": DimProducto.sub_categoria,
    "variante": DimProducto.variante,
}


def listar(params: ListadoProductos) -> tuple[list[DimProducto], int]:
    consulta = db.select(DimProducto).where(DimProducto.is_active.is_(True))
    if params.search and params.search.strip():
        consulta = consulta.where(
            todas_las_palabras(
                params.search,
                DimProducto.nombre,
                DimProducto.sku,
                DimProducto.codigo_barras,
                DimProducto.marca,
                DimProducto.variante,
            )
        )
    if params.sin_costo:
        consulta = consulta.where(DimProducto.id.in_(_con_stock_sin_valor()))
    total = db.session.execute(
        db.select(func.count()).select_from(consulta.subquery())
    ).scalar_one()
    pagina = db.session.execute(
        consulta.order_by(DimProducto.nombre)
        .limit(params.per_page)
        .offset((params.page - 1) * params.per_page)
    ).scalars()
    return list(pagina), total


def sugerencias(params: SugerenciasProducto) -> list[str]:

    columna = _COLUMNA_SUGERIBLE[params.campo]
    consulta = (
        db.select(columna)
        .where(DimProducto.is_active.is_(True), columna.is_not(None), columna != "")
        .group_by(columna)
        .order_by(func.count().desc(), columna)
        .limit(MAX_SUGERENCIAS)
    )
    if params.categoria is not None:
        consulta = consulta.where(DimProducto.categoria == params.categoria.value)
    if params.q:
        patron = f"%{escapar_like(params.q.lower())}%"
        consulta = consulta.where(func.lower(columna).like(patron, escape="\\"))
    return list(db.session.execute(consulta).scalars())


def obtener_activo(producto_id: UUID) -> DimProducto:
    producto = db.session.get(DimProducto, producto_id)
    if producto is None or not producto.is_active:
        raise NoEncontrado("Producto no encontrado")
    return producto


def tiene_movimientos(producto_id: UUID) -> bool:
    return bool(con_movimientos([producto_id]))


def con_movimientos(producto_ids: list[UUID]) -> set[UUID]:

    if not producto_ids:
        return set()
    filas = db.session.execute(
        db.select(FactMovimiento.producto_id)
        .where(FactMovimiento.producto_id.in_(producto_ids))
        .distinct()
    ).scalars()
    return set(filas)


def _con_stock_sin_valor():

    return db.select(FactStockAlmacen.producto_id).where(
        FactStockAlmacen.stock_actual > 0, FactStockAlmacen.valor_total == 0
    )


def sin_costo(producto_ids: list[UUID]) -> set[UUID]:

    if not producto_ids:
        return set()
    filas = db.session.execute(
        _con_stock_sin_valor()
        .where(FactStockAlmacen.producto_id.in_(producto_ids))
        .distinct()
    ).scalars()
    return set(filas)


def crear(datos: ProductoCrear, usuario_id: UUID) -> DimProducto:

    producto = DimProducto()
    for campo, valor in datos.model_dump(exclude=CAMPOS_DE_CARGA).items():
        setattr(producto, COLUMNA_DE_CAMPO[campo], valor)
    db.session.add(producto)
    with transaccion():
        escribir_sin_duplicado(datos.sku)
        cargar_stock_inicial(producto, datos, usuario_id)
    return producto


def actualizar(
    producto_id: UUID, datos: ProductoActualizar, usuario_id: UUID
) -> DimProducto:
    producto = obtener_activo(producto_id)
    cambios = datos.model_dump(exclude_unset=True, exclude=CAMPOS_DE_CARGA)

    if ("purchase_price" in cambios or datos.initial_stock > 0) and tiene_movimientos(
        producto.id
    ):
        raise DatosInvalidos(
            "Este producto ya tiene movimientos: su costo y su stock los lleva el Kardex"
        )
    for campo, valor in cambios.items():
        setattr(producto, COLUMNA_DE_CAMPO[campo], valor)
    with transaccion():
        escribir_sin_duplicado(datos.sku)
        cargar_stock_inicial(producto, datos, usuario_id)
    return producto


def desactivar(producto_id: UUID) -> None:
    producto = db.session.get(DimProducto, producto_id, with_for_update=True)
    if producto is None or not producto.is_active:
        raise NoEncontrado("Producto no encontrado")
    orden_abierta = db.session.execute(
        db.select(OrdenCompra.id)
        .join(OrdenCompraVersion, OrdenCompraVersion.orden_id == OrdenCompra.id)
        .join(OrdenCompraLinea, OrdenCompraLinea.version_id == OrdenCompraVersion.id)
        .where(
            OrdenCompraLinea.producto_id == producto_id,
            OrdenCompraVersion.numero_version == OrdenCompra.version_actual,
            OrdenCompra.estado.in_(
                {"PENDIENTE_APROBACION", "APROBADA", "EMITIDA", "PARCIALMENTE_RECIBIDA"}
            ),
        )
        .limit(1)
    ).scalar_one_or_none()
    if orden_abierta is not None:
        raise ErrorDeNegocio("Este producto participa en una orden de compra abierta")
    producto.is_active = False
    db.session.commit()


def cargar_stock_inicial(
    producto: DimProducto, datos: CargaInicial, usuario_id: UUID, origen: str = "ALTA"
) -> None:

    if datos.initial_stock == 0:
        return
    if datos.warehouse_id is None:
        raise DatosInvalidos("El stock inicial necesita un almacén")
    movimientos_service.registrar_sin_confirmar(
        producto.id,
        MovimientoCreate(
            almacen_id=datos.warehouse_id,
            tipo_movimiento=TipoMovimiento.AJUSTE_POSITIVO,
            tipo_documento=TipoDocumento.CARGA_INICIAL,
            numero_documento=f"{origen}-{producto.sku}",
            cantidad=datos.initial_stock,
            costo_unitario=producto.precio_compra_actual,
            moneda="PEN",
            tipo_cambio=Decimal("1.0000"),
        ),
        usuario_id,
    )


@contextmanager
def transaccion() -> Iterator[None]:

    try:
        yield
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise


def escribir_sin_duplicado(sku: str | None) -> None:
    try:
        db.session.flush()
    except IntegrityError as e:
        raise ErrorDeNegocio(f"Ya existe un producto con el SKU {sku}") from e
