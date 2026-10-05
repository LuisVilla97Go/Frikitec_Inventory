import {
	ChangeDetectionStrategy,
	Component,
	DestroyRef,
	type ElementRef,
	effect,
	inject,
	input,
	output,
	signal,
	viewChild,
} from "@angular/core";
import { injectQuery } from "@tanstack/angular-query-experimental";

import { ApiClient } from "../../core/http/api-client";
import { paginaProductos } from "../../core/http/queries/consultas";
import type { Producto } from "../../shared/schemas/api.schema";

@Component({
	selector: "app-buscador-producto-orden",
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./buscador-producto-orden.component.html",
})
export class BuscadorProductoOrdenComponent {
	readonly productoId = input.required<string>();
	readonly nombreInicial = input("");
	readonly inputId = input.required<string>();
	readonly productoCambia = output<string>();
	private readonly api = inject(ApiClient);
	private readonly destroyRef = inject(DestroyRef);
	private demora: ReturnType<typeof setTimeout> | undefined;
	protected readonly texto = signal("");
	protected readonly busqueda = signal("");
	protected readonly abierto = signal(false);
	protected readonly activo = signal(0);
	protected readonly elegido = signal<Producto | null>(null);
	protected readonly productosQuery = injectQuery(() => ({
		...paginaProductos(this.api, 1, 20, this.busqueda()),
		enabled: this.busqueda().length > 0,
	}));

	private readonly lista = viewChild<ElementRef<HTMLElement>>("lista");

	constructor() {
		effect(() =>
			this.lista()?.nativeElement.scrollIntoView?.({ block: "nearest" }),
		);
		this.destroyRef.onDestroy(() => {
			if (this.demora) clearTimeout(this.demora);
		});
	}

	protected escribir(valor: string) {
		this.texto.set(valor);
		this.abierto.set(Boolean(valor.trim()));
		this.activo.set(0);
		if (this.demora) clearTimeout(this.demora);
		const termino = valor.trim();
		this.demora = setTimeout(() => this.busqueda.set(termino), 250);
	}

	protected elegir(producto: Producto) {
		this.elegido.set(producto);
		this.texto.set("");
		this.abierto.set(false);
		this.productoCambia.emit(producto.id);
	}

	protected quitar() {
		this.elegido.set(null);
		this.texto.set("");
		this.busqueda.set("");
		this.productoCambia.emit("");
	}

	protected tecla(evento: KeyboardEvent) {
		const opciones = this.productosQuery.data()?.data ?? [];
		if (evento.key === "ArrowDown" && opciones.length) {
			evento.preventDefault();
			this.activo.set((this.activo() + 1) % opciones.length);
		} else if (evento.key === "ArrowUp" && opciones.length) {
			evento.preventDefault();
			this.activo.set((this.activo() - 1 + opciones.length) % opciones.length);
		} else if (evento.key === "Enter" && this.abierto() && opciones.length) {
			evento.preventDefault();
			this.elegir(opciones[this.activo()]);
		} else if (evento.key === "Escape") {
			evento.stopPropagation();
			this.abierto.set(false);
		}
	}

	protected cerrar() {
		this.abierto.set(false);
	}
}
