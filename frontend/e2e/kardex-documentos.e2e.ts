import { expect, type Page, test } from "@playwright/test";

import { ALMACEN } from "./datos";

async function productoEnKardex(page: Page, sku: string, stockInicial = 0) {
	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(sku);
	await page.getByLabel("Nombre *").fill("Funda MagSafe de prueba");
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("40.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("20.00");
	if (stockInicial > 0) {
		await page.getByLabel("Stock inicial").fill(String(stockInicial));
		await page.getByLabel(/^Almacén/).selectOption({ label: ALMACEN });
	}
	await page.getByRole("button", { name: "Guardar" }).click();
	await page.getByLabel("Buscar productos").fill(sku);
	await expect(page.getByRole("row", { name: new RegExp(sku) })).toBeVisible();

	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(sku);
	await page
		.getByRole("row", { name: new RegExp(sku) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();
}

test("una compra con el proveedor elegido escribiendo su RUC", async ({
	page,
}) => {
	const marca = Date.now();
	const proveedor = `Distribuidora E2E ${marca}`;
	const ruc = `20${String(marca).slice(-9)}`;

	await page.goto("/maestros/proveedores");
	await page.getByRole("button", { name: "Nuevo proveedor" }).click();
	const formulario = page.getByRole("dialog", { name: "Nuevo proveedor" });
	await formulario.getByLabel("Número de documento *").fill(ruc);
	await formulario.getByLabel("Razón social *").fill(proveedor);
	await formulario.getByRole("button", { name: "Guardar" }).click();
	await expect(
		page.getByRole("row", { name: new RegExp(proveedor) }),
	).toBeVisible();

	await productoEnKardex(page, `E2E-DOC-${marca}`);

	await page.getByRole("button", { name: "Nuevo Movimiento" }).click();
	const modal = page.getByRole("dialog", { name: "Registrar Movimiento" });
	await modal.getByLabel("Almacén *").selectOption({ label: ALMACEN });
	await modal.getByLabel("Proveedor *").fill(ruc);
	await expect(modal.getByText(proveedor)).toBeVisible();
	await modal
		.getByLabel("Comprobante *", { exact: true })
		.selectOption({ label: "Factura" });
	await modal.getByLabel("Nº Comprobante *").fill("F001-900");
	await modal.getByLabel("Cantidad (UND) *").fill("4");
	await modal.getByLabel("Costo Unitario (S/.)").fill("20");
	await modal.getByRole("button", { name: "Guardar Movimiento" }).click();
	await expect(modal).toBeHidden();
	await expect(
		page.getByRole("row").filter({ hasText: "F001-900" }),
	).toBeVisible();
});

test("una venta con nota de venta", async ({ page }) => {
	await productoEnKardex(page, `E2E-NV-${Date.now()}`, 3);

	await page.getByRole("button", { name: "Nuevo Movimiento" }).click();
	const modal = page.getByRole("dialog", { name: "Registrar Movimiento" });
	await modal.getByLabel("Almacén *").selectOption({ label: ALMACEN });
	await modal
		.getByLabel("Tipo de Movimiento *")
		.selectOption({ label: "Venta" });
	await modal
		.getByLabel("Comprobante *", { exact: true })
		.selectOption({ label: "Nota de venta" });
	await modal.getByLabel("Nº Comprobante *").fill("NV01-000001");
	await modal.getByLabel("Cantidad (UND) *").fill("1");
	await modal.getByRole("button", { name: "Guardar Movimiento" }).click();
	await expect(modal).toBeHidden();

	const venta = page.getByRole("row").filter({ hasText: "NV01-000001" });
	await expect(venta).toContainText("NOTA VENTA");
});
