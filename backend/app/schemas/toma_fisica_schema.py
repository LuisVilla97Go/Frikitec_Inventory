from datetime import datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field
from app.models.toma_fisica import EstadoTomaFisica

MAX_PRODUCTOS = 500


class TomaFisicaCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    almacen_id: UUID
    producto_ids: list[UUID] = Field(default_factory=list, max_length=MAX_PRODUCTOS)
    observacion: str | None = Field(default=None, max_length=300)


class AgregarProductos(BaseModel):
    model_config = ConfigDict(extra="forbid")

    producto_ids: list[UUID] = Field(min_length=1, max_length=MAX_PRODUCTOS)


class Conteo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    linea_id: UUID
    # null borra lo contado (se equivocó de fila)
    cantidad_contada: int | None = Field(ge=0, le=1_000_000)


class GuardarConteo(BaseModel):

    model_config = ConfigDict(extra="forbid")

    conteos: list[Conteo] = Field(min_length=1, max_length=MAX_PRODUCTOS)


class AnularToma(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    motivo: str = Field(min_length=3, max_length=300)


class FiltroTomas(BaseModel):
    model_config = ConfigDict(extra="forbid")

    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=10, ge=1, le=200)
    estado: EstadoTomaFisica | None = None


class LineaSalida(BaseModel):
    id: UUID
    producto_id: UUID
    sku: str
    producto: str
    cantidad_contada: int | None
    contado_en: datetime | None
    stock_sistema: int | None = None
    diferencia: int | None = None
    stock_actual: int | None = None
    costo_unitario: Decimal | None = None
    valor_diferencia: Decimal | None = None
    movimientos_despues: int | None = None


class TomaSalida(BaseModel):
    id: UUID
    numero: str
    almacen_id: UUID
    almacen: str
    estado: EstadoTomaFisica
    observacion: str | None
    creado_por: str
    creado_en: datetime
    cerrado_por: str | None
    cerrado_en: datetime | None
    motivo_anulacion: str | None
    productos: int
    contados: int
    valor_diferencia: Decimal | None = None
    lineas: list[LineaSalida] | None = None
