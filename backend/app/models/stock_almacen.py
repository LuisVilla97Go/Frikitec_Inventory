from datetime import UTC, datetime

from app.extensions import db


class FactStockAlmacen(db.Model):
    __tablename__ = "fact_stock_almacen"

    producto_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_producto.id"), primary_key=True
    )
    almacen_id = db.Column(db.Uuid(as_uuid=True), db.ForeignKey("dim_almacen.id"), primary_key=True)

    stock_actual = db.Column(db.Integer, nullable=False, default=0)
    # D1 (24/09): el valor total del stock del almacén (SALK3 en SAP) es la verdad;
    # costo_promedio = valor_total ÷ stock_actual se guarda derivado para leerlo rápido
    valor_total = db.Column(db.Numeric(15, 2), nullable=False, default=0, server_default="0")
    costo_promedio = db.Column(db.Numeric(15, 4), nullable=False, default=0.0)
    ultima_actualizacion = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Restricción a nivel de BD para evitar stock negativo en cualquier transacción concurrente
    __table_args__ = (
        db.CheckConstraint("stock_actual >= 0", name="check_stock_no_negativo"),
        db.CheckConstraint("valor_total >= 0", name="check_valor_no_negativo"),
    )

    # Relaciones
    producto = db.relationship("DimProducto", back_populates="stock_por_almacen")
    almacen = db.relationship("DimAlmacen", back_populates="stock_productos")

    def __repr__(self):
        return (
            f"<FactStockAlmacen Prod:{self.producto_id} "
            f"Alm:{self.almacen_id} Stock:{self.stock_actual}>"
        )
