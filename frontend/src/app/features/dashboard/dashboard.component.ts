import { DecimalPipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import {
	LucideArrowRight as ArrowRight,
	LucideBoxes as Boxes,
	LucideChartColumn as ChartColumn,
	LucideDynamicIcon,
	LucidePackageSearch as PackageSearch,
	LucidePackageX as PackageX,
	LucideRefreshCw as RefreshCw,
	LucideTable2 as Table2,
	LucideTriangleAlert as TriangleAlert,
	LucideWallet as Wallet,
} from "@lucide/angular";
import { injectQuery } from "@tanstack/angular-query-experimental";
import type { ChartConfiguration, TooltipItem } from "chart.js";

import { ApiClient } from "../../core/http/api-client";
import {
	paginaLibroDiario,
	resumenDashboard,
} from "../../core/http/queries/consultas";
import { TIPOS_MOVIMIENTO } from "../../shared/catalogos/movimientos";
import { etiquetasDirectas } from "../../shared/components/grafico/etiquetas-directas";
import { GraficoComponent } from "../../shared/components/grafico/grafico.component";
import {
	CONTEXTO,
	CONTEXTO_HOVER,
	DESTACADO,
	DESTACADO_HOVER,
	ENTRADAS,
	ESTADO,
	SALIDAS,
	TINTA,
} from "../../shared/components/grafico/paleta";
import type { ResumenDashboard } from "../../shared/schemas/api.schema";

const ULTIMOS_MOVIMIENTOS = 6;
const ALTO_POR_BARRA_PX = 26;

type GrupoDeValor = ResumenDashboard["por_categoria"][number];

const entero = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decima = new Intl.NumberFormat("en-US", {
	minimumFractionDigits: 1,
	maximumFractionDigits: 1,
});
const nombreDelMes = new Intl.DateTimeFormat("es-PE", {
	month: "short",
	year: "numeric",
	timeZone: "UTC",
});
@Component({
	selector: "app-dashboard",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DecimalPipe, RouterLink, LucideDynamicIcon, GraficoComponent],
	templateUrl: "./dashboard.component.html",
})
export class DashboardComponent {
	private readonly api = inject(ApiClient);

	protected readonly icons = {
		ArrowRight,
		Boxes,
		ChartColumn,
		PackageSearch,
		PackageX,
		RefreshCw,
		Table2,
		TriangleAlert,
		Wallet,
	};
	protected readonly tipos = TIPOS_MOVIMIENTO;
	protected readonly estado = ESTADO;

	protected readonly resumenQuery = injectQuery(() =>
		resumenDashboard(this.api),
	);
	protected readonly movimientosQuery = injectQuery(() =>
		paginaLibroDiario(this.api, {
			page: 1,
			per_page: ULTIMOS_MOVIMIENTOS,
			desde: "",
			hasta: "",
			almacen_id: "",
			tipo_movimiento: "",
			search: "",
		}),
	);

	protected readonly resumen = computed(() => this.resumenQuery.data());
	protected readonly categoriasEnTabla = signal(false);

	protected readonly sinSalidas = computed(
		() =>
			this.resumen()?.movimientos_por_mes.every((m) => m.salidas === 0) ?? true,
	);

	protected alturaDeBarras(barras: number): number {
		return Math.max(barras, 3) * ALTO_POR_BARRA_PX + 32;
	}

	protected actualizar(): void {
		void this.resumenQuery.refetch();
		void this.movimientosQuery.refetch();
	}

	private barrasDeValor(
		grupos: readonly GrupoDeValor[],
	): ChartConfiguration<"bar"> {
		const color = (g: GrupoDeValor) => (g.destacado ? DESTACADO : CONTEXTO);
		const hover = (g: GrupoDeValor) =>
			g.destacado ? DESTACADO_HOVER : CONTEXTO_HOVER;
		return {
			type: "bar",
			data: {
				labels: grupos.map((g) => g.nombre),
				datasets: [
					{
						label: "Valor",
						data: grupos.map((g) => g.valor),
						backgroundColor: grupos.map(color),
						hoverBackgroundColor: grupos.map(hover),
						borderRadius: 4,
						borderSkipped: "start",
						maxBarThickness: 18,
					},
				],
			},
			options: {
				indexAxis: "y",
				responsive: true,
				maintainAspectRatio: false,
				layout: { padding: { right: 118 } },
				plugins: {
					legend: { display: false },
					tooltip: {
						callbacks: {
							label: (item: TooltipItem<"bar">) => {
								const g = grupos[item.dataIndex];
								return `${g.productos} productos · ${entero.format(g.unidades)} uds`;
							},
						},
					},
				},
				scales: {
					x: { display: false, beginAtZero: true },
					y: {
						grid: { display: false },
						border: { display: false },
						ticks: { color: TINTA.cifra },
					},
				},
			},
			plugins: [
				etiquetasDirectas(
					grupos.map(
						(g) =>
							`S/. ${entero.format(g.valor)} · ${decima.format(g.participacion)}%`,
					),
				),
			],
		};
	}

	protected readonly graficoCategorias = computed(() => {
		const datos = this.resumen();
		return datos ? this.barrasDeValor(datos.por_categoria) : null;
	});

	protected readonly graficoMarcas = computed(() => {
		const datos = this.resumen();
		return datos ? this.barrasDeValor(datos.por_marca) : null;
	});

	protected readonly graficoSalud = computed(
		(): ChartConfiguration<"bar"> | null => {
			const datos = this.resumen();
			if (!datos) return null;
			const umbral = datos.umbral_stock_bajo;
			const serie = (
				label: string,
				color: string,
				valor: (a: ResumenDashboard["por_almacen"][number]) => number,
			) => ({
				label,
				data: datos.por_almacen.map(valor),
				backgroundColor: color,
				borderColor: TINTA.borde,
				borderWidth: { right: 2 },
				borderSkipped: false as const,
				borderRadius: 4,
				maxBarThickness: 28,
			});
			return {
				type: "bar",
				data: {
					labels: datos.por_almacen.map((a) => a.nombre),
					datasets: [
						serie("Agotado", ESTADO.agotado, (a) => a.agotados),
						serie(`1 a ${umbral} uds`, ESTADO.porReponer, (a) => a.por_reponer),
						serie(`Más de ${umbral}`, ESTADO.sano, (a) => a.sanos),
					],
				},
				options: {
					indexAxis: "y",
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: "bottom",
							labels: { usePointStyle: true, pointStyle: "rectRounded" },
						},
						tooltip: {
							callbacks: {
								label: (item: TooltipItem<"bar">) =>
									`${item.dataset.label}: ${item.formattedValue} productos`,
							},
						},
					},
					scales: {
						x: {
							stacked: true,
							grid: { color: TINTA.rejilla },
							border: { display: false },
							ticks: { precision: 0 },
						},
						y: {
							stacked: true,
							grid: { display: false },
							border: { display: false },
						},
					},
				},
			};
		},
	);

	protected readonly graficoMovimientos = computed(
		(): ChartConfiguration<"bar"> | null => {
			const datos = this.resumen();
			if (!datos) return null;
			const meses = datos.movimientos_por_mes;
			return {
				type: "bar",
				data: {
					labels: meses.map((m) =>
						nombreDelMes.format(new Date(`${m.mes}-01T00:00:00Z`)),
					),
					datasets: [
						{
							label: "Entradas",
							data: meses.map((m) => m.entradas),
							backgroundColor: ENTRADAS,
							borderRadius: 4,
							borderSkipped: "start",
							maxBarThickness: 22,
						},
						{
							label: "Salidas",
							data: meses.map((m) => m.salidas),
							backgroundColor: SALIDAS,
							borderRadius: 4,
							borderSkipped: "start",
							maxBarThickness: 22,
						},
					],
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							position: "bottom",
							labels: { usePointStyle: true, pointStyle: "rectRounded" },
						},
						tooltip: {
							callbacks: {
								label: (item: TooltipItem<"bar">) =>
									`${item.dataset.label}: ${item.formattedValue} uds`,
								afterBody: (items: TooltipItem<"bar">[]) =>
									`${meses[items[0].dataIndex].movimientos} movimientos`,
							},
						},
					},
					scales: {
						x: { grid: { display: false }, border: { display: false } },
						y: {
							grid: { color: TINTA.rejilla },
							border: { display: false },
							ticks: { precision: 0 },
						},
					},
				},
			};
		},
	);
}
