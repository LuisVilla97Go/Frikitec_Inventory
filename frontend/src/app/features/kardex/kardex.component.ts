import { DecimalPipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	inject,
	input,
	signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import {
	LucideArrowDownRight as ArrowDownRight,
	LucideArrowLeftRight as ArrowLeftRight,
	LucideArrowUpRight as ArrowUpRight,
	LucideBookOpen as BookOpen,
	LucideCalculator as Calculator,
	LucideChevronDown as ChevronDown,
	LucideChevronLeft as ChevronLeft,
	LucideDollarSign as DollarSign,
	LucideDownload as Download,
	LucideFileQuestion as FileQuestion,
	LucideInfo as Info,
	LucideLayers as Layers,
	LucideLightbulb as Lightbulb,
	LucideLogIn as LogIn,
	LucideLogOut as LogOut,
	LucideDynamicIcon,
	LucidePackage as Package,
	LucidePlus as Plus,
	LucidePlusCircle as PlusCircle,
	LucidePrinter as Printer,
	LucideRotateCcw as RotateCcw,
	LucideSearch as Search,
	LucideTag as Tag,
	LucideX as X,
} from "@lucide/angular";
import {
	injectQuery,
	keepPreviousData,
} from "@tanstack/angular-query-experimental";

import { ApiClient } from "../../core/http/api-client";
import {
	kardexDeProducto,
	paginaProductos,
} from "../../core/http/queries/consultas";
import {
	PaginadorComponent,
	paginasDe,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import type { Producto } from "../../shared/schemas/api.schema";
import { KardexMovimientoModalComponent } from "./components/kardex-movimiento-modal/kardex-movimiento-modal.component";

type FiltroTipo = "ALL" | "ENTRADA" | "SALIDA";

const ESPERA_BUSQUEDA_MS = 300;

@Component({
	selector: "app-kardex",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DecimalPipe,
		RouterLink,
		LucideDynamicIcon,
		KardexMovimientoModalComponent,
		PaginadorComponent,
	],
	templateUrl: "./kardex.component.html",
})
export class KardexComponent {
	private readonly api = inject(ApiClient);

	readonly producto = input<string>();

	protected readonly icons = {
		Search,
		LogIn,
		LogOut,
		Layers,
		Lightbulb,
		Info,
		Printer,
		Download,
		Plus,
		PlusCircle,
		ArrowDownRight,
		ArrowUpRight,
		X,
		FileQuestion,
		RotateCcw,
		Package,
		Calculator,
		DollarSign,
		ArrowLeftRight,
		ChevronDown,
		Tag,
		BookOpen,
		ChevronLeft,
	};

	protected readonly selectedProductId = signal("");
	protected readonly filterSearch = signal("");
	protected readonly filterType = signal<FiltroTipo>("ALL");
	protected readonly filterFromDate = signal("");
	protected readonly filterToDate = signal("");

	// ── Listado de productos (Kardex) ──
	protected readonly busqueda = signal("");
	private readonly busquedaAplicada = signal("");
	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("kardex");
	private temporizador: ReturnType<typeof setTimeout> | undefined;

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}

	protected readonly productsQuery = injectQuery(() => ({
		...paginaProductos(
			this.api,
			this.pagina(),
			this.porPagina(),
			this.busquedaAplicada(),
		),
		placeholderData: keepPreviousData,
	}));

	protected readonly almacenSeleccionado = signal("");

	protected readonly kardexQuery = injectQuery(() => ({
		...kardexDeProducto(
			this.api,
			this.selectedProductId(),
			this.almacenSeleccionado(),
		),

		placeholderData: (anterior, consulta) =>
			consulta?.queryKey[1] === this.selectedProductId() ? anterior : undefined,
	}));

	constructor() {
		inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
		effect(
			() => {
				const id = this.producto();
				if (id) this.selectedProductId.set(id);
			},
			{ allowSignalWrites: true },
		);
	}

	protected readonly processedLedger = computed(() => {
		const data = this.kardexQuery.data();
		if (!data) return [];
		return data.movements.map((item) => {
			const entrada = item.type === "ENTRADA";
			return {
				...item,
				inQty: entrada ? item.qty : null,
				inCost: entrada ? item.unitCost : null,
				inTotal: entrada ? item.amount : null,
				outQty: entrada ? null : item.qty,
				outCost: entrada ? null : item.unitCost,
				outTotal: entrada ? null : item.amount,
				balanceTotal: item.balanceValue,
			};
		});
	});

	protected elegirAlmacen(almacenId: string) {
		this.almacenSeleccionado.set(almacenId);
	}

	protected readonly filteredLedger = computed(() => {
		const search = this.filterSearch().toLowerCase().trim();
		const type = this.filterType();
		const fromDate = this.filterFromDate();
		const toDate = this.filterToDate();

		return this.processedLedger().filter((row) => {
			const matchSearch =
				!search ||
				row.docNumber.toLowerCase().includes(search) ||
				row.detail.toLowerCase().includes(search) ||
				row.docType.toLowerCase().includes(search) ||
				(row.purchaseOrderNumber ?? "").toLowerCase().includes(search);
			const matchType = type === "ALL" || row.type === type;
			const matchDate =
				(!fromDate || row.date >= fromDate) && (!toDate || row.date <= toDate);
			return matchSearch && matchType && matchDate;
		});
	});

	protected readonly paginaKardex = signal(1);
	protected readonly porPaginaKardex =
		inject(TamanosDePagina).de("kardex-movimientos");
	protected readonly paginaKardexActual = computed(() =>
		Math.min(
			this.paginaKardex(),
			paginasDe(this.filteredLedger().length, this.porPaginaKardex()),
		),
	);

	protected enPaginaDelKardex(indice: number): boolean {
		const desde = (this.paginaKardexActual() - 1) * this.porPaginaKardex();
		return indice >= desde && indice < desde + this.porPaginaKardex();
	}

	protected cambiarPorPaginaKardex(tamano: number) {
		this.porPaginaKardex.set(tamano);
		this.paginaKardex.set(1);
	}

	protected readonly kpis = computed(() => {
		const ledger = this.processedLedger();
		const lastRow = ledger.at(-1);
		const totalIn = ledger.reduce((acc, row) => acc + (row.inQty ?? 0), 0);
		const totalOut = ledger.reduce((acc, row) => acc + (row.outQty ?? 0), 0);
		const sumFlujo = totalIn + totalOut || 1;
		const inPct = Math.round((totalIn / sumFlujo) * 100);

		return {
			currentStock: lastRow?.balanceQty ?? 0,
			currentAvgCost: lastRow?.balanceCost ?? 0,
			currentValuation: lastRow?.balanceTotal ?? 0,
			totalIn,
			totalOut,
			inPct,
			outPct: 100 - inPct,
		};
	});

	protected readonly stockStatus = computed(() => {
		const stock = this.kpis().currentStock;
		const minStock = this.kardexQuery.data()?.minStock ?? 0;
		if (stock <= 0) return "agotado";
		if (stock <= minStock) return "critico";
		return "optimo";
	});

	protected actualizarBusqueda(evento: Event) {
		const texto = (evento.target as HTMLInputElement).value;
		this.busqueda.set(texto);
		this.pagina.set(1);
		clearTimeout(this.temporizador);
		this.temporizador = setTimeout(
			() => this.busquedaAplicada.set(texto.trim()),
			ESPERA_BUSQUEDA_MS,
		);
	}

	protected selectProduct(prod: Producto | null) {
		this.almacenSeleccionado.set("");
		this.paginaKardex.set(1);
		if (prod) {
			this.selectedProductId.set(prod.id);
		} else {
			this.selectedProductId.set("");
			this.busqueda.set("");
			this.busquedaAplicada.set("");
			this.pagina.set(1);
		}
	}

	protected alCambiarTexto(filtro: "search" | "from" | "to", evento: Event) {
		const valor = (evento.target as HTMLInputElement).value;
		const destino = {
			search: this.filterSearch,
			from: this.filterFromDate,
			to: this.filterToDate,
		}[filtro];
		destino.set(valor);
	}

	protected alCambiarTipo(evento: Event) {
		this.filterType.set(
			(evento.target as HTMLSelectElement).value as FiltroTipo,
		);
	}

	protected resetFilters() {
		this.filterSearch.set("");
		this.filterType.set("ALL");
		this.filterFromDate.set("");
		this.filterToDate.set("");
	}

	protected exportToCSV() {
		const cabecera = [
			"Fecha",
			"Documento",
			"Detalle",
			"Tienda",
			"Tipo",
			"Cant Entrada",
			"Costo Entrada",
			"Total Entrada",
			"Cant Salida",
			"Costo Salida",
			"Total Salida",
			"Saldo Cant",
			"Costo Prom",
			"Saldo Total",
		];
		const filas = this.filteredLedger().map((r) => [
			r.date,
			r.docNumber,
			r.detail,
			r.warehouse,
			r.type,
			r.inQty ?? 0,
			r.inCost ?? 0,
			r.inTotal ?? 0,
			r.outQty ?? 0,
			r.outCost ?? 0,
			r.outTotal ?? 0,
			r.balanceQty,
			r.balanceCost,
			r.balanceTotal,
		]);
		const csv = [cabecera, ...filas]
			.map((fila) => fila.map(celdaCsv).join(","))
			.join("\n");
		const url = URL.createObjectURL(
			new Blob([csv], { type: "text/csv;charset=utf-8" }),
		);
		const enlace = document.createElement("a");
		enlace.href = url;
		enlace.download = `kardex-${this.kardexQuery.data()?.sku ?? "producto"}.csv`;
		enlace.click();
		URL.revokeObjectURL(url);
	}

	protected readonly showModal = signal(false);

	protected openMovimientoModal() {
		this.showModal.set(true);
	}

	protected closeMovimientoModal() {
		this.showModal.set(false);
	}
}

function celdaCsv(valor: string | number): string {
	if (typeof valor === "number") return String(valor);
	const seguro = /^[=+\-@\t\r]/.test(valor) ? `'${valor}` : valor;
	return /[",\n]/.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}
