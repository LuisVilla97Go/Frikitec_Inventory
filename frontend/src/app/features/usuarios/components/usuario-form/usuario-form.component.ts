import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	type OnInit,
	output,
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
import { ConDatos, Usuario } from "../../../../shared/schemas/api.schema";

@Component({
	selector: "app-usuario-form",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, LucideDynamicIcon],
	templateUrl: "./usuario-form.component.html",
	host: { "(document:keydown.escape)": "cerrar.emit()" },
})
export class UsuarioFormComponent implements OnInit {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	readonly usuario = input<Usuario | null>(null);
	readonly cerrar = output<void>();

	protected readonly icons = { X, Save, AlertCircle };
	protected readonly claveMinima = CLAVE_MINIMA;
	protected readonly esEdicion = computed(() => this.usuario() !== null);
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
	}));
	protected readonly error = computed(() =>
		this.mutation.isError()
			? mensajeDeError(this.mutation.error(), "No se pudo guardar el usuario.")
			: "",
	);

	ngOnInit() {
		const usuario = this.usuario();
		if (usuario) {
			this.form.reset({
				nombres: usuario.nombres,
				apellidos: usuario.apellidos,
				email: usuario.email,
				password: "",
				rol: usuario.rol,
				cargo: usuario.cargo ?? "",
			});
		} else {
			this.form.controls.password.addValidators(Validators.required);
			this.form.controls.password.updateValueAndValidity();
		}
	}

	protected guardar() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.mutation.mutate();
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
		};
		return f.password ? { ...cuerpo, password: f.password } : cuerpo;
	}
}
