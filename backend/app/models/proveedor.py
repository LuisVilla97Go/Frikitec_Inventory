import uuid

from sqlalchemy import CheckConstraint, UniqueConstraint

from app.extensions import db


class DimProveedor(db.Model):
    """Proveedor identificado por documento (docs/2026-09-24_maestros, M3)."""

    __tablename__ = "dim_proveedor"
    __table_args__ = (
        UniqueConstraint("tipo_documento", "numero_documento", name="uq_proveedor_documento"),
        CheckConstraint(
            "(tipo_documento = 'RUC' AND length(numero_documento) = 11) OR "
            "(tipo_documento = 'DNI' AND length(numero_documento) = 8)",
            name="check_proveedor_documento_longitud",
        ),
    )

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tipo_documento = db.Column(db.String(3), nullable=False)
    numero_documento = db.Column(db.String(11), nullable=False)
    razon_social = db.Column(db.String(200), nullable=False)
    nombre_comercial = db.Column(db.String(200), nullable=True)
    contacto = db.Column(db.String(150), nullable=True)
    telefono = db.Column(db.String(30), nullable=True)
    correo = db.Column(db.String(254), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    movimientos = db.relationship("FactMovimiento", back_populates="proveedor", lazy="dynamic")

    def __repr__(self):
        return f"<DimProveedor {self.tipo_documento}:{self.numero_documento}>"
