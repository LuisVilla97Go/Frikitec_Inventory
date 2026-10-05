import { Injectable, inject } from "@angular/core";

import { ApiClient } from "../../core/http/api-client";
import { ConDatos, TomaFisica } from "../../shared/schemas/api.schema";

const BASE = "/api/tomas-fisicas";
const url = (tomaId: string, resto = "") =>
	`${BASE}/${encodeURIComponent(tomaId)}${resto}`;

@Injectable({ providedIn: "root" })
export class TomaFisicaApi {
	private readonly api = inject(ApiClient);

	async crear(almacenId: string, observacion: string | null) {
		return (
			await this.api.post(
				BASE,
				{ almacen_id: almacenId, producto_ids: [], observacion },
				ConDatos(TomaFisica),
			)
		).data;
	}

	async agregar(tomaId: string, productoIds: string[]) {
		return (
			await this.api.post(
				url(tomaId, "/productos"),
				{ producto_ids: productoIds },
				ConDatos(TomaFisica),
			)
		).data;
	}

	quitar(tomaId: string, lineaId: string) {
		return this.api.delete(
			url(tomaId, `/lineas/${encodeURIComponent(lineaId)}`),
		);
	}

	async contar(
		tomaId: string,
		conteos: { linea_id: string; cantidad_contada: number | null }[],
	) {
		return (
			await this.api.put(
				url(tomaId, "/conteo"),
				{ conteos },
				ConDatos(TomaFisica),
			)
		).data;
	}

	async contabilizar(tomaId: string) {
		return (
			await this.api.post(
				url(tomaId, "/contabilizar"),
				{},
				ConDatos(TomaFisica),
			)
		).data;
	}

	async anular(tomaId: string, motivo: string) {
		return (
			await this.api.post(
				url(tomaId, "/anular"),
				{ motivo },
				ConDatos(TomaFisica),
			)
		).data;
	}
}
