import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { QueryClient } from "@tanstack/angular-query-experimental";

import { proveedoresDeTest } from "../../../../testing/proveedores-test";
import {
	ImportarProductosComponent,
	MAX_BYTES,
} from "./importar-productos.component";

const IMPORTAR = "/api/productos/importar";

const LIMPIO = {
	nuevos: 1,
	actualizados: 163,
	sin_cambios: 373,
	total_errores: 0,
	total_avisos: 1,
	errores: [],
	avisos: [
		{
			fila: 240,
			columna: "Stock Total",
			mensaje: "Dice 4, pero Lima + Trujillo suman 5: se carga 5",
		},
	],
};

const CON_ERRORES = {
	...LIMPIO,
	total_errores: 1,
	errores: [
		{
			fila: 7,
			columna: "Costo Unitario",
			mensaje: "Un producto nuevo necesita su costo",
		},
	],
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("ImportarProductosComponent", () => {
	let fixture: ComponentFixture<ImportarProductosComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	const boton = (texto: string) =>
		Array.from(html.querySelectorAll("button")).find((b) =>
			b.textContent?.includes(texto),
		) as HTMLButtonElement;

	function elegir(archivo: File) {
		const entrada = html.querySelector("input[type=file]") as HTMLInputElement;
		Object.defineProperty(entrada, "files", {
			value: [archivo],
			configurable: true,
		});
		entrada.dispatchEvent(new Event("change"));
		fixture.detectChanges();
	}

	const excel = (nombre = "catalogo.xlsx") =>
		new File([new Uint8Array([0x50, 0x4b, 3, 4])], nombre);

	async function revisar(resumen: object) {
		elegir(excel());
		boton("Revisar").click();
		await pintar();
		const req = http.expectOne(`${IMPORTAR}?modo=simular`);
		expect(req.request.method).toBe("POST");
		expect((req.request.body as FormData).get("archivo")).toBeInstanceOf(File);
		req.flush({ status: "success", data: resumen });
		await pintar();
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ImportarProductosComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		fixture = TestBed.createComponent(ImportarProductosComponent);
		http = TestBed.inject(HttpTestingController);
		html = fixture.nativeElement;
		fixture.detectChanges();
	});

	afterEach(() => {
		http.verify();
		vi.restoreAllMocks();
	});

	it("revisar no aplica: muestra el resumen y las filas con error, y Aplicar sigue deshabilitado", async () => {
		expect(boton("Revisar").disabled).toBe(true);
		await revisar(CON_ERRORES);

		expect(html.textContent).toContain("163");
		const errores = html.querySelector("section[aria-label='Errores']");
		expect(errores?.textContent).toContain("7");
		expect(errores?.textContent).toContain("Costo Unitario");
		expect(errores?.textContent).toContain(
			"Un producto nuevo necesita su costo",
		);
		expect(boton("Aplicar").disabled).toBe(true);
	});

	it("sin errores, Aplicar manda el mismo archivo y refresca catálogo y Kardex", async () => {
		const invalidar = vi.spyOn(
			TestBed.inject(QueryClient),
			"invalidateQueries",
		);
		await revisar(LIMPIO);
		expect(
			html.querySelector("section[aria-label='Avisos']")?.textContent,
		).toContain("240");

		const aplicar = boton("Aplicar");
		expect(aplicar.disabled).toBe(false);
		aplicar.click();
		await pintar();
		http
			.expectOne(`${IMPORTAR}?modo=aplicar`)
			.flush({ status: "success", data: LIMPIO });
		await pintar();

		expect(html.querySelector("[role=status]")?.textContent).toContain(
			"1 nuevos y 163 actualizados",
		);
		const claves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);
		expect(claves).toEqual([["productos"], ["kardex"]]);
	});

	it("si al aplicar el backend encuentra errores (422), los muestra por fila", async () => {
		await revisar(LIMPIO);
		boton("Aplicar").click();
		await pintar();
		http.expectOne(`${IMPORTAR}?modo=aplicar`).flush(
			{
				status: "error",
				message: "El archivo tiene 1 errores: no se aplicó nada",
				data: CON_ERRORES,
			},
			{ status: 422, statusText: "Unprocessable Entity" },
		);
		await pintar();

		expect(html.querySelector("[role=alert]")?.textContent).toContain(
			"no se aplicó nada",
		);
		expect(
			html.querySelector("section[aria-label='Errores']")?.textContent,
		).toContain("Costo Unitario");
		expect(boton("Aplicar").disabled).toBe(true);
	});

	it("otro archivo invalida la revisión anterior", async () => {
		await revisar(LIMPIO);
		elegir(excel("otro.xlsx"));
		expect(boton("Aplicar").disabled).toBe(true);
		expect(html.querySelector("dl")).toBeNull();
	});

	it("no sube lo que no es .xlsx ni lo que pasa de 1 MB", () => {
		elegir(excel("catalogo.csv"));
		expect(html.querySelector("[role=alert]")?.textContent).toContain(".xlsx");
		expect(boton("Revisar").disabled).toBe(true);

		elegir(new File([new Uint8Array(MAX_BYTES + 1)], "grande.xlsx"));
		expect(html.querySelector("[role=alert]")?.textContent).toContain("1 MB");
		expect(boton("Revisar").disabled).toBe(true);
	});

	it("descarga la plantilla por HttpClient y la guarda con su nombre", async () => {
		URL.createObjectURL = vi.fn(() => "blob:plantilla");
		URL.revokeObjectURL = vi.fn();
		const clic = vi
			.spyOn(HTMLAnchorElement.prototype, "click")
			.mockImplementation(() => undefined);

		boton("Descargar plantilla").click();
		await pintar();
		const req = http.expectOne("/api/productos/plantilla");
		expect(req.request.responseType).toBe("blob");
		req.flush(new Blob(["xlsx"]));
		await pintar();

		expect(clic).toHaveBeenCalledOnce();
		const enlace = clic.mock.contexts[0] as HTMLAnchorElement;
		expect(enlace.download).toBe("plantilla-productos.xlsx");
		expect(enlace.href).toBe("blob:plantilla");
	});

	it("Escape y Cancelar cierran el modal", () => {
		let cierres = 0;
		fixture.componentInstance.cerrar.subscribe(() => {
			cierres++;
		});
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		boton("Cancelar").click();
		expect(cierres).toBe(2);
	});
});
