import { expect, test } from "@playwright/test";

import { ADMIN } from "./datos";

test.use({ storageState: { cookies: [], origins: [] } });

test("sin sesión, una pantalla interna lleva al login", async ({ page }) => {
	await page.goto("/productos");
	await expect(
		page.getByRole("button", { name: "Ingresar al Sistema" }),
	).toBeVisible();
	await expect(page).toHaveURL(/\/login$/);
	await expect(
		page.getByRole("heading", { name: "Catálogo de Productos" }),
	).toHaveCount(0);
});

test("una contraseña incorrecta muestra el error del servidor y no entra", async ({
	page,
}) => {
	await page.goto("/login");
	await page.getByLabel("Usuario o Correo").fill(ADMIN.email);
	await page.getByLabel("Contraseña", { exact: true }).fill("no-es-la-clave");
	await page.getByRole("button", { name: "Ingresar al Sistema" }).click();
	await expect(
		page.getByText("Usuario o contraseña incorrectos"),
	).toBeVisible();
	await expect(page).toHaveURL(/\/login$/);
});
