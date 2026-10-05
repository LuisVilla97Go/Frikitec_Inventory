import {
	HttpClient,
	provideHttpClient,
	withInterceptors,
	withXhr,
} from "@angular/common/http";
import {
	HttpTestingController,
	provideHttpClientTesting,
} from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import {
	provideAngularQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import { firstValueFrom } from "rxjs";

import { AuthService } from "../auth/auth.service";
import { sesionInterceptor } from "./interceptores";

describe("sesionInterceptor", () => {
	let http: HttpClient;
	let backend: HttpTestingController;
	let auth: AuthService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [
				provideHttpClient(withXhr(), withInterceptors([sesionInterceptor])),
				provideHttpClientTesting(),
				provideRouter([]),
				provideAngularQuery(new QueryClient()),
			],
		});
		http = TestBed.inject(HttpClient);
		backend = TestBed.inject(HttpTestingController);
		auth = TestBed.inject(AuthService);
	});

	afterEach(() => backend.verify());

	it("con el access caducado, refresca y repite la petición una vez", async () => {
		vi.spyOn(auth, "refrescar").mockResolvedValue(true);
		const respuesta = firstValueFrom(http.get("/api/productos"));

		backend
			.expectOne("/api/productos")
			.flush({}, { status: 401, statusText: "Unauthorized" });
		await Promise.resolve();
		await Promise.resolve();
		backend.expectOne("/api/productos").flush({ data: [] });

		expect(await respuesta).toEqual({ data: [] });
		expect(auth.refrescar).toHaveBeenCalledTimes(1);
	});

	it("si no se puede refrescar, manda al login y propaga el 401", async () => {
		vi.spyOn(auth, "refrescar").mockResolvedValue(false);
		vi.spyOn(auth, "sesionExpirada").mockResolvedValue();
		const respuesta = firstValueFrom(http.get("/api/productos"));

		backend
			.expectOne("/api/productos")
			.flush({}, { status: 401, statusText: "Unauthorized" });

		await expect(respuesta).rejects.toThrow();
		expect(auth.sesionExpirada).toHaveBeenCalled();
	});

	it("un 401 del login no se reintenta: es la respuesta real", async () => {
		vi.spyOn(auth, "refrescar").mockResolvedValue(false);
		const respuesta = firstValueFrom(http.post("/api/auth/login", {}));
		backend
			.expectOne("/api/auth/login")
			.flush({}, { status: 401, statusText: "Unauthorized" });

		await expect(respuesta).rejects.toThrow();
		expect(auth.refrescar).not.toHaveBeenCalled();
	});
});
