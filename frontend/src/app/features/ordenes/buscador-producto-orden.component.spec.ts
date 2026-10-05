import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { BuscadorProductoOrdenComponent } from "./buscador-producto-orden.component";

const PRODUCTO = {
	id: "p1",
	sku: "CAB-001",
	name: "Cable trenzado USB C",
	category: "Accesorios",
	sub_category: null,
	variant: null,
	barcode: "7751234567890",
	brand: "Frikitec",
	purchase_price: 12.5,
	sale_price: 25,
	has_movements: false,
	unvalued_stock: false,
};

describe("BuscadorProductoOrdenComponent", () => {
	let fixture: ComponentFixture<BuscadorProductoOrdenComponent>;
	let http: HttpTestingController;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [BuscadorProductoOrdenComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
		fixture = TestBed.createComponent(BuscadorProductoOrdenComponent);
		fixture.componentRef.setInput("inputId", "producto-prueba");
		fixture.componentRef.setInput("productoId", "");
		fixture.detectChanges();
	});

	afterEach(() => http.verify());

	it("busca por parte del nombre y elige el producto sin un selector adicional", async () => {
		const elegido = vi.fn();
		fixture.componentInstance.productoCambia.subscribe(elegido);
		const campo = fixture.nativeElement.querySelector(
			"input",
		) as HTMLInputElement;
		campo.value = "trenzado";
		campo.dispatchEvent(new Event("input"));
		await new Promise((resolve) => setTimeout(resolve, 300));
		fixture.detectChanges();
		const peticion = http.expectOne(
			(r) =>
				r.url === "/api/productos" && r.params.get("search") === "trenzado",
		);
		expect(peticion.request.params.get("per_page")).toBe("20");
		peticion.flush({
			status: "success",
			data: [PRODUCTO],
			page: 1,
			per_page: 20,
			total: 1,
		});
		for (let i = 0; i < 4; i++) {
			await new Promise((resolve) => setTimeout(resolve, 0));
			fixture.detectChanges();
		}
		expect(fixture.nativeElement.textContent).toContain("Cable trenzado USB C");
		const opcion = fixture.nativeElement.querySelector(
			'[role="option"]',
		) as HTMLElement;
		opcion.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
		expect(elegido).toHaveBeenCalledWith("p1");
		fixture.componentRef.setInput("productoId", "p1");
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain("CAB-001");
	});
});
