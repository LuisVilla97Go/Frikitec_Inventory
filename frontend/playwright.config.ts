import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import { defineConfig } from "@playwright/test";

import { SESION_ADMIN } from "./e2e/datos";

const RAIZ = resolve(__dirname, "..");
const BACKEND = join(RAIZ, "backend");

const PYTHON = [
	join(BACKEND, ".venv", "Scripts", "python.exe"),
	join(BACKEND, ".venv", "bin", "python"),
].find((p) => existsSync(p));
if (!PYTHON)
	throw new Error(
		"Falta backend/.venv (puerta-de-calidad.md, «Preparar el entorno»).",
	);

function sufijoPropio(python: string): string | null {
	const env = Object.fromEntries(
		Object.entries(process.env).filter(([k]) => !k.startsWith("GIT_")),
	);
	const sufijo = execFileSync(
		python,
		[join(BACKEND, "tests", "bd_de_pruebas.py")],
		{ cwd: BACKEND, env, encoding: "utf-8" },
	).trim();
	return sufijo || null;
}

const PROPIO = sufijoPropio(PYTHON);

function urlE2e(): string {
	if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
	let prueba = process.env.TEST_DATABASE_URL;
	const env = join(RAIZ, ".env");
	if (!prueba && existsSync(env)) {
		prueba = readFileSync(env, "utf-8").match(/^TEST_DATABASE_URL=(\S+)/m)?.[1];
	}
	if (!prueba?.endsWith("_test")) {
		throw new Error(
			"Falta TEST_DATABASE_URL (…/stockmaster_test) en el entorno o en el .env de la raíz: " +
			"de ahí sale la BD de E2E (…/stockmaster_e2e).",
		);
	}
	return `${prueba.slice(0, -"_test".length)}${PROPIO ? `_${PROPIO}` : ""}_e2e`;
}

const E2E_DATABASE_URL = urlE2e();

const DESFASE = PROPIO ? Number.parseInt(PROPIO.slice(-4), 16) % 500 : 0;
const PUERTO_API = Number(
	process.env.E2E_PUERTO_API ?? (PROPIO ? 5100 + DESFASE : 5001),
);
const PUERTO_WEB = Number(
	process.env.E2E_PUERTO_WEB ?? (PROPIO ? 4400 + DESFASE : 4300),
);
if (!/\/\w+_e2e$/.test(E2E_DATABASE_URL)) {
	throw new Error("La BD de E2E debe terminar en _e2e.");
}

export default defineConfig({
	testDir: "e2e",
	outputDir: "test-results",
	projects: [
		{ name: "sesion", testMatch: "*.setup.ts" },
		{
			name: "e2e",
			testMatch: "*.e2e.ts",
			dependencies: ["sesion"],
			use: { storageState: SESION_ADMIN },
		},
	],
	workers: 1,
	fullyParallel: false,
	forbidOnly: true,
	retries: 0,
	reporter: [["list"]],
	timeout: 30_000,
	expect: { timeout: 10_000 },
	use: {
		baseURL: `http://localhost:${PUERTO_WEB}`,
		channel: process.env.E2E_CANAL ?? "msedge",
		screenshot: "only-on-failure",
		trace: "retain-on-failure",
	},
	webServer: [
		{
			command: `"${PYTHON}" scripts/preparar_e2e.py && "${PYTHON}" -m flask --app wsgi run --port ${PUERTO_API}`,
			cwd: BACKEND,
			url: `http://127.0.0.1:${PUERTO_API}/health`,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				APP_CONFIG: "development",
				DATABASE_URL: E2E_DATABASE_URL,
				E2E_DATABASE_URL,
				SECRET_KEY: randomUUID(),
				JWT_SECRET_KEY: randomUUID(),
				CORS_ORIGINS: `http://localhost:${PUERTO_WEB}`,
			},
		},
		{
			command: `pnpm exec ng serve --port ${PUERTO_WEB} --proxy-config proxy.e2e.conf.mjs`,
			url: `http://localhost:${PUERTO_WEB}`,
			reuseExistingServer: false,
			timeout: 180_000,
			env: { E2E_PUERTO_API: String(PUERTO_API) },
		},
	],
});
