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
	LucideSearch as Search,
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
import { proveedoresMaestro } from "../../../core/http/queries/consultas";
import { DialogoConfirmacionComponent } from "../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component";
import {
	PaginadorComponent,
	paginasDe,
	TamanosDePagina,
} from "../../../shared/components/paginador/paginador.component";
import { ConDatos, ProveedorMaestro } from "../../../shared/schemas/api.schema";

@Component({
	selector: "app-proveedores",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		LucideDynamicIcon,
		DialogoConfirmacionComponent,
		PaginadorComponent,
	],
	templateUrl: "./proveedores.component.html",
})
export class ProveedoresComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	protected readonly icons = { Edit2, Plus, Save, Search, X };
	protected readonly query = injectQuery(() => proveedoresMaestro(this.api));
	protected readonly resumen = computed(() => {
		const proveedores = this.query.data() ?? [];
		const activos = proveedores.filter(
			(proveedor) => proveedor.is_active,
		).length;
		return {
			total: proveedores.length,
			activos,
			inactivos: proveedores.length - activos,
		};
	});
	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);
	protected readonly busqueda = signal("");
	protected readonly estadoFiltro = signal<"todos" | "activos" | "inactivos">(
		"todos",
	);
	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("proveedores");
	protected readonly filtrados = computed(() => {
		const q = this.normalizar(this.busqueda());
		const estado = this.estadoFiltro();
		return (this.query.data() ?? []).filter((p) => {
			const coincideEstado =
				estado === "todos" || p.is_active === (estado === "activos");
			const coincideTexto = [
				p.razon_social,
				p.nombre_comercial ?? "",
				p.numero_documento,
			].some((valor) => this.normalizar(valor).includes(q));
			return coincideEstado && coincideTexto;
		});
	});
	protected readonly paginaActual = computed(() =>
		Math.min(
			this.pagina(),
			paginasDe(this.filtrados().length, this.porPagina()),
		),
	);
	protected readonly filas = computed(() =>
		this.filtrados().slice(
			(this.paginaActual() - 1) * this.porPagina(),
			this.paginaActual() * this.porPagina(),
		),
	);

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}
	protected readonly form = inject(FormBuilder).nonNullable.group({
		tipo_documento: ["RUC", Validators.required],
		numero_documento: [
			"",
			[
				Validators.required,
				Validators.pattern(/^\d+$/),
				Validators.maxLength(11),
			],
		],
		razon_social: ["", [Validators.required, Validators.maxLength(200)]],
		nombre_comercial: ["", Validators.maxLength(200)],
		contacto: ["", Validators.maxLength(150)],
		telefono: ["", Validators.maxLength(30)],
		correo: ["", [Validators.maxLength(254), Validators.email]],
	});
	protected readonly abierto = signal(false);
	private readonly formularioDialog =
		viewChild<ElementRef<HTMLDialogElement>>("formularioDialog");
	protected readonly editando = signal<ProveedorMaestro | null>(null);
	protected readonly error = signal("");
	protected readonly guardarMutation = injectMutation(() => ({
		mutationFn: () => {
			const f = this.form.getRawValue();
			const actual = this.editando();
			const campos = {
				razon_social: f.razon_social.trim(),
				nombre_comercial: f.nombre_comercial.trim() || null,
				contacto: f.contacto.trim() || null,
				telefono: f.telefono.trim() || null,
				correo: f.correo.trim() || null,
			};
			return actual
				? this.api.put(
						`/api/proveedores/${encodeURIComponent(actual.id)}`,
						campos,
						ConDatos(ProveedorMaestro),
					)
				: this.api.post(
						"/api/proveedores",
						{
							...campos,
							tipo_documento: f.tipo_documento,
							numero_documento: f.numero_documento.trim(),
						},
						ConDatos(ProveedorMaestro),
					);
		},
		onSuccess: () => {
			this.refrescar();
			this.abierto.set(false);
		},
		onError: (e: unknown) =>
			this.error.set(mensajeDeError(e, "No se pudo guardar el proveedor.")),
	}));
	protected readonly objetivoEstado = signal<ProveedorMaestro | null>(null);
	protected readonly errorEstado = signal("");

	constructor() {
		effect(() => {
			const dialog = this.formularioDialog()?.nativeElement;
			if (this.abierto() && dialog && !dialog.open) {
				if (typeof dialog.showModal === "function") dialog.showModal();
				else dialog.setAttribute("open", "");
			}
		});
	}
	protected readonly estadoMutation = injectMutation(() => ({
		mutationFn: (p: ProveedorMaestro) =>
			this.api.patch(
				`/api/proveedores/${encodeURIComponent(p.id)}/estado`,
				{ is_active: !p.is_active },
				ConDatos(ProveedorMaestro),
			),
		onSuccess: () => {
			this.refrescar();
			this.objetivoEstado.set(null);
		},
		onError: (e: unknown) => {
			this.objetivoEstado.set(null);
			this.errorEstado.set(
				mensajeDeError(e, "No se pudo cambiar el estado del proveedor."),
			);
		},
	}));

	protected nuevo() {
		this.editando.set(null);
		this.form.controls.tipo_documento.enable();
		this.form.controls.numero_documento.enable();
		this.form.reset({
			tipo_documento: "RUC",
			numero_documento: "",
			razon_social: "",
			nombre_comercial: "",
			contacto: "",
			telefono: "",
			correo: "",
		});
		this.error.set("");
		this.abierto.set(true);
	}

	protected buscar(valor: string) {
		this.busqueda.set(valor);
		this.pagina.set(1);
	}

	protected filtrarEstado(estado: "todos" | "activos" | "inactivos") {
		this.estadoFiltro.set(estado);
		this.pagina.set(1);
	}

	protected cerrarModal() {
		if (!this.guardarMutation.isPending()) this.abierto.set(false);
	}

	protected cancelarModal(event: Event) {
		event.preventDefault();
		this.cerrarModal();
	}

	private normalizar(valor: string): string {
		return valor
			.normalize("NFKD")
			.replace(/[\u0300-\u036f]/g, "")
			.toLocaleLowerCase()
			.trim();
	}

	protected editar(p: ProveedorMaestro) {
		this.editando.set(p);
		this.form.reset({
			tipo_documento: p.tipo_documento,
			numero_documento: p.numero_documento,
			razon_social: p.razon_social,
			nombre_comercial: p.nombre_comercial ?? "",
			contacto: p.contacto ?? "",
			telefono: p.telefono ?? "",
			correo: p.correo ?? "",
		});
		this.form.controls.tipo_documento.disable();
		this.form.controls.numero_documento.disable();
		this.error.set("");
		this.abierto.set(true);
	}

	protected guardar() {
		const doc = this.form.controls.numero_documento;
		const tipo = this.form.controls.tipo_documento.value;
		if (!this.editando() && doc.value.length !== (tipo === "RUC" ? 11 : 8))
			doc.setErrors({ longitud: true });
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			this.error.set("Revisa los campos marcados.");
			return;
		}
		this.error.set("");
		this.guardarMutation.mutate();
	}

	protected campoInvalido(campo: keyof typeof this.form.controls): boolean {
		const c = this.form.controls[campo];
		return c.invalid && c.touched;
	}

	private refrescar() {
		void this.queryClient.invalidateQueries({ queryKey: claves.proveedores });
		void this.queryClient.invalidateQueries({
			queryKey: claves.proveedoresTodos,
		});
	}
}
