import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { AuthService } from "../../core/auth/auth.service";
import type { TomaFisica } from "../../shared/schemas/api.schema";
import { TomaFisicaDetalleComponent } from "./toma-fisica-detalle.component";

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

function toma(admin: boolean, contadas: (number | null)[]): TomaFisica {
	const sistema = [9, 4];
	const lineas = contadas.map((contada, i) => {
		const diferencia =
			admin && contada !== null ? contada - (sistema[i] ?? 0) : null;
		return {
			id: `l${i + 1}`,
			producto_id: `p${i + 1}`,
			sku: `SKU-${i + 1}`,
			producto: `Producto ${i + 1}`,
			cantidad_contada: contada,
			contado_en: contada === null ? null : "2026-09-28T15:00:00+00:00",
			stock_sistema: admin ? (sistema[i] ?? 0) : null,
			diferencia,
			stock_actual: admin ? (sistema[i] ?? 0) : null,
			costo_unitario: admin ? "5.00" : null,
			valor_diferencia:
				diferencia === null ? null : (diferencia * 5).toFixed(2),
			movimientos_despues: admin ? 0 : null,
		};
	});
	return {
		id: "t1",
		numero: "TF-000007",
		almacen_id: "a1",
		almacen: "Tienda",
		estado: "ABIERTO",
		observacion: null,
		creado_por: "Yo",
		creado_en: "2026-09-28T14:00:00+00:00",
		cerrado_por: null,
		cerrado_en: null,
		motivo_anulacion: null,
		productos: lineas.length,
		contados: contadas.filter((c) => c !== null).length,
		valor_diferencia: admin ? "-10.00" : null,
		lineas,
	};
}

describe("TomaFisicaDetalleComponent", () => {
	let fixture: ComponentFixture<TomaFisicaDetalleComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	async function montar(admin: boolean, datos: TomaFisica) {
		await TestBed.configureTestingModule({
			imports: [TomaFisicaDetalleComponent],
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
		fixture = TestBed.createComponent(TomaFisicaDetalleComponent);
		fixture.componentRef.setInput("id", "t1");
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		http
			.expectOne("/api/tomas-fisicas/t1")
			.flush({ status: "success", data: datos });
		await pintar();
	}

	const boton = (texto: string) =>
		[...html.querySelectorAll("button")].find((b) =>
			b.textContent?.includes(texto),
		) as HTMLButtonElement;
	const conteo = (producto: string) =>
		html.querySelector(
			`input[aria-label="Contado de ${producto}"]`,
		) as HTMLInputElement;

	afterEach(() => http.verify());

	it("quien no es admin cuenta a ciegas: no ve el stock del sistema", async () => {
		await montar(false, toma(false, [null, null]));
		expect(html.textContent).toContain("conteo ciego");
		expect(html.textContent).not.toContain("Sistema");
		expect(html.textContent).not.toContain("Diferencia valorizada");
		expect(boton("Aprobar y contabilizar")).toBeUndefined();
	});

	it("guarda solo los conteos que cambiaron", async () => {
		await montar(false, toma(false, [null, 4]));
		expect(boton("Guardar conteo").disabled).toBe(true);
		const input = conteo("Producto 1");
		input.value = "7";
		input.dispatchEvent(new Event("input"));
		const otro = conteo("Producto 2");
		otro.value = "4"; // igual a lo guardado: no se manda
		otro.dispatchEvent(new Event("input"));
		fixture.detectChanges();
		boton("Guardar conteo").click();
		await turno();
		const req = http.expectOne("/api/tomas-fisicas/t1/conteo");
		expect(req.request.method).toBe("PUT");
		expect(req.request.body).toEqual({
			conteos: [{ linea_id: "l1", cantidad_contada: 7 }],
		});
		req.flush({ status: "success", data: toma(false, [7, 4]) });
		await pintar();
		expect(html.textContent).toContain("Conteo guardado.");
	});

	it("pagina las líneas de 10 en 10 sin perder lo escrito", async () => {
		const base = toma(false, [null]);
		const linea = base.lineas?.[0] as NonNullable<TomaFisica["lineas"]>[number];
		const lineas = Array.from({ length: 12 }, (_, i) => ({
			...linea,
			id: `l${i + 1}`,
			producto_id: `p${i + 1}`,
			producto: `Producto ${i + 1}`,
		}));
		await montar(false, { ...base, productos: 12, lineas });
		expect(html.querySelectorAll("tbody tr")).toHaveLength(10);
		const input = conteo("Producto 1");
		input.value = "5";
		input.dispatchEvent(new Event("input"));

		(
			html.querySelector(
				'button[aria-label="Página siguiente"]',
			) as HTMLButtonElement
		).click();
		fixture.detectChanges();
		expect(html.querySelectorAll("tbody tr")).toHaveLength(2);
		expect(html.querySelector("tbody td")?.textContent?.trim()).toBe("11");
		expect(conteo("Producto 1")).toBeNull();

		(
			html.querySelector(
				'button[aria-label="Página anterior"]',
			) as HTMLButtonElement
		).click();
		fixture.detectChanges();
		expect(conteo("Producto 1").value).toBe("5");
		expect(boton("Guardar conteo").disabled).toBe(false);
	});

	it("el admin ve las diferencias y no contabiliza hasta que todo esté contado", async () => {
		await montar(true, toma(true, [7, null]));
		expect(html.textContent).toContain("Sistema");
		expect(html.textContent).toContain("-2");
		expect(html.textContent).toContain("-10.00");
		expect(boton("Aprobar y contabilizar").disabled).toBe(true);
	});

	it("contabilizar pide confirmación y luego llama al backend", async () => {
		await montar(true, toma(true, [7, 4]));
		const aprobar = boton("Aprobar y contabilizar");
		expect(aprobar.disabled).toBe(false);
		aprobar.click();
		fixture.detectChanges();
		expect(html.textContent).toContain("¿Contabilizar la toma física?");
		expect(html.textContent).toContain("1 ajuste(s)");
		http.expectNone("/api/tomas-fisicas/t1/contabilizar");
		boton("Contabilizar").click();
		await turno();
		const req = http.expectOne("/api/tomas-fisicas/t1/contabilizar");
		expect(req.request.method).toBe("POST");
		req.flush({
			status: "success",
			data: { ...toma(true, [7, 4]), estado: "CONTABILIZADO" },
		});
		await pintar();
		expect(html.textContent).toContain("los ajustes ya están en el Kardex");
		expect(boton("Guardar conteo")).toBeUndefined();
	});
});
