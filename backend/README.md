# Frikitec Inventory — Backend (StockMaster API)

API RESTful para el sistema de control de inventarios, almacenes, valorización contable y gestión logística de **Frikitec**. Construida en **Python 3.13+** sobre **Flask**, empleando **SQLAlchemy** con el driver de alto rendimiento **psycopg 3** contra **PostgreSQL**, validación estricta de esquemas con **Pydantic v2**, autenticación segura mediante **JWT en cookies HttpOnly**, protección contra ataques **CSRF**, control de concurrencia con bloqueos pesimistas a nivel de base de datos y documentación interactiva generada con **OpenAPI 3.1 / Swagger UI**.

---

## Índice

1. [Visión General del Backend](#visión-general-del-backend)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Librerías y Dependencias](#librerías-y-dependencias)
4. [Arquitectura de Base de Datos y Modelos (ORM)](#arquitectura-de-base-de-datos-y-modelos-orm)
5. [Validación y Esquemas de Datos (Pydantic v2)](#validación-y-esquemas-de-datos-pydantic-v2)
6. [Capa de Servicios y Lógica Contable](#capa-de-servicios-y-lógica-contable)
7. [Catálogo de Endpoints y Módulos de la API](#catálogo-de-endpoints-y-módulos-de-la-api)
8. [Seguridad, Autenticación y Middleware](#seguridad-autenticación-y-middleware)
9. [Migraciones de Base de Datos (Alembic)](#migraciones-de-base-de-datos-alembic)
10. [Configuración y Variables de Entorno](#configuración-y-variables-de-entorno)
11. [Comandos, Calidad de Código y Pruebas](#comandos-calidad-de-código-y-pruebas)
12. [Despliegue en Producción (Render)](#despliegue-en-producción-render)

---

## Visión General del Backend

El backend de **Frikitec Inventory** es responsable de garantizar la integridad matemática, contable y transaccional del inventario:

- **Kardex Valorizado Permanente:** Implementación del método de Costo Promedio Ponderado conforme a normativas de SUNAT. El stock y el saldo valorizado de cada almacén se mantienen atómicamente con bloqueos de fila (`SELECT ... FOR UPDATE`), impidiendo saldos o valores negativos.
- **Órdenes de Compra y Recepciones:** Flujo formal de compras (`BORRADOR` → `PENDIENTE_APROBACION` → `APROBADA` → `EMITIDA`), aprobaciones escalonadas por cargo del usuario, recepciones físicas de mercadería con control de aceptados/rechazados, y entrada automática al Kardex.
- **Guías de Remisión Electrónicas:** Traslados entre almacenes con numeración correlativa única, control de peso bruto, datos de transportista y anulación auditada sin reutilización de correlativos.
- **Tomas Físicas de Inventario:** Auditorías periódicas de almacén con "conteo ciego", congelamiento del stock del sistema al agregar ítems, cálculo automático de faltantes/sobrantes y contabilización de ajustes en una única transacción atómica.
- **Importación Masiva Segura:** Carga de productos mediante hojas de cálculo Excel (`.xlsx`) con protección contra ataques *Zip Bomb* y *XXE*, y modo de simulación previo a la persistencia.

---

## Estructura del Proyecto

El código fuente se organiza siguiendo una arquitectura en capas desacoplada:

```text
backend/
├── app/
│   ├── api/                         # Capa de controladores / Blueprints RESTful
│   │   ├── almacenes.py             # Endpoints de gestión de almacenes
│   │   ├── auth.py                  # Endpoints de sesión, login, refresh y logout
│   │   ├── dashboard.py             # Endpoints de métricas y analítica
│   │   ├── empresa.py               # Endpoints de configuración fiscal de la empresa
│   │   ├── guias_remision.py        # Endpoints de emisión y consulta de guías
│   │   ├── movimientos.py           # Endpoints del libro diario de movimientos
│   │   ├── openapi.py               # Generador dinámico OpenAPI 3.1 y Swagger UI
│   │   ├── ordenes_compra.py        # Endpoints del ciclo de vida de órdenes de compra
│   │   ├── productos.py             # Endpoints del catálogo maestro e importación
│   │   ├── proveedores.py           # Endpoints del directorio de proveedores
│   │   ├── toma_fisica.py           # Endpoints de inventario físico y conciliación
│   │   └── usuarios.py              # Endpoints de administración de usuarios y accesos
│   ├── models/                      # Modelos SQLAlchemy (ORM y restricciones de BD)
│   │   ├── almacen.py               # DimAlmacen (sucursales físicas y lógicas)
│   │   ├── empresa.py               # DimEmpresa (datos fiscales con restricción singleton)
│   │   ├── guia_remision.py         # GuiaRemision y GuiaRemisionDetalle
│   │   ├── movimiento.py            # FactMovimiento (Kardex continuo)
│   │   ├── orden_compra.py          # OrdenCompra, Versiones, Líneas y Recepciones
│   │   ├── producto.py              # DimProducto y catálogo oficial de categorías
│   │   ├── proveedor.py             # DimProveedor con validación RUC/DNI
│   │   ├── stock_almacen.py         # FactStockAlmacen (stock y valor monetario por sede)
│   │   ├── toma_fisica.py           # DocTomaFisica y DocTomaFisicaLinea
│   │   └── usuario.py               # DimUsuario, roles (SUPERADMIN, ADMIN, TRABAJADOR)
│   ├── schemas/                     # Validación y serialización con Pydantic v2
│   │   ├── almacen_schema.py        # Esquemas para creación y edición de almacenes
│   │   ├── auth_schema.py           # Esquemas de credenciales de acceso
│   │   ├── empresa_schema.py        # Esquemas fiscales (RUC, dirección, razón social)
│   │   ├── movimiento_schema.py     # Esquemas de registro de movimientos y filtros
│   │   ├── orden_compra_schema.py   # Esquemas de órdenes, etapas y recepciones
│   │   ├── producto_schema.py       # Esquemas de producto, carga inicial e importación
│   │   ├── proveedor_schema.py      # Esquemas de proveedores y filtros
│   │   ├── toma_fisica_schema.py    # Esquemas de tomas físicas y conteos
│   │   └── usuario_schema.py        # Esquemas de usuarios y roles
│   ├── services/                    # Capa de lógica de negocio pura y transacciones
│   │   ├── almacenes_service.py     # Operaciones de sedes y stock agregado
│   │   ├── busqueda.py              # Utilidades de búsqueda difusa y escape LIKE
│   │   ├── dashboard_service.py     # Agregaciones analíticas y series temporales
│   │   ├── empresa_service.py       # Lógica y validación de módulo 11 para RUC
│   │   ├── errores.py               # Excepciones de negocio (ErrorDeNegocio, etc.)
│   │   ├── fechas.py                # Manejo de UTC y días de negocio en Perú
│   │   ├── guias_service.py         # Traslados atómicos y correlativos de guía
│   │   ├── importacion_productos.py # Parser de Excel, protección de archivos y lotes
│   │   ├── movimientos_service.py   # Algoritmo de valorización y Kardex
│   │   ├── ordenes_compra_service.py# Lógica de órdenes, aprobaciones y recepciones
│   │   ├── productos_service.py     # Consultas de catálogo y Kardex por almacén
│   │   ├── proveedores_service.py   # Validación y directorio de proveedores
│   │   ├── toma_fisica_service.py   # Auditoría de inventario físico y ajustes
│   │   └── usuarios_service.py      # Hashing bcrypt y jerarquía de permisos
│   ├── config.py                    # Configuraciones por entorno (Dev, Prod, Test)
│   ├── extensions.py                # Instancias globales de extensiones Flask
│   ├── proxy_firmado.py             # Middleware WSGI para autenticación de Edge Proxy
│   └── __init__.py                  # Application Factory (`create_app`)
├── migrations/                      # Script de entorno y versiones de Alembic
│   ├── versions/                    # Historial cronológico de migraciones de BD
│   ├── alembic.ini                  # Configuración base de Alembic
│   └── env.py                       # Conexión y autogeneración de esquemas
├── pyproject.toml                   # Especificación de proyecto, dependencias y linter
├── render.yaml                      # Configuración de despliegue como Web Service en Render
├── requirements.txt                 # Dependencias congeladas para producción (vía uv)
├── requirements-dev.txt             # Dependencias congeladas para desarrollo y testing
├── uv.lock                          # Lockfile determinista de uv
└── wsgi.py                          # Punto de entrada para el servidor WSGI (Gunicorn)
```

---

## Librerías y Dependencias

El proyecto utiliza **uv** como gestor de paquetes moderno y de alto rendimiento.

### Dependencias de Producción (`dependencies`)

| Paquete | Versión | Propósito / Función en el Backend |
|---|---|---|
| **`Flask`** | `3.1.3` | Framework web principal; microframework rápido y modular. |
| **`Flask-SQLAlchemy`** | `3.1.1` | Integración de SQLAlchemy con el ciclo de vida de Flask. |
| **`Flask-Migrate`** | `4.0.7` | Integración de Alembic para migraciones declarativas de esquemas de base de datos. |
| **`Flask-JWT-Extended`** | `4.6.0` | Manejo de JSON Web Tokens mediante cookies HttpOnly seguras y protección CSRF. |
| **`Flask-Cors`** | `6.0.5` | Control de Cross-Origin Resource Sharing con soporte para credenciales. |
| **`Flask-Limiter`** | `3.8.0` | Rate limiting para protección contra fuerza bruta y sobrecarga de endpoints. |
| **`psycopg[binary,pool]`** | `3.3.6` | Driver PostgreSQL nativo de última generación (versión 3) con soporte para pool de conexiones. |
| **`pydantic`** | `2.13.5` | Validación de tipos, parsing y saneamiento de entradas en tiempo de ejecución. |
| **`python-dotenv`** | `1.2.3` | Carga de variables de entorno desde el archivo `.env`. |
| **`gunicorn`** | `22.0.0` | Servidor WSGI estándar para ejecución concurrente en producción. |
| **`bcrypt`** | `4.2.0` | Algoritmo de hashing criptográfico para contraseñas de usuarios. |
| **`tzdata`** | `2026.4` | Base de datos IANA para cálculos precisos de zonas horarias (`America/Lima` / `UTC`). |
| **`openpyxl`** | `3.1.5` | Lectura y generación de hojas de cálculo Excel (`.xlsx`) para importación/exportación de productos. |
| **`defusedxml`** | `0.7.1` | Protección contra ataques XML Entity Expansion (Billion Laughs / XXE) al procesar archivos Office. |

### Dependencias de Desarrollo y Calidad (`dev`)

| Herramienta | Versión | Propósito |
|---|---|---|
| **`pytest`** | `9.1.1` | Suite de pruebas unitarias y de integración. |
| **`pytest-cov`** | `7.1.0` | Medición y reporte de cobertura de código (umbral mínimo obligatorio: 94%). |
| **`ruff`** | `0.16.8` | Linter y formateador ultrarrápido en Rust (reglas pyflakes, pycodestyle, isort, bandit, etc.). |
| **`pyright`** | `1.1.414` | Verificador de tipos estático estricto para Python. |
| **`squawk-cli`** | `2.65.0` | Linter estático para scripts de migración SQL de Postgres. |

---

## Arquitectura de Base de Datos y Modelos (ORM)

Los modelos siguen un enfoque relacional/dimensional estricto donde las restricciones de negocio se protegen directamente en el motor **PostgreSQL**:

### Modelos Principales

1. **`DimProducto` (`dim_producto`)**:
   - Catálogo de productos.
   - Campos: `id` (UUID), `sku` (único indexado), `nombre`, `categoria` (mapeada a `CategoriaProducto`), `sub_categoria`, `variante`, `codigo_barras`, `marca`, `precio_compra_actual`, `precio_venta_actual`, `is_active`.
   - Relaciones: `movimientos` (`FactMovimiento`), `stock_por_almacen` (`FactStockAlmacen`).

2. **`DimAlmacen` (`dim_almacen`)**:
   - Sedes y bodegas físicas o virtuales.
   - Restricción: Nombre único insensible a mayúsculas (`func.lower(nombre)`).
   - Campos: `id`, `nombre`, `ubicacion`, `codigo_establecimiento` (código de 4 dígitos para SUNAT), `is_active`.

3. **`FactStockAlmacen` (`fact_stock_almacen`)**:
   - Tabla de estado que mantiene las existencias y la valorización por almacén.
   - Clave primaria compuesta: `(producto_id, almacen_id)`.
   - Campos: `stock_actual` (unidades), `valor_total` (importe monetario total en soles), `costo_promedio` (derivado con 4 decimales: `valor_total / stock_actual`).
   - Restricciones Check en BD: `check_stock_no_negativo` (`stock_actual >= 0`) y `check_valor_no_negativo` (`valor_total >= 0`).

4. **`FactMovimiento` (`fact_movimiento`)**:
   - Registro permanente de movimientos de inventario (Kardex).
   - Tipos de Movimiento: `ENTRADA_COMPRA`, `SALIDA_VENTA`, `AJUSTE_POSITIVO`, `AJUSTE_NEGATIVO`, `TRANSFERENCIA`, `REVALORIZACION`.
   - Tipos de Documento: `FACTURA`, `BOLETA`, `GUIA_REMISION`, `NOTA_CREDITO`, `AJUSTE_INVENTARIO`, `NOTA_VENTA`, `CARGA_INICIAL`.
   - Campos de Trazabilidad: `cantidad`, `costo_unitario`, `importe`, `saldo_cantidad`, `saldo_valorizado`, `moneda`, `tipo_cambio`.
   - Restricciones Check en BD: Validan consistencia de signos según el tipo de movimiento y prohíben cantidades iguales a 0 (excepto en `REVALORIZACION`).

5. **`DimProveedor` (`dim_proveedor`)**:
   - Directorio de proveedores.
   - Restricciones Check en BD: Restricción estricta de formato: RUC de 11 dígitos o DNI de 8 dígitos (`uq_proveedor_documento`).

6. **`DimEmpresa` (`dim_empresa`)**:
   - Configuración fiscal de la compañía.
   - Restricción Check: `id = 1` (tabla de fila única garantizada por la base de datos).

7. **`DimUsuario` (`dim_usuario`)**:
   - Cuentas de usuario y control de accesos.
   - Roles: `SUPERADMIN`, `ADMIN`, `TRABAJADOR`.
   - Soporte para soft-delete (`deleted_at`) y asignación de cargo organizacional (`cargo`).

8. **Módulo de Compras (`fact_orden_compra*`)**:
   - `OrdenCompra`: Cabecera con número correlativo, estado y puntero de versión activa.
   - `OrdenCompraVersion`: Instantánea versionada de condiciones de compra y proveedor.
   - `OrdenCompraLinea`: Productos solicitados, cantidades, costos unitarios y almacén de destino.
   - `AprobacionOrdenCompra`: Registro de aprobación en etapas (1 a 3) por cargo y usuario.
   - `RecepcionCompra` y `RecepcionCompraLinea`: Recepción física en almacén con discriminación de cantidades aceptadas y rechazadas.
   - `CierreSaldoOrdenCompra`: Cierre formal de saldo remanente cuando un proveedor no abastece el pedido completo.

9. **Módulo de Guías de Remisión (`guia_remision*`)**:
   - `GuiaRemision` y `GuiaRemisionDetalle`: Correlativo único, almacén origen y destino, transportista, datos de vehículo, peso bruto y motivo de traslado (Catálogo 20 SUNAT).
   - Anulación auditada con almacenamiento del motivo (`motivo_anulacion`, `anulada_en`, `usuario_anulacion_id`).

10. **Módulo de Toma Física (`doc_toma_fisica*`)**:
    - `DocTomaFisica` y `DocTomaFisicaLinea`: Auditorías de stock físico con secuencia propia (`toma_fisica_numero_seq`).
    - Almacena el stock teórico del sistema en el momento de apertura (`stock_sistema`), la cantidad contada físicamente (`cantidad_contada`) y la diferencia resultante.

---

## Validación y Esquemas de Datos (Pydantic v2)

Todas las peticiones entrantes se validan utilizando **Pydantic v2**, aplicando configuraciones estrictas:
- `str_strip_whitespace = True`: Limpieza automática de espacios en blanco al inicio y final de strings.
- `extra = "forbid"`: Rechazo inmediato de propiedades desconocidas en los JSON enviados por el cliente.
- Validadores `@model_validator(mode="after")` para reglas complejas inter-campo (por ejemplo, exigir proveedor únicamente en entradas de compra, validar coherencia de fechas `desde <= hasta` o requerir almacén si se define stock inicial mayor a 0).
- Manejador de error global en Flask que intercepta `ValidationError` y devuelve respuestas estructuradas con código HTTP `422 Unprocessable Entity`.

---

## Capa de Servicios y Lógica Contable

La capa `app/services/` encapsula todas las reglas de negocio, manteniendo a los controladores (`api/`) limpios y delgados:

### 1. Algoritmo de Kardex y Costo Promedio Ponderado (`movimientos_service.py`)
- Emplea `db.session.get(..., with_for_update=True)` para bloquear la fila de stock del producto y del almacén.
- **Entradas:** Incrementan las unidades y el saldo valorizado sumando `round(cantidad * costo * tipo_cambio)`.
- **Salidas:** El importe restado se deduce proporcionalmente al costo promedio vigente:
  $$\text{Importe Salida} = -\text{round}\left(\frac{\text{Valor Previo} \times (-\text{Cantidad})}{\text{Stock Previo}}\right)$$
- **Revalorizaciones:** Corrige el saldo valorizado sin mover unidades físicas:
  $$\text{Importe Revalorización} = \text{round}(\text{Stock Previo} \times \text{Nuevo Costo}) - \text{Valor Previo}$$
- Tras cualquier cambio, se actualiza el costo promedio del almacén con 4 decimales (`0.0001`) y el precio de compra de referencia del producto.

### 2. Importación Masiva de Productos (`importacion_productos.py`)
- Valida archivos Excel `.xlsx` asegurando que no excedan 2,000 filas ni 20 MB descomprimidos.
- Procesa el documento en modo de streaming con `openpyxl` mediante `ReadOnlyWorksheet` y `defusedxml`.
- Modos de ejecución:
  - `simular`: Analiza inconsistencias, errores de formato, SKUs duplicados y genera un reporte sin tocar la base de datos.
  - `aplicar`: Ejecuta la creación o actualización en lotes dentro de una transacción única.

### 3. Aprobación y Recepción de Órdenes (`ordenes_compra_service.py`)
- Administra el flujo de estados de compra.
- Al contabilizar una recepción, se invocan internamente las funciones de Kardex para ingresar la mercadería al almacén destino con su costo unitario acordado, asociando la recepción a los movimientos contables.

### 4. Traslados con Guías de Remisión (`guias_service.py`)
- Un traslado entre almacenes ejecuta en una sola transacción:
  1. Salida (`TRANSFERENCIA`) en el almacén de origen al costo promedio del origen.
  2. Entrada (`TRANSFERENCIA`) en el almacén de destino trasladando el mismo importe monetario exacto del origen.
  3. Reserva y emisión del correlativo de la guía.

---

## Catálogo de Endpoints y Módulos de la API

La API expone los siguientes módulos bajo el prefijo `/api`:

### 1. Autenticación y Sesión (`/api/auth`)
- `POST /api/auth/login`: Autentica credenciales (con rate limit de 5 peticiones/min por IP). Emite cookies HttpOnly con JWT.
- `POST /api/auth/refresh`: Renueva el token de acceso utilizando la cookie de refresco.
- `POST /api/auth/logout`: Elimina las cookies de sesión del navegador.
- `GET /api/auth/me`: Retorna los datos del usuario autenticado actual.

### 2. Catálogo de Productos (`/api/productos`)
- `GET /api/productos`: Listado paginado de productos con búsqueda difusa (SKU, nombre, marca, categoría, sin tildes) y filtro de productos sin costo.
- `POST /api/productos`: Creación de producto (admite carga inicial de stock opcional).
- `PUT /api/productos/<id>`: Actualización de datos de un producto.
- `DELETE /api/productos/<id>`: Desactivación lógica de un producto (`is_active = False`).
- `GET /api/productos/<id>/kardex`: Consulta del Kardex valorizado continuo (filtrable por almacén).
- `GET /api/productos/sugerencias`: Autocompletado de marcas, subcategorías y variantes ya registradas.
- `POST /api/productos/importar`: Carga masiva mediante archivo Excel multipart (`?modo=simular|aplicar`).
- `GET /api/productos/plantilla-importacion`: Descarga de la plantilla Excel oficial con listas desplegables.

### 3. Movimientos y Libro Diario (`/api/movimientos`)
- `GET /api/movimientos`: Libro diario completo de movimientos con filtros por fechas (`desde`/`hasta`), almacén, tipo de movimiento y texto de búsqueda.

### 4. Guías de Remisión (`/api/guias-remision`)
- `GET /api/guias-remision`: Listado paginado de guías de remisión emitidas.
- `POST /api/guias-remision`: Emisión de nueva guía y ejecución del traslado de stock.
- `GET /api/guias-remision/stock-disponible`: Consulta de existencias trasladables por almacén.
- `GET /api/guias-remision/<id>`: Detalle completo de una guía de remisión.
- `PUT /api/guias-remision/<id>`: Modificación de datos de transporte o corrección atómica de ítems.
- `POST /api/guias-remision/<id>/anular`: Anulación de la guía y reversión de los movimientos de stock asociados.

### 5. Órdenes de Compra (`/api/ordenes`)
- `GET /api/ordenes`: Listado de órdenes de compra con estado y versión.
- `POST /api/ordenes`: Creación de una orden en estado `BORRADOR`.
- `GET /api/ordenes/<id>`: Detalle de la orden, sus líneas, versiones y aprobaciones.
- `PUT /api/ordenes/<id>`: Guardado de cambios en la versión borrador.
- `POST /api/ordenes/<id>/enviar`: Envío a aprobación.
- `POST /api/ordenes/<id>/decidir`: Aprobación o rechazo por parte del usuario autorizado.
- `POST /api/ordenes/<id>/emitir`: Emisión formal de la orden aprobada.
- `POST /api/ordenes/<id>/recepciones`: Registro de una recepción física en borrador.
- `POST /api/ordenes/<id>/recepciones/<rec_id>/contabilizar`: Contabilización de mercadería ingresada en el Kardex.
- `POST /api/ordenes/<id>/recepciones/<rec_id>/factura`: Asociación de factura de proveedor.
- `POST /api/ordenes/<id>/cerrar-saldo`: Cierre de saldo pendiente de una línea.
- `POST /api/ordenes/<id>/cancelar`: Cancelación de la orden.

### 6. Tomas Físicas de Inventario (`/api/tomas-fisicas`)
- `GET /api/tomas-fisicas`: Listado de tomas de inventario.
- `POST /api/tomas-fisicas`: Apertura de una toma física por almacén.
- `GET /api/tomas-fisicas/<id>`: Detalle de la toma (conteo ciego para trabajadores; muestra diferencias a administradores).
- `POST /api/tomas-fisicas/<id>/productos`: Congelamiento y adición de productos a contar.
- `PUT /api/tomas-fisicas/<id>/conteo`: Registro de cantidades contadas.
- `POST /api/tomas-fisicas/<id>/contabilizar`: Generación automática de ajustes contables en el Kardex.
- `POST /api/tomas-fisicas/<id>/anular`: Anulación de una toma en proceso.

### 7. Almacenes (`/api/almacenes`)
- `GET /api/almacenes`: Listado de sedes con total de unidades en stock.
- `POST /api/almacenes`: Creación de almacén (requiere rol administrador).
- `PUT /api/almacenes/<id>`: Actualización de datos del almacén.
- `PATCH /api/almacenes/<id>/estado`: Activación o desactivación de la sede.

### 8. Proveedores (`/api/proveedores`)
- `GET /api/proveedores`: Directorio de proveedores.
- `POST /api/proveedores`: Registro con validación de documento (RUC/DNI).
- `PUT /api/proveedores/<id>`: Modificación de datos comerciales y de contacto.
- `PATCH /api/proveedores/<id>/estado`: Cambio de estado activo/inactivo.

### 9. Datos de la Empresa (`/api/empresa`)
- `GET /api/empresa`: Consulta de la información fiscal de la empresa.
- `PUT /api/empresa`: Registro y actualización de datos fiscales (con validación de RUC módulo 11).

### 10. Gestión de Usuarios (`/api/usuarios`)
- `GET /api/usuarios`: Directorio paginado de usuarios del sistema.
- `POST /api/usuarios`: Creación de usuario y asignación de rol/cargo.
- `PUT /api/usuarios/<id>`: Actualización de datos del usuario.
- `PATCH /api/usuarios/<id>/estado`: Bloqueo o activación de acceso.
- `DELETE /api/usuarios/<id>`: Baja lógica del usuario conservando autoría histórica.

### 11. Dashboard (`/api/dashboard`)
- `GET /api/dashboard/resumen`: Indicadores clave (KPIs), valor monetario global, conteo de stock bajo, distribución por marcas y categorías, y evolución mensual.

### 12. Documentación OpenAPI (`/api/docs` y `/api/openapi.json`)
- `GET /api/docs`: Interfaz Swagger UI protegida para administradores.
- `GET /api/openapi.json`: Especificación completa generada dinámicamente en formato OpenAPI 3.1.0.

---

## Seguridad, Autenticación y Middleware

1. **Gestión de Sesión con JWT en Cookies HttpOnly:**
   - La API emite dos tokens JWT:
     - `access_token_cookie`: Vida útil de 15 minutos.
     - `refresh_token_cookie`: Vida útil de 7 días (restringida a `/api/auth/refresh`).
   - Ambas cookies se configuran con flags `HttpOnly`, `SameSite=Lax` y `Secure=True` en producción, mitigando ataques de robo de sesión mediante XSS.

2. **Doble Envío de Token CSRF (Double Submit Cookie):**
   - Para métodos que alteran estado (`POST`, `PUT`, `PATCH`, `DELETE`), se exige la cabecera `X-CSRF-TOKEN` que debe coincidir con la cookie legible `csrf_access_token`.

3. **Autenticación Perimetral de Edge Proxy (`IpDelProxyFirmado`):**
   - En despliegues donde el tráfico proviene de Cloudflare Workers, el middleware WSGI `IpDelProxyFirmado` valida la cabecera secreta `X-StockMaster-Proxy` mediante `hmac.compare_digest`.
   - Si la firma es válida, extrae de manera segura la dirección IP real del cliente desde `X-StockMaster-IP` y la inyecta en `REMOTE_ADDR`, impidiendo accesos directos o falsificaciones de IP.

4. **Cabeceras de Seguridad HTTP:**
   - En cada respuesta HTTP se inyectan automáticamente:
     - `X-Content-Type-Options: nosniff`
     - `X-Frame-Options: DENY`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Content-Security-Policy: default-src 'none'; frame-ancestors 'none'`
     - `Strict-Transport-Security: max-age=31536000; includeSubDomains` (en HTTPS)

5. **Rate Limiting:**
   - `Flask-Limiter` protege rutas sensibles (como `/api/auth/login`, con un límite de 5 intentos por minuto por IP).

---

## Migraciones de Base de Datos (Alembic)

Las migraciones son gestionadas mediante **Flask-Migrate** y se encuentran en `migrations/versions/`:

### Comandos de Migración
```bash
# Aplicar todas las migraciones pendientes hasta la última versión
flask db upgrade

# Revertir una migración
flask db downgrade

# Generar una nueva migración tras modificar un modelo
flask db migrate -m "descripcion_del_cambio"
```

---

## Configuración y Variables de Entorno

El backend requiere la definición de variables de entorno en el archivo `.env` en la raíz del proyecto. El archivo `.env.example` sirve como plantilla:

```env
# Claves secretas para firma de sesiones y tokens (generar cadenas aleatorias seguras)
SECRET_KEY=clave_secreta_de_flask
JWT_SECRET_KEY=clave_secreta_de_jwt

# URL de conexión a la base de datos principal PostgreSQL (driver psycopg 3)
DATABASE_URL=postgresql+psycopg://usuario:password@127.0.0.1:5432/stockmaster

# URL de la base de datos exclusiva para pruebas unitarias
TEST_DATABASE_URL=postgresql+psycopg://usuario:password@127.0.0.1:5432/stockmaster_test

# Configuración del pool de conexiones de SQLAlchemy
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10

# Orígenes CORS permitidos (separados por coma)
CORS_ORIGINS=http://localhost:4200

# Secreto compartido con el Cloudflare Worker proxy (mínimo 32 caracteres)
STOCKMASTER_PROXY_SECRET=clave_secreta_compartida_con_edge_proxy
```

---

## Comandos, Calidad de Código y Pruebas

Se recomienda el uso de **uv** para la gestión del entorno virtual y dependencias:

### Preparar el entorno virtual
```bash
# Crear el entorno virtual e instalar dependencias con uv
uv sync
```

### Ejecutar el servidor de desarrollo
```bash
# Iniciar con Flask CLI
flask --app wsgi run --port 5000 --debug
```

### Ejecución de Pruebas Unitarias
Las pruebas corren contra una base de datos PostgreSQL real configurada en `TEST_DATABASE_URL`:
```bash
# Ejecutar todas las pruebas con pytest
pytest

# Ejecutar pruebas con reporte de cobertura estricto (falla si es menor a 94%)
pytest --cov=app
```

### Análisis Estático y Formateo
```bash
# Ejecutar el linter Ruff
ruff check .

# Formatear el código con Ruff
ruff format .

# Verificación estricta de tipos con Pyright
pyright
```

---

## Despliegue en Producción (Render)

El repositorio incluye el archivo `render.yaml` para despliegues como Web Service en la nube de **Render**:

- **Runtime:** Python (`3.14.7` o `3.13+`).
- **Comando de compilación:** `pip install -r requirements.txt`.
- **Comando de arranque:** `gunicorn wsgi:app -w 1 -b 0.0.0.0:$PORT`.
- **Ruta de Healthcheck:** `/health` (exenta de rate limit, devuelve estado 200).
- **Protección de Tráfico:** Las variables `STOCKMASTER_PROXY_SECRET` y `DATABASE_URL` se configuran en el panel de Render, permitiendo que únicamente las peticiones firmadas provenientes del proxy perimetral de Cloudflare interactúen con la API.
