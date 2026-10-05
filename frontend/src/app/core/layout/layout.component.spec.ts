import { type ComponentFixture, TestBed } from "@angular/core/testing";

import { proveedoresDeTest } from "../../../testing/proveedores-test";
import { LayoutComponent } from "./layout.component";

describe("LayoutComponent", () => {
	let component: LayoutComponent;
	let fixture: ComponentFixture<LayoutComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [LayoutComponent],
			providers: proveedoresDeTest(),
		}).compileComponents();

		fixture = TestBed.createComponent(LayoutComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it("should create", () => {
		expect(component).toBeTruthy();
	});

	it("separa cada ícono del menú de su texto aunque lucideIcon reescriba la clase del <svg>", async () => {
		await fixture.whenStable();
		fixture.detectChanges();
		const html: HTMLElement = fixture.nativeElement;
		const enlaces = [...html.querySelectorAll("aside nav a[href]")];
		expect(enlaces.length).toBeGreaterThan(0);
		for (const enlace of enlaces) {
			const svg = enlace.querySelector("svg");
			expect(svg?.parentElement?.classList).toContain("mr-4");
			expect(svg?.classList).not.toContain("mr-4");
		}
	});
});
