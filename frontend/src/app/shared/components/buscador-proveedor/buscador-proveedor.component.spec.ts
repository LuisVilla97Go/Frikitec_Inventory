import { Component, signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { FormControl, ReactiveFormsModule } from "@angular/forms";

import type { Proveedor } from "../../schemas/api.schema";
import {
	BuscadorProveedorComponent,
	buscarProveedores,
	proveedorPorDocumento,
} from "./buscador-proveedor.component";

function proveedor(
	id: string,
	numero: string,
	razon: string,
	comercial: string | null = null,
): Proveedor {
	return {
		id,
		tipo_documento: numero.length === 11 ? "RUC" : "DNI",
		numero_documento: numero,
		razon_social: razon,
		nombre_comercial: comercial,
		contacto: null,
		telefono: null,
		correo: null,
		is_active: true,
	};
}

const PROVEEDORES = [
	proveedor("p1", "20123456789", "Distribuidora Andina S.A.C.", "Andina Tech"),
	proveedor("p2", "20600000001", "Importaciones Perú E.I.R.L."),
	proveedor("p3", "45678912", "Juan Pérez"),
];

describe("buscarProveedores", () => {
	it("encuentra por RUC, razón social, nombre comercial y sin tildes", () => {
		expect(buscarProveedores(PROVEEDORES, "2012").map((p) => p.id)).toEqual([
			"p1",
		]);
		expect(buscarProveedores(PROVEEDORES, "andina").map((p) => p.id)).toEqual([
			"p1",
		]);
		expect(buscarProveedores(PROVEEDORES, "peru").map((p) => p.id)).toEqual([
			"p2",
		]);
		expect(
			buscarProveedores(PROVEEDORES, "tech distribuidora").map((p) => p.id),
		).toEqual(["p1"]);
		expect(buscarProveedores(PROVEEDORES, "   ")).toEqual([]);
	});

	it("solo un RUC o DNI completo y existente elige solo", () => {
		expect(proveedorPorDocumento(PROVEEDORES, " 20123456789 ")?.id).toBe("p1");
		expect(proveedorPorDocumento(PROVEEDORES, "45678912")?.id).toBe("p3");
		expect(proveedorPorDocumento(PROVEEDORES, "2012345678")).toBeNull();
		expect(proveedorPorDocumento(PROVEEDORES, "20999999999")).toBeNull();
	});
});

@Component({
	imports: [BuscadorProveedorComponent, ReactiveFormsModule],
	template: `<app-buscador-proveedor [formControl]="control" [proveedores]="lista()" inputId="prov" />`,
})
class Anfitrion {
	readonly control = new FormControl("", { nonNullable: true });
	readonly lista = signal(PROVEEDORES);
}

describe("BuscadorProveedorComponent", () => {
	function montar() {
		const fixture = TestBed.createComponent(Anfitrion);
		fixture.detectChanges();
		const html: HTMLElement = fixture.nativeElement;
		const escribir = (texto: string) => {
			const input = html.querySelector("#prov") as HTMLInputElement;
			input.value = texto;
			input.dispatchEvent(new Event("input"));
			fixture.detectChanges();
		};
		return { fixture, html, escribir };
	}

	it("con el RUC completo rellena la razón social y el valor del formulario", () => {
		const { fixture, html, escribir } = montar();
		escribir("20123456789");
		expect(fixture.componentInstance.control.value).toBe("p1");
		expect(html.textContent).toContain("Distribuidora Andina S.A.C.");
		expect(html.textContent).toContain("RUC 20123456789");
		expect(html.querySelector("#prov")).toBeNull();
	});

	it("con parte del nombre lista coincidencias y se elige con el teclado", () => {
		const { fixture, html, escribir } = montar();
		escribir("import");
		expect(html.querySelectorAll('[role="option"]').length).toBe(1);
		const input = html.querySelector("#prov") as HTMLInputElement;
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
		input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
		fixture.detectChanges();
		expect(fixture.componentInstance.control.value).toBe("p2");
	});

	it("sin coincidencias dice dónde registrarlo, y quitar deja el valor vacío", () => {
		const { fixture, html, escribir } = montar();
		escribir("zzz");
		expect(html.textContent).toContain("Maestros › Proveedores");
		escribir("45678912");
		(html.querySelector("button") as HTMLButtonElement).click();
		fixture.detectChanges();
		expect(fixture.componentInstance.control.value).toBe("");
		expect(html.querySelector("#prov")).not.toBeNull();
	});

	it("muestra el proveedor que ya trae el formulario y respeta disabled", () => {
		const { fixture, html } = montar();
		fixture.componentInstance.control.setValue("p3");
		fixture.componentInstance.control.disable();
		fixture.detectChanges();
		expect(html.textContent).toContain("Juan Pérez");
		expect(html.querySelector("button")).toBeNull();
	});
});
