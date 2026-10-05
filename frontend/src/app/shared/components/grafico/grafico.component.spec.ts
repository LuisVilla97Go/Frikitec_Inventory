import { Component, signal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { ChartConfiguration } from "chart.js";

import {
	CREAR_GRAFICO,
	GraficoComponent,
	type GraficoDibujado,
} from "./grafico.component";

const barras = (datos: number[]): ChartConfiguration => ({
	type: "bar",
	data: { labels: datos.map(String), datasets: [{ label: "x", data: datos }] },
	options: {},
});

@Component({
	imports: [GraficoComponent],
	template: `@if (visible()) {
		<app-grafico [configuracion]="config()" etiqueta="Ventas" />
	}`,
})
class Anfitrion {
	readonly config = signal(barras([1, 2]));
	readonly visible = signal(true);
}

async function pintar(fixture: ComponentFixture<Anfitrion>) {
	fixture.detectChanges();
	await fixture.whenStable();
}

describe("GraficoComponent", () => {
	let creados: { lienzo: HTMLCanvasElement; grafico: GraficoDibujado }[];

	beforeEach(() => {
		creados = [];
		TestBed.configureTestingModule({
			providers: [
				{
					provide: CREAR_GRAFICO,
					useValue: (lienzo: HTMLCanvasElement, config: ChartConfiguration) => {
						const grafico: GraficoDibujado = {
							data: config.data,
							options: config.options,
							update: vi.fn(),
							destroy: vi.fn(),
						};
						creados.push({ lienzo, grafico });
						return grafico;
					},
				},
			],
		});
	});

	it("crea el gráfico en su canvas, con la etiqueta accesible", async () => {
		const fixture = TestBed.createComponent(Anfitrion);
		await pintar(fixture);

		expect(creados).toHaveLength(1);
		const lienzo = fixture.nativeElement.querySelector("canvas");
		expect(creados[0].lienzo).toBe(lienzo);
		expect(lienzo.getAttribute("role")).toBe("img");
		expect(lienzo.getAttribute("aria-label")).toBe("Ventas");
	});

	it("al cambiar la configuración actualiza el mismo gráfico", async () => {
		const fixture = TestBed.createComponent(Anfitrion);
		await pintar(fixture);

		fixture.componentInstance.config.set(barras([3, 4, 5]));
		await pintar(fixture);

		expect(creados).toHaveLength(1);
		const { grafico } = creados[0];
		expect(grafico.update).toHaveBeenCalledTimes(1);
		expect(grafico.data.datasets[0].data).toEqual([3, 4, 5]);
	});

	it("con plugins propios lo recrea, para no dejar etiquetas con cifras viejas", async () => {
		const fixture = TestBed.createComponent(Anfitrion);
		await pintar(fixture);

		const conEtiquetas = barras([7]);
		conEtiquetas.plugins = [{ id: "etiquetasDirectas" }];
		fixture.componentInstance.config.set(conEtiquetas);
		await pintar(fixture);

		expect(creados).toHaveLength(2);
		expect(creados[0].grafico.destroy).toHaveBeenCalledTimes(1);
		expect(creados[0].grafico.update).not.toHaveBeenCalled();
	});

	it("destruye el gráfico al salir de la pantalla", async () => {
		const fixture = TestBed.createComponent(Anfitrion);
		await pintar(fixture);

		fixture.componentInstance.visible.set(false);
		await pintar(fixture);

		expect(creados[0].grafico.destroy).toHaveBeenCalledTimes(1);
	});
});
