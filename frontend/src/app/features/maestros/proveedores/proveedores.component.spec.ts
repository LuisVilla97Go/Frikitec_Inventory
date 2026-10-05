import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../../testing/proveedores-test";
import { AuthService } from "../../../core/auth/auth.service";
import { ProveedoresComponent } from "./proveedores.component";

const PROVEEDOR = {
	id: "p1",
	tipo_documento: "RUC",
	numero_documento: "20123456789",
	razon_social: "Distribuidora Norte",
	nombre_comercial: null,
	contacto: "Ana",
	telefono: null,
	correo: null,
	is_active: true,
};
const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("ProveedoresComponent", () => {
	let fixture: ComponentFixture<ProveedoresComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	function boton(texto: string) {
		return Array.from(html.querySelectorAll("button")).find((b) =>
			b.textContent?.trim().includes(texto),
		) as HTMLButtonElement | undefined;
	}

	async function montar(admin: boolean) {
		const login = TestBed.inject(AuthService).iniciarSesion({
			email: "yo@ejemplo.test",
			password: "clave",
		});
		http.expectOne("/api/auth/login").flush({
			user: {
				id: "u1",
				nombre: "Yo",
				email: "yo@ejemplo.test",
				rol: admin ? "ADMIN" : "TRABAJADOR",
				cargo: null,
				is_admin: admin,
			},
		});
		await login;
		fixture = TestBed.createComponent(ProveedoresComponent);
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		const lista = http.expectOne((r) => r.url === "/api/proveedores");
		expect(lista.request.params.get("todos")).toBe("true");
		lista.flush({ status: "success", data: [PROVEEDOR] });
		await pintar();
	}

	function cambiar(campo: string, valor: string) {
		const input = html.querySelector(
			`[formControlName="${campo}"]`,
		) as HTMLInputElement;
		input.value = valor;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ProveedoresComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	it("un trabajador consulta y busca, sin poder cambiar proveedores", async () => {
		await montar(false);
		expect(html.textContent).toContain("Distribuidora Norte");
		expect(boton("Nuevo proveedor")).toBeUndefined();
		expect(html.querySelector('[aria-label="Editar proveedor"]')).toBeNull();
		const buscar = html.querySelector(
			'input[type="search"]',
		) as HTMLInputElement;
		buscar.value = "sin-coincidencia";
		buscar.dispatchEvent(new Event("input", { bubbles: true }));
		fixture.detectChanges();
		expect(html.textContent).toContain("No hay proveedores que coincidan");
	});

	it("valida el RUC, crea, edita y solicita desactivación", async () => {
		await montar(true);
		boton("Nuevo proveedor")?.click();
		fixture.detectChanges();
		boton("Guardar")?.click();
		fixture.detectChanges();
		expect(html.textContent).toContain("Revisa los campos marcados");
		cambiar("numero_documento", "20123456789");
		cambiar("razon_social", "Proveedor Nuevo");
		cambiar("nombre_comercial", "  Marca  ");
		boton("Guardar")?.click();
		await turno();
		const crear = http.expectOne("/api/proveedores");
		expect(crear.request.method).toBe("POST");
		expect(crear.request.body.nombre_comercial).toBe("Marca");
		crear.flush({
			status: "success",
			data: { ...PROVEEDOR, razon_social: "Proveedor Nuevo" },
		});
		await pintar();
		const lectura = http.match(
			(r) => r.url === "/api/proveedores" && r.method === "GET",
		);
		for (const req of lectura)
			req.flush({ status: "success", data: [PROVEEDOR] });
		await pintar();
		expect(html.querySelector('[role="dialog"]')).toBeNull();

		(
			html.querySelector('[aria-label="Editar proveedor"]') as HTMLButtonElement
		).click();
		fixture.detectChanges();
		expect(
			(
				html.querySelector(
					'[formControlName="numero_documento"]',
				) as HTMLInputElement
			).disabled,
		).toBe(true);
		cambiar("razon_social", "Distribuidora Actualizada");
		boton("Guardar")?.click();
		await turno();
		const editar = http.expectOne("/api/proveedores/p1");
		expect(editar.request.method).toBe("PUT");
		expect(editar.request.body.razon_social).toBe("Distribuidora Actualizada");
		editar.flush({
			status: "success",
			data: { ...PROVEEDOR, razon_social: "Distribuidora Actualizada" },
		});
		await pintar();
		for (const req of http.match((r) => r.url === "/api/proveedores")) {
			req.flush({ status: "success", data: [PROVEEDOR] });
		}
		await pintar();
		boton("Desactivar")?.click();
		fixture.detectChanges();
		expect(html.textContent).toContain("¿Desactivar proveedor?");
	});
});
