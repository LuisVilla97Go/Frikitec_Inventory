import { HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../../testing/proveedores-test";
import { LicenciasService } from "./licencias.service";

describe("LicenciasService", () => {
	let servicio: LicenciasService;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: proveedoresDeTest() });
		servicio = TestBed.inject(LicenciasService);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it("lee los originales MIT sin MIME que sirve Vite en desarrollo", async () => {
		const lectura = servicio.leer();
		http
			.match(() => true)
			.forEach((peticion, indice) => {
				peticion.flush("MIT License\nCopyright original\n", {
					headers: indice === 0 ? { "Content-Type": "text/plain" } : {},
				});
			});
		expect(await lectura).toContain("Preflight");
	});

	it("conserva íntegros los tres originales en una sola lectura", async () => {
		const lectura = servicio.leer();
		const originales = [
			"Copyright original\r\nTexto principal\r\n",
			"Copyright Tailwind\nTexto MIT\n",
			"Copyright Preflight\nTexto MIT anidado\n",
		];
		http
			.match(() => true)
			.forEach((peticion, indice) => {
				peticion.flush(originales[indice], {
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			});
		const texto = await lectura;
		for (const original of originales) expect(texto).toContain(original);
	});

	it("rechaza el HTML de la SPA aunque devuelva 200", async () => {
		const lectura = expect(servicio.leer()).rejects.toThrow(
			"avisos originales",
		);
		http
			.match(() => true)
			.forEach((peticion, indice) => {
				peticion.flush(indice === 1 ? "<app-root></app-root>" : "Licencia", {
					headers: {
						"Content-Type": indice === 1 ? "text/html" : "text/plain",
					},
				});
			});
		await lectura;
	});

	it("no entrega un aviso parcial si falta uno de los originales", async () => {
		const lectura = expect(servicio.leer()).rejects.toBeDefined();
		http
			.match(() => true)
			.forEach((peticion, indice) => {
				if (indice === 2) {
					peticion.flush("Ausente", { status: 404, statusText: "Not Found" });
				} else {
					peticion.flush("Licencia", {
						headers: { "Content-Type": "text/plain" },
					});
				}
			});
		await lectura;
	});
});
