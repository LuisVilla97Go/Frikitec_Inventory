import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { QueryClient } from "@tanstack/angular-query-experimental";

import { proveedoresDeTest } from "../../../../testing/proveedores-test";
import { AuthService } from "../../../core/auth/auth.service";
import { AlmacenesComponent } from "./almacenes.component";

const almacen = (nombre: string, stock: number, activo = true) => ({
	id: `id-${nombre}`,
	nombre,
	ubicacion: null,
	codigo_establecimiento: null,
	is_active: activo,
	stock,
});

const LISTA = {
	status: "success",
	data: [
		almacen("Arequipa", 0, false),
		almacen("Lima", 865),
		almacen("Trujillo", 0),
	],
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("AlmacenesComponent", () => {
	let fixture: ComponentFixture<AlmacenesComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	const fila = (nombre: string) =>
		Array.from(html.querySelectorAll("tbody tr")).find((tr) =>
			tr.textContent?.includes(nombre),
		) as HTMLTableRowElement;

	const boton = (texto: string, dentro: ParentNode = html) =>
		Array.from(dentro.querySelectorAll("button")).find((b) =>
			b.textContent?.includes(texto),
		) as HTMLButtonElement;

	async function montar(admin: boolean) {
		await TestBed.configureTestingModule({
			imports: [AlmacenesComponent],
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

		fixture = TestBed.createComponent(AlmacenesComponent);
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		const req = http.expectOne((r) => r.url === "/api/almacenes");
		expect(req.request.params.get("todos")).toBe("true");
		req.flush(LISTA);
		await pintar();
	}

	afterEach(() => {
		http.verify();
		vi.restoreAllMocks();
	});

	it("un trabajador ve la lista con sus unidades, sin acciones", async () => {
		await montar(false);
		expect(fila("Lima").textContent).toContain("865");
		expect(fila("Arequipa").textContent).toContain("Inactivo");
		expect(boton("Nuevo almacén")).toBeUndefined();
		expect(html.querySelector("tbody button")).toBeNull();
	});

	it("con unidades no se puede desactivar: el botón lo explica", async () => {
		await montar(true);
		const estadoLima = boton("Activo", fila("Lima"));
		expect(estadoLima.disabled).toBe(true);
		expect(estadoLima.title).toContain("Tiene 865 unidades");
		expect(boton("Activo", fila("Trujillo")).disabled).toBe(false);
	});

	it("desactivar pide confirmación, manda el PATCH y refresca los selectores de almacén", async () => {
		await montar(true);
		const invalidar = vi.spyOn(
			TestBed.inject(QueryClient),
			"invalidateQueries",
		);
		boton("Activo", fila("Trujillo")).click();
		fixture.detectChanges();
		boton(
			"Desactivar",
			html.querySelector("app-dialogo-confirmacion") as Element,
		).click();
		await pintar();

		const req = http.expectOne("/api/almacenes/id-Trujillo/estado");
		expect(req.request.method).toBe("PATCH");
		expect(req.request.body).toEqual({ is_active: false });
		req.flush({ status: "success", data: almacen("Trujillo", 0, false) });
		await pintar();
		expect(invalidar).toHaveBeenCalledWith({ queryKey: ["almacenes"] });
		for (const req of http.match((r) => r.url === "/api/almacenes")) {
			req.flush(LISTA);
		}
	});

	it("el alta valida el código SUNAT y manda los vacíos como null", async () => {
		await montar(true);
		boton("Nuevo almacén").click();
		fixture.detectChanges();
		const escribir = (id: string, valor: string) => {
			const campo = html.querySelector(`#${id}`) as HTMLInputElement;
			campo.value = valor;
			campo.dispatchEvent(new Event("input"));
		};
		const enviar = async () => {
			(html.querySelector("form") as HTMLFormElement).dispatchEvent(
				new Event("submit"),
			);
			await pintar();
		};

		escribir("nombre", " Arequipa Centro ");
		escribir("codigo_establecimiento", "12");
		await enviar();
		expect(html.textContent).toContain("Son 4 dígitos");
		http.expectNone("/api/almacenes");

		escribir("codigo_establecimiento", "0002");
		await enviar();
		const req = http.expectOne(
			(r) => r.method === "POST" && r.url === "/api/almacenes",
		);
		expect(req.request.body).toEqual({
			nombre: "Arequipa Centro",
			ubicacion: null,
			codigo_establecimiento: "0002",
		});
		req.flush(
			{
				status: "error",
				message: "Ya existe un almacén llamado Arequipa Centro",
			},
			{ status: 409, statusText: "Conflict" },
		);
		await pintar();
		expect(html.querySelector("form [role=alert]")?.textContent).toContain(
			"Ya existe un almacén",
		);
	});
});
