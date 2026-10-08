import enum
import uuid
from datetime import UTC, datetime

from app.extensions import db


class TipoMovimiento(str, enum.Enum):
    ENTRADA_COMPRA = "ENTRADA_COMPRA"
    SALIDA_VENTA = "SALIDA_VENTA"
    AJUSTE_POSITIVO = "AJUSTE_POSITIVO"
    AJUSTE_NEGATIVO = "AJUSTE_NEGATIVO"
    TRANSFERENCIA = "TRANSFERENCIA"
    # Corrige el valor del stock de un almacén sin mover unidades (MR21 en SAP):
    # cantidad 0 e importe = valor nuevo − valor actual
    REVALORIZACION = "REVALORIZACION"


class TipoDocumento(str, enum.Enum):
    CARGA_INICIAL = "CARGA_INICIAL"
    FACTURA = "FACTURA"
    GUIA_REMISION = "GUIA_REMISION"
    BOLETA = "BOLETA"
    NOTA_CREDITO = "NOTA_CREDITO"
    AJUSTE_INVENTARIO = "AJUSTE_INVENTARIO"
    # Documento interno de venta, no es comprobante de pago: Tabla 10 de SUNAT, código 00
    # (docs/2026-09-28_mejoras-compras-guias_ABIERTO.md, punto 2)
    NOTA_VENTA = "NOTA_VENTA"


class FactMovimiento(db.Model):
    __tablename__ = "fact_movimiento"

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    producto_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_producto.id"), nullable=False, index=True
    )
    almacen_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_almacen.id"), nullable=False, index=True
    )
    usuario_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"), nullable=False, index=True
    )
    # Nulo para historia anterior y movimientos que no son compras.
    proveedor_id = db.Column(
        db.Uuid(as_uuid=True),
        db.ForeignKey("dim_proveedor.id", ondelete="RESTRICT"),
        nullable=True,
    )
    # Único cuando existe: una línea aceptada de recepción no puede originar
    # dos movimientos; historia y compras manuales conservan NULL.
    recepcion_compra_linea_id = db.Column(
        db.Uuid(as_uuid=True),
        db.ForeignKey(
            "fact_recepcion_compra_linea.id",
            name="fk_movimiento_recepcion_compra_linea",
            ondelete="RESTRICT",
        ),
        nullable=True,
    )

    tipo_movimiento = db.Column(
        db.Enum(TipoMovimiento, name="tipo_movimiento_enum"), nullable=False
    )
    tipo_documento = db.Column(db.Enum(TipoDocumento, name="tipo_documento_enum"), nullable=False)
    numero_documento = db.Column(db.String(100), nullable=False)

    cantidad = db.Column(db.Integer, nullable=False)
    costo_unitario = db.Column(db.Numeric(15, 4), nullable=False)
    moneda = db.Column(db.String(3), nullable=False, default="PEN")
    tipo_cambio = db.Column(db.Numeric(10, 4), nullable=False, default=1.0000)

    # D1 (24/09): la verdad es el importe en soles a 2 decimales, con el signo de
    # la cantidad, y el valor del saldo de su almacén después del movimiento. El
    # costo unitario se deriva (skills/erp-inventarios/references/valorizacion.md).
    importe = db.Column(db.Numeric(15, 2), nullable=False, server_default="0")
    saldo_cantidad = db.Column(db.Integer, nullable=False)
    saldo_valorizado = db.Column(db.Numeric(15, 2), nullable=False, server_default="0")
    numero_serie = db.Column(db.String(100), nullable=True)  # Para garantías
    fecha_movimiento = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False, index=True
    )

    __table_args__ = (
        db.Index(
            "uq_movimiento_recepcion_compra_linea",
            "recepcion_compra_linea_id",
            unique=True,
        ),
        # Solo la revalorización mueve valor sin unidades
        db.CheckConstraint(
            "cantidad != 0 OR tipo_movimiento = 'REVALORIZACION'", name="check_cantidad_no_cero"
        ),
        db.CheckConstraint("costo_unitario >= 0", name="check_costo_no_negativo"),
        db.CheckConstraint(
            "((tipo_movimiento IN ('ENTRADA_COMPRA', 'AJUSTE_POSITIVO')) AND cantidad > 0) OR "
            "((tipo_movimiento IN ('SALIDA_VENTA', 'AJUSTE_NEGATIVO')) AND cantidad < 0) OR "
            "(tipo_movimiento = 'REVALORIZACION' AND cantidad = 0) OR "
            "(tipo_movimiento = 'TRANSFERENCIA')",
            name="check_signo_cantidad_tipo",
        ),
    )

    # Relaciones
    producto = db.relationship("DimProducto", back_populates="movimientos")
    almacen = db.relationship("DimAlmacen", back_populates="movimientos")
    usuario = db.relationship("DimUsuario", back_populates="movimientos")
    proveedor = db.relationship("DimProveedor", back_populates="movimientos")
    recepcion_compra_linea = db.relationship("RecepcionCompraLinea")

    def __repr__(self):
        return (
            f"<FactMovimiento {self.tipo_movimiento.value} "
            f"Prod:{self.producto_id} Cant:{self.cantidad}>"
        )
