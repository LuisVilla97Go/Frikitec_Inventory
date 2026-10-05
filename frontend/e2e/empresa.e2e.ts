
import { expect, test } from "@playwright/test";

test("el administrador guarda la ficha de la empresa y se conserva al recargar", async ({
	page,
}) => {
	await page.goto("/maestros/empresa");
	await expect(
		page.getByRole("heading", { level: 1, name: "Datos de la empresa" }),
	).toBeVisible();

	const ruc = page.getByLabel("RUC *");
	await ruc.fill("20610949519");
	await page.getByLabel("Razón social *").fill("FRIKITEC PERU E.I.R.L.");
	await page.getByRole("button", { name: "Guardar datos" }).click();
	await expect(page.getByText("el último debe cuadrar")).toBeVisible();

	await ruc.fill("20610949518");
	await page.getByLabel("Ubigeo").fill("150101");
	await page.getByRole("button", { name: "Guardar datos" }).click();

	await expect(
		page.getByRole("status").filter({ hasText: "Datos guardados" }),
	).toContainText("Datos guardados");
	await expect(
		page.getByText("Todavía no hay datos de la empresa"),
	).toBeHidden();

	await page.reload();
	await expect(page.getByLabel("RUC *")).toHaveValue("20610949518");
	await expect(page.getByLabel("Razón social *")).toHaveValue(
		"FRIKITEC PERU E.I.R.L.",
	);
	await expect(page.getByLabel("Ubigeo")).toHaveValue("150101");
});
