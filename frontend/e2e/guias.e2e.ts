import { expect, type Page, test } from "@playwright/test";

import { ALMACEN, DEPOSITO } from "./datos";

test.describe.configure({ mode: "serial" });

const SKU = `GUIA-${Date.now()}`;
const NOMBRE = "Audífonos de prueba para guía";

async function llenarGuia(page: Page, cantidad: number) {
	await page.goto("/guias-remision");
	await page.getByRole("button", { name: "Nueva Guía" }).click();
	await page.getByLabel(/^Fecha Traslado/).fill("2026-09-30");
	await page.getByLabel(/^Almacén Origen/).selectOption({ label: ALMACEN });
	await page.getByLabel(/^Tienda Destino/).selectOption({ label: DEPOSITO });
	await page.getByLabel(/^Peso Bruto/).fill("1.5");
	await page.getByLabel("Buscar producto").fill(SKU);
	await page.getByRole("listitem").filter({ hasText: NOMBRE }).click();
	await expect(
		page
			.getByRole("row", { name: new RegExp(SKU) })
			.getByRole("cell")
			.nth(3),
	).toHaveText(/^\s*\d+\s*$/);
	await page.getByLabel(`Cantidad de ${NOMBRE}`).fill(String(cantidad));
	await page.getByLabel(`Cantidad de ${NOMBRE}`).blur();
	await page.getByRole("button", { name: "Guardar Guía (Kardex)" }).click();
}

async function stockEnTienda(page: Page, almacen = ALMACEN) {
	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(SKU);
	await page
		.getByRole("row", { name: new RegExp(SKU) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();
	await page.getByRole("tab", { name: almacen }).click();
	return page
		.locator("p", { hasText: /^Stock Actual$/ })
		.locator("xpath=following-sibling::p[1]");
}

test("alta de un producto con 5 unidades en la tienda", async ({ page }) => {
	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(SKU);
	await page.getByLabel("Nombre *").fill(NOMBRE);
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("40.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("18.00");
	await page.getByLabel("Stock inicial").fill("5");
	await page.getByLabel(/^Almacén/).selectOption({ label: ALMACEN });
	await page.getByRole("button", { name: "Guardar" }).click();

	await page.getByLabel("Buscar productos").fill(SKU);
	await expect(page.getByRole("row", { name: new RegExp(SKU) })).toBeVisible();
});

test("más unidades que el stock: se ve el tope de la línea y no se sale del formulario", async ({
	page,
}) => {
	await llenarGuia(page, 50);
	await expect(page.getByText("Máximo 5")).toBeVisible();
	await expect(
		page.getByText(`No alcanza el stock del origen para: ${NOMBRE} (máx. 5)`),
	).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Registrar Nueva Guía de Remisión" }),
	).toBeVisible();
});

test("una guía válida recibe su correlativo y se ve como hoja A4", async ({
	page,
}) => {
	await llenarGuia(page, 2);

	await expect(
		page.getByRole("heading", { level: 1, name: /^Traslado EG01-\d{6}$/ }),
	).toBeVisible();

	const headingText = await page
		.getByRole("heading", { level: 1, name: /^Traslado EG01-\d{6}$/ })
		.innerText();
	const match = headingText.match(/(EG01-\d{6})/);
	if (!match) throw new Error("No se encontró el número de guía");
	const numeroGuia = match[1];

	await page.getByRole("button", { name: "Volver a la lista" }).click();

	const fila = page.getByRole("row", { name: new RegExp(numeroGuia) });
	await expect(fila).toBeVisible();

	await fila.getByRole("button", { name: "Ver / Imprimir" }).click();

	await expect(
		page.getByRole("heading", {
			level: 1,
			name: new RegExp(`^Traslado ${numeroGuia}$`),
		}),
	).toBeVisible();

	const hoja = page.locator(".sheet-a4");
	await expect(hoja).toContainText(ALMACEN);
	await expect(hoja).toContainText(DEPOSITO);
	await expect(hoja).toContainText(NOMBRE);
	await expect(hoja).toContainText("Traslado entre establecimientos (04)");
	const ancho = (await hoja.boundingBox())?.width ?? 0;
	expect(Math.round(ancho)).toBe(794);

	await expect(
		page.getByRole("button", { name: "Imprimir Guía (A4)" }),
	).toHaveCSS("background-color", "rgb(194, 65, 12)");

	await page.setViewportSize({ width: 390, height: 844 });
	await expect(
		page.getByRole("button", { name: "Imprimir Guía (A4)" }),
	).toBeInViewport();
	const desborde = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	expect(desborde).toBeLessThanOrEqual(0);
});

test("al imprimir, la hoja empieza arriba y ningún contenedor la recorta", async ({
	page,
}) => {
	await llenarGuia(page, 1);
	const hoja = page.locator(".sheet-a4");
	await expect(hoja).toBeVisible();
	await page.evaluate(() => {
		const caja = document.querySelector("main > div");
		if (caja) caja.scrollTop = caja.scrollHeight;
	});

	await page.emulateMedia({ media: "print" });

	const recortan = await hoja.evaluate((el) => {
		const malos: string[] = [];
		for (let e = el.parentElement; e; e = e.parentElement) {
			const { overflowY } = getComputedStyle(e);
			if (overflowY !== "visible" && e.scrollHeight > e.clientHeight + 1)
				malos.push(`${e.tagName.toLowerCase()}.${e.className}`);
		}
		return malos;
	});
	expect(recortan, "contenedores que recortan la hoja al imprimir").toEqual([]);
	const arriba = await hoja.evaluate(
		(el) => el.getBoundingClientRect().top + window.scrollY,
	);
	expect(arriba).toBeLessThanOrEqual(1);
});

test("editar el transporte de la última guía no mueve stock", async ({
	page,
}) => {
	await expect(await stockEnTienda(page)).toHaveText("2");

	await page.goto("/guias-remision");
	await page
		.getByRole("row", { name: /EG01-\d{6}/ })
		.first()
		.getByRole("button", { name: "Ver / Imprimir" })
		.click();
	await page.getByRole("button", { name: "Editar", exact: true }).click();
	await expect(
		page.getByRole("heading", { level: 1, name: /^Editar guía EG01-\d{6}$/ }),
	).toBeVisible();
	await page.getByLabel("Placa Vehículo").fill("E2E-123");
	await page.getByRole("button", { name: "Guardar cambios" }).click();

	await expect(page.locator(".sheet-a4")).toContainText("E2E-123");
	await expect(await stockEnTienda(page)).toHaveText("2");
});

test("anular la última guía: queda en la lista como anulada y el stock vuelve a la tienda", async ({
	page,
}) => {
	await page.goto("/guias-remision");
	const fila = page.getByRole("row", { name: /EG01-\d{6}/ }).first();
	const numero = (await fila.getByRole("cell").first().innerText()).trim();
	await fila.getByRole("button", { name: "Ver / Imprimir" }).click();

	await page.getByRole("button", { name: "Anular", exact: true }).click();
	const dialogo = page.getByRole("dialog", {
		name: `Anular la guía ${numero}`,
	});
	await dialogo.getByLabel(/^Motivo/).fill("Prueba E2E: traslado cancelado");
	await dialogo.getByRole("button", { name: "Anular guía" }).click();

	await expect(page.locator(".sheet-a4")).toContainText("Guía anulada");
	await expect(
		page.getByRole("button", { name: "Editar", exact: true }),
	).toHaveCount(0);
	await page.getByRole("button", { name: "Volver a la lista" }).click();
	await expect(
		page.getByRole("row", { name: new RegExp(numero) }),
	).toContainText("Anulada");
	await expect(await stockEnTienda(page)).toHaveText("3");
});

test("una guía de compra lleva al proveedor elegido por su RUC y no mueve stock", async ({
	page,
}) => {
	const marca = Date.now();
	const proveedor = `Proveedor guía E2E ${marca}`;
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

	await page.goto("/guias-remision");
	await page.getByRole("button", { name: "Nueva Guía" }).click();
	await page.getByLabel(/^Fecha Traslado/).fill("2026-09-30");
	await page.getByLabel("Motivo").selectOption("02");
	await page.getByLabel(/^Proveedor/).fill(ruc);
	await expect(page.getByText(proveedor)).toBeVisible();
	await expect(page.getByLabel(/^Almacén Origen/)).toHaveCount(0);
	await page.getByLabel(/^Tienda Destino/).selectOption({ label: DEPOSITO });
	await page.getByLabel(/^Peso Bruto/).fill("3");
	await page.getByLabel("Buscar producto").fill(SKU);
	await page.getByRole("listitem").filter({ hasText: NOMBRE }).click();
	await page.getByLabel(`Cantidad de ${NOMBRE}`).fill("4");
	await page.getByLabel(`Cantidad de ${NOMBRE}`).blur();
	await page.getByRole("button", { name: "Guardar Guía (Kardex)" }).click();

	const hoja = page.locator(".sheet-a4");
	await expect(hoja).toContainText("Compra (02)");
	await expect(hoja).toContainText(proveedor);
	await expect(hoja).toContainText(`RUC ${ruc}`);
	await expect(await stockEnTienda(page, DEPOSITO)).toHaveText("2");
});
