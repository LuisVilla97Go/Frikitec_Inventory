import uuid
from sqlalchemy import func
from app.extensions import db


class DimAlmacen(db.Model):

    __tablename__ = "dim_almacen"
    __table_args__ = (
        db.Index("uq_dim_almacen_nombre", func.lower(db.column("nombre")), unique=True),
    )

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = db.Column(db.String(100), nullable=False)
    ubicacion = db.Column(db.String(200), nullable=True)
    codigo_establecimiento = db.Column(db.String(4), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    movimientos = db.relationship(
        "FactMovimiento", back_populates="almacen", lazy="dynamic"
    )
    stock_productos = db.relationship(
        "FactStockAlmacen", back_populates="almacen", lazy="dynamic"
    )

    def __repr__(self):
        return f"<DimAlmacen {self.nombre}>"
