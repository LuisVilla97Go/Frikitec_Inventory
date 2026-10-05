import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	input,
	output,
} from "@angular/core";
import { toSignal } from "@angular/core/rxjs-interop";
import { FormBuilder, ReactiveFormsModule, Validators } from "@angular/forms";
import {
	LucideAlertCircle as AlertCircle,
	LucideDynamicIcon,
	LucideSave as Save,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import * as v from "valibot";

import { AuthService } from "../../../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../../../core/http/api-client";
import { claves } from "../../../../core/http/claves";
import {
	almacenes,
	proveedoresActivos,
} from "../../../../core/http/queries/consultas";

import {
	DOCUMENTOS_REGISTRABLES,
	opcionesDeTipo,
	TIPOS_DOCUMENTO,
	TIPOS_MOVIMIENTO,
	type TipoDocumento,
	type TipoMovimiento,
} from "../../../../shared/catalogos/movimientos";
import { BuscadorProveedorComponent } from "../../../../shared/components/buscador-proveedor/buscador-proveedor.component";

const ENTRADAS = opcionesDeTipo(
	(t) => t.registrable && t.sentido === "ENTRADA",
);
const SALIDAS = opcionesDeTipo((t) => t.registrable && t.sentido === "SALIDA");
const DOCUMENTOS = DOCUMENTOS_REGISTRABLES.map((valor) => ({
	valor,
	texto: TIPOS_DOCUMENTO[valor],
}));

@Component({
	selector: "app-kardex-movimiento-modal",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, LucideDynamicIcon, BuscadorProveedorComponent],
	templateUrl: "./kardex-movimiento-modal.component.html",
	host: { "(document:keydown.escape)": "closeModal.emit()" },
})
export class KardexMovimientoModalComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	readonly productId = input.required<string>();
	readonly closeModal = output<void>();

	protected readonly icons = { X, Save, AlertCircle };
	protected readonly entradas = ENTRADAS;
	protected readonly salidas = SALIDAS;
	protected readonly documentos = DOCUMENTOS;
	protected readonly textoRevalorizacion =
		TIPOS_MOVIMIENTO.REVALORIZACION.texto;

	protected readonly almacenesQuery = injectQuery(() => almacenes(this.api));
	protected readonly proveedoresQuery = injectQuery(() =>
		proveedoresActivos(this.api),
	);

	protected readonly form = inject(FormBuilder).nonNullable.group({
		almacen_id: ["", Validators.required],
		proveedor_id: ["", Validators.required],
		tipo_movimiento: ["ENTRADA_COMPRA" as TipoMovimiento, Validators.required],
		tipo_documento: ["FACTURA" as TipoDocumento, Validators.required],
		numero_documento: ["", [Validators.required, Validators.maxLength(100)]],
		cantidad: [1, [Validators.required, Validators.min(1)]],
		costo_unitario: [0, Validators.min(0)],
	});

	private readonly tipo = toSignal(
		this.form.controls.tipo_movimiento.valueChanges,
		{
			initialValue: this.form.controls.tipo_movimiento.value,
		},
	);
	protected readonly esSalida = computed(
		() => TIPOS_MOVIMIENTO[this.tipo()].sentido === "SALIDA",
	);
	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);
	protected readonly esRevalorizacion = computed(
		() => this.tipo() === "REVALORIZACION",
	);
	protected readonly esCompra = computed(
		() => this.tipo() === "ENTRADA_COMPRA",
	);

	protected readonly mutation = injectMutation(() => ({
		mutationFn: () =>
			this.api.post(
				`/api/productos/${encodeURIComponent(this.productId())}/movimientos`,
				this.cuerpo(),
				v.object({ message: v.string() }),
			),
		onSuccess: () => {
			void this.queryClient.invalidateQueries({ queryKey: claves.kardex.todo });
			void this.queryClient.invalidateQueries({
				queryKey: claves.productos.todo,
			});
			void this.queryClient.invalidateQueries({
				queryKey: claves.libroDiario.todo,
			});
			this.closeModal.emit();
		},
	}));
	protected readonly errorMessage = computed(() =>
		this.mutation.isError()
			? mensajeDeError(
				this.mutation.error(),
				"Error al registrar el movimiento.",
			)
			: "",
	);

	constructor() {
		effect(() => {
			const lista = this.almacenesQuery.data();
			if (lista?.length === 1 && !this.form.controls.almacen_id.value) {
				this.form.controls.almacen_id.setValue(lista[0].id);
			}
		});
		effect(() => {
			const costo = this.form.controls.costo_unitario;
			if (this.esSalida()) costo.disable();
			else costo.enable();
		});
		effect(() => {
			const { cantidad, tipo_documento } = this.form.controls;
			if (this.esRevalorizacion()) {
				cantidad.disable();
				tipo_documento.setValue("AJUSTE_INVENTARIO");
				tipo_documento.disable();
			} else {
				cantidad.enable();
				tipo_documento.enable();
			}
		});
		effect(() => {
			const proveedor = this.form.controls.proveedor_id;
			if (this.esCompra()) proveedor.enable();
			else {
				proveedor.reset("");
				proveedor.disable();
			}
		});
	}

	protected onSubmit() {
		if (this.form.invalid) {
			this.form.markAllAsTouched();
			return;
		}
		this.mutation.mutate();
	}

	private cuerpo() {
		const f = this.form.getRawValue();
		const cantidad = Math.abs(Math.trunc(f.cantidad));
		return {
			almacen_id: f.almacen_id,
			proveedor_id: this.esCompra() ? f.proveedor_id : null,
			tipo_movimiento: f.tipo_movimiento,
			tipo_documento: f.tipo_documento,
			numero_documento: f.numero_documento.trim(),
			cantidad: this.esRevalorizacion()
				? 0
				: this.esSalida()
					? -cantidad
					: cantidad,
			costo_unitario: this.esSalida()
				? null
				: Number(f.costo_unitario).toFixed(4),
			moneda: "PEN",
			tipo_cambio: "1.0000",
		};
	}
}
