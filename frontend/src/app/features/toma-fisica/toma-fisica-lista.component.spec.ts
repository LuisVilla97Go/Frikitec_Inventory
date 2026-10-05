import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { Router } from "@angular/router";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { TomaFisicaListaComponent } from "./toma-fisica-lista.component";

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

const TOMA = {
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
	productos: 3,
	contados: 1,
	valor_diferencia: null,
	lineas: null,
};

describe("TomaFisicaListaComponent", () => {
	let fixture: ComponentFixture<TomaFisicaListaComponent>;
	let http: HttpTestingController;
	let html: HTMLElement;

	async function pintar() {
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TomaFisicaListaComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
		fixture = TestBed.createComponent(TomaFisicaListaComponent);
		html = fixture.nativeElement;
		fixture.detectChanges();
		await turno();
		const lista = http.expectOne((r) => r.url === "/api/tomas-fisicas");
		expect(lista.request.params.get("per_page")).toBe("10");
		lista.flush({ data: [TOMA], page: 1, per_page: 10, total: 1 });
		http.expectOne("/api/almacenes").flush({
			status: "success",
			data: [{ id: "a1", nombre: "Tienda", ubicacion: null }],
		});
		await pintar();
	});

	afterEach(() => http.verify());

	it("lista las tomas con su estado y cuántos productos van contados", () => {
		expect(html.textContent).toContain("TF-000007");
		expect(html.textContent).toContain("Abierta");
		expect(html.textContent).toContain("1 / 3");
	});

	it("crea la toma en el almacén elegido y abre su detalle", async () => {
		const navegar = vi
			.spyOn(TestBed.inject(Router), "navigate")
			.mockResolvedValue(true);
		const nueva = [...html.querySelectorAll("button")].find((b) =>
			b.textContent?.includes("Nueva toma física"),
		) as HTMLButtonElement;
		nueva.click();
		fixture.detectChanges();

		const form = html.querySelector("form") as HTMLFormElement;
		form.dispatchEvent(new Event("submit"));
		fixture.detectChanges();
		expect(html.textContent).toContain("Elige el almacén");
		http.expectNone((r) => r.method === "POST");

		const almacen = html.querySelector("#toma-almacen") as HTMLSelectElement;
		almacen.value = "a1";
		almacen.dispatchEvent(new Event("change"));
		form.dispatchEvent(new Event("submit"));
		await turno();
		const req = http.expectOne(
			(r) => r.method === "POST" && r.url === "/api/tomas-fisicas",
		);
		expect(req.request.body).toEqual({
			almacen_id: "a1",
			producto_ids: [],
			observacion: null,
		});
		req.flush({ status: "success", data: TOMA });
		await pintar();
		http
			.match((r) => r.url === "/api/tomas-fisicas")
			.forEach((r) => {
				r.flush({ data: [TOMA], page: 1, per_page: 10, total: 1 });
			});
		await pintar();
		expect(navegar).toHaveBeenCalledWith(["/toma-fisica", "t1"]);
	});
});
