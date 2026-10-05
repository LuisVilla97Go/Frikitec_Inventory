import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
} from "@angular/core";

import { LucideDynamicIcon, LucideX as X } from "@lucide/angular";
import { BarcodeComponent } from "../barcode/barcode.component";

@Component({
	selector: "app-dialogo-codigo-barras",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [LucideDynamicIcon, BarcodeComponent],
	templateUrl: "./dialogo-codigo-barras.component.html",
	host: { "(document:keydown.escape)": "cerrar.emit()" },
})
export class DialogoCodigoBarrasComponent {
	readonly codigo = input.required<string>();
	readonly nombre = input<string | null>(null);
	readonly sku = input<string | null>(null);

	readonly cerrar = output<void>();

	protected readonly X = X;
}
