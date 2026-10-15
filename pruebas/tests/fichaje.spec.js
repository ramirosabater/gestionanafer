// El fichaje y el panel de RR.HH. tienen que usar la MISMA base que Gestión
// (la del config.js del sitio). Esto es lo que falló cuando las fichadas
// siguieron yendo a la base vieja.
import { test, expect } from "@playwright/test";

for (const ruta of ["/fichaje/", "/fichaje/admin.html"]) {
  test(`${ruta} usa la base de config.js y no consulta otra`, async ({ page }) => {
    const hosts = new Set();
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => {
      hosts.add(new URL(r.request().url()).host);
      r.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto(ruta);
    await page.waitForLoadState("networkidle");
    const config = await page.evaluate(() => window.SUPABASE_URL);
    expect(config).toBeTruthy();
    if (ruta === "/fichaje/") {
      // Intento de ingreso del empleado: la consulta tiene que ir a la base de config.js
      await page.getByPlaceholder("Legajo").fill("123");
      await page.getByPlaceholder("PIN").first().fill("1234");
      await page.getByPlaceholder("PIN").first().press("Enter");
      await page.waitForTimeout(500);
    }
    const supabaseHosts = [...hosts].filter((h) => h.endsWith("supabase.co"));
    if (ruta === "/fichaje/") expect(supabaseHosts.length).toBeGreaterThan(0); // sí consultó la base
    for (const h of supabaseHosts) expect(h).toBe(new URL(config).host);
  });
}
