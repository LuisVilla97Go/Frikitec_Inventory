from datetime import UTC, datetime
from uuid import UUID
import bcrypt
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from app.extensions import db
from app.models.usuario import ROLES_ADMIN, DimUsuario, RolUsuario
from app.schemas.usuario_schema import UsuarioActualizar, UsuarioCrear
from app.services.errores import ErrorDeNegocio, NoEncontrado, SinPermiso

_HASH_FICTICIO = bcrypt.hashpw(b"no-existe", bcrypt.gensalt())


def autenticar(email: str, password: str) -> DimUsuario | None:
    usuario = db.session.execute(
        db.select(DimUsuario).where(
            DimUsuario.email == email,
            DimUsuario.is_active.is_(True),
            DimUsuario.deleted_at.is_(None),
        )
    ).scalar_one_or_none()
    hash_guardado = usuario.password_hash.encode() if usuario else _HASH_FICTICIO
    try:
        coincide = bcrypt.checkpw(password.encode(), hash_guardado)
    except ValueError:
        coincide = False
    return usuario if (usuario is not None and coincide) else None


def obtener_activo(usuario_id: UUID) -> DimUsuario | None:
    usuario = db.session.get(DimUsuario, usuario_id)
    return (
        usuario
        if usuario is not None and usuario.is_active and usuario.deleted_at is None
        else None
    )


def esta_eliminado(usuario_id: UUID) -> bool:
    return (
        db.session.execute(
            db.select(DimUsuario.deleted_at).where(DimUsuario.id == usuario_id)
        ).scalar_one_or_none()
        is not None
    )


def listar(page: int, per_page: int) -> tuple[list[DimUsuario], int]:
    consulta = db.select(DimUsuario).where(DimUsuario.deleted_at.is_(None))
    total = db.session.execute(
        db.select(func.count()).select_from(consulta.subquery())
    ).scalar_one()
    pagina = db.session.execute(
        consulta.order_by(
            DimUsuario.is_active.desc(),
            DimUsuario.apellidos,
            DimUsuario.nombres,
            DimUsuario.id,
        )
        .limit(per_page)
        .offset((page - 1) * per_page)
    ).scalars()
    return list(pagina), total


def crear(datos: UsuarioCrear, actor: DimUsuario) -> DimUsuario:
    _exigir_admin(actor)
    _exigir_puede_asignar(actor, datos.rol)
    usuario = DimUsuario()
    usuario.nombres = datos.nombres
    usuario.apellidos = datos.apellidos
    usuario.email = datos.email
    usuario.password_hash = _hash(datos.password)
    usuario.rol = datos.rol.value
    usuario.cargo = datos.cargo
    usuario.is_active = True
    db.session.add(usuario)
    _confirmar_email_unico()
    return usuario


def actualizar(
    usuario_id: UUID, datos: UsuarioActualizar, actor: DimUsuario
) -> DimUsuario:
    _exigir_admin(actor)
    usuario = _obtener(usuario_id)
    _exigir_puede_gestionar(actor, usuario)
    if usuario.id == actor.id and datos.is_active is False:
        raise ErrorDeNegocio("No puedes desactivar tu propia cuenta")
    if datos.rol is not None:
        _exigir_puede_asignar(actor, datos.rol)
        if usuario.id == actor.id and datos.rol.value not in ROLES_ADMIN:
            raise ErrorDeNegocio("No puedes quitarte tu propio rol de administrador")
        usuario.rol = datos.rol.value
    if datos.nombres is not None:
        usuario.nombres = datos.nombres
    if datos.apellidos is not None:
        usuario.apellidos = datos.apellidos
    if datos.email is not None:
        usuario.email = datos.email
    if datos.password is not None:
        usuario.password_hash = _hash(datos.password)
    if "cargo" in datos.model_fields_set:
        usuario.cargo = datos.cargo
    if datos.is_active is not None:
        usuario.is_active = datos.is_active
    _confirmar_email_unico()
    return usuario


def cambiar_estado(usuario_id: UUID, activo: bool, actor: DimUsuario) -> DimUsuario:
    _exigir_admin(actor)
    usuario = _obtener(usuario_id)
    _exigir_puede_gestionar(actor, usuario)
    if usuario.id == actor.id and not activo:
        raise ErrorDeNegocio("No puedes desactivar tu propia cuenta")
    usuario.is_active = activo
    db.session.commit()
    return usuario


def eliminar(usuario_id: UUID, actor: DimUsuario) -> None:
    _exigir_admin(actor)
    usuario = _obtener(usuario_id)
    _exigir_puede_gestionar(actor, usuario)
    if usuario.id == actor.id:
        raise ErrorDeNegocio("No puedes eliminar tu propia cuenta")
    usuario.deleted_at = datetime.now(UTC)
    usuario.is_active = False
    db.session.commit()


def _obtener(usuario_id: UUID) -> DimUsuario:
    usuario = db.session.get(DimUsuario, usuario_id)
    if usuario is None or usuario.deleted_at is not None:
        raise NoEncontrado("Usuario no encontrado")
    return usuario


def exigir_admin(usuario_id: UUID, para: str) -> DimUsuario:
    actor = obtener_activo(usuario_id)
    if actor is None or not actor.is_admin:
        raise SinPermiso(f"Solo un administrador puede {para}")
    return actor


def _exigir_admin(actor: DimUsuario) -> None:
    if not actor.is_admin:
        raise SinPermiso("Solo un administrador puede gestionar usuarios")


def _exigir_puede_asignar(actor: DimUsuario, rol: RolUsuario) -> None:
    if rol is RolUsuario.SUPERADMIN and actor.rol != RolUsuario.SUPERADMIN.value:
        raise SinPermiso("Solo un super administrador puede asignar ese rol")


def _exigir_puede_gestionar(actor: DimUsuario, usuario: DimUsuario) -> None:
    if (
        usuario.rol == RolUsuario.SUPERADMIN.value
        and actor.rol != RolUsuario.SUPERADMIN.value
    ):
        raise SinPermiso(
            "Solo un super administrador puede modificar a otro super administrador"
        )


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _confirmar_email_unico() -> None:
    try:
        db.session.commit()
    except IntegrityError as e:
        db.session.rollback()
        raise ErrorDeNegocio("Ya existe un usuario con ese usuario o email") from e
