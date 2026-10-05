import {
	HttpTestingController,
	type TestRequest,
} from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { lienzoDeTexto } from "../../../testing/lienzo-de-texto";
import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { AuthService } from "../../core/auth/auth.service";
import { ProductosComponent } from "./productos.component";

const PAGINA = {
	status: "success",
	data: [
		{
			id: "p1",
			sku: "ST-3C108WCM",
			name: "108W USB-C 3-Port GaN Wall Charger",
			category: "Cargadores",
			sub_category: "Cargador de pared",
			variant: "US",
			barcode: "879961009380",
			brand: "Satechi",
			purchase_price: "258.74",
			sale_price: "0.00",
			has_movements: true,
			unvalued_stock: false,
		},
		{
			id: "p2",
			sku: "CAB-SIN-CB",
			name: "Cable sin código",
			category: "Cables",
			sub_category: null,
			variant: null,
			barcode: null,
			brand: "Genérica",
			purchase_price: "5.00",
			sale_price: "9.90",
			has_movements: false,
			unvalued_stock: false,
		},
	],
	page: 1,
	per_page: 25,
	total: 2,
};

const ALMACENES = {
	data: [
		{ id: "a1", nombre: "Lima", ubicacion: null },
		{ id: "a2", nombre: "Trujillo", ubicacion: null },
	],
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("ProductosComponent", () => {
	let fixture: ComponentFixture<ProductosComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	async function responderPendientes(datos: Record<string, string[]> = {}) {
		await new Promise((resolver) => setTimeout(resolver, 350));
		await pintar();
		for (const req of http.match((r) => r.url === "/api/almacenes")) {
			req.flush(ALMACENES);
		}
		const pedidas = http
			.match((r) => r.url === "/api/productos/sugerencias")
			.map((req) => {
				const campo = req.request.params.get("campo") ?? "";
				req.flush({ data: datos[campo] ?? [] });
				return {
					campo,
					q: req.request.params.get("q"),
					categoria: req.request.params.get("categoria"),
				};
			});
		await pintar();
		return pedidas;
	}

	const boton = (texto: string) =>
		Array.from(html.querySelectorAll("button")).find((b) =>
			b.textContent?.includes(texto),
		) as HTMLButtonElement;

	const escribir = (selector: string, valor: string) => {
		const campo = html.querySelector(selector) as
			| HTMLInputElement
			| HTMLSelectElement;
		campo.value = valor;
		campo.dispatchEvent(
			new Event(campo instanceof HTMLSelectElement ? "change" : "input"),
		);
	};

	const opciones = (id: string) =>
		Array.from(html.querySelectorAll(`datalist#${id} option`)).map(
			(o) => (o as HTMLOptionElement).value,
		);

	async function editar(fila: number) {
		(
			html.querySelectorAll("tbody tr button[aria-label='Editar']")[
			fila
			] as HTMLButtonElement
		).click();
		fixture.detectChanges();
		await responderPendientes();
	}

	async function guardar(): Promise<TestRequest | null> {
		(html.querySelector("form") as HTMLFormElement).dispatchEvent(
			new Event("submit"),
		);
		await pintar();
		const [req] = http.match((r) => r.method === "POST" || r.method === "PUT");
		return req ?? null;
	}

	beforeEach(async () => {
		lienzoDeTexto();
		await TestBed.configureTestingModule({
			imports: [ProductosComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();

		fixture = TestBed.createComponent(ProductosComponent);
		http = TestBed.inject(HttpTestingController);
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		http.expectOne((r) => r.url === "/api/productos").flush(PAGINA);
		await pintar();
	});

	afterEach(() => {
		http.verify();
		vi.restoreAllMocks();
	});

	it("cada fila solo tiene Editar y Eliminar: ni Kardex ni código de barras", () => {
		const filas = html.querySelectorAll("tbody tr");
		expect(filas.length).toBe(2);
		for (const fila of Array.from(filas)) {
			const acciones = Array.from(fila.querySelectorAll("button, a")).map((e) =>
				e.getAttribute("aria-label"),
			);
			expect(acciones).toEqual(["Editar", "Eliminar"]);
		}
		expect(html.querySelector('a[href*="/kardex"]')).toBeNull();
	});

	it("«Solo sin costo» pide ?sin_costo=true y marca los que tienen stock valorizado en S/ 0", async () => {
		expect(html.textContent).not.toContain("Sin costo");

		boton("Solo sin costo").click();
		fixture.detectChanges();
		await turno();
		const req = http.expectOne((r) => r.url === "/api/productos");
		expect(req.request.params.get("sin_costo")).toBe("true");
		expect(req.request.params.get("page")).toBe("1");
		req.flush({
			...PAGINA,
			data: [
				{
					...PAGINA.data[0],
					id: "p3",
					sku: "ST-MEXC",
					purchase_price: "0.00",
					unvalued_stock: true,
				},
			],
			total: 1,
		});
		await pintar();

		expect(boton("Solo sin costo").getAttribute("aria-pressed")).toBe("true");
		const filas = html.querySelectorAll("tbody tr");
		expect(filas.length).toBe(1);
		expect(filas[0].textContent).toContain("ST-MEXC");
		expect(filas[0].textContent).toContain("Sin costo");
	});

	it("«Importar Excel» solo lo ve un administrador, y abre su modal", async () => {
		expect(boton("Importar Excel")).toBeUndefined(); // sin sesión de admin

		const sesion = TestBed.inject(AuthService).iniciarSesion({
			email: "admin@ejemplo.test",
			password: "clave-de-prueba",
		});
		http.expectOne("/api/auth/login").flush({
			user: {
				id: "u1",
				nombre: "Admin",
				email: "admin@ejemplo.test",
				rol: "ADMIN",
				cargo: null,
				is_admin: true,
			},
		});
		await sesion;
		await pintar();

		boton("Importar Excel").click();
		await pintar();
		expect(html.querySelector("app-importar-productos")).not.toBeNull();
	});

	it("el formulario no dibuja el código al lado del campo: su botón abre el modal, y Escape lo cierra", async () => {
		await editar(0);
		const formulario = html.querySelector("form") as HTMLFormElement;
		expect(formulario.querySelector("app-barcode")).toBeNull();

		const ver = boton("Ver código");
		expect(ver.disabled).toBe(false);
		ver.click();
		await pintar();
		await fixture.whenStable();
		const dialogo = html.querySelector("app-dialogo-codigo-barras");
		expect(dialogo?.textContent).toContain("ST-3C108WCM");
		expect(dialogo?.querySelector("svg rect")).not.toBeNull();
		http.expectNone((r) => r.method !== "GET");

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		await pintar();
		expect(html.querySelector("app-dialogo-codigo-barras")).toBeNull();
		expect(html.querySelector("form")).not.toBeNull(); // el formulario sigue abierto
	});

	it("sin el formulario abierto no se piden sugerencias ni almacenes", async () => {
		await responderPendientes();
		expect(html.querySelector("datalist")).toBeNull();
	});

	it("la marca sugiere lo ya usado al escribir, y la subcategoría se filtra por la categoría", async () => {
		boton("Nuevo Producto").click();
		fixture.detectChanges();
		await responderPendientes();

		expect(
			(html.querySelector("#brand") as HTMLInputElement).getAttribute("list"),
		).toBe("marcas-sugeridas");
		escribir("#brand", "sat");
		escribir("#category", "Cargadores");
		fixture.detectChanges();

		const pedidas = await responderPendientes({
			marca: ["Satechi"],
			sub_categoria: ["Cargador de pared"],
		});
		expect(pedidas).toContainEqual({
			campo: "marca",
			q: "sat",
			categoria: null,
		});
		expect(pedidas).toContainEqual({
			campo: "sub_categoria",
			q: null,
			categoria: "Cargadores",
		});
		expect(opciones("marcas-sugeridas")).toEqual(["Satechi"]);
		expect(opciones("subcategorias-sugeridas")).toEqual(["Cargador de pared"]);
	});

	it("el alta pide el costo, y el stock inicial exige almacén antes de enviar", async () => {
		boton("Nuevo Producto").click();
		fixture.detectChanges();
		await responderPendientes();

		escribir("#sku", "cab-001");
		escribir("#name", "Cable USB-C");
		escribir("#brand", "Uniq");
		escribir("#category", "Cables");
		escribir("#sale_price", "20");
		escribir("#purchase_price", "12.5");
		escribir("#initial_stock", "3");
		fixture.detectChanges();
		const almacenes = Array.from(
			html.querySelectorAll("#warehouse_id option"),
		).map((o) => o.textContent?.trim());
		expect(almacenes).toEqual(["Elige un almacén", "Lima", "Trujillo"]);

		expect(await guardar()).toBeNull();
		expect(html.textContent).toContain("Elige el almacén del stock inicial.");

		escribir("#warehouse_id", "a1");
		const req = await guardar();
		expect(req?.request.method).toBe("POST");
		expect(req?.request.body).toMatchObject({
			sku: "CAB-001",
			purchase_price: "12.50",
			initial_stock: 3,
			warehouse_id: "a1",
		});
		req?.flush({ data: { ...PAGINA.data[1], has_movements: true } });
		await responderPendientes();
		for (const r of http.match((r) => r.url === "/api/productos")) {
			r.flush(PAGINA);
		}
	});

	it("sin movimientos, Editar deja corregir el costo; sin stock no manda almacén", async () => {
		await editar(1);
		const costo = html.querySelector("#purchase_price") as HTMLInputElement;
		expect(Number(costo.value)).toBe(5);
		escribir("#purchase_price", "6");

		const req = await guardar();
		expect(req?.request.method).toBe("PUT");
		expect(req?.request.body.purchase_price).toBe("6.00");
		expect(req?.request.body).not.toHaveProperty("initial_stock");
		expect(req?.request.body).not.toHaveProperty("warehouse_id");
		req?.flush({ data: PAGINA.data[1] });
		await responderPendientes();
		for (const r of http.match((r) => r.url === "/api/productos")) {
			r.flush(PAGINA);
		}
	});

	it("con movimientos, el costo se ve fijo y no se manda: lo lleva el Kardex", async () => {
		await editar(0);
		expect(html.querySelector("#purchase_price")).toBeNull();
		expect(html.querySelector("#initial_stock")).toBeNull();
		expect(html.textContent).toContain("Costo unitario (Kardex)");
		expect(html.textContent).toContain("S/ 258.74");
		http.expectNone((r) => r.url === "/api/almacenes");

		const req = await guardar();
		expect(req?.request.method).toBe("PUT");
		expect(req?.request.body).not.toHaveProperty("purchase_price");
		expect(req?.request.body).not.toHaveProperty("initial_stock");
		req?.flush({ data: PAGINA.data[0] });
		await responderPendientes();
		for (const r of http.match((r) => r.url === "/api/productos")) {
			r.flush(PAGINA);
		}
	});
});
