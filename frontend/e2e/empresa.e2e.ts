import { expect, test } from "@playwright/test";

test("el administrador guarda la ficha de la empresa y se conserva al recargar", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1366, height: 768 });
	await page.goto("/maestros/empresa");
	await expect(
		page.getByRole("heading", { level: 1, name: "Datos de la empresa" }),
	).toBeVisible();

	const ruc = page.getByLabel("RUC *");
	await ruc.fill("20610949519");
	await page.getByLabel("Razón social *").fill("FRIKITEC PERU E.I.R.L.");
	await page.getByRole("button", { name: "Guardar datos" }).click();
	// El último dígito del RUC no cuadra: no se envía
	await expect(page.getByText("el último debe cuadrar")).toBeVisible();

	await ruc.fill("20610949518");
	await page.getByLabel("Ubigeo").fill("150101");
	await page.getByRole("button", { name: "Guardar datos" }).click();
	await expect(
		page.getByRole("dialog", { name: "Empresa guardada con éxito" }),
	).toBeVisible();
	await page.keyboard.press("Tab");
	await expect(
		page.getByRole("button", { name: "Aceptar", exact: true }),
	).toBeFocused();
	await page.keyboard.press("Shift+Tab");
	await expect(
		page.getByRole("button", { name: "Aceptar", exact: true }),
	).toBeFocused();
	await page.screenshot({
		path: "test-results/cierre-visual/empresa-guardada-1366.png",
	});
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(
		page.getByRole("dialog", { name: "Empresa guardada con éxito" }),
	).toBeVisible();
	await page.screenshot({
		path: "test-results/cierre-visual/empresa-guardada-390.png",
	});
	await page.getByRole("button", { name: "Aceptar", exact: true }).click();
	await expect(
		page.getByRole("button", { name: "Guardar datos" }),
	).toBeFocused();
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
