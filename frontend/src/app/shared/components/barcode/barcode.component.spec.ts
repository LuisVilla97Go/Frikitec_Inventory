import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { lienzoDeTexto } from "../../../../testing/lienzo-de-texto";
import { BarcodeComponent } from "./barcode.component";

describe("BarcodeComponent", () => {
	let fixture: ComponentFixture<BarcodeComponent>;

	async function pintar(valor: string) {
		fixture.componentRef.setInput("value", valor);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}

	beforeEach(async () => {
		lienzoDeTexto();
		await TestBed.configureTestingModule({
			imports: [BarcodeComponent],
		}).compileComponents();
		fixture = TestBed.createComponent(BarcodeComponent);
	});

	afterEach(() => vi.restoreAllMocks());

	it("dibuja las barras de un código válido", async () => {
		await pintar("879961009380");
		const svg = fixture.nativeElement.querySelector("svg") as SVGSVGElement;
		expect(svg.querySelectorAll("rect").length).toBeGreaterThan(10);
		expect(svg.classList.contains("hidden")).toBe(false);
		expect(fixture.nativeElement.textContent).not.toContain(
			"no se puede dibujar",
		);
	});

	it("avisa en pantalla si el valor no cabe en CODE128, en vez de un recuadro vacío", async () => {
		await pintar("Código ñandú");
		expect(fixture.nativeElement.textContent).toContain(
			"no se puede dibujar como código de barras",
		);
		const svg = fixture.nativeElement.querySelector("svg") as SVGSVGElement;
		expect(svg.classList.contains("hidden")).toBe(true);
	});
});
