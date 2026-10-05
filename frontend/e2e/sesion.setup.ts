import { expect, test as setup } from "@playwright/test";

import { ADMIN, SESION_ADMIN } from "./datos";

setup("inicia sesión como administrador", async ({ page }) => {
	setup.setTimeout(400_000);
	await page.goto("/login");
	await page.getByLabel("Usuario o Correo").fill(ADMIN.email);
	await page.getByLabel("Contraseña", { exact: true }).fill(ADMIN.clave);
	await page.getByRole("button", { name: "Ingresar al Sistema" }).click();
	await expect(page).toHaveURL(/\/dashboard$/);
	await page.context().storageState({ path: SESION_ADMIN });
});
