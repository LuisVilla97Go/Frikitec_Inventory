import type { FiltrosLibroDiario } from "./queries/consultas";

export const claves = {
	productos: {
		todo: ["productos"] as const,
		pagina: (
			page: number,
			perPage: number,
			search: string,
			sinCosto: boolean,
		) => ["productos", "pagina", { page, perPage, search, sinCosto }] as const,
		sugerencias: (campo: string, q: string, categoria: string) =>
			["productos", "sugerencias", { campo, q, categoria }] as const,
	},
	kardex: {
		todo: ["kardex"] as const,
		producto: (productoId: string, almacenId: string) =>
			["kardex", productoId, almacenId] as const,
	},
	libroDiario: {
		todo: ["libro-diario"] as const,
		pagina: (filtros: FiltrosLibroDiario) =>
			["libro-diario", "pagina", filtros] as const,
	},
	dashboard: ["dashboard", "resumen"] as const,
	almacenes: ["almacenes"] as const,
	almacenesTodos: ["almacenes", "todos"] as const,
	proveedores: ["proveedores"] as const,
	proveedoresTodos: ["proveedores", "todos"] as const,
	empresa: ["empresa"] as const,
	tomasFisicas: {
		todo: ["tomas-fisicas"] as const,
		paginas: ["tomas-fisicas", "pagina"] as const,
		pagina: (page: number, perPage: number) =>
			["tomas-fisicas", "pagina", { page, perPage }] as const,
		detalle: (tomaId: string) => ["tomas-fisicas", "detalle", tomaId] as const,
	},
	usuarios: {
		todo: ["usuarios"] as const,
		pagina: (page: number, perPage: number) =>
			["usuarios", "pagina", page, perPage] as const,
	},
	guias: {
		todo: ["guias-remision"] as const,
		pagina: (page: number, perPage: number) =>
			["guias-remision", "pagina", { page, perPage }] as const,
		detalle: (guiaId: string) => ["guias-remision", "detalle", guiaId] as const,
		stock: (almacenId: string, productoIds: readonly string[]) =>
			["guias-remision", "stock", almacenId, [...productoIds].sort()] as const,
	},
	ordenes: {
		todo: ["ordenes-compra"] as const,
		pagina: (page: number, perPage: number) =>
			["ordenes-compra", "pagina", { page, perPage }] as const,
		detalle: (ordenId: string) =>
			["ordenes-compra", "detalle", ordenId] as const,
	},
};
