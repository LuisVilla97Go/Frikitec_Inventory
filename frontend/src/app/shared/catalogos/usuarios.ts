export const ROLES = {
	SUPERADMIN: "Super administrador",
	ADMIN: "Administrador",
	TRABAJADOR: "Trabajador",
} as const satisfies Record<string, string>;

export type Rol = keyof typeof ROLES;

export const LISTA_ROLES = Object.keys(ROLES) as [Rol, ...Rol[]];

export const CLAVE_MINIMA = 8;
