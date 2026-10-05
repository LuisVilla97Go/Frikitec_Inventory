from dataclasses import dataclass
from typing import Any
from uuid import UUID
from flask import Blueprint, Flask, Response, current_app, jsonify
from flask_jwt_extended import get_jwt_identity, jwt_required
from pydantic import BaseModel
from pydantic.json_schema import models_json_schema
from app.schemas.almacen_schema import (
    AlmacenActualizar,
    AlmacenCrear,
    AlmacenSalida,
    ListadoAlmacenes,
)
from app.schemas.almacen_schema import CambioDeEstado as EstadoAlmacen
from app.schemas.auth_schema import LoginRequest
from app.schemas.empresa_schema import EmpresaGuardar, EmpresaSalida
from app.schemas.movimiento_schema import FiltroLibroDiario, MovimientoCreate
from app.schemas.orden_compra_schema import (
    AdjuntarFacturaEntrada,
    CancelarOrdenEntrada,
    CerrarSaldoEntrada,
    DecidirAprobacion,
    FiltroOrdenCompra,
    OrdenCompraCrear,
    RecepcionCompraEntrada,
)
from app.schemas.producto_schema import (
    ListadoProductos,
    ProductoActualizar,
    ProductoCrear,
    ProductoSalida,
    SugerenciasProducto,
)
from app.schemas.proveedor_schema import (
    CambioEstadoProveedor,
    FiltroProveedores,
    ProveedorActualizar,
    ProveedorCrear,
    ProveedorSalida,
)
from app.schemas.toma_fisica_schema import (
    AgregarProductos,
    AnularToma,
    FiltroTomas,
    GuardarConteo,
    TomaFisicaCrear,
    TomaSalida,
)
from app.schemas.usuario_schema import CambioDeEstado as EstadoUsuario
from app.schemas.usuario_schema import (
    ListadoUsuarios,
    UsuarioActualizar,
    UsuarioCrear,
    UsuarioSalida,
)
from app.services import usuarios_service
from app.services.guias_service import (
    AnulacionGuia,
    FiltroGuias,
    FiltroStockDisponible,
    GuiaCompleta,
    GuiaRemisionCreate,
    GuiaResumen,
    StockDisponible,
)

openapi_bp = Blueprint("openapi", __name__)


SWAGGER_UI = "https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.33.0"
SRI_JS = "sha256-Yt9UFSkIBGSnZgrceT6rcSjGGTzjviTdweDgpKY+3C8="
SRI_CSS = "sha256-GsMk99zSfkuThrS9ZCEnHsFH6SKiLAW6JLEVFemqYyE="


CSP_DOCS = (
    "default-src 'none'; "
    "script-src 'self' https://cdn.jsdelivr.net; "
    "style-src https://cdn.jsdelivr.net 'unsafe-inline'; "
    "img-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors 'none'"
)


@dataclass(frozen=True)
class Operacion:
    resumen: str
    etiqueta: str
    cuerpo: type[BaseModel] | None = None
    query: type[BaseModel] | None = None
    respuesta: type[BaseModel] | None = None
    lista: bool = False
    estado: int = 200
    descripcion: str = ""
    publica: bool = False
    solo_admin: bool = False
    binario: str | None = None
    multipart: bool = False


P, K, A, U, PR, M, OC, G, E, D, S = (
    "Productos",
    "Kardex",
    "Almacenes",
    "Usuarios",
    "Proveedores",
    "Movimientos",
    "Órdenes de compra",
    "Guías de remisión",
    "Empresa",
    "Dashboard",
    "Sesión",
)
TF = "Toma física"

OPERACIONES: dict[str, Operacion] = {
    "auth.login": Operacion(
        "Iniciar sesión",
        S,
        cuerpo=LoginRequest,
        publica=True,
        descripcion="Deja el JWT en cookies HttpOnly y la cookie legible `csrf_access_token`. "
        "5 intentos por minuto por IP.",
    ),
    "auth.refrescar": Operacion("Renovar el token de acceso", S),
    "auth.logout": Operacion("Cerrar sesión (borra las cookies)", S, publica=True),
    "auth.usuario_actual": Operacion("Usuario de la sesión", S),
    "productos.listar_productos": Operacion(
        "Listar productos",
        P,
        query=ListadoProductos,
        respuesta=ProductoSalida,
        lista=True,
        descripcion="`search` busca cada palabra en nombre, SKU, código de barras, marca "
        "y variante, sin tildes. Responde también `page`, `per_page` y `total`.",
    ),
    "productos.sugerencias_productos": Operacion(
        "Valores ya usados de marca, subcategoría o variante",
        P,
        query=SugerenciasProducto,
    ),
    "productos.crear_producto": Operacion(
        "Crear producto (con carga inicial opcional)",
        P,
        cuerpo=ProductoCrear,
        respuesta=ProductoSalida,
        estado=201,
    ),
    "productos.actualizar_producto": Operacion(
        "Editar producto", P, cuerpo=ProductoActualizar, respuesta=ProductoSalida
    ),
    "productos.desactivar_producto": Operacion("Desactivar producto (baja lógica)", P),
    "productos.descargar_plantilla": Operacion(
        "Plantilla Excel de carga masiva",
        P,
        binario="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ),
    "productos.importar_productos": Operacion(
        "Cargar productos desde Excel",
        P,
        multipart=True,
        solo_admin=True,
        descripcion="`?modo=simular` (por defecto) revisa sin guardar; `modo=aplicar` guarda.",
    ),
    "productos.ver_kardex": Operacion(
        "Kardex valorizado de un producto",
        K,
        descripcion="`?almacen_id=` da el Kardex de una tienda; sin él, el global.",
    ),
    "productos.registrar_movimiento": Operacion(
        "Registrar un movimiento en el Kardex",
        K,
        cuerpo=MovimientoCreate,
        estado=201,
        descripcion="Recalcula stock y costo unitario en la misma transacción. "
        "Una revalorización (MR21) es solo para administradores.",
    ),
    "movimientos.libro_diario": Operacion(
        "Libro diario: todos los movimientos", M, query=FiltroLibroDiario
    ),
    "almacenes.listar_almacenes": Operacion(
        "Listar almacenes",
        A,
        query=ListadoAlmacenes,
        respuesta=AlmacenSalida,
        lista=True,
    ),
    "almacenes.crear_almacen": Operacion(
        "Crear almacén",
        A,
        cuerpo=AlmacenCrear,
        respuesta=AlmacenSalida,
        estado=201,
        solo_admin=True,
    ),
    "almacenes.actualizar_almacen": Operacion(
        "Editar almacén",
        A,
        cuerpo=AlmacenActualizar,
        respuesta=AlmacenSalida,
        solo_admin=True,
    ),
    "almacenes.cambiar_estado": Operacion(
        "Activar o desactivar almacén",
        A,
        cuerpo=EstadoAlmacen,
        respuesta=AlmacenSalida,
        solo_admin=True,
    ),
    "proveedores.listar_proveedores": Operacion(
        "Listar proveedores",
        PR,
        query=FiltroProveedores,
        respuesta=ProveedorSalida,
        lista=True,
    ),
    "proveedores.crear_proveedor": Operacion(
        "Crear proveedor",
        PR,
        cuerpo=ProveedorCrear,
        respuesta=ProveedorSalida,
        estado=201,
        solo_admin=True,
    ),
    "proveedores.actualizar_proveedor": Operacion(
        "Editar proveedor",
        PR,
        cuerpo=ProveedorActualizar,
        respuesta=ProveedorSalida,
        solo_admin=True,
    ),
    "proveedores.cambiar_estado_proveedor": Operacion(
        "Activar o desactivar proveedor",
        PR,
        cuerpo=CambioEstadoProveedor,
        respuesta=ProveedorSalida,
        solo_admin=True,
    ),
    "usuarios.listar_usuarios": Operacion(
        "Listar usuarios", U, query=ListadoUsuarios, respuesta=UsuarioSalida, lista=True
    ),
    "usuarios.crear_usuario": Operacion(
        "Crear usuario",
        U,
        cuerpo=UsuarioCrear,
        respuesta=UsuarioSalida,
        estado=201,
        solo_admin=True,
    ),
    "usuarios.actualizar_usuario": Operacion(
        "Editar usuario",
        U,
        cuerpo=UsuarioActualizar,
        respuesta=UsuarioSalida,
        solo_admin=True,
    ),
    "usuarios.cambiar_estado": Operacion(
        "Activar o desactivar usuario",
        U,
        cuerpo=EstadoUsuario,
        respuesta=UsuarioSalida,
        solo_admin=True,
    ),
    "empresa.ver_empresa": Operacion(
        "Datos de la empresa",
        E,
        respuesta=EmpresaSalida,
        descripcion="`data` es null mientras un administrador no la llene.",
    ),
    "empresa.guardar_empresa": Operacion(
        "Guardar los datos de la empresa",
        E,
        cuerpo=EmpresaGuardar,
        respuesta=EmpresaSalida,
        solo_admin=True,
        descripcion="El RUC se valida con su dígito verificador (módulo 11).",
    ),
    "guias.crear_guia": Operacion(
        "Emitir guía de remisión",
        G,
        cuerpo=GuiaRemisionCreate,
        estado=201,
        descripcion="Registra la salida en el origen y la entrada en el destino en una "
        "transacción, con correlativo SUNAT. Con motivo 02 (compra) el remitente es un "
        "proveedor y no se mueve stock.",
    ),
    "guias.listar_guias": Operacion(
        "Listar guías de remisión",
        G,
        query=FiltroGuias,
        respuesta=GuiaResumen,
        lista=True,
        descripcion="La más nueva primero; las anuladas siguen en la lista.",
    ),
    "guias.detalle_guia": Operacion(
        "Ver una guía de remisión",
        G,
        respuesta=GuiaCompleta,
    ),
    "guias.editar": Operacion(
        "Editar una guía de remisión",
        G,
        cuerpo=GuiaRemisionCreate,
        respuesta=GuiaCompleta,
        descripcion="Transporte, fecha y peso cambian sin tocar el stock. Si cambian productos, "
        "cantidades o almacenes, deshace el traslado y lo rehace en la misma transacción, con "
        "el mismo número.",
    ),
    "guias.anular": Operacion(
        "Anular una guía de remisión",
        G,
        cuerpo=AnulacionGuia,
        respuesta=GuiaCompleta,
        descripcion="Movimientos inversos, estado ANULADO y motivo; nunca se borra ni se "
        "reutiliza el número. Solo un administrador o un usuario con cargo de jefe.",
    ),
    "guias.ver_stock_disponible": Operacion(
        "Stock de varios productos en un almacén",
        G,
        query=FiltroStockDisponible,
        respuesta=StockDisponible,
        lista=True,
        descripcion="Para armar la guía: cuánto se puede trasladar de cada línea.",
    ),
    "ordenes_compra.listar": Operacion(
        "Listar órdenes de compra", OC, query=FiltroOrdenCompra
    ),
    "ordenes_compra.crear": Operacion(
        "Crear orden de compra (borrador)", OC, cuerpo=OrdenCompraCrear, estado=201
    ),
    "ordenes_compra.detalle": Operacion("Detalle de la orden", OC),
    "ordenes_compra.guardar_borrador": Operacion(
        "Guardar el borrador de la orden", OC, cuerpo=OrdenCompraCrear
    ),
    "ordenes_compra.enviar": Operacion("Enviar la orden a aprobación", OC),
    "ordenes_compra.decidir": Operacion(
        "Aprobar o rechazar (firma de la etapa)", OC, cuerpo=DecidirAprobacion
    ),
    "ordenes_compra.emitir": Operacion("Emitir la orden aprobada al proveedor", OC),
    "ordenes_compra.crear_recepcion": Operacion(
        "Registrar una recepción (borrador)",
        OC,
        cuerpo=RecepcionCompraEntrada,
        estado=201,
    ),
    "ordenes_compra.editar_recepcion": Operacion(
        "Corregir una recepción en borrador", OC, cuerpo=RecepcionCompraEntrada
    ),
    "ordenes_compra.contabilizar_recepcion": Operacion(
        "Contabilizar la recepción (entra al Kardex)", OC
    ),
    "ordenes_compra.adjuntar_factura": Operacion(
        "Asociar la factura a una recepción", OC, cuerpo=AdjuntarFacturaEntrada
    ),
    "ordenes_compra.cerrar_saldo": Operacion(
        "Cerrar el saldo no recibido", OC, cuerpo=CerrarSaldoEntrada
    ),
    "ordenes_compra.cancelar": Operacion(
        "Cancelar la orden", OC, cuerpo=CancelarOrdenEntrada
    ),
    "toma_fisica.listar_tomas": Operacion(
        "Listar tomas físicas", TF, query=FiltroTomas, respuesta=TomaSalida, lista=True
    ),
    "toma_fisica.crear_toma": Operacion(
        "Abrir una toma física",
        TF,
        cuerpo=TomaFisicaCrear,
        respuesta=TomaSalida,
        estado=201,
        descripcion="El stock del sistema de cada producto se congela al agregarlo (la foto).",
    ),
    "toma_fisica.ver_toma": Operacion(
        "Detalle de la toma física",
        TF,
        respuesta=TomaSalida,
        descripcion="Conteo ciego: `stock_sistema`, `diferencia` y los valores solo salen "
        "para un administrador.",
    ),
    "toma_fisica.agregar_productos": Operacion(
        "Agregar productos a contar", TF, cuerpo=AgregarProductos, respuesta=TomaSalida
    ),
    "toma_fisica.quitar_linea": Operacion(
        "Quitar un producto de la toma", TF, respuesta=TomaSalida
    ),
    "toma_fisica.guardar_conteo": Operacion(
        "Guardar lo contado",
        TF,
        cuerpo=GuardarConteo,
        respuesta=TomaSalida,
        descripcion="Se envía lo contado, nunca la diferencia: la calcula el backend.",
    ),
    "toma_fisica.contabilizar_toma": Operacion(
        "Aprobar y contabilizar los ajustes",
        TF,
        respuesta=TomaSalida,
        solo_admin=True,
        descripcion="Un ajuste por producto con diferencia (contada − foto), todo o nada. "
        "Los sobrantes entran al costo unitario actual de la tienda.",
    ),
    "toma_fisica.anular_toma": Operacion(
        "Anular una toma abierta",
        TF,
        cuerpo=AnularToma,
        respuesta=TomaSalida,
        solo_admin=True,
    ),
    "dashboard.resumen": Operacion("Cifras del dashboard", D),
    "openapi.especificacion": Operacion(
        "Este documento OpenAPI", "Documentación", solo_admin=True
    ),
    "openapi.swagger_ui": Operacion(
        "Swagger UI", "Documentación", solo_admin=True, binario="text/html"
    ),
    "openapi.iniciar_swagger": Operacion(
        "Arranque de Swagger UI",
        "Documentación",
        solo_admin=True,
        binario="text/javascript",
    ),
}

_ERRORES = {
    "401": "Sin sesión, o sesión vencida",
    "403": "Sin permiso para esta acción",
    "404": "No existe",
    "409": "Choca con una regla de negocio (p. ej. stock insuficiente)",
    "422": "Datos inválidos: `message` dice cuál",
}


def _ruta_openapi(regla: str) -> tuple[str, list[dict[str, Any]]]:
    """`/api/x/<uuid:id>/` → `/api/x/{id}` y sus parámetros de ruta."""
    parametros: list[dict[str, Any]] = []
    partes = []
    for parte in regla.rstrip("/").split("/"):
        if parte.startswith("<") and parte.endswith(">"):
            conversor, _, nombre = parte[1:-1].rpartition(":")
            esquema = (
                {"type": "string", "format": "uuid"}
                if conversor == "uuid"
                else {"type": "string"}
            )
            parametros.append(
                {"name": nombre, "in": "path", "required": True, "schema": esquema}
            )
            partes.append(f"{{{nombre}}}")
        else:
            partes.append(parte)
    return "/".join(partes), parametros


def generar(app: Flask) -> dict[str, Any]:
    modelos = sorted(
        {
            m
            for op in OPERACIONES.values()
            for m in (op.cuerpo, op.query, op.respuesta)
            if m
        },
        key=lambda m: (m.__module__, m.__name__),
    )
    claves, definiciones = models_json_schema(
        [(m, "validation") for m in modelos],
        ref_template="#/components/schemas/{model}",
    )
    esquemas = definiciones.get("$defs", {})

    def ref(modelo: type[BaseModel]) -> dict[str, Any]:
        return claves[(modelo, "validation")]

    rutas: dict[str, dict[str, Any]] = {}
    for regla in app.url_map.iter_rules():
        if not regla.rule.startswith("/api/"):
            continue
        op = OPERACIONES.get(regla.endpoint)
        if op is None:
            continue
        camino, parametros = _ruta_openapi(regla.rule)
        for metodo in sorted((regla.methods or set()) - {"HEAD", "OPTIONS"}):
            operacion: dict[str, Any] = {
                "tags": [op.etiqueta],
                "summary": op.resumen,
                "operationId": regla.endpoint,
                "parameters": list(parametros),
            }
            descripcion = op.descripcion
            if op.solo_admin:
                descripcion = f"**Solo administradores.** {descripcion}".strip()
            if descripcion:
                operacion["description"] = descripcion
            if op.query:

                nombre_esquema = ref(op.query)["$ref"].rsplit("/", 1)[-1]
                definicion = esquemas.get(nombre_esquema, {})
                requeridos = set(definicion.get("required", []))
                for nombre, esquema in definicion.get("properties", {}).items():
                    operacion["parameters"].append(
                        {
                            "name": nombre,
                            "in": "query",
                            "required": nombre in requeridos,
                            "schema": esquema,
                        }
                    )
            if op.cuerpo:
                operacion["requestBody"] = {
                    "required": True,
                    "content": {"application/json": {"schema": ref(op.cuerpo)}},
                }
            elif op.multipart:
                operacion["requestBody"] = {
                    "required": True,
                    "content": {
                        "multipart/form-data": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "archivo": {"type": "string", "format": "binary"}
                                },
                            }
                        }
                    },
                }
            if op.binario:
                exito = {"description": "OK", "content": {op.binario: {}}}
            else:
                datos = ref(op.respuesta) if op.respuesta else {"type": "object"}
                if op.lista:
                    datos = {"type": "array", "items": datos}
                exito = {
                    "description": "OK",
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string", "const": "success"},
                                    "data": datos,
                                },
                            }
                        }
                    },
                }
            operacion["responses"] = {
                str(op.estado): exito,
                **{
                    codigo: {"$ref": f"#/components/responses/Error{codigo}"}
                    for codigo in _ERRORES
                    if not (op.publica and codigo in ("401", "403"))
                },
            }
            if op.publica:
                operacion["security"] = []
            elif metodo != "GET":
                operacion["security"] = [{"cookieJWT": [], "csrf": []}]
            rutas.setdefault(camino, {})[metodo.lower()] = operacion

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "StockMaster API",
            "version": "1.0",
            "description": (
                "API del control de inventario de Frikitec. La sesión va en cookies "
                "HttpOnly (`POST /api/auth/login`); las peticiones que escriben mandan la "
                "cabecera `X-CSRF-TOKEN` con el valor de la cookie `csrf_access_token` "
                "(Swagger UI lo hace solo). Toda respuesta es `{status, data}` o "
                '`{status: "error", message}`.'
            ),
        },
        "servers": [{"url": "/"}],
        "security": [{"cookieJWT": []}],
        "paths": dict(sorted(rutas.items())),
        "components": {
            "schemas": esquemas,
            "securitySchemes": {
                "cookieJWT": {
                    "type": "apiKey",
                    "in": "cookie",
                    "name": app.config.get(
                        "JWT_ACCESS_COOKIE_NAME", "access_token_cookie"
                    ),
                },
                "csrf": {"type": "apiKey", "in": "header", "name": "X-CSRF-TOKEN"},
            },
            "responses": {
                f"Error{codigo}": {
                    "description": texto,
                    "content": {
                        "application/json": {
                            "schema": {
                                "type": "object",
                                "properties": {
                                    "status": {"type": "string", "const": "error"},
                                    "message": {"type": "string"},
                                },
                            }
                        }
                    },
                }
                for codigo, texto in _ERRORES.items()
            },
        },
    }


def _exigir_admin() -> None:
    usuarios_service.exigir_admin(
        UUID(get_jwt_identity()), "ver la documentación de la API"
    )


@openapi_bp.get("/openapi.json")
@jwt_required()
def especificacion():
    _exigir_admin()
    return jsonify(generar(current_app)), 200


_PAGINA = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>StockMaster API · Swagger</title>
<link rel="stylesheet" href="{SWAGGER_UI}/swagger-ui.css"
      integrity="{SRI_CSS}" crossorigin="anonymous">
</head>
<body>
<div id="swagger-ui"></div>
<script src="{SWAGGER_UI}/swagger-ui-bundle.js"
        integrity="{SRI_JS}" crossorigin="anonymous"></script>
<script src="/api/docs/iniciar.js"></script>
</body>
</html>
"""

_INICIAR = """window.ui = SwaggerUIBundle({
  url: "/api/openapi.json",
  dom_id: "#swagger-ui",
  deepLinking: true,
  // La cookie csrf_access_token es legible a propósito (double submit): se copia a la cabecera
  requestInterceptor: (peticion) => {
    const csrf = document.cookie.split("; ").find((c) => c.startsWith("csrf_access_token="));
    if (csrf && peticion.method && peticion.method.toUpperCase() !== "GET") {
      peticion.headers["X-CSRF-TOKEN"] = decodeURIComponent(csrf.split("=")[1]);
    }
    return peticion;
  },
});
"""


@openapi_bp.get("/docs")
@jwt_required()
def swagger_ui():
    _exigir_admin()
    respuesta = Response(_PAGINA, mimetype="text/html")
    respuesta.headers["Content-Security-Policy"] = CSP_DOCS
    return respuesta


@openapi_bp.get("/docs/iniciar.js")
@jwt_required()
def iniciar_swagger():
    _exigir_admin()
    return Response(_INICIAR, mimetype="text/javascript")
