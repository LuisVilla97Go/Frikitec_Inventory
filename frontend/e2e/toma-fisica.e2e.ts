
import { expect, test } from "@playwright/test";

import { ALMACEN } from "./datos";

test("un sobrante contado entra al Kardex al costo unitario actual", async ({
	page,
}) => {
	const sku = `E2E-TF-${Date.now()}`;
	const nombre = "Protector de pantalla de prueba";

	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(sku);
	await page.getByLabel("Nombre *").fill(nombre);
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("30.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("20.00");
	await page.getByRole("button", { name: "Guardar" }).click();
	await page.getByLabel("Buscar productos").fill(sku);
	await expect(page.getByRole("row", { name: new RegExp(sku) })).toBeVisible();

	await page.goto("/toma-fisica");
	await page.getByRole("button", { name: "Nueva toma física" }).click();
	const dialogo = page.getByRole("dialog", { name: "Nueva toma física" });
	await dialogo
		.getByLabel("Almacén que vas a contar *")
		.selectOption({ label: ALMACEN });
	await dialogo
		.getByRole("button", { name: "Crear y agregar productos" })
		.click();
	await expect(page).toHaveURL(/\/toma-fisica\/[\w-]+$/);
	const numero = (
		await page.locator("header p.font-mono").textContent()
	)?.trim();
	expect(numero).toMatch(/^TF-\d{6}$/);

	await page.getByLabel("Buscar productos para contar").fill(sku);
	await page.getByRole("button", { name: `Agregar ${nombre}` }).click();
	await page.getByLabel(`Contado de ${nombre}`).fill("3");
	await page.getByRole("button", { name: "Guardar conteo" }).click();
	await expect(page.getByText("Conteo guardado.")).toBeVisible();

	const fila = page.getByRole("row").filter({ hasText: sku });
	await expect(fila).toContainText("+3");
	await expect(fila).toContainText("60.00");

	await page.getByRole("button", { name: "Aprobar y contabilizar" }).click();
	await page.getByRole("button", { name: "Contabilizar", exact: true }).click();
	await expect(
		page.getByText("los ajustes ya están en el Kardex"),
	).toBeVisible();
	await expect(page.getByText("Contabilizada", { exact: true })).toBeVisible();

	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(sku);
	await page
		.getByRole("row", { name: new RegExp(sku) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();
	await expect(
		page.getByRole("row").filter({ hasText: numero ?? "TF-" }),
	).toBeVisible();
});
