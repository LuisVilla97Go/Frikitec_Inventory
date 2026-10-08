import {
	ChangeDetectionStrategy,
	Component,
	computed,
	type ElementRef,
	effect,
	inject,
	input,
	type OnInit,
	output,
	signal,
	viewChild,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
	LucideAlertCircle as AlertCircle,
	LucideDynamicIcon,
	LucideSave as Save,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	QueryClient,
} from "@tanstack/angular-query-experimental";

import { AuthService } from "../../../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../../../core/http/api-client";
import { claves } from "../../../../core/http/claves";
import {
	CLAVE_MINIMA,
	LISTA_ROLES,
	ROLES,
	type Rol,
} from "../../../../shared/catalogos/usuarios";
import { DialogoConfirmacionComponent } from "../../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component";
import { ConDatos, Usuario } from "../../../../shared/schemas/api.schema";

@Component({
	selector: "app-usuario-form",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		LucideDynamicIcon,
		DialogoConfirmacionComponent,
	],
	templateUrl: "./usuario-form.component.html",
})
export class UsuarioFormComponent implements OnInit {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	readonly usuario = input<Usuario | null>(null);
	readonly cerrar = output<void>();
	private readonly dialogo =
		viewChild<ElementRef<HTMLDialogElement>>("dialogo");
	private readonly enviando = signal(false);

	protected readonly icons = { X, Save, AlertCircle };
	protected readonly claveMinima = CLAVE_MINIMA;
	protected readonly esEdicion = computed(() => this.usuario() !== null);
	protected readonly confirmarEstado = signal(false);
	protected readonly estadoPropuesto = signal(true);
	protected readonly roles = computed(() =>
		LISTA_ROLES.filter(
			(rol) =>
				rol !== "SUPERADMIN" || this.auth.usuario()?.rol === "SUPERADMIN",
		).map((rol) => ({ valor: rol, texto: ROLES[rol] })),
	);

	protected readonly form = inject(FormBuilder).nonNullable.group({
		nombres: ["", [Validators.required, Validators.maxLength(100)]],
		apellidos: ["", [Validators.required, Validators.maxLength(100)]],
		email: ["", [Validators.required, Validators.maxLength(120)]],
		password: [
			"",
			[Validators.minLength(CLAVE_MINIMA), Validators.maxLength(72)],
		],
		rol: ["TRABAJADOR" as Rol, Validators.required],
		cargo: ["", Validators.maxLength(100)],
		is_active: [true],
	});

	protected readonly mutation = injectMutation(() => ({
		mutationFn: () => {
			const id = this.usuario()?.id;
			return id
				? this.api.put(
					`/api/usuarios/${encodeURIComponent(id)}`,
					this.cuerpo(),
					ConDatos(Usuario),
				)
				: this.api.post("/api/usuarios", this.cuerpo(), ConDatos(Usuario));
		},
		onSuccess: () => {
			void this.queryClient.invalidateQueries({
				queryKey: claves.usuarios.todo,
			});
			this.cerrar.emit();
		},
		onError: () => this.confirmarEstado.set(false),
		onSettled: () => this.enviando.set(false),
	}));
	protected readonly error = computed(() =>
		this.mutation.isError()
			? mensajeDeError(this.mutation.error(), "No se pudo guardar el usuario.")
			: "",
	);

	constructor() {
		effect((limpiar) => {
			const dialogo = this.dialogo()?.nativeElement;
			if (dialogo && !dialogo.open) {
				if (typeof dialogo.showModal === "function") dialogo.showModal();
				else dialogo.setAttribute("open", "");
				dialogo.querySelector<HTMLInputElement>("form input")?.focus();
			}
			limpiar(() => {
				if (dialogo?.open) {
					if (typeof dialogo.close === "function") dialogo.close();
					else dialogo.removeAttribute("open");
				}
			});
		});
	}

	ngOnInit() {
		const usuario = this.usuario();
		if (usuario) {
			this.form.reset({
				nombres: usuario.nombres,
				apellidos: usuario.apellidos,
				email: usuario.email,
				password: "", // vacía = conserva la actual
				rol: usuario.rol,
				cargo: usuario.cargo ?? "",
				is_active: usuario.is_active,
			});
			if (usuario.id === this.auth.usuario()?.id) {
				this.form.controls.is_active.disable();
			}
		} else {
			// Al crear, la contraseña es obligatoria
			this.form.controls.password.addValidators(Validators.required);
			this.form.controls.password.updateValueAndValidity();
		}
	}

	protected guardar() {
		if (this.enviando() || this.confirmarEstado()) return;
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		const usuario = this.usuario();
		const activo = this.form.getRawValue().is_active;
		if (usuario && activo !== usuario.is_active) {
			this.estadoPropuesto.set(activo);
			this.confirmarEstado.set(true);
			return;
		}
		this.confirmarGuardado();
	}

	protected confirmarGuardado() {
		if (this.enviando()) return;
		this.enviando.set(true);
		this.mutation.mutate();
	}

	protected pedirCierre() {
		if (!this.enviando() && !this.confirmarEstado()) this.cerrar.emit();
	}

	protected cancelarDialogo(evento: Event) {
		evento.preventDefault();
		this.pedirCierre();
	}

	protected cerrarDesdeFondo(evento: MouseEvent) {
		if (evento.target === evento.currentTarget) this.pedirCierre();
	}

	protected recorrerFoco(evento: KeyboardEvent) {
		if (evento.key !== "Tab") return;
		const controles =
			this.dialogo()?.nativeElement.querySelectorAll<HTMLElement>(
				"button:not(:disabled), input:not(:disabled), select:not(:disabled)",
			);
		if (!controles?.length) return;
		const primero = controles[0];
		const ultimo = controles[controles.length - 1];
		if (evento.shiftKey && evento.target === primero) {
			evento.preventDefault();
			ultimo.focus();
		} else if (!evento.shiftKey && evento.target === ultimo) {
			evento.preventDefault();
			primero.focus();
		}
	}

	protected invalido(campo: keyof typeof this.form.controls): boolean {
		const control = this.form.controls[campo];
		return control.invalid && control.touched;
	}

	private cuerpo() {
		const f = this.form.getRawValue();
		const cuerpo = {
			nombres: f.nombres.trim(),
			apellidos: f.apellidos.trim(),
			email: f.email.trim(),
			rol: f.rol,
			cargo: f.cargo.trim() || null,
			...(this.esEdicion() ? { is_active: f.is_active } : {}),
		};
		// En edición, sin contraseña nueva no se manda: el backend conserva la actual
		return f.password ? { ...cuerpo, password: f.password } : cuerpo;
	}
}
