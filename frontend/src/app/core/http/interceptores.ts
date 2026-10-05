import {
	HttpErrorResponse,
	type HttpInterceptorFn,
} from "@angular/common/http";
import { inject } from "@angular/core";
import { catchError, from, switchMap, throwError } from "rxjs";

import { AuthService } from "../auth/auth.service";
import { leerCookie } from "./cookies";

/** Rutas de sesión que no se reintentan: su 401 es la respuesta real. */
const SIN_REINTENTO = [
	"/api/auth/login",
	"/api/auth/refresh",
	"/api/auth/logout",
];

export const sesionInterceptor: HttpInterceptorFn = (req, next) => {
	const auth = inject(AuthService);
	return next(req).pipe(
		catchError((error: unknown) => {
			const esCaducidad =
				error instanceof HttpErrorResponse &&
				error.status === 401 &&
				req.url.startsWith("/api/") &&
				!SIN_REINTENTO.includes(req.url);
			if (!esCaducidad) return throwError(() => error);

			return from(auth.refrescar()).pipe(
				switchMap((renovado) => {
					if (!renovado) {
						void auth.sesionExpirada();
						return throwError(() => error);
					}
					const csrf = leerCookie("csrf_access_token");
					return next(
						csrf ? req.clone({ setHeaders: { "X-CSRF-TOKEN": csrf } }) : req,
					);
				}),
			);
		}),
	);
};
