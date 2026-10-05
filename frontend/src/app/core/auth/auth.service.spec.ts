import { HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { AuthService } from "./auth.service";

const USUARIO = {
	id: "u-1",
	nombre: "Ana",
	email: "ana@ejemplo.test",
	rol: "ADMIN" as const,
	cargo: null,
	is_admin: true,
};

describe("AuthService", () => {
	let service: AuthService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: proveedoresDeTest() });
		service = TestBed.inject(AuthService);
		http = TestBed.inject(HttpTestingController);
		vi.spyOn(TestBed.inject(Router), "navigate").mockResolvedValue(true);
	});

	afterEach(() => http.verify());

	it("guarda el usuario del login en una signal, nunca en localStorage", async () => {
		const guardar = vi.spyOn(Storage.prototype, "setItem");
		const login = service.iniciarSesion({ email: "ana", password: "x" });
		http
			.expectOne("/api/auth/login")
			.flush({ status: "success", user: USUARIO });

		await login;
		expect(service.usuario()).toEqual(USUARIO);
		expect(service.estaAutenticado()).toBe(true);
		expect(guardar).not.toHaveBeenCalled();
	});

	it("comprueba la sesión con /me una sola vez", async () => {
		const primera = service.comprobarSesion();
		const segunda = service.comprobarSesion();
		http.expectOne("/api/auth/me").flush({ status: "success", user: USUARIO });

		expect(await primera).toBe(true);
		expect(await segunda).toBe(true);
		expect(service.usuario()?.email).toBe("ana@ejemplo.test");
	});

	it("sin sesión, /me responde 401 y el usuario queda vacío", async () => {
		const comprobacion = service.comprobarSesion();
		http
			.expectOne("/api/auth/me")
			.flush({ status: "error" }, { status: 401, statusText: "Unauthorized" });

		expect(await comprobacion).toBe(false);
		expect(service.usuario()).toBeNull();
	});

	it("cerrar sesión llama al backend (que borra las cookies) y olvida al usuario", async () => {
		const login = service.iniciarSesion({ email: "ana", password: "x" });
		http
			.expectOne("/api/auth/login")
			.flush({ status: "success", user: USUARIO });
		await login;

		const salida = service.cerrarSesion();
		http.expectOne("/api/auth/logout").flush({ status: "success" });
		await salida;
		expect(service.usuario()).toBeNull();
	});

	it("el refresco manda el token CSRF del refresh, no el del access", async () => {
		document.cookie = "csrf_refresh_token=token-refresh; path=/";
		const refresco = service.refrescar();
		const req = http.expectOne("/api/auth/refresh");
		expect(req.request.headers.get("X-CSRF-TOKEN")).toBe("token-refresh");
		req.flush({ status: "success" });
		expect(await refresco).toBe(true);
		document.cookie =
			"csrf_refresh_token=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/";
	});
});
