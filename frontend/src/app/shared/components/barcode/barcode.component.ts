import {
	afterRenderEffect,
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	input,
	signal,
	viewChild,
} from "@angular/core";
import JsBarcode from "jsbarcode";

@Component({
	selector: "app-barcode",
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<svg #lienzo [class.hidden]="invalido()" role="img" [attr.aria-label]="'Código de barras ' + value()"></svg>
		@if (invalido()) {
			<p class="text-xs text-rose-600">«{{ value() }}» no se puede dibujar como código de barras.</p>
		}
	`,
})
export class BarcodeComponent {
	readonly value = input.required<string>();
	readonly width = input(1.5);
	readonly height = input(40);
	readonly displayValue = input(true);

	protected readonly invalido = signal(false);
	private readonly lienzo =
		viewChild.required<ElementRef<SVGSVGElement>>("lienzo");

	constructor() {
		afterRenderEffect(() => {
			const valor = this.value();
			if (!valor) return;
			JsBarcode(this.lienzo().nativeElement, valor, {
				width: this.width(),
				height: this.height(),
				displayValue: this.displayValue(),
				margin: 0,
				background: "transparent",
				valid: (ok) => this.invalido.set(!ok),
			});
		});
	}
}
