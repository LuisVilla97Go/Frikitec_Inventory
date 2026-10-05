import { HttpTestingController } from "@angular/common/http/testing";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { ChartConfiguration } from "chart.js";
import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { CREAR_GRAFICO } from "../../shared/components/grafico/grafico.component";
import { DashboardComponent } from "./dashboard.component";

const RESUMEN = {
	status: "success",
	data: {
		umbral_stock_bajo: 5,
		indicadores: {
			valor_inventario: "102550.95",
			unidades: 1779,
			productos_activos: 537,
			productos_con_stock: 369,
			categorias: 17,
			marcas: 16,
			filas_por_reponer: 490,
			productos_por_reponer: 362,
			productos_sin_historia: 168,
		},
		por_categoria: [
			{
				nombre: "Accesorios iPhone",
				productos: 126,
				unidades: 599,
				valor: "31107.59",
				participacion: "30.3",
				destacado: true,
				otras: false,
			},
			{
				nombre: "Teclados",
				productos: 4,
				unidades: 1,
				valor: "116.28",
				participacion: "0.1",
				destacado: false,
				otras: false,
			},
		],
		por_marca: [
			{
				nombre: "Uniq",
				productos: 225,
				unidades: 900,
				valor: "60977.81",
				participacion: "59.5",
				destacado: true,
				otras: false,
			},
			{
				nombre: "Wiwu",
				productos: 174,
				unidades: 500,
				valor: "26864.39",
				participacion: "26.2",
				destacado: true,
				otras: false,
			},
			{
				nombre: "Otras (14)",
				productos: 138,
				unidades: 379,
				valor: "14708.75",
				participacion: "14.3",
				destacado: false,
				otras: true,
			},
		],
		concentracion_categorias: {
			grupos: 5,
			de: 17,
			participacion: "82.0",
			umbral: "80",
		},
		concentracion_marcas: {
			grupos: 2,
			de: 16,
			participacion: "85.7",
			umbral: "80",
		},
		por_almacen: [
			{
				id: "a1",
				nombre: "Lima",
				unidades: 865,
				valor: "53385.04",
				agotados: 0,
				por_reponer: 287,
				sanos: 24,
				participacion: "52.1",
			},
		],
		movimientos_por_mes: [
			{ mes: "2026-08", entradas: 0, salidas: 0, movimientos: 0 },
			{ mes: "2026-09", entradas: 1779, salidas: 0, movimientos: 560 },
		],
		top_productos: [
			{
				id: "p1",
				sku: "UNQ-001",
				nombre: "Funda Uniq",
				categoria: "Accesorios iPhone",
				unidades: 12,
				valor: "1450.00",
			},
		],
	},
};

const MOVIMIENTOS = {
	status: "success",
	data: [
		{
			id: "m1",
			date: "2026-09-24",
			movementType: "SALIDA_VENTA",
			docType: "BOLETA",
			docNumber: "B001-7",
			productId: "p1",
			sku: "UNQ-001",
			productName: "Funda Uniq",
			warehouseId: "a1",
			warehouse: "Lima",
			qty: -3,
			balance: 9,
			unitCost: "5.0000",
			currency: "PEN",
			user: "Admin Prueba",
		},
	],
	page: 1,
	per_page: 6,
	total: 1,
};

const turno = () => new Promise((resolver) => setTimeout(resolver, 0));

describe("DashboardComponent", () => {
	let fixture: ComponentFixture<DashboardComponent>;
	let http: HttpTestingController;
	let graficos: ChartConfiguration[];

	async function pintar() {
		// La respuesta pasa por ApiClient (Promise + Valibot) y TanStack notifica en lote
		for (let i = 0; i < 5; i++) await turno();
		fixture.detectChanges();
		await fixture.whenStable();
	}

	async function responder() {
		await turno(); // TanStack lanza las peticiones en un macrotask
		http.expectOne("/api/dashboard/resumen").flush(RESUMEN);
		http.expectOne((r) => r.url === "/api/movimientos").flush(MOVIMIENTOS);
		await pintar();
	}

	beforeEach(async () => {
		graficos = [];
		await TestBed.configureTestingModule({
			imports: [DashboardComponent],
			providers: [
				...proveedoresDeTest(),
				{
					provide: CREAR_GRAFICO,
					useValue: (
						_lienzo: HTMLCanvasElement,
						config: ChartConfiguration,
					) => {
						graficos.push(config);
						return {
							data: config.data,
							options: config.options,
							update: () => { },
							destroy: () => { },
						};
					},
				},
			],
		}).compileComponents();

		fixture = TestBed.createComponent(DashboardComponent);
		http = TestBed.inject(HttpTestingController);
		fixture.detectChanges();
	});

	afterEach(() => http.verify());

	it("muestra esqueletos mientras carga, no cifras inventadas", async () => {
		const texto = fixture.nativeElement.textContent as string;
		expect(
			fixture.nativeElement.querySelector("[aria-busy='true']"),
		).not.toBeNull();
		expect(texto).not.toContain("1,245");
		await responder();
	});

	it("pinta los indicadores que calcula el servidor", async () => {
		await responder();
		const el: HTMLElement = fixture.nativeElement;

		expect(
			el.querySelector("[data-testid='valor-inventario']")?.textContent,
		).toContain("102,550.95");
		expect(
			el.querySelector("[data-testid='por-reponer']")?.textContent,
		).toContain("490");
		expect(el.textContent).toContain(
			"5 uds o menos en un almacén · 362 productos",
		);
		expect(el.textContent).toContain("168");
		expect(el.textContent).toContain("Funda Uniq");
	});

	it("dibuja cuatro gráficos de barras, sin tortas ni donuts", async () => {
		await responder();

		expect(graficos.map((g) => g.type)).toEqual(["bar", "bar", "bar", "bar"]);
		const [categorias] = graficos;
		expect(categorias.data.labels).toEqual(["Accesorios iPhone", "Teclados"]);
		expect(categorias.data.datasets[0].data).toEqual([31107.59, 116.28]);
		expect(categorias.options?.indexAxis).toBe("y");
	});

	it("las marcas que sostienen la conclusión van en naranja y el resto en gris", async () => {
		await responder();
		const marcas = graficos[1];

		expect(marcas.data.labels).toEqual(["Uniq", "Wiwu", "Otras (14)"]);
		expect(marcas.data.datasets[0].backgroundColor).toEqual([
			"#F27145",
			"#F27145",
			"#cbd5e1",
		]);
		expect(marcas.plugins?.map((p) => p.id)).toEqual(["etiquetasDirectas"]);
	});

	it("el título dice la conclusión que calcula el servidor", async () => {
		await responder();
		const el: HTMLElement = fixture.nativeElement;
		const texto = (id: string) =>
			el
				.querySelector(`[data-testid='${id}']`)
				?.textContent?.replace(/\s+/g, " ")
				.trim();

		expect(texto("titulo-marcas")).toBe(
			"2 de 16 marcas concentran el 85.7% del valor en stock",
		);
		expect(texto("titulo-categorias")).toBe(
			"5 de 17 categorías concentran el 82.0% del valor en stock",
		);
	});

	it("la vista de tabla da las cifras exactas por categoría", async () => {
		await responder();
		const boton = [...fixture.nativeElement.querySelectorAll("button")].find(
			(b: HTMLButtonElement) => b.textContent?.includes("Tabla"),
		) as HTMLButtonElement;
		boton.click();
		await pintar();

		const filas = fixture.nativeElement.querySelectorAll("tbody tr");
		expect(filas[0].textContent).toContain("Accesorios iPhone");
		expect(filas[0].textContent).toContain("31,107.59");
		expect(boton.getAttribute("aria-pressed")).toBe("true");
	});

	it("avisa cuando aún no hay salidas", async () => {
		await responder();
		expect(fixture.nativeElement.textContent).toContain(
			"Aún no hay salidas registradas",
		);
	});

	it("muestra el movimiento con su signo y su tipo", async () => {
		await responder();
		const texto = fixture.nativeElement.textContent as string;
		expect(texto).toContain("-3");
		expect(texto).toContain("Venta · Lima");
	});

	it("si falla el resumen, lo dice y deja reintentar", async () => {
		await turno();
		http
			.expectOne("/api/dashboard/resumen")
			.flush({ message: "error" }, { status: 500, statusText: "Error" });
		http.expectOne((r) => r.url === "/api/movimientos").flush(MOVIMIENTOS);
		await pintar();

		expect(fixture.nativeElement.textContent).toContain(
			"No se pudo cargar el resumen del inventario.",
		);
	});
});
