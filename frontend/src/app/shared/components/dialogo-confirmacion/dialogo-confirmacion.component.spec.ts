import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DialogoConfirmacionComponent } from "./dialogo-confirmacion.component";

describe("DialogoConfirmacionComponent", () => {
	let fixture: ComponentFixture<DialogoConfirmacionComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogoConfirmacionComponent],
		}).compileComponents();
		fixture = TestBed.createComponent(DialogoConfirmacionComponent);
		fixture.componentRef.setInput("titulo", "Eliminar producto");
		fixture.componentRef.setInput("mensaje", "¿Seguro?");
		fixture.detectChanges();
	});

	it("emite confirmar al pulsar el botón principal", () => {
		let confirmado = false;
		fixture.componentInstance.confirmar.subscribe(() => {
			confirmado = true;
		});
		const botones = (fixture.nativeElement as HTMLElement).querySelectorAll(
			"button",
		);
		botones[botones.length - 1].click();
		expect(confirmado).toBe(true);
	});

	it("Escape cancela", () => {
		let cancelado = false;
		fixture.componentInstance.cancelar.subscribe(() => {
			cancelado = true;
		});
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
		expect(cancelado).toBe(true);
	});
});
