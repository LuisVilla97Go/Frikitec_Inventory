import { vi } from "vitest";

export function lienzoDeTexto(): void {
	vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
		font: "",
		measureText: (texto: string) => ({ width: texto.length * 7 }),
	} as unknown as CanvasRenderingContext2D);
}
