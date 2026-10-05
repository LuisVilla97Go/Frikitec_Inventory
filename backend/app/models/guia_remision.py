import enum
import uuid
from datetime import UTC, datetime

from app.extensions import db


class MotivoTraslado(str, enum.Enum):
    # Catálogo 20 de SUNAT. Hasta el 28/09 estaban al revés (G5); PostgreSQL guarda el
    # nombre (VENTA, COMPRA), no el código, así que invertirlos no pide migración
    VENTA = "01"
    COMPRA = "02"
    TRASLADO_ENTRE_ESTABLECIMIENTOS = "04"
    DEVOLUCION = "08"
    OTROS = "13"


class EstadoGuia(str, enum.Enum):
    BORRADOR = "BORRADOR"
    EN_TRANSITO = "EN_TRANSITO"
    RECIBIDO = "RECIBIDO"
    ANULADO = "ANULADO"


class GuiaRemision(db.Model):
    __tablename__ = "guia_remision"

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_guia = db.Column(db.String(20), nullable=False, unique=True, index=True)
    fecha_emision = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    fecha_traslado = db.Column(db.DateTime(timezone=True), nullable=False)

    motivo_traslado = db.Column(
        db.Enum(MotivoTraslado, name="motivo_traslado_enum"), nullable=False
    )
    estado = db.Column(
        db.Enum(EstadoGuia, name="estado_guia_enum"), nullable=False, default=EstadoGuia.EN_TRANSITO
    )

    # En una guía de compra (G4) la mercadería sale del proveedor: aquí se repite el almacén
    # de llegada, porque soltar el NOT NULL rompe a quien lo lee (Squawk, ban-drop-not-null).
    # La API lo devuelve como null; esa guía no mueve stock
    almacen_origen_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_almacen.id"), nullable=False, index=True
    )
    almacen_destino_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_almacen.id"), nullable=False, index=True
    )
    usuario_creador_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"), nullable=False
    )
    # Remitente de una guía de compra (motivo 02). Solo documenta: el stock entra por la
    # recepción de la orden o el Kardex (decisión del usuario, 28/09)
    proveedor_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_proveedor.id"), nullable=True
    )

    # Anular, nunca borrar: SUNAT no deja reutilizar el correlativo (G2)
    motivo_anulacion = db.Column(db.Text, nullable=True)
    anulada_en = db.Column(db.DateTime(timezone=True), nullable=True)
    usuario_anulacion_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"), nullable=True
    )

    # Datos de Transporte (Privado por defecto para Frikitec)
    peso_bruto_total = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    conductor_nombre = db.Column(db.String(100), nullable=True)
    conductor_dni = db.Column(db.String(20), nullable=True)
    vehiculo_placa = db.Column(db.String(20), nullable=True)

    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    updated_at = db.Column(
        db.DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
        nullable=False,
    )

    # Relaciones
    almacen_origen = db.relationship("DimAlmacen", foreign_keys=[almacen_origen_id])
    almacen_destino = db.relationship("DimAlmacen", foreign_keys=[almacen_destino_id])
    creador = db.relationship("DimUsuario", foreign_keys=[usuario_creador_id])
    proveedor = db.relationship("DimProveedor")
    detalles = db.relationship(
        "GuiaRemisionDetalle", back_populates="guia", cascade="all, delete-orphan"
    )


class GuiaRemisionDetalle(db.Model):
    __tablename__ = "guia_remision_detalle"

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    guia_remision_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("guia_remision.id"), nullable=False, index=True
    )
    producto_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_producto.id"), nullable=False, index=True
    )

    cantidad = db.Column(db.Integer, nullable=False)
    costo_unitario_origen = db.Column(db.Numeric(15, 4), nullable=False)

    __table_args__ = (
        db.CheckConstraint("cantidad > 0", name="check_guia_cantidad_positiva"),
        db.CheckConstraint("costo_unitario_origen >= 0", name="check_guia_costo_no_negativo"),
    )

    # Relaciones
    guia = db.relationship("GuiaRemision", back_populates="detalles")
    producto = db.relationship("DimProducto")
