import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../../../testing/proveedores-test";
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
		http.expectNone("/api/usuarios");

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
		});
		req.flush({ data: ANA });
		await turno();
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
