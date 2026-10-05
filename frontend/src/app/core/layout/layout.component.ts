import { NgOptimizedImage } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
	NavigationEnd,
	Router,
	RouterLink,
	RouterLinkActive,
	RouterOutlet,
} from "@angular/router";
import {
	LucideArrowRightLeft as ArrowRightLeft,
	LucideBookOpen as BookOpen,
	LucideBuilding2 as Building2,
	LucideChevronDown as ChevronDown,
	LucideChevronLeft as ChevronLeft,
	LucideChevronRight as ChevronRight,
	LucideClipboardCheck as ClipboardCheck,
	LucideDatabase as Database,
	LucideLandmark as Landmark,
	LucideLayoutDashboard as LayoutDashboard,
	LucideLogOut as LogOut,
	LucideDynamicIcon,
	LucideMenu as Menu,
	LucidePackage as Package,
	LucideShoppingCart as ShoppingCart,
	LucideTruck as Truck,
	LucideUsers as Users,
	LucideWarehouse as Warehouse,
	LucideX as X,
} from "@lucide/angular";
import { filter } from "rxjs";

import { AuthService } from "../auth/auth.service";

@Component({
	selector: "app-layout",
	host: { class: "block" },
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		RouterOutlet,
		RouterLink,
		RouterLinkActive,
		LucideDynamicIcon,
		NgOptimizedImage,
	],
	templateUrl: "./layout.component.html",
})
export class LayoutComponent {
	private readonly authService = inject(AuthService);
	private readonly router = inject(Router);

	protected readonly LogOut = LogOut;
	protected readonly Menu = Menu;
	protected readonly X = X;
	protected readonly ChevronLeft = ChevronLeft;
	protected readonly ChevronRight = ChevronRight;
	protected readonly ChevronDown = ChevronDown;
	protected readonly Database = Database;

	protected readonly isMobileMenuOpen = signal(false);
	protected readonly isSidebarCollapsed = signal(false);
	protected readonly isMaestrosOpen = signal(
		this.router.url.startsWith("/maestros"),
	);
	protected readonly isMaestrosRoute = signal(
		this.router.url.startsWith("/maestros"),
	);

	protected readonly usuario = this.authService.usuario;
	protected readonly nombreUsuario = computed(
		() => this.usuario()?.nombre ?? "Usuario",
	);
	protected readonly inicial = computed(() =>
		this.nombreUsuario().charAt(0).toUpperCase(),
	);

	protected readonly menuItems = [
		{ name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
		{ name: "Productos", path: "/productos", icon: Package },
		{ name: "Kardex", path: "/kardex", icon: BookOpen },
		{ name: "Movimientos", path: "/movimientos", icon: ArrowRightLeft },
		{ name: "Toma física", path: "/toma-fisica", icon: ClipboardCheck },
		{ name: "Guías Remisión", path: "/guias-remision", icon: Truck },
		{ name: "Órdenes de compra", path: "/ordenes", icon: ShoppingCart },
	];
	protected readonly usuariosItem = {
		name: "Usuarios",
		path: "/usuarios",
		icon: Users,
	};
	protected readonly maestroItems = [
		{ name: "Almacenes", path: "/maestros/almacenes", icon: Warehouse },
		{ name: "Proveedores", path: "/maestros/proveedores", icon: Building2 },
		{ name: "Empresa", path: "/maestros/empresa", icon: Landmark },
	];

	constructor() {
		this.router.events
			.pipe(
				filter(
					(event): event is NavigationEnd => event instanceof NavigationEnd,
				),
				takeUntilDestroyed(),
			)
			.subscribe((event) => {
				const inMaestros = event.urlAfterRedirects.startsWith("/maestros");
				this.isMaestrosRoute.set(inMaestros);
				if (inMaestros) this.isMaestrosOpen.set(true);
			});
	}

	protected toggleMaestros() {
		if (this.isSidebarCollapsed()) {
			this.isSidebarCollapsed.set(false);
			this.isMaestrosOpen.set(true);
			return;
		}
		this.isMaestrosOpen.update((abierto) => !abierto);
	}

	protected toggleMaestrosMobile() {
		this.isMaestrosOpen.update((abierto) => !abierto);
	}

	protected toggleMobileMenu() {
		this.isMobileMenuOpen.update((abierto) => !abierto);
	}

	protected toggleSidebar() {
		this.isSidebarCollapsed.update((colapsado) => !colapsado);
	}

	protected logout() {
		void this.authService.cerrarSesion();
	}
}
