import { DatePipe, DecimalPipe, NgClass } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	effect,
	inject,
	input,
	signal,
	untracked,
} from "@angular/core";
import { FormControl, ReactiveFormsModule } from "@angular/forms";
import { Router, RouterLink } from "@angular/router";
import {
	injectMutation,
	injectQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";

import { AuthService } from "../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../core/http/api-client";
import { claves } from "../../core/http/claves";
import {
	almacenes,
	datosEmpresa,
	ordenCompra,
	paginaOrdenesCompra,
	proveedoresActivos,
} from "../../core/http/queries/consultas";
import { BuscadorProveedorComponent } from "../../shared/components/buscador-proveedor/buscador-proveedor.component";
import {
	PaginadorComponent,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import type {
	OrdenCompraDetalle,
	RecepcionCompra,
} from "../../shared/schemas/api.schema";
import { BuscadorProductoOrdenComponent } from "./buscador-producto-orden.component";
import {
	type OrdenCompraEntrada,
	OrdenesApi,
	type RecepcionEntrada,
} from "./ordenes.api";

interface LineaEditable {
	producto_id: string;
	almacen_previsto_id: string;
	cantidad_solicitada: string;
	costo_unitario: string;
}

interface LineaRecepcionEditable {
	orden_linea_id: string;
	almacen_id: string;
	cantidad_aceptada: string;
	cantidad_rechazada: string;
	motivo_rechazo: string;
}

function normalizarCargo(valor: string | null | undefined): string {
	return (valor ?? "")
		.normalize("NFKD")
		.replace(/[\u0300-\u036f]/g, "")
		.toLocaleLowerCase()
		.trim()
		.replace(/\s+/g, " ");
}

@Component({
	selector: "app-ordenes",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DatePipe,
		DecimalPipe,
		NgClass,
		RouterLink,
		ReactiveFormsModule,
		BuscadorProductoOrdenComponent,
		BuscadorProveedorComponent,
		PaginadorComponent,
	],
	templateUrl: "./ordenes.component.html",
	styleUrl: "./ordenes.component.css",
})
export class OrdenesComponent {
	readonly id = input<string>();
	readonly modo = input<"lista" | "detalle" | "ejemplo" | "editor">("lista");
	private readonly router = inject(Router);
	private readonly api = inject(ApiClient);
	private readonly ordenesApi = inject(OrdenesApi);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	protected readonly usuario = this.auth.usuario;
	protected readonly page = signal(1);
	protected readonly pageSize = inject(TamanosDePagina).de("ordenes");
	protected readonly selectedOrderId = signal("");
	protected readonly showEditor = signal(false);
	protected readonly showDemo = signal(false);
	protected readonly editOrderId = signal("");
	protected readonly formError = signal("");
	protected readonly actionError = signal("");
	protected readonly supplierId = signal("");
	protected readonly proveedorControl = new FormControl("", {
		nonNullable: true,
	});
	protected readonly lines = signal<LineaEditable[]>([this.blankLine()]);
	protected readonly approvalComment = signal("");
	protected readonly cancelReason = signal("");
	protected readonly closeReason = signal("");
	protected readonly receiptDate = signal("");
	protected readonly receiptFormOpen = signal(false);
	protected readonly editReceiptId = signal("");
	protected readonly guideNumber = signal("");
	protected readonly guideDate = signal("");
	protected readonly invoiceNumber = signal("");
	protected readonly invoiceDate = signal("");
	protected readonly receiptLines = signal<LineaRecepcionEditable[]>([]);
	protected readonly invoiceToAttach = signal("");
	protected readonly invoiceDateToAttach = signal("");
	protected readonly attachToReceiptId = signal("");

	protected readonly ordersQuery = injectQuery(() => ({
		...paginaOrdenesCompra(this.api, this.page(), this.pageSize()),
		enabled: !this.id() && this.modo() === "lista",
	}));
	protected readonly detailQuery = injectQuery(() =>
		ordenCompra(this.api, this.selectedOrderId()),
	);
	protected readonly suppliersQuery = injectQuery(() =>
		proveedoresActivos(this.api),
	);
	protected readonly warehousesQuery = injectQuery(() => almacenes(this.api));
	protected readonly empresaQuery = injectQuery(() => ({
		...datosEmpresa(this.api),
		enabled: Boolean(this.id()) || this.modo() === "ejemplo",
	}));
	protected readonly direccionEmpresa = computed(() => {
		const empresa = this.empresaQuery.data();
		return empresa
			? [
				empresa.direccion_fiscal,
				empresa.distrito,
				empresa.provincia,
				empresa.departamento,
			]
				.filter(Boolean)
				.join(", ")
			: "";
	});
	protected readonly pendientesPagina = computed(
		() =>
			(this.ordersQuery.data()?.data ?? []).filter(
				(orden) => orden.status === "PENDIENTE_APROBACION",
			).length,
	);
	protected readonly porRecibirPagina = computed(
		() =>
			(this.ordersQuery.data()?.data ?? []).filter((orden) =>
				["EMITIDA", "PARCIALMENTE_RECIBIDA"].includes(orden.status),
			).length,
	);
	protected readonly totalOrden = computed(() =>
		this.lines().reduce((total, line) => {
			const cantidad = Number(line.cantidad_solicitada);
			const costo = Number(line.costo_unitario);
			return total + (Number.isFinite(cantidad * costo) ? cantidad * costo : 0);
		}, 0),
	);
	protected readonly totalDetalle = computed(() =>
		(this.selectedOrder()?.version.lines ?? []).reduce(
			(total, line) => total + line.quantity_ordered * line.unit_cost,
			0,
		),
	);
	protected readonly selectedOrder = computed(
		() => this.detailQuery.data()?.data ?? null,
	);
	protected readonly puedoEditar = computed(() => {
		const orden = this.selectedOrder();
		return Boolean(
			orden &&
			orden.created_by_id === this.usuario()?.id &&
			orden.status !== "PENDIENTE_APROBACION" &&
			orden.status !== "CANCELADA" &&
			orden.status !== "RECIBIDA" &&
			orden.status !== "CERRADA_PARCIALMENTE",
		);
	});
	protected readonly aprobacionPendiente = computed(() => {
		const orden = this.selectedOrder();
		const usuarioId = this.usuario()?.id;
		if (!orden || !usuarioId) return false;
		const siguiente = orden.version.approvals.find(
			(a) => a.status === "PENDIENTE",
		);
		return siguiente?.approver_id === usuarioId;
	});
	protected readonly puedeRecibir = computed(() => {
		const orden = this.selectedOrder();
		return Boolean(
			orden &&
			["EMITIDA", "PARCIALMENTE_RECIBIDA"].includes(orden.status) &&
			normalizarCargo(this.usuario()?.cargo) === "jefe de almacen",
		);
	});
	protected readonly puedeMarcarEmitida = computed(() => {
		const orden = this.selectedOrder();
		return Boolean(
			orden &&
			orden.status === "APROBADA" &&
			orden.created_by_id === this.usuario()?.id,
		);
	});
	protected readonly cerrarLineas = computed(() =>
		(this.selectedOrder()?.version.lines ?? [])
			.filter((line) => line.quantity_open > 0)
			.map((line) => ({
				orden_linea_id: line.id,
				cantidad_cerrada: line.quantity_open,
			})),
	);
	protected readonly suppliers = computed(
		() => this.suppliersQuery.data() ?? [],
	);
	protected readonly warehouses = computed(
		() => this.warehousesQuery.data() ?? [],
	);

	constructor() {
		const proveedorSuscripcion = this.proveedorControl.valueChanges.subscribe(
			(id) => this.supplierId.set(id),
		);
		inject(DestroyRef).onDestroy(() => proveedorSuscripcion.unsubscribe());
		effect(() =>
			this.proveedorControl.setValue(this.supplierId(), { emitEvent: false }),
		);
		effect(() => {
			const id = this.id();
			const modo = this.modo();
			untracked(() => {
				if (modo === "editor" && !id) this.nuevo();
				else if (modo === "ejemplo") this.mostrarEjemplo();
				else if (id) this.seleccionar(id);
			});
		});
		effect(() => {
			const orden = this.selectedOrder();
			if (
				this.modo() === "editor" &&
				this.id() &&
				orden &&
				this.puedoEditar()
			) {
				untracked(() => {
					if (this.editOrderId() !== orden.id) this.editar(orden);
				});
			}
		});
	}

	protected readonly saveOrderMutation = injectMutation(() => ({
		mutationFn: () => {
			const payload = this.orderPayload();
			const id = this.editOrderId();
			return id
				? this.ordenesApi.guardar(id, payload)
				: this.ordenesApi.crear(payload);
		},
		onSuccess: async (result) => {
			this.selectedOrderId.set(result.data.id);
			this.showEditor.set(false);
			this.editOrderId.set("");
			this.afterAction();
			void this.router.navigate(["/ordenes", result.data.id]);
		},
		onError: (error: unknown) =>
			this.formError.set(mensajeDeError(error, "No se pudo guardar la orden.")),
	}));

	protected readonly sendMutation = injectMutation(() => ({
		mutationFn: () => this.ordenesApi.enviar(this.selectedOrderId()),
		onSuccess: (result) => this.success(result.data),
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo enviar a aprobación."),
			),
	}));

	protected readonly approvalMutation = injectMutation(() => ({
		mutationFn: (decision: "APROBAR" | "RECHAZAR") =>
			this.ordenesApi.decidir(
				this.selectedOrderId(),
				decision,
				this.approvalComment().trim(),
			),
		onSuccess: (result) => {
			this.approvalComment.set("");
			this.success(result.data);
		},
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo registrar la firma."),
			),
	}));

	protected readonly issueMutation = injectMutation(() => ({
		mutationFn: () => this.ordenesApi.emitir(this.selectedOrderId()),
		onSuccess: (result) => this.success(result.data),
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo marcar como emitida."),
			),
	}));

	protected readonly receiptMutation = injectMutation(() => ({
		mutationFn: () => {
			const receiptId = this.editReceiptId();
			return receiptId
				? this.ordenesApi.editarRecepcion(
					this.selectedOrderId(),
					receiptId,
					this.receiptPayload(),
				)
				: this.ordenesApi.crearRecepcion(
					this.selectedOrderId(),
					this.receiptPayload(),
				);
		},
		onSuccess: (result) => {
			this.receiptLines.set([]);
			this.guideNumber.set("");
			this.guideDate.set("");
			this.invoiceNumber.set("");
			this.invoiceDate.set("");
			this.receiptFormOpen.set(false);
			this.editReceiptId.set("");
			this.success(result.data);
		},
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo guardar la recepción."),
			),
	}));

	protected readonly postReceiptMutation = injectMutation(() => ({
		mutationFn: (receiptId: string) =>
			this.ordenesApi.contabilizar(this.selectedOrderId(), receiptId),
		onSuccess: (result) => this.success(result.data),
		onError: (error: unknown) =>
			this.actionError.set(mensajeDeError(error, "No se pudo contabilizar.")),
	}));

	protected readonly invoiceMutation = injectMutation(() => ({
		mutationFn: () =>
			this.ordenesApi.adjuntarFactura(
				this.selectedOrderId(),
				this.attachToReceiptId(),
				this.invoiceToAttach().trim(),
				this.invoiceDateToAttach(),
			),
		onSuccess: (result) => {
			this.invoiceToAttach.set("");
			this.invoiceDateToAttach.set("");
			this.attachToReceiptId.set("");
			this.success(result.data);
		},
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo asociar la factura."),
			),
	}));

	protected readonly closeMutation = injectMutation(() => ({
		mutationFn: () =>
			this.ordenesApi.cerrarSaldo(
				this.selectedOrderId(),
				this.closeReason().trim(),
				this.cerrarLineas(),
			),
		onSuccess: (result) => {
			this.closeReason.set("");
			this.success(result.data);
		},
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo cerrar el saldo."),
			),
	}));

	protected readonly cancelMutation = injectMutation(() => ({
		mutationFn: () =>
			this.ordenesApi.cancelar(
				this.selectedOrderId(),
				this.cancelReason().trim(),
			),
		onSuccess: (result) => {
			this.cancelReason.set("");
			this.success(result.data);
		},
		onError: (error: unknown) =>
			this.actionError.set(
				mensajeDeError(error, "No se pudo cancelar la orden."),
			),
	}));

	protected seleccionar(id: string) {
		this.selectedOrderId.set(id);
		this.showDemo.set(false);
		this.actionError.set("");
		this.showEditor.set(false);
		this.receiptFormOpen.set(false);
		this.editReceiptId.set("");
	}

	protected cambiarTamano(tamano: number) {
		this.pageSize.set(tamano);
		this.page.set(1);
	}

	protected imprimir() {
		window.print();
	}

	protected nuevo() {
		this.selectedOrderId.set("");
		this.showDemo.set(false);
		this.editOrderId.set("");
		this.supplierId.set("");
		this.lines.set([this.blankLine()]);
		this.formError.set("");
		this.showEditor.set(true);
	}

	protected editar(orden: OrdenCompraDetalle) {
		this.showDemo.set(false);
		this.editOrderId.set(orden.id);
		this.supplierId.set(orden.version.supplier_id);
		this.lines.set(
			orden.version.lines.map((line) => ({
				producto_id: line.product_id,
				almacen_previsto_id: line.warehouse_id,
				cantidad_solicitada: String(line.quantity_ordered),
				costo_unitario: String(line.unit_cost),
			})),
		);
		this.formError.set("");
		this.showEditor.set(true);
	}

	protected cerrarEditor() {
		if (this.saveOrderMutation.isPending()) return;
		this.showEditor.set(false);
		void this.router.navigate(
			this.id() ? ["/ordenes", this.id()] : ["/ordenes"],
		);
	}

	protected subtotalLinea(line: LineaEditable): number {
		const subtotal =
			Number(line.cantidad_solicitada) * Number(line.costo_unitario);
		return Number.isFinite(subtotal) ? subtotal : 0;
	}

	protected mostrarEjemplo() {
		this.selectedOrderId.set("");
		this.showEditor.set(false);
		this.showDemo.set(true);
	}

	protected addLine() {
		this.lines.update((items) => [...items, this.blankLine()]);
	}

	protected removeLine(index: number) {
		this.lines.update((items) => items.filter((_, i) => i !== index));
	}

	protected updateOrderLine(
		index: number,
		field: keyof LineaEditable,
		value: string,
	) {
		this.lines.update((items) =>
			items.map((line, i) =>
				i === index ? { ...line, [field]: value } : line,
			),
		);
	}

	protected nombreDeProducto(id: string): string {
		return (
			this.selectedOrder()?.version.lines.find((line) => line.product_id === id)
				?.product_name ?? "Producto seleccionado"
		);
	}

	protected updateReceiptLine(
		index: number,
		field: keyof LineaRecepcionEditable,
		value: string,
	) {
		this.receiptLines.update((items) =>
			items.map((line, i) =>
				i === index ? { ...line, [field]: value } : line,
			),
		);
	}

	protected addReceiptLine(orderLineId: string) {
		const line = this.selectedOrder()?.version.lines.find(
			(l) => l.id === orderLineId,
		);
		if (!line) return;
		this.receiptLines.update((items) => [
			...items,
			{
				orden_linea_id: line.id,
				almacen_id: line.warehouse_id,
				cantidad_aceptada: "",
				cantidad_rechazada: "",
				motivo_rechazo: "",
			},
		]);
	}

	protected removeReceiptLine(index: number) {
		this.receiptLines.update((items) => items.filter((_, i) => i !== index));
	}

	protected iniciarRecepcion() {
		this.editReceiptId.set("");
		this.receiptDate.set(
			new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
		);
		this.receiptLines.set(
			(this.selectedOrder()?.version.lines ?? [])
				.filter((line) => line.quantity_open > 0)
				.map((line) => ({
					orden_linea_id: line.id,
					almacen_id: line.warehouse_id,
					cantidad_aceptada: "",
					cantidad_rechazada: "",
					motivo_rechazo: "",
				})),
		);
		this.actionError.set("");
		this.receiptFormOpen.set(true);
	}

	protected editarRecepcion(recepcion: RecepcionCompra) {
		this.editReceiptId.set(recepcion.id);
		this.receiptDate.set(recepcion.arrival_date);
		this.guideNumber.set(recepcion.guide_number ?? "");
		this.guideDate.set(recepcion.guide_date ?? "");
		this.invoiceNumber.set(recepcion.invoice_number ?? "");
		this.invoiceDate.set(recepcion.invoice_date ?? "");
		this.receiptLines.set(
			recepcion.lines.map((line) => ({
				orden_linea_id: line.order_line_id,
				almacen_id: line.warehouse_id,
				cantidad_aceptada: String(line.quantity_accepted),
				cantidad_rechazada: String(line.quantity_rejected),
				motivo_rechazo: line.rejection_reason ?? "",
			})),
		);
		this.actionError.set("");
		this.receiptFormOpen.set(true);
	}

	protected cancelarCapturaRecepcion() {
		this.receiptFormOpen.set(false);
		this.editReceiptId.set("");
		this.receiptLines.set([]);
	}

	protected guardarOrden() {
		if (this.saveOrderMutation.isPending()) return;
		if (this.modo() === "editor" && this.id() && !this.puedoEditar()) {
			this.formError.set("No puedes editar esta orden.");
			return;
		}
		if (!this.supplierId()) {
			this.formError.set("Selecciona un proveedor.");
			return;
		}
		if (
			!this.lines().length ||
			this.lines().some((line) => !this.lineaOrdenValida(line))
		) {
			this.formError.set(
				"Completa producto, almacén, cantidad y costo de cada línea.",
			);
			return;
		}
		const ids = this.lines().map((line) => line.producto_id);
		if (new Set(ids).size !== ids.length) {
			this.formError.set(
				"Cada producto debe aparecer una sola vez en la orden.",
			);
			return;
		}
		this.formError.set("");
		this.saveOrderMutation.mutate();
	}

	protected enviar() {
		this.actionError.set("");
		this.sendMutation.mutate();
	}

	protected decidir(decision: "APROBAR" | "RECHAZAR") {
		if (decision === "RECHAZAR" && !this.approvalComment().trim()) {
			this.actionError.set("Escribe el motivo del rechazo.");
			return;
		}
		this.actionError.set("");
		this.approvalMutation.mutate(decision);
	}

	protected enviarRecepcion() {
		const payload = this.receiptPayload();
		if (!payload.lineas.length) {
			this.actionError.set(
				"Registra al menos una cantidad aceptada o rechazada.",
			);
			return;
		}
		this.actionError.set("");
		this.receiptMutation.mutate();
	}

	protected asociarFactura(receiptId: string) {
		this.attachToReceiptId.set(receiptId);
		this.invoiceToAttach.set("");
		this.invoiceDateToAttach.set("");
	}

	protected guardarFactura() {
		if (!this.invoiceToAttach().trim()) {
			this.actionError.set("Escribe el número de factura.");
			return;
		}
		this.invoiceMutation.mutate();
	}

	protected guardarCierre() {
		if (!this.closeReason().trim() || !this.cerrarLineas().length) {
			this.actionError.set("Indica el motivo del cierre del saldo.");
			return;
		}
		this.closeMutation.mutate();
	}

	protected cancelarOrden() {
		if (!this.cancelReason().trim()) {
			this.actionError.set("Indica el motivo de cancelación.");
			return;
		}
		this.cancelMutation.mutate();
	}

	protected estadoTexto(estado: string): string {
		const textos: Record<string, string> = {
			BORRADOR: "Borrador",
			PENDIENTE_APROBACION: "Pendiente de firmas",
			APROBADA: "Aprobada",
			EMITIDA: "Emitida",
			PARCIALMENTE_RECIBIDA: "Parcialmente recibida",
			RECIBIDA: "Recibida",
			CERRADA_PARCIALMENTE: "Cerrada con saldo",
			RECHAZADA: "Rechazada",
			CANCELADA: "Cancelada",
		};
		return textos[estado] ?? estado;
	}

	protected estadoClase(estado: string): string {
		if (["RECIBIDA", "CERRADA_PARCIALMENTE"].includes(estado))
			return "bg-emerald-50 text-emerald-800 ring-emerald-200";
		if (["RECHAZADA", "CANCELADA"].includes(estado))
			return "bg-rose-50 text-rose-800 ring-rose-200";
		if (["PENDIENTE_APROBACION", "PARCIALMENTE_RECIBIDA"].includes(estado))
			return "bg-amber-50 text-amber-800 ring-amber-200";
		if (["APROBADA", "EMITIDA"].includes(estado))
			return "bg-sky-50 text-sky-800 ring-sky-200";
		return "bg-slate-100 text-slate-700 ring-slate-200";
	}

	protected estadoPuntoClase(estado: string): string {
		if (["RECIBIDA", "CERRADA_PARCIALMENTE"].includes(estado))
			return "bg-emerald-500";
		if (["RECHAZADA", "CANCELADA"].includes(estado)) return "bg-rose-500";
		if (["PENDIENTE_APROBACION", "PARCIALMENTE_RECIBIDA"].includes(estado))
			return "bg-amber-500";
		if (["APROBADA", "EMITIDA"].includes(estado)) return "bg-sky-500";
		return "bg-slate-400";
	}

	private orderPayload(): OrdenCompraEntrada {
		return {
			proveedor_id: this.supplierId(),
			lineas: this.lines().map((line) => ({
				producto_id: line.producto_id,
				almacen_previsto_id: line.almacen_previsto_id,
				cantidad_solicitada: Number(line.cantidad_solicitada),
				costo_unitario: line.costo_unitario,
			})),
		};
	}

	private receiptPayload(): RecepcionEntrada {
		return {
			fecha_recepcion: this.receiptDate(),
			numero_guia: this.guideNumber().trim() || null,
			fecha_guia: this.guideDate() || null,
			numero_factura: this.invoiceNumber().trim() || null,
			fecha_factura: this.invoiceDate() || null,
			lineas: this.receiptLines()
				.filter(
					(line) =>
						Number(line.cantidad_aceptada) > 0 ||
						Number(line.cantidad_rechazada) > 0,
				)
				.map((line) => ({
					orden_linea_id: line.orden_linea_id,
					almacen_id: line.almacen_id,
					cantidad_aceptada: Number(line.cantidad_aceptada || 0),
					cantidad_rechazada: Number(line.cantidad_rechazada || 0),
					motivo_rechazo: line.motivo_rechazo.trim() || null,
				})),
		};
	}

	private lineaOrdenValida(line: LineaEditable): boolean {
		return Boolean(
			line.producto_id &&
			line.almacen_previsto_id &&
			Number.isInteger(Number(line.cantidad_solicitada)) &&
			Number(line.cantidad_solicitada) > 0 &&
			/^\d+(\.\d{1,4})?$/.test(line.costo_unitario) &&
			Number.isFinite(Number(line.costo_unitario)),
		);
	}

	private blankLine(): LineaEditable {
		return {
			producto_id: "",
			almacen_previsto_id: "",
			cantidad_solicitada: "",
			costo_unitario: "",
		};
	}

	private success(orden: OrdenCompraDetalle) {
		this.selectedOrderId.set(orden.id);
		this.actionError.set("");
		this.afterAction();
	}

	private afterAction() {
		void this.queryClient.invalidateQueries({ queryKey: claves.ordenes.todo });
		if (this.selectedOrderId()) {
			void this.queryClient.invalidateQueries({
				queryKey: claves.ordenes.detalle(this.selectedOrderId()),
			});
		}
	}
}
