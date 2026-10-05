import { inject } from "@angular/core";
import { type CanActivateFn, Router } from "@angular/router";

import { AuthService } from "./auth.service";

export const authGuard: CanActivateFn = async () => {
	const auth = inject(AuthService);
	const router = inject(Router);
	return (await auth.comprobarSesion())
		? true
		: router.createUrlTree(["/login"]);
};
