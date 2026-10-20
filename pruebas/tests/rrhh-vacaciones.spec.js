// Vacaciones: el empleado ve su saldo y pide vacaciones desde el fichaje;
// RR.HH. carga los días del período con la subida anual (legajo, nombre, días).
import { test, expect } from "@playwright/test";

test("empleado: ve su saldo y no puede pedir más días de los que le quedan", async ({ page }) => {
  const llamadas = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.replace("/rest/v1/rpc/", ""), body = JSON.parse(req.postData() || "{}");
      llamadas.push([fn, body]);
      if (fn === "login_empleado") return json({ ok: true, empleado: { legajo: 441, nombre: "Johana", apellido: "Ainol", horario_id: null, locales_asignados: [] }, fichajes_hoy: [] });
      if (fn === "mi_equipo") return json({ ok: true, modo: "gps" });
      if (fn === "mis_solicitudes") return json({ ok: true, solicitudes: [] });
      if (fn === "mis_vacaciones") return json({ ok: true, saldos: [{ periodo: 2026, dias: 14, tomados: 10, pendientes: 0 }] });
      if (fn === "pedir_vacaciones") return json(body.p_hasta > "2026-12-02" ? { ok: false, motivo: "no_alcanza", disponibles: 4, pedidos: 5 } : { ok: true, dias: 2, quedan: 2 });
      return json({ ok: true });
    }
    return json([]);
  });
  await page.goto("/fichaje/");
  await page.getByPlaceholder("Legajo").fill("441");
  await page.getByPlaceholder("PIN").first().fill("1234");
  await page.getByPlaceholder("PIN").first().press("Enter");
  await page.getByRole("button", { name: /Vacaciones y ausencias/ }).click();
  await expect(page.locator("[data-vacaciones]")).toContainText("te quedan 4 de 14 días");
  await page.locator("select").first().selectOption("vacaciones");
  await page.locator('input[type="date"]').nth(0).fill("2026-12-01");
  await page.locator('input[type="date"]').nth(1).fill("2026-12-05");
  await expect(page.locator("[data-cuenta]")).toContainText("Son 5 días corridos y te quedan 4");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("No te alcanzan los días: pediste 5 y te quedan 4.")).toBeVisible();
  await page.locator('input[type="date"]').nth(1).fill("2026-12-02");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("Pediste 2 días de vacaciones. Te quedarían 2.")).toBeVisible();
  const p = llamadas.filter((x) => x[0] === "pedir_vacaciones").pop()[1];
  expect(p).toMatchObject({ p_legajo: 441, p_periodo: 2026, p_desde: "2026-12-01", p_hasta: "2026-12-02" });
});

test("RR.HH.: subida anual de la planilla con legajo, nombre y días", async ({ page }) => {
  const upserts = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    if (url.pathname === "/rest/v1/empleados") return json([
      { legajo: 441, apellido: "Ainol", nombre: "Johana Belén", sector: "Administración", activo: true },
      { legajo: 495, apellido: "Albrecht", nombre: "Silvina", sector: "RRHH", activo: true },
      { legajo: 57, apellido: "Ancapillan", nombre: "José Ricardo", sector: "Calidad", activo: true },
    ]);
    if (url.pathname === "/rest/v1/vacaciones_saldos") {
      if (req.method() === "POST") { upserts.push([url.search, req.headers()["prefer"], JSON.parse(req.postData())]); return json([]); }
      return json([{ legajo: 57, periodo: Number((url.searchParams.get("periodo") || "").replace("eq.", "")), dias: 21 }]);
    }
    if (url.pathname === "/rest/v1/solicitudes") return json([{ id: "s1", legajo: 57, fecha_desde: "2026-11-02", fecha_hasta: "2026-11-08", estado: "aprobada", periodo: 2026 }]);
    return json([]);
  });
  await page.addInitScript(() => {
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: /Asistencia/ }).click();
  await page.getByRole("button", { name: "Vacaciones", exact: true }).click();
  const anio = new Date().getFullYear();
  await expect(page.locator("[data-periodo]")).toHaveText(`Período ${anio}`);
  // saldo existente: 21 días, 7 tomados → le quedan 14
  await expect(page.locator('[data-saldos] tr[data-legajo="57"]')).toContainText("14");
  const csv = "Legajo,Apellido y nombre,Días\n441,AINOL JOHANA BELEN,14\n495,PEREZ MARIA,21\n999,FULANO,10\n57,ANCAPILLAN JOSE,28\n";
  await page.setInputFiles("[data-subir]", { name: "vacaciones.csv", mimeType: "text/csv", buffer: Buffer.from(csv) });
  const prev = page.locator("[data-preview]");
  await expect(prev).toContainText("4 filas");
  await expect(prev.locator('tr[data-estado="ok"]')).toHaveCount(2);
  await expect(prev.locator('tr[data-estado="aviso"]')).toContainText("El nombre no coincide");
  await expect(prev.locator('tr[data-estado="error"]')).toContainText("No hay un empleado con ese legajo");
  await expect(prev).toContainText("(antes 21)");
  page.on("dialog", (d) => d.accept());
  await prev.getByRole("button", { name: `Cargar 3 para el período ${anio}` }).click();
  await expect.poll(() => upserts.length).toBe(1);
  const [q, prefer, filas] = upserts[0];
  expect(q).toContain("on_conflict=legajo,periodo");
  expect(prefer).toContain("merge-duplicates");
  expect(filas.map((f) => [f.legajo, f.periodo, f.dias])).toEqual([[57, anio, 28], [441, anio, 14], [495, anio, 21]]);
  await expect(page.getByText(`se cargaron los días de 3 empleado(s) para el período ${anio}`)).toBeVisible();
});

test("la planilla también puede ser un Excel con título arriba", async () => {
  const XLSX = await import("../../rrhh/node_modules/xlsx/xlsx.mjs");
  const { readFileSync } = await import("node:fs");
  const { leerPlanillaVacaciones } = await import("../../rrhh/src/admin/vacaciones-planilla.js");
  const wb = XLSX.read(readFileSync(new URL("../apoyo/vacaciones-ejemplo.xlsx", import.meta.url)), { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null, blankrows: false });
  expect(leerPlanillaVacaciones(rows).map((r) => [r.legajo, r.nombre, r.dias])).toEqual([[441, "Ainol Johana", 14], [495, "Albrecht Silvina", 21]]);
});

// ---- Panel de RR.HH. con base simulada ----
async function panel(page, rutas) {
  const log = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    if (req.method() !== "GET") { log.push([req.method(), url.pathname, url.search, JSON.parse(req.postData() || "null")]); return json([{ legajo: 1 }]); }
    const k = Object.keys(rutas).find((p) => url.pathname === "/rest/v1/" + p);
    return json(k ? (typeof rutas[k] === "function" ? rutas[k](url) : rutas[k]) : []);
  });
  await page.addInitScript(() => {
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  await page.goto("/fichaje/admin.html");
  return log;
}
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const en = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const EMPS = [
  { legajo: 441, apellido: "Ainol", nombre: "Johana", sector: "Administración", activo: true },
  { legajo: 395, apellido: "Reyes", nombre: "Andrea", sector: "Administración", activo: true, vacaciones_por_app: false },
  { legajo: 461, apellido: "Décima", nombre: "Agostina", sector: "Ventas", activo: true },
  { legajo: 471, apellido: "Pollard", nombre: "Bárbara", sector: "Ventas", activo: true },
];

test("mapa de vacaciones: por sector, quién está de vacaciones hoy y quién pidió", async ({ page }) => {
  await panel(page, {
    empleados: EMPS,
    solicitudes: [
      { id: "a", legajo: 441, fecha_desde: en(-2), fecha_hasta: en(5), estado: "aprobada" },
      { id: "b", legajo: 461, fecha_desde: en(-1), fecha_hasta: en(1), estado: "pendiente" },
      { id: "c", legajo: 471, fecha_desde: en(3), fecha_hasta: en(10), estado: "aprobada" },
    ],
  });
  await page.getByRole("button", { name: "Mapa de vacaciones", exact: true }).click();
  await expect(page.locator("[data-dia]")).toHaveValue(hoyISO());
  await expect(page.locator("[data-kpis]")).toContainText("1 de 4");
  await expect(page.locator('[data-emp="441"]')).toHaveAttribute("data-est", "vac");
  await expect(page.locator('[data-emp="461"]')).toHaveAttribute("data-est", "pend");
  await expect(page.locator('[data-emp="471"]')).toHaveAttribute("data-est", "trab");
  await expect(page.locator('[data-sector="Administración"]')).toBeVisible();
  await expect(page.locator("[data-sectores]")).toContainText("1 de 2 de vacaciones");
  await expect(page.locator("[data-kpis]")).toContainText("Salen en los próximos 7 días1");
  // pasar a dentro de 4 días: Pollard ya salió
  await page.locator("[data-dia]").fill(en(4));
  await expect(page.locator('[data-emp="471"]')).toHaveAttribute("data-est", "vac");
  await expect(page.locator("[data-calendario] [data-celda=aprobada]").first()).toBeVisible();
});

test("ficha: 'pide sus vacaciones por la app' y RR.HH. le carga las vacaciones a quien no las pide", async ({ page }) => {
  const anio = new Date().getFullYear();
  const log = await panel(page, {
    empleados: EMPS,
    vacaciones_saldos: [{ legajo: 395, periodo: anio, dias: 14 }],
    solicitudes: [],
    empleado_documentos: [],
  });
  await page.getByRole("button", { name: /Asistencia/ }).click();
  await page.getByRole("button", { name: "Vacaciones", exact: true }).click();
  const fila = page.locator('[data-saldos] tr[data-legajo="395"]');
  await expect(fila).toContainText("carga RR.HH.");
  await fila.getByRole("button", { name: "+ Cargar vacaciones" }).click();
  await fila.locator('[data-carga] input[type="date"]').nth(0).fill(`${anio}-12-01`);
  await fila.locator('[data-carga] input[type="date"]').nth(1).fill(`${anio}-12-07`);
  await fila.getByRole("button", { name: "OK" }).click();
  await expect.poll(() => log.filter((x) => x[1] === "/rest/v1/solicitudes").length).toBe(1);
  expect(log.find((x) => x[1] === "/rest/v1/solicitudes")[3]).toMatchObject({ legajo: 395, tipo: "vacaciones", estado: "aprobada", periodo: anio, fecha_desde: `${anio}-12-01`, fecha_hasta: `${anio}-12-07` });
  // ficha del empleado: la opción se guarda
  await page.getByRole("button", { name: /Personal/ }).click();
  await page.getByRole("button", { name: "Empleados", exact: true }).click();
  await page.getByRole("button", { name: /Ficha \/ editar/ }).first().click();   // Ainol (la primera de la lista)
  await expect(page.locator("[data-vac-app]")).toBeChecked();
  await page.locator("[data-vac-app]").uncheck();
  await page.getByRole("button", { name: "Guardar ficha" }).click();
  await expect.poll(() => log.filter((x) => x[0] === "PATCH" && x[1] === "/rest/v1/empleados").length).toBe(1);
  expect(log.find((x) => x[0] === "PATCH" && x[1] === "/rest/v1/empleados")[3]).toEqual({ vacaciones_por_app: false });
});
