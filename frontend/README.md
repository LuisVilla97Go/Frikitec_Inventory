# Frikitec Inventory — Frontend (StockMaster Web)

Frontend web para el sistema de control de inventarios, almacenes y valorización de **Frikitec**. Construido como una Single Page Application (SPA) moderna, reactiva y de alto rendimiento sobre **Angular 22**, empleando componentes standalone, Angular Signals, gestión de caché de servidor con **TanStack Query**, validación en tiempo de ejecución con **Valibot** y diseño con **Tailwind CSS**.

---

## Índice

1. [Visión General del Frontend](#visión-general-del-frontend)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Librerías y Dependencias](#librerías-y-dependencias)
4. [Patrones de Arquitectura y Buenas Prácticas](#patrones-de-arquitectura-y-buenas-prácticas)
5. [Módulos y Funcionalidades (Features)](#módulos-y-funcionalidades-features)
6. [Componentes Reutilizables (Shared)](#componentes-reutilizables-shared)
7. [Manejo de API, Autenticación y Seguridad](#manejo-de-api-autenticación-y-seguridad)
8. [Enrutamiento y Navegación](#enrutamiento-y-navegación)
9. [Scripts y Comandos](#scripts-y-comandos)
10. [Despliegue y Proxy en el Edge (Cloudflare Workers)](#despliegue-y-proxy-en-el-edge-cloudflare-workers)

---

## Visión General del Frontend

El frontend de **Frikitec Inventory** proporciona una interfaz para la gestión de productos, inventario permanente (Kardex valorizado), tomas físicas, órdenes de compra, guías de remisión electrónicas (SUNAT), trazabilidad de movimientos y administración de maestros (almacenes, proveedores, empresa y usuarios).

### Puntos Clave:
- **Framework:** Angular 22 (modo Standalone absoluto, sin NgModules).
- **Reactividad:** Angular Signals (`signal`, `computed`, `toSignal`, `input`, `output`) con estrategia de detección de cambios `OnPush` en todos los componentes.
- **Server State:** `@tanstack/angular-query-experimental` (TanStack Query v5) para consultas, paginación en caché, mutaciones e invalidación reactiva.
- **Validación de Datos:** `valibot` para validar esquemas de datos entrantes desde el backend en tiempo de ejecución.
- **Estilos y Tipografía:** Tailwind CSS v3 con paleta personalizada de marca y fuentes auto-hospedadas (`Tomorrow` para encabezados y `Rubik` para cuerpo).
- **Dispositivos y Hardware:** Generación de códigos de barras SVG (`jsbarcode`) y lectura de códigos de barras mediante cámara web/móvil (`@zxing/browser`).

---

## Estructura del Proyecto

La aplicación se organiza bajo una arquitectura modular limpia orientada a características (*feature-driven*) y capas de responsabilidad (*core*, *features*, *shared*, *worker*):

```text
frontend/
├── e2e/                             # Pruebas End-to-End con Playwright
│   ├── datos.ts                     # Constantes y estados de autenticación E2E
│   ├── sesion.setup.ts              # Setup global de sesión para E2E
│   ├── toma-fisica.e2e.ts           # Pruebas E2E de inventario físico
│   ├── usuarios.ts                  # Utilidades de usuario para E2E
│   └── valorizacion.e2e.ts          # Pruebas E2E de valorización y kardex
├── public/                          # Activos estáticos públicos (logos, favicons, cabeceras)
│   ├── _headers                     # Cabeceras de seguridad para Cloudflare Pages/Workers
│   ├── favicon.avif
│   ├── logo-frikitec-blanco.png
│   └── logo-frikitec-negro.png
├── src/
│   ├── app/
│   │   ├── core/                    # Servicios globales, seguridad, HTTP y layout base
│   │   │   ├── auth/                # Servicio de autenticación y Route Guards
│   │   │   │   ├── auth.guard.ts    # Guard de activación que valida sesión activa
│   │   │   │   └── auth.service.ts  # Manejo de credenciales, refresh token, usuario activo
│   │   │   ├── http/                # Infraestructura de comunicación con el Backend
│   │   │   │   ├── queries/
│   │   │   │   │   └── consultas.ts # Definiciones de queryOptions de TanStack Query
│   │   │   │   ├── api-client.ts    # Envoltorio de HttpClient tipado con esquemas Valibot
│   │   │   │   ├── claves.ts        # Jerarquía estandarizada de queryKeys para TanStack
│   │   │   │   ├── cookies.ts       # Utilidad para lectura de cookies seguras (CSRF)
│   │   │   │   └── interceptores.ts # Interceptor HTTP: refresco automático de token y CSRF
│   │   │   └── layout/              # Componente estructural de la aplicación (Shell)
│   │   │       ├── layout.component.ts   # Sidebar colapsable, menú responsive y sesión
│   │   │       ├── layout.component.html
│   │   │       └── layout.component.css
│   │   ├── features/                # Módulos y vistas de negocio
│   │   │   ├── auth/login/          # Inicio de sesión y visor de licencias
│   │   │   ├── dashboard/           # Panel de métricas, KPIs y gráficos de distribución
│   │   │   ├── guias-remision/      # Guías de remisión (SUNAT), escaneo e impresión
│   │   │   ├── kardex/              # Kardex valorizado continuo y registro de movimientos
│   │   │   │   └── components/
│   │   │   │       └── kardex-movimiento-modal/ # Modal de registro directo de movimiento
│   │   │   ├── maestros/            # Configuración de datos maestros (RUC, sucursales)
│   │   │   │   ├── almacenes/       # CRUD de almacenes físicos y virtuales
│   │   │   │   ├── empresa/         # Datos fiscales de la empresa y validación RUC
│   │   │   │   ├── proveedores/     # Directorio de proveedores con validación RUC/DNI
│   │   │   │   └── maestros.component.ts # Contenedor tabulado de maestros
│   │   │   ├── movimientos/         # Libro diario de movimientos y filtro por documento
│   │   │   ├── ordenes/             # Órdenes de compra: ciclo de vida, aprobación y recepción
│   │   │   │   ├── buscador-producto-orden.component.ts # Buscador predictivo de productos
│   │   │   │   ├── ordenes.api.ts   # Servicios HTTP específicos de órdenes y recepciones
│   │   │   │   └── ordenes.component.ts
│   │   │   ├── productos/           # Catálogo maestro de productos
│   │   │   │   ├── importar-productos/ # Asistente de importación por lotes (Excel/archivo)
│   │   │   │   └── productos.component.ts
│   │   │   ├── toma-fisica/         # Auditorías de inventario físico y conciliación
│   │   │   │   ├── toma-fisica-detalle.component.ts
│   │   │   │   ├── toma-fisica-lista.component.ts
│   │   │   │   └── toma-fisica.api.ts
│   │   │   └── usuarios/            # Control de accesos, roles y cargos de usuarios
│   │   │       ├── components/
│   │   │       │   └── usuario-form/ # Formulario modal de creación/edición de usuario
│   │   │       └── usuarios.component.ts
│   │   ├── shared/                  # Recursos transversales reutilizables
│   │   │   ├── catalogos/           # Catálogos de constantes y tipos de negocio
│   │   │   │   ├── categorias.ts    # Listado oficial de categorías de productos
│   │   │   │   ├── movimientos.ts   # Tipos de movimiento (compra, venta, ajustes, etc.)
│   │   │   │   └── usuarios.ts      # Roles (Superadmin, Admin, Trabajador) y reglas
│   │   │   ├── components/          # Componentes visuales desacoplados
│   │   │   │   ├── barcode/         # Renderizador de código de barras SVG con JsBarcode
│   │   │   │   ├── buscador-proveedor/ # Autocompletado de proveedores
│   │   │   │   ├── dialogo-codigo-barras/ # Modal de vista/impresión de código de barras
│   │   │   │   ├── dialogo-confirmacion/ # Modal de confirmación de acciones destructivas
│   │   │   │   ├── grafico/         # Wrapper de Chart.js con paleta corporativa
│   │   │   │   └── paginador/       # Paginador responsive con selector de tamaño
│   │   │   └── schemas/
│   │   │       └── api.schema.ts    # Contratos y esquemas de validación Valibot
│   │   ├── app.component.ts         # Componente raíz (`<router-outlet>`)
│   │   ├── app.config.ts            # Configuración de proveedores (HTTP, Router, QueryClient)
│   │   └── app.routes.ts            # Definición centralizada de rutas y Lazy Loading
│   ├── testing/                     # Configuración y utilidades para tests unitarios
│   ├── worker/                      # Cloudflare Worker proxy de API en Edge
│   │   ├── proxy-api.ts             # Redirección de `/api/*` hacia el backend con firma
│   │   └── proxy-api.spec.ts
│   ├── index.html                   # HTML base
│   ├── main.ts                      # Punto de entrada de la aplicación Angular
│   └── styles.css                   # Importaciones base de Tailwind CSS y tipografías
├── angular.json                     # Configuración del CLI de Angular y presupuestos (budgets)
├── biome.json                       # Reglas de linting y formateo con Biome
├── package.json                     # Dependencias y scripts de ejecución
├── playwright.config.ts             # Configuración de pruebas E2E y servidor de pruebas
├── proxy.conf.json                  # Proxy de desarrollo local (`/api` -> `localhost:5000`)
├── tailwind.config.js               # Configuración de diseño, fuentes y paleta de colores
├── tsconfig.app.json                # Configuración de TypeScript para la aplicación
├── tsconfig.json                    # Configuración base de TypeScript
├── tsconfig.spec.json               # Configuración de TypeScript para Vitest
└── wrangler.jsonc                   # Configuración para despliegue en Cloudflare Workers
```

---

## Librerías y Dependencias

A continuación se detallan las librerías principales utilizadas en el proyecto y su propósito:

### Dependencias de Producción (`dependencies`)

| Librería | Versión | Propósito / Uso en el Proyecto |
|---|---|---|
| **`@angular/core`** y módulos oficiales | `~22.2.1` | Núcleo del framework Angular (rutas, formularios reactivos, cliente HTTP, renderizado con Signals). |
| **`@tanstack/angular-query-experimental`** | `^5.103.2` | Manejo avanzado del estado asíncrono y del servidor: caché en memoria, revalidación automática, paginación continua (`keepPreviousData`), mutaciones e invalidación de claves. |
| **`valibot`** | `^1.5.0` | Validación modular y liviana de esquemas de datos en tiempo de ejecución. Valida que las respuestas de la API cumplan con los contratos esperados (`api.schema.ts`). |
| **`@lucide/angular`** | `^1.47.0` | Sistema de iconos SVG consistentes, limpios y accesibles a través de `LucideDynamicIcon` e importaciones independientes tree-shakable. |
| **`chart.js`** | `4.5.1` | Renderizado de gráficos interactivos en el Dashboard (análisis por categoría, marca, evolución mensual y nivel de existencias). |
| **`jsbarcode`** | `^3.12.3` | Generación de códigos de barras (formato Code 128 / EAN) directamente en elementos SVG en el navegador para etiquetas y productos. |
| **`@zxing/browser`** | `^0.2.1` | Escaneo y decodificación de códigos de barras y códigos QR en tiempo real mediante la cámara del dispositivo para guías y tomas físicas. |
| **`@fontsource/rubik`** | `^5.3.0` | Fuente sans-serif moderna para el cuerpo de texto, empaquetada como asset local para evitar peticiones externas. |
| **`@fontsource/tomorrow`** | `^5.3.0` | Tipografía de identidad industrial y tecnológica usada en títulos y encabezados de la aplicación. |
| **`rxjs`** | `~7.8.0` | Utilidades reactivas auxiliares (interoperabilidad con Signals, debouncing en búsquedas, interceptores HTTP). |
| **`zone.js`** | `~0.15.1` | Detección de cambios de Angular configurada con coalescencia de eventos (`eventCoalescing: true`). |

### Dependencias de Desarrollo (`devDependencies`)

| Herramienta | Versión | Propósito |
|---|---|---|
| **`@angular/build`** / **`@angular/cli`** | `~22.2.0` | Build system moderno basado en esbuild/Vite (`@angular/build:application`) con presupuestos estrictos de tamaño. |
| **`tailwindcss`** & **`postcss`** | `^3.4.15` / `^8.5.28` | Motor de estilos utilitarios con soporte para variables de marca y diseño responsivo. |
| **`@biomejs/biome`** | `^2.5.14` | Linter y formateador ultrarrápido configurado con sangría de tabulaciones y comillas dobles. |
| **`vitest`** | `^4.0.8` | Ejecutor de pruebas unitarias de alta velocidad configurado directamente en `angular.json` con `jsdom`. |
| **`@vitest/coverage-v8`** | `4.1.11` | Reporte de cobertura de código con umbrales estrictos (mínimo 81% en líneas/sentencias y 71% en ramas). |
| **`@playwright/test`** | `^1.63.0` | Suite de pruebas E2E multi-navegador con soporte para levantar backend y frontend automáticamente. |
| **`typescript`** | `~6.0.3` | Compilador de TypeScript con verificación estricta (`strict: true`, `strictTemplates: true`). |

---

## Patrones de Arquitectura y Buenas Prácticas

### 1. Componentes Standalone y `ChangeDetectionStrategy.OnPush`
Todos los componentes prescinden de `NgModule`. Se declaran con `imports: [...]` explícitos y utilizan `ChangeDetectionStrategy.OnPush` para maximizar el rendimiento y minimizar ciclos de renderizado innecesarios.

### 2. Angular Signals como Estándar Reactivo
Se prioriza el uso de la API de Signals nativa de Angular:
- **`signal<T>()`** para estado local editable (filtros, banderas de modales, páginas).
- **`computed()`** para valores derivados (totales, resúmenes, nombres de usuario).
- **`toSignal()`** y **`takeUntilDestroyed()`** para convertir flujos de RxJS de manera segura ante fugas de memoria.
- **`input()` / `input.required()` / `output()`** para la comunicación entre componentes padre e hijo.

### 3. Consumo de API Seguro con `ApiClient` + `Valibot`
En lugar de tipar llamadas HTTP mediante casts inseguros (`http.get<Tipo>()`), el frontend utiliza una clase centralizada `ApiClient` (`core/http/api-client.ts`) que procesa la respuesta a través de un validador de Valibot:
```typescript
async get<T>(url: string, esquema: v.GenericSchema<unknown, T>, parametros?: Parametros): Promise<T> {
  const respuesta = await firstValueFrom(this.http.get<unknown>(url, { params: aHttpParams(parametros) }));
  return v.parse(esquema, respuesta);
}
```
Esto garantiza que si el backend cambia la estructura de un endpoint, la aplicación detecta el error inmediatamente de forma controlada sin provocar comportamientos indefinidos en la interfaz.

### 4. Gestión de Caché con TanStack Query
- **`consultas.ts`**: Centraliza todas las funciones `queryOptions(...)` para asegurar consistencia en parámetros y tiempos de vida (`staleTime`).
- **`claves.ts`**: Provee una factoría estructurada de claves (`claves.productos.pagina(...)`, `claves.kardex.producto(...)`) que permite invalidar cachés con precisión milimétrica tras mutaciones.
- Paginación fluida mediante `placeholderData: keepPreviousData`, evitando parpadeos al navegar entre páginas de una tabla.

---

## Módulos y Funcionalidades (Features)

1. **Dashboard (`features/dashboard`)**:
   - Resumen ejecutivo de inventario: valor total monetizado, unidades totales, conteo de productos activos, alertas de stock bajo y productos sin rotación.
   - Gráficos interactivos de barras por categoría y marca con cálculo de concentración de Pareto.
   - Desglose de existencias por almacén (agotados, sanos y por reponer).
   - Evolución mensual de entradas vs. salidas y tabla de productos más valorizados.

2. **Productos (`features/productos`)**:
   - Catálogo con búsqueda predictiva por nombre/SKU y filtro de productos sin valorizar.
   - Creación y edición con campos de SKU, marca, categoría, variante, código de barras y precios.
   - Asistente de importación masiva por Excel (`importar-productos`) con visualización de incidencias, advertencias y registros actualizados.
   - Generación instantánea de código de barras para impresión.

3. **Kardex Valorizado (`features/kardex`)**:
   - Implementación del registro de inventario permanente valorizado conforme a normativa SUNAT (método de costo promedio ponderado).
   - Selector dinámico de almacén y producto.
   - Modal de registro rápido para compras, ventas, transferencias y ajustes de inventario (`kardex-movimiento-modal`).

4. **Movimientos (`features/movimientos`)**:
   - Libro diario completo de movimientos de almacén.
   - Filtros combinados por rango de fechas, almacén, tipo de movimiento y documento respaldatorio (Factura, Boleta, Guía, etc.).

5. **Toma Física (`features/toma-fisica`)**:
   - Registro de inventarios físicos periódicos por almacén.
   - Conteo ciego y comparativo automático contra el stock teórico del sistema.
   - Identificación de diferencias (sobrantes y faltantes) con valoración económica.
   - Cierre y contabilización del ajuste de inventario con trazabilidad.

6. **Guías de Remisión (`features/guias-remision`)**:
   - Registro y emisión de guías de remisión de traslado entre almacenes o recepción de proveedores.
   - Control de peso bruto total, datos del transportista (conductor, DNI, placa vehicular) y motivo de traslado.
   - Escáner integrado por cámara con `@zxing/browser` para agregar productos leyendo su código de barras físico.
   - Anulación controlada con registro obligatorio de motivo.

7. **Órdenes de Compra (`features/ordenes`)**:
   - Flujo integral de abastecimiento: `BORRADOR` → `PENDIENTE_APROBACION` → `APROBADA` → `EMITIDA` → `RECEPCIÓN`.
   - Soporte para versiones y control de cambios en la orden.
   - Matriz de aprobaciones según cargos organizacionales.
   - Módulo de recepción física de mercadería con registro de cantidades aceptadas vs. rechazadas y motivos de rechazo.

8. **Maestros (`features/maestros`)**:
   - **Almacenes:** Creación y activación de sedes, código de establecimiento SUNAT y control de stock activo.
   - **Proveedores:** Directorio comercial con validación de algoritmos de RUC (11 dígitos con dígito verificador ponderado) y DNI.
   - **Empresa:** Mantenimiento de datos fiscales (RUC, razón social, dirección fiscal, ubigeo, contacto).

9. **Usuarios (`features/usuarios`)**:
   - Administración de credenciales, roles (`SUPERADMIN`, `ADMIN`, `TRABAJADOR`) y asignación de cargos.
   - Activación y desactivación de cuentas con protección de sesión.

---

## Componentes Reutilizables (Shared)

- **`BarcodeComponent` (`shared/components/barcode`)**: Renderiza un elemento `<svg>` con el código de barras usando JsBarcode, con ajuste de dimensiones y soporte para temas transparentes.
- **`BuscadorProveedorComponent` (`shared/components/buscador-proveedor`)**: Campo de autocompletado que implementa `ControlValueAccessor` (compatible con Formularios Reactivos) para buscar proveedores por RUC o razón social con normalización de acentos.
- **`DialogoCodigoBarrasComponent` (`shared/components/dialogo-codigo-barras`)**: Diálogo modal accesible (cierre con `Escape`) para previsualizar e imprimir el código de barras de un producto.
- **`DialogoConfirmacionComponent` (`shared/components/dialogo-confirmacion`)**: Modal reutilizable para confirmaciones críticas con botón de acción destructiva destacado.
- **`GraficoComponent` (`shared/components/grafico`)**: Contenedor para Chart.js que administra el ciclo de vida del canvas, aplica fuentes corporativas y gestiona la paleta de colores.
- **`PaginadorComponent` (`shared/components/paginador`)**: Paginador con controles de navegación, cálculo automático de páginas totales y sincronización de tamaño de página por tabla mediante el servicio singleton `TamanosDePagina`.

---

## Manejo de API, Autenticación y Seguridad

1. **Sesión por Cookies Seguras:**
   - La autenticación utiliza cookies seguras HTTP-only (`access_token_cookie` y `refresh_token_cookie`) gestionadas por el navegador.
   - Se incluye protección CSRF mediante la cookie `csrf_access_token` enviada automáticamente en la cabecera `X-CSRF-TOKEN` para métodos mutables (`POST`, `PUT`, `PATCH`, `DELETE`).

2. **Renovación Transparente de Token (`sesionInterceptor`):**
   - Si una petición responde con un código `401 Unauthorized`, el interceptor captura el error y solicita silenciosamente un nuevo token a `/api/auth/refresh`.
   - Si la renovación es exitosa, la petición original se reintenta automáticamente con el nuevo token CSRF.
   - Si la sesión caduca definitivamente, redirige de inmediato a `/login`.

3. **Protección de Rutas (`authGuard`):**
   - El guard funcional `authGuard` comprueba la validez de la sesión llamando a `AuthService.comprobarSesion()`, bloqueando el acceso a usuarios no autenticados y redirigiéndolos al login.

---

## Enrutamiento y Navegación

Todas las rutas hijas se cargan de forma perezosa (`loadComponent` con `import()` dinámico) bajo la protección de `authGuard` y envueltas en el layout maestro:

| Ruta | Componente | Acceso |
|---|---|---|
| `/login` | `LoginComponent` | Público |
| `/` | `LayoutComponent` | Protegido (`authGuard`) |
| `/dashboard` | `DashboardComponent` | Protegido |
| `/productos` | `ProductosComponent` | Protegido |
| `/movimientos` | `MovimientosComponent` | Protegido |
| `/ordenes` | `OrdenesComponent` (modo lista) | Protegido |
| `/ordenes/nueva` | `OrdenesComponent` (modo editor) | Protegido |
| `/ordenes/:id` | `OrdenesComponent` (modo detalle) | Protegido |
| `/kardex` | `KardexComponent` | Protegido |
| `/toma-fisica` | `TomaFisicaListaComponent` | Protegido |
| `/toma-fisica/:id` | `TomaFisicaDetalleComponent` | Protegido |
| `/guias-remision` | `GuiasRemisionComponent` | Protegido |
| `/maestros/almacenes` | `AlmacenesComponent` | Protegido |
| `/maestros/proveedores` | `ProveedoresComponent` | Protegido |
| `/maestros/empresa` | `EmpresaComponent` | Protegido |
| `/usuarios` | `UsuariosComponent` | Protegido (Admin) |

---

## Scripts y Comandos

El proyecto utiliza **pnpm** como gestor de paquetes preferido (`pnpm@12.4.1`).

### Instalación de dependencias
```bash
pnpm install
```

### Servidor de desarrollo
Inicia el servidor local de Angular en `http://localhost:4200` utilizando el proxy configurado en `proxy.conf.json`:
```bash
pnpm start
# o alternativamente:
pnpm run ng serve
```

### Compilación para producción
Compila los artefactos optimizados en la carpeta `dist/frontend/browser/` aplicando presupuestos de tamaño:
```bash
pnpm run build
```

### Compilación en modo observación (watch)
```bash
pnpm run watch
```

### Verificación estricta de tipos TypeScript
Verifica tipos para la aplicación, especificaciones y E2E sin emitir código:
```bash
pnpm run typecheck
```

### Análisis estático y formateo (Biome)
Ejecuta la revisión de calidad de código y estilo:
```bash
pnpm run lint
```
Para corregir automáticamente problemas de formato e importaciones:
```bash
pnpm exec biome check --write
```

### Pruebas Unitarias (Vitest)
Ejecuta las pruebas unitarias rápidas:
```bash
# Modo interactivo
pnpm run test

# Modo CI (una sola ejecución)
pnpm run test:ci

# Con reporte de cobertura de código
pnpm run test:cobertura
```

### Pruebas End-to-End (Playwright)
Ejecuta las pruebas de extremo a extremo:
```bash
pnpm run e2e
```

---

## Despliegue y Proxy en el Edge (Cloudflare Workers)

El frontend está configurado para ejecutarse en la infraestructura de borde de **Cloudflare**:

1. **Configuración (`wrangler.jsonc`):**
   - La distribución estática (`dist/frontend/browser`) es servida como activos estáticos con fallback de SPA para enrutamiento del lado del cliente.
   - Las rutas que coinciden con `/api/*` son interceptadas por un Worker programado en `src/worker/proxy-api.ts`.

2. **Proxy de Seguridad Edge (`src/worker/proxy-api.ts`):**
   - Transfiere las peticiones hacia la URL del backend configurada (`BACKEND_URL`).
   - Propaga la dirección IP real del cliente mediante la cabecera `X-StockMaster-IP` a partir de `CF-Connecting-IP`.
   - Firma la petición al backend con una clave secreta compartida (`X-StockMaster-Proxy`), impidiendo que el backend reciba peticiones directas no autorizadas.
