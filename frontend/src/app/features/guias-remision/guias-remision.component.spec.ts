import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { AuthService } from "../../core/auth/auth.service";
import type {
	Empresa,
	GuiaCompleta,
	Producto,
} from "../../shared/schemas/api.schema";
import {
	diaEnLima,
	GuiasRemisionComponent,
	reglaPieDeHoja,
} from "./guias-remision.component";

const ALMACENES = [
	{ id: "a-lima", nombre: "Tienda Lima", ubicacion: null },
	{ id: "a-trujillo", nombre: "Depósito Trujillo", ubicacion: null },
];

const EMPRESA: Empresa = {
	ruc: "20610949518",
	razon_social: "FRIKITEC PERU E.I.R.L.",
	nombre_comercial: "Frikitec",
	direccion_fiscal: "Av. Petit Thouars 5356",
	ubigeo: "150122",
	distrito: "Miraflores",
	provincia: "Lima",
	departamento: "Lima",
	telefono: null,
	correo: null,
	web: null,
	updated_at: "2026-09-28T10:00:00+00:00",
};

const GUIA: GuiaCompleta = {
	id: "g1",
	numero_guia: "EG01-000007",
	fecha_traslado: "2026-09-30T17:00:00+00:00",
	motivo_traslado: "04",
	estado: "EN_TRANSITO",
	origen: "Tienda Lima",
	destino: "Depósito Trujillo",
	total_items: 1,
	total_unidades: 3,
	almacen_origen_id: "a-lima",
	almacen_destino_id: "a-trujillo",
	proveedor_id: null,
	proveedor_documento: null,
	peso_bruto_total: 2.5,
	conductor_nombre: "Luis Villa",
	conductor_dni: null,
	vehiculo_placa: "ABC-123",
	motivo_anulacion: null,
	anulada_en: null,
	detalles: [
		{
			producto_id: "p1",
			producto_sku: "SKU1",
			producto_nombre: "Prod 1",
			cantidad: 3,
		},
	],
};

const producto = { id: "p1", sku: "SKU1", name: "Prod 1" } as Producto;

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("GuiasRemisionComponent", () => {
	let component: GuiasRemisionComponent;
	let fixture: ComponentFixture<GuiasRemisionComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;
	let empresa: Empresa | null;
	let guia: GuiaCompleta;
	let stock: number;

	function atender() {
		for (const req of http.match((r) => r.method === "GET")) {
			const url = req.request.url;
			if (url === "/api/almacenes") req.flush({ data: ALMACENES });
			else if (url === "/api/empresa") req.flush({ data: empresa });
			else if (url === "/api/guias-remision")
				req.flush({
					data: [guia],
					page: 1,
					per_page: 10,
					total: 1,
				});
			else if (url === "/api/guias-remision/stock-disponible")
				req.flush({
					data: (req.request.params.get("producto_ids") ?? "")
						.split(",")
						.map((producto_id) => ({ producto_id, stock })),
				});
			else if (url.startsWith("/api/guias-remision/"))
				req.flush({ data: guia });
			else if (url === "/api/proveedores")
				req.flush({
					data: [
						{
							id: "prov1",
							tipo_documento: "RUC",
							numero_documento: "20100070970",
							razon_social: "Distribuidora Andina S.A.C.",
							nombre_comercial: null,
						},
					],
				});
			else if (url === "/api/productos")
				req.flush({ data: [], page: 1, per_page: 10, total: 0 });
			else throw new Error(`GET inesperado: ${url}`);
		}
	}


	async function pintar() {
		for (let i = 0; i < 4; i++) {
			fixture.detectChanges();
			await turno();
			atender();
		}
		fixture.detectChanges();
	}

	async function iniciarSesion(cargo: string | null, esAdmin: boolean) {
		const login = TestBed.inject(AuthService).iniciarSesion({
			email: "yo@ejemplo.test",
			password: "x",
		});
		http.expectOne("/api/auth/login").flush({
			user: {
				id: "u1",
				nombre: "Yo",
				email: "yo@ejemplo.test",
				rol: esAdmin ? "ADMIN" : "TRABAJADOR",
				cargo,
				is_admin: esAdmin,
			},
		});
		await login;
	}

	const boton = (texto: string) =>
		Array.from(html.querySelectorAll("button")).find(
			(b) => b.textContent?.trim() === texto,
		) as HTMLButtonElement | undefined;

	async function montar({ admin = true, cargo = null as string | null } = {}) {
		await iniciarSesion(cargo, admin);
		fixture = TestBed.createComponent(GuiasRemisionComponent);
		component = fixture.componentInstance;
		html = fixture.nativeElement;
		await pintar();
	}

	beforeEach(async () => {
		empresa = EMPRESA;
		guia = GUIA;
		stock = 10;
		await TestBed.configureTestingModule({
			imports: [GuiasRemisionComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
	});

	async function llenarFormulario() {
		component["openForm"]();
		component["form"].patchValue({
			fecha_traslado: "2026-09-30",
			almacen_origen_id: "a-lima",
			almacen_destino_id: "a-trujillo",
			peso_bruto_total: 2.5,
		});
		component["selectProducto"](producto);
		await pintar();
	}

	it("la lista muestra las guías guardadas con su estado legible y abre la guía real", async () => {
		await montar();
		const fila = html.querySelector("tbody tr") as HTMLElement;
		expect(fila.textContent).toContain("EG01-000007");
		expect(fila.textContent).toContain("Tienda Lima");
		expect(fila.textContent).toContain("En tránsito");
		expect(html.textContent).not.toContain("EG01-001024");

		boton("Ver / Imprimir")?.click();
		await pintar();

		expect(component["currentView"]()).toBe("detail");
		expect(html.querySelector("h1")?.textContent).toContain("EG01-000007");
		const hoja = html.querySelector(".sheet-a4") as HTMLElement;
		expect(hoja.textContent).toContain("Tienda Lima");
		expect(hoja.textContent).toContain("Luis Villa");
		expect(hoja.textContent?.replace(/\s+/g, " ")).toContain(
			"Total: 1 ítem · 3 unidades",
		);
	});

	it("valida antes de enviar: campos obligatorios y al menos un producto", async () => {
		await montar();
		component["openForm"]();
		expect(component["currentView"]()).toBe("form");

		component["guardar"]();
		expect(component["formError"]()).toBe("Complete los campos obligatorios");

		component["form"].patchValue({
			fecha_traslado: "2026-09-24",
			almacen_origen_id: "a-lima",
			almacen_destino_id: "a-trujillo",
			peso_bruto_total: 10,
		});
		component["guardar"]();
		expect(component["formError"]()).toBe("Debe agregar al menos un producto");
		http.expectNone((r) => r.method === "POST");
	});

	it("el mismo producto dos veces suma cantidad; se puede cambiar y quitar", async () => {
		await montar();
		component["selectProducto"](producto);
		component["selectProducto"](producto);
		expect(component["detalles"]()).toEqual([
			{ producto_id: "p1", sku: "SKU1", nombre: "Prod 1", cantidad: 2 },
		]);

		component["updateCantidad"]("p1", 5);
		expect(component["detalles"]()[0].cantidad).toBe(5);
		component["updateCantidad"]("p1", 0);
		expect(component["detalles"]()[0].cantidad).toBe(5);

		component["removeDetalle"]("p1");
		expect(component["detalles"]()).toEqual([]);
	});

	it("guardar envía la guía con la fecha en hora de Lima y abre el detalle leído del servidor", async () => {
		await montar();
		await llenarFormulario();
		component["guardar"]();
		await turno();

		const req = http.expectOne(
			(r) => r.method === "POST" && r.url === "/api/guias-remision",
		);
		expect(req.request.body).toEqual({
			motivo_traslado: "04",
			almacen_origen_id: "a-lima",
			almacen_destino_id: "a-trujillo",
			proveedor_id: null,
			fecha_traslado: "2026-09-30T12:00:00-05:00",
			peso_bruto_total: 2.5,
			conductor_nombre: null,
			conductor_dni: null,
			vehiculo_placa: null,
			detalles: [{ producto_id: "p1", cantidad: 1 }],
		});
		req.flush(
			{
				status: "success",
				data: { id: "g1", numero_guia: "EG01-000007", estado: "EN_TRANSITO" },
			},
			{ status: 201, statusText: "Created" },
		);
		await pintar();

		expect(component["currentView"]()).toBe("detail");
		expect(html.querySelector("h1")?.textContent).toContain("EG01-000007");
		const hoja = html.querySelector(".sheet-a4") as HTMLElement;
		expect(hoja.textContent).toContain("Depósito Trujillo");
		expect(hoja.textContent).not.toContain("a-lima");
	});

	it("si el servidor rechaza la guía, se muestra su motivo y no se sale del formulario", async () => {
		await montar();
		await llenarFormulario();
		component["guardar"]();
		await turno();

		http
			.expectOne((r) => r.method === "POST")
			.flush(
				{ status: "error", message: "Stock insuficiente para Prod 1" },
				{ status: 409, statusText: "Conflict" },
			);
		await pintar();

		expect(component["currentView"]()).toBe("form");
		expect(html.textContent).toContain("Stock insuficiente para Prod 1");
	});

	it("G3: cada línea muestra su N.º y el stock del origen, y no deja pasar de él", async () => {
		stock = 4;
		await montar();
		await llenarFormulario();

		const fila = html.querySelector(
			'section[aria-label="Productos de la guía"] tbody tr',
		) as HTMLElement;
		expect(fila.querySelector("td")?.textContent?.trim()).toBe("1");
		expect(fila.textContent).toContain("4");
		const cantidad = fila.querySelector("input") as HTMLInputElement;
		expect(cantidad.getAttribute("max")).toBe("4");

		component["updateCantidad"]("p1", 6);
		await pintar();
		expect(html.textContent).toContain("Máximo 4");
		component["guardar"]();
		expect(component["formError"]()).toBe(
			"No alcanza el stock del origen para: Prod 1 (máx. 4)",
		);
		http.expectNone((r) => r.method === "POST");
	});

	it("G4: una guía de compra pide el proveedor, no el origen, y lo envía sin almacén de origen", async () => {
		await montar();
		await llenarFormulario();
		component["form"].patchValue({ motivo_traslado: "02" });
		await pintar();

		expect(html.querySelector("#proveedor")).not.toBeNull();
		expect(html.querySelector("#origen")).toBeNull();
		expect(html.textContent).not.toContain("Stock en origen");

		component["guardar"]();
		expect(component["formError"]()).toBe("Complete los campos obligatorios");

		component["form"].patchValue({ proveedor_id: "prov1" });
		component["guardar"]();
		await turno();
		const req = http.expectOne((r) => r.method === "POST");
		expect(req.request.body).toMatchObject({
			motivo_traslado: "02",
			almacen_origen_id: null,
			proveedor_id: "prov1",
		});
	});

	it("G5: los motivos llevan el código del catálogo 20 de SUNAT", async () => {
		await montar();
		component["openForm"]();
		await pintar();
		const opciones = Array.from(
			html.querySelectorAll("#motivo option"),
			(o) => `${(o as HTMLOptionElement).value}=${o.textContent?.trim()}`,
		);
		expect(opciones).toEqual([
			"04=04 - Traslado entre establecimientos",
			"01=01 - Venta",
			"02=02 - Compra",
		]);
	});

	it("G2: editar carga la guía en el formulario y guarda con PUT; lo que ya se llevó cuenta como disponible", async () => {
		stock = 7;
		await montar();
		component["openDetail"]({ id: "g1" });
		await pintar();
		boton("Editar")?.click();
		await pintar();

		expect(html.querySelector("h1")?.textContent).toContain(
			"Editar guía EG01-000007",
		);
		expect(component["form"].getRawValue()).toMatchObject({
			fecha_traslado: "2026-09-30",
			almacen_origen_id: "a-lima",
			conductor_nombre: "Luis Villa",
		});
		expect(component["disponible"]("p1")).toBe(10);
		expect((html.querySelector("#origen") as HTMLSelectElement).value).toBe(
			"a-lima",
		);

		component["form"].patchValue({ vehiculo_placa: "XYZ-999" });
		boton("Guardar cambios")?.click();
		await turno();
		const req = http.expectOne((r) => r.method === "PUT");
		expect(req.request.url).toBe("/api/guias-remision/g1");
		expect(req.request.body).toMatchObject({
			vehiculo_placa: "XYZ-999",
			detalles: [{ producto_id: "p1", cantidad: 3 }],
		});
	});

	it("G2: anular pide motivo y muestra la guía anulada", async () => {
		await montar();
		component["openDetail"]({ id: "g1" });
		await pintar();
		const dialogo = html.querySelector("dialog") as HTMLDialogElement;
		dialogo.showModal = vi.fn();
		dialogo.close = vi.fn();

		boton("Anular")?.click();
		expect(dialogo.showModal).toHaveBeenCalledOnce();
		boton("Anular guía")?.click();
		expect(component["anularError"]()).toBe(
			"Escribe el motivo (al menos 5 letras)",
		);

		component["motivoAnulacion"].setValue("Almacén equivocado");
		boton("Anular guía")?.click();
		await turno();
		const req = http.expectOne((r) => r.method === "POST");
		expect(req.request.url).toBe("/api/guias-remision/g1/anular");
		expect(req.request.body).toEqual({ motivo: "Almacén equivocado" });
		guia = {
			...GUIA,
			estado: "ANULADO",
			motivo_anulacion: "Almacén equivocado",
			anulada_en: "2026-09-30T20:00:00+00:00",
		};
		req.flush({ data: guia });
		await pintar();

		expect(dialogo.close).toHaveBeenCalled();
		const hoja = html.querySelector(".sheet-a4") as HTMLElement;
		expect(hoja.textContent).toContain("Guía anulada el 30/09/2026");
		expect(hoja.textContent).toContain("Motivo: Almacén equivocado");
		expect(boton("Editar")).toBeUndefined();
	});

	it("G2: un trabajador sin cargo de jefe no ve «Anular»; un jefe sí", async () => {
		await montar({ admin: false, cargo: "Vendedor" });
		component["openDetail"]({ id: "g1" });
		await pintar();
		expect(boton("Editar")).toBeDefined();
		expect(boton("Anular")).toBeUndefined();

		await iniciarSesion("Jefe de Tienda", false);
		fixture.detectChanges();
		expect(boton("Anular")).toBeDefined();
	});

	it("G6: la hoja lleva la empresa de Maestros › Empresa", async () => {
		await montar();
		component["openDetail"]({ id: "g1" });
		await pintar();
		const hoja = html.querySelector(".sheet-a4") as HTMLElement;
		expect(hoja.textContent).toContain("FRIKITEC PERU E.I.R.L.");
		expect(hoja.textContent).toContain("Av. Petit Thouars 5356");
		expect(hoja.textContent).toContain("Miraflores - Lima - Lima");
		expect(hoja.textContent).toContain("RUC: 20610949518");
		expect(hoja.textContent).not.toContain("Garcilaso");
	});

	it("G6: sin ficha de empresa, la hoja lo avisa y no inventa el RUC", async () => {
		empresa = null;
		await montar();
		component["openDetail"]({ id: "g1" });
		await pintar();
		const hoja = html.querySelector(".sheet-a4") as HTMLElement;
		expect(hoja.textContent).toContain("Faltan los datos de la empresa");
		expect(hoja.textContent).toContain("RUC: —");
		expect(hoja.textContent).not.toContain("20610949518");
	});

	it("carga su hoja de estilos: la guía mide 210 mm (A4), no todo el ancho", async () => {
		await montar();
		const estilos = Array.from(document.querySelectorAll("style"))
			.map((s) => s.textContent)
			.join("\n");
		expect(estilos).toMatch(/\.sheet-a4\[[^\]]+\]\s*\{[^}]*width:\s*210mm/);
	});

	it("cada hoja impresa lleva la empresa, el número de guía y «Hoja X de Y», solo mientras se ve la guía", async () => {
		await montar();
		const reglaDelPie = () =>
			Array.from(document.head.querySelectorAll("style"))
				.map((s) => s.textContent ?? "")
				.find((t) => t.includes("@bottom-left"));

		expect(reglaDelPie()).toBeUndefined();
		component["openDetail"]({ id: "g1" });
		await pintar();
		expect(reglaDelPie()).toContain(
			'"FRIKITEC PERU E.I.R.L. · RUC 20610949518 · Guía EG01-000007"',
		);
		expect(reglaDelPie()).toContain(
			'"Hoja " counter(page) " de " counter(pages)',
		);

		component["openList"]();
		await pintar();
		expect(reglaDelPie()).toBeUndefined();
	});

	it("el pie entra como texto CSS: una comilla no cierra la cadena; sin empresa, solo el número", () => {
		expect(reglaPieDeHoja('EG01"}\n*{')).toContain('"Guía EG01\\"} *{"');
		expect(reglaPieDeHoja("EG01\\")).toContain('"Guía EG01\\\\"');
		expect(
			reglaPieDeHoja("EG01-1", { razon_social: 'A "B"', ruc: "1" }),
		).toContain('"A \\"B\\" · RUC 1 · Guía EG01-1"');
	});

	it("la fecha guardada se edita como el día de Lima", () => {
		expect(diaEnLima("2026-09-30T17:00:00+00:00")).toBe("2026-09-30");
		expect(diaEnLima("2026-10-01T02:00:00+00:00")).toBe("2026-09-30");
	});

	it("volver a la lista limpia la guía, la edición y el error", async () => {
		await montar();
		component["openDetail"]({ id: "g1" });
		component["formError"].set("algo");
		component["openList"]();

		expect(component["currentView"]()).toBe("list");
		expect(component["guiaId"]()).toBeNull();
		expect(component["editando"]()).toBeNull();
		expect(component["formError"]()).toBeNull();
	});

	it("un código escaneado cierra la cámara y lo pone en el buscador", async () => {
		await montar();
		vi.useFakeTimers();
		try {
			component["openScanner"]();
			expect(component["isScannerOpen"]()).toBe(true);

			component["manejarCodigo"]("7501234567890");
			expect(component["isScannerOpen"]()).toBe(false);
			expect(component["searchControl"].value).toBe("7501234567890");
			expect(component["showAutocomplete"]()).toBe(true);
			expect(component["scanResult"]()).toContain("7501234567890");

			vi.advanceTimersByTime(4000);
			expect(component["scanResult"]()).toBeNull();
		} finally {
			vi.useRealTimers();
		}
	});

	it("cerrar el escáner detiene la cámara", async () => {
		await montar();
		const stop = vi.fn();
		component["controls"] = { stop } as never;
		component["activo"].set(true);

		component["closeScanner"]();
		expect(stop).toHaveBeenCalledOnce();
		expect(component["activo"]()).toBe(false);
		expect(component["isScannerOpen"]()).toBe(false);
	});
});
