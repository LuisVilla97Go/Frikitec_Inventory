import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

const PANTALLAS = [
	"/dashboard",
	"/productos",
	"/movimientos",
	"/kardex",
	"/toma-fisica",
	"/ordenes",
	"/ordenes/nueva",
	"/ordenes/ejemplo",
	"/ordenes/no-existe/editar",
	"/ordenes/no-existe",
	"/guias-remision",
	"/usuarios",
	"/maestros/almacenes",
	"/maestros/proveedores",
	"/maestros/empresa",
];

const ANCHOS = [
	{ nombre: "escritorio", width: 1366, height: 768 },
	{ nombre: "móvil", width: 390, height: 844 },
];

function textoInvisible(page: Page): Promise<string[]> {
	return page.evaluate(() => {
		const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).map(Number);
		const luz = ([r, g, b]: number[]) => {
			const canal = (v: number) => {
				const s = v / 255;
				return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
			};
			return 0.2126 * canal(r) + 0.7152 * canal(g) + 0.0722 * canal(b);
		};
		const fondo = (el: Element | null): number[] => {
			for (let e = el; e; e = e.parentElement) {
				const c = rgb(getComputedStyle(e).backgroundColor);
				if (c.length >= 3 && (c[3] ?? 1) > 0) return c;
			}
			return [255, 255, 255];
		};
		const malos: string[] = [];
		for (const el of document.querySelectorAll("button, a")) {
			const texto = (el as HTMLElement).innerText?.trim();
			const caja = el.getBoundingClientRect();
			if (!texto || caja.width === 0 || caja.height === 0) continue;
			const estilo = getComputedStyle(el);
			if (estilo.visibility === "hidden" || Number(estilo.opacity) === 0)
				continue;
			const [a, b] = [luz(rgb(estilo.color)), luz(fondo(el))];
			const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
			if (contraste < 1.5)
				malos.push(
					`«${texto.slice(0, 40)}» (contraste ${contraste.toFixed(2)})`,
				);
		}
		return malos;
	});
}

test("el detector ve un botón blanco sobre blanco (el de Guías con brand-600)", async ({
	page,
}) => {
	await page.setContent(`
		<main style="background:#fff">
			<button style="color:#fff;background:transparent">Nueva Guía</button>
			<button style="color:#fff;background:#f27145">Guardar</button>
			<a href="#" style="color:#111827">Ver</a>
		</main>`);
	expect(await textoInvisible(page)).toEqual(["«Nueva Guía» (contraste 1.00)"]);
});

for (const ancho of ANCHOS) {
	test.describe(`pantallas a ${ancho.width} px`, () => {
		test.use({ viewport: { width: ancho.width, height: ancho.height } });

		for (const ruta of PANTALLAS) {
			test(`${ruta} (${ancho.nombre})`, async ({ page }, info) => {
				const errores: string[] = [];
				page.on("pageerror", (e) => errores.push(e.message));

				await page.goto(ruta);
				await expect(page).toHaveURL(new RegExp(`${ruta}$`));
				await page.waitForLoadState("networkidle");
				await expect(page.getByText(/Cargando/i)).toHaveCount(0);

				await info.attach(
					`${ruta.slice(1).replaceAll("/", "-")}-${ancho.width}.png`,
					{
						body: await page.screenshot({ fullPage: true }),
						contentType: "image/png",
					},
				);

				const desborde = await page.evaluate(
					() => document.documentElement.scrollWidth - window.innerWidth,
				);
				expect(desborde, "la página se desplaza de lado").toBeLessThanOrEqual(
					0,
				);
				expect(
					await textoInvisible(page),
					"texto del color de su fondo",
				).toEqual([]);
				expect(errores, "errores de JavaScript").toEqual([]);

				const accesibilidad = await new AxeBuilder({ page }).analyze();
				const infracciones = accesibilidad.violations.flatMap((regla) =>
					regla.nodes.map((nodo) => `${regla.id}: ${nodo.target.join(" ")}`),
				);
				expect(infracciones, `AXE en ${ruta} a ${ancho.width} px`).toEqual([]);
			});
		}
	});
}
