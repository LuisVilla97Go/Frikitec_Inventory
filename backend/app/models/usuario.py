import enum
import uuid
from datetime import UTC, datetime

from app.extensions import db


class RolUsuario(str, enum.Enum):

    SUPERADMIN = "SUPERADMIN"
    ADMIN = "ADMIN"
    TRABAJADOR = "TRABAJADOR"


ROLES_ADMIN = (RolUsuario.SUPERADMIN.value, RolUsuario.ADMIN.value)


class DimUsuario(db.Model):
    __tablename__ = "dim_usuario"

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    nombres = db.Column(db.String(100), nullable=False)
    apellidos = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    rol = db.Column(db.String(20), default=RolUsuario.TRABAJADOR.value, nullable=False)
    cargo = db.Column(db.String(100), nullable=True)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    movimientos = db.relationship(
        "FactMovimiento", back_populates="usuario", lazy="dynamic"
    )

    @property
    def is_admin(self) -> bool:
        return self.rol in ROLES_ADMIN

    def __repr__(self):
        return f"<DimUsuario {self.email}>"
