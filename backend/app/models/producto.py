import enum
import uuid
from datetime import UTC, datetime

from app.extensions import db


class CategoriaProducto(str, enum.Enum):
    """Categorías del catálogo de Frikitec, tal cual vienen en Inventario_Friki_Back.xlsx.

    El valor es el texto que ya guarda `dim_producto.categoria` (columna String, sin
    ENUM nativo): así los productos importados no necesitan migración. Una categoría
    nueva se añade aquí y en frontend/src/app/shared/catalogos/categorias.ts;
    validate-tipos-movimiento.mts falla si difieren.
    """

    ACCESORIOS = "Accesorios"
    ACCESORIOS_IPAD = "Accesorios iPad"
    ACCESORIOS_IPHONE = "Accesorios iPhone"
    ACCESORIOS_IWATCH = "Accesorios iWatch"
    ACCESORIOS_MACBOOK = "Accesorios MacBook"
    ACCESORIOS_PENCIL = "Accesorios Pencil"
    ADAPTADORES = "Adaptadores"
    AIRTAG = "AirTag"
    AUDIO = "Audio"
    CABLES = "Cables"
    CARGADORES = "Cargadores"
    HUB_USB = "Hub USB"
    MALETIN = "Maletín"
    ORGANIZADORES = "Organizadores"
    PENCIL = "Pencil"
    STAND = "STAND"
    TECLADOS = "Teclados"


class DimProducto(db.Model):
    __tablename__ = "dim_producto"

    id = db.Column(db.Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sku = db.Column(db.String(50), unique=True, nullable=False, index=True)
    nombre = db.Column(db.String(200), nullable=False)
    categoria = db.Column(db.String(100), nullable=False, index=True)
    sub_categoria = db.Column(db.String(100), nullable=True)
    variante = db.Column(db.String(100), nullable=True)
    codigo_barras = db.Column(db.String(50), nullable=True, index=True)
    marca = db.Column(db.String(100), nullable=False, index=True)
    precio_compra_actual = db.Column(db.Numeric(10, 2), nullable=False, default=0.00)
    precio_venta_actual = db.Column(db.Numeric(10, 2), nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime(timezone=True), default=lambda: datetime.now(UTC), nullable=False
    )

    # Relaciones
    movimientos = db.relationship("FactMovimiento", back_populates="producto", lazy="dynamic")
    stock_por_almacen = db.relationship(
        "FactStockAlmacen", back_populates="producto", lazy="dynamic"
    )

    def __repr__(self):
        return f"<DimProducto {self.sku} - {self.nombre}>"
