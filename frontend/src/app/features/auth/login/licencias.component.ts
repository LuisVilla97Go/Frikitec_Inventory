import {
	ChangeDetectionStrategy,
	Component,
	type ElementRef,
	inject,
	signal,
	viewChild,
} from "@angular/core";

import { LicenciasService } from "./licencias.service";

@Component({
	selector: "app-licencias",
	changeDetection: ChangeDetectionStrategy.OnPush,
	templateUrl: "./licencias.component.html",
})
export class LicenciasComponent {
	private readonly servicio = inject(LicenciasService);
	protected readonly dialogo =
		viewChild.required<ElementRef<HTMLDialogElement>>("dialogo");
	protected readonly texto = signal("");
	protected readonly cargando = signal(false);
	protected readonly error = signal(false);

	protected abrir(): void {
		this.dialogo().nativeElement.showModal();
		if (!this.texto() && !this.cargando()) void this.cargar();
	}

	protected async cargar(): Promise<void> {
		this.cargando.set(true);
		this.error.set(false);
		try {
			this.texto.set(await this.servicio.leer());
		} catch {
			this.error.set(true);
		} finally {
			this.cargando.set(false);
		}
	}
}
