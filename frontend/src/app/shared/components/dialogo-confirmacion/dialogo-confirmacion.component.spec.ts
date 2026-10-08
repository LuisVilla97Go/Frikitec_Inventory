import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { DialogoConfirmacionComponent } from "./dialogo-confirmacion.component";

describe("DialogoConfirmacionComponent", () => {
	let fixture: ComponentFixture<DialogoConfirmacionComponent>;
	const abrirDialogo = HTMLDialogElement.prototype.showModal;
	const cerrarDialogo = HTMLDialogElement.prototype.close;
	const cerrar = vi.fn(function (this: HTMLDialogElement) {
		this.removeAttribute("open");
	});
	const abrir = vi.fn(function (this: HTMLDialogElement) {
		this.setAttribute("open", "");
	});

	beforeEach(async () => {
		abrir.mockClear();
		cerrar.mockClear();
		HTMLDialogElement.prototype.showModal = abrir;
		HTMLDialogElement.prototype.close = cerrar;
		await TestBed.configureTestingModule({
			imports: [DialogoConfirmacionComponent],
		}).compileComponents();
		fixture = TestBed.createComponent(DialogoConfirmacionComponent);
		fixture.componentRef.setInput("titulo", "Eliminar producto");
		fixture.componentRef.setInput("mensaje", "¿Seguro?");
		fixture.detectChanges();
	});

	afterEach(() => {
		HTMLDialogElement.prototype.showModal = abrirDialogo;
		HTMLDialogElement.prototype.close = cerrarDialogo;
	});

	it("abre en la capa modal una sola vez y expone el título y la descripción", () => {
		fixture.detectChanges();
		const dialogo = fixture.nativeElement.querySelector("dialog");
		expect(abrir).toHaveBeenCalledOnce();
		expect(dialogo.open).toBe(true);
		expect(dialogo.getAttribute("aria-label")).toBe("Eliminar producto");
		expect(
			fixture.nativeElement.querySelector(
				`#${dialogo.getAttribute("aria-describedby")}`,
			).textContent,
		).toBe("¿Seguro?");
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
		const evento = new Event("cancel", { cancelable: true });
		fixture.nativeElement.querySelector("dialog").dispatchEvent(evento);
		expect(evento.defaultPrevented).toBe(true);
		expect(cancelado).toBe(true);
		expect(cerrar).toHaveBeenCalledOnce();
	});

	it("Cancelar emite sin confirmar la acción", () => {
		const cancelar = vi.fn();
		const confirmar = vi.fn();
		fixture.componentInstance.cancelar.subscribe(cancelar);
		fixture.componentInstance.confirmar.subscribe(confirmar);
		fixture.nativeElement.querySelector("button").click();
		expect(cancelar).toHaveBeenCalledOnce();
		expect(confirmar).not.toHaveBeenCalled();
		expect(cerrar).toHaveBeenCalledOnce();
	});

	it("retirar la confirmación después de completar la acción cierra el diálogo nativo", () => {
		fixture.destroy();
		expect(cerrar).toHaveBeenCalledOnce();
	});

	it("una petición pendiente bloquea confirmar, Cancelar y Escape", () => {
		const cancelar = vi.fn();
		const confirmar = vi.fn();
		fixture.componentInstance.cancelar.subscribe(cancelar);
		fixture.componentInstance.confirmar.subscribe(confirmar);
		fixture.componentRef.setInput("ocupado", true);
		fixture.detectChanges();
		const botones = fixture.nativeElement.querySelectorAll("button");
		for (const boton of botones) {
			expect(boton.disabled).toBe(true);
			boton.click();
		}
		const evento = new Event("cancel", { cancelable: true });
		fixture.nativeElement.querySelector("dialog").dispatchEvent(evento);
		expect(evento.defaultPrevented).toBe(true);
		expect(cancelar).not.toHaveBeenCalled();
		expect(confirmar).not.toHaveBeenCalled();
		expect(botones[1].textContent).toContain("Procesando…");
		fixture.componentRef.setInput("ocupado", false);
		fixture.detectChanges();
		botones[0].click();
		expect(cancelar).toHaveBeenCalledOnce();
	});

	it("Tab y Shift+Tab enlazan los extremos sin salir del diálogo", () => {
		const [primero, ultimo] = fixture.nativeElement.querySelectorAll("button");
		ultimo.focus();
		ultimo.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
		);
		expect(document.activeElement).toBe(primero);
		primero.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "Tab",
				shiftKey: true,
				bubbles: true,
			}),
		);
		expect(document.activeElement).toBe(ultimo);
	});
});
