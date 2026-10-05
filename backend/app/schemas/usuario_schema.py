from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.usuario import DimUsuario, RolUsuario

CLAVE_MINIMA = 8
CLAVE_MAXIMA = 72


class ListadoUsuarios(BaseModel):
    page: int = Field(default=1, ge=1)
    per_page: int = Field(default=50, ge=1, le=200)


class UsuarioCrear(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombres: str = Field(min_length=1, max_length=100)
    apellidos: str = Field(min_length=1, max_length=100)
    email: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=CLAVE_MINIMA, max_length=CLAVE_MAXIMA)
    rol: RolUsuario = RolUsuario.TRABAJADOR
    cargo: str | None = Field(default=None, max_length=100)

    @field_validator("cargo")
    @classmethod
    def _cargo_vacio_es_nulo(cls, valor: str | None) -> str | None:
        return valor or None


class UsuarioActualizar(BaseModel):

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")

    nombres: str | None = Field(default=None, min_length=1, max_length=100)
    apellidos: str | None = Field(default=None, min_length=1, max_length=100)
    email: str | None = Field(default=None, min_length=1, max_length=120)
    password: str | None = Field(
        default=None, min_length=CLAVE_MINIMA, max_length=CLAVE_MAXIMA
    )
    rol: RolUsuario | None = None
    cargo: str | None = Field(default=None, max_length=100)

    @field_validator("password", mode="before")
    @classmethod
    def _vacia_conserva_la_actual(cls, valor: object) -> object:
        return None if valor == "" else valor

    @field_validator("cargo")
    @classmethod
    def _cargo_vacio_es_nulo(cls, valor: str | None) -> str | None:
        return valor or None


class CambioDeEstado(BaseModel):
    model_config = ConfigDict(extra="forbid")

    is_active: bool


class UsuarioSalida(BaseModel):
    id: UUID
    nombres: str
    apellidos: str
    email: str
    rol: RolUsuario
    cargo: str | None
    is_admin: bool
    is_active: bool
    created_at: datetime

    @classmethod
    def desde(cls, u: DimUsuario) -> "UsuarioSalida":
        return cls(
            id=u.id,
            nombres=u.nombres,
            apellidos=u.apellidos,
            email=u.email,
            rol=RolUsuario(u.rol),
            cargo=u.cargo,
            is_admin=u.is_admin,
            is_active=u.is_active,
            created_at=u.created_at,
        )
