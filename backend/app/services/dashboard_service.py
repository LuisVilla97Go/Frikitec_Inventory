from dataclasses import dataclass, replace
from datetime import date
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID
from sqlalchemy import and_, case, exists, func
from app.extensions import db
from app.models.almacen import DimAlmacen
from app.models.movimiento import FactMovimiento
from app.models.producto import DimProducto
from app.models.stock_almacen import FactStockAlmacen
from app.services.fechas import inicio_del_dia_utc

UMBRAL_STOCK_BAJO = 5
MESES = 6
MARCAS_VISIBLES = 10
UMBRAL_CONCENTRACION = Decimal(80)
TOP_PRODUCTOS = 8
CERO = Decimal("0.00")
DECIMA = Decimal("0.1")


@dataclass(frozen=True)
class Indicadores:
    valor_inventario: Decimal
    unidades: int
    productos_activos: int
    productos_con_stock: int
    categorias: int
    marcas: int
    filas_por_reponer: int
    productos_por_reponer: int
    productos_sin_historia: int


@dataclass(frozen=True)
class Grupo:
    nombre: str
    productos: int
    unidades: int
    valor: Decimal
    participacion: Decimal = Decimal("0.0")
    destacado: bool = False
    otras: bool = False


@dataclass(frozen=True)
class Concentracion:
    grupos: int
    de: int
    participacion: Decimal
    umbral: Decimal


@dataclass(frozen=True)
class SaludAlmacen:
    id: UUID
    nombre: str
    unidades: int
    valor: Decimal
    agotados: int
    por_reponer: int
    sanos: int
    participacion: Decimal = Decimal("0.0")


@dataclass(frozen=True)
class Mes:
    mes: str
    entradas: int
    salidas: int
    movimientos: int


@dataclass(frozen=True)
class ProductoValioso:
    id: UUID
    sku: str
    nombre: str
    categoria: str
    unidades: int
    valor: Decimal


@dataclass(frozen=True)
class Resumen:
    indicadores: Indicadores
    por_categoria: list[Grupo]
    por_marca: list[Grupo]
    concentracion_categorias: Concentracion | None
    concentracion_marcas: Concentracion | None
    por_almacen: list[SaludAlmacen]
    movimientos_por_mes: list[Mes]
    top_productos: list[ProductoValioso]


def _soles(valor) -> Decimal:
    return Decimal(str(valor)).quantize(CERO)


def _tuvo_movimientos_en_su_almacen():
    return exists().where(
        FactMovimiento.producto_id == FactStockAlmacen.producto_id,
        FactMovimiento.almacen_id == FactStockAlmacen.almacen_id,
    )


def resumen(hoy: date) -> Resumen:
    indicadores = _indicadores()
    total = indicadores.valor_inventario
    categorias = _agrupado(DimProducto.categoria)
    marcas = _agrupado(DimProducto.marca)
    concentracion_categorias = _concentracion(categorias, total)
    concentracion_marcas = _concentracion(marcas, total)
    return Resumen(
        indicadores=indicadores,
        por_categoria=_destacar(
            _con_participacion(categorias, total), concentracion_categorias
        ),
        por_marca=_destacar(
            _con_participacion(_plegar(marcas, MARCAS_VISIBLES), total),
            concentracion_marcas,
        ),
        concentracion_categorias=concentracion_categorias,
        concentracion_marcas=concentracion_marcas,
        por_almacen=_con_participacion(_por_almacen(), total),
        movimientos_por_mes=_movimientos_por_mes(hoy),
        top_productos=_top_productos(),
    )


def _porcentaje(parte: Decimal, total: Decimal) -> Decimal:
    return (parte * 100 / total).quantize(DECIMA, rounding=ROUND_HALF_UP)


def _concentracion(grupos: list[Grupo], total: Decimal) -> Concentracion | None:

    if total <= 0 or sum(1 for g in grupos if g.valor > 0) < 2:
        return None
    acumulado = CERO
    for k, grupo in enumerate(grupos, start=1):
        acumulado += grupo.valor
        if acumulado * 100 >= UMBRAL_CONCENTRACION * total:
            return Concentracion(
                k, len(grupos), _porcentaje(acumulado, total), UMBRAL_CONCENTRACION
            )
    return None


def _destacar(grupos: list[Grupo], concentracion: Concentracion | None) -> list[Grupo]:

    if concentracion is None:
        return grupos
    return [
        replace(g, destacado=i < concentracion.grupos and not g.otras)
        for i, g in enumerate(grupos)
    ]


def _con_participacion[T: (Grupo, SaludAlmacen)](
    filas: list[T], total: Decimal
) -> list[T]:

    if total <= 0:
        return filas
    return [replace(f, participacion=_porcentaje(f.valor, total)) for f in filas]


def _indicadores() -> Indicadores:
    unidades, valor = db.session.execute(
        db.select(
            func.coalesce(func.sum(FactStockAlmacen.stock_actual), 0),
            func.coalesce(func.sum(FactStockAlmacen.valor_total), 0),
        )
    ).one()
    activos, categorias, marcas = db.session.execute(
        db.select(
            func.count(DimProducto.id),
            func.count(func.distinct(DimProducto.categoria)),
            func.count(func.distinct(DimProducto.marca)),
        ).where(DimProducto.is_active.is_(True))
    ).one()
    con_stock = db.session.execute(
        db.select(func.count(func.distinct(FactStockAlmacen.producto_id)))
        .join(DimProducto, DimProducto.id == FactStockAlmacen.producto_id)
        .where(DimProducto.is_active.is_(True), FactStockAlmacen.stock_actual > 0)
    ).scalar_one()
    filas, productos = db.session.execute(
        db.select(func.count(), func.count(func.distinct(FactStockAlmacen.producto_id)))
        .select_from(FactStockAlmacen)
        .join(DimProducto, DimProducto.id == FactStockAlmacen.producto_id)
        .join(DimAlmacen, DimAlmacen.id == FactStockAlmacen.almacen_id)
        .where(
            DimProducto.is_active.is_(True),
            DimAlmacen.is_active.is_(True),
            FactStockAlmacen.stock_actual <= UMBRAL_STOCK_BAJO,
            _tuvo_movimientos_en_su_almacen(),
        )
    ).one()
    sin_historia = db.session.execute(
        db.select(func.count(DimProducto.id)).where(
            DimProducto.is_active.is_(True),
            ~exists().where(FactMovimiento.producto_id == DimProducto.id),
        )
    ).scalar_one()
    return Indicadores(
        valor_inventario=_soles(valor),
        unidades=int(unidades),
        productos_activos=int(activos),
        productos_con_stock=int(con_stock),
        categorias=int(categorias),
        marcas=int(marcas),
        filas_por_reponer=int(filas),
        productos_por_reponer=int(productos),
        productos_sin_historia=int(sin_historia),
    )


def _agrupado(columna) -> list[Grupo]:

    productos = func.count(
        func.distinct(case((DimProducto.is_active.is_(True), DimProducto.id)))
    )
    unidades = func.coalesce(func.sum(FactStockAlmacen.stock_actual), 0)
    valor = func.coalesce(func.sum(FactStockAlmacen.valor_total), 0)
    filas = db.session.execute(
        db.select(columna, productos, unidades, valor)
        .outerjoin(FactStockAlmacen, FactStockAlmacen.producto_id == DimProducto.id)
        .group_by(columna)
        .having(productos + unidades > 0)
        .order_by(valor.desc(), columna)
    ).all()
    return [Grupo(nombre, int(p), int(u), _soles(v)) for nombre, p, u, v in filas]


def _plegar(grupos: list[Grupo], visibles: int) -> list[Grupo]:

    if len(grupos) <= visibles + 1:
        return grupos
    resto = grupos[visibles:]
    otras = Grupo(
        f"Otras ({len(resto)})",
        sum(g.productos for g in resto),
        sum(g.unidades for g in resto),
        sum((g.valor for g in resto), CERO),
        otras=True,
    )
    return [*grupos[:visibles], otras]


def _por_almacen() -> list[SaludAlmacen]:
    almacenes = db.session.execute(
        db.select(DimAlmacen.id, DimAlmacen.nombre)
        .where(DimAlmacen.is_active.is_(True))
        .order_by(DimAlmacen.nombre)
    ).all()
    totales = {
        almacen_id: (int(u), _soles(v))
        for almacen_id, u, v in db.session.execute(
            db.select(
                FactStockAlmacen.almacen_id,
                func.sum(FactStockAlmacen.stock_actual),
                func.sum(FactStockAlmacen.valor_total),
            ).group_by(FactStockAlmacen.almacen_id)
        ).all()
    }
    stock = FactStockAlmacen.stock_actual
    salud = {
        almacen_id: (int(a), int(r), int(s))
        for almacen_id, a, r, s in db.session.execute(
            db.select(
                FactStockAlmacen.almacen_id,
                func.sum(case((stock == 0, 1), else_=0)),
                func.sum(
                    case((and_(stock > 0, stock <= UMBRAL_STOCK_BAJO), 1), else_=0)
                ),
                func.sum(case((stock > UMBRAL_STOCK_BAJO, 1), else_=0)),
            )
            .join(DimProducto, DimProducto.id == FactStockAlmacen.producto_id)
            .where(DimProducto.is_active.is_(True), _tuvo_movimientos_en_su_almacen())
            .group_by(FactStockAlmacen.almacen_id)
        ).all()
    }
    resultado = []
    for almacen_id, nombre in almacenes:
        unidades, valor = totales.get(almacen_id, (0, CERO))
        agotados, por_reponer, sanos = salud.get(almacen_id, (0, 0, 0))
        resultado.append(
            SaludAlmacen(
                almacen_id, nombre, unidades, valor, agotados, por_reponer, sanos
            )
        )
    return resultado


def _inicio_de_mes(anio: int, mes: int) -> date:
    # mes puede salirse de 1..12 al restar o sumar meses
    anio, mes = anio + (mes - 1) // 12, (mes - 1) % 12 + 1
    return date(anio, mes, 1)


def _movimientos_por_mes(hoy: date) -> list[Mes]:

    inicios = [
        _inicio_de_mes(hoy.year, hoy.month - i) for i in range(MESES - 1, -1, -1)
    ]
    limites = [
        (
            inicio_del_dia_utc(ini),
            inicio_del_dia_utc(_inicio_de_mes(ini.year, ini.month + 1)),
        )
        for ini in inicios
    ]
    fecha, cantidad = FactMovimiento.fecha_movimiento, FactMovimiento.cantidad
    columnas = []
    for desde, hasta in limites:
        en_mes = and_(fecha >= desde, fecha < hasta)
        columnas += [
            func.coalesce(
                func.sum(case((and_(en_mes, cantidad > 0), cantidad), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((and_(en_mes, cantidad < 0), -cantidad), else_=0)), 0
            ),
            func.coalesce(func.sum(case((en_mes, 1), else_=0)), 0),
        ]
    fila = db.session.execute(
        db.select(*columnas).where(fecha >= limites[0][0], fecha < limites[-1][1])
    ).one()
    return [
        Mes(
            ini.strftime("%Y-%m"),
            int(fila[3 * i]),
            int(fila[3 * i + 1]),
            int(fila[3 * i + 2]),
        )
        for i, ini in enumerate(inicios)
    ]


def _top_productos() -> list[ProductoValioso]:
    valor = func.sum(FactStockAlmacen.valor_total)
    filas = db.session.execute(
        db.select(
            DimProducto.id,
            DimProducto.sku,
            DimProducto.nombre,
            DimProducto.categoria,
            func.sum(FactStockAlmacen.stock_actual),
            valor,
        )
        .join(FactStockAlmacen, FactStockAlmacen.producto_id == DimProducto.id)
        .group_by(
            DimProducto.id, DimProducto.sku, DimProducto.nombre, DimProducto.categoria
        )
        .having(valor > 0)
        .order_by(valor.desc(), DimProducto.sku)
        .limit(TOP_PRODUCTOS)
    ).all()
    return [
        ProductoValioso(pid, sku, nombre, cat, int(u), _soles(v))
        for pid, sku, nombre, cat, u, v in filas
    ]
