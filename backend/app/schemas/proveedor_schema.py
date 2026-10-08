from typing import Self
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.proveedor import DimProveedor


class ProveedorCampos(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    tipo_documento: str = Field(pattern=r"^(RUC|DNI)$")
    numero_documento: str = Field(min_length=8, max_length=11, pattern=r"^\d+$")
    razon_social: str = Field(min_length=1, max_length=200)
    nombre_comercial: str | None = Field(default=None, max_length=200)
    contacto: str | None = Field(default=None, max_length=150)
    telefono: str | None = Field(default=None, max_length=30)
    correo: str | None = Field(default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    @model_validator(mode="after")
    def _longitud_documento(self):
        esperado = 11 if self.tipo_documento == "RUC" else 8
        if len(self.numero_documento) != esperado:
            raise ValueError(f"{self.tipo_documento} debe tener {esperado} dígitos")
        return self

    @field_validator("nombre_comercial", "contacto", "telefono", "correo", mode="before")
    @classmethod
    def _vacio_es_nulo(cls, valor: object) -> object:
        return valor.strip() or None if isinstance(valor, str) else valor


class ProveedorCrear(ProveedorCampos):
    pass


class ProveedorActualizar(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    razon_social: str | None = Field(default=None, min_length=1, max_length=200)
    nombre_comercial: str | None = Field(default=None, max_length=200)
    contacto: str | None = Field(default=None, max_length=150)
    telefono: str | None = Field(default=None, max_length=30)
    correo: str | None = Field(default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

    @field_validator("nombre_comercial", "contacto", "telefono", "correo", mode="before")
    @classmethod
    def _vacio_es_nulo(cls, valor: object) -> object:
        return valor.strip() or None if isinstance(valor, str) else valor

    @model_validator(mode="after")
    def _razon_social_no_nula(self) -> Self:
        if "razon_social" in self.model_fields_set and self.razon_social is None:
            raise ValueError("La razón social no puede quedar vacía")
        return self


class FiltroProveedores(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    todos: bool = False
    search: str = Field(default="", max_length=100)


class CambioEstadoProveedor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class ProveedorSalida(BaseModel):
    id: UUID
    tipo_documento: str
    numero_documento: str
    razon_social: str
    nombre_comercial: str | None
    contacto: str | None
    telefono: str | None
    correo: str | None
    is_active: bool

    @classmethod
    def desde(cls, proveedor: DimProveedor):
        return cls(
            id=proveedor.id,
            tipo_documento=proveedor.tipo_documento,
            numero_documento=proveedor.numero_documento,
            razon_social=proveedor.razon_social,
            nombre_comercial=proveedor.nombre_comercial,
            contacto=proveedor.contacto,
            telefono=proveedor.telefono,
            correo=proveedor.correo,
            is_active=proveedor.is_active,
        )
