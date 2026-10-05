import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { lienzoDeTexto } from "../../../../testing/lienzo-de-texto";
import { DialogoCodigoBarrasComponent } from "./dialogo-codigo-barras.component";

describe("DialogoCodigoBarrasComponent", () => {
	let fixture: ComponentFixture<DialogoCodigoBarrasComponent>;

	afterEach(() => vi.restoreAllMocks());

	beforeEach(async () => {
		lienzoDeTexto();
		await TestBed.configureTestingModule({
			imports: [DialogoCodigoBarrasComponent],
		}).compileComponents();
		fixture = TestBed.createComponent(DialogoCodigoBarrasComponent);
		fixture.componentRef.setInput("codigo", "879961009380");
		fixture.componentRef.setInput(
			"nombre",
			"108W USB-C 3-Port GaN Wall Charger",
		);
		fixture.componentRef.setInput("sku", "ST-3C108WCM");
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it("muestra el código dibujado con el nombre y el SKU del producto", () => {
		const html = fixture.nativeElement as HTMLElement;
		expect(html.querySelector("app-barcode svg rect")).not.toBeNull();
		expect(html.textContent).toContain("108W USB-C 3-Port GaN Wall Charger");
		expect(html.textContent).toContain("ST-3C108WCM");
	});

	it("se cierra con Escape y con el botón Cerrar", () => {
		let cierres = 0;
		fixture.componentInstance.cerrar.subscribe(() => {
			cierres++;
		});
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		const botones = (fixture.nativeElement as HTMLElement).querySelectorAll(
			"button",
		);
		botones[botones.length - 1].click();
		expect(cierres).toBe(2);
	});
});
