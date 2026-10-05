import { expect, type Page, type TestInfo, test } from "@playwright/test";

import { ALMACEN } from "./datos";

async function comprobarPapel(page: Page, info: TestInfo, nombre: string) {
	await page.setViewportSize({ width: 688, height: 1123 });
	await page.emulateMedia({ media: "print" });
	const tabla = page.locator(".orden-tabla");
	await expect(tabla).toHaveCSS("overflow-x", "visible");
	const ancho = await tabla.evaluate((elemento) => ({
		visible: elemento.clientWidth,
		contenido: elemento.scrollWidth,
	}));
	expect(ancho.contenido).toBeLessThanOrEqual(ancho.visible + 1);
	const celdas = await tabla.locator("th, td").evaluateAll((elementos) =>
		elementos.map((elemento) => ({
			ancho: elemento.clientWidth,
			contenido: elemento.scrollWidth,
		})),
	);
	for (const celda of celdas)
		expect(celda.contenido).toBeLessThanOrEqual(celda.ancho + 1);
	await expect(tabla.locator("tbody tr").first()).toHaveCSS(
		"break-inside",
		"avoid",
	);
	await expect(page.getByRole("button", { name: /^Imprimir/ })).toBeHidden();
	const pdf = await page.pdf({
		path: info.outputPath(nombre),
		format: "A4",
		preferCSSPageSize: true,
		printBackground: true,
	});
	await info.attach(nombre, {
		path: info.outputPath(nombre),
		contentType: "application/pdf",
	});
	await page.emulateMedia({ media: "screen" });
	return pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g)?.length ?? 0;
}

test("una orden nueva conserva el stock y bloquea el envío sin tres firmantes", async ({
	page,
}, info) => {
	const marca = Date.now();
	const sku = `OC-E2E-${marca}`;
	const proveedor = `Proveedor E2E ${marca}`;
	const ruc = `20${String(marca).slice(-9)}`;

	await page.goto("/productos");
	await page.getByRole("button", { name: "Nuevo Producto" }).click();
	await page.getByLabel("SKU *").fill(sku);
	await page.getByLabel("Nombre *").fill("Cable para compra E2E");
	await page.getByLabel("Marca *").fill("Frikitec");
	await page.getByLabel("Categoría *").selectOption({ index: 1 });
	await page.getByLabel("Precio de Venta (S/.) *").fill("25.00");
	await page.getByLabel("Costo unitario (S/.) *").fill("12.50");
	await page.getByLabel("Stock inicial").fill("10");
	await page.getByLabel(/^Almacén/).selectOption({ label: ALMACEN });
	await page.getByRole("button", { name: "Guardar" }).click();
	await page.getByLabel("Buscar productos").fill(sku);
	await expect(page.getByRole("row", { name: new RegExp(sku) })).toBeVisible();

	await page.goto("/maestros/proveedores");
	await page.getByRole("button", { name: "Nuevo proveedor" }).click();
	const formulario = page.getByRole("dialog", { name: "Nuevo proveedor" });
	await formulario.getByLabel("Número de documento *").fill(ruc);
	await formulario.getByLabel("Razón social *").fill(proveedor);
	await formulario.getByRole("button", { name: "Guardar" }).click();
	await expect(
		page.getByRole("row", { name: new RegExp(proveedor) }),
	).toBeVisible();

	await page.goto("/ordenes");
	await page.getByRole("link", { name: "Nueva orden" }).click();
	await expect(page).toHaveURL(/\/ordenes\/nueva$/);
	const editor = page.getByRole("region", { name: "Preparar orden" });
	await editor.getByRole("combobox", { name: "Proveedor *" }).fill(ruc);
	await expect(editor.getByText(proveedor, { exact: true })).toBeVisible();
	await editor
		.getByRole("combobox", { name: "Producto *" })
		.fill("Cable para compra");
	await editor.getByRole("option", { name: new RegExp(sku) }).click();
	await expect(
		editor.getByRole("button", { name: /Cambiar producto/ }),
	).toBeVisible();
	await editor.getByLabel("Almacén previsto").selectOption({ label: ALMACEN });
	await editor.getByLabel("Cantidad").fill("3");
	await editor.getByLabel("Costo unitario PEN").fill("12.50");
	await editor.getByRole("button", { name: "Guardar borrador" }).click();
	await expect(page).toHaveURL(/\/ordenes\/[a-f0-9-]{36}$/);
	const rutaOrden = new URL(page.url()).pathname;
	await expect(page.getByRole("heading", { name: proveedor })).toBeVisible();
	await expect(
		page.getByRole("heading", { name: "Productos y cantidades" }),
	).toBeVisible();
	await expect(page.getByRole("row", { name: new RegExp(sku) })).toContainText(
		"3",
	);
	await page.getByRole("link", { name: "Editar / nueva versión" }).click();
	await expect(page).toHaveURL(/\/ordenes\/[^/]+\/editar$/);
	await expect(editor.getByLabel("Almacén previsto")).toHaveValue(/.+/);
	await expect(
		editor.getByLabel("Almacén previsto").locator("option:checked"),
	).toHaveText(ALMACEN);
	await expect(editor.getByLabel("Cantidad")).toHaveValue("3");
	await editor.getByLabel("Cantidad").fill("4");
	for (const ancho of [1366, 390]) {
		await page.setViewportSize({ width: ancho, height: 844 });
		const altoDocumento = await page.evaluate(() => ({
			contenido: document.documentElement.scrollHeight,
			ventana: innerHeight,
		}));
		expect(altoDocumento.contenido).toBeLessThanOrEqual(
			altoDocumento.ventana + 1,
		);
		await info.attach(`orden-editor-${ancho}.png`, {
			body: await page.screenshot({ fullPage: true }),
			contentType: "image/png",
		});
		expect(
			await page.evaluate(
				() => document.documentElement.scrollWidth - innerWidth,
			),
		).toBeLessThanOrEqual(0);
	}
	await editor.getByRole("button", { name: "Guardar borrador" }).click();
	await expect(page).toHaveURL(new RegExp(`${rutaOrden}$`));
	await expect(page.getByRole("row", { name: new RegExp(sku) })).toContainText(
		"4",
	);
	await expect(
		page.getByRole("region", { name: "Total de la orden" }),
	).toContainText("50.00");
	await page.getByRole("link", { name: "Editar / nueva versión" }).click();
	await editor.getByLabel("Cantidad").fill("99");
	await editor.getByRole("button", { name: "Cancelar", exact: true }).click();
	await expect(page).toHaveURL(new RegExp(`${rutaOrden}$`));
	await expect(page.getByRole("row", { name: new RegExp(sku) })).toContainText(
		"4",
	);
	await page.getByRole("button", { name: "Enviar a firmas" }).click();
	await expect(page.getByRole("alert").last()).toContainText("Jefe de Almacén");
	for (const ancho of [1366, 390]) {
		await page.setViewportSize({ width: ancho, height: 844 });
		const captura = info.outputPath(`orden-detalle-${ancho}.png`);
		await page.screenshot({ path: captura, fullPage: true });
		await info.attach(`orden-detalle-${ancho}.png`, {
			path: captura,
			contentType: "image/png",
		});
		const desborde = await page.evaluate(
			() => document.documentElement.scrollWidth - innerWidth,
		);
		expect(desborde, `desborde horizontal a ${ancho} px`).toBeLessThanOrEqual(
			0,
		);
	}
	await page.goto("/ordenes");
	const pestanas = page.context().pages().length;
	const numeroOrden = await page
		.getByRole("row", { name: new RegExp(proveedor) })
		.getByRole("link", { name: /^OC-/ })
		.innerText();
	for (const nombre of ["Ver detalle", numeroOrden]) {
		const enlace = page
			.getByRole("row", { name: new RegExp(proveedor) })
			.getByRole("link", { name: nombre, exact: true });
		await expect(enlace).not.toHaveAttribute("target", "_blank");
		await enlace.click();
		await expect(page).toHaveURL(new RegExp(`${rutaOrden}$`));
		await expect(page.getByRole("heading", { name: proveedor })).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Todas las órdenes" }),
		).toHaveCount(0);
		expect(page.context().pages()).toHaveLength(pestanas);
		await page.getByRole("link", { name: "← Volver a órdenes" }).click();
		await expect(page).toHaveURL(/\/ordenes$/);
		await expect(
			page.getByRole("row", { name: new RegExp(proveedor) }),
		).toBeVisible();
	}
	await page.goto("/kardex");
	await page.getByLabel("Buscar productos").fill(sku);
	await page
		.getByRole("row", { name: new RegExp(sku) })
		.getByRole("button", { name: "Abrir Kardex" })
		.click();
	await expect(
		page
			.locator("p", { hasText: /^Stock Actual$/ })
			.locator("xpath=following-sibling::p[1]"),
	).toHaveText("10");
});

test("una orden guardada imprime todas sus columnas en una hoja A4", async ({
	page,
}, info) => {
	const csrf = (await page.context().cookies()).find(
		(cookie) => cookie.name === "csrf_access_token",
	);
	expect(csrf).toBeDefined();
	const headers = { "X-CSRF-TOKEN": csrf?.value ?? "" };
	const marca = Date.now();
	const proveedor = await page.request.post("/api/proveedores", {
		headers,
		data: {
			tipo_documento: "RUC",
			numero_documento: `20${String(marca).slice(-9)}`,
			razon_social: `Proveedor de impresión E2E ${marca}`,
		},
	});
	expect(proveedor.status()).toBe(201);
	const producto = await page.request.post("/api/productos", {
		headers,
		data: {
			sku: `OC-PAPEL-${marca}`,
			name: "Cable de impresión E2E",
			brand: "Frikitec",
			category: "Cables",
			purchase_price: "12.50",
			sale_price: "25.00",
		},
	});
	expect(producto.status()).toBe(201);
	const almacenes = await page.request.get("/api/almacenes");
	expect(almacenes.ok()).toBe(true);
	const orden = await page.request.post("/api/ordenes", {
		headers,
		data: {
			proveedor_id: (await proveedor.json()).data.id,
			lineas: [
				{
					producto_id: (await producto.json()).data.id,
					almacen_previsto_id: (await almacenes.json()).data[0].id,
					cantidad_solicitada: 4,
					costo_unitario: "12.50",
				},
			],
		},
	});
	expect(orden.status()).toBe(201);
	await page.goto(`/ordenes/${(await orden.json()).data.id}`);
	await expect(page.locator(".orden-tabla tbody tr")).toHaveCount(1);
	await expect(
		page.getByRole("region", { name: "Total de la orden" }),
	).toContainText("50.00");
	expect(await comprobarPapel(page, info, "orden-real-a4.pdf")).toBe(1);
});

test("una orden de 40 líneas cabe en A4 sin scroll ni columnas cortadas", async ({
	page,
}, info) => {
	const version = {
		id: "v-papel",
		number: 1,
		supplier_id: "s-papel",
		supplier_document: "20000000002",
		supplier_name: "Proveedor de impresión E2E",
		currency: "PEN",
		exchange_rate: "1.00",
		status: "BORRADOR",
		created_at: "2026-10-03T10:00:00Z",
		submitted_at: null,
		approved_at: null,
		issued_at: null,
		cancellation_reason: null,
		approvals: [],
		lines: Array.from({ length: 40 }, (_, indice) => ({
			id: `linea-papel-${indice}`,
			product_id: "producto-papel",
			warehouse_id: "almacen-papel",
			sku: `SKU-DE-PRUEBA-EXTENSO-${String(indice + 1).padStart(3, "0")}`,
			product_name: `Producto de impresión ${indice + 1} con una descripción extensa para revisar el ajuste de texto`,
			warehouse_name: "Almacén de prueba con nombre extenso",
			quantity_ordered: 4,
			quantity_received: 0,
			quantity_closed: 0,
			quantity_open: 4,
			unit_cost: "12.50",
		})),
	};
	await page.route("**/api/ordenes/orden-papel", (route) =>
		route.fulfill({
			json: {
				data: {
					id: "orden-papel",
					number: "OC-PAPEL-E2E",
					status: "BORRADOR",
					version_number: 1,
					created_by_id: "usuario-papel",
					created_at: version.created_at,
					supplier_name: version.supplier_name,
					version,
					versions: [version],
					receipts: [],
				},
			},
		}),
	);
	await page.goto("/ordenes/orden-papel");
	await expect(page.locator(".orden-tabla tbody tr")).toHaveCount(40);
	const hojas = await comprobarPapel(page, info, "orden-40-lineas-a4.pdf");
	expect(hojas).toBeGreaterThan(1);
	expect(hojas).toBeLessThanOrEqual(4);
});

test("el ejemplo sustituye el listado en la misma pestaña sin guardar una orden", async ({
	page,
}) => {
	let escrituras = 0;
	page.context().on("request", (request) => {
		if (request.url().includes("/api/ordenes") && request.method() !== "GET")
			escrituras++;
	});
	await page.goto("/ordenes/ejemplo");
	await expect(
		page.getByRole("heading", { name: "Proveedor de ejemplo" }),
	).toBeVisible();
	await expect(page.getByText("Vista de ejemplo · no guardada")).toBeVisible();
	expect(await comprobarPapel(page, test.info(), "orden-ejemplo-a4.pdf")).toBe(
		1,
	);
	await expect(
		page.getByRole("region", { name: "Total del ejemplo" }),
	).toContainText("240,00");
	await expect(
		page.getByRole("button", { name: "Guardar borrador" }),
	).toHaveCount(0);
	await page.goto("/ordenes/nueva");
	await page.route("**/api/ordenes?*", (route) =>
		route.fulfill({
			json: { status: "success", data: [], page: 1, per_page: 10, total: 0 },
		}),
	);
	await page.getByRole("button", { name: "Cancelar", exact: true }).click();
	await expect(page).toHaveURL(/\/ordenes$/);
	await expect(page.getByText("0 registradas")).toBeVisible();
	const pestanas = page.context().pages().length;
	for (const nombre of ["Ver ejemplo", "OC-DEMO-001"]) {
		const enlace = page.getByRole("link", { name: nombre, exact: true });
		await expect(enlace).not.toHaveAttribute("target", "_blank");
		await enlace.click();
		await expect(page).toHaveURL(/\/ordenes\/ejemplo$/);
		await expect(
			page.getByRole("heading", { name: "Proveedor de ejemplo" }),
		).toBeVisible();
		await expect(
			page.getByText("Vista de ejemplo · no guardada"),
		).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Todas las órdenes" }),
		).toHaveCount(0);
		expect(page.context().pages()).toHaveLength(pestanas);
		await page.getByRole("link", { name: "← Volver a órdenes" }).click();
		await expect(page).toHaveURL(/\/ordenes$/);
		await expect(page.getByText("0 registradas")).toBeVisible();
		await expect(
			page.getByRole("heading", { name: "Proveedor de ejemplo" }),
		).toHaveCount(0);
	}
	await page.getByRole("link", { name: "Ver ejemplo", exact: true }).click();
	await expect(page).toHaveURL(/\/ordenes\/ejemplo$/);
	await page.goBack();
	await expect(page).toHaveURL(/\/ordenes$/);
	await expect(page.getByText("0 registradas")).toBeVisible();
	expect(page.context().pages()).toHaveLength(pestanas);
	expect(escrituras).toBe(0);
});
