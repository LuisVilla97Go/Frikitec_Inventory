import uuid
from datetime import UTC, date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.extensions import db

if TYPE_CHECKING:
    from app.models.almacen import DimAlmacen
    from app.models.producto import DimProducto
    from app.models.proveedor import DimProveedor
    from app.models.usuario import DimUsuario


class OrdenCompra(db.Model):
    __tablename__ = "fact_orden_compra"
    __table_args__ = (
        UniqueConstraint("numero", name="uq_fact_orden_compra_numero"),
        CheckConstraint("version_actual > 0", name="check_orden_version_actual_positiva"),
        CheckConstraint(
            "estado IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'EMITIDA', "
            "'PARCIALMENTE_RECIBIDA', 'RECIBIDA', 'CERRADA_PARCIALMENTE', "
            "'RECHAZADA', 'CANCELADA')",
            name="check_orden_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    numero: Mapped[str] = mapped_column(db.String(32), nullable=False)
    creador_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_usuario.id", ondelete="RESTRICT"), nullable=False
    )
    version_actual: Mapped[int] = mapped_column(db.Integer, nullable=False, default=1)
    estado: Mapped[str] = mapped_column(db.String(32), nullable=False, default="BORRADOR")
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    versiones: Mapped[list["OrdenCompraVersion"]] = relationship(
        back_populates="orden", order_by="OrdenCompraVersion.numero_version"
    )
    creador: Mapped["DimUsuario"] = relationship()


class OrdenCompraVersion(db.Model):
    __tablename__ = "fact_orden_compra_version"
    __table_args__ = (
        UniqueConstraint("orden_id", "numero_version", name="uq_orden_version_numero"),
        CheckConstraint("numero_version > 0", name="check_orden_version_positiva"),
        CheckConstraint("moneda = 'PEN'", name="check_orden_moneda_pen"),
        CheckConstraint("tipo_cambio = 1", name="check_orden_tipo_cambio_uno"),
        CheckConstraint(
            "estado IN ('BORRADOR', 'PENDIENTE_APROBACION', 'APROBADA', 'EMITIDA', "
            "'PARCIALMENTE_RECIBIDA', 'RECIBIDA', 'CERRADA_PARCIALMENTE', "
            "'RECHAZADA', 'CANCELADA')",
            name="check_orden_version_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    orden_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_orden_compra.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    numero_version: Mapped[int] = mapped_column(db.Integer, nullable=False)
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_proveedor.id", ondelete="RESTRICT"), nullable=False
    )
    proveedor_documento_snapshot: Mapped[str] = mapped_column(db.String(11), nullable=False)
    proveedor_nombre_snapshot: Mapped[str] = mapped_column(db.String(200), nullable=False)
    moneda: Mapped[str] = mapped_column(db.String(3), nullable=False, default="PEN")
    tipo_cambio: Mapped[Decimal] = mapped_column(db.Numeric(10, 4), nullable=False, default=1)
    estado: Mapped[str] = mapped_column(db.String(32), nullable=False, default="BORRADOR")
    creado_por_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_usuario.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    enviado_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    aprobado_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    emitido_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    motivo_cancelacion: Mapped[str | None] = mapped_column(db.String(500))

    orden: Mapped[OrdenCompra] = relationship(back_populates="versiones")
    proveedor: Mapped["DimProveedor"] = relationship()
    creador: Mapped["DimUsuario"] = relationship(foreign_keys=[creado_por_id])
    lineas: Mapped[list["OrdenCompraLinea"]] = relationship(
        back_populates="version", order_by="OrdenCompraLinea.created_at"
    )
    aprobaciones: Mapped[list["AprobacionOrdenCompra"]] = relationship(
        back_populates="version", order_by="AprobacionOrdenCompra.etapa"
    )


class OrdenCompraLinea(db.Model):
    __tablename__ = "fact_orden_compra_linea"
    __table_args__ = (
        UniqueConstraint("version_id", "producto_id", name="uq_orden_version_producto"),
        CheckConstraint("cantidad_solicitada > 0", name="check_orden_linea_cantidad_positiva"),
        CheckConstraint("costo_unitario >= 0", name="check_orden_linea_costo_no_negativo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_orden_compra_version.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    producto_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_producto.id", ondelete="RESTRICT"), nullable=False
    )
    almacen_previsto_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_almacen.id", ondelete="RESTRICT"), nullable=False
    )
    almacen_previsto_snapshot: Mapped[str] = mapped_column(db.String(100), nullable=False)
    sku_snapshot: Mapped[str] = mapped_column(db.String(50), nullable=False)
    producto_snapshot: Mapped[str] = mapped_column(db.String(200), nullable=False)
    cantidad_solicitada: Mapped[int] = mapped_column(db.Integer, nullable=False)
    costo_unitario: Mapped[Decimal] = mapped_column(db.Numeric(15, 4), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    version: Mapped[OrdenCompraVersion] = relationship(back_populates="lineas")
    producto: Mapped["DimProducto"] = relationship()
    almacen_previsto: Mapped["DimAlmacen"] = relationship()


class AprobacionOrdenCompra(db.Model):
    __tablename__ = "fact_orden_compra_aprobacion"
    __table_args__ = (
        UniqueConstraint("version_id", "etapa", name="uq_aprobacion_version_etapa"),
        UniqueConstraint("version_id", "aprobador_id", name="uq_aprobacion_version_aprobador"),
        CheckConstraint("etapa BETWEEN 1 AND 3", name="check_aprobacion_etapa"),
        CheckConstraint(
            "estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')",
            name="check_aprobacion_estado",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_orden_compra_version.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    etapa: Mapped[int] = mapped_column(db.Integer, nullable=False)
    cargo_snapshot: Mapped[str] = mapped_column(db.String(100), nullable=False)
    aprobador_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_usuario.id", ondelete="RESTRICT"), nullable=False
    )
    estado: Mapped[str] = mapped_column(db.String(16), nullable=False, default="PENDIENTE")
    comentario: Mapped[str | None] = mapped_column(db.String(500))
    decidido_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))

    version: Mapped[OrdenCompraVersion] = relationship(back_populates="aprobaciones")
    aprobador: Mapped["DimUsuario"] = relationship()


class RecepcionCompra(db.Model):
    __tablename__ = "fact_recepcion_compra"
    __table_args__ = (
        CheckConstraint(
            "estado IN ('BORRADOR', 'CONTABILIZADA')", name="check_recepcion_compra_estado"
        ),
        CheckConstraint(
            "numero_guia IS NULL OR length(numero_guia) > 0", name="check_recepcion_guia_no_vacia"
        ),
        CheckConstraint(
            "numero_factura IS NULL OR length(numero_factura) > 0",
            name="check_recepcion_factura_no_vacia",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    version_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_orden_compra_version.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_usuario.id", ondelete="RESTRICT"), nullable=False
    )
    fecha_recepcion: Mapped[date] = mapped_column(db.Date, nullable=False)
    numero_guia: Mapped[str | None] = mapped_column(db.String(100))
    fecha_guia: Mapped[date | None] = mapped_column(db.Date)
    numero_factura: Mapped[str | None] = mapped_column(db.String(100))
    fecha_factura: Mapped[date | None] = mapped_column(db.Date)
    estado: Mapped[str] = mapped_column(db.String(16), nullable=False, default="BORRADOR")
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )
    contabilizada_at: Mapped[datetime | None] = mapped_column(db.DateTime(timezone=True))
    contabilizada_por_id: Mapped[uuid.UUID | None] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_usuario.id", ondelete="RESTRICT")
    )

    version: Mapped[OrdenCompraVersion] = relationship()
    usuario: Mapped["DimUsuario"] = relationship(foreign_keys=[usuario_id])
    contabilizada_por: Mapped["DimUsuario"] = relationship(foreign_keys=[contabilizada_por_id])
    lineas: Mapped[list["RecepcionCompraLinea"]] = relationship(
        back_populates="recepcion", cascade="save-update, merge", order_by="RecepcionCompraLinea.id"
    )


class RecepcionCompraLinea(db.Model):
    __tablename__ = "fact_recepcion_compra_linea"
    __table_args__ = (
        UniqueConstraint(
            "recepcion_id", "orden_linea_id", "almacen_id", name="uq_recepcion_linea_destino"
        ),
        CheckConstraint(
            "cantidad_aceptada >= 0 AND cantidad_rechazada >= 0 AND "
            "(cantidad_aceptada + cantidad_rechazada) > 0",
            name="check_recepcion_linea_cantidades",
        ),
        CheckConstraint("costo_unitario >= 0", name="check_recepcion_linea_costo_no_negativo"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    recepcion_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_recepcion_compra.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    orden_linea_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_orden_compra_linea.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    almacen_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_almacen.id", ondelete="RESTRICT"), nullable=False
    )
    almacen_snapshot: Mapped[str] = mapped_column(db.String(100), nullable=False)
    cantidad_aceptada: Mapped[int] = mapped_column(db.Integer, nullable=False)
    cantidad_rechazada: Mapped[int] = mapped_column(db.Integer, nullable=False, default=0)
    motivo_rechazo: Mapped[str | None] = mapped_column(db.String(300))
    costo_unitario: Mapped[Decimal] = mapped_column(db.Numeric(15, 4), nullable=False)

    recepcion: Mapped[RecepcionCompra] = relationship(back_populates="lineas")
    orden_linea: Mapped[OrdenCompraLinea] = relationship()
    almacen: Mapped["DimAlmacen"] = relationship()


class CierreSaldoOrdenCompra(db.Model):
    __tablename__ = "fact_orden_compra_cierre_saldo"
    __table_args__ = (
        UniqueConstraint("orden_linea_id", name="uq_orden_cierre_linea"),
        CheckConstraint("cantidad_cerrada > 0", name="check_orden_cierre_cantidad_positiva"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    orden_linea_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True),
        ForeignKey("fact_orden_compra_linea.id", ondelete="RESTRICT"),
        nullable=False,
    )
    cantidad_cerrada: Mapped[int] = mapped_column(db.Integer, nullable=False)
    motivo: Mapped[str] = mapped_column(db.String(500), nullable=False)
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        db.Uuid(as_uuid=True), ForeignKey("dim_usuario.id", ondelete="RESTRICT"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        db.DateTime(timezone=True), nullable=False, default=lambda: datetime.now(UTC)
    )

    orden_linea: Mapped[OrdenCompraLinea] = relationship()
    usuario: Mapped["DimUsuario"] = relationship()
