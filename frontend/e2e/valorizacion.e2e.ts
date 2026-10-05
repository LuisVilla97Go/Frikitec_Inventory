
import { expect, type Page, test } from "@playwright/test";

import { ALMACEN } from "./datos";

test.describe.configure({ mode: "serial" });

const SKU = `E2E-SC-${Date.now()}`;
const NOMBRE = "Funda sin costo de prueba";
const OTRO_ALMACEN = "Depósito E2E";

function tarjeta(page: Page, titulo: string) {
	return page
		.locator("p", { hasText: new RegExp(`^${titulo}$`) })
		.locator("xpath=following-sibling::p[1]");
}

async function abrirKardex(page: Page) {
	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(SKU);
	await page
		.getByRole("row", { name: new RegExp(SKU) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();
	await expect(
		page.getByRole("heading", { level: 1, name: NOMBRE }),
	).toBeVisible();
}

async function buscarEnCatalogo(page: Page) {
	await page.goto("/productos");
	await page.getByLabel("Buscar productos").fill(SKU);
}

test("un producto con stock a costo 0 queda «Sin costo» y el filtro lo encuentra", async ({
	page,
}) => {
	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(SKU);
	await page.getByLabel("Nombre *").fill(NOMBRE);
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("30.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("0");
	await page.getByLabel("Stock inicial").fill("2");
	await page.getByLabel(/^Almacén/).selectOption({ label: ALMACEN });
	await page.getByRole("button", { name: "Guardar" }).click();

	await page.getByLabel("Buscar productos").fill(SKU);
	const fila = page.getByRole("row", { name: new RegExp(SKU) });
	await expect(fila).toContainText("Sin costo");

	const filtro = page.getByRole("button", { name: "Solo sin costo" });
	await filtro.click();
	await expect(filtro).toHaveAttribute("aria-pressed", "true");
	await expect(fila).toContainText("Sin costo");
});

test("el Kardex tiene la pestaña Global y una por tienda, cada una con su valor", async ({
	page,
}) => {
	await abrirKardex(page);
	await expect(page.getByRole("tab", { name: "Global" })).toHaveAttribute(
		"aria-selected",
		"true",
	);
	await expect(tarjeta(page, "Stock Actual")).toHaveText("2");

	await page.getByRole("tab", { name: ALMACEN }).click();
	await expect(tarjeta(page, "Stock Actual")).toHaveText("2");
	await expect(tarjeta(page, "Valorización Total")).toHaveText("S/. 0.00");

	await page.getByRole("tab", { name: OTRO_ALMACEN }).click();
	await expect(page.getByText("Sin movimientos registrados")).toBeVisible();
});

test("un administrador revaloriza: la tienda vale stock × costo nuevo y el producto deja de estar «Sin costo»", async ({
	page,
}) => {
	await abrirKardex(page);
	await page.getByRole("button", { name: "Nuevo Movimiento" }).click();
	const modal = page.getByRole("dialog", { name: "Registrar Movimiento" });
	await modal.getByLabel("Almacén *").selectOption({ label: ALMACEN });
	await modal
		.getByLabel("Tipo de Movimiento *")
		.selectOption({ label: "Revalorización (corrige el costo)" });
	await expect(modal.getByLabel("Cantidad (UND) *")).toBeDisabled();
	await modal.getByLabel("Nº Comprobante *").fill("REV-0001");
	await modal.getByLabel("Nuevo costo unitario (S/.) *").fill("20");
	await modal.getByRole("button", { name: "Guardar Movimiento" }).click();
	await expect(modal).toBeHidden();

	await page.getByRole("tab", { name: ALMACEN }).click();
	await expect(tarjeta(page, "Stock Actual")).toHaveText("2"); // no movió unidades
	await expect(tarjeta(page, "Valorización Total")).toHaveText("S/. 40.00");
	await expect(tarjeta(page, "Costo Promedio")).toHaveText("S/. 20.00");
	const linea = page.getByRole("row").filter({ hasText: "REV-0001" });
	await expect(linea).toContainText("REVALORIZACION");
	await expect(linea).toContainText("40.00");

	await buscarEnCatalogo(page);
	const fila = page.getByRole("row", { name: new RegExp(SKU) });
	await expect(fila).toContainText("Costo unitario: S/ 20.00");
	await expect(fila).not.toContainText("Sin costo");
	await page.getByRole("button", { name: "Solo sin costo" }).click();
	await expect(page.getByText("No se encontraron productos.")).toBeVisible();
});
