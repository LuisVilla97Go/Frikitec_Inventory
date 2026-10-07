import {
	ChangeDetectionStrategy,
	Component,
	computed,
	type ElementRef,
	effect,
	input,
	output,
	viewChild,
} from "@angular/core";

import {
	LucideAlertTriangle as AlertTriangle,
	LucideDynamicIcon,
	LucideTrash2 as Trash2,
	LucideUserCheck as UserCheck,
} from "@lucide/angular";

@Component({
	selector: "app-dialogo-confirmacion",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LucideDynamicIcon],
	templateUrl: "./dialogo-confirmacion.component.html",
})
export class DialogoConfirmacionComponent {
	readonly titulo = input.required<string>();
	readonly mensaje = input.required<string>();
	readonly textoConfirmar = input("Confirmar");
	readonly ocupado = input(false);
	readonly accion = input<"confirmar" | "eliminar" | "reactivar">("confirmar");

	readonly confirmar = output<void>();
	readonly cancelar = output<void>();

	private readonly dialogo =
		viewChild<ElementRef<HTMLDialogElement>>("dialogo");
	protected readonly peligro = computed(() => this.accion() !== "reactivar");
	protected readonly icono = computed(() =>
		this.accion() === "eliminar"
			? Trash2
			: this.accion() === "reactivar"
				? UserCheck
				: AlertTriangle,
	);

	constructor() {
		effect((alLimpiar) => {
			const dialogo = this.dialogo()?.nativeElement;
			if (dialogo && !dialogo.open) {
				if (typeof dialogo.showModal === "function") dialogo.showModal();
				else dialogo.setAttribute("open", "");
			}
			alLimpiar(() => {
				if (dialogo?.open) this.cerrarDialogo(dialogo);
			});
		});
	}

	protected pedirCancelacion(evento?: Event) {
		evento?.preventDefault();
		if (!this.ocupado()) {
			const dialogo = this.dialogo()?.nativeElement;
			if (dialogo) this.cerrarDialogo(dialogo);
			this.cancelar.emit();
		}
	}

	protected pedirConfirmacion() {
		if (!this.ocupado()) this.confirmar.emit();
	}

	protected recorrerFoco(evento: KeyboardEvent) {
		if (evento.key !== "Tab") return;
		const botones =
			this.dialogo()?.nativeElement.querySelectorAll<HTMLButtonElement>(
				"button:not(:disabled)",
			);
		if (!botones?.length) {
			evento.preventDefault();
			return;
		}
		const primero = botones[0];
		const ultimo = botones[botones.length - 1];
		if (evento.shiftKey && evento.target === primero) {
			evento.preventDefault();
			ultimo.focus();
		} else if (!evento.shiftKey && evento.target === ultimo) {
			evento.preventDefault();
			primero.focus();
		}
	}

	private cerrarDialogo(dialogo: HTMLDialogElement) {
		if (typeof dialogo.close === "function") dialogo.close();
		else dialogo.removeAttribute("open");
	}
}
