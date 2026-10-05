import {
	ChangeDetectionStrategy,
	Component,
	computed,
	forwardRef,
	input,
	signal,
} from "@angular/core";
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from "@angular/forms";
import {
	LucideDynamicIcon,
	LucideSearch as Search,
	LucideX as X,
} from "@lucide/angular";

import type { Proveedor } from "../../schemas/api.schema";

const MAX_SUGERENCIAS = 8;

function normalizar(texto: string): string {
	return texto
		.toLocaleLowerCase("es")
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.trim();
}

export function buscarProveedores(
	proveedores: readonly Proveedor[],
	texto: string,
): Proveedor[] {
	const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
	if (palabras.length === 0) return [];
	const coinciden = proveedores.filter((p) => {
		const campos = normalizar(
			`${p.numero_documento} ${p.razon_social} ${p.nombre_comercial ?? ""}`,
		);
		return palabras.every((palabra) => campos.includes(palabra));
	});
	const exacto = texto.trim();
	return coinciden
		.sort(
			(a, b) =>
				Number(b.numero_documento === exacto) -
				Number(a.numero_documento === exacto),
		)
		.slice(0, MAX_SUGERENCIAS);
}

export function proveedorPorDocumento(
	proveedores: readonly Proveedor[],
	texto: string,
): Proveedor | null {
	const documento = texto.trim();
	if (!/^(\d{8}|\d{11})$/.test(documento)) return null;
	return proveedores.find((p) => p.numero_documento === documento) ?? null;
}

let siguienteId = 0;

@Component({
	selector: "app-buscador-proveedor",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LucideDynamicIcon],
	templateUrl: "./buscador-proveedor.component.html",
	providers: [
		{
			provide: NG_VALUE_ACCESSOR,
			useExisting: forwardRef(() => BuscadorProveedorComponent),
			multi: true,
		},
	],
})
export class BuscadorProveedorComponent implements ControlValueAccessor {
	readonly proveedores = input.required<readonly Proveedor[]>();
	readonly inputId = input(`buscador-proveedor-${siguienteId++}`);
	readonly invalido = input(false);

	protected readonly icons = { Search, X };
	protected readonly texto = signal("");
	protected readonly abierto = signal(false);
	protected readonly activo = signal(-1);
	protected readonly deshabilitado = signal(false);
	private readonly idElegido = signal<string | null>(null);

	protected readonly elegido = computed(
		() => this.proveedores().find((p) => p.id === this.idElegido()) ?? null,
	);
	protected readonly sugerencias = computed(() =>
		buscarProveedores(this.proveedores(), this.texto()),
	);
	protected readonly listaId = computed(() => `${this.inputId()}-lista`);

	private alCambiar: (id: string) => void = () => { };
	protected alTocar: () => void = () => { };

	writeValue(id: string | null): void {
		this.idElegido.set(id || null);
		this.texto.set("");
	}
	registerOnChange(fn: (id: string) => void): void {
		this.alCambiar = fn;
	}
	registerOnTouched(fn: () => void): void {
		this.alTocar = fn;
	}
	setDisabledState(deshabilitado: boolean): void {
		this.deshabilitado.set(deshabilitado);
	}

	protected escribir(valor: string) {
		this.texto.set(valor);
		this.activo.set(-1);
		const exacto = proveedorPorDocumento(this.proveedores(), valor);
		if (exacto) {
			this.elegir(exacto);
			return;
		}
		this.abierto.set(valor.trim() !== "");
	}

	protected elegir(proveedor: Proveedor) {
		this.idElegido.set(proveedor.id);
		this.texto.set("");
		this.abierto.set(false);
		this.alCambiar(proveedor.id);
		this.alTocar();
	}

	protected quitar() {
		this.idElegido.set(null);
		this.alCambiar("");
	}

	protected tecla(evento: KeyboardEvent) {
		const total = this.sugerencias().length;
		if (evento.key === "ArrowDown" && total > 0) {
			evento.preventDefault();
			this.abierto.set(true);
			this.activo.set((this.activo() + 1) % total);
		} else if (evento.key === "ArrowUp" && total > 0) {
			evento.preventDefault();
			this.activo.set((this.activo() - 1 + total) % total);
		} else if (evento.key === "Enter" && this.abierto()) {
			evento.preventDefault();
			const candidato = this.sugerencias()[Math.max(this.activo(), 0)] ?? null;
			if (candidato) this.elegir(candidato);
		} else if (evento.key === "Escape" && this.abierto()) {
			evento.stopPropagation();
			this.abierto.set(false);
		}
	}

	protected cerrar() {
		this.abierto.set(false);
		this.alTocar();
	}
}
