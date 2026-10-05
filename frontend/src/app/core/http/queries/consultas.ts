import { queryOptions } from "@tanstack/angular-query-experimental";
import * as v from "valibot";
import type { TipoMovimiento } from "../../../shared/catalogos/movimientos";
import {
	Almacen,
	AlmacenMaestro,
	ConDatos,
	Empresa,
	GuiaCompleta,
	Kardex,
	PaginaGuias,
	PaginaLibroDiario,
	PaginaOrdenesCompra,
	PaginaProductos,
	PaginaTomasFisicas,
	PaginaUsuarios,
	Proveedor,
	ProveedorMaestro,
	RespuestaOrdenCompra,
	ResumenDashboard,
	StockDisponible,
	TomaFisica,
} from "../../../shared/schemas/api.schema";
import type { ApiClient } from "../api-client";
import { claves } from "../claves";


export const paginaProductos = (
	api: ApiClient,
	page: number,
	perPage: number,
	search: string,
	sinCosto = false,
) =>
	queryOptions({
		queryKey: claves.productos.pagina(page, perPage, search, sinCosto),
		queryFn: () =>
			api.get("/api/productos", PaginaProductos, {
				page,
				per_page: perPage,
				search,
				sin_costo: sinCosto ? "true" : undefined,
			}),
	});

export type CampoSugerible = "marca" | "sub_categoria" | "variante";

export const sugerenciasDeProducto = (
	api: ApiClient,
	campo: CampoSugerible,
	q: string,
	categoria: string,
) =>
	queryOptions({
		queryKey: claves.productos.sugerencias(campo, q, categoria),
		queryFn: async () =>
			(
				await api.get(
					"/api/productos/sugerencias",
					ConDatos(v.array(v.string())),
					{ campo, q, categoria },
				)
			).data,
	});

export const kardexDeProducto = (
	api: ApiClient,
	productoId: string,
	almacenId: string,
) =>
	queryOptions({
		queryKey: claves.kardex.producto(productoId, almacenId),
		queryFn: async () =>
			(
				await api.get(
					`/api/productos/${encodeURIComponent(productoId)}/kardex`,
					ConDatos(Kardex),
					{ almacen_id: almacenId },
				)
			).data,
		enabled: productoId !== "",
	});

export interface FiltrosLibroDiario {
	page: number;
	per_page: number;
	desde: string;
	hasta: string;
	almacen_id: string;
	tipo_movimiento: TipoMovimiento | "";
	search: string;
}

export const paginaLibroDiario = (
	api: ApiClient,
	filtros: FiltrosLibroDiario,
) =>
	queryOptions({
		queryKey: claves.libroDiario.pagina(filtros),
		queryFn: () =>
			api.get("/api/movimientos", PaginaLibroDiario, { ...filtros }),
	});

export const resumenDashboard = (api: ApiClient) =>
	queryOptions({
		queryKey: claves.dashboard,
		queryFn: async () =>
			(await api.get("/api/dashboard/resumen", ConDatos(ResumenDashboard)))
				.data,
	});

export const almacenes = (api: ApiClient) =>
	queryOptions({
		queryKey: claves.almacenes,
		queryFn: async () =>
			(await api.get("/api/almacenes", ConDatos(v.array(Almacen)))).data,
		staleTime: 5 * 60_000, // cambian muy poco
	});

export const almacenesMaestro = (api: ApiClient) =>
	queryOptions({
		queryKey: claves.almacenesTodos,
		queryFn: async () =>
			(
				await api.get("/api/almacenes", ConDatos(v.array(AlmacenMaestro)), {
					todos: "true",
				})
			).data,
	});

export const proveedoresActivos = (api: ApiClient) =>
	queryOptions({
		queryKey: claves.proveedores,
		queryFn: async () =>
			(await api.get("/api/proveedores", ConDatos(v.array(Proveedor)))).data,
		staleTime: 5 * 60_000,
	});

export const paginaOrdenesCompra = (
	api: ApiClient,
	page: number,
	perPage: number,
) =>
	queryOptions({
		queryKey: claves.ordenes.pagina(page, perPage),
		queryFn: () =>
			api.get("/api/ordenes", PaginaOrdenesCompra, { page, per_page: perPage }),
	});

export const ordenCompra = (api: ApiClient, ordenId: string) =>
	queryOptions({
		queryKey: claves.ordenes.detalle(ordenId),
		queryFn: () =>
			api.get(
				`/api/ordenes/${encodeURIComponent(ordenId)}`,
				RespuestaOrdenCompra,
			),
		enabled: ordenId !== "",
	});

export const paginaTomasFisicas = (
	api: ApiClient,
	page: number,
	perPage: number,
) =>
	queryOptions({
		queryKey: claves.tomasFisicas.pagina(page, perPage),
		queryFn: () =>
			api.get("/api/tomas-fisicas", PaginaTomasFisicas, {
				page,
				per_page: perPage,
			}),
	});

export const tomaFisica = (api: ApiClient, tomaId: string) =>
	queryOptions({
		queryKey: claves.tomasFisicas.detalle(tomaId),
		queryFn: async () =>
			(
				await api.get(
					`/api/tomas-fisicas/${encodeURIComponent(tomaId)}`,
					ConDatos(TomaFisica),
				)
			).data,
		enabled: tomaId !== "",
	});

export const datosEmpresa = (api: ApiClient) =>
	queryOptions({
		queryKey: claves.empresa,
		queryFn: async () =>
			(await api.get("/api/empresa", ConDatos(v.nullable(Empresa)))).data,
		staleTime: 10 * 60_000,
	});

export const proveedoresMaestro = (api: ApiClient) =>
	queryOptions({
		queryKey: claves.proveedoresTodos,
		queryFn: async () =>
			(
				await api.get("/api/proveedores", ConDatos(v.array(ProveedorMaestro)), {
					todos: "true",
				})
			).data,
	});

export const paginaUsuarios = (api: ApiClient, page: number, perPage: number) =>
	queryOptions({
		queryKey: claves.usuarios.pagina(page, perPage),
		queryFn: () =>
			api.get("/api/usuarios", PaginaUsuarios, { page, per_page: perPage }),
	});

export const paginaGuias = (api: ApiClient, page: number, perPage: number) =>
	queryOptions({
		queryKey: claves.guias.pagina(page, perPage),
		queryFn: () =>
			api.get("/api/guias-remision", PaginaGuias, { page, per_page: perPage }),
	});

export const guiaRemision = (api: ApiClient, guiaId: string) =>
	queryOptions({
		queryKey: claves.guias.detalle(guiaId),
		queryFn: async () =>
			(
				await api.get(
					`/api/guias-remision/${encodeURIComponent(guiaId)}`,
					ConDatos(GuiaCompleta),
				)
			).data,
		enabled: guiaId !== "",
	});

export const stockDisponible = (
	api: ApiClient,
	almacenId: string,
	productoIds: readonly string[],
) =>
	queryOptions({
		queryKey: claves.guias.stock(almacenId, productoIds),
		queryFn: async () =>
			(
				await api.get(
					"/api/guias-remision/stock-disponible",
					ConDatos(v.array(StockDisponible)),
					{ almacen_id: almacenId, producto_ids: productoIds.join(",") },
				)
			).data,
	});
