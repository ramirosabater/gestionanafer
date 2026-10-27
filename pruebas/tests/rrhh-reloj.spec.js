// Importar reloj: acepta el reporte del ZKTeco (hoja Registros) y la planilla de E-S, y une las
// marcas del mismo legajo cuando la persona fichó en los dos relojes (entra en uno, sale en el otro).
// Datos inventados: nada de fichadas reales en las pruebas.
import { test, expect } from "@playwright/test";
import { createRequire } from "node:module";
import { parsearPlanillaES, unirLecturas, asignarTipos, minutosHora, leerArchivoReloj } from "../../rrhh/src/admin/importar-reloj.js";

const XLSX = createRequire(new URL("../../rrhh/package.json", import.meta.url))("xlsx");

function libroZK() {
  const dias = Array.from({ length: 31 }, (_, i) => i + 1);
  const fila = (no, nombre, marcas) => [no, nombre, "", ...dias.map((d) => marcas[d] || "")];
  const rows = [
    ["Lista de Registros"],
    ["Periodo:", "", "01/08/2026 ~ 31/08/2026\t("],
    ["No", "Nombre", "Depto", ...dias],
    ["", "", "", ...dias.map(() => "")],
    fila(105, "perezj", { 3: "19:52\n", 5: "08:11\n17:02\n" }),
    fila(200, "gomez", { 4: "07:58\n16:01\n" }),
    fila(201, "vacio", {}),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Resumen"]]), "Sumario");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Registros");
  return XLSX.write(wb, { type: "buffer", bookType: "xls" });
}
function filasPlanilla() {
  const d = (dia) => Date.UTC(2026, 7, dia) / 864e5 + 25569; // número de serie de Excel
  return [
    [null, null, "Fecha:  26/10/2026"],
    [],
    [null, "PLANILLA DE E-S"],
    [],
    ["LEG", "NOMBRE", "CCOS", "DET.COSTO", "LIQ.HS.", "FECHA", "HORA 1", "HORA 2", "HORA 3", "HORA 4", "HORA 5", "HORA 6", "TOMA HS.REF", "TOTAL"],
    [105, "PEREZ, JUAN       ", 6, "CHOFERES", "NO", d(3), 8.17, null, null, null, null, null, "NO", null],
    [105, "PEREZ, JUAN       ", 6, "CHOFERES", "NO", d(4), 8.2, 13.1, null, null, null, null, "NO", 4.83],
    [300, "NOCHE, ANA", 6, "CHOFERES", "NO", d(6), 22.1, 6.05, null, null, null, null, "NO", 7.92],
  ];
}
function libroPlanilla() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filasPlanilla()), "PLANILLA DE E-S");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
}
const comoFile = (name, buf) => ({ name, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length) });

test("lógica: horas hh.mm de la planilla, turno nocturno y unión de los dos relojes", async () => {
  expect([8.17, 8.2, 13.1, 13, "8:05", "08.17", "8.2", 0.5, 8.75, "x"].map(minutosHora))
    .toEqual([497, 500, 790, 780, 485, 497, 500, 50, null, null]);
  const pl = parsearPlanillaES(filasPlanilla());
  expect(pl.formato).toBe("Planilla de E-S");
  expect([pl.desde, pl.hasta]).toEqual(["2026-08-03", "2026-08-06"]);
  const noche = pl.empleados.find((e) => e.legajo === 300);
  expect(noche.marcas.map((m) => `${m.fecha} ${m.hora}`)).toEqual(["2026-08-06 22:10", "2026-08-07 06:05"]);

  const zk = await leerArchivoReloj(comoFile("Sumario.xls", libroZK()));
  const pl2 = await leerArchivoReloj(comoFile("planilla.xlsx", libroPlanilla()));
  expect(zk.formato).toContain("ZKTeco");
  expect(pl2.empleados.map((e) => e.legajo)).toEqual([105, 300]);
  expect(zk.empleados.map((e) => e.legajo)).toEqual([105, 200]);   // el 201 no tiene marcas

  const u = unirLecturas([zk, pl2, pl2]);                              // el mismo archivo dos veces no duplica
  expect([u.desde, u.hasta]).toEqual(["2026-08-01", "2026-08-31"]);
  const perez = u.empleados.find((e) => e.legajo === 105);
  expect(perez.nombreReloj).toBe("perezj / PEREZ, JUAN");
  const tipos = asignarTipos(perez.marcas).map((m) => `${m.fecha} ${m.hora} ${m.tipo} ${m.origen}`);
  expect(tipos).toEqual([
    "2026-08-03 08:17 entrada 1",   // entra en el reloj de la planilla…
    "2026-08-03 19:52 salida 0",    // …y sale en el ZKTeco
    "2026-08-04 08:20 entrada 1",
    "2026-08-04 13:10 salida 1",
    "2026-08-05 08:11 entrada 0",
    "2026-08-05 17:02 salida 0",
  ]);
});

test("RR.HH.: sube los dos archivos juntos, ve las marcas unidas y las importa con el reloj de cada una", async ({ page }) => {
  const posts = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    if (url.pathname === "/rest/v1/locales") return json([{ id: 1, nombre: "Sopladora" }, { id: 2, nombre: "Base camioneros" }]);
    if (url.pathname === "/rest/v1/empleados") return json([
      { legajo: 105, apellido: "Pérez", nombre: "Juan", horario_id: null, activo: true },
      { legajo: 200, apellido: "Gómez", nombre: "Luis", horario_id: null, activo: true },
      { legajo: 300, apellido: "Noche", nombre: "Ana", horario_id: null, activo: true },
    ]);
    if (url.pathname === "/rest/v1/fichajes") {
      if (req.method() === "POST") { posts.push(...JSON.parse(req.postData())); return json([]); }
      return json([]);
    }
    return json([]);
  });
  await page.addInitScript(() => {
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  const errores = []; page.on("pageerror", (e) => errores.push(e.message));
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: /Asistencia/ }).click();
  await page.getByRole("button", { name: "Importar reloj", exact: true }).click();

  await page.setInputFiles('input[type="file"]', [
    { name: "Sumario.xls", mimeType: "application/vnd.ms-excel", buffer: libroZK() },
    { name: "planilla-camioneros.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: libroPlanilla() },
  ]);
  const lista = page.locator("[data-archivos]");
  await expect(lista).toContainText("Sumario.xls");
  await expect(lista).toContainText("Reloj ZKTeco");
  await expect(lista).toContainText("planilla-camioneros.xlsx");
  await expect(lista).toContainText("Planilla de E-S");
  // cada archivo con su reloj: el ZKTeco en Sopladora (por defecto), la planilla en la base de camioneros
  await page.getByLabel("Ubicación del reloj de planilla-camioneros.xlsx").selectOption("2");
  await expect(page.getByText("➕ Sumar otro archivo")).toBeVisible();

  // Pérez: el 03/08 entra 08:17 (planilla, B) y sale 19:52 (reloj, A)
  const perez = page.locator("div.bg-white", { hasText: "Pérez, Juan" }).first();
  await perez.getByRole("button", { name: /Pérez, Juan/ }).click();
  const dia3 = perez.locator("div", { hasText: /^Lu 03\/08/ }).first();
  await expect(dia3.getByRole("button", { name: /E 08:17/ })).toContainText("B");
  await expect(dia3.getByRole("button", { name: /S 19:52/ })).toContainText("A");

  page.on("dialog", (d) => d.accept());
  await page.getByRole("button", { name: /^Importar \d+ fichadas$/ }).click();
  await expect.poll(() => posts.length).toBe(10);
  const de = (leg, hora) => posts.find((p) => p.legajo === leg && new Date(p.timestamp).toISOString() === new Date(`${hora}-03:00`).toISOString());
  const ent = de(105, "2026-08-03T08:17:00"), sal = de(105, "2026-08-03T19:52:00");
  expect([ent.tipo, ent.local_id, ent.user_agent]).toEqual(["entrada", "2", "Reloj (importado) · planilla-camioneros.xlsx"]);
  expect([sal.tipo, sal.local_id, sal.user_agent]).toEqual(["salida", "1", "Reloj (importado) · Sumario.xls"]);
  await expect(page.getByText(/se cargaron 10 fichadas/)).toBeVisible();
  expect(errores).toEqual([]);
});
