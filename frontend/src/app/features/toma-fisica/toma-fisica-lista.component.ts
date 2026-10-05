import { DatePipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from "@angular/core";
import { Router, RouterLink } from "@angular/router";
import {
	LucideClipboardCheck as ClipboardCheck,
	LucideDynamicIcon,
	LucidePlus as Plus,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	keepPreviousData,
	QueryClient,
} from "@tanstack/angular-query-experimental";

import { AuthService } from "../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../core/http/api-client";
import { claves } from "../../core/http/claves";
import {
	almacenes,
	paginaTomasFisicas,
} from "../../core/http/queries/consultas";
import {
	PaginadorComponent,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import type { EstadoTomaFisica } from "../../shared/schemas/api.schema";
import { TomaFisicaApi } from "./toma-fisica.api";

export const TEXTO_ESTADO: Record<EstadoTomaFisica, string> = {
	ABIERTO: "Abierta",
	CONTABILIZADO: "Contabilizada",
	ANULADO: "Anulada",
};

@Component({
	selector: "app-toma-fisica-lista",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [DatePipe, RouterLink, LucideDynamicIcon, PaginadorComponent],
	templateUrl: "./toma-fisica-lista.component.html",
})
export class TomaFisicaListaComponent {
	private readonly api = inject(ApiClient);
	private readonly tomas = inject(TomaFisicaApi);
	private readonly router = inject(Router);
	private readonly queryClient = inject(QueryClient);
	protected readonly auth = inject(AuthService);

	protected readonly icons = { ClipboardCheck, Plus, X };
	protected readonly textoEstado = TEXTO_ESTADO;

	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("tomas-fisicas");
	protected readonly tomasQuery = injectQuery(() => ({
		...paginaTomasFisicas(this.api, this.pagina(), this.porPagina()),
		placeholderData: keepPreviousData,
	}));
	protected readonly almacenesQuery = injectQuery(() => almacenes(this.api));

	protected readonly creando = signal(false);
	protected readonly almacenId = signal("");
	protected readonly observacion = signal("");
	protected readonly error = signal<string | null>(null);

	protected readonly crearMutation = injectMutation(() => ({
		mutationFn: () =>
			this.tomas.crear(this.almacenId(), this.observacion().trim() || null),
		onSuccess: async (toma) => {
			await this.queryClient.invalidateQueries({
				queryKey: claves.tomasFisicas.todo,
			});
			this.router.navigate(["/toma-fisica", toma.id]);
		},
		onError: (e: Error) =>
			this.error.set(mensajeDeError(e, "No se pudo crear la toma física")),
	}));

	protected abrirNueva() {
		this.error.set(null);
		this.almacenId.set("");
		this.observacion.set("");
		this.creando.set(true);
	}

	protected crear() {
		if (!this.almacenId()) {
			this.error.set("Elige el almacén que vas a contar.");
			return;
		}
		this.crearMutation.mutate();
	}

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}
}
