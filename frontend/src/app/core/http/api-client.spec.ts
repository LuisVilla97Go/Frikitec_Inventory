import { HttpErrorResponse } from "@angular/common/http";
import { HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";
import * as v from "valibot";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { PaginaProductos } from "../../shared/schemas/api.schema";
import { ApiClient, mensajeDeError } from "./api-client";

describe("ApiClient", () => {
	let api: ApiClient;
	let http: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: proveedoresDeTest() });
		api = TestBed.inject(ApiClient);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it("usa rutas relativas y omite parámetros vacíos", async () => {
		const pagina = api.get("/api/productos", PaginaProductos, {
			page: 2,
			search: "",
		});
		const req = http.expectOne((r) => r.url === "/api/productos");
		expect(req.request.params.get("page")).toBe("2");
		expect(req.request.params.has("search")).toBe(false);
		req.flush({ data: [], page: 2, per_page: 25, total: 0 });
		expect((await pagina).page).toBe(2);
	});

	it("convierte el dinero que llega como texto en número", async () => {
		const pagina = api.get("/api/productos", PaginaProductos);
		http.expectOne("/api/productos").flush({
			data: [
				{
					id: "p1",
					sku: "CAB",
					name: "Cable",
					category: "Cables",
					sub_category: null,
					variant: null,
					barcode: null,
					brand: "X",
					purchase_price: "7.50",
					sale_price: "15.00",
					has_movements: true,
					unvalued_stock: false,
				},
			],
			page: 1,
			per_page: 25,
			total: 1,
		});
		expect((await pagina).data[0].purchase_price).toBe(7.5);
	});

	it("rechaza una respuesta que no cumple el esquema", async () => {
		const pagina = api.get("/api/productos", PaginaProductos);
		http.expectOne("/api/productos").flush({ data: "no es una lista" });
		await expect(pagina).rejects.toThrowError(v.ValiError);
	});
});

describe("mensajeDeError", () => {
	it("usa el mensaje de Flask", () => {
		const error = new HttpErrorResponse({
			status: 409,
			error: { status: "error", message: "Ya existe un producto con el SKU X" },
		});
		expect(mensajeDeError(error, "genérico")).toBe(
			"Ya existe un producto con el SKU X",
		);
	});

	it("sin conexión lo dice claro", () => {
		expect(
			mensajeDeError(new HttpErrorResponse({ status: 0 }), "genérico"),
		).toBe("No hay conexión con el servidor.");
	});
});
