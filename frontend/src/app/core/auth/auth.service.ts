import { HttpClient } from "@angular/common/http";
import { computed, Injectable, inject, signal } from "@angular/core";
import { Router } from "@angular/router";
import { QueryClient } from "@tanstack/angular-query-experimental";
import { firstValueFrom } from "rxjs";
import * as v from "valibot";

import {
	RespuestaSesion,
	type UsuarioSesion,
} from "../../shared/schemas/api.schema";
import { leerCookie } from "../http/cookies";

export interface Credenciales {
	email: string;
	password: string;
}

@Injectable({ providedIn: "root" })
export class AuthService {
	private readonly http = inject(HttpClient);
	private readonly router = inject(Router);
	private readonly queryClient = inject(QueryClient);

	private readonly _usuario = signal<UsuarioSesion | null>(null);
	readonly usuario = this._usuario.asReadonly();
	readonly estaAutenticado = computed(() => this._usuario() !== null);

	private comprobacion: Promise<boolean> | null = null;
	private refresco: Promise<boolean> | null = null;

	async iniciarSesion(credenciales: Credenciales): Promise<UsuarioSesion> {
		const respuesta = await firstValueFrom(
			this.http.post<unknown>("/api/auth/login", credenciales),
		);
		const { user } = v.parse(RespuestaSesion, respuesta);
		this._usuario.set(user);
		this.comprobacion = Promise.resolve(true);
		return user;
	}

	comprobarSesion(): Promise<boolean> {
		this.comprobacion ??= firstValueFrom(this.http.get<unknown>("/api/auth/me"))
			.then((respuesta) => {
				this._usuario.set(v.parse(RespuestaSesion, respuesta).user);
				return true;
			})
			.catch(() => {
				this.olvidarSesion();
				return false;
			});
		return this.comprobacion;
	}

	refrescar(): Promise<boolean> {
		this.refresco ??= firstValueFrom(
			this.http.post(
				"/api/auth/refresh",
				{},
				{ headers: { "X-CSRF-TOKEN": leerCookie("csrf_refresh_token") ?? "" } },
			),
		)
			.then(() => true)
			.catch(() => false)
			.finally(() => {
				this.refresco = null;
			});
		return this.refresco;
	}

	async cerrarSesion(): Promise<void> {
		try {
			await firstValueFrom(this.http.post("/api/auth/logout", {}));
		} finally {
			this.olvidarSesion();
			await this.router.navigate(["/login"]);
		}
	}

	async sesionExpirada(): Promise<void> {
		this.olvidarSesion();
		await this.router.navigate(["/login"]);
	}

	private olvidarSesion(): void {
		this._usuario.set(null);
		this.comprobacion = null;
		this.queryClient.clear();
	}
}
