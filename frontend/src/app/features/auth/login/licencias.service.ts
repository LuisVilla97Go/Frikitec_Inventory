import { HttpClient } from "@angular/common/http";
import { Injectable, inject, isDevMode } from "@angular/core";
import { firstValueFrom } from "rxjs";

const AVISOS = [
	{ titulo: "Dependencias, fuentes e iconos", ruta: "/3rdpartylicenses.txt" },
	{ titulo: "Tailwind CSS", ruta: "/licencias/tailwindcss/LICENSE" },
	{ titulo: "Preflight", ruta: "/licencias/preflight/LICENSE" },
];

@Injectable({ providedIn: "root" })
export class LicenciasService {
	private readonly http = inject(HttpClient);

	async leer(): Promise<string> {
		const textos = await Promise.all(
			AVISOS.map(async ({ titulo, ruta }) => {
				const respuesta = await firstValueFrom(
					this.http.get(ruta, { responseType: "text", observe: "response" }),
				);
				const tipo = respuesta.headers.get("Content-Type");
				const originalLocal =
					isDevMode() && !tipo && respuesta.body?.startsWith("MIT License");
				if (
					(!tipo?.startsWith("text/plain") && !originalLocal) ||
					!respuesta.body?.trim()
				) {
					throw new Error("No se pudieron leer todos los avisos originales.");
				}
				return `${titulo}\n${"=".repeat(titulo.length)}\n\n${respuesta.body}`;
			}),
		);
		return textos.join("\n\n\n");
	}
}
