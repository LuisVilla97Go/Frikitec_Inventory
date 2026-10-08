from datetime import UTC, datetime

from app.extensions import db


class DimEmpresa(db.Model):

    __tablename__ = "dim_empresa"
    __table_args__ = (db.CheckConstraint("id = 1", name="check_empresa_una_sola_fila"),)

    id = db.Column(db.BigInteger, primary_key=True, default=1, autoincrement=False)
    ruc = db.Column(db.String(11), nullable=False)
    razon_social = db.Column(db.String(200), nullable=False)
    nombre_comercial = db.Column(db.String(200), nullable=True)
    direccion_fiscal = db.Column(db.String(300), nullable=True)
    ubigeo = db.Column(db.String(6), nullable=True)
    distrito = db.Column(db.String(100), nullable=True)
    provincia = db.Column(db.String(100), nullable=True)
    departamento = db.Column(db.String(100), nullable=True)
    telefono = db.Column(db.String(30), nullable=True)
    correo = db.Column(db.String(254), nullable=True)
    web = db.Column(db.String(200), nullable=True)
    actualizado_por_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"), nullable=True
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    def __repr__(self):
        return f"<DimEmpresa {self.ruc}>"
