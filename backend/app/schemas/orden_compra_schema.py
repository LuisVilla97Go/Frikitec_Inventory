from datetime import date
from decimal import Decimal
from typing import Literal, Self
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator


class LineaOrdenEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    producto_id: UUID
    almacen_previsto_id: UUID
    cantidad_solicitada: int = Field(gt=0, le=1_000_000)
    costo_unitario: Decimal = Field(ge=0, max_digits=15, decimal_places=4)


class OrdenCompraCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    proveedor_id: UUID
    lineas: list[LineaOrdenEntrada] = Field(min_length=1, max_length=200)


class DecidirAprobacion(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    decision: Literal["APROBAR", "RECHAZAR"]
    comentario: str | None = Field(default=None, max_length=500)

    @model_validator(mode="after")
    def _motivo_al_rechazar(self) -> Self:
        if self.decision == "RECHAZAR" and not self.comentario:
            raise ValueError("El rechazo requiere un motivo")
        return self


class LineaRecepcionEntrada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    orden_linea_id: UUID
    almacen_id: UUID
    cantidad_aceptada: int = Field(ge=0, le=1_000_000)
    cantidad_rechazada: int = Field(default=0, ge=0, le=1_000_000)
    motivo_rechazo: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _cantidades_y_motivo(self) -> Self:
        if self.cantidad_aceptada + self.cantidad_rechazada <= 0:
            raise ValueError(
                "La línea debe registrar una cantidad aceptada o rechazada"
            )
        if self.cantidad_rechazada > 0 and not self.motivo_rechazo:
            raise ValueError("Indica el motivo del excedente o daño rechazado")
        if self.cantidad_rechazada == 0 and self.motivo_rechazo:
            raise ValueError("El motivo de rechazo requiere cantidad rechazada")
        return self


class RecepcionCompraEntrada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    fecha_recepcion: date
    numero_guia: str | None = Field(default=None, min_length=1, max_length=100)
    fecha_guia: date | None = None
    numero_factura: str | None = Field(default=None, min_length=1, max_length=100)
    fecha_factura: date | None = None
    lineas: list[LineaRecepcionEntrada] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _documentos_y_fechas(self) -> Self:
        if self.fecha_guia and not self.numero_guia:
            raise ValueError("La fecha de guía requiere número de guía")
        if self.fecha_factura and not self.numero_factura:
            raise ValueError("La fecha de factura requiere número de factura")
        pares = [(linea.orden_linea_id, linea.almacen_id) for linea in self.lineas]
        if len(pares) != len(set(pares)):
            raise ValueError("No repitas una línea de orden para el mismo almacén")
        return self


class AdjuntarFacturaEntrada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    numero_factura: str = Field(min_length=1, max_length=100)
    fecha_factura: date | None = None


class CancelarOrdenEntrada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    motivo: str = Field(min_length=1, max_length=500)


class LineaCierreEntrada(BaseModel):
    model_config = ConfigDict(extra="forbid")

    orden_linea_id: UUID
    cantidad_cerrada: int = Field(gt=0, le=1_000_000)


class CerrarSaldoEntrada(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    motivo: str = Field(min_length=1, max_length=500)
    lineas: list[LineaCierreEntrada] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _lineas_unicas(self) -> Self:
        ids = [linea.orden_linea_id for linea in self.lineas]
        if len(ids) != len(set(ids)):
            raise ValueError("No repitas una línea de orden en el cierre")
        return self


class FiltroOrdenCompra(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)
