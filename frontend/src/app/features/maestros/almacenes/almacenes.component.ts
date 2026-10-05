import {
	ChangeDetectionStrategy,
	Component,
	computed,
	type ElementRef,
	effect,
	inject,
	signal,
	viewChild,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
	LucideEdit2 as Edit2,
	LucideDynamicIcon,
	LucidePlus as Plus,
	LucideSave as Save,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import { AuthService } from "../../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../../core/http/api-client";
import { claves } from "../../../core/http/claves";
import { almacenesMaestro } from "../../../core/http/queries/consultas";
import { DialogoConfirmacionComponent } from "../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component";
import {
	PaginadorComponent,
	paginasDe,
	TamanosDePagina,
} from "../../../shared/components/paginador/paginador.component";
import { AlmacenMaestro, ConDatos } from "../../../shared/schemas/api.schema";

@Component({
	selector: "app-almacenes",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		LucideDynamicIcon,
		DialogoConfirmacionComponent,
		PaginadorComponent,
	],
	templateUrl: "./almacenes.component.html",
})
export class AlmacenesComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	protected readonly icons = { Edit2, Plus, Save, X };

	protected readonly almacenesQuery = injectQuery(() =>
		almacenesMaestro(this.api),
	);
	protected readonly resumen = computed(() => {
		const almacenes = this.almacenesQuery.data() ?? [];
		return {
			total: almacenes.length,
			activos: almacenes.filter((almacen) => almacen.is_active).length,
			unidades: almacenes.reduce((total, almacen) => total + almacen.stock, 0),
		};
	});
	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("almacenes");
	protected readonly paginaActual = computed(() =>
		Math.min(this.pagina(), paginasDe(this.resumen().total, this.porPagina())),
	);
	protected readonly filas = computed(() =>
		(this.almacenesQuery.data() ?? []).slice(
			(this.paginaActual() - 1) * this.porPagina(),
			this.paginaActual() * this.porPagina(),
		),
	);

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}
	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);

	// Form (crear / editar)
	protected readonly form = inject(FormBuilder).nonNullable.group({
		nombre: ["", [Validators.required, Validators.maxLength(100)]],
		ubicacion: ["", Validators.maxLength(200)],
		codigo_establecimiento: ["", Validators.pattern(/^\d{4}$/)],
	});
	protected readonly modalAbierto = signal(false);
	private readonly formularioDialog =
		viewChild<ElementRef<HTMLDialogElement>>("formularioDialog");
	protected readonly editando = signal<AlmacenMaestro | null>(null);
	protected readonly errorFormulario = signal("");

	protected readonly guardarMutation = injectMutation(() => ({
		mutationFn: () => {
			const f = this.form.getRawValue();
			const cuerpo = {
				nombre: f.nombre.trim(),
				ubicacion: f.ubicacion.trim() || null,
				codigo_establecimiento: f.codigo_establecimiento.trim() || null,
			};
			const actual = this.editando();
			return actual
				? this.api.put(
					`/api/almacenes/${encodeURIComponent(actual.id)}`,
					cuerpo,
					ConDatos(AlmacenMaestro),
				)
				: this.api.post("/api/almacenes", cuerpo, ConDatos(AlmacenMaestro));
		},
		onSuccess: () => {
			this.refrescar();
			this.modalAbierto.set(false);
		},
		onError: (error: unknown) =>
			this.errorFormulario.set(
				mensajeDeError(error, "No se pudo guardar el almacén."),
			),
	}));

	// Activar / desactivar con confirmación
	protected readonly aCambiar = signal<AlmacenMaestro | null>(null);
	protected readonly errorEstado = signal("");

	constructor() {
		effect(() => {
			const dialog = this.formularioDialog()?.nativeElement;
			if (this.modalAbierto() && dialog && !dialog.open) {
				if (typeof dialog.showModal === "function") dialog.showModal();
				else dialog.setAttribute("open", "");
			}
		});
	}

	protected readonly estadoMutation = injectMutation(() => ({
		mutationFn: (almacen: AlmacenMaestro) =>
			this.api.patch(
				`/api/almacenes/${encodeURIComponent(almacen.id)}/estado`,
				{ is_active: !almacen.is_active },
				ConDatos(AlmacenMaestro),
			),
		onSuccess: () => {
			this.refrescar();
			this.aCambiar.set(null);
		},
		onError: (error: unknown) => {
			this.aCambiar.set(null);
			this.errorEstado.set(
				mensajeDeError(error, "No se pudo cambiar el estado del almacén."),
			);
		},
	}));

	protected abrirNuevo() {
		this.editando.set(null);
		this.form.reset();
		this.errorFormulario.set("");
		this.modalAbierto.set(true);
	}

	protected abrirEdicion(almacen: AlmacenMaestro) {
		this.editando.set(almacen);
		this.form.reset({
			nombre: almacen.nombre,
			ubicacion: almacen.ubicacion ?? "",
			codigo_establecimiento: almacen.codigo_establecimiento ?? "",
		});
		this.errorFormulario.set("");
		this.modalAbierto.set(true);
	}

	protected cerrarModal() {
		if (!this.guardarMutation.isPending()) this.modalAbierto.set(false);
	}

	protected cancelarModal(event: Event) {
		event.preventDefault();
		this.cerrarModal();
	}

	protected guardar() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			this.errorFormulario.set("Revisa los campos marcados.");
			return;
		}
		this.errorFormulario.set("");
		this.guardarMutation.mutate();
	}

	protected pedirCambioDeEstado(almacen: AlmacenMaestro) {
		this.errorEstado.set("");
		this.aCambiar.set(almacen);
	}

	protected mensajeCambio(almacen: AlmacenMaestro): string {
		return almacen.is_active
			? `${almacen.nombre} dejará de aparecer al registrar movimientos y al dar de alta productos. Su Kardex se conserva.`
			: `${almacen.nombre} volverá a aparecer al registrar movimientos.`;
	}

	protected invalido(campo: keyof typeof this.form.controls): boolean {
		const control = this.form.controls[campo];
		return control.invalid && control.touched;
	}

	private refrescar() {
		void this.queryClient.invalidateQueries({ queryKey: claves.almacenes });
	}
}
