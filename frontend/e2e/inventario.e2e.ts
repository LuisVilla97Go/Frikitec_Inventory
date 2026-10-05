import { expect, type Page, test } from "@playwright/test";

import { ALMACEN } from "./datos";

test.describe.configure({ mode: "serial" });

const SKU = `E2E-${Date.now()}`;
const NOMBRE = "Cargador USB-C 20W de prueba";

async function stockActual(page: Page) {
	return page
		.locator("p", { hasText: /^Stock Actual$/ })
		.locator("xpath=following-sibling::p[1]");
}

async function registrarVenta(
	page: Page,
	cantidad: number,
	comprobante: string,
) {
	await page.getByRole("button", { name: "Nuevo Movimiento" }).click();
	const modal = page.getByRole("dialog", { name: "Registrar Movimiento" });
	await modal.getByLabel("Almacén *").selectOption({ label: ALMACEN });
	await modal
		.getByLabel("Tipo de Movimiento *")
		.selectOption({ label: "Venta" });
	await modal
		.getByLabel("Comprobante *", { exact: true })
		.selectOption({ label: "Boleta" });
	await modal.getByLabel("Nº Comprobante *").fill(comprobante);
	await modal.getByLabel("Cantidad (UND) *").fill(String(cantidad));
	await modal.getByRole("button", { name: "Guardar Movimiento" }).click();
	return modal;
}

test("alta de un producto con stock inicial", async ({ page }) => {
	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(SKU);
	await page.getByLabel("Nombre *").fill(NOMBRE);
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("25.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("12.50");
	await page.getByLabel("Stock inicial").fill("10");
	await page.getByLabel(/^Almacén/).selectOption({ label: ALMACEN });
	await page.getByRole("button", { name: "Guardar" }).click();

	await page.getByLabel("Buscar productos").fill(SKU);
	const fila = page.getByRole("row", { name: new RegExp(SKU) });
	await expect(fila).toContainText(NOMBRE);
	await expect(fila).toContainText("Costo unitario: S/ 12.50");
});

test("el Kardex muestra la carga inicial y una venta descuenta el stock", async ({
	page,
}) => {
	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(SKU);
	await page
		.getByRole("row", { name: new RegExp(SKU) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();
	await expect(
		page.getByRole("heading", { level: 1, name: NOMBRE }),
	).toBeVisible();
	await expect(await stockActual(page)).toHaveText("10");

	const modal = await registrarVenta(page, 3, "B001-000001");
	await expect(modal).toBeHidden();
	await expect(await stockActual(page)).toHaveText("7");
});

test("una venta mayor que el stock se rechaza y el stock no cambia", async ({
	page,
}) => {
	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(SKU);
	await page
		.getByRole("row", { name: new RegExp(SKU) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();

	const modal = await registrarVenta(page, 50, "B001-000002");
	await expect(
		modal.getByText("Stock insuficiente en el almacén seleccionado"),
	).toBeVisible();
	await modal.getByRole("button", { name: "Cancelar" }).click();
	await expect(await stockActual(page)).toHaveText("7");
});

test("el libro diario lista la carga inicial y la venta del producto", async ({
	page,
}) => {
	await page.goto("/movimientos");
	await page.getByLabel("Buscar").fill(SKU);
	const filas = page.getByRole("row").filter({ hasText: SKU });
	await expect(filas).toHaveCount(2);
	await expect(filas.filter({ hasText: "B001-000001" })).toHaveCount(1);
});
