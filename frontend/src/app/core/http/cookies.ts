export function leerCookie(nombre: string): string | null {
	for (const parte of document.cookie.split(";")) {
		const [clave, ...valor] = parte.trim().split("=");
		if (clave === nombre) return decodeURIComponent(valor.join("="));
	}
	return null;
}
