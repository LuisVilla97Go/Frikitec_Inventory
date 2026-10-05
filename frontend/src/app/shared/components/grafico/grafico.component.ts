import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	type ElementRef,
	InjectionToken,
	inject,
	input,
	viewChild,
} from "@angular/core";
import {
	BarController,
	BarElement,
	CategoryScale,
	Chart,
	type ChartConfiguration,
	Legend,
	LinearScale,
	Tooltip,
} from "chart.js";
import { TINTA } from "./paleta";

Chart.register(
	BarController,
	BarElement,
	CategoryScale,
	LinearScale,
	Tooltip,
	Legend,
);
Chart.defaults.font.family = "Rubik, sans-serif";
Chart.defaults.color = TINTA.texto;
Chart.defaults.borderColor = TINTA.rejilla;

export interface GraficoDibujado {
	data: ChartConfiguration["data"];
	options: ChartConfiguration["options"];
	update(): void;
	destroy(): void;
}

export const CREAR_GRAFICO = new InjectionToken<
	(lienzo: HTMLCanvasElement, config: ChartConfiguration) => GraficoDibujado
>("CREAR_GRAFICO", {
	providedIn: "root",
	factory: () => (lienzo, config) => new Chart(lienzo, config),
});

@Component({
	selector: "app-grafico",
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./grafico.component.html",
	host: { class: "relative block" },
})
export class GraficoComponent {
	readonly configuracion = input.required<ChartConfiguration>();

	readonly etiqueta = input.required<string>();

	private readonly lienzo =
		viewChild.required<ElementRef<HTMLCanvasElement>>("lienzo");
	private readonly crear = inject(CREAR_GRAFICO);
	private grafico: GraficoDibujado | undefined;

	constructor() {
		afterRenderEffect(() => {
			const config = this.configuracion();
			if (this.grafico && !config.plugins?.length) {
				this.grafico.data = config.data;
				this.grafico.options = config.options;
				this.grafico.update();
				return;
			}
			this.grafico?.destroy();
			this.grafico = this.crear(this.lienzo().nativeElement, config);
		});
		inject(DestroyRef).onDestroy(() => this.grafico?.destroy());
	}
}
