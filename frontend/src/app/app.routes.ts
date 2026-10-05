import type { Routes } from "@angular/router";

import { authGuard } from "./core/auth/auth.guard";

export const routes: Routes = [
	{
		path: "login",
		loadComponent: () =>
			import("./features/auth/login/login.component").then(
				(c) => c.LoginComponent,
			),
	},
	{
		path: "",
		canActivate: [authGuard],
		loadComponent: () =>
			import("./core/layout/layout.component").then((c) => c.LayoutComponent),
		children: [
			{
				path: "dashboard",
				loadComponent: () =>
					import("./features/dashboard/dashboard.component").then(
						(c) => c.DashboardComponent,
					),
			},
			{
				path: "productos",
				loadComponent: () =>
					import("./features/productos/productos.component").then(
						(c) => c.ProductosComponent,
					),
			},
			{
				path: "movimientos",
				loadComponent: () =>
					import("./features/movimientos/movimientos.component").then(
						(c) => c.MovimientosComponent,
					),
			},
			{
				path: "ordenes/nueva",
				data: { modo: "editor" },
				loadComponent: () =>
					import("./features/ordenes/ordenes.component").then(
						(c) => c.OrdenesComponent,
					),
			},
			{
				path: "ordenes/ejemplo",
				data: { modo: "ejemplo" },
				loadComponent: () =>
					import("./features/ordenes/ordenes.component").then(
						(c) => c.OrdenesComponent,
					),
			},
			{
				path: "ordenes/:id/editar",
				data: { modo: "editor" },
				loadComponent: () =>
					import("./features/ordenes/ordenes.component").then(
						(c) => c.OrdenesComponent,
					),
			},
			{
				path: "ordenes/:id",
				data: { modo: "detalle" },
				loadComponent: () =>
					import("./features/ordenes/ordenes.component").then(
						(c) => c.OrdenesComponent,
					),
			},
			{
				path: "ordenes",
				data: { modo: "lista" },
				loadComponent: () =>
					import("./features/ordenes/ordenes.component").then(
						(c) => c.OrdenesComponent,
					),
			},
			{
				path: "usuarios",
				loadComponent: () =>
					import("./features/usuarios/usuarios.component").then(
						(c) => c.UsuariosComponent,
					),
			},
			{
				path: "maestros",
				loadComponent: () =>
					import("./features/maestros/maestros.component").then(
						(c) => c.MaestrosComponent,
					),
				children: [
					{
						path: "almacenes",
						loadComponent: () =>
							import("./features/maestros/almacenes/almacenes.component").then(
								(c) => c.AlmacenesComponent,
							),
					},
					{
						path: "proveedores",
						loadComponent: () =>
							import(
								"./features/maestros/proveedores/proveedores.component"
							).then((c) => c.ProveedoresComponent),
					},
					{
						path: "empresa",
						loadComponent: () =>
							import("./features/maestros/empresa/empresa.component").then(
								(c) => c.EmpresaComponent,
							),
					},
					{ path: "", redirectTo: "almacenes", pathMatch: "full" },
				],
			},
			{
				path: "kardex",
				loadComponent: () =>
					import("./features/kardex/kardex.component").then(
						(c) => c.KardexComponent,
					),
			},
			{
				path: "toma-fisica",
				loadComponent: () =>
					import("./features/toma-fisica/toma-fisica-lista.component").then(
						(c) => c.TomaFisicaListaComponent,
					),
			},
			{
				path: "toma-fisica/:id",
				loadComponent: () =>
					import("./features/toma-fisica/toma-fisica-detalle.component").then(
						(c) => c.TomaFisicaDetalleComponent,
					),
			},
			{
				path: "guias-remision",
				loadComponent: () =>
					import("./features/guias-remision/guias-remision.component").then(
						(c) => c.GuiasRemisionComponent,
					),
			},
			{ path: "", redirectTo: "dashboard", pathMatch: "full" },
		],
	},
	{ path: "**", redirectTo: "dashboard" },
];
