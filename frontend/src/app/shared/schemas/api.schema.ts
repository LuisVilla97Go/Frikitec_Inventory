import * as v from "valibot";

import {
	TIPOS_DOCUMENTO,
	TIPOS_MOVIMIENTO,
	type TipoDocumento,
	type TipoMovimiento,
} from "../catalogos/movimientos";
import { LISTA_ROLES } from "../catalogos/usuarios";

export const Dinero = v.pipe(
	v.union([v.string(), v.number()]),
	v.transform(Number),
	v.number(),
);

export function Paginado<T extends v.GenericSchema>(item: T) {
	return v.object({
		data: v.array(item),
		page: v.number(),
		per_page: v.number(),
		total: v.number(),
	});
}

export function ConDatos<T extends v.GenericSchema>(item: T) {
	return v.object({ data: item });
}

// Sesión

export const UsuarioSesion = v.object({
	id: v.string(),
	nombre: v.string(),
	email: v.string(),
	rol: v.picklist(LISTA_ROLES),
	cargo: v.nullable(v.string()),
	is_admin: v.boolean(), // derivado del rol en el backend
});
export type UsuarioSesion = v.InferOutput<typeof UsuarioSesion>;

export const RespuestaSesion = v.object({ user: UsuarioSesion });

// Productos

export const Producto = v.object({
	id: v.string(),
	sku: v.string(),
	name: v.string(),
	category: v.string(),
	sub_category: v.nullable(v.string()),
	variant: v.nullable(v.string()),
	barcode: v.nullable(v.string()),
	brand: v.string(),
	purchase_price: Dinero,
	sale_price: Dinero,
	has_movements: v.boolean(),
	unvalued_stock: v.boolean(),
});
export type Producto = v.InferOutput<typeof Producto>;

export const PaginaProductos = Paginado(Producto);
export type PaginaProductos = v.InferOutput<typeof PaginaProductos>;

export const IncidenciaImportacion = v.object({
	fila: v.nullable(v.number()),
	columna: v.nullable(v.string()),
	mensaje: v.string(),
});
export type IncidenciaImportacion = v.InferOutput<typeof IncidenciaImportacion>;

export const ResumenImportacion = v.object({
	nuevos: v.number(),
	actualizados: v.number(),
	sin_cambios: v.number(),
	total_errores: v.number(),
	total_avisos: v.number(),
	errores: v.array(IncidenciaImportacion),
	avisos: v.array(IncidenciaImportacion),
});
export type ResumenImportacion = v.InferOutput<typeof ResumenImportacion>;

// Kardex

export const MovimientoKardex = v.object({
	id: v.string(),
	date: v.string(),
	docType: v.string(),
	docNumber: v.string(),
	purchaseOrderNumber: v.optional(v.nullable(v.string())),
	purchaseOrderId: v.optional(v.nullable(v.string())),
	detail: v.string(),
	warehouse: v.string(),
	type: v.picklist(["ENTRADA", "SALIDA"]),
	qty: v.number(),
	unitCost: Dinero,
	amount: Dinero,
	balanceQty: v.number(),
	balanceCost: Dinero,
	balanceValue: Dinero,
});
export type MovimientoKardex = v.InferOutput<typeof MovimientoKardex>;

export const Kardex = v.object({
	id: v.string(),
	sku: v.string(),
	name: v.string(),
	category: v.string(),
	unit: v.string(),
	location: v.string(),
	minStock: v.number(),
	warehouses: v.array(v.object({ id: v.string(), name: v.string() })),
	warehouseId: v.nullable(v.string()),
	movements: v.array(MovimientoKardex),
});
export type Kardex = v.InferOutput<typeof Kardex>;

// Libro diario

export const MovimientoDiario = v.object({
	id: v.string(),
	date: v.string(),
	movementType: v.picklist(
		Object.keys(TIPOS_MOVIMIENTO) as [TipoMovimiento, ...TipoMovimiento[]],
	),
	docType: v.picklist(
		Object.keys(TIPOS_DOCUMENTO) as [TipoDocumento, ...TipoDocumento[]],
	),
	docNumber: v.string(),
	purchaseOrderNumber: v.optional(v.nullable(v.string())),
	purchaseOrderId: v.optional(v.nullable(v.string())),
	productId: v.string(),
	sku: v.string(),
	productName: v.string(),
	warehouseId: v.string(),
	warehouse: v.string(),
	qty: v.number(),
	balance: v.number(),
	unitCost: Dinero,
	currency: v.string(),
	user: v.string(),
});
export type MovimientoDiario = v.InferOutput<typeof MovimientoDiario>;

export const PaginaLibroDiario = Paginado(MovimientoDiario);
export type PaginaLibroDiario = v.InferOutput<typeof PaginaLibroDiario>;


const GrupoDashboard = v.object({
	nombre: v.string(),
	productos: v.number(),
	unidades: v.number(),
	valor: Dinero,
	participacion: Dinero,
	destacado: v.boolean(),
	otras: v.boolean(),
});

const Concentracion = v.nullable(
	v.object({
		grupos: v.number(),
		de: v.number(),
		participacion: Dinero,
		umbral: Dinero,
	}),
);

export const ResumenDashboard = v.object({
	umbral_stock_bajo: v.number(),
	indicadores: v.object({
		valor_inventario: Dinero,
		unidades: v.number(),
		productos_activos: v.number(),
		productos_con_stock: v.number(),
		categorias: v.number(),
		marcas: v.number(),
		filas_por_reponer: v.number(),
		productos_por_reponer: v.number(),
		productos_sin_historia: v.number(),
	}),
	por_categoria: v.array(GrupoDashboard),
	por_marca: v.array(GrupoDashboard),
	concentracion_categorias: Concentracion,
	concentracion_marcas: Concentracion,
	por_almacen: v.array(
		v.object({
			id: v.string(),
			nombre: v.string(),
			unidades: v.number(),
			valor: Dinero,
			agotados: v.number(),
			por_reponer: v.number(),
			sanos: v.number(),
			participacion: Dinero,
		}),
	),
	movimientos_por_mes: v.array(
		v.object({
			mes: v.string(),
			entradas: v.number(),
			salidas: v.number(),
			movimientos: v.number(),
		}),
	),
	top_productos: v.array(
		v.object({
			id: v.string(),
			sku: v.string(),
			nombre: v.string(),
			categoria: v.string(),
			unidades: v.number(),
			valor: Dinero,
		}),
	),
});
export type ResumenDashboard = v.InferOutput<typeof ResumenDashboard>;

// GR

export const GuiaDetalleRequest = v.object({
	producto_id: v.string(),
	cantidad: v.pipe(v.number(), v.minValue(1, "La cantidad debe ser mayor a 0")),
});
export type GuiaDetalleRequest = v.InferOutput<typeof GuiaDetalleRequest>;

export const GuiaRemisionRequest = v.object({
	motivo_traslado: v.string(),
	almacen_origen_id: v.nullable(v.string()),
	almacen_destino_id: v.string(),
	proveedor_id: v.nullable(v.string()),
	fecha_traslado: v.string(),
	peso_bruto_total: v.pipe(
		v.number(),
		v.minValue(0, "El peso no puede ser negativo"),
	),
	conductor_nombre: v.nullable(v.string()),
	conductor_dni: v.nullable(v.string()),
	vehiculo_placa: v.nullable(v.string()),
	detalles: v.pipe(
		v.array(GuiaDetalleRequest),
		v.minLength(1, "Debe agregar al menos un producto"),
	),
});
export type GuiaRemisionRequest = v.InferOutput<typeof GuiaRemisionRequest>;

export const GuiaCreada = v.object({
	id: v.string(),
	numero_guia: v.string(),
	estado: v.string(),
});
export type GuiaCreada = v.InferOutput<typeof GuiaCreada>;

export const GuiaDetalle = v.object({
	producto_id: v.string(),
	producto_sku: v.string(),
	producto_nombre: v.string(),
	cantidad: v.number(),
});
export type GuiaDetalle = v.InferOutput<typeof GuiaDetalle>;

export const GuiaResumen = v.object({
	id: v.string(),
	numero_guia: v.string(),
	fecha_traslado: v.string(),
	motivo_traslado: v.string(),
	estado: v.string(),
	origen: v.string(),
	destino: v.string(),
	total_items: v.number(),
	total_unidades: v.number(),
});
export type GuiaResumen = v.InferOutput<typeof GuiaResumen>;

export const GuiaCompleta = v.object({
	...GuiaResumen.entries,
	almacen_origen_id: v.nullable(v.string()),
	almacen_destino_id: v.string(),
	proveedor_id: v.nullable(v.string()),
	proveedor_documento: v.nullable(v.string()),
	peso_bruto_total: v.pipe(
		v.union([v.string(), v.number()]),
		v.transform(Number),
	),
	conductor_nombre: v.nullable(v.string()),
	conductor_dni: v.nullable(v.string()),
	vehiculo_placa: v.nullable(v.string()),
	motivo_anulacion: v.nullable(v.string()),
	anulada_en: v.nullable(v.string()),
	detalles: v.array(GuiaDetalle),
});
export type GuiaCompleta = v.InferOutput<typeof GuiaCompleta>;

export const PaginaGuias = Paginado(GuiaResumen);
export type PaginaGuias = v.InferOutput<typeof PaginaGuias>;

export const StockDisponible = v.object({
	producto_id: v.string(),
	stock: v.number(),
});
export type StockDisponible = v.InferOutput<typeof StockDisponible>;

// Almacenes y sucursales

export const Almacen = v.object({
	id: v.string(),
	nombre: v.string(),
	ubicacion: v.nullable(v.string()),
});
export type Almacen = v.InferOutput<typeof Almacen>;

export const AlmacenMaestro = v.object({
	...Almacen.entries,
	codigo_establecimiento: v.nullable(v.string()),
	is_active: v.boolean(),
	stock: v.number(),
});
export type AlmacenMaestro = v.InferOutput<typeof AlmacenMaestro>;

// Proveedor con maestro
export const Proveedor = v.object({
	id: v.string(),
	tipo_documento: v.picklist(["RUC", "DNI"]),
	numero_documento: v.string(),
	razon_social: v.string(),
	nombre_comercial: v.nullable(v.string()),
	contacto: v.nullable(v.string()),
	telefono: v.nullable(v.string()),
	correo: v.nullable(v.string()),
	is_active: v.boolean(),
});
export type Proveedor = v.InferOutput<typeof Proveedor>;

export const ProveedorMaestro = Proveedor;
export type ProveedorMaestro = Proveedor;

export const Empresa = v.object({
	ruc: v.string(),
	razon_social: v.string(),
	nombre_comercial: v.nullable(v.string()),
	direccion_fiscal: v.nullable(v.string()),
	ubigeo: v.nullable(v.string()),
	distrito: v.nullable(v.string()),
	provincia: v.nullable(v.string()),
	departamento: v.nullable(v.string()),
	telefono: v.nullable(v.string()),
	correo: v.nullable(v.string()),
	web: v.nullable(v.string()),
	updated_at: v.string(),
});
export type Empresa = v.InferOutput<typeof Empresa>;

export const ESTADOS_TOMA_FISICA = [
	"ABIERTO",
	"CONTABILIZADO",
	"ANULADO",
] as const;
export type EstadoTomaFisica = (typeof ESTADOS_TOMA_FISICA)[number];

export const LineaTomaFisica = v.object({
	id: v.string(),
	producto_id: v.string(),
	sku: v.string(),
	producto: v.string(),
	cantidad_contada: v.nullable(v.number()),
	contado_en: v.nullable(v.string()),
	stock_sistema: v.nullable(v.number()),
	diferencia: v.nullable(v.number()),
	stock_actual: v.nullable(v.number()),
	costo_unitario: v.nullable(v.string()),
	valor_diferencia: v.nullable(v.string()),
	movimientos_despues: v.nullable(v.number()),
});
export type LineaTomaFisica = v.InferOutput<typeof LineaTomaFisica>;

export const TomaFisica = v.object({
	id: v.string(),
	numero: v.string(),
	almacen_id: v.string(),
	almacen: v.string(),
	estado: v.picklist(ESTADOS_TOMA_FISICA),
	observacion: v.nullable(v.string()),
	creado_por: v.string(),
	creado_en: v.string(),
	cerrado_por: v.nullable(v.string()),
	cerrado_en: v.nullable(v.string()),
	motivo_anulacion: v.nullable(v.string()),
	productos: v.number(),
	contados: v.number(),
	valor_diferencia: v.nullable(v.string()),
	lineas: v.nullable(v.array(LineaTomaFisica)),
});
export type TomaFisica = v.InferOutput<typeof TomaFisica>;

export const PaginaTomasFisicas = v.object({
	data: v.array(TomaFisica),
	page: v.number(),
	per_page: v.number(),
	total: v.number(),
});

// OC y recepciones

export const ESTADOS_ORDEN_COMPRA = [
	"BORRADOR",
	"PENDIENTE_APROBACION",
	"APROBADA",
	"EMITIDA",
	"PARCIALMENTE_RECIBIDA",
	"RECIBIDA",
	"CERRADA_PARCIALMENTE",
	"RECHAZADA",
	"CANCELADA",
] as const;

export const OrdenCompraLinea = v.object({
	id: v.string(),
	product_id: v.string(),
	sku: v.string(),
	product_name: v.string(),
	warehouse_id: v.string(),
	warehouse_name: v.string(),
	quantity_ordered: v.number(),
	quantity_received: v.number(),
	quantity_closed: v.number(),
	quantity_open: v.number(),
	unit_cost: Dinero,
});
export type OrdenCompraLinea = v.InferOutput<typeof OrdenCompraLinea>;

export const AprobacionOrdenCompra = v.object({
	id: v.string(),
	stage: v.number(),
	cargo: v.string(),
	approver_id: v.string(),
	approver_name: v.string(),
	status: v.picklist(["PENDIENTE", "APROBADA", "RECHAZADA", "CANCELADA"]),
	comment: v.nullable(v.string()),
	decided_at: v.nullable(v.string()),
});
export type AprobacionOrdenCompra = v.InferOutput<typeof AprobacionOrdenCompra>;

export const VersionOrdenCompra = v.object({
	id: v.string(),
	number: v.number(),
	supplier_id: v.string(),
	supplier_document: v.string(),
	supplier_name: v.string(),
	currency: v.string(),
	exchange_rate: Dinero,
	status: v.picklist(ESTADOS_ORDEN_COMPRA),
	created_at: v.string(),
	submitted_at: v.nullable(v.string()),
	approved_at: v.nullable(v.string()),
	issued_at: v.nullable(v.string()),
	cancellation_reason: v.nullable(v.string()),
	lines: v.array(OrdenCompraLinea),
	approvals: v.array(AprobacionOrdenCompra),
});
export type VersionOrdenCompra = v.InferOutput<typeof VersionOrdenCompra>;

export const LineaRecepcionCompra = v.object({
	id: v.string(),
	order_line_id: v.string(),
	sku: v.string(),
	product_name: v.string(),
	warehouse_id: v.string(),
	warehouse_name: v.string(),
	quantity_accepted: v.number(),
	quantity_rejected: v.number(),
	rejection_reason: v.nullable(v.string()),
	unit_cost: Dinero,
});

export const RecepcionCompra = v.object({
	id: v.string(),
	status: v.picklist(["BORRADOR", "CONTABILIZADA"]),
	arrival_date: v.string(),
	guide_number: v.nullable(v.string()),
	guide_date: v.nullable(v.string()),
	invoice_number: v.nullable(v.string()),
	invoice_date: v.nullable(v.string()),
	posted_at: v.nullable(v.string()),
	posted_by_id: v.nullable(v.string()),
	created_at: v.string(),
	created_by_id: v.string(),
	lines: v.array(LineaRecepcionCompra),
});
export type RecepcionCompra = v.InferOutput<typeof RecepcionCompra>;

export const OrdenCompraResumen = v.object({
	id: v.string(),
	number: v.string(),
	status: v.picklist(ESTADOS_ORDEN_COMPRA),
	version_number: v.number(),
	created_by_id: v.string(),
	created_at: v.string(),
	supplier_name: v.string(),
});
export type OrdenCompraResumen = v.InferOutput<typeof OrdenCompraResumen>;

export const OrdenCompraDetalle = v.object({
	...OrdenCompraResumen.entries,
	version: VersionOrdenCompra,
	versions: v.array(VersionOrdenCompra),
	receipts: v.array(RecepcionCompra),
});
export type OrdenCompraDetalle = v.InferOutput<typeof OrdenCompraDetalle>;

export const PaginaOrdenesCompra = Paginado(OrdenCompraResumen);
export const RespuestaOrdenCompra = ConDatos(OrdenCompraDetalle);

export const Usuario = v.object({
	id: v.string(),
	nombres: v.string(),
	apellidos: v.string(),
	email: v.string(),
	rol: v.picklist(LISTA_ROLES),
	cargo: v.nullable(v.string()),
	is_admin: v.boolean(),
	is_active: v.boolean(),
	created_at: v.string(),
});
export type Usuario = v.InferOutput<typeof Usuario>;

export const PaginaUsuarios = Paginado(Usuario);
