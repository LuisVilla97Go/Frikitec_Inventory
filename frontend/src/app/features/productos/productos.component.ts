import { DecimalPipe } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	DestroyRef,
	inject,
	signal,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import {
	type AbstractControl,
	FormBuilder,
	ReactiveFormsModule,
	Validators,
} from "@angular/forms";
import {
	LucideBarcode as Barcode,
	LucideEdit2 as Edit2,
	LucideFileSpreadsheet as FileSpreadsheet,
	LucideDynamicIcon,
	LucidePlus as Plus,
	LucideSave as Save,
	LucideSearch as Search,
	LucideTag as Tag,
	LucideTrash2 as Trash2,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	keepPreviousData,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import { debounceTime } from "rxjs";
import { AuthService } from "../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../core/http/api-client";
import { claves } from "../../core/http/claves";
import {
	almacenes,
	type CampoSugerible,
	paginaProductos,
	sugerenciasDeProducto,
} from "../../core/http/queries/consultas";
import { CATEGORIAS_PRODUCTO } from "../../shared/catalogos/categorias";
import { DialogoCodigoBarrasComponent } from "../../shared/components/dialogo-codigo-barras/dialogo-codigo-barras.component";
import { DialogoConfirmacionComponent } from "../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component";
import {
	PaginadorComponent,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import { ConDatos, Producto } from "../../shared/schemas/api.schema";
import { ImportarProductosComponent } from "./importar-productos/importar-productos.component";

const ESPERA_BUSQUEDA_MS = 300;

const CAMPO_SUGERIBLE = {
	brand: "marca",
	sub_category: "sub_categoria",
	variant: "variante",
} as const satisfies Record<string, CampoSugerible>;


@Component({
	selector: "app-productos",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		DecimalPipe,
		ReactiveFormsModule,
		LucideDynamicIcon,
		DialogoCodigoBarrasComponent,
		DialogoConfirmacionComponent,
		ImportarProductosComponent,
		PaginadorComponent,
	],
	templateUrl: "./productos.component.html",
})
export class ProductosComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);
	protected readonly importando = signal(false);

	protected readonly icons = {
		Plus,
		Search,
		Edit2,
		Trash2,
		X,
		Save,
		Tag,
		Barcode,
		FileSpreadsheet,
	};
	protected readonly categorias = CATEGORIAS_PRODUCTO;

	protected readonly busqueda = signal("");
	private readonly busquedaAplicada = signal("");
	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("productos");
	protected readonly soloSinCosto = signal(false);
	private temporizador: ReturnType<typeof setTimeout> | undefined;

	protected readonly productsQuery = injectQuery(() => ({
		...paginaProductos(
			this.api,
			this.pagina(),
			this.porPagina(),
			this.busquedaAplicada(),
			this.soloSinCosto(),
		),
		placeholderData: keepPreviousData,
	}));

	protected readonly form = inject(FormBuilder).nonNullable.group({
		sku: ["", [Validators.required, Validators.maxLength(50)]],
		name: ["", [Validators.required, Validators.maxLength(200)]],
		category: [
			"",
			(c: AbstractControl<string>) =>
				(CATEGORIAS_PRODUCTO as readonly string[]).includes(c.value)
					? null
					: { categoria: true },
		],
		sub_category: ["", Validators.maxLength(100)],
		variant: ["", Validators.maxLength(100)],
		barcode: ["", Validators.maxLength(50)],
		brand: ["", [Validators.required, Validators.maxLength(100)]],
		sale_price: [0, [Validators.required, Validators.min(0)]],
		purchase_price: [0, [Validators.required, Validators.min(0)]],
		initial_stock: [
			0,
			[
				Validators.min(0),
				(c: AbstractControl<number>) =>
					Number.isInteger(Number(c.value)) ? null : { entero: true },
			],
		],
		warehouse_id: [""],
	});
	protected readonly modalAbierto = signal(false);
	protected readonly editandoId = signal<string | null>(null);
	protected readonly errorFormulario = signal("");

	protected readonly costoEditable = signal(true);
	protected readonly costoActual = signal(0);
	private readonly stockInicial = toSignal(
		this.form.controls.initial_stock.valueChanges,
		{ initialValue: 0 },
	);
	protected readonly pideAlmacen = computed(
		() => this.costoEditable() && Number(this.stockInicial()) > 0,
	);
	protected readonly almacenesQuery = injectQuery(() => ({
		...almacenes(this.api),
		enabled: this.modalAbierto() && this.costoEditable(),
	}));

	private readonly categoriaElegida = toSignal(
		this.form.controls.category.valueChanges,
		{ initialValue: "" },
	);
	protected readonly marcasSugeridas = this.sugerir("brand");
	protected readonly variantesSugeridas = this.sugerir("variant");
	protected readonly subcategoriasSugeridas = this.sugerir(
		"sub_category",
		() =>
			(CATEGORIAS_PRODUCTO as readonly string[]).includes(
				this.categoriaElegida(),
			)
				? this.categoriaElegida()
				: "",
	);

	protected readonly guardarMutation = injectMutation(() => ({
		mutationFn: () => {
			const cuerpo = this.cuerpoDelFormulario();
			const id = this.editandoId();
			return id
				? this.api.put(`/api/productos/${id}`, cuerpo, ConDatos(Producto))
				: this.api.post("/api/productos", cuerpo, ConDatos(Producto));
		},
		onSuccess: () => {
			void this.queryClient.invalidateQueries({
				queryKey: claves.productos.todo,
			});
			this.cerrarModal();
		},
		onError: (error: unknown) =>
			this.errorFormulario.set(
				mensajeDeError(error, "No se pudo guardar el producto."),
			),
	}));

	protected readonly aDesactivar = signal<Producto | null>(null);
	protected readonly errorListado = signal("");

	protected readonly desactivarMutation = injectMutation(() => ({
		mutationFn: (id: string) => this.api.delete(`/api/productos/${id}`),
		onSuccess: () => {
			void this.queryClient.invalidateQueries({
				queryKey: claves.productos.todo,
			});
			this.aDesactivar.set(null);
		},
		onError: (error: unknown) => {
			this.aDesactivar.set(null);
			this.errorListado.set(
				mensajeDeError(error, "No se pudo eliminar el producto."),
			);
		},
	}));

	protected readonly codigoAVer = signal<{
		codigo: string;
		nombre: string | null;
		sku: string | null;
	} | null>(null);

	constructor() {
		inject(DestroyRef).onDestroy(() => clearTimeout(this.temporizador));
	}

	protected verCodigo(
		codigo: string | null | undefined,
		nombre?: string | null,
		sku?: string | null,
	) {
		const valor = codigo?.trim();
		if (!valor) return;
		this.codigoAVer.set({
			codigo: valor,
			nombre: nombre?.trim() || null,
			sku: sku?.trim() || null,
		});
	}

	protected actualizarBusqueda(evento: Event) {
		this.busqueda.set((evento.target as HTMLInputElement).value);
		clearTimeout(this.temporizador);
		this.temporizador = setTimeout(() => {
			this.busquedaAplicada.set(this.busqueda().trim());
			this.pagina.set(1);
		}, ESPERA_BUSQUEDA_MS);
	}

	protected alternarSinCosto() {
		this.soloSinCosto.update((activo) => !activo);
		this.pagina.set(1);
	}

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}

	protected abrirNuevo() {
		this.editandoId.set(null);
		this.costoEditable.set(true);
		this.form.reset();
		this.errorFormulario.set("");
		this.modalAbierto.set(true);
	}

	protected abrirEdicion(producto: Producto) {
		this.editandoId.set(producto.id);
		this.form.reset({
			sku: producto.sku,
			name: producto.name,
			category: producto.category,
			sub_category: producto.sub_category ?? "",
			variant: producto.variant ?? "",
			barcode: producto.barcode ?? "",
			brand: producto.brand,
			sale_price: producto.sale_price,
			purchase_price: producto.purchase_price,
		});
		this.costoEditable.set(!producto.has_movements);
		this.costoActual.set(producto.purchase_price);
		this.errorFormulario.set("");
		this.modalAbierto.set(true);
	}

	protected cerrarModal() {
		this.modalAbierto.set(false);
	}

	protected guardar() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			this.errorFormulario.set("Revisa los campos obligatorios.");
			return;
		}
		if (this.pideAlmacen() && !this.form.controls.warehouse_id.value) {
			this.form.controls.warehouse_id.markAsTouched();
			this.errorFormulario.set("Elige el almacén del stock inicial.");
			return;
		}
		this.errorFormulario.set("");
		this.guardarMutation.mutate();
	}

	protected invalido(campo: keyof typeof this.form.controls): boolean {
		const control = this.form.controls[campo];
		return control.invalid && control.touched;
	}

	private sugerir(
		control: keyof typeof CAMPO_SUGERIBLE,
		categoria: () => string = () => "",
	) {
		const texto = toSignal(
			this.form.controls[control].valueChanges.pipe(
				debounceTime(ESPERA_BUSQUEDA_MS),
			),
			{ initialValue: "" },
		);
		return injectQuery(() => ({
			...sugerenciasDeProducto(
				this.api,
				CAMPO_SUGERIBLE[control],
				texto().trim(),
				categoria(),
			),
			enabled: this.modalAbierto(),
			placeholderData: keepPreviousData,
		}));
	}

	private cuerpoDelFormulario() {
		const f = this.form.getRawValue();
		const opcional = (texto: string) => texto.trim() || null;
		return {
			sku: f.sku.trim().toUpperCase(),
			name: f.name.trim(),
			category: f.category.trim(),
			sub_category: opcional(f.sub_category),
			variant: opcional(f.variant),
			barcode: opcional(f.barcode),
			brand: f.brand.trim(),
			sale_price: Number(f.sale_price).toFixed(2),
			...(this.costoEditable() && {
				purchase_price: Number(f.purchase_price).toFixed(2),
				...(this.pideAlmacen() && {
					initial_stock: Number(f.initial_stock),
					warehouse_id: f.warehouse_id,
				}),
			}),
		};
	}
}
