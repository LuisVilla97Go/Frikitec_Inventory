export type Sentido = "ENTRADA" | "SALIDA";

export const TIPOS_MOVIMIENTO = {
	ENTRADA_COMPRA: { texto: "Compra", sentido: "ENTRADA", registrable: true },
	AJUSTE_POSITIVO: {
		texto: "Ajuste positivo (sobrante)",
		sentido: "ENTRADA",
		registrable: true,
	},
	SALIDA_VENTA: { texto: "Venta", sentido: "SALIDA", registrable: true },
	AJUSTE_NEGATIVO: {
		texto: "Ajuste negativo (merma, faltante)",
		sentido: "SALIDA",
		registrable: true,
	},
	REVALORIZACION: {
		texto: "Revalorización (corrige el costo)",
		sentido: null,
		registrable: true,
	},
	TRANSFERENCIA: {
		texto: "Transferencia",
		sentido: null,
		registrable: false,
	},
} as const satisfies Record<
	string,
	{ texto: string; sentido: Sentido | null; registrable: boolean }
>;

export type TipoMovimiento = keyof typeof TIPOS_MOVIMIENTO;

export const TIPOS_DOCUMENTO = {
	FACTURA: "Factura",
	BOLETA: "Boleta",
	GUIA_REMISION: "Guía de remisión",
	NOTA_CREDITO: "Nota de crédito",
	AJUSTE_INVENTARIO: "Acta de ajuste de inventario",
	NOTA_VENTA: "Nota de venta",
	CARGA_INICIAL: "Carga inicial",
} as const satisfies Record<string, string>;

export type TipoDocumento = keyof typeof TIPOS_DOCUMENTO;

export const DOCUMENTOS_REGISTRABLES: readonly TipoDocumento[] = [
	"FACTURA",
	"BOLETA",
	"NOTA_VENTA",
	"GUIA_REMISION",
	"NOTA_CREDITO",
	"AJUSTE_INVENTARIO",
];

export function opcionesDeTipo(
	filtro: (tipo: (typeof TIPOS_MOVIMIENTO)[TipoMovimiento]) => boolean = () =>
		true,
): { valor: TipoMovimiento; texto: string }[] {
	return (Object.keys(TIPOS_MOVIMIENTO) as TipoMovimiento[])
		.filter((valor) => filtro(TIPOS_MOVIMIENTO[valor]))
		.map((valor) => ({ valor, texto: TIPOS_MOVIMIENTO[valor].texto }));
}
