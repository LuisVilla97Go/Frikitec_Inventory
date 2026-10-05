from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.models.almacen import DimAlmacen

CODIGO_SUNAT = r"^\d{4}$"


class AlmacenCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombre: str = Field(min_length=1, max_length=100)
    ubicacion: str | None = Field(default=None, max_length=200)
    codigo_establecimiento: str | None = Field(default=None, pattern=CODIGO_SUNAT)


class AlmacenActualizar(BaseModel):

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    ubicacion: str | None = Field(default=None, max_length=200)
    codigo_establecimiento: str | None = Field(default=None, pattern=CODIGO_SUNAT)

    @model_validator(mode="after")
    def _nombre_no_se_vacia(self):
        if "nombre" in self.model_fields_set and self.nombre is None:
            raise ValueError("El nombre no puede quedar vacío")
        return self


class ListadoAlmacenes(BaseModel):

    todos: bool = False


class CambioDeEstado(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class AlmacenSalida(BaseModel):
    id: UUID
    nombre: str
    ubicacion: str | None
    codigo_establecimiento: str | None
    is_active: bool
    stock: int

    @classmethod
    def desde(cls, a: DimAlmacen, stock: int) -> "AlmacenSalida":
        return cls(
            id=a.id,
            nombre=a.nombre,
            ubicacion=a.ubicacion,
            codigo_establecimiento=a.codigo_establecimiento,
            is_active=a.is_active,
            stock=stock,
        )
