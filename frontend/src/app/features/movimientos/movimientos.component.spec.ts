import {
	HttpTestingController,
	type TestRequest,
} from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { MovimientosComponent } from "./movimientos.component";

const LIBRO = {
	status: "success",
	data: [
		{
			id: "m2",
			date: "2026-09-15",
			movementType: "SALIDA_VENTA",
			docType: "BOLETA",
			docNumber: "B001-7",
			productId: "p1",
			sku: "CAB-USB-C",
			productName: "Cable tipo C",
			warehouseId: "a1",
			warehouse: "Lima",
			qty: -3,
			balance: 7,
			unitCost: "5.0000",
			currency: "PEN",
			user: "Admin Prueba",
		},
		{
			id: "m1",
			date: "2026-09-14",
			movementType: "ENTRADA_COMPRA",
			docType: "FACTURA",
			docNumber: "F001-1",
			productId: "p1",
			sku: "CAB-USB-C",
			productName: "Cable tipo C",
			warehouseId: "a1",
			warehouse: "Lima",
			qty: 10,
			balance: 10,
			unitCost: "5.0000",
			currency: "PEN",
			user: "Admin Prueba",
		},
	],
	page: 1,
	per_page: 50,
	total: 2,
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("MovimientosComponent (libro diario)", () => {
	let fixture: ComponentFixture<MovimientosComponent>;
	let http: HttpTestingController;

	async function peticionDelLibro(): Promise<TestRequest> {
		await turno();
		for (const req of http.match((r) => r.url === "/api/almacenes")) {
			req.flush({ data: [{ id: "a1", nombre: "Lima", ubicacion: null }] });
		}
		return http.expectOne((r) => r.url === "/api/movimientos");
	}

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MovimientosComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();

		fixture = TestBed.createComponent(MovimientosComponent);
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it("muestra todos los movimientos con su signo, tipo legible y enlace al Kardex", async () => {
		fixture.detectChanges();
		const req = await peticionDelLibro();
		expect(req.request.params.get("page")).toBe("1");
		expect(req.request.params.has("desde")).toBe(false); // vacío = no se manda
		req.flush(LIBRO);
		await pintar();

		const filas = fixture.nativeElement.querySelectorAll("tbody tr");
		expect(filas.length).toBe(2);
		const venta = filas[0].textContent as string;
		expect(venta).toContain("B001-7");
		expect(venta).toContain("Venta");
		expect(venta).toContain("-3");
		const enlace = filas[0].querySelector("a") as HTMLAnchorElement;
		expect(enlace.getAttribute("href")).toBe("/kardex?producto=p1");
		expect(fixture.nativeElement.textContent).toContain("2 movimientos");
	});

	it("manda los filtros al backend y vuelve a la página 1", async () => {
		fixture.detectChanges();
		(await peticionDelLibro()).flush(LIBRO);
		await pintar();

		const desde = fixture.nativeElement.querySelector(
			"#desde",
		) as HTMLInputElement;
		desde.value = "2026-09-15";
		desde.dispatchEvent(new Event("change"));
		const tipo = fixture.nativeElement.querySelector(
			"#tipo",
		) as HTMLSelectElement;
		tipo.value = "SALIDA_VENTA";
		tipo.dispatchEvent(new Event("change"));
		fixture.detectChanges();

		const req = await peticionDelLibro();
		expect(req.request.params.get("desde")).toBe("2026-09-15");
		expect(req.request.params.get("tipo_movimiento")).toBe("SALIDA_VENTA");
		expect(req.request.params.get("page")).toBe("1");
		req.flush({ ...LIBRO, data: [LIBRO.data[0]], total: 1 });
		await pintar();
	});

	it("con el rango al revés avisa y no consulta", async () => {
		fixture.detectChanges();
		(await peticionDelLibro()).flush(LIBRO);
		await pintar();

		for (const [id, valor] of [
			["#desde", "2026-09-20"],
			["#hasta", "2026-09-10"],
		]) {
			const input = fixture.nativeElement.querySelector(id) as HTMLInputElement;
			input.value = valor;
			input.dispatchEvent(new Event("change"));
		}
		fixture.detectChanges();
		await turno();

		expect(http.match((r) => r.url === "/api/movimientos").length).toBe(0);
		expect(fixture.nativeElement.textContent).toContain("posterior a «Hasta»");
	});

	it("un tipo de movimiento desconocido falla en la capa de datos, no en la tabla", async () => {
		fixture.detectChanges();
		const req = await peticionDelLibro();
		req.flush({
			...LIBRO,
			data: [{ ...LIBRO.data[0], movementType: "INVENTADO" }],
		});
		await pintar();

		expect(fixture.nativeElement.textContent).toContain(
			"No se pudieron cargar los movimientos.",
		);
	});
});
