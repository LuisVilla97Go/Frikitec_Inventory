import {
	provideHttpClient,
	withFetch,
	withInterceptors,
	withXsrfConfiguration,
} from "@angular/common/http";
import {
	type ApplicationConfig,
	provideZoneChangeDetection,
} from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import {
	provideAngularQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";

import { routes } from "./app.routes";
import { sesionInterceptor } from "./core/http/interceptores";

export const appConfig: ApplicationConfig = {
	providers: [
		provideZoneChangeDetection({ eventCoalescing: true }),
		provideRouter(routes, withComponentInputBinding()),
		provideHttpClient(
			withFetch(),
			withXsrfConfiguration({
				cookieName: "csrf_access_token",
				headerName: "X-CSRF-TOKEN",
			}),
			withInterceptors([sesionInterceptor]),
		),
		provideAngularQuery(
			new QueryClient({
				defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
			}),
		),
	],
};
