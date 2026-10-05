from uuid import UUID
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.proveedor import DimProveedor
from app.schemas.proveedor_schema import (
    FiltroProveedores,
    ProveedorActualizar,
    ProveedorCrear,
)
from app.services import usuarios_service
from app.services.busqueda import escapar_like
from app.services.errores import ErrorDeNegocio, NoEncontrado

MAXIMO_PROVEEDORES = 500
PARA = "gestionar proveedores"


def listar(filtro: FiltroProveedores) -> list[DimProveedor]:
    consulta = (
        db.select(DimProveedor)
        .order_by(DimProveedor.razon_social)
        .limit(MAXIMO_PROVEEDORES)
    )
    if not filtro.todos:
        consulta = consulta.where(DimProveedor.is_active.is_(True))
    if filtro.search:
        patron = f"%{escapar_like(filtro.search.lower())}%"
        consulta = consulta.where(
            or_(
                DimProveedor.razon_social.ilike(patron, escape="\\"),
                DimProveedor.nombre_comercial.ilike(patron, escape="\\"),
                DimProveedor.numero_documento.ilike(patron, escape="\\"),
            )
        )
    return list(db.session.execute(consulta).scalars())


def crear(datos: ProveedorCrear, usuario_id: UUID) -> DimProveedor:
    usuarios_service.exigir_admin(usuario_id, PARA)
    proveedor = DimProveedor()
    proveedor.tipo_documento = datos.tipo_documento
    proveedor.numero_documento = datos.numero_documento
    proveedor.razon_social = datos.razon_social
    proveedor.nombre_comercial = datos.nombre_comercial
    proveedor.contacto = datos.contacto
    proveedor.telefono = datos.telefono
    proveedor.correo = datos.correo
    db.session.add(proveedor)
    _guardar(proveedor)
    return proveedor


def actualizar(
    proveedor_id: UUID, datos: ProveedorActualizar, usuario_id: UUID
) -> DimProveedor:
    usuarios_service.exigir_admin(usuario_id, PARA)
    proveedor = _obtener(proveedor_id)
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(proveedor, campo, valor)
    _guardar(proveedor)
    return proveedor


def cambiar_estado(proveedor_id: UUID, activo: bool, usuario_id: UUID) -> DimProveedor:
    usuarios_service.exigir_admin(usuario_id, PARA)
    proveedor = _obtener(proveedor_id)
    proveedor.is_active = activo
    db.session.commit()
    return proveedor


def _obtener(proveedor_id: UUID) -> DimProveedor:
    proveedor = db.session.get(DimProveedor, proveedor_id)
    if proveedor is None:
        raise NoEncontrado("Proveedor no encontrado")
    return proveedor


def _guardar(proveedor: DimProveedor) -> None:
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        raise ErrorDeNegocio(
            "Ya existe un proveedor con ese tipo y número de documento"
        ) from e
