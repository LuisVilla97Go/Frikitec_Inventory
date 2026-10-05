import { Injectable, inject } from "@angular/core";

import { ApiClient } from "../../core/http/api-client";
import {
	type OrdenCompraDetalle,
	RespuestaOrdenCompra,
} from "../../shared/schemas/api.schema";

export interface LineaOrdenCompraEntrada {
	producto_id: string;
	almacen_previsto_id: string;
	cantidad_solicitada: number;
	costo_unitario: string;
}

export interface OrdenCompraEntrada {
	proveedor_id: string;
	lineas: LineaOrdenCompraEntrada[];
}

export interface LineaRecepcionEntrada {
	orden_linea_id: string;
	almacen_id: string;
	cantidad_aceptada: number;
	cantidad_rechazada: number;
	motivo_rechazo?: string | null;
}

export interface RecepcionEntrada {
	fecha_recepcion: string;
	numero_guia?: string | null;
	fecha_guia?: string | null;
	numero_factura?: string | null;
	fecha_factura?: string | null;
	lineas: LineaRecepcionEntrada[];
}

@Injectable({ providedIn: "root" })
export class OrdenesApi {
	private readonly api = inject(ApiClient);

	crear(datos: OrdenCompraEntrada) {
		return this.api.post("/api/ordenes", datos, RespuestaOrdenCompra);
	}

	guardar(ordenId: string, datos: OrdenCompraEntrada) {
		return this.api.put(
			`/api/ordenes/${encodeURIComponent(ordenId)}`,
			datos,
			RespuestaOrdenCompra,
		);
	}

	enviar(ordenId: string) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/enviar`,
			{},
			RespuestaOrdenCompra,
		);
	}

	decidir(
		ordenId: string,
		decision: "APROBAR" | "RECHAZAR",
		comentario: string,
	) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/aprobacion`,
			{ decision, comentario: comentario || null },
			RespuestaOrdenCompra,
		);
	}

	emitir(ordenId: string) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/emitir`,
			{},
			RespuestaOrdenCompra,
		);
	}

	crearRecepcion(ordenId: string, datos: RecepcionEntrada) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/recepciones`,
			datos,
			RespuestaOrdenCompra,
		);
	}

	editarRecepcion(
		ordenId: string,
		recepcionId: string,
		datos: RecepcionEntrada,
	) {
		return this.api.put(
			`/api/ordenes/${encodeURIComponent(ordenId)}/recepciones/${encodeURIComponent(recepcionId)}`,
			datos,
			RespuestaOrdenCompra,
		);
	}

	contabilizar(ordenId: string, recepcionId: string) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/recepciones/${encodeURIComponent(recepcionId)}/contabilizar`,
			{},
			RespuestaOrdenCompra,
		);
	}

	adjuntarFactura(
		ordenId: string,
		recepcionId: string,
		numero: string,
		fecha: string,
	) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/recepciones/${encodeURIComponent(recepcionId)}/factura`,
			{ numero_factura: numero, fecha_factura: fecha || null },
			RespuestaOrdenCompra,
		);
	}

	cerrarSaldo(
		ordenId: string,
		motivo: string,
		lineas: { orden_linea_id: string; cantidad_cerrada: number }[],
	) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/cerrar-saldo`,
			{ motivo, lineas },
			RespuestaOrdenCompra,
		);
	}

	cancelar(ordenId: string, motivo: string) {
		return this.api.post(
			`/api/ordenes/${encodeURIComponent(ordenId)}/cancelar`,
			{ motivo },
			RespuestaOrdenCompra,
		);
	}
}

export type OrdenDetalle = OrdenCompraDetalle;
