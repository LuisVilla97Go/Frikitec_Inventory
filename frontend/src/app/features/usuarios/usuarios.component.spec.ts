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
		await turno(); // TanStack lanza la petición en un macrotask
		http.expectOne((r) => r.url === "/api/usuarios").flush(PAGINA);
		await pintar();
	}

	function botones(texto: string): HTMLButtonElement[] {
		return Array.from(
			fixture.nativeElement.querySelectorAll(
				"button",
			) as NodeListOf<HTMLButtonElement>,
		).filter(
			(b) => (b.getAttribute("aria-label") ?? b.textContent?.trim()) === texto,
		);
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
		// Editar: yo y ana y baja (no jefe, que es SUPERADMIN)
		expect(botones("Editar").length).toBe(3);
		// El estado es informativo; eliminar: ana y baja (ni yo ni jefe).
		expect(botones("Activo").length).toBe(0);
		expect(botones("Inactivo").length).toBe(0);
		expect(botones("Eliminar").length).toBe(2);
		expect(botones("Desactivar").length).toBe(0);
		expect(botones("Reactivar").length).toBe(0);
		for (const accion of ["Editar", "Eliminar"]) {
			for (const boton of botones(accion)) {
				expect(boton.textContent?.trim()).toBe("");
				expect(boton.getAttribute("aria-label")).toBe(accion);
				expect(boton.title).toBe(accion);
				expect(boton.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
			}
		}
	});

	it("un TRABAJADOR solo ve la lista", async () => {
		await iniciarSesionComo({ ...YO, rol: "TRABAJADOR", is_admin: false });
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();

		expect(botones("Nuevo usuario").length).toBe(0);
		expect(botones("Editar").length).toBe(0);
		expect(botones("Activo").length).toBe(0);
		expect(botones("Desactivar").length).toBe(0);
		expect(botones("Reactivar").length).toBe(0);
		expect(botones("Eliminar").length).toBe(0);
	});

	it("eliminar pide confirmación y manda DELETE sin cuerpo", async () => {
		await iniciarSesionComo(YO);
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();

		botones("Eliminar")[0].click();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain("¿Eliminar usuario?");

		botones("Eliminar")
			.find((b) => b.closest("app-dialogo-confirmacion"))
			?.click();
		await turno();
		const req = http.expectOne("/api/usuarios/ana");
		expect(req.request.method).toBe("DELETE");
		expect(req.request.body).toBeNull();
		req.flush(null, { status: 204, statusText: "No Content" });
		await pintar();
		// Tras el cambio se vuelve a pedir la lista
		http.expectOne((r) => r.url === "/api/usuarios").flush(PAGINA);
		await pintar();
	});

	it("la papelera explica la conservación del historial y cancelar no elimina", async () => {
		await iniciarSesionComo(YO);
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();
		botones("Eliminar")[0].click();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain(
			"Su autoría en el historial se conserva",
		);
		botones("Cancelar")[0].click();
		fixture.detectChanges();
		expect(
			fixture.nativeElement.querySelector("app-dialogo-confirmacion"),
		).toBeNull();
		http.expectNone("/api/usuarios/ana");
	});

	it("eliminar una cuenta inactiva comunica un rechazo de permisos sin retirarla", async () => {
		await iniciarSesionComo(YO);
		fixture = TestBed.createComponent(UsuariosComponent);
		await cargarLista();
		botones("Eliminar")[1].click();
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain("¿Eliminar usuario?");
		botones("Eliminar")
			.find((b) => b.closest("app-dialogo-confirmacion"))
			?.click();
		await turno();
		const req = http.expectOne("/api/usuarios/baja");
		expect(req.request.method).toBe("DELETE");
		expect(req.request.body).toBeNull();
		req.flush(
			{ message: "No tienes permiso para cambiar este usuario" },
			{ status: 403, statusText: "Forbidden" },
		);
		await pintar();
		expect(
			fixture.nativeElement.querySelector('[role="alert"]')?.textContent,
		).toContain("No tienes permiso");
		http.expectNone((r) => r.url === "/api/usuarios");
	});
});
