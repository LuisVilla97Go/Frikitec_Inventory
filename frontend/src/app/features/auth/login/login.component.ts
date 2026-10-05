import { NgOptimizedImage } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	signal,
} from "@angular/core";
import { FormBuilder, ReactiveFormsModule } from "@angular/forms";
import { Router } from "@angular/router";
import {
	LucideAlertCircle as AlertCircle,
	LucideEye as Eye,
	LucideEyeOff as EyeOff,
	LucideLock as Lock,
	LucideDynamicIcon,
	LucideUser as User,
} from "@lucide/angular";
import { injectMutation } from "@tanstack/angular-query-experimental";
import * as v from "valibot";

import {
	AuthService,
	type Credenciales,
} from "../../../core/auth/auth.service";
import { mensajeDeError } from "../../../core/http/api-client";
import { LicenciasComponent } from "./licencias.component";

const LoginSchema = v.object({
	email: v.pipe(v.string(), v.nonEmpty("El usuario o correo es obligatorio")),
	password: v.pipe(v.string(), v.nonEmpty("La contraseña es obligatoria")),
});

@Component({
	selector: "app-login",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		ReactiveFormsModule,
		LucideDynamicIcon,
		NgOptimizedImage,
		LicenciasComponent,
	],
	templateUrl: "./login.component.html",
})
export class LoginComponent {
	private readonly auth = inject(AuthService);
	private readonly router = inject(Router);

	protected readonly Eye = Eye;
	protected readonly EyeOff = EyeOff;
	protected readonly Lock = Lock;
	protected readonly User = User;
	protected readonly AlertCircle = AlertCircle;

	protected readonly loginForm = inject(FormBuilder).nonNullable.group({
		email: [""],
		password: [""],
	});

	protected readonly showPassword = signal(false);
	protected readonly validationErrors = signal<string[]>([]);
	protected readonly serverError = signal("");

	protected readonly loginMutation = injectMutation(() => ({
		mutationFn: (credenciales: Credenciales) =>
			this.auth.iniciarSesion(credenciales),
		onSuccess: () => this.router.navigate(["/dashboard"]),
		onError: (error: unknown) =>
			this.serverError.set(
				mensajeDeError(error, "Error de conexión con el servidor."),
			),
	}));

	protected togglePassword() {
		this.showPassword.update((visible) => !visible);
	}

	protected onSubmit() {
		this.validationErrors.set([]);
		this.serverError.set("");

		// Validación con Valibot antes de tocar la API
		const result = v.safeParse(LoginSchema, this.loginForm.getRawValue());
		if (!result.success) {
			this.validationErrors.set(result.issues.map((i) => i.message));
			return;
		}
		this.loginMutation.mutate(result.output);
	}
}
