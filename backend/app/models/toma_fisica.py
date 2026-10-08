import enum
import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING
from sqlalchemy import text
from sqlalchemy.orm import Mapped, relationship
from app.extensions import db

if TYPE_CHECKING:
    from app.models.almacen import DimAlmacen
    from app.models.producto import DimProducto
    from app.models.usuario import DimUsuario


SECUENCIA_NUMERO = db.Sequence("toma_fisica_numero_seq", metadata=db.metadata)


class EstadoTomaFisica(str, enum.Enum):
    ABIERTO = "ABIERTO"
    CONTABILIZADO = "CONTABILIZADO"
    ANULADO = "ANULADO"


class DocTomaFisica(db.Model):

    __tablename__ = "doc_toma_fisica"

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero = db.Column(db.String(20), nullable=False, unique=True)
    almacen_id = db.Column(
        db.Uuid(as_uuid=True),
        db.ForeignKey("dim_almacen.id"),
        nullable=False,
        index=True,
    )
    estado = db.Column(
        db.Enum(EstadoTomaFisica, name="estado_toma_fisica_enum"),
        nullable=False,
        default=EstadoTomaFisica.ABIERTO,
    )
    observacion = db.Column(db.String(300), nullable=True)
    creado_por_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"), nullable=False
    )
    creado_en = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    cerrado_por_id = db.Column(db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"))
    cerrado_en = db.Column(db.DateTime(timezone=True))
    motivo_anulacion = db.Column(db.String(300))

    almacen: Mapped["DimAlmacen"] = relationship()
    creado_por: Mapped["DimUsuario"] = relationship(foreign_keys=[creado_por_id])
    cerrado_por: Mapped["DimUsuario | None"] = relationship(
        foreign_keys=[cerrado_por_id]
    )
    lineas: Mapped[list["DocTomaFisicaLinea"]] = relationship(
        back_populates="documento",
        cascade="all, delete-orphan",
        order_by="DocTomaFisicaLinea.agregado_en",
    )


class DocTomaFisicaLinea(db.Model):
    __tablename__ = "doc_toma_fisica_linea"
    __table_args__ = (
        db.UniqueConstraint(
            "documento_id", "producto_id", name="uq_toma_linea_producto"
        ),
        db.Index(
            "uq_toma_linea_abierta",
            "almacen_id",
            "producto_id",
            unique=True,
            postgresql_where=text("abierta"),
        ),
        db.CheckConstraint("stock_sistema >= 0", name="check_toma_stock_sistema"),
        db.CheckConstraint(
            "cantidad_contada IS NULL OR cantidad_contada >= 0",
            name="check_toma_contada",
        ),
    )

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    documento_id = db.Column(
        db.Uuid(as_uuid=True),
        db.ForeignKey("doc_toma_fisica.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    producto_id = db.Column(
        db.Uuid(as_uuid=True),
        db.ForeignKey("dim_producto.id"),
        nullable=False,
        index=True,
    )
    almacen_id = db.Column(
        db.Uuid(as_uuid=True), db.ForeignKey("dim_almacen.id"), nullable=False
    )
    abierta = db.Column(db.Boolean, nullable=False, default=True)
    stock_sistema = db.Column(db.Integer, nullable=False)
    agregado_en = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )
    cantidad_contada = db.Column(db.Integer)
    contado_por_id = db.Column(db.Uuid(as_uuid=True), db.ForeignKey("dim_usuario.id"))
    contado_en = db.Column(db.DateTime(timezone=True))
    diferencia = db.Column(db.Integer)
    movimiento_id = db.Column(
        db.Uuid(as_uuid=True),
        db.ForeignKey("fact_movimiento.id", ondelete="RESTRICT"),
        unique=True,
    )

    documento: Mapped[DocTomaFisica] = relationship(back_populates="lineas")
    producto: Mapped["DimProducto"] = relationship()
