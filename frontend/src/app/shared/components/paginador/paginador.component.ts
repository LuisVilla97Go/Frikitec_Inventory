import {
	ChangeDetectionStrategy,
	Component,
	computed,
	Injectable,
	input,
	output,
	signal,
	type WritableSignal,
} from "@angular/core";
import {
	LucideChevronLeft as ChevronLeft,
	LucideChevronRight as ChevronRight,
	LucideDynamicIcon,
} from "@lucide/angular";

export const TAMANOS_DE_PAGINA = [10, 20, 50, 100] as const;
export const TAMANO_INICIAL = 10;

@Injectable({ providedIn: "root" })
export class TamanosDePagina {
	private readonly porTabla = new Map<string, WritableSignal<number>>();

	de(tabla: string): WritableSignal<number> {
		let tamano = this.porTabla.get(tabla);
		if (!tamano) {
			tamano = signal(TAMANO_INICIAL);
			this.porTabla.set(tabla, tamano);
		}
		return tamano;
	}
}

@Component({
	selector: "app-paginador",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LucideDynamicIcon],
	templateUrl: "./paginador.component.html",
})
export class PaginadorComponent {
	readonly pagina = input.required<number>();
	readonly porPagina = input.required<number>();
	readonly total = input.required<number>();
	readonly etiqueta = input("registros");

	readonly paginaCambia = output<number>();
	readonly porPaginaCambia = output<number>();

	protected readonly tamanos = TAMANOS_DE_PAGINA;
	protected readonly ChevronLeft = ChevronLeft;
	protected readonly ChevronRight = ChevronRight;

	protected readonly totalPaginas = computed(() =>
		Math.max(1, Math.ceil(this.total() / this.porPagina())),
	);

	protected ir(pagina: number) {
		this.paginaCambia.emit(Math.min(Math.max(1, pagina), this.totalPaginas()));
	}

	protected elegirTamano(valor: string) {
		this.porPaginaCambia.emit(Number(valor));
	}
}

export function paginasDe(total: number, porPagina: number): number {
	return Math.max(1, Math.ceil(total / porPagina));
}
