// Vencimientos de documentos del legajo y licencias con certificado.
import { test, expect } from "@playwright/test";
import { analizarVencimientos, requisitosDe, licenciasSinCertificado } from "../../rrhh/src/admin/vencimientos.js";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const enDias = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };

const EMPS = [
  { legajo: 10, apellido: "Gómez", nombre: "Raúl", sector: "Logística", activo: true },
  { legajo: 11, apellido: "Paz", nombre: "Ana", sector: "Producción", activo: true },
  { legajo: 12, apellido: "Ruiz", nombre: "Leo", sector: "Logistica", activo: false },
];
const REQS = [
  { sector: "Logística", tipo: "Licencia de conducir", dias_aviso: 30 },
  { sector: "Logística", tipo: "Psicofísico / LINTI", dias_aviso: 45 },
  { sector: "", tipo: "Credencial ART", dias_aviso: 30 },
];

test("lógica: vencidos, por vencer (con el aviso del sector), renovados y faltantes", () => {
  const hoy = "2026-10-20";
  const docs = [
    { id: "a", legajo: 10, tipo: "Licencia de conducir", vencimiento: "2026-10-01" },   // vieja…
    { id: "b", legajo: 10, tipo: "Licencia de conducir", vencimiento: "2031-10-01" },   // …renovada: no avisa
    { id: "c", legajo: 10, tipo: "Psicofísico / LINTI", vencimiento: "2026-11-30" },    // 41 días, aviso 45 → por vencer
    { id: "d", legajo: 11, tipo: "Credencial ART", vencimiento: "2026-10-15" },         // vencida
    { id: "e", legajo: 11, tipo: "Carnet de manipulador de alimentos / libreta sanitaria", vencimiento: "2026-12-30" }, // 71 días: no
    { id: "f", legajo: 12, tipo: "Credencial ART", vencimiento: "2020-01-01" },         // inactivo: no cuenta
  ];
  const r = analizarVencimientos({ empleados: EMPS, docs, requeridos: REQS, hoy });
  expect(r.vencidos.map((x) => [x.empleado.legajo, x.tipo, x.dias])).toEqual([[11, "Credencial ART", -5]]);
  expect(r.porVencer.map((x) => [x.empleado.legajo, x.tipo, x.dias])).toEqual([[10, "Psicofísico / LINTI", 41]]);
  expect(r.faltantes.map((x) => [x.empleado.legajo, x.tipo])).toEqual([[10, "Credencial ART"]]);
  // el sector se compara sin acentos ni mayúsculas
  expect(requisitosDe("LOGISTICA", REQS).map((x) => x.tipo).sort()).toEqual(["Credencial ART", "Licencia de conducir", "Psicofísico / LINTI"]);
  expect(licenciasSinCertificado([
    { tipo: "enfermedad", estado: "aprobada" }, { tipo: "enfermedad", estado: "rechazada" },
    { tipo: "licencia", estado: "pendiente", certificado_path: "certificados/1/x.jpg" }, { tipo: "dia_libre", estado: "aprobada" },
  ])).toHaveLength(1);
});

test("empleado: pide licencia por enfermedad con la foto del certificado y sube otro después", async ({ page }) => {
  const llamadas = [], subidas = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname.startsWith("/storage/v1/object/legajos/")) { subidas.push([decodeURIComponent(url.pathname.replace("/storage/v1/object/legajos/", "")), req.headers()["content-type"]]); return json({ Key: "ok" }); }
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.replace("/rest/v1/rpc/", ""), body = JSON.parse(req.postData() || "{}");
      llamadas.push([fn, body]);
      if (fn === "login_empleado") return json({ ok: true, empleado: { legajo: 441, nombre: "Johana", apellido: "Ainol", horario_id: null, locales_asignados: [] }, fichajes_hoy: [] });
      if (fn === "mi_equipo") return json({ ok: true, modo: "gps" });
      if (fn === "mis_solicitudes") return json({ ok: true, solicitudes: [
        { id: "aaaaaaaa-0000-0000-0000-000000000001", tipo: "enfermedad", fecha_desde: "2026-10-01", fecha_hasta: "2026-10-02", estado: "aprobada", tiene_certificado: false },
        { id: "aaaaaaaa-0000-0000-0000-000000000002", tipo: "licencia", fecha_desde: "2026-09-01", fecha_hasta: "2026-09-01", estado: "aprobada", tiene_certificado: true },
      ] });
      if (fn === "mis_vacaciones") return json({ ok: true, saldos: [] });
      if (fn === "crear_licencia") return json({ ok: true, id: "bbbbbbbb-1111-0000-0000-000000000009" });
      return json({ ok: true });
    }
    return json([]);
  });
  await page.goto("/fichaje/");
  await page.getByPlaceholder("Legajo").fill("441");
  await page.getByPlaceholder("PIN").first().fill("1234");
  await page.getByPlaceholder("PIN").first().press("Enter");
  await page.getByRole("button", { name: /Vacaciones y ausencias/ }).click();
  await expect(page.getByText("📎 Certificado subido")).toBeVisible();
  await page.locator("select").first().selectOption("enfermedad");
  await page.locator('input[type="date"]').nth(0).fill("2026-10-20");
  await page.locator('input[type="date"]').nth(1).fill("2026-10-22");
  await page.locator("[data-certificado] input").setInputFiles({ name: "certificado.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 prueba") });
  await expect(page.locator("[data-certificado]")).toContainText("certificado.pdf");
  await page.getByRole("button", { name: "Enviar solicitud" }).click();
  await expect(page.getByText("Solicitud enviada con el certificado ✓")).toBeVisible();
  expect(llamadas.find((x) => x[0] === "crear_licencia")[1]).toMatchObject({ p_legajo: 441, p_tipo: "enfermedad", p_desde: "2026-10-20", p_hasta: "2026-10-22" });
  expect(subidas[0][0]).toMatch(/^certificados\/441\/\d+-bbbbbbbb\.pdf$/);
  expect(llamadas.find((x) => x[0] === "adjuntar_certificado")[1]).toMatchObject({ p_id: "bbbbbbbb-1111-0000-0000-000000000009", p_path: subidas[0][0], p_mime: "application/pdf" });
  // la licencia vieja sin certificado: se sube desde la lista
  await page.locator("[data-subir-cert] input").first().setInputFiles({ name: "cert2.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 dos") });
  await expect(page.getByText("Certificado subido ✓")).toBeVisible();
  const ult = llamadas.filter((x) => x[0] === "adjuntar_certificado").pop()[1];
  expect(ult.p_id).toBe("aaaaaaaa-0000-0000-0000-000000000001");
  expect(ult.p_path).toMatch(/^certificados\/441\//);
});

test("RR.HH.: tablero de vencimientos, obligatorios por sector y licencias sin certificado", async ({ page }) => {
  const upserts = [];
  let reqs = [{ sector: "Logística", tipo: "Licencia de conducir", dias_aviso: 30 }];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    if (url.pathname === "/rest/v1/empleados") return json(EMPS);
    if (url.pathname === "/rest/v1/sectores") return json([{ nombre: "Logística" }, { nombre: "Producción" }]);
    if (url.pathname === "/rest/v1/empleado_documentos") return json([
      { id: "d1", legajo: 10, tipo: "Licencia de conducir", nombre_archivo: "lic.jpg", path: "10/x.jpg", vencimiento: enDias(-3), created_at: "2026-01-01T00:00:00Z" },
      { id: "d2", legajo: 11, tipo: "Credencial ART", nombre_archivo: "art.jpg", path: "11/x.jpg", vencimiento: enDias(10), created_at: "2026-01-01T00:00:00Z" },
    ]);
    if (url.pathname === "/rest/v1/documentos_requeridos") {
      if (req.method() === "POST") { const f = JSON.parse(req.postData()); upserts.push([url.search, f]); reqs = [...reqs, ...f]; return json(f); }
      return json(reqs);
    }
    if (url.pathname === "/rest/v1/solicitudes") return json([
      { id: "s1", legajo: 11, tipo: "enfermedad", fecha_desde: "2026-10-05", fecha_hasta: "2026-10-06", estado: "aprobada", certificado_path: null, creado_en: "2026-10-05T10:00:00Z" },
      { id: "s2", legajo: 10, tipo: "licencia", fecha_desde: "2026-09-05", fecha_hasta: "2026-09-05", estado: "aprobada", certificado_path: "certificados/10/c.jpg", creado_en: "2026-09-05T10:00:00Z" },
    ]);
    return json([]);
  });
  await page.addInitScript(() => {
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: /Personal/ }).click();
  await page.getByRole("button", { name: "Vencimientos", exact: true }).click();
  const lista = page.locator("[data-lista-venc]");
  await expect(lista.locator('[data-legajo="10"][data-estado="vencido"]')).toContainText("Venció hace 3 d");
  await expect(lista.locator('[data-legajo="11"][data-estado="por-vencer"]')).toContainText("Vence en 10 d");
  await expect(lista.locator('[data-legajo="11"]')).toContainText("no obligatorio en su sector");
  await page.locator('[data-ver="licencias"]').click();
  await expect(page.locator("[data-lista-lic]")).toContainText("Paz, Ana");
  await expect(page.locator('[data-lista-lic] [data-legajo="10"]')).toHaveCount(0);
  // obligatorios: agrego ART para todos → Gómez (Logística) pasa a faltarle
  await page.locator('[data-ver="requisitos"]').click();
  await page.locator("[data-nuevo-req] select").nth(1).selectOption("Credencial ART");
  await page.getByRole("button", { name: "+ Agregar" }).click();
  await expect(page.locator("[data-reqs]")).toContainText("Credencial ART");
  expect(upserts[0][0]).toContain("on_conflict=sector,tipo");
  expect(upserts[0][1]).toEqual([{ sector: "", tipo: "Credencial ART", dias_aviso: 30 }]);
  await page.locator('[data-ver="faltantes"]').click();
  await expect(page.locator('[data-lista-faltan] [data-legajo="10"]')).toContainText("Falta: Credencial ART");
  await expect(page.locator('[data-lista-faltan] [data-legajo="12"]')).toHaveCount(0); // inactivo
  // la ficha se abre en Documentos
  await page.locator('[data-lista-faltan] [data-legajo="10"]').getByRole("button", { name: "Abrir ficha" }).click();
  await expect(page.getByText("lic.jpg")).toBeVisible();
  await page.keyboard.press("Escape");
  // Ausencias: badge de certificado faltante
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: /Asistencia/ }).click();
  await page.getByRole("button", { name: "Ausencias", exact: true }).click();
  await page.getByRole("button", { name: /Sin certificado/ }).click();
  await expect(page.locator("[data-falta-cert]")).toHaveCount(1);
});
