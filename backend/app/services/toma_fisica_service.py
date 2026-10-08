from dataclasses import dataclass
from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID
from sqlalchemy import func
from app.extensions import db
from app.models.almacen import DimAlmacen
from app.models.movimiento import FactMovimiento, TipoDocumento, TipoMovimiento
from app.models.producto import DimProducto
from app.models.stock_almacen import FactStockAlmacen
from app.models.toma_fisica import (
    SECUENCIA_NUMERO,
    DocTomaFisica,
    DocTomaFisicaLinea,
    EstadoTomaFisica,
)
from app.models.usuario import DimUsuario
from app.schemas.movimiento_schema import MovimientoCreate
from app.schemas.toma_fisica_schema import (
    FiltroTomas,
    GuardarConteo,
    LineaSalida,
    TomaFisicaCrear,
    TomaSalida,
)
from app.services import movimientos_service, usuarios_service
from app.services.errores import ErrorDeNegocio, NoEncontrado, SinPermiso

DIEZMILESIMA = Decimal("0.0001")


def _actor(usuario_id: UUID) -> DimUsuario:
    actor = usuarios_service.obtener_activo(usuario_id)
    if actor is None:
        raise SinPermiso("Tu usuario no está activo")
    return actor


def _documento(toma_id: UUID, *, bloquear: bool = False) -> DocTomaFisica:
    toma = db.session.get(DocTomaFisica, toma_id, with_for_update=bloquear)
    if toma is None:
        raise NoEncontrado("Toma física no encontrada")
    return toma


def obtener(toma_id: UUID) -> DocTomaFisica:
    return _documento(toma_id)


def _exigir_abierta(toma: DocTomaFisica) -> None:
    if toma.estado is not EstadoTomaFisica.ABIERTO:
        raise ErrorDeNegocio(
            f"La toma física {toma.numero} está {toma.estado.value.lower()}: ya no se cambia"
        )


def _stock(producto_id: UUID, almacen_id: UUID) -> FactStockAlmacen | None:
    return db.session.get(FactStockAlmacen, (producto_id, almacen_id))


def costo_unitario_actual(
    producto: DimProducto, stock: FactStockAlmacen | None
) -> Decimal:
    """El de la tienda (valor ÷ unidades); sin unidades, el del producto."""
    if stock is not None and stock.stock_actual > 0:
        return (Decimal(stock.valor_total) / stock.stock_actual).quantize(
            DIEZMILESIMA, rounding=ROUND_HALF_UP
        )
    return Decimal(producto.precio_compra_actual or 0)


def _agregar(toma: DocTomaFisica, producto_ids: list[UUID]) -> None:
    ya = {linea.producto_id for linea in toma.lineas}
    for producto_id in dict.fromkeys(producto_ids):
        if producto_id in ya:
            continue
        producto = db.session.get(DimProducto, producto_id)
        if producto is None or not producto.is_active:
            raise NoEncontrado("Producto no encontrado")
        otra = db.session.execute(
            db.select(DocTomaFisica.numero)
            .join(
                DocTomaFisicaLinea, DocTomaFisicaLinea.documento_id == DocTomaFisica.id
            )
            .where(
                DocTomaFisicaLinea.abierta.is_(True),
                DocTomaFisicaLinea.almacen_id == toma.almacen_id,
                DocTomaFisicaLinea.producto_id == producto_id,
            )
        ).scalar_one_or_none()
        if otra is not None:
            raise ErrorDeNegocio(
                f"{producto.sku} ya se está contando en la toma física {otra}"
            )
        stock = _stock(producto_id, toma.almacen_id)
        linea = DocTomaFisicaLinea()
        linea.producto_id = producto_id
        linea.almacen_id = toma.almacen_id
        linea.abierta = True
        linea.stock_sistema = stock.stock_actual if stock else 0
        toma.lineas.append(linea)
        ya.add(producto_id)


def crear(datos: TomaFisicaCrear, usuario_id: UUID) -> DocTomaFisica:
    actor = _actor(usuario_id)
    almacen = db.session.get(DimAlmacen, datos.almacen_id)
    if almacen is None or not almacen.is_active:
        raise NoEncontrado("Almacén no encontrado")
    siguiente = db.session.execute(
        db.select(SECUENCIA_NUMERO.next_value())
    ).scalar_one()
    toma = DocTomaFisica()
    toma.numero = f"TF-{siguiente:06d}"
    toma.almacen_id = almacen.id
    toma.observacion = datos.observacion or None
    toma.creado_por_id = actor.id
    toma.estado = EstadoTomaFisica.ABIERTO
    db.session.add(toma)
    _agregar(toma, datos.producto_ids)
    db.session.commit()
    return toma


def agregar_productos(
    toma_id: UUID, producto_ids: list[UUID], usuario_id: UUID
) -> DocTomaFisica:
    _actor(usuario_id)
    toma = _documento(toma_id, bloquear=True)
    _exigir_abierta(toma)
    _agregar(toma, producto_ids)
    db.session.commit()
    return toma


def quitar_linea(toma_id: UUID, linea_id: UUID, usuario_id: UUID) -> DocTomaFisica:
    _actor(usuario_id)
    toma = _documento(toma_id, bloquear=True)
    _exigir_abierta(toma)
    linea = next((x for x in toma.lineas if x.id == linea_id), None)
    if linea is None:
        raise NoEncontrado("El producto no está en esta toma física")
    toma.lineas.remove(linea)
    db.session.commit()
    return toma


def guardar_conteo(
    toma_id: UUID, datos: GuardarConteo, usuario_id: UUID
) -> DocTomaFisica:
    actor = _actor(usuario_id)
    toma = _documento(toma_id, bloquear=True)
    _exigir_abierta(toma)
    por_id = {linea.id: linea for linea in toma.lineas}
    ahora = datetime.now(UTC)
    for conteo in datos.conteos:
        linea = por_id.get(conteo.linea_id)
        if linea is None:
            raise NoEncontrado("El producto no está en esta toma física")
        linea.cantidad_contada = conteo.cantidad_contada
        linea.contado_por_id = actor.id if conteo.cantidad_contada is not None else None
        linea.contado_en = ahora if conteo.cantidad_contada is not None else None
    db.session.commit()
    return toma


@dataclass(frozen=True)
class Revision:
    stock_actual: int
    costo_unitario: Decimal
    movimientos_despues: int


def _revision(toma: DocTomaFisica, linea: DocTomaFisicaLinea) -> Revision:
    stock = _stock(linea.producto_id, toma.almacen_id)
    despues = db.session.execute(
        db.select(func.count())
        .select_from(FactMovimiento)
        .where(
            FactMovimiento.producto_id == linea.producto_id,
            FactMovimiento.almacen_id == toma.almacen_id,
            FactMovimiento.fecha_movimiento > linea.agregado_en,
            FactMovimiento.numero_documento != toma.numero,
        )
    ).scalar_one()
    return Revision(
        stock_actual=stock.stock_actual if stock else 0,
        costo_unitario=costo_unitario_actual(linea.producto, stock),
        movimientos_despues=despues,
    )


def contabilizar(toma_id: UUID, usuario_id: UUID) -> DocTomaFisica:
    actor = usuarios_service.exigir_admin(usuario_id, "contabilizar una toma física")
    toma = _documento(toma_id, bloquear=True)
    _exigir_abierta(toma)
    if not toma.lineas:
        raise ErrorDeNegocio("La toma física no tiene productos")
    sin_contar = [x.producto.sku for x in toma.lineas if x.cantidad_contada is None]
    if sin_contar:
        raise ErrorDeNegocio(f"Faltan contar: {', '.join(sin_contar)}")

    imposibles = []
    for linea in toma.lineas:
        diferencia = (linea.cantidad_contada or 0) - linea.stock_sistema
        stock = _stock(linea.producto_id, toma.almacen_id)
        if diferencia < 0 and (stock.stock_actual if stock else 0) + diferencia < 0:
            imposibles.append(linea.producto.sku)
    if imposibles:
        raise ErrorDeNegocio(
            "El ajuste dejaría stock negativo en: "
            f"{', '.join(imposibles)}. Hubo salidas después de contar: haz otra toma física"
        )

    try:
        for linea in toma.lineas:
            diferencia = (linea.cantidad_contada or 0) - linea.stock_sistema
            linea.diferencia = diferencia
            linea.abierta = False
            if diferencia == 0:
                continue
            positivo = diferencia > 0
            datos = MovimientoCreate(
                almacen_id=toma.almacen_id,
                moneda="PEN",
                tipo_cambio=Decimal("1"),
                tipo_movimiento=(
                    TipoMovimiento.AJUSTE_POSITIVO
                    if positivo
                    else TipoMovimiento.AJUSTE_NEGATIVO
                ),
                tipo_documento=TipoDocumento.AJUSTE_INVENTARIO,
                numero_documento=toma.numero,
                cantidad=diferencia,
                costo_unitario=(
                    costo_unitario_actual(
                        linea.producto, _stock(linea.producto_id, toma.almacen_id)
                    )
                    if positivo
                    else None
                ),
            )
            movimiento = movimientos_service.registrar_sin_confirmar(
                linea.producto_id, datos, actor.id
            )
            linea.movimiento_id = movimiento.id
        toma.estado = EstadoTomaFisica.CONTABILIZADO
        toma.cerrado_por_id = actor.id
        toma.cerrado_en = datetime.now(UTC)
        db.session.commit()
    except Exception:
        db.session.rollback()
        raise
    return toma


def anular(toma_id: UUID, motivo: str, usuario_id: UUID) -> DocTomaFisica:
    actor = usuarios_service.exigir_admin(usuario_id, "anular una toma física")
    toma = _documento(toma_id, bloquear=True)
    _exigir_abierta(toma)
    for linea in toma.lineas:
        linea.abierta = False
    toma.estado = EstadoTomaFisica.ANULADO
    toma.motivo_anulacion = motivo
    toma.cerrado_por_id = actor.id
    toma.cerrado_en = datetime.now(UTC)
    db.session.commit()
    return toma


def listar(filtro: FiltroTomas) -> tuple[list[DocTomaFisica], int]:
    consulta = db.select(DocTomaFisica)
    if filtro.estado is not None:
        consulta = consulta.where(DocTomaFisica.estado == filtro.estado)
    total = db.session.execute(
        db.select(func.count()).select_from(consulta.subquery())
    ).scalar_one()
    pagina = db.session.execute(
        consulta.order_by(DocTomaFisica.creado_en.desc())
        .limit(filtro.per_page)
        .offset((filtro.page - 1) * filtro.per_page)
    ).scalars()
    return list(pagina), total


def _nombre(usuario: DimUsuario | None) -> str | None:
    return f"{usuario.nombres} {usuario.apellidos}".strip() if usuario else None


def salida(toma: DocTomaFisica, usuario_id: UUID, *, con_lineas: bool) -> TomaSalida:

    actor = usuarios_service.obtener_activo(usuario_id)
    ve_sistema = bool(actor and actor.is_admin)
    lineas: list[LineaSalida] = []
    total_diferencia = Decimal("0")

    if con_lineas:
        for linea in toma.lineas:
            fila = LineaSalida(
                id=linea.id,
                producto_id=linea.producto_id,
                sku=linea.producto.sku,
                producto=linea.producto.nombre,
                cantidad_contada=linea.cantidad_contada,
                contado_en=linea.contado_en,
            )
            if ve_sistema:
                revision = _revision(toma, linea)
                diferencia = (
                    linea.diferencia
                    if linea.diferencia is not None
                    else (
                        linea.cantidad_contada - linea.stock_sistema
                        if linea.cantidad_contada is not None
                        else None
                    )
                )
                valor = (
                    movimientos_service.redondear(revision.costo_unitario * diferencia)
                    if diferencia is not None
                    else None
                )
                total_diferencia += valor or 0
                fila = fila.model_copy(
                    update={
                        "stock_sistema": linea.stock_sistema,
                        "diferencia": diferencia,
                        "stock_actual": revision.stock_actual,
                        "costo_unitario": revision.costo_unitario,
                        "valor_diferencia": valor,
                        "movimientos_despues": revision.movimientos_despues,
                    }
                )
            lineas.append(fila)
    return TomaSalida(
        id=toma.id,
        numero=toma.numero,
        almacen_id=toma.almacen_id,
        almacen=toma.almacen.nombre,
        estado=toma.estado,
        observacion=toma.observacion,
        creado_por=_nombre(toma.creado_por) or "",
        creado_en=toma.creado_en,
        cerrado_por=_nombre(toma.cerrado_por),
        cerrado_en=toma.cerrado_en,
        motivo_anulacion=toma.motivo_anulacion,
        productos=len(toma.lineas),
        contados=sum(1 for x in toma.lineas if x.cantidad_contada is not None),
        valor_diferencia=total_diferencia if ve_sistema and con_lineas else None,
        lineas=lineas if con_lineas else None,
    )
