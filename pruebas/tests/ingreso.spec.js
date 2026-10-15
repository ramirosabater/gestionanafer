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
