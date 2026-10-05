import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { KardexComponent } from "./kardex.component";

const KARDEX = {
	status: "success",
	data: {
		id: "p1",
		sku: "CAB-USB-C",
		name: "Cable tipo C",
		category: "Cables",
		unit: "UND",
		location: "General",
		minStock: 0,
		warehouses: [
			{ id: "a-lima", name: "Lima" },
			{ id: "a-trujillo", name: "Trujillo" },
		],
		warehouseId: null as string | null,
		movements: <Record<string, unknown>[]>[
			{
				id: "m1",
				date: "2026-09-01",
				docType: "FACTURA",
				docNumber: "F1",
				detail: "ENTRADA_COMPRA",
				warehouse: "Lima",
				type: "ENTRADA",
				qty: 3,
				unitCost: "33.3333",
				amount: "100.00",
				balanceQty: 3,
				balanceCost: "33.3333",
				balanceValue: "100.00",
			},
			{
				id: "m2",
				date: "2026-09-02",
				docType: "BOLETA",
				docNumber: "B1",
				detail: "SALIDA_VENTA",
				warehouse: "Lima",
				type: "SALIDA",
				qty: 1,
				unitCost: "33.3300",
				amount: "33.33",
				balanceQty: 2,
				balanceCost: "33.3350",
				balanceValue: "66.67",
			},
		],
	},
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("KardexComponent", () => {
	let fixture: ComponentFixture<KardexComponent>;
	let http: HttpTestingController;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [KardexComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();

		fixture = TestBed.createComponent(KardexComponent);
		http = TestBed.inject(HttpTestingController);
	});

	const cargarKardex = async (url: string, respuesta: typeof KARDEX) => {
		await turno();
		http.expectOne(url).flush(respuesta);
		for (const req of http.match(
			(r) => r.url === "/api/productos?page=1&per_page=10",
		)) {
			req.flush({ data: [], page: 1, per_page: 10, total: 0 });
		}
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
		return (fixture.nativeElement as HTMLElement).textContent ?? "";
	};

	it("con ?producto=<id> muestra el Kardex valorizado que manda el servidor, sin recalcularlo", async () => {
		fixture.componentRef.setInput("producto", "p1");
		fixture.detectChanges();

		const texto = await cargarKardex("/api/productos/p1/kardex", KARDEX);

		expect(texto).toContain("66.67");
		expect(texto).toContain("33.3350");
		expect(texto).toContain("Mostrando 2 de 2 registros");
		expect(texto).toContain("Global");
		expect(texto).toContain("Trujillo");
		expect(texto).toContain("Lima");
	});

	it("la pestaña de una tienda pide el Kardex de esa tienda", async () => {
		fixture.componentRef.setInput("producto", "p1");
		fixture.detectChanges();
		await cargarKardex("/api/productos/p1/kardex", KARDEX);

		const pestanas = [
			...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
				'[role="tab"]',
			),
		];
		pestanas.find((b) => b.textContent?.trim() === "Trujillo")?.click();
		fixture.detectChanges();

		const texto = await cargarKardex(
			"/api/productos/p1/kardex?almacen_id=a-trujillo",
			{
				...KARDEX,
				data: { ...KARDEX.data, warehouseId: "a-trujillo", movements: [] },
			},
		);
		expect(texto).toContain("Sin movimientos registrados");
	});

	it("sin producto elegido muestra cómo elegirlo, no un «0 · Agotado» engañoso", async () => {
		fixture.detectChanges();
		await turno();
		for (const req of http.match(
			(r) => r.url === "/api/productos?page=1&per_page=10",
		)) {
			req.flush({ data: [], page: 1, per_page: 10, total: 0 });
		}
		fixture.detectChanges();

		const vista = fixture.nativeElement as HTMLElement;
		expect(vista.textContent).toContain(
			"Selecciona un producto para ver y gestionar sus movimientos.",
		);
		expect(vista.textContent).not.toContain("Agotado");
		expect(vista.textContent).not.toContain("Sin categoría");
		http.expectNone("/api/productos/undefined/kardex");
	});
});
