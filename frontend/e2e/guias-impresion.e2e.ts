import { expect, test } from "@playwright/test";

import { ALMACEN, DEPOSITO } from "./datos";


const N = 40;
const NUMERO = "EG01-000321";
const productos = Array.from({ length: N }, (_, k) => {
	const i = String(k + 1).padStart(3, "0");
	return {
		id: `00000000-0000-4000-8000-000000000${i}`,
		sku: `UPP-GCT-RMBA13-${i}`.slice(0, 20),
		name: `${i} Funda protectora MagSafe para iPhone`,
		category: "Accesorios",
		sub_category: null,
		variant: null,
		barcode: null,
		brand: "Frikitec",
		purchase_price: "10.00",
		sale_price: "20.00",
		has_movements: true,
		unvalued_stock: false,
	};
});

test("una guía de 40 productos se imprime en 2 hojas, con pie en cada una y las firmas enteras", async ({
	page,
}) => {
	test.setTimeout(120_000);
	await page.route(/\/api\/productos(\?|$)/, (route) => {
		const sku = new URL(route.request().url()).searchParams.get("search");
		const data = productos.filter((p) => p.sku === sku);
		return route.fulfill({
			json: { data, page: 1, per_page: 10, total: data.length },
		});
	});
	await page.route(/\/api\/guias-remision$/, (route) =>
		route.request().method() === "POST"
			? route.fulfill({
				status: 201,
				json: {
					data: { id: "g1", numero_guia: NUMERO, estado: "EN_TRANSITO" },
				},
			})
			: route.fallback(),
	);

	await page.route(/\/api\/guias-remision\/stock-disponible/, (route) => {
		const ids =
			new URL(route.request().url()).searchParams.get("producto_ids") ?? "";
		return route.fulfill({
			json: {
				data: ids.split(",").map((producto_id) => ({ producto_id, stock: 5 })),
			},
		});
	});
	await page.route(/\/api\/guias-remision\/g1$/, (route) =>
		route.fulfill({
			json: {
				status: "success",
				data: {
					id: "g1",
					numero_guia: NUMERO,
					fecha_traslado: "2026-09-30T17:00:00+00:00",
					motivo_traslado: "04",
					estado: "EN_TRANSITO",
					origen: ALMACEN,
					destino: DEPOSITO,
					total_items: N,
					total_unidades: N,
					almacen_origen_id: "00000000-0000-4000-8000-00000000a001",
					almacen_destino_id: "00000000-0000-4000-8000-00000000a002",
					proveedor_id: null,
					proveedor_documento: null,
					peso_bruto_total: "8.00",
					conductor_nombre: null,
					conductor_dni: null,
					vehiculo_placa: null,
					motivo_anulacion: null,
					anulada_en: null,
					detalles: productos.map((p) => ({
						producto_id: p.id,
						producto_sku: p.sku,
						producto_nombre: p.name,
						cantidad: 1,
					})),
				},
			},
		}),
	);
	await page.route(/\/api\/empresa$/, (route) =>
		route.request().method() === "GET"
			? route.fulfill({
				json: {
					data: {
						ruc: "20610949518",
						razon_social: "FRIKITEC PERU E.I.R.L.",
						nombre_comercial: null,
						direccion_fiscal: "Av. Petit Thouars 5356",
						ubigeo: null,
						distrito: "Miraflores",
						provincia: "Lima",
						departamento: "Lima",
						telefono: null,
						correo: null,
						web: null,
						updated_at: "2026-09-28T10:00:00+00:00",
					},
				},
			})
			: route.fallback(),
	);

	await page.goto("/guias-remision");
	await page.getByRole("button", { name: "Nueva Guía" }).click();
	await page.getByLabel(/^Fecha Traslado/).fill("2026-09-30");
	await page.getByLabel(/^Almacén Origen/).selectOption({ label: ALMACEN });
	await page.getByLabel(/^Tienda Destino/).selectOption({ label: DEPOSITO });
	await page.getByLabel(/^Peso Bruto/).fill("8");
	for (const p of productos) {
		await page.getByLabel("Buscar producto").fill(p.sku);
		await page.getByRole("listitem").filter({ hasText: p.sku }).click();
	}
	await page.getByRole("button", { name: "Guardar Guía (Kardex)" }).click();
	await expect(page.locator(".sheet-a4")).toContainText(
		`${N} ítems · ${N} unidades`,
	);

	await page.emulateMedia({ media: "print" });

	const estilos = await page
		.locator("head style")
		.evaluateAll((s) => s.map((e) => e.textContent ?? "").join("\n"));
	expect(estilos).toContain(`RUC 20610949518 · Guía ${NUMERO}`);
	expect(estilos).toContain('"Hoja " counter(page) " de " counter(pages)');

	const bloqueFirmas = page
		.locator(".sheet-a4 div", { hasText: "Despachado por" })
		.first();
	await expect(bloqueFirmas).toHaveCSS("break-inside", "avoid");
	await expect(page.locator("body")).toHaveCSS(
		"background-color",
		"rgb(255, 255, 255)",
	);

	const pdf = await page.pdf({
		format: "A4",
		printBackground: true,
		preferCSSPageSize: true,
	});
	const hojas = pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? [];
	expect(hojas).toHaveLength(2);
});
