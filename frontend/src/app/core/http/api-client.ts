import {
	HttpClient,
	HttpErrorResponse,
	HttpParams,
} from "@angular/common/http";
import { Injectable, inject } from "@angular/core";
import { firstValueFrom } from "rxjs";
import * as v from "valibot";

type Parametros = Record<string, string | number | null | undefined>;

@Injectable({ providedIn: "root" })
export class ApiClient {
	private readonly http = inject(HttpClient);

	async get<T>(
		url: string,
		esquema: v.GenericSchema<unknown, T>,
		parametros?: Parametros,
	): Promise<T> {
		const respuesta = await firstValueFrom(
			this.http.get<unknown>(url, { params: aHttpParams(parametros) }),
		);
		return v.parse(esquema, respuesta);
	}

	async post<T>(
		url: string,
		cuerpo: unknown,
		esquema: v.GenericSchema<unknown, T>,
	): Promise<T> {
		return v.parse(
			esquema,
			await firstValueFrom(this.http.post<unknown>(url, cuerpo)),
		);
	}

	async put<T>(
		url: string,
		cuerpo: unknown,
		esquema: v.GenericSchema<unknown, T>,
	): Promise<T> {
		return v.parse(
			esquema,
			await firstValueFrom(this.http.put<unknown>(url, cuerpo)),
		);
	}

	async patch<T>(
		url: string,
		cuerpo: unknown,
		esquema: v.GenericSchema<unknown, T>,
	): Promise<T> {
		return v.parse(
			esquema,
			await firstValueFrom(this.http.patch<unknown>(url, cuerpo)),
		);
	}

	async delete(url: string): Promise<void> {
		await firstValueFrom(this.http.delete(url));
	}

	async descargar(url: string): Promise<Blob> {
		return firstValueFrom(this.http.get(url, { responseType: "blob" }));
	}
}

function aHttpParams(parametros?: Parametros): HttpParams {
	let params = new HttpParams();
	for (const [clave, valor] of Object.entries(parametros ?? {})) {
		if (valor !== null && valor !== undefined && valor !== "") {
			params = params.set(clave, String(valor));
		}
	}
	return params;
}

export function mensajeDeError(error: unknown, porDefecto: string): string {
	if (error instanceof HttpErrorResponse) {
		const cuerpo: unknown = error.error;
		if (
			typeof cuerpo === "object" &&
			cuerpo !== null &&
			"message" in cuerpo &&
			typeof cuerpo.message === "string"
		) {
			return cuerpo.message;
		}
		if (error.status === 0) return "No hay conexión con el servidor.";
	}
	if (error instanceof v.ValiError) {
		return "El servidor respondió con un formato inesperado.";
	}
	return porDefecto;
}
