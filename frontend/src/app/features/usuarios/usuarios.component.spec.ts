import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { AuthService } from "../../core/auth/auth.service";
import { UsuariosComponent } from "./usuarios.component";

const YO = {
	id: "u-admin",
	nombre: "Admin",
	email: "admin@ejemplo.test",
	rol: "ADMIN",
	cargo: null,
	is_admin: true,
};

const fila = (id: string, rol: string, activo = true) => ({
	id,
	nombres: id,
	apellidos: "Prueba",
	email: `${id}@ejemplo.test`,
	rol,
	is_admin: rol !== "TRABAJADOR",
	cargo: null,
	is_active: activo,
	created_at: "2026-09-23T10:00:00+00:00",
});

const PAGINA = {
	status: "success",
	data: [
		fila("u-admin", "ADMIN"),
		fila("ana", "TRABAJADOR"),
		fila("jefe", "SUPERADMIN"),
		fila("baja", "TRABAJADOR", false),
	],
	page: 1,
	per_page: 50,
	total: 4,
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("UsuariosComponent", () => {
	let fixture: ComponentFixture<UsuariosComponent>;
	let http: HttpTestingController;

	async function iniciarSesionComo(usuario: typeof YO) {
		const login = TestBed.inject(AuthService).iniciarSesion({
			email: usuario.email,
			password: "x",
		});
		http.expectOne("/api/auth/login").flush({ user: usuario });
		await login;
	}

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	async function cargarLista() {
		fixture.detectChanges();
		await turno();
		http.expectOne((r) => r.url === "/api/usuarios").flush(PAGINA);
		await pintar();
	}

	function botones(texto: string): HTMLButtonElement[] {
		return Array.from(
			fixture.nativeElement.querySelectorAll(
				"button",
			) as NodeListOf<HTMLButtonElement>,
		).filter((b) => b.textContent?.trim() === texto);
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [UsuariosComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
	});

	afterEach(() => http.verify());

	it("un ADMIN ve roles y acciones, pero no sobre sí mismo ni sobre un SUPERADMIN", async () => {
		await iniciarSesionComo(YO);
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();

		const texto = fixture.nativeElement.textContent as string;
		expect(texto).toContain("Super administrador");
		expect(texto).toContain("Trabajador");
		expect(texto).toContain("(tú)");
		expect(botones("Nuevo usuario").length).toBe(1);
		expect(botones("Editar").length).toBe(3);
		expect(botones("Activo").length).toBe(1);
		expect(botones("Inactivo").length).toBe(1);
	});

	it("un TRABAJADOR solo ve la lista", async () => {
		await iniciarSesionComo({ ...YO, rol: "TRABAJADOR", is_admin: false });
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();

		expect(botones("Nuevo usuario").length).toBe(0);
		expect(botones("Editar").length).toBe(0);
		expect(botones("Activo").length).toBe(0);
	});

	it("desactivar pide confirmación y manda is_active=false", async () => {
		await iniciarSesionComo(YO);
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();

		botones("Activo")[0].click();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain("¿Desactivar usuario?");

		botones("Desactivar")[0].click();
		await turno();
		const req = http.expectOne("/api/usuarios/ana/estado");
		expect(req.request.method).toBe("PATCH");
		expect(req.request.body).toEqual({ is_active: false });
		req.flush({ data: fila("ana", "TRABAJADOR", false) });
		await pintar();
		http.expectOne((r) => r.url === "/api/usuarios").flush(PAGINA);
		await pintar();
	});
});
