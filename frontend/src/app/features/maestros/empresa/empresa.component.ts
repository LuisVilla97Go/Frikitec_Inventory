import { HttpErrorResponse } from "@angular/common/http";
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
import {
	type AbstractControl,
	FormBuilder,
	ReactiveFormsModule,
	type ValidationErrors,
	Validators,
} from "@angular/forms";
import {
	LucideBuilding as Building,
	LucideCircleCheck as CircleCheck,
	LucideDynamicIcon,
	LucideSave as Save,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import { AuthService } from "../../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../../core/http/api-client";
import { claves } from "../../../core/http/claves";
import { datosEmpresa } from "../../../core/http/queries/consultas";
import { ConDatos, Empresa } from "../../../shared/schemas/api.schema";

const PESOS_RUC = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export function rucValido(ruc: string): boolean {
	if (!/^\d{11}$/.test(ruc)) return false;
	const suma = PESOS_RUC.reduce(
		(total, peso, i) => total + Number(ruc[i]) * peso,
		0,
	);
	const resto = 11 - (suma % 11);
	const verificador = resto === 10 ? 0 : resto === 11 ? 1 : resto;
	return Number(ruc[10]) === verificador;
}

function validarRuc(control: AbstractControl<string>): ValidationErrors | null {
	return control.value && !rucValido(control.value.trim())
		? { ruc: true }
		: null;
}

@Component({
	selector: "app-empresa",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, LucideDynamicIcon],
	templateUrl: "./empresa.component.html",
})
export class EmpresaComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);
	private readonly dialogoExito =
		viewChild.required<ElementRef<HTMLDialogElement>>("dialogoExito");
	private readonly botonGuardar =
		viewChild<ElementRef<HTMLButtonElement>>("botonGuardar");

	protected readonly icons = { Building, Save, CircleCheck };
	protected readonly empresaQuery = injectQuery(() => datosEmpresa(this.api));
	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);
	protected readonly guardado = signal(false);
	protected readonly error = signal<string | null>(null);

	protected readonly form = inject(FormBuilder).nonNullable.group({
		ruc: ["", [Validators.required, validarRuc]],
		razon_social: ["", [Validators.required, Validators.maxLength(200)]],
		nombre_comercial: ["", Validators.maxLength(200)],
		direccion_fiscal: ["", Validators.maxLength(300)],
		ubigeo: ["", Validators.pattern(/^\d{6}$/)],
		distrito: ["", Validators.maxLength(100)],
		provincia: ["", Validators.maxLength(100)],
		departamento: ["", Validators.maxLength(100)],
		telefono: ["", Validators.maxLength(30)],
		correo: [
			"",
			[
				Validators.email,
				Validators.pattern(/^[^@\s]+@[^@\s]+\.[^@\s]+$/),
				Validators.maxLength(254),
			],
		],
		web: ["", Validators.maxLength(200)],
	});

	constructor() {
		// Lo guardado llena el formulario; quien no es admin solo lo ve
		effect(() => {
			const empresa = this.empresaQuery.data();
			if (empresa) this.form.reset(this.aFormulario(empresa));
			if (this.esAdmin()) this.form.enable();
			else this.form.disable();
		});
	}

	protected readonly guardarMutation = injectMutation(() => ({
		mutationFn: () => {
			const f = this.form.getRawValue();
			const cuerpo = Object.fromEntries(
				Object.entries(f).map(([campo, valor]) => [
					campo,
					valor.trim() || null,
				]),
			);
			return this.api.put("/api/empresa", cuerpo, ConDatos(Empresa));
		},
		onSuccess: (respuesta: { data: Empresa }) => {
			this.queryClient.setQueryData(claves.empresa, respuesta.data);
			this.guardado.set(true);
			this.dialogoExito().nativeElement.showModal();
		},
		onError: (err: Error) => {
			this.error.set(mensajeDeError(err, "No se pudieron guardar los datos"));
			if (err instanceof HttpErrorResponse && err.status === 422) {
				this.error.set(
					"Revisa los datos de la empresa: algún campo no cumple el formato requerido.",
				);
			}
		},
	}));

	protected guardar() {
		this.error.set(null);
		this.guardado.set(false);
		for (const control of Object.values(this.form.controls)) {
			const valor = control.value.trim();
			if (valor !== control.value) control.setValue(valor);
		}
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			this.error.set(
				"Revisa los campos marcados antes de guardar los datos de la empresa.",
			);
			return;
		}
		this.guardarMutation.mutate();
	}

	protected cerrarExito() {
		this.dialogoExito().nativeElement.close();
	}

	protected devolverFoco() {
		this.botonGuardar()?.nativeElement.focus();
	}

	protected recorrerFoco(evento: KeyboardEvent) {
		if (evento.key === "Tab") evento.preventDefault();
	}

	protected invalido(campo: keyof typeof this.form.controls): boolean {
		const control = this.form.controls[campo];
		return control.invalid && control.touched;
	}

	private aFormulario(empresa: Empresa) {
		const { updated_at: _, ...campos } = empresa;
		return Object.fromEntries(
			Object.entries(campos).map(([campo, valor]) => [campo, valor ?? ""]),
		) as ReturnType<typeof this.form.getRawValue>;
	}
}
