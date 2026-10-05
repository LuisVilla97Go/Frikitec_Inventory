from uuid import UUID
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.almacen import DimAlmacen
from app.models.stock_almacen import FactStockAlmacen
from app.schemas.almacen_schema import AlmacenActualizar, AlmacenCrear
from app.services import usuarios_service
from app.services.errores import ErrorDeNegocio, NoEncontrado

MAXIMO_ALMACENES = 200
PARA = "gestionar almacenes"


def listar(todos: bool) -> list[DimAlmacen]:
    consulta = db.select(DimAlmacen).order_by(DimAlmacen.nombre).limit(MAXIMO_ALMACENES)
    if not todos:
        consulta = consulta.where(DimAlmacen.is_active.is_(True))
    return list(db.session.execute(consulta).scalars())


def stock_por_almacen(almacen_ids: list[UUID]) -> dict[UUID, int]:

    if not almacen_ids:
        return {}
    filas = db.session.execute(
        db.select(
            FactStockAlmacen.almacen_id,
            func.coalesce(func.sum(FactStockAlmacen.stock_actual), 0),
        )
        .where(FactStockAlmacen.almacen_id.in_(almacen_ids))
        .group_by(FactStockAlmacen.almacen_id)
    ).all()
    return {almacen_id: int(total) for almacen_id, total in filas}


def crear(datos: AlmacenCrear, usuario_id: UUID) -> DimAlmacen:
    usuarios_service.exigir_admin(usuario_id, PARA)
    almacen = DimAlmacen()
    almacen.nombre = datos.nombre
    almacen.ubicacion = datos.ubicacion
    almacen.codigo_establecimiento = datos.codigo_establecimiento
    db.session.add(almacen)
    _guardar(datos.nombre)
    return almacen


def actualizar(
    almacen_id: UUID, datos: AlmacenActualizar, usuario_id: UUID
) -> DimAlmacen:
    usuarios_service.exigir_admin(usuario_id, PARA)
    almacen = _obtener(almacen_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(almacen, campo, valor)
    _guardar(almacen.nombre)
    return almacen


def cambiar_estado(almacen_id: UUID, activo: bool, usuario_id: UUID) -> DimAlmacen:
    usuarios_service.exigir_admin(usuario_id, PARA)
    almacen = _obtener(almacen_id)
    if not activo:
        unidades = stock_por_almacen([almacen.id]).get(almacen.id, 0)
        if unidades != 0:
            raise ErrorDeNegocio(
                f"{almacen.nombre} tiene {unidades} unidades: trasládalas o ajústalas "
                "en el Kardex antes de desactivarlo"
            )
    almacen.is_active = activo
    db.session.commit()
    return almacen


def _obtener(almacen_id: UUID) -> DimAlmacen:
    almacen = db.session.get(DimAlmacen, almacen_id)
    if almacen is None:
        raise NoEncontrado("Almacén no encontrado")
    return almacen


def _guardar(nombre: str) -> None:
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        raise ErrorDeNegocio(f"Ya existe un almacén llamado {nombre}") from e
