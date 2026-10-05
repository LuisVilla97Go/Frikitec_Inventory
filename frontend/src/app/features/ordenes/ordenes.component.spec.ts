import { HttpTestingController } from "@angular/common/http/testing";
import type { WritableSignal } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import type { FormControl } from "@angular/forms";
import { QueryClient } from "@tanstack/angular-query-experimental";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { AuthService } from "../../core/auth/auth.service";
import { claves } from "../../core/http/claves";
import type {
	OrdenCompraDetalle,
	RecepcionCompra,
} from "../../shared/schemas/api.schema";
import { OrdenesComponent } from "./ordenes.component";

const LINEA = {
	id: "l1",
	product_id: "p1",
	sku: "CAB",
	product_name: "Cable",
	warehouse_id: "a1",
	warehouse_name: "Lima",
	quantity_ordered: 10,
	quantity_received: 0,
	quantity_closed: 0,
	quantity_open: 10,
	unit_cost: 12.5,
};
const VERSION = {
	id: "v1",
	number: 1,
	supplier_id: "s1",
	supplier_document: "20123456789",
	supplier_name: "Distribuidora",
	currency: "PEN",
	exchange_rate: 1,
	status: "EMITIDA" as const,
	created_at: "2026-09-24T10:00:00Z",
	submitted_at: "2026-09-24T10:00:00Z",
	approved_at: "2026-09-24T11:00:00Z",
	issued_at: "2026-09-24T12:00:00Z",
	cancellation_reason: null,
	lines: [LINEA],
	approvals: [
		{
			id: "ap1",
			stage: 1,
			cargo: "Jefe de Almacén",
			approver_id: "u1",
			approver_name: "Yo",
			status: "APROBADA" as const,
			comment: null,
			decided_at: "2026-09-24T11:00:00Z",
		},
	],
};
const ORDEN: OrdenCompraDetalle = {
	id: "o1",
	number: "OC-1",
	status: "EMITIDA",
	version_number: 1,
	created_by_id: "u1",
	created_at: "2026-09-24T10:00:00Z",
	supplier_name: "Distribuidora",
	version: VERSION,
	versions: [VERSION],
	receipts: [],
};
const RECIBO: RecepcionCompra = {
	id: "r1",
	status: "BORRADOR",
	arrival_date: "2026-09-24",
	guide_number: "G-1",
	guide_date: null,
	invoice_number: null,
	invoice_date: null,
	posted_at: null,
	posted_by_id: null,
	created_at: "2026-09-24T12:00:00Z",
	created_by_id: "u1",
	lines: [
		{
			id: "rl1",
			order_line_id: "l1",
			sku: "CAB",
			product_name: "Cable",
			warehouse_id: "a1",
			warehouse_name: "Lima",
			quantity_accepted: 3,
			quantity_rejected: 1,
			rejection_reason: "Dañado",
			unit_cost: 12.5,
		},
	],
};
const TURNO = () => new Promise((resolver) => setTimeout(resolver, 0));

interface Control {
	page: WritableSignal<number>;
	pageSize: WritableSignal<number>;
	selectedOrderId: WritableSignal<string>;
	supplierId: WritableSignal<string>;
	proveedorControl: FormControl<string>;
	lines: WritableSignal<
		{
			producto_id: string;
			almacen_previsto_id: string;
			cantidad_solicitada: string;
			costo_unitario: string;
		}[]
	>;
	formError: WritableSignal<string>;
	actionError: WritableSignal<string>;
	receiptLines: WritableSignal<
		{
			orden_linea_id: string;
			almacen_id: string;
			cantidad_aceptada: string;
			cantidad_rechazada: string;
			motivo_rechazo: string;
		}[]
	>;
	guideNumber: WritableSignal<string>;
	approvalComment: WritableSignal<string>;
	closeReason: WritableSignal<string>;
	cancelReason: WritableSignal<string>;
	invoiceToAttach: WritableSignal<string>;
	editReceiptId: WritableSignal<string>;
	receiptFormOpen: WritableSignal<boolean>;
	issueMutation: { mutate(): void };
	postReceiptMutation: { mutate(id: string): void };
	nuevo(): void;
	seleccionar(id: string): void;
	cambiarTamano(tamano: number): void;
	editar(orden: OrdenCompraDetalle): void;
	addLine(): void;
	removeLine(index: number): void;
	updateOrderLine(
		index: number,
		field:
			| "producto_id"
			| "almacen_previsto_id"
			| "cantidad_solicitada"
			| "costo_unitario",
		value: string,
	): void;
	guardarOrden(): void;
	enviar(): void;
	decidir(decision: "APROBAR" | "RECHAZAR"): void;
	iniciarRecepcion(): void;
	addReceiptLine(id: string): void;
	removeReceiptLine(index: number): void;
	updateReceiptLine(
		index: number,
		field: "cantidad_aceptada" | "cantidad_rechazada" | "motivo_rechazo",
		value: string,
	): void;
	editarRecepcion(recepcion: RecepcionCompra): void;
	cancelarCapturaRecepcion(): void;
	enviarRecepcion(): void;
	asociarFactura(id: string): void;
	guardarFactura(): void;
	guardarCierre(): void;
	cancelarOrden(): void;
	estadoTexto(estado: string): string;
}

describe("OrdenesComponent", () => {
	let fixture: ComponentFixture<OrdenesComponent>;
	let http: HttpTestingController;
	let c: Control;
	let queryClient: QueryClient;

	async function pintar() {
		for (let i = 0; i < 4; i++) await TURNO();
		fixture.detectChanges();
	}

	function atenderLecturas(detalle: OrdenCompraDetalle = ORDEN) {
		for (const req of http.match((r) => r.method === "GET")) {
			if (req.request.url === "/api/ordenes") {
				req.flush({
					status: "success",
					data: [detalle],
					page: 1,
					per_page: 25,
					total: 1,
				});
			} else if (req.request.url.startsWith("/api/ordenes/")) {
				req.flush({ status: "success", data: detalle });
			} else if (req.request.url === "/api/proveedores") {
				req.flush({
					status: "success",
					data: [
						{
							id: "s1",
							tipo_documento: "RUC",
							numero_documento: "20123456789",
							razon_social: "Distribuidora",
							nombre_comercial: null,
							contacto: null,
							telefono: null,
							correo: null,
							is_active: true,
						},
					],
				});
			} else if (req.request.url === "/api/empresa") {
				req.flush({
					status: "success",
					data: {
						ruc: "20610949518",
						razon_social: "FRIKITEC PERU E.I.R.L.",
						nombre_comercial: "Frikitec",
						direccion_fiscal: "Av. Petit Thouars 5356",
						ubigeo: null,
						distrito: "Miraflores",
						provincia: "Lima",
						departamento: "Lima",
						telefono: null,
						correo: null,
						web: null,
						updated_at: "2026-09-28T10:00:00-05:00",
					},
				});
			} else if (req.request.url === "/api/almacenes") {
				req.flush({
					status: "success",
					data: [{ id: "a1", nombre: "Lima", ubicacion: null }],
				});
			} else if (req.request.url === "/api/productos") {
				req.flush({
					status: "success",
					data: [],
					page: 1,
					per_page: 200,
					total: 0,
				});
			} else {
				throw new Error(`GET inesperado: ${req.request.url}`);
			}
		}
	}

	async function montar(detalle: OrdenCompraDetalle = ORDEN) {
		const login = TestBed.inject(AuthService).iniciarSesion({
			email: "yo@ejemplo.test",
			password: "x",
		});
		http.expectOne("/api/auth/login").flush({
			user: {
				id: "u1",
				nombre: "Yo",
				email: "yo@ejemplo.test",
				rol: "TRABAJADOR",
				cargo: "Jefe de Almacén",
				is_admin: false,
			},
		});
		await login;
		fixture = TestBed.createComponent(OrdenesComponent);
		c = fixture.componentInstance as unknown as Control;
		fixture.detectChanges();
		await TURNO();
		atenderLecturas(detalle);
		await pintar();
		queryClient.setQueryData(claves.ordenes.detalle(detalle.id), {
			status: "success",
			data: detalle,
		});
		c.seleccionar(detalle.id);
		fixture.detectChanges();
		await TURNO();
		atenderLecturas(detalle);
		await pintar();
	}

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrdenesComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();
		http = TestBed.inject(HttpTestingController);
		queryClient = TestBed.inject(QueryClient);
	});
	afterEach(() => http.verify());

	it("prepara borrador con validación de proveedor, líneas y duplicados", async () => {
		await montar();
		c.nuevo();
		c.guardarOrden();
		expect(c.formError()).toContain("proveedor");
		c.supplierId.set("s1");
		c.guardarOrden();
		expect(c.formError()).toContain("Completa producto");
		c.updateOrderLine(0, "producto_id", "p1");
		c.updateOrderLine(0, "almacen_previsto_id", "a1");
		c.updateOrderLine(0, "cantidad_solicitada", "10");
		c.updateOrderLine(0, "costo_unitario", "12.50");
		c.addLine();
		c.lines.update((lineas) => [lineas[0], { ...lineas[0] }]);
		c.guardarOrden();
		expect(c.formError()).toContain("una sola vez");
		c.removeLine(1);
		c.guardarOrden();
		await TURNO();
		const crear = http.expectOne("/api/ordenes");
		expect(crear.request.body).toEqual({
			proveedor_id: "s1",
			lineas: [
				{
					producto_id: "p1",
					almacen_previsto_id: "a1",
					cantidad_solicitada: 10,
					costo_unitario: "12.50",
				},
			],
		});
		crear.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();
		expect(c.formError()).toBe("");
		c.editar(ORDEN);
		expect(c.lines()[0].cantidad_solicitada).toBe("10");
		expect(c.estadoTexto("PENDIENTE_APROBACION")).toBe("Pendiente de firmas");
		expect(c.estadoTexto("DESCONOCIDO")).toBe("DESCONOCIDO");
	});

	it("muestra el documento de la orden en su ruta con proveedor, cantidades y total", async () => {
		await montar();
		fixture.componentRef.setInput("id", "o1");
		fixture.detectChanges();
		await TURNO();
		atenderLecturas();
		await pintar();
		const vista = fixture.nativeElement as HTMLElement;
		expect(vista.textContent).toContain("FRIKITEC PERU E.I.R.L.");
		expect(vista.textContent).toContain(
			"Av. Petit Thouars 5356, Miraflores, Lima, Lima",
		);
		expect(vista.textContent).toContain(
			"Facturar a FRIKITEC PERU E.I.R.L. · RUC 20610949518",
		);
		expect(vista.textContent).toContain("Subtotal PEN");
		expect(vista.querySelector("h1")?.textContent).toContain("Distribuidora");
		expect(vista.textContent).toContain("OC-1");
		expect(vista.textContent).toContain("20123456789");
		expect(vista.textContent).toContain("Productos y cantidades");
		expect(vista.textContent).toContain("Ruta de firmas");
		expect(vista.textContent).toContain("125.00");
		expect(vista.querySelector('a[href="/ordenes"]')).not.toBeNull();
		expect(vista.querySelector("button")?.textContent).toContain(
			"Imprimir orden",
		);
		expect(vista.textContent).not.toContain("Todas las órdenes");
	});

	it("al editar repone el almacén previsto de cada línea", async () => {
		await montar();
		const abrirDialogo = HTMLDialogElement.prototype.showModal;
		HTMLDialogElement.prototype.showModal = function () {
			this.setAttribute("open", "");
		};
		try {
			c.editar(ORDEN);
			fixture.detectChanges();
			const almacen = fixture.nativeElement.querySelector(
				'[aria-label="Preparar orden"] label select',
			) as HTMLSelectElement;
			expect(almacen.value).toBe("a1");
		} finally {
			HTMLDialogElement.prototype.showModal = abrirDialogo;
		}
	});

	it("elige proveedor por RUC en el único buscador del editor", async () => {
		await montar();
		const abrirDialogo = HTMLDialogElement.prototype.showModal;
		HTMLDialogElement.prototype.showModal = function () {
			this.setAttribute("open", "");
		};
		try {
			c.nuevo();
			fixture.detectChanges();
			const campo = fixture.nativeElement.querySelector(
				"#proveedor",
			) as HTMLInputElement;
			campo.value = "20123456789";
			campo.dispatchEvent(new Event("input"));
			fixture.detectChanges();
			expect(c.supplierId()).toBe("s1");
			expect(fixture.nativeElement.textContent).toContain("Distribuidora");
		} finally {
			HTMLDialogElement.prototype.showModal = abrirDialogo;
		}
	});

	it("carga el editor por ruta sin perder los cambios locales al refrescar la consulta", async () => {
		await montar();
		fixture.componentRef.setInput("id", "o1");
		fixture.componentRef.setInput("modo", "editor");
		await pintar();
		atenderLecturas();
		await pintar();
		expect(fixture.nativeElement.querySelector("h1")?.textContent).toContain(
			"Editar orden",
		);
		expect(c.lines()[0].almacen_previsto_id).toBe("a1");
		c.updateOrderLine(0, "cantidad_solicitada", "7");
		queryClient.setQueryData(claves.ordenes.detalle("o1"), {
			status: "success",
			data: { ...ORDEN },
		});
		await pintar();
		expect(c.lines()[0].cantidad_solicitada).toBe("7");
		expect(fixture.nativeElement.textContent).toContain("87.50");
	});

	it("un enlace directo no permite editar la orden de otro creador", async () => {
		await montar({ ...ORDEN, created_by_id: "otro" });
		fixture.componentRef.setInput("id", "o1");
		fixture.componentRef.setInput("modo", "editor");
		await pintar();
		atenderLecturas({ ...ORDEN, created_by_id: "otro" });
		await pintar();
		expect(fixture.nativeElement.textContent).toContain(
			"No puedes editar esta orden",
		);
		expect(fixture.nativeElement.querySelector("form")).toBeNull();
		c.guardarOrden();
		expect(c.formError()).toContain("No puedes editar");
		http.expectNone((r) => r.method === "PUT" || r.method === "POST");
	});

	it("pagina órdenes en el servidor y vuelve a la primera al cambiar el tamaño", async () => {
		await montar();
		expect(c.pageSize()).toBe(10);
		c.page.set(2);
		fixture.detectChanges();
		await TURNO();
		atenderLecturas();
		c.cambiarTamano(50);
		expect(c.page()).toBe(1);
		fixture.detectChanges();
		await TURNO();
		const pagina = http.expectOne(
			(r) => r.url === "/api/ordenes" && r.params.get("per_page") === "50",
		);
		expect(pagina.request.params.get("page")).toBe("1");
		pagina.flush({
			status: "success",
			data: [ORDEN],
			page: 1,
			per_page: 50,
			total: 1,
		});
	});

	it("muestra errores antes de recibir, facturar, cerrar o cancelar y envía operaciones válidas", async () => {
		await montar();
		c.decidir("RECHAZAR");
		expect(c.actionError()).toContain("motivo del rechazo");
		c.enviarRecepcion();
		expect(c.actionError()).toContain("al menos una cantidad");
		c.guardarFactura();
		expect(c.actionError()).toContain("número de factura");
		c.guardarCierre();
		expect(c.actionError()).toContain("motivo del cierre");
		c.cancelarOrden();
		expect(c.actionError()).toContain("motivo de cancelación");

		c.iniciarRecepcion();
		expect(c.receiptLines().length).toBe(1);
		c.addReceiptLine("l1");
		expect(c.receiptLines().length).toBe(2);
		c.removeReceiptLine(1);
		c.updateReceiptLine(0, "cantidad_aceptada", "3");
		c.updateReceiptLine(0, "cantidad_rechazada", "1");
		c.updateReceiptLine(0, "motivo_rechazo", "Dañado");
		c.guideNumber.set(" G-1 ");
		c.enviarRecepcion();
		await TURNO();
		const crear = http.expectOne("/api/ordenes/o1/recepciones");
		expect(crear.request.body.numero_guia).toBe("G-1");
		expect(crear.request.body.lineas[0]).toEqual({
			orden_linea_id: "l1",
			almacen_id: "a1",
			cantidad_aceptada: 3,
			cantidad_rechazada: 1,
			motivo_rechazo: "Dañado",
		});
		crear.flush({ status: "success", data: { ...ORDEN, receipts: [RECIBO] } });
		await pintar();
		atenderLecturas({ ...ORDEN, receipts: [RECIBO] });
		await pintar();
		expect(c.receiptFormOpen()).toBe(false);

		c.editarRecepcion(RECIBO);
		expect(c.editReceiptId()).toBe("r1");
		c.cancelarCapturaRecepcion();
		expect(c.editReceiptId()).toBe("");
		c.asociarFactura("r1");
		c.invoiceToAttach.set(" F-1 ");
		c.guardarFactura();
		await TURNO();
		const factura = http.expectOne("/api/ordenes/o1/recepciones/r1/factura");
		expect(factura.request.body.numero_factura).toBe("F-1");
		factura.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();
	});

	it("envía firmas, contabiliza, corrige, cierra y cancela con respuesta del servidor", async () => {
		await montar();
		c.enviar();
		await TURNO();
		const enviar = http.expectOne("/api/ordenes/o1/enviar");
		expect(enviar.request.method).toBe("POST");
		enviar.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();

		c.approvalComment.set("Aprobado por almacén");
		c.decidir("APROBAR");
		await TURNO();
		const aprobar = http.expectOne("/api/ordenes/o1/aprobacion");
		expect(aprobar.request.body).toEqual({
			decision: "APROBAR",
			comentario: "Aprobado por almacén",
		});
		aprobar.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();
		expect(c.approvalComment()).toBe("");

		c.issueMutation.mutate();
		await TURNO();
		http
			.expectOne("/api/ordenes/o1/emitir")
			.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();

		c.editarRecepcion(RECIBO);
		c.enviarRecepcion();
		await TURNO();
		const corregir = http.expectOne("/api/ordenes/o1/recepciones/r1");
		expect(corregir.request.method).toBe("PUT");
		corregir.flush({
			status: "success",
			data: { ...ORDEN, receipts: [RECIBO] },
		});
		await pintar();
		atenderLecturas({ ...ORDEN, receipts: [RECIBO] });
		await pintar();

		c.postReceiptMutation.mutate("r1");
		await TURNO();
		http
			.expectOne("/api/ordenes/o1/recepciones/r1/contabilizar")
			.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();

		c.closeReason.set("Faltante definitivo");
		c.guardarCierre();
		await TURNO();
		const cierre = http.expectOne("/api/ordenes/o1/cerrar-saldo");
		expect(cierre.request.body).toEqual({
			motivo: "Faltante definitivo",
			lineas: [{ orden_linea_id: "l1", cantidad_cerrada: 10 }],
		});
		cierre.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();
		expect(c.closeReason()).toBe("");

		c.cancelReason.set("Ya no se requiere");
		c.cancelarOrden();
		await TURNO();
		const cancelar = http.expectOne("/api/ordenes/o1/cancelar");
		expect(cancelar.request.body.motivo).toBe("Ya no se requiere");
		cancelar.flush({ status: "success", data: ORDEN });
		await pintar();
		atenderLecturas();
		await pintar();
		expect(c.cancelReason()).toBe("");
	});
});
