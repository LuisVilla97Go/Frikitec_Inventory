from datetime import date
from decimal import Decimal
from typing import Self
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.movimiento import TipoDocumento, TipoMovimiento


class MovimientoCreate(BaseModel):
    almacen_id: UUID = Field(..., description="ID del almacén")
    proveedor_id: UUID | None = Field(
        default=None, description="Proveedor de una compra"
    )
    tipo_movimiento: TipoMovimiento = Field(
        ..., description="Tipo de movimiento (ENTRADA_COMPRA, SALIDA_VENTA, etc)"
    )
    tipo_documento: TipoDocumento = Field(
        ..., description="Tipo de documento que respalda el movimiento"
    )
    numero_documento: str = Field(..., min_length=1, max_length=100)
    cantidad: int = Field(
        ..., description="Cantidad. Positiva para entradas, negativa para salidas"
    )
    costo_unitario: Decimal | None = Field(
        None, description="Costo unitario (requerido para entradas)"
    )
    moneda: str = Field("PEN", min_length=3, max_length=3)
    tipo_cambio: Decimal = Field(Decimal("1.0000"))

    @model_validator(mode="after")
    def _proveedor_para_compra(self) -> Self:
        if (
            self.tipo_movimiento == TipoMovimiento.ENTRADA_COMPRA
            and self.proveedor_id is None
        ):
            raise ValueError("Las entradas de compra requieren proveedor")
        if (
            self.tipo_movimiento != TipoMovimiento.ENTRADA_COMPRA
            and self.proveedor_id is not None
        ):
            raise ValueError("Solo las entradas de compra admiten proveedor")
        return self


class FiltroLibroDiario(BaseModel):

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
    desde: date | None = None
    hasta: date | None = None
    almacen_id: UUID | None = None
    tipo_movimiento: TipoMovimiento | None = None
    search: str = Field(default="", max_length=100)

    @model_validator(mode="after")
    def _rango_valido(self) -> Self:
        if self.desde and self.hasta and self.desde > self.hasta:
            raise ValueError("La fecha 'desde' no puede ser posterior a 'hasta'")
        return self
