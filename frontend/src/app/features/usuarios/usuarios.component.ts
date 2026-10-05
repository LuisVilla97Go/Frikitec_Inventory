import { NgOptimizedImage } from "@angular/common";
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	signal,
} from "@angular/core";
import {
	LucideDynamicIcon,
	LucideShield as Shield,
	LucideUserPlus as UserPlus,
} from "@lucide/angular";
import {
	injectMutation,
	injectQuery,
	keepPreviousData,
	QueryClient,
} from "@tanstack/angular-query-experimental";

import { AuthService } from "../../core/auth/auth.service";
import { ApiClient, mensajeDeError } from "../../core/http/api-client";
import { claves } from "../../core/http/claves";
import { paginaUsuarios } from "../../core/http/queries/consultas";
import { ROLES } from "../../shared/catalogos/usuarios";
import { DialogoConfirmacionComponent } from "../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component";
import {
	PaginadorComponent,
	TamanosDePagina,
} from "../../shared/components/paginador/paginador.component";
import { ConDatos, Usuario } from "../../shared/schemas/api.schema";
import { UsuarioFormComponent } from "./components/usuario-form/usuario-form.component";

@Component({
	selector: "app-usuarios",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		LucideDynamicIcon,
		NgOptimizedImage,
		DialogoConfirmacionComponent,
		UsuarioFormComponent,
		PaginadorComponent,
	],
	templateUrl: "./usuarios.component.html",
})
export class UsuariosComponent {
	private readonly api = inject(ApiClient);
	private readonly queryClient = inject(QueryClient);
	private readonly auth = inject(AuthService);

	protected readonly icons = { UserPlus, Shield };
	protected readonly roles = ROLES;

	protected readonly pagina = signal(1);
	protected readonly porPagina = inject(TamanosDePagina).de("usuarios");
	protected readonly usuariosQuery = injectQuery(() => ({
		...paginaUsuarios(this.api, this.pagina(), this.porPagina()),
		placeholderData: keepPreviousData,
	}));

	protected readonly esAdmin = computed(
		() => this.auth.usuario()?.is_admin ?? false,
	);
	private readonly miId = computed(() => this.auth.usuario()?.id);

	protected readonly formularioAbierto = signal(false);
	protected readonly aEditar = signal<Usuario | null>(null);

	protected readonly aCambiar = signal<Usuario | null>(null);
	protected readonly errorEstado = signal("");

	protected readonly estadoMutation = injectMutation(() => ({
		mutationFn: (usuario: Usuario) =>
			this.api.patch(
				`/api/usuarios/${encodeURIComponent(usuario.id)}/estado`,
				{ is_active: !usuario.is_active },
				ConDatos(Usuario),
			),
		onSuccess: () => {
			void this.queryClient.invalidateQueries({
				queryKey: claves.usuarios.todo,
			});
			this.aCambiar.set(null);
		},
		onError: (error: unknown) => {
			this.aCambiar.set(null);
			this.errorEstado.set(
				mensajeDeError(error, "No se pudo cambiar el estado del usuario."),
			);
		},
	}));

	protected puedeGestionar(usuario: Usuario): boolean {
		if (!this.esAdmin()) return false;
		return (
			usuario.rol !== "SUPERADMIN" || this.auth.usuario()?.rol === "SUPERADMIN"
		);
	}

	protected esYo(usuario: Usuario): boolean {
		return usuario.id === this.miId();
	}

	protected abrirNuevo() {
		this.aEditar.set(null);
		this.formularioAbierto.set(true);
	}

	protected abrirEdicion(usuario: Usuario) {
		this.aEditar.set(usuario);
		this.formularioAbierto.set(true);
	}

	protected cerrarFormulario() {
		this.formularioAbierto.set(false);
		this.aEditar.set(null);
	}

	protected pedirCambioDeEstado(usuario: Usuario) {
		this.errorEstado.set("");
		this.aCambiar.set(usuario);
	}

	protected mensajeCambio(usuario: Usuario): string {
		const nombre = `${usuario.nombres} ${usuario.apellidos}`;
		return usuario.is_active
			? `${nombre} no podrá iniciar sesión. Sus movimientos del Kardex se conservan.`
			: `${nombre} podrá volver a iniciar sesión.`;
	}

	protected cambiarPorPagina(tamano: number) {
		this.porPagina.set(tamano);
		this.pagina.set(1);
	}
}
