// RR.HH. → Horarios: el modelo "Camioneros" arma el horario con sus extras
// propias y lo guarda en la base (simulada con rutas, sin base real).
import { test, expect } from "@playwright/test";

async function panelRrhh(page, horarios = []) {
  const posts = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    if (url.pathname === "/rest/v1/horarios") {
      if (req.method() === "POST" || req.method() === "PATCH") { const b = JSON.parse(req.postData()); posts.push([req.method(), b]); return json([{ id: "nuevo", ...b }]); }
      return json(horarios);
    }
    return json([]);
  });
  await page.addInitScript(() => {
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: /Personal/ }).click();
  await page.getByRole("button", { name: "Horarios", exact: true }).click();
  return posts;
}

test("modelo Camioneros: arma el horario con extras al 50/100% y descanso de 12 h", async ({ page }) => {
  const errores = []; page.on("pageerror", (e) => errores.push(e.message));
  const posts = await panelRrhh(page);
  await page.getByRole("button", { name: "+ Nuevo horario" }).click();
  await page.getByRole("button", { name: /Usar modelo Camioneros/ }).click();
  await expect(page.getByText("LMXJV · 08:00–16:00")).toBeVisible();
  await expect(page.getByText("S · 08:00–12:00")).toBeVisible();
  await expect(page.getByLabel("Horas extras propias de este horario")).toBeChecked();
  await page.screenshot({ path: "test-results/horario-camioneros.png", fullPage: true });
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect.poll(() => posts.length).toBe(1);
  const [metodo, h] = posts[0];
  expect(metodo).toBe("POST");
  expect(h).toMatchObject({ nombre: "Camioneros", tipo: "fijo", tolerancia_minutos: 10 });
  expect(h.extras).toEqual({ tramos: [{ dias: [1, 2, 3, 4, 5], hasta_50: "21:00", todo_100_si_pasa: true }, { dias: [6], hasta_50: "13:00", todo_100_si_pasa: false }], descanso_horas: 12 });
  await expect(page.getByText(/EXTRAS PROPIAS · descanso 12 h/)).toBeVisible();
  expect(errores).toEqual([]);
});

test("un horario sin extras propias se guarda como siempre (sin tocar la columna nueva)", async ({ page }) => {
  const posts = await panelRrhh(page);
  await page.getByRole("button", { name: "+ Nuevo horario" }).click();
  await page.getByPlaceholder("Ej: Mañana Lun-Vie").fill("Oficina");
  await page.getByRole("button", { name: "Guardar horario" }).click();
  await expect.poll(() => posts.length).toBe(1);
  expect("extras" in posts[0][1]).toBe(false);
});
