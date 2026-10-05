import { expect, test } from "@playwright/test";

import { ALMACEN } from "./datos";

test.describe.configure({ mode: "serial" });

test("el scroll acaba en las últimas tarjetas sin desplazar el layout ni dejar una pantalla vacía", async ({
	page,
}, info) => {
	for (const ancho of [1366, 390]) {
		await page.setViewportSize({ width: ancho, height: 844 });
		await page.goto("/dashboard");
		await expect(page.getByTestId("valor-inventario")).toContainText(/\d/);
		for (const menuAlternado of [false, true]) {
			if (menuAlternado) {
				await page
					.getByRole("button", {
						name: ancho === 390 ? "Abrir menú" : "Colapsar menú",
					})
					.click();
				if (ancho === 1366)
					await expect(page.locator("aside")).toHaveCSS("width", "80px");
			}
			const contenido = page.locator("main > div");
			await contenido.evaluate((elemento) => {
				elemento.scrollTop = elemento.scrollHeight;
			});
			const medidas = await page.evaluate(() => {
				const scroll = document.querySelector("main > div");
				const dashboard = document.querySelector("app-dashboard > div");
				return {
					alto: innerHeight,
					documento: document.documentElement.scrollHeight,
					desplazamiento: scrollY,
					fondo: dashboard?.getBoundingClientRect().bottom,
					final: scroll?.getBoundingClientRect().bottom,
				};
			});
			expect(medidas.documento).toBeLessThanOrEqual(medidas.alto + 1);
			expect(medidas.desplazamiento).toBe(0);
			expect(
				Math.abs((medidas.fondo ?? 0) - (medidas.final ?? 0)),
			).toBeLessThanOrEqual(1);
			await expect(
				page.getByRole("heading", { name: "Últimos movimientos" }),
			).toBeVisible();
			await page.screenshot({
				path: info.outputPath(
					`dashboard-final-${ancho}-${menuAlternado ? "menu-alternado" : "normal"}.png`,
				),
				fullPage: true,
			});
		}
	}
});

const SKU = `E2E-DASH-${Date.now()}`;
const NOMBRE = "Cargador del dashboard";

test("un producto nuevo con 3 unidades aparece en el dashboard", async ({
	page,
}, testInfo) => {
	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(SKU);
	await page.getByLabel("Nombre *").fill(NOMBRE);
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("99.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("25.00");
	await page.getByLabel("Stock inicial").fill("3");
	await page.getByLabel(/^Almacén/).selectOption({ label: ALMACEN });
	await page.getByRole("button", { name: "Guardar" }).click();
	await page.getByLabel("Buscar productos").fill(SKU);
	await expect(page.getByRole("row", { name: new RegExp(SKU) })).toBeVisible();

	await page.goto("/dashboard");
	await expect(
		page.getByRole("heading", { level: 1, name: "Resumen de inventario" }),
	).toBeVisible();
	await expect(page.getByTestId("valor-inventario")).toContainText(/\d/);
	await expect(page.getByTestId("por-reponer")).not.toHaveText("0");
	await expect(page.getByText(NOMBRE).first()).toBeVisible();
	const graficos = page.locator("app-grafico canvas");
	await expect(graficos).toHaveCount(4);
	for (const lienzo of await graficos.all()) {
		const caja = await lienzo.boundingBox();
		expect(caja?.width).toBeGreaterThan(100);
		expect(caja?.height).toBeGreaterThan(50);
	}


	await expect(page.getByTestId("titulo-marcas")).toBeVisible();

	await page.screenshot({
		path: testInfo.outputPath("dashboard.png"),
		fullPage: true,
	});
	const graficosDeValor = page.getByTestId("valor-por-grupo");
	await graficosDeValor.scrollIntoViewIfNeeded();
	await page.waitForTimeout(1_500);
	await graficosDeValor.screenshot({
		path: testInfo.outputPath("valor-por-grupo.png"),
	});
});

test("el valor por categoría también se lee como tabla", async ({ page }) => {
	await page.goto("/dashboard");
	const tabla = page.getByRole("button", { name: "Tabla" });
	await tabla.click();
	await expect(tabla).toHaveAttribute("aria-pressed", "true");
	await expect(
		page.getByRole("columnheader", { name: "Categoría" }),
	).toBeVisible();
	await expect(page.locator("app-grafico canvas")).toHaveCount(3);
});

test("en un teléfono el dashboard no se desplaza de lado", async ({
	page,
}, testInfo) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto("/dashboard");
	await expect(page.getByTestId("valor-inventario")).toContainText(/\d/);
	await expect(page.locator("app-grafico canvas")).toHaveCount(4);
	const desborde = await page.evaluate(
		() => document.documentElement.scrollWidth - window.innerWidth,
	);
	expect(desborde).toBeLessThanOrEqual(0);
	await page.screenshot({
		path: testInfo.outputPath("dashboard-390.png"),
		fullPage: true,
	});
});
