from datetime import datetime
from pydantic import BaseModel, ConfigDict, Field, field_validator
from app.models.empresa import DimEmpresa

_PESOS_RUC = (5, 4, 3, 2, 7, 6, 5, 4, 3, 2)


def ruc_valido(ruc: str) -> bool:

    if len(ruc) != 11 or not ruc.isdigit():
        return False
    suma = sum(int(d) * p for d, p in zip(ruc[:10], _PESOS_RUC, strict=True))
    verificador = 11 - suma % 11
    return int(ruc[10]) == {10: 0, 11: 1}.get(verificador, verificador)


class EmpresaGuardar(BaseModel):

    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")
    ruc: str = Field(pattern=r"^\d{11}$")
    razon_social: str = Field(min_length=1, max_length=200)
    nombre_comercial: str | None = Field(default=None, max_length=200)
    direccion_fiscal: str | None = Field(default=None, max_length=300)
    ubigeo: str | None = Field(default=None, pattern=r"^\d{6}$")
    distrito: str | None = Field(default=None, max_length=100)
    provincia: str | None = Field(default=None, max_length=100)
    departamento: str | None = Field(default=None, max_length=100)
    telefono: str | None = Field(default=None, max_length=30)
    correo: str | None = Field(
        default=None, max_length=254, pattern=r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    )
    web: str | None = Field(default=None, max_length=200)

    @field_validator("ruc")
    @classmethod
    def _ruc_con_verificador(cls, ruc: str) -> str:
        if not ruc_valido(ruc):
            raise ValueError("El RUC no es válido: revisa sus 11 dígitos")
        return ruc

    @field_validator("*", mode="before")
    @classmethod
    def _vacio_es_nulo(cls, valor: object) -> object:
        return None if isinstance(valor, str) and valor.strip() == "" else valor


class EmpresaSalida(BaseModel):
    ruc: str
    razon_social: str
    nombre_comercial: str | None
    direccion_fiscal: str | None
    ubigeo: str | None
    distrito: str | None
    provincia: str | None
    departamento: str | None
    telefono: str | None
    correo: str | None
    web: str | None
    updated_at: datetime

    @classmethod
    def desde(cls, empresa: DimEmpresa) -> "EmpresaSalida":
        return cls.model_validate(empresa, from_attributes=True)
