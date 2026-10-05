import { HttpTestingController } from "@angular/common/http/testing";
import { TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { OrdenesApi } from "./ordenes.api";

describe("OrdenesApi", () => {
	let api: OrdenesApi;
	let http: HttpTestingController;
	const ordenId = "orden/1";
	const reciboId = "recibo/2";
	const orden = {
		proveedor_id: "proveedor",
		lineas: [
			{
				producto_id: "producto",
				almacen_previsto_id: "almacen",
				cantidad_solicitada: 3,
				costo_unitario: "12.50",
			},
		],
	};
	const recepcion = {
		fecha_recepcion: "2026-09-24",
		lineas: [
			{
				orden_linea_id: "linea",
				almacen_id: "almacen",
				cantidad_aceptada: 2,
				cantidad_rechazada: 0,
			},
		],
	};

	beforeEach(() => {
		TestBed.configureTestingModule({ providers: proveedoresDeTest() });
		api = TestBed.inject(OrdenesApi);
		http = TestBed.inject(HttpTestingController);
	});
	afterEach(() => http.verify());

	async function comprobar(
		accion: () => Promise<unknown>,
		metodo: string,
		ruta: string,
		cuerpo: unknown,
	) {
		const resultado = accion().catch(() => undefined);
		const peticion = http.expectOne(ruta);
		expect(peticion.request.method).toBe(metodo);
		expect(peticion.request.body).toEqual(cuerpo);
		peticion.flush(
			{ message: "rechazado" },
			{ status: 409, statusText: "Conflicto" },
		);
		await resultado;
	}

	it("envía cada transición y sus datos a la ruta de la orden", async () => {
		const id = "orden%2F1";
		const recibo = "recibo%2F2";
		await comprobar(() => api.crear(orden), "POST", "/api/ordenes", orden);
		await comprobar(
			() => api.guardar(ordenId, orden),
			"PUT",
			`/api/ordenes/${id}`,
			orden,
		);
		await comprobar(
			() => api.enviar(ordenId),
			"POST",
			`/api/ordenes/${id}/enviar`,
			{},
		);
		await comprobar(
			() => api.decidir(ordenId, "RECHAZAR", "No procede"),
			"POST",
			`/api/ordenes/${id}/aprobacion`,
			{ decision: "RECHAZAR", comentario: "No procede" },
		);
		await comprobar(
			() => api.decidir(ordenId, "APROBAR", ""),
			"POST",
			`/api/ordenes/${id}/aprobacion`,
			{ decision: "APROBAR", comentario: null },
		);
		await comprobar(
			() => api.emitir(ordenId),
			"POST",
			`/api/ordenes/${id}/emitir`,
			{},
		);
		await comprobar(
			() => api.crearRecepcion(ordenId, recepcion),
			"POST",
			`/api/ordenes/${id}/recepciones`,
			recepcion,
		);
		await comprobar(
			() => api.editarRecepcion(ordenId, reciboId, recepcion),
			"PUT",
			`/api/ordenes/${id}/recepciones/${recibo}`,
			recepcion,
		);
		await comprobar(
			() => api.contabilizar(ordenId, reciboId),
			"POST",
			`/api/ordenes/${id}/recepciones/${recibo}/contabilizar`,
			{},
		);
		await comprobar(
			() => api.adjuntarFactura(ordenId, reciboId, "F-1", ""),
			"POST",
			`/api/ordenes/${id}/recepciones/${recibo}/factura`,
			{ numero_factura: "F-1", fecha_factura: null },
		);
		await comprobar(
			() =>
				api.cerrarSaldo(ordenId, "Faltante", [
					{ orden_linea_id: "l1", cantidad_cerrada: 1 },
				]),
			"POST",
			`/api/ordenes/${id}/cerrar-saldo`,
			{
				motivo: "Faltante",
				lineas: [{ orden_linea_id: "l1", cantidad_cerrada: 1 }],
			},
		);
		await comprobar(
			() => api.cancelar(ordenId, "Anulada"),
			"POST",
			`/api/ordenes/${id}/cancelar`,
			{ motivo: "Anulada" },
		);
	});
});
