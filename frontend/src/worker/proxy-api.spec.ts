import proxyApi, { type EntornoProxy } from "./proxy-api";

const ENTORNO: EntornoProxy = {
	BACKEND_URL: "https://stockmaster-api.onrender.com",
	PROXY_SECRET: "secreto-de-pruebas-0123456789-abcdefghij",
};

function ultimaLlamada(espia: ReturnType<typeof vi.fn>): Request {
	const [url, opciones] = espia.mock.calls.at(-1) as [URL, RequestInit];
	return new Request(url, opciones);
}

describe("proxyApi (el Worker que reenvía /api a Render)", () => {
	let espia: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		espia = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
		vi.stubGlobal("fetch", espia);
	});

	afterEach(() => vi.unstubAllGlobals());

	it("reenvía método, ruta con query, cuerpo, cookies y la cabecera del XSRF", async () => {
		const peticion = new Request(
			"https://stockmaster.workers.dev/api/movimientos?page=2",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Cookie: "access_token_cookie=abc",
					"X-CSRF-TOKEN": "xyz",
				},
				body: JSON.stringify({ nota: "ñandú" }),
			},
		);

		await proxyApi.fetch(peticion, ENTORNO);

		const enviada = ultimaLlamada(espia);
		expect(enviada.url).toBe(
			"https://stockmaster-api.onrender.com/api/movimientos?page=2",
		);
		expect(enviada.method).toBe("POST");
		expect(enviada.headers.get("Cookie")).toBe("access_token_cookie=abc");
		expect(enviada.headers.get("X-CSRF-TOKEN")).toBe("xyz");
		expect(await enviada.text()).toBe('{"nota":"ñandú"}');
		expect(espia.mock.calls.at(-1)?.[1]).toMatchObject({ redirect: "manual" });
	});

	it("firma la IP de Cloudflare y pisa la que invente el cliente", async () => {
		const peticion = new Request(
			"https://stockmaster.workers.dev/api/auth/login",
			{
				headers: {
					"CF-Connecting-IP": "203.0.113.7",
					"X-StockMaster-IP": "6.6.6.6",
					"X-StockMaster-Proxy": "secreto-inventado",
				},
			},
		);

		await proxyApi.fetch(peticion, ENTORNO);

		const enviada = ultimaLlamada(espia);
		expect(enviada.headers.get("X-StockMaster-IP")).toBe("203.0.113.7");
		expect(enviada.headers.get("X-StockMaster-Proxy")).toBe(
			ENTORNO.PROXY_SECRET,
		);
	});

	it("sin CF-Connecting-IP no manda IP, y borra el X-Forwarded-For del cliente", async () => {
		const peticion = new Request(
			"https://stockmaster.workers.dev/api/productos",
			{
				headers: {
					"X-StockMaster-IP": "6.6.6.6",
					"X-Forwarded-For": "7.7.7.7",
				},
			},
		);

		await proxyApi.fetch(peticion, ENTORNO);

		const enviada = ultimaLlamada(espia);
		expect(enviada.headers.has("X-StockMaster-IP")).toBe(false);
		expect(enviada.headers.has("X-Forwarded-For")).toBe(false);
	});

	it("devuelve la respuesta de Render tal cual, con todas sus Set-Cookie", async () => {
		const cabeceras = new Headers();
		cabeceras.append("Set-Cookie", "access_token_cookie=a; Path=/; HttpOnly");
		cabeceras.append(
			"Set-Cookie",
			"refresh_token_cookie=b; Path=/api/auth/refresh; HttpOnly",
		);
		const deRender = new Response('{"status":"success"}', {
			status: 201,
			headers: cabeceras,
		});
		espia.mockResolvedValue(deRender);

		const respuesta = await proxyApi.fetch(
			new Request("https://stockmaster.workers.dev/api/auth/login", {
				method: "POST",
			}),
			ENTORNO,
		);

		expect(respuesta).toBe(deRender);
		expect(respuesta.headers.getSetCookie()).toHaveLength(2);
	});

	it("sin secreto configurado no reenvía nada: responde 500", async () => {
		const respuesta = await proxyApi.fetch(
			new Request("https://stockmaster.workers.dev/api/productos"),
			{ ...ENTORNO, PROXY_SECRET: "" },
		);

		expect(respuesta.status).toBe(500);
		expect(await respuesta.json()).toEqual({
			status: "error",
			message: "Proxy sin configurar",
		});
		expect(espia).not.toHaveBeenCalled();
	});
});
