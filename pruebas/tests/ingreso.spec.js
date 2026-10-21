// Ingreso con email y áreas según el perfil.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";

async function ingresar(page, email, clave) {
  await page.fill("#login-email", email);
  await page.fill("#login-password", clave);
  await page.click("#login-btn");
}

test("admin entra y ve el inicio con las 4 áreas, sin pasar por una pantalla interna", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba());
  await expect(page.locator("#login-btn")).toBeVisible();
  await expect(page.locator("#login-mode-btn")).toHaveCount(0); // se sacó el ingreso por contraseña de perfil
  await ingresar(page, "admin@anafer.test", "clave123");
  await expect(page.locator("#view-home")).toBeVisible();
  const areas = await page.locator("#home-grid .area-card h3").allTextContents();
  expect(areas).toEqual(expect.arrayContaining(["Logística", "Administración", "Comercial", "Recursos Humanos"]));
  expect(errores).toEqual([]);
});

test("contraseña incorrecta muestra error y no entra", async ({ page }) => {
  await abrirGestion(page, baseDePrueba());
  await ingresar(page, "admin@anafer.test", "otra");
  await expect(page.locator("#login-error")).toContainText("incorrect");
  await expect(page.locator("#view-home")).toBeHidden();
});

test("perfil con una sola área interna entra directo a esa área", async ({ page }) => {
  await abrirGestion(page, baseDePrueba());
  await ingresar(page, "compras@anafer.test", "clave123");
  await expect(page.locator("#view-home")).toBeHidden();
  await expect(page.locator("#tab-compras")).toBeVisible();
  await expect(page.locator("#tab-grid")).toBeHidden();
});

test("perfil que ya no existe: avisa y no entra", async ({ page }) => {
  const db = baseDePrueba();
  db.usuarios.push({ email: "viejo@anafer.test", activo: true, perfil: "perfil_borrado" });
  db.__cuentas["viejo@anafer.test"] = "clave123";
  await abrirGestion(page, db);
  await ingresar(page, "viejo@anafer.test", "clave123");
  await expect(page.locator("#login-error")).toContainText("perfil que ya no existe");
});

test("usuario inactivo no entra", async ({ page }) => {
  const db = baseDePrueba();
  db.usuarios[1].activo = false;
  await abrirGestion(page, db);
  await ingresar(page, "compras@anafer.test", "clave123");
  await expect(page.locator("#login-error")).toContainText("no tiene acceso");
});

test("Salir desde una pantalla interna cierra la sesión y vuelve al ingreso (raíz del sitio)", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test" });
  await page.locator("#home-grid .area-card", { hasText: "Administración" }).click();
  await page.click("#tab-tesoreria");
  await page.click("#logout-btn");
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await expect(page.locator("#login-btn")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("prueba_sesion_email"))).toBeNull();
  await page.reload();
  await expect(page.locator("#login-btn")).toBeVisible();     // sigue afuera al recargar
  await expect(page.locator("#view-home")).toBeHidden();
});

test("Salir en el panel de RR.HH. cierra la sesión en el servidor y va al ingreso de Gestión", async ({ page }) => {
  let logout = null;
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b, status = 200) => r.fulfill({ status, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname === "/auth/v1/logout") { logout = [url.search, req.headers()["authorization"]]; return r.fulfill({ status: 204, body: "" }); }
    if (url.pathname === "/auth/v1/user") return json({ email: "rrhh@anafer.test" });
    if (url.pathname.startsWith("/rest/v1/usuarios")) return json({ message: "no existe" }, 404);
    return json([]);
  });
  await page.addInitScript(() => {
    if (sessionStorage.getItem("ya")) return;
    sessionStorage.setItem("ya", "1");
    const host = new URL(window.SUPABASE_URL || "https://mock.supabase.co").hostname.split(".")[0];
    localStorage.setItem(`sb-${host}-auth-token`, JSON.stringify({ access_token: "tok", refresh_token: "r", expires_at: Math.floor(Date.now() / 1000) + 3600, user: { email: "rrhh@anafer.test" } }));
  });
  await page.goto("/fichaje/admin.html");
  await page.getByRole("button", { name: "Salir" }).click();
  await page.waitForURL((u) => new URL(u).pathname === "/");
  expect(logout).toEqual(["?scope=global", "Bearer tok"]);
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => /auth-token/.test(k)))).toEqual([]);
});

test("Salir en el tablero Comercial también cierra la sesión y va al ingreso", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test", ruta: "/comercial-dashboard.html" });
  await page.click("#salir-btn");
  await page.waitForURL((u) => new URL(u).pathname === "/");
  await expect(page.locator("#login-btn")).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("prueba_sesion_email"))).toBeNull();
});
