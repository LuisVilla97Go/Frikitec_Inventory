import { CommonModule, DOCUMENT } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	type ElementRef,
	effect,
	inject,
	type OnDestroy,
	signal,
	viewChild,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import {
	LucideArrowLeft as ArrowLeft,
	LucideArrowRight as ArrowRight,
	LucideBan as Ban,
	LucideCamera as Camera,
	LucideCameraOff as CameraOff,
	LucideFilter as Filter,
	LucideDynamicIcon,
	LucidePencil as Pencil,
	LucidePlus as Plus,
	LucidePrinter as Printer,
	LucideTrash2 as Trash2,
	LucideTruck as Truck,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import type { IScannerControls } from "@zxing/browser";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import * as v from "valibot";
import { AuthService } from "../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../core/http/api-client";
import { claves } from "../../core/http/claves";
import {
	almacenes,
	datosEmpresa,
	guiaRemision,
	paginaGuias,
	paginaProductos,
	proveedoresActivos,
	stockDisponible,
} from "../../core/http/queries/consultas";
import { BarcodeComponent } from "../../shared/components/barcode/barcode.component";
import { BuscadorProveedorComponent } from "../../shared/components/buscador-proveedor/buscador-proveedor.component";
import {
	PaginadorComponent,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import type {
	Empresa,
	GuiaResumen,
	Producto,
} from "../../shared/schemas/api.schema";
import {
	ConDatos,
	GuiaCompleta,
	GuiaCreada,
	GuiaRemisionRequest,
} from "../../shared/schemas/api.schema";

interface DetalleGuia {
	producto_id: string;
	sku: string;
	nombre: string;
	cantidad: number;
}

export const MOTIVOS: readonly { codigo: string; nombre: string }[] = [
	{ codigo: "04", nombre: "Traslado entre establecimientos" },
	{ codigo: "01", nombre: "Venta" },
	{ codigo: "02", nombre: "Compra" },
];
const COMPRA = "02";

const ESTADOS: Record<string, string> = {
	EN_TRANSITO: "En tránsito",
	RECIBIDO: "Recibida",
	ANULADO: "Anulada",
	BORRADOR: "Borrador",
};

export function diaEnLima(iso: string): string {
	return new Date(iso).toLocaleDateString("en-CA", {
		timeZone: "America/Lima",
	});
}

export function reglaPieDeHoja(
	numeroGuia: string,
	empresa: Pick<Empresa, "razon_social" | "ruc"> | null = null,
): string {
	const css = (texto: string) =>
		texto.replace(/[\\"]/g, "\\$&").replace(/[\n\r\f]/g, " ");
	const quien = empresa
		? `${css(empresa.razon_social)} · RUC ${css(empresa.ruc)} · `
		: "";
	const letra =
		"font-family: Rubik, sans-serif; font-size: 8pt; color: #4b5563;";
	return `@page {
	@bottom-left { content: "${quien}Guía ${css(numeroGuia)}"; ${letra} }
	@bottom-right { content: "Hoja " counter(page) " de " counter(pages); ${letra} }
}`;
}

@Component({
	selector: "app-guias-remision",
	standalone: true,
	imports: [
		CommonModule,
		LucideDynamicIcon,
		BarcodeComponent,
		BuscadorProveedorComponent,
		PaginadorComponent,
		ReactiveFormsModule,
		RouterLink,
	],
	templateUrl: "./guias-remision.component.html",
	styleUrl: "./guias-remision.component.css",
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuiasRemisionComponent implements OnDestroy {
	private readonly api = inject(ApiClient);
	private readonly fb = inject(FormBuilder);
	private readonly document = inject(DOCUMENT);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	protected readonly Filter = Filter;
	protected readonly Plus = Plus;
	protected readonly ArrowRight = ArrowRight;
	protected readonly ArrowLeft = ArrowLeft;
	protected readonly Ban = Ban;
	protected readonly Camera = Camera;
	protected readonly CameraOff = CameraOff;
	protected readonly Truck = Truck;
	protected readonly Pencil = Pencil;
	protected readonly Printer = Printer;
	protected readonly Trash2 = Trash2;
	protected readonly X = X;
	protected readonly MOTIVOS = MOTIVOS;

	// Estado
	protected currentView = signal<"list" | "form" | "detail">("list");
	protected guiaId = signal<string | null>(null);
	protected editando = signal<GuiaCompleta | null>(null);
	protected formError = signal<string | null>(null);

	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("guias");
	protected guiasQuery = injectQuery(() =>
		paginaGuias(this.api, this.pagina(), this.porPagina()),
	);
	protected guiaQuery = injectQuery(() =>
		guiaRemision(this.api, this.guiaId() ?? ""),
	);
	protected almacenesQuery = injectQuery(() => almacenes(this.api));
	protected empresaQuery = injectQuery(() => datosEmpresa(this.api));
	protected proveedoresQuery = injectQuery(() => ({
		...proveedoresActivos(this.api),
		enabled: this.currentView() === "form",
	}));

	protected ubicacionEmpresa = computed(() => {
		const empresa = this.empresaQuery.data();
		return empresa
			? [empresa.distrito, empresa.provincia, empresa.departamento]
				.filter(Boolean)
				.join(" - ")
			: "";
	});

	protected puedeAnular = computed(() => {
		const usuario = this.auth.usuario();
		return Boolean(
			usuario?.is_admin || usuario?.cargo?.toLowerCase().includes("jefe"),
		);
	});

	// Formulario principal
	protected form = this.fb.group({
		fecha_traslado: ["", Validators.required],
		motivo_traslado: ["04", Validators.required],
		almacen_origen_id: [""],
		almacen_destino_id: ["", Validators.required],
		proveedor_id: [""],
		peso_bruto_total: [0, [Validators.required, Validators.min(0)]],
		conductor_nombre: [""],
		conductor_dni: [""],
		vehiculo_placa: [""],
	});
	protected motivo = toSignal(this.form.controls.motivo_traslado.valueChanges, {
		initialValue: "04",
	});
	protected esCompra = computed(() => this.motivo() === COMPRA);
	protected origenId = toSignal(
		this.form.controls.almacen_origen_id.valueChanges,
		{ initialValue: "" },
	);
	protected destinoId = toSignal(
		this.form.controls.almacen_destino_id.valueChanges,
		{ initialValue: "" },
	);

	protected detalles = signal<DetalleGuia[]>([]);
	protected totalUnidades = computed(() =>
		this.detalles().reduce((suma, d) => suma + d.cantidad, 0),
	);

	protected stockQuery = injectQuery(() => {
		const origen = this.origenId() ?? "";
		const ids = this.detalles().map((d) => d.producto_id);
		return {
			...stockDisponible(this.api, origen, ids),
			enabled:
				this.currentView() === "form" &&
				!this.esCompra() &&
				origen !== "" &&
				ids.length > 0,
		};
	});

	constructor() {
		effect((onCleanup) => {
			const guia = this.guiaQuery.data();
			if (this.currentView() !== "detail" || !guia) return;
			const estilo = this.document.createElement("style");
			estilo.textContent = reglaPieDeHoja(
				guia.numero_guia,
				this.empresaQuery.data() ?? null,
			);
			this.document.head.appendChild(estilo);
			onCleanup(() => estilo.remove());
		});
	}

	protected searchControl = this.fb.control("");
	protected searchValue = toSignal(
		this.searchControl.valueChanges.pipe(
			debounceTime(300),
			distinctUntilChanged(),
		),
		{ initialValue: "" },
	);

	protected productosQuery = injectQuery(() =>
		paginaProductos(this.api, 1, 10, this.searchValue() || "", false),
	);

	protected showAutocomplete = signal(false);

	protected nombreMotivo(codigo: string): string {
		return MOTIVOS.find((m) => m.codigo === codigo)?.nombre ?? codigo;
	}

	protected nombreEstado(estado: string): string {
		return ESTADOS[estado] ?? estado;
	}

	protected openList() {
		this.currentView.set("list");
		this.guiaId.set(null);
		this.editando.set(null);
		this.formError.set(null);
	}

	protected openForm() {
		this.editando.set(null);
		this.form.reset({ motivo_traslado: "04", peso_bruto_total: 0 });
		this.detalles.set([]);
		this.searchControl.setValue("");
		this.formError.set(null);
		this.currentView.set("form");
	}

	protected editar(guia: GuiaCompleta) {
		this.editando.set(guia);
		this.form.reset({
			fecha_traslado: diaEnLima(guia.fecha_traslado),
			motivo_traslado: guia.motivo_traslado,
			almacen_origen_id: guia.almacen_origen_id ?? "",
			almacen_destino_id: guia.almacen_destino_id,
			proveedor_id: guia.proveedor_id ?? "",
			peso_bruto_total: guia.peso_bruto_total,
			conductor_nombre: guia.conductor_nombre ?? "",
			conductor_dni: guia.conductor_dni ?? "",
			vehiculo_placa: guia.vehiculo_placa ?? "",
		});
		this.detalles.set(
			guia.detalles.map((d) => ({
				producto_id: d.producto_id,
				sku: d.producto_sku,
				nombre: d.producto_nombre,
				cantidad: d.cantidad,
			})),
		);
		this.searchControl.setValue("");
		this.formError.set(null);
		this.currentView.set("form");
	}

	protected volverDelFormulario() {
		const guia = this.editando();
		this.editando.set(null);
		if (guia) this.openDetail(guia);
		else this.openList();
	}

	protected openDetail(guia: Pick<GuiaResumen, "id">) {
		this.guiaId.set(guia.id);
		this.currentView.set("detail");
	}

	protected printDocument() {
		window.print();
	}

	// Carrito de Bienes

	protected selectProducto(p: Producto) {
		this.showAutocomplete.set(false);
		this.searchControl.setValue("");

		const existe = this.detalles().find((d) => d.producto_id === p.id);
		if (existe) {
			this.updateCantidad(p.id, existe.cantidad + 1);
		} else {
			this.detalles.update((arr) => [
				...arr,
				{ producto_id: p.id, sku: p.sku, nombre: p.name, cantidad: 1 },
			]);
		}
	}

	protected updateCantidad(productoId: string, cantidad: number) {
		if (!Number.isInteger(cantidad) || cantidad < 1) return;
		this.detalles.update((arr) =>
			arr.map((d) => (d.producto_id === productoId ? { ...d, cantidad } : d)),
		);
	}

	protected removeDetalle(productoId: string) {
		this.detalles.update((arr) =>
			arr.filter((d) => d.producto_id !== productoId),
		);
	}

	protected disponible(productoId: string): number | null {
		if (this.esCompra()) return null;
		const stock = this.stockQuery
			.data()
			?.find((s) => s.producto_id === productoId)?.stock;
		if (stock === undefined) return null;
		const guia = this.editando();
		const devuelve =
			guia &&
				guia.motivo_traslado !== COMPRA &&
				guia.almacen_origen_id === this.origenId()
				? guia.detalles
					.filter((d) => d.producto_id === productoId)
					.reduce((suma, d) => suma + d.cantidad, 0)
				: 0;
		return stock + devuelve;
	}

	protected excede(d: DetalleGuia): boolean {
		const maximo = this.disponible(d.producto_id);
		return maximo !== null && d.cantidad > maximo;
	}

	// Guardar

	protected guardarMutation = injectMutation(() => ({
		mutationFn: async (datos: GuiaRemisionRequest) => {
			const guia = this.editando();
			return guia
				? (
					await this.api.put(
						`/api/guias-remision/${encodeURIComponent(guia.id)}`,
						datos,
						ConDatos(GuiaCompleta),
					)
				).data
				: (
					await this.api.post(
						"/api/guias-remision",
						datos,
						ConDatos(GuiaCreada),
					)
				).data;
		},
		onSuccess: (guia: { id: string }) => {
			void this.queryClient.invalidateQueries({ queryKey: claves.guias.todo });
			this.editando.set(null);
			this.openDetail(guia);
		},
		onError: (err: Error) => {
			this.formError.set(mensajeDeError(err, "Error al guardar la guía"));
		},
	}));

	protected guardar() {
		this.formError.set(null);
		const raw = this.form.getRawValue();
		const compra = raw.motivo_traslado === COMPRA;

		if (
			this.form.invalid ||
			(compra ? !raw.proveedor_id : !raw.almacen_origen_id)
		) {
			this.form.markAllAsTouched();
			this.formError.set("Complete los campos obligatorios");
			return;
		}
		if (this.detalles().length === 0) {
			this.formError.set("Debe agregar al menos un producto");
			return;
		}
		const sinStock = this.detalles().filter((d) => this.excede(d));
		if (sinStock.length) {
			this.formError.set(
				`No alcanza el stock del origen para: ${sinStock
					.map((d) => `${d.nombre} (máx. ${this.disponible(d.producto_id)})`)
					.join(", ")}`,
			);
			return;
		}

		const payload = {
			motivo_traslado: raw.motivo_traslado,
			almacen_origen_id: compra ? null : raw.almacen_origen_id,
			almacen_destino_id: raw.almacen_destino_id,
			proveedor_id: compra ? raw.proveedor_id : null,
			fecha_traslado: `${raw.fecha_traslado}T12:00:00-05:00`,
			peso_bruto_total: Number(raw.peso_bruto_total),
			conductor_nombre: raw.conductor_nombre || null,
			conductor_dni: raw.conductor_dni || null,
			vehiculo_placa: raw.vehiculo_placa || null,
			detalles: this.detalles().map((d) => ({
				producto_id: d.producto_id,
				cantidad: d.cantidad,
			})),
		};

		const result = v.safeParse(GuiaRemisionRequest, payload);
		if (!result.success) {
			this.formError.set("Datos inválidos en el formulario");
			return;
		}

		this.guardarMutation.mutate(result.output);
	}

	// Anular

	private readonly anularDialog =
		viewChild<ElementRef<HTMLDialogElement>>("anularDialog");
	protected motivoAnulacion = this.fb.control("");
	protected anularError = signal<string | null>(null);

	protected abrirAnular() {
		this.motivoAnulacion.reset("");
		this.anularError.set(null);
		this.anularDialog()?.nativeElement.showModal();
	}

	protected cerrarAnular() {
		this.anularDialog()?.nativeElement.close();
	}

	protected anularMutation = injectMutation(() => ({
		mutationFn: async ({ id, motivo }: { id: string; motivo: string }) =>
			(
				await this.api.post(
					`/api/guias-remision/${encodeURIComponent(id)}/anular`,
					{ motivo },
					ConDatos(GuiaCompleta),
				)
			).data,
		onSuccess: (guia: GuiaCompleta) => {
			this.queryClient.setQueryData(claves.guias.detalle(guia.id), guia);
			void this.queryClient.invalidateQueries({ queryKey: claves.guias.todo });
			this.cerrarAnular();
		},
		onError: (err: Error) =>
			this.anularError.set(mensajeDeError(err, "No se pudo anular la guía")),
	}));

	protected anular(guia: GuiaCompleta) {
		const motivo = (this.motivoAnulacion.value ?? "").trim();
		if (motivo.length < 5) {
			this.anularError.set("Escribe el motivo (al menos 5 letras)");
			return;
		}
		this.anularError.set(null);
		this.anularMutation.mutate({ id: guia.id, motivo });
	}

	// Escanear

	protected isScannerOpen = signal(false);
	protected scanResult = signal<string | null>(null);
	protected arrancando = signal(false);
	protected camError = signal<string | null>(null);
	protected activo = signal(false);

	private controls: IScannerControls | null = null;
	readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>("videoRef");

	protected openScanner() {
		this.isScannerOpen.set(true);
		this.scanResult.set(null);
		this.activo.set(false);
		this.camError.set(null);
		setTimeout(() => this.iniciarCamara(), 100);
	}

	protected closeScanner() {
		this.detenerCamara();
		this.isScannerOpen.set(false);
	}

	protected async iniciarCamara() {
		const video = this.videoRef()?.nativeElement;
		if (!video) return;

		this.camError.set(null);
		this.arrancando.set(true);
		try {
			const { BrowserMultiFormatReader } = await import("@zxing/browser");
			const reader = new BrowserMultiFormatReader();
			this.controls = await reader.decodeFromConstraints(
				{ video: { facingMode: { ideal: "environment" } } },
				video,
				(res) => {
					if (res) this.manejarCodigo(res.getText());
				},
			);
			this.activo.set(true);
		} catch (e) {
			this.camError.set(
				e instanceof Error
					? `No se pudo abrir la cámara: ${e.message}`
					: "No se pudo abrir la cámara",
			);
		} finally {
			this.arrancando.set(false);
		}
	}

	protected detenerCamara() {
		if (this.controls) {
			this.controls.stop();
			this.controls = null;
		}
		this.activo.set(false);
	}

	private manejarCodigo(codigo: string) {
		this.detenerCamara();
		this.isScannerOpen.set(false);

		this.searchControl.setValue(codigo);
		this.showAutocomplete.set(true);
		this.scanResult.set(`¡Escaneado: ${codigo}! Selecciona el producto.`);
		setTimeout(() => this.scanResult.set(null), 4000);
	}

	ngOnDestroy() {
		this.detenerCamara();
	}
}
