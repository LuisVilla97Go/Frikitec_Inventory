from decimal import Decimal
from typing import Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.producto import CategoriaProducto, DimProducto

MAX_STOCK_INICIAL = 1_000_000


class CargaInicial(BaseModel):

    initial_stock: int = Field(default=0, ge=0, le=MAX_STOCK_INICIAL)
    warehouse_id: UUID | None = None

    @model_validator(mode="after")
    def _almacen_si_hay_stock(self):
        if self.initial_stock > 0 and self.warehouse_id is None:
            raise ValueError("El stock inicial necesita un almacén")
        return self


class DatosDelMaestro(BaseModel):

    model_config = ConfigDict(
        str_strip_whitespace=True, extra="forbid", use_enum_values=True
    )

    sku: str = Field(min_length=1, max_length=50)
    name: str = Field(min_length=1, max_length=200)
    category: CategoriaProducto
    sub_category: str | None = Field(default=None, max_length=100)
    variant: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=50)
    brand: str = Field(min_length=1, max_length=100)


class ProductoCrear(CargaInicial, DatosDelMaestro):

    model_config = ConfigDict(
        str_strip_whitespace=True, extra="forbid", use_enum_values=True
    )

    purchase_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    sale_price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)


class FilaDeImportacion(DatosDelMaestro):

    purchase_price: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    sale_price: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )


_NO_VACIABLES = frozenset(
    {"sku", "name", "category", "brand", "purchase_price", "sale_price"}
)


class ProductoActualizar(CargaInicial):

    model_config = ConfigDict(
        str_strip_whitespace=True, extra="forbid", use_enum_values=True
    )

    sku: str | None = Field(default=None, min_length=1, max_length=50)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    category: CategoriaProducto | None = None
    sub_category: str | None = Field(default=None, max_length=100)
    variant: str | None = Field(default=None, max_length=100)
    barcode: str | None = Field(default=None, max_length=50)
    brand: str | None = Field(default=None, min_length=1, max_length=100)
    purchase_price: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )
    sale_price: Decimal | None = Field(
        default=None, ge=0, max_digits=10, decimal_places=2
    )

    @model_validator(mode="after")
    def _sin_nulos_en_obligatorios(self):

        nulos = sorted(
            c for c in self.model_fields_set & _NO_VACIABLES if getattr(self, c) is None
        )
        if nulos:
            raise ValueError(f"No pueden quedar vacíos: {', '.join(nulos)}")
        return self


class ListadoProductos(BaseModel):

    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
    search: str | None = Field(default=None, max_length=100)
    sin_costo: bool = False


class SugerenciasProducto(BaseModel):

    model_config = ConfigDict(str_strip_whitespace=True)
    campo: Literal["marca", "sub_categoria", "variante"]
    categoria: CategoriaProducto | None = None
    q: str | None = Field(default=None, max_length=100)


class ProductoSalida(BaseModel):
    id: UUID
    sku: str
    name: str
    category: str
    sub_category: str | None
    variant: str | None
    barcode: str | None
    brand: str
    purchase_price: Decimal
    sale_price: Decimal
    has_movements: bool
    unvalued_stock: bool

    @classmethod
    def desde(
        cls, p: DimProducto, tiene_movimientos: bool, sin_costo: bool
    ) -> "ProductoSalida":
        return cls(
            id=p.id,
            sku=p.sku,
            name=p.nombre,
            category=p.categoria,
            sub_category=p.sub_categoria,
            variant=p.variante,
            barcode=p.codigo_barras,
            brand=p.marca,
            purchase_price=p.precio_compra_actual,
            sale_price=p.precio_venta_actual,
            has_movements=tiene_movimientos,
            unvalued_stock=sin_costo,
        )


CAMPOS_DE_CARGA = {"initial_stock", "warehouse_id"}

COLUMNA_DE_CAMPO = {
    "sku": "sku",
    "name": "nombre",
    "category": "categoria",
    "sub_category": "sub_categoria",
    "variant": "variante",
    "barcode": "codigo_barras",
    "brand": "marca",
    "purchase_price": "precio_compra_actual",
    "sale_price": "precio_venta_actual",
}
