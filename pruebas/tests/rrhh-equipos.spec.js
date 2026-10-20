// Fichar desde la computadora del escritorio (sin GPS): solo desde un equipo
// aprobado por RR.HH. Base simulada con rutas (nunca la real).
import { test, expect } from "@playwright/test";

async function fichaje(page, estadoEquipo) {
  const llamadas = [];
  await page.addInitScript(() => { window.__gps = 0; Object.defineProperty(navigator, "geolocation", { configurable: true, value: { getCurrentPosition: (ok, err) => { window.__gps++; err && err({ code: 1 }); } } }); });
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    const fn = url.pathname.replace("/rest/v1/rpc/", "");
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const body = JSON.parse(req.postData() || "{}");
      llamadas.push([fn, body]);
      if (fn === "login_empleado") return json({ ok: true, empleado: { legajo: 469, nombre: "Ariana", apellido: "Maldonado", horario_id: null, locales_asignados: [] }, fichajes_hoy: [] });
      if (fn === "mi_equipo") return json(estadoEquipo === "gps" ? { ok: true, modo: "gps" } : { ok: true, modo: "pc", estado: estadoEquipo, local_id: "of", local_nombre: "Oficina central" });
      if (fn === "registrar_fichaje") return json({ ok: true });
      if (fn === "mi_historial") return json({ ok: true, fichajes: [] });
      return json({ ok: true });
    }
    return json([]);
  });
  await page.goto("/fichaje/");
  await page.getByPlaceholder("Legajo").fill("469");
  await page.getByPlaceholder("PIN").first().fill("1234");
  await page.getByPlaceholder("PIN").first().press("Enter");
  return llamadas;
}

test("computadora pendiente: no deja fichar y avisa que espera la aprobación de RR.HH.", async ({ page }) => {
  const llamadas = await fichaje(page, "pendiente");
  await expect(page.getByText("esperando que RR.HH. la apruebe")).toBeVisible();
  await expect(page.getByRole("button", { name: "FICHAR ENTRADA" })).toBeDisabled();
  const eq = llamadas.find((x) => x[0] === "mi_equipo")[1];
  expect(eq).toMatchObject({ p_legajo: 469, p_pin: "1234" });
  expect(eq.p_device_id).toBeTruthy();
});

test("computadora aprobada: ficha sin GPS y con la ubicación de la computadora", async ({ page }) => {
  const llamadas = await fichaje(page, "aprobado");
  await expect(page.getByText("Fichás desde tu computadora · Oficina central")).toBeVisible();
  await page.getByRole("button", { name: "FICHAR ENTRADA" }).click();
  await expect(page.getByText(/Entrada registrada/)).toBeVisible();
  const f = llamadas.find((x) => x[0] === "registrar_fichaje")[1].p_data;
  expect(f).toMatchObject({ tipo: "entrada", local_id: "of", lat: null, lng: null });
  expect(f.device_id).toBe(llamadas.find((x) => x[0] === "mi_equipo")[1].p_device_id);
  expect(await page.evaluate(() => window.__gps)).toBe(0);   // no se pidió la ubicación
});

test("otro equipo (rechazado): no deja fichar", async ({ page }) => {
  await fichaje(page, "rechazado");
  await expect(page.getByText("Desde este equipo no podés fichar")).toBeVisible();
  await expect(page.getByRole("button", { name: "FICHAR ENTRADA" })).toBeDisabled();
});

test("RR.HH. aprueba la computadora pendiente desde Dispositivos", async ({ page }) => {
  const patches = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    if (url.pathname === "/rest/v1/equipos_fichaje") {
      if (req.method() === "PATCH") { patches.push([url.search, JSON.parse(req.postData())]); return json([{}]); }
      return json([{ device_id: "abc-123-4567890", legajo: 469, estado: "pendiente", aparato: "Mozilla/5.0 (Windows NT 10.0) Chrome/130", local_id: null, pedido_en: new Date().toISOString() }]);
    }
    if (url.pathname === "/rest/v1/empleados") return json([{ legajo: 469, nombre: "Ariana", apellido: "Maldonado", modo_fichaje: "pc" }]);
    if (url.pathname === "/rest/v1/locales") return json([{ id: "of", nombre: "Oficina central" }]);
    return json([]);
  });
  await page.addInitScript(() => {
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: /Reportes y control/ }).click();
  await page.getByRole("button", { name: "Dispositivos", exact: true }).click();
  const fila = page.locator('[data-equipos="pendientes"] > div').first();
  await expect(fila).toContainText("Maldonado, Ariana");
  await fila.locator("select").selectOption("of");
  await fila.getByRole("button", { name: "Aprobar" }).click();
  await expect.poll(() => patches.length).toBe(1);
  expect(patches[0][0]).toContain("legajo=eq.469");
  expect(patches[0][1]).toMatchObject({ estado: "aprobado", local_id: "of", resuelto_por: "rrhh@anafer.test" });
});
