import { provideHttpClient, withXhr } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import type { EnvironmentProviders, Provider } from "@angular/core";
import { provideRouter } from "@angular/router";
import {
	provideAngularQuery,
	QueryClient,
} from "@tanstack/angular-query-experimental";
export function proveedoresDeTest(): (Provider | EnvironmentProviders)[] {
	return [
		provideHttpClient(withXhr()),
		provideHttpClientTesting(),
		provideRouter([]),
		provideAngularQuery(
			new QueryClient({
				defaultOptions: { queries: { retry: false, gcTime: Infinity } },
			}),
		),
	];
}
