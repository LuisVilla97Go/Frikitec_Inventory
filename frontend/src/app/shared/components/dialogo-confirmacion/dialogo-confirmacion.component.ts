import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
} from "@angular/core";

import {
	LucideAlertTriangle as AlertTriangle,
	LucideDynamicIcon,
} from "@lucide/angular";

@Component({
	selector: "app-dialogo-confirmacion",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LucideDynamicIcon],
	templateUrl: "./dialogo-confirmacion.component.html",
	host: { "(document:keydown.escape)": "cancelar.emit()" },
})
export class DialogoConfirmacionComponent {
	readonly titulo = input.required<string>();
	readonly mensaje = input.required<string>();
	readonly textoConfirmar = input("Confirmar");
	readonly ocupado = input(false);

	readonly confirmar = output<void>();
	readonly cancelar = output<void>();

	protected readonly AlertTriangle = AlertTriangle;
}
