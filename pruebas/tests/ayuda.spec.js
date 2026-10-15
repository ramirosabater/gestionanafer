// Ayuda con Sifoncito: cambia de traje según el área y recorre los circuitos
// navegando a la pestaña y marcando el elemento de cada paso.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

test("en el inicio muestra los circuitos generales y marca las áreas", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test" });
  await expect(page.locator("#ayuda-btn")).toBeVisible();
  await page.click("#ayuda-btn");
  await expect(page.locator("#ayuda-panel .ayuda-area")).toHaveText("Inicio");
  await page.getByRole("button", { name: /Cómo moverse/ }).click();
  await page.click('#ayuda-panel [data-acc="sig"]');
  await expect(page.locator("#home-grid")).toHaveClass(/ayuda-foco/);
  expect(errores).toEqual([]);
});

test("en Administración se viste de administración y lleva a cada pantalla", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "admin@anafer.test" });
  await page.locator("#home-grid .area-card", { hasText: "Administración" }).click();
  await page.click("#ayuda-btn");
  await expect(page.locator("#ayuda-panel .ayuda-area")).toHaveText("Administración");
  await page.getByRole("button", { name: /Pagar a proveedores/ }).click();
  await expect(page.locator("#sug-box")).toHaveClass(/ayuda-foco/);           // fue a Pagos → Sugerencia
  for (let i = 0; i < 4; i++) await page.click('#ayuda-panel [data-acc="sig"]');
  await expect(page.locator("#pagos-table")).toHaveClass(/ayuda-foco/);       // fue a Órdenes de pago
  await page.click('#ayuda-panel [data-acc="sig"]');
  await page.click('#ayuda-panel [data-acc="fin"]');
  await expect(page.locator("#ayuda-panel")).toBeHidden();
  await expect(page.locator(".ayuda-foco")).toHaveCount(0);
});

test("no aparece en la pantalla de ingreso", async ({ page }) => {
  await abrirGestion(page, baseDePrueba());
  await expect(page.locator("#login-btn")).toBeVisible();
  await expect(page.locator("#ayuda-btn")).toBeHidden();
});

test("habla cada paso y, en modo automático, avanza recién cuando termina de hablar", async ({ page }) => {
  // Voz simulada: registra lo que se dice y "termina" de hablar a los 800 ms.
  await page.addInitScript(() => {
    window.__dichos = [];
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: function (t) { this.text = t; } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [{ lang: "es-AR", name: "Prueba", localService: true }],
      addEventListener: () => {}, cancel: () => {},
      speak: (u) => { window.__dichos.push({ t: u.text, en: Date.now() }); setTimeout(() => u.onstart && u.onstart(), 10); setTimeout(() => u.onend && u.onend(), 800); },
    } });
  });
  await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test" });
  await page.click("#ayuda-btn");
  await page.getByRole("button", { name: /Cómo moverse/ }).click();
  await expect.poll(() => page.evaluate(() => window.__dichos.length)).toBeGreaterThanOrEqual(2); // saludo + paso 1
  const t0 = Date.now();
  await expect(page.locator("#ayuda-panel .ayuda-puntos i.on")).toHaveCount(1);
  await expect(page.locator("#ayuda-panel .ayuda-puntos i").nth(1)).toHaveClass(/on/, { timeout: 8000 });
  expect(Date.now() - t0).toBeGreaterThan(1500); // espera a que termine de hablar + pausa
  const dichos = await page.evaluate(() => window.__dichos.map((d) => d.t));
  expect(dichos.some((t) => t.includes("Te voy a mostrar cómo se usa el sistema"))).toBe(true);
  expect(dichos.join(" ")).not.toMatch(/<b>|🫧/); // sin HTML ni emojis
  // Pausa: no sigue avanzando
  await page.click('#ayuda-panel [data-acc="auto"]');
  const paso = await page.locator("#ayuda-panel .ayuda-puntos i").evaluateAll((is) => is.findIndex((i) => i.classList.contains("on")));
  await page.waitForTimeout(3500);
  const paso2 = await page.locator("#ayuda-panel .ayuda-puntos i").evaluateAll((is) => is.findIndex((i) => i.classList.contains("on")));
  expect(paso2).toBe(paso);
});
