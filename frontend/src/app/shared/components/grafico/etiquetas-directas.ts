import { Chart, type Plugin } from "chart.js";

import { TINTA } from "./paleta";

export function etiquetasDirectas(textos: readonly string[]): Plugin<"bar"> {
	return {
		id: "etiquetasDirectas",
		afterDatasetsDraw(grafico) {
			const { ctx } = grafico;
			ctx.save();
			ctx.font = `500 12px ${Chart.defaults.font.family}`;
			ctx.fillStyle = TINTA.cifra;
			ctx.textAlign = "left";
			ctx.textBaseline = "middle";
			grafico.getDatasetMeta(0).data.forEach((barra, i) => {
				const texto = textos[i];
				if (!texto) return;
				const { x, y } = barra.getProps(["x", "y"], true);
				ctx.fillText(texto, x + 6, y);
			});
			ctx.restore();
		},
	};
}
