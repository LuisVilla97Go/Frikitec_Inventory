import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../../../testing/proveedores-test";
import { AuthService } from "../../../../core/auth/auth.service";
import { KardexMovimientoModalComponent } from "./kardex-movimiento-modal.component";

const PRODUCTO = "00000000-0000-0000-0000-000000000001";

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("KardexMovimientoModalComponent", () => {
	let fixture: ComponentFixture<KardexMovimientoModalComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	const tipos = () =>
		Array.from(html.querySelectorAll<HTMLOptionElement>("#tipo option")).map(
			(o) => o.value,
		);

	const campo = <T extends HTMLElement>(selector: string) =>
		html.querySelector(selector) as T;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [KardexMovimientoModalComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();

		fixture = TestBed.createComponent(KardexMovimientoModalComponent);
		fixture.componentRef.setInput("productId", PRODUCTO);
		http = TestBed.inject(HttpTestingController);
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		http
			.expectOne((r) => r.url === "/api/almacenes")
			.flush({ data: [{ id: "a1", nombre: "Lima", ubicacion: null }] });
		http.expectOne("/api/proveedores").flush({ data: [] });
		await pintar();
	});

	afterEach(() => http.verify());

	it("sin sesión de administrador no ofrece la revalorización", () => {
		expect(tipos()).toContain("ENTRADA_COMPRA");
		expect(tipos()).not.toContain("REVALORIZACION");
	});

	it("un administrador revaloriza sin unidades, con acta de ajuste y el nuevo costo", async () => {
		const sesion = TestBed.inject(AuthService).iniciarSesion({
			email: "admin@ejemplo.test",
			password: "clave-de-prueba",
		});
		http.expectOne("/api/auth/login").flush({
			user: {
				id: "u1",
				nombre: "Admin",
				email: "admin@ejemplo.test",
				rol: "ADMIN",
				cargo: null,
				is_admin: true,
			},
		});
		await sesion;
		await pintar();
		expect(tipos()).toContain("REVALORIZACION");

		const tipo = campo<HTMLSelectElement>("#tipo");
		tipo.value = "REVALORIZACION";
		tipo.dispatchEvent(new Event("change"));
		await pintar();

		expect(campo<HTMLInputElement>("#cantidad").disabled).toBe(true);
		const documento = campo<HTMLSelectElement>("#documento");
		expect(documento.disabled).toBe(true);
		expect(documento.value).toBe("AJUSTE_INVENTARIO");
		expect(html.textContent).toContain("Nuevo costo unitario");

		const numero = campo<HTMLInputElement>("#numero");
		numero.value = "REV-0001";
		numero.dispatchEvent(new Event("input"));
		const costo = campo<HTMLInputElement>("#costo");
		costo.value = "20";
		costo.dispatchEvent(new Event("input"));
		campo<HTMLFormElement>("form").dispatchEvent(new Event("submit"));
		await pintar();

		const req = http.expectOne(`/api/productos/${PRODUCTO}/movimientos`);
		expect(req.request.body).toEqual({
			almacen_id: "a1",
			tipo_movimiento: "REVALORIZACION",
			tipo_documento: "AJUSTE_INVENTARIO",
			numero_documento: "REV-0001",
			cantidad: 0,
			costo_unitario: "20.0000",
			proveedor_id: null,
			moneda: "PEN",
			tipo_cambio: "1.0000",
		});
		req.flush(
			{ message: "Movimiento registrado" },
			{ status: 201, statusText: "Created" },
		);
		await pintar();
	});
});
