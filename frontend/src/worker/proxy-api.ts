export interface EntornoProxy {
	BACKEND_URL: string;
	PROXY_SECRET: string;
}

type InicioConCuerpo = RequestInit & { duplex?: "half" };

export default {
	async fetch(peticion: Request, entorno: EntornoProxy): Promise<Response> {
		if (!entorno.PROXY_SECRET) {
			return Response.json(
				{ status: "error", message: "Proxy sin configurar" },
				{ status: 500 },
			);
		}

		const url = new URL(peticion.url);
		const destino = new URL(url.pathname + url.search, entorno.BACKEND_URL);
		const cabeceras = new Headers(peticion.headers);

		cabeceras.delete("X-Forwarded-For");
		cabeceras.delete("X-StockMaster-IP");
		const ip = peticion.headers.get("CF-Connecting-IP");
		if (ip) cabeceras.set("X-StockMaster-IP", ip);
		cabeceras.set("X-StockMaster-Proxy", entorno.PROXY_SECRET);

		const inicio: InicioConCuerpo = {
			method: peticion.method,
			headers: cabeceras,
			redirect: "manual",
		};
		if (peticion.body) {
			inicio.body = peticion.body;
			inicio.duplex = "half";
		}
		return fetch(destino, inicio);
	},
};
