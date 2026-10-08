"""Datos de la empresa: leer (cualquier sesión) y guardar (solo un administrador)."""

from uuid import UUID

from app.extensions import db
from app.models.empresa import DimEmpresa
from app.schemas.empresa_schema import EmpresaGuardar
from app.services import usuarios_service


def obtener() -> DimEmpresa | None:
    """La ficha, o None si nadie la llenó todavía."""
    return db.session.get(DimEmpresa, 1)


def guardar(datos: EmpresaGuardar, usuario_id: UUID) -> DimEmpresa:
    actor = usuarios_service.exigir_admin(usuario_id, "cambiar los datos de la empresa")
    empresa = obtener()
    if empresa is None:
        empresa = DimEmpresa()
        empresa.id = 1
        db.session.add(empresa)
    for campo, valor in datos.model_dump().items():
        setattr(empresa, campo, valor)
    empresa.actualizado_por_id = actor.id
    db.session.commit()
    return empresa
