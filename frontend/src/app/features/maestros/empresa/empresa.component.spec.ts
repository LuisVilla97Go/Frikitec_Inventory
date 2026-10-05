import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../../testing/proveedores-test";
import { AuthService } from "../../../core/auth/auth.service";
import { EmpresaComponent, rucValido } from "./empresa.component";

const FICHA = {
	ruc: "20610949518",
	razon_social: "FRIKITEC PERU E.I.R.L.",
	nombre_comercial: "Frikitec",
	direccion_fiscal: null,
	ubigeo: null,
	distrito: null,
	provincia: null,
	departamento: null,
	telefono: null,
	correo: null,
	web: null,
	updated_at: "2026-09-28T15:00:00+00:00",
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("rucValido", () => {
	it("comprueba el dígito verificador como SUNAT (módulo 11)", () => {
		expect(rucValido("20610949518")).toBe(true);
		expect(rucValido("20100070970")).toBe(true); // resto 10 → 0
		expect(rucValido("20610949519")).toBe(false);
		expect(rucValido("2061094951")).toBe(false);
	});
});

describe("EmpresaComponent", () => {
	let fixture: ComponentFixture<EmpresaComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	async function montar(admin: boolean, ficha: typeof FICHA | null) {
		await TestBed.configureTestingModule({
			imports: [EmpresaComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
		const login = TestBed.inject(AuthService).iniciarSesion({
			email: "yo@ejemplo.test",
			password: "x",
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
		fixture = TestBed.createComponent(EmpresaComponent);
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		http.expectOne("/api/empresa").flush({ status: "success", data: ficha });
		await pintar();
	}

	const campo = (id: string) =>
		html.querySelector(`#${id}`) as HTMLInputElement;
	const escribir = (id: string, valor: string) => {
		const input = campo(id);
		input.value = valor;
		input.dispatchEvent(new Event("input"));
	};

	afterEach(() => http.verify());

	it("sin ficha, el admin la llena y se manda con los vacíos en null", async () => {
		await montar(true, null);
		expect(html.textContent).toContain("Todavía no hay datos de la empresa");
		escribir("ruc", "20610949518");
		escribir("razon_social", "  FRIKITEC PERU E.I.R.L. ");
		(html.querySelector("form") as HTMLFormElement).dispatchEvent(
			new Event("submit"),
		);
		await turno();
		const req = http.expectOne("/api/empresa");
		expect(req.request.method).toBe("PUT");
		expect(req.request.body).toMatchObject({
			ruc: "20610949518",
			razon_social: "FRIKITEC PERU E.I.R.L.",
			telefono: null,
		});
		req.flush({ status: "success", data: FICHA });
		await pintar();
		expect(html.textContent).toContain("Datos guardados");
	});

	it("un RUC con el dígito verificador mal no se envía", async () => {
		await montar(true, FICHA);
		expect(campo("razon_social").value).toBe("FRIKITEC PERU E.I.R.L.");
		escribir("ruc", "20610949519");
		(html.querySelector("form") as HTMLFormElement).dispatchEvent(
			new Event("submit"),
		);
		fixture.detectChanges();
		http.expectNone("/api/empresa");
		expect(html.textContent).toContain("el último debe cuadrar");
	});

	it("quien no es admin la ve sin poder cambiarla", async () => {
		await montar(false, FICHA);
		expect(campo("ruc").disabled).toBe(true);
		expect(html.querySelector('button[type="submit"]')).toBeNull();
		expect(html.textContent).toContain("Solo un administrador");
	});
});
