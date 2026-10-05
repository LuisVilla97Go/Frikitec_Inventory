import { TestBed } from "@angular/core/testing";

import {
	PaginadorComponent,
	paginasDe,
	TAMANOS_DE_PAGINA,
	TamanosDePagina,
} from "./paginador.component";

describe("PaginadorComponent", () => {
	function crear(pagina: number, porPagina: number, total: number) {
		const fixture = TestBed.createComponent(PaginadorComponent);
		fixture.componentRef.setInput("pagina", pagina);
		fixture.componentRef.setInput("porPagina", porPagina);
		fixture.componentRef.setInput("total", total);
		fixture.componentRef.setInput("etiqueta", "productos");
		fixture.detectChanges();
		const html: HTMLElement = fixture.nativeElement;
		const paginas: number[] = [];
		const tamanos: number[] = [];
		fixture.componentInstance.paginaCambia.subscribe((p) => paginas.push(p));
		fixture.componentInstance.porPaginaCambia.subscribe((t) => tamanos.push(t));
		return { fixture, html, paginas, tamanos };
	}

	it("ofrece 10, 20, 50 y 100 filas y marca la elegida", () => {
		const { html } = crear(1, 20, 45);
		const select = html.querySelector("select") as HTMLSelectElement;
		expect([...select.options].map((o) => Number(o.value))).toEqual([
			...TAMANOS_DE_PAGINA,
		]);
		expect(select.value).toBe("20");
		expect(html.textContent).toContain("45 productos · página 1 de 3");
	});

	it("emite el tamaño nuevo al elegirlo", () => {
		const { html, tamanos } = crear(2, 10, 45);
		const select = html.querySelector("select") as HTMLSelectElement;
		select.value = "50";
		select.dispatchEvent(new Event("change"));
		expect(tamanos).toEqual([50]);
	});

	it("no pasa de la primera ni de la última página", () => {
		const { html, paginas } = crear(3, 20, 45);
		const [anterior, siguiente] = [
			...html.querySelectorAll("button"),
		] as HTMLButtonElement[];
		expect(siguiente.disabled).toBe(true);
		anterior.click();
		expect(paginas).toEqual([2]);
	});

	it("paginasDe nunca da menos de 1", () => {
		expect(paginasDe(0, 10)).toBe(1);
		expect(paginasDe(101, 50)).toBe(3);
	});

	it("recuerda el tamaño por tabla mientras dura la sesión", () => {
		const tamanos = TestBed.inject(TamanosDePagina);
		tamanos.de("productos").set(50);
		expect(tamanos.de("productos")()).toBe(50);
		expect(tamanos.de("usuarios")()).toBe(10);
	});
});
