import { DatePipe, DecimalPipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	input,
	signal,
} from "@angular/core";
import { RouterLink } from "@angular/router";
import {
	LucideAlertTriangle as AlertTriangle,
	LucideArrowLeft as ArrowLeft,
	LucideCheckCircle as CheckCircle,
	LucideDynamicIcon,
	LucidePlus as Plus,
	LucideSave as Save,
	LucideSearch as Search,
	LucideTrash2 as Trash2,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";

import { AuthService } from "../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../core/http/api-client";
import { claves } from "../../core/http/claves";
import { paginaProductos, tomaFisica } from "../../core/http/queries/consultas";
import { DialogoConfirmacionComponent } from "../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component";
import {
	PaginadorComponent,
	paginasDe,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import type { TomaFisica } from "../../shared/schemas/api.schema";
import { TomaFisicaApi } from "./toma-fisica.api";
import { TEXTO_ESTADO } from "./toma-fisica-lista.component";

const ESPERA_BUSQUEDA_MS = 300;

@Component({
	selector: "app-toma-fisica-detalle",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		DecimalPipe,
		RouterLink,
		LucideDynamicIcon,
		DialogoConfirmacionComponent,
		PaginadorComponent,
	],
	templateUrl: "./toma-fisica-detalle.component.html",
})
export class TomaFisicaDetalleComponent {
	private readonly api = inject(ApiClient);
	private readonly tomas = inject(TomaFisicaApi);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	readonly id = input.required<string>();

	protected readonly icons = {
		AlertTriangle,
		ArrowLeft,
		CheckCircle,
		Plus,
		Save,
		Search,
		Trash2,
	};
	protected readonly textoEstado = TEXTO_ESTADO;
	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);

	protected readonly tomaQuery = injectQuery(() =>
		tomaFisica(this.api, this.id()),
	);
	protected readonly toma = computed(() => this.tomaQuery.data() ?? null);
	protected readonly abierta = computed(
		() => this.toma()?.estado === "ABIERTO",
	);

	protected readonly busqueda = signal("");
	private readonly busquedaAplicada = signal("");
	private temporizador: ReturnType<typeof setTimeout> | undefined;
	protected readonly resultadosQuery = injectQuery(() => ({
		...paginaProductos(this.api, 1, 20, this.busquedaAplicada()),
		enabled: this.abierta() && this.busquedaAplicada() !== "",
	}));
	protected readonly resultados = computed(() => {
		const ya = new Set(this.toma()?.lineas?.map((l) => l.producto_id));
		return (this.resultadosQuery.data()?.data ?? []).filter(
			(p) => !ya.has(p.id),
		);
	});

	protected readonly borrador = signal<Record<string, string>>({});
	protected readonly cambios = computed(() => {
		const lineas = this.toma()?.lineas ?? [];
		return Object.entries(this.borrador())
			.map(([lineaId, texto]) => {
				const linea = lineas.find((l) => l.id === lineaId);
				const cantidad = texto.trim() === "" ? null : Number(texto);
				return { linea, cantidad };
			})
			.filter(
				({ linea, cantidad }) =>
					linea &&
					cantidad !== linea.cantidad_contada &&
					(cantidad === null || (Number.isInteger(cantidad) && cantidad >= 0)),
			)
			.map(({ linea, cantidad }) => ({
				linea_id: (linea as NonNullable<typeof linea>).id,
				cantidad_contada: cantidad,
			}));
	});
	protected readonly faltanContar = computed(
		() =>
			(this.toma()?.lineas ?? []).filter((l) => l.cantidad_contada === null)
				.length,
	);
	protected readonly conDiferencia = computed(
		() =>
			(this.toma()?.lineas ?? []).filter(
				(l) => l.diferencia !== null && l.diferencia !== 0,
			).length,
	);
	protected readonly pagina = signal(1);
	protected readonly porPagina =
		inject(TamanosDePagina).de("toma-fisica-lineas");
	protected readonly paginaActual = computed(() =>
		Math.min(
			this.pagina(),
			paginasDe(this.toma()?.lineas?.length ?? 0, this.porPagina()),
		),
	);
	protected readonly desde = computed(
		() => (this.paginaActual() - 1) * this.porPagina(),
	);
	protected readonly lineasEnPagina = computed(() =>
		(this.toma()?.lineas ?? []).slice(
			this.desde(),
			this.desde() + this.porPagina(),
		),
	);

	protected readonly conMovimientosDespues = computed(() =>
		(this.toma()?.lineas ?? []).filter((l) => (l.movimientos_despues ?? 0) > 0),
	);

	protected readonly error = signal<string | null>(null);
	protected readonly aviso = signal<string | null>(null);
	protected readonly confirmando = signal(false);
	protected readonly anulando = signal(false);
	protected readonly motivo = signal("");

	constructor() {
		inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
	}

	private alTerminar(toma: TomaFisica, aviso: string | null = null) {
		this.queryClient.setQueryData(claves.tomasFisicas.detalle(toma.id), toma);
		this.queryClient.invalidateQueries({
			queryKey: claves.tomasFisicas.paginas,
		});
		this.error.set(null);
		this.aviso.set(aviso);
	}

	private alFallar(texto: string) {
		return (e: Error) => this.error.set(mensajeDeError(e, texto));
	}

	protected readonly agregarMutation = injectMutation(() => ({
		mutationFn: (ids: string[]) => this.tomas.agregar(this.id(), ids),
		onSuccess: (toma: TomaFisica) => this.alTerminar(toma),
		onError: this.alFallar("No se pudo agregar el producto"),
	}));

	protected readonly quitarMutation = injectMutation(() => ({
		mutationFn: (lineaId: string) => this.tomas.quitar(this.id(), lineaId),
		onSuccess: () =>
			this.queryClient.invalidateQueries({
				queryKey: claves.tomasFisicas.todo,
			}),
		onError: this.alFallar("No se pudo quitar el producto"),
	}));

	protected readonly contarMutation = injectMutation(() => ({
		mutationFn: () => this.tomas.contar(this.id(), this.cambios()),
		onSuccess: (toma: TomaFisica) => {
			this.borrador.set({});
			this.alTerminar(toma, "Conteo guardado.");
		},
		onError: this.alFallar("No se pudo guardar el conteo"),
	}));

	protected readonly contabilizarMutation = injectMutation(() => ({
		mutationFn: () => this.tomas.contabilizar(this.id()),
		onSuccess: (toma: TomaFisica) => {
			this.confirmando.set(false);
			this.queryClient.invalidateQueries({ queryKey: claves.kardex.todo });
			this.queryClient.invalidateQueries({ queryKey: claves.productos.todo });
			this.alTerminar(
				toma,
				"Toma física contabilizada: los ajustes ya están en el Kardex.",
			);
		},
		onError: (e: Error) => {
			this.confirmando.set(false);
			this.error.set(mensajeDeError(e, "No se pudo contabilizar"));
		},
	}));

	protected readonly anularMutation = injectMutation(() => ({
		mutationFn: () => this.tomas.anular(this.id(), this.motivo().trim()),
		onSuccess: (toma: TomaFisica) => {
			this.anulando.set(false);
			this.alTerminar(toma, "Toma física anulada.");
		},
		onError: this.alFallar("No se pudo anular"),
	}));

	protected buscar(texto: string) {
		this.busqueda.set(texto);
		clearTimeout(this.temporizador);
		this.temporizador = setTimeout(
			() => this.busquedaAplicada.set(texto.trim()),
			ESPERA_BUSQUEDA_MS,
		);
	}

	protected agregar(ids: string[]) {
		if (ids.length > 0) this.agregarMutation.mutate(ids);
	}

	protected escribirConteo(lineaId: string, texto: string) {
		this.borrador.update((b) => ({ ...b, [lineaId]: texto }));
	}

	protected valorEnPantalla(lineaId: string, guardado: number | null): string {
		return (
			this.borrador()[lineaId] ?? (guardado === null ? "" : String(guardado))
		);
	}

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}

	protected anular() {
		if (this.motivo().trim().length < 3) {
			this.error.set("Escribe por qué se anula (al menos 3 letras).");
			return;
		}
		this.anularMutation.mutate();
	}
}
