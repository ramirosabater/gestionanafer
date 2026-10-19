// Al abrir o recargar (F5) no tiene que "flashear" el menú ni el login:
// hasta saber si hay sesión se ve solo "Cargando…".
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";

async function espiarPantallas(page) {
  await page.addInitScript(() => {
    window.__vistos = [];
    const mirar = () => {
      const login = document.getElementById("login-overlay"), shell = document.querySelector(".shell");
      if (login && login.classList.contains("show")) window.__vistos.push("login");
      if (shell && !shell.hidden) window.__vistos.push("sistema");
    };
    new MutationObserver(mirar).observe(document, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden"] });
  });
}
const secuencia = (page) => page.evaluate(() => window.__vistos.filter((x, i, a) => x !== a[i - 1]));

test("con sesión abierta, F5 entra directo sin mostrar el login ni el menú antes", async ({ page }) => {
  await espiarPantallas(page);
  const errores = await abrirGestion(page, baseDePrueba({}), { email: "admin@anafer.test" });
  await page.locator("#home-grid .area-card", { hasText: "Logística" }).click();
  await expect(page.locator("#menu-card")).toBeVisible();
  await page.reload();
  await expect(page.locator("#menu-card")).toBeVisible();
  await expect(page.locator("#arranque")).toBeHidden();
  expect(await secuencia(page)).toEqual(["sistema"]);
  expect(errores).toEqual([]);
});

test("sin sesión, F5 muestra solo el login (sin flashear el sistema)", async ({ page }) => {
  await espiarPantallas(page);
  await abrirGestion(page, baseDePrueba({}));
  await expect(page.locator("#login-overlay")).toHaveClass(/show/);
  await page.reload();
  await expect(page.locator("#login-overlay")).toHaveClass(/show/);
  await expect(page.locator("#arranque")).toBeHidden();
  expect(await secuencia(page)).toEqual(["login"]);
});
