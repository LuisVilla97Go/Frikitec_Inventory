import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../../../testing/proveedores-test";
import { AuthService } from "../../../../core/auth/auth.service";
import type { Usuario } from "../../../../shared/schemas/api.schema";
import { UsuarioFormComponent } from "./usuario-form.component";

const ANA: Usuario = {
	id: "ana",
	nombres: "Ana",
	apellidos: "Pérez",
	email: "ana@ejemplo.test",
	rol: "TRABAJADOR",
	cargo: null,
	is_admin: false,
	is_active: true,
	created_at: "2026-09-23T10:00:00+00:00",
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("UsuarioFormComponent", () => {
	let fixture: ComponentFixture<UsuarioFormComponent>;
	let http: HttpTestingController;

	function escribir(id: string, valor: string) {
		const campo = fixture.nativeElement.querySelector(
			`#${id}`,
		) as HTMLInputElement;
		campo.value = valor;
		campo.dispatchEvent(new Event("input"));
	}

	function enviar() {
		(
			fixture.nativeElement.querySelector("form") as HTMLFormElement
		).dispatchEvent(new Event("submit"));
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [UsuarioFormComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
		fixture = TestBed.createComponent(UsuarioFormComponent);
	});

	afterEach(() => http.verify());

	it("al crear exige contraseña y hace POST con el rol elegido", async () => {
		fixture.detectChanges();
		escribir("nombres", "Luis");
		escribir("apellidos", "Villa");
		escribir("email", "luis");
		enviar();
		await turno();
		http.expectNone("/api/usuarios"); // sin contraseña no se envía

		escribir("password", "clave-segura-1");
		enviar();
		await turno();
		const req = http.expectOne("/api/usuarios");
		expect(req.request.method).toBe("POST");
		expect(req.request.body).toEqual({
			nombres: "Luis",
			apellidos: "Villa",
			email: "luis",
			rol: "TRABAJADOR",
			cargo: null,
			password: "clave-segura-1",
		});
		req.flush({ data: { ...ANA, id: "nuevo" } });
		await turno();
	});

	it("al editar sin contraseña hace PUT sin el campo password", async () => {
		fixture.componentRef.setInput("usuario", ANA);
		fixture.detectChanges();
		escribir("apellidos", "Gómez");
		enviar();
		await turno();

		const req = http.expectOne("/api/usuarios/ana");
		expect(req.request.method).toBe("PUT");
		expect(req.request.body).toEqual({
			nombres: "Ana",
			apellidos: "Gómez",
			email: "ana@ejemplo.test",
			rol: "TRABAJADOR",
			cargo: null,
			is_active: true,
		});
		req.flush({ data: ANA });
		await turno();
	});

	it("cambiar el interruptor espera Guardar y confirmar; cancelar conserva la ficha", async () => {
		fixture.componentRef.setInput("usuario", ANA);
		fixture.detectChanges();
		const interruptor = fixture.nativeElement.querySelector(
			'[role="switch"]',
		) as HTMLInputElement;
		expect(interruptor.checked).toBe(true);
		interruptor.click();
		escribir("apellidos", "Gómez");
		fixture.detectChanges();
		await turno();
		http.expectNone("/api/usuarios/ana");
		enviar();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain("¿Desactivar usuario?");
		const dialogo = fixture.nativeElement.querySelector(
			"app-dialogo-confirmacion",
		) as HTMLElement;
		(dialogo.querySelector("button") as HTMLButtonElement).click();
		fixture.detectChanges();
		http.expectNone("/api/usuarios/ana");
		expect(interruptor.checked).toBe(false);
		enviar();
		fixture.detectChanges();
		const confirmar = fixture.nativeElement.querySelector(
			"app-dialogo-confirmacion button:last-child",
		) as HTMLButtonElement;
		confirmar.click();
		confirmar.click();
		await turno();
		const req = http.expectOne("/api/usuarios/ana");
		expect(req.request.method).toBe("PUT");
		expect(req.request.body).toMatchObject({
			apellidos: "Gómez",
			is_active: false,
		});
		expect(req.request.body).not.toHaveProperty("password");
		req.flush(
			{ message: "No tienes permiso" },
			{ status: 403, statusText: "Forbidden" },
		);
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
		expect(
			fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
		).toContain("No tienes permiso");
		expect(interruptor.checked).toBe(false);
		expect(
			(fixture.nativeElement.querySelector("#apellidos") as HTMLInputElement)
				.value,
		).toBe("Gómez");
	});

	it("una cuenta inactiva se reactiva al guardar y confirmar", async () => {
		fixture.componentRef.setInput("usuario", { ...ANA, is_active: false });
		fixture.detectChanges();
		(
			fixture.nativeElement.querySelector('[role="switch"]') as HTMLInputElement
		).click();
		enviar();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain("¿Reactivar usuario?");
		(
			fixture.nativeElement.querySelector(
				"app-dialogo-confirmacion button:last-child",
			) as HTMLButtonElement
		).click();
		await turno();
		const req = http.expectOne("/api/usuarios/ana");
		expect(req.request.body.is_active).toBe(true);
		req.flush({ data: ANA });
		await turno();
	});

	it("la cuenta propia tiene el interruptor deshabilitado", async () => {
		const sesion = TestBed.inject(AuthService).iniciarSesion({
			email: ANA.email,
			password: "x",
		});
		http
			.expectOne("/api/auth/login")
			.flush({ user: { ...ANA, nombre: "Ana" } });
		await sesion;
		fixture.componentRef.setInput("usuario", ANA);
		fixture.detectChanges();
		expect(
			(
				fixture.nativeElement.querySelector(
					'[role="switch"]',
				) as HTMLInputElement
			).disabled,
		).toBe(true);
		expect(fixture.nativeElement.textContent).toContain(
			"No puedes desactivar tu propia cuenta",
		);
	});

	it("quien no es SUPERADMIN no ve esa opción de rol", () => {
		fixture.detectChanges();
		const opciones = Array.from(
			fixture.nativeElement.querySelectorAll(
				"#rol option",
			) as NodeListOf<HTMLOptionElement>,
		).map((o) => o.value);
		expect(opciones).toEqual(["ADMIN", "TRABAJADOR"]);
	});
});
