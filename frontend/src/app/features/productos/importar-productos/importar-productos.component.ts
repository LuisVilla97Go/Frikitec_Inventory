import { HttpErrorResponse } from "@angular/common/http";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	output,
	signal,
} from "@angular/core";
import {
	LucideCircleCheck as CircleCheck,
	LucideDownload as Download,
	LucideFileSpreadsheet as FileSpreadsheet,
	LucideDynamicIcon,
	LucideTriangleAlert as TriangleAlert,
	LucideX as X,
} from "@lucide/angular";
import {
	injectMutation,
	QueryClient,
} from "@tanstack/angular-query-experimental";
import * as v from "valibot";
import { ApiClient, mensajeDeError } from "../../../core/http/api-client";
import { claves } from "../../../core/http/claves";
import {
	ConDatos,
	ResumenImportacion,
} from "../../../shared/schemas/api.schema";

export const MAX_BYTES = 1024 * 1024;

type Modo = "simular" | "aplicar";

@Component({
	selector: "app-importar-productos",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LucideDynamicIcon],
	templateUrl: "./importar-productos.component.html",
	host: { "(document:keydown.escape)": "salir()" },
})
export class ImportarProductosComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);

	readonly cerrar = output<void>();

	protected readonly icons = {
		CircleCheck,
		Download,
		FileSpreadsheet,
		TriangleAlert,
		X,
	};

	protected readonly archivo = signal<File | null>(null);
	protected readonly revision = signal<ResumenImportacion | null>(null);
	protected readonly aplicado = signal<ResumenImportacion | null>(null);
	protected readonly error = signal("");

	protected readonly ocupado = computed(
		() =>
			this.revisarMutation.isPending() ||
			this.aplicarMutation.isPending() ||
			this.plantillaMutation.isPending(),
	);
	protected readonly incidencias = computed(() => {
		const r = this.revision();
		if (!r) return [];
		return [
			{
				titulo: "Errores",
				filas: r.errores,
				total: r.total_errores,
				color: "text-rose-700",
			},
			{
				titulo: "Avisos",
				filas: r.avisos,
				total: r.total_avisos,
				color: "text-amber-700",
			},
		];
	});
	protected readonly puedeAplicar = computed(() => {
		const revision = this.revision();
		return (
			revision !== null &&
			revision.total_errores === 0 &&
			revision.nuevos + revision.actualizados > 0 &&
			!this.ocupado()
		);
	});

	protected readonly revisarMutation = injectMutation(() => ({
		mutationFn: (archivo: File) => this.subir(archivo, "simular"),
		onSuccess: (resumen: ResumenImportacion) => this.revision.set(resumen),
		onError: (error: unknown) => this.mostrarError(error),
	}));

	protected readonly aplicarMutation = injectMutation(() => ({
		mutationFn: (archivo: File) => this.subir(archivo, "aplicar"),
		onSuccess: (resumen: ResumenImportacion) => {
			this.aplicado.set(resumen);
			for (const clave of [claves.productos.todo, claves.kardex.todo]) {
				void this.queryClient.invalidateQueries({ queryKey: clave });
			}
		},
		onError: (error: unknown) => this.mostrarError(error),
	}));

	protected readonly plantillaMutation = injectMutation(() => ({
		mutationFn: () => this.api.descargar("/api/productos/plantilla"),
		onSuccess: (plantilla: Blob) =>
			guardarComo(plantilla, "plantilla-productos.xlsx"),
		onError: (error: unknown) =>
			this.error.set(
				mensajeDeError(error, "No se pudo descargar la plantilla."),
			),
	}));

	protected elegir(evento: Event) {
		const entrada = evento.target as HTMLInputElement;
		const archivo = entrada.files?.[0] ?? null;
		this.revision.set(null);
		this.aplicado.set(null);
		this.error.set("");
		this.archivo.set(null);
		if (!archivo) return;
		if (!archivo.name.toLowerCase().endsWith(".xlsx")) {
			this.error.set("Elige un archivo de Excel .xlsx.");
		} else if (archivo.size > MAX_BYTES) {
			this.error.set("El archivo supera el límite de 1 MB.");
		} else {
			this.archivo.set(archivo);
		}
	}

	protected revisar() {
		const archivo = this.archivo();
		if (!archivo || this.ocupado()) return;
		this.error.set("");
		this.revision.set(null);
		this.revisarMutation.mutate(archivo);
	}

	protected aplicar() {
		const archivo = this.archivo();
		if (!archivo || !this.puedeAplicar()) return;
		this.error.set("");
		this.aplicarMutation.mutate(archivo);
	}

	protected salir() {
		if (!this.aplicarMutation.isPending()) this.cerrar.emit();
	}

	private async subir(archivo: File, modo: Modo): Promise<ResumenImportacion> {
		const cuerpo = new FormData();
		cuerpo.append("archivo", archivo);
		const { data } = await this.api.post(
			`/api/productos/importar?modo=${modo}`,
			cuerpo,
			ConDatos(ResumenImportacion),
		);
		return data;
	}

	private mostrarError(error: unknown) {
		const resumen = resumenDelError(error);
		if (resumen) this.revision.set(resumen);
		this.error.set(mensajeDeError(error, "No se pudo procesar el archivo."));
	}
}

function resumenDelError(error: unknown): ResumenImportacion | null {
	if (!(error instanceof HttpErrorResponse)) return null;
	const cuerpo = v.safeParse(ConDatos(ResumenImportacion), error.error);
	return cuerpo.success ? cuerpo.output.data : null;
}

function guardarComo(archivo: Blob, nombre: string) {
	const url = URL.createObjectURL(archivo);
	const enlace = document.createElement("a");
	enlace.href = url;
	enlace.download = nombre;
	enlace.click();
	setTimeout(() => URL.revokeObjectURL(url));
}
