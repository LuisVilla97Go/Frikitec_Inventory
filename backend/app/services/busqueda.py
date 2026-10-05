import unicodedata
from sqlalchemy import ColumnElement, and_, func, or_

_CON_TILDE = "áàäâéèëêíìïîóòöôúùüûñç"
_SIN_TILDE = "aaaaeeeeiiiioooouuuunc"


def escapar_like(texto: str) -> str:

    return texto.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def normalizar(texto: str) -> str:

    descompuesto = unicodedata.normalize("NFD", texto.lower())
    sin_marcas = "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")
    return sin_marcas


def _sin_tildes(columna: ColumnElement[str]) -> ColumnElement[str]:
    return func.translate(
        func.lower(func.coalesce(columna, "")), _CON_TILDE, _SIN_TILDE
    )


def todas_las_palabras(
    texto: str, *columnas: ColumnElement[str]
) -> ColumnElement[bool]:

    palabras = normalizar(texto).split()
    columnas_normalizadas = [_sin_tildes(c) for c in columnas]
    return and_(
        *(
            or_(
                *(
                    c.like(f"%{escapar_like(p)}%", escape="\\")
                    for c in columnas_normalizadas
                )
            )
            for p in palabras
        )
    )
