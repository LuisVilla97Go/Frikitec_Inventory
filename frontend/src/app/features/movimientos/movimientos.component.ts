import { DecimalPipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import {
	LucideArrowRightLeft as ArrowRightLeft,
	LucideDynamicIcon,
	LucideSearch as Search,
	LucideX as X,
} from "@lucide/angular";
import {
	injectQuery,
	keepPreviousData,
} from "@tanstack/angular-query-experimental";

import { ApiClient } from "../../core/http/api-client";
import {
	almacenes,
	paginaLibroDiario,
} from "../../core/http/queries/consultas";
import {
	opcionesDeTipo,
	TIPOS_DOCUMENTO,
	TIPOS_MOVIMIENTO,
	type TipoMovimiento,
} from "../../shared/catalogos/movimientos";
import {
	PaginadorComponent,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";

const ESPERA_BUSQUEDA_MS = 300;

@Component({
	selector: "app-movimientos",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DecimalPipe, RouterLink, LucideDynamicIcon, PaginadorComponent],
	templateUrl: "./movimientos.component.html",
})
export class MovimientosComponent {
	private readonly api = inject(ApiClient);

	protected readonly icons = {
		ArrowRightLeft,
		Search,
		X,
	};
	protected readonly tipos = opcionesDeTipo();

	protected readonly desde = signal("");
	protected readonly hasta = signal("");
	protected readonly almacenId = signal("");
	protected readonly tipo = signal<TipoMovimiento | "">("");
	protected readonly busqueda = signal("");
	private readonly busquedaAplicada = signal("");
	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("movimientos");
	private temporizador: ReturnType<typeof setTimeout> | undefined;

	protected readonly hayFiltros = computed(
		() =>
			this.desde() !== "" ||
			this.hasta() !== "" ||
			this.almacenId() !== "" ||
			this.tipo() !== "" ||
			this.busqueda() !== "",
	);
	protected readonly rangoInvalido = computed(
		() =>
			this.desde() !== "" && this.hasta() !== "" && this.desde() > this.hasta(),
	);

	protected readonly almacenesQuery = injectQuery(() => almacenes(this.api));
	protected readonly diarioQuery = injectQuery(() => ({
		...paginaLibroDiario(this.api, {
			page: this.pagina(),
			per_page: this.porPagina(),
			desde: this.desde(),
			hasta: this.hasta(),
			almacen_id: this.almacenId(),
			tipo_movimiento: this.tipo(),
			search: this.busquedaAplicada(),
		}),
		enabled: !this.rangoInvalido(),
		placeholderData: keepPreviousData,
	}));

	constructor() {
		inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
	}

	protected textoDeTipo(tipo: TipoMovimiento): string {
		return TIPOS_MOVIMIENTO[tipo].texto;
	}

	protected textoDeDocumento(tipo: keyof typeof TIPOS_DOCUMENTO): string {
		return TIPOS_DOCUMENTO[tipo];
	}

	protected cambiarDesde(evento: Event) {
		this.desde.set(this.valor(evento));
		this.pagina.set(1);
	}

	protected cambiarHasta(evento: Event) {
		this.hasta.set(this.valor(evento));
		this.pagina.set(1);
	}

	protected cambiarAlmacen(evento: Event) {
		this.almacenId.set(this.valor(evento));
		this.pagina.set(1);
	}

	protected cambiarTipo(evento: Event) {
		this.tipo.set(this.valor(evento) as TipoMovimiento | "");
		this.pagina.set(1);
	}

	protected actualizarBusqueda(evento: Event) {
		this.busqueda.set(this.valor(evento));
		clearTimeout(this.temporizador);
		// Una petición cuando el usuario deja de escribir, no una por tecla
		this.temporizador = setTimeout(() => {
			this.busquedaAplicada.set(this.busqueda().trim());
			this.pagina.set(1);
		}, ESPERA_BUSQUEDA_MS);
	}

	protected limpiarFiltros() {
		clearTimeout(this.temporizador);
		this.desde.set("");
		this.hasta.set("");
		this.almacenId.set("");
		this.tipo.set("");
		this.busqueda.set("");
		this.busquedaAplicada.set("");
		this.pagina.set(1);
	}

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}

	private valor(evento: Event): string {
		return (evento.target as HTMLInputElement | HTMLSelectElement).value;
	}
}
