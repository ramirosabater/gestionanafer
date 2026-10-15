// Retención de Ganancias en la orden de pago (RG 830). Los importes esperados
// están calculados a mano con la tabla de la RG 5423.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

async function irAOrdenes(page) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
}
async function nuevaOP(page, proveedor, { cuantas = null, pagar = false } = {}) {
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", proveedor);
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  const checks = page.locator("#pom-facturas-list input[type=checkbox]");
  const n = cuantas ?? (await checks.count());
  for (let i = 0; i < n; i++) await checks.nth(i).check();
  await page.fill("#pom-fecha", "2026-10-05");
  await page.dispatchEvent("#pom-fecha", "change");
  if (pagar) {
    await page.selectOption("#pom-estado", "pagada");
    await page.selectOption("#pom-medio", "tr1");
    await page.dispatchEvent("#pom-medio", "change");
  }
}
const importeRet = (page) => page.locator("#pom-ret-lines .ret-line b").first().textContent();

test.describe("cálculo en la orden de pago", () => {
  test.beforeEach(async ({ page }) => {
    await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
    await irAOrdenes(page);
  });

  const casos = [
    ["Servicios SA, inscripto, 94: (100.000 − 67.170) × 2%", "Servicios", 1, "$656,60"],
    ["Dr. Pérez, inscripto, 119 por escala: 3.550 + 9% de 69.000", "Pérez", null, "$9.760,00"],
    ["Monotributo: no se retiene", "Mono", null, "$0,00"],
    ["No inscripto persona humana, 94: 28%", "Sin Ins", null, "$2.800,00"],
    ["Bienes 78 debajo del no sujeto (200.000 < 224.000)", "Ferret", null, "$0,00"],
    ["Transporte 95: 932.830 × 0,25% redondeado", "Transp", null, "$2.332,08"],
  ];
  for (const [nombre, prov, cuantas, esperado] of casos) {
    test(nombre, async ({ page }) => {
      await nuevaOP(page, prov, { cuantas });
      await expect(page.locator("#pom-ret-box")).toBeVisible();
      expect(await importeRet(page)).toBe(esperado);
    });
  }
});

test("segundo pago del mes descuenta lo ya retenido; egreso y certificado por el neto", async ({ page, context }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await irAOrdenes(page);
  await nuevaOP(page, "Servicios", { cuantas: 1, pagar: true });
  await expect(page.locator("#pom-neto")).toHaveText("$120.343,40");
  await page.click("#pom-save");
  await expect(page.locator("#pago-overlay")).not.toHaveClass(/show/);

  await nuevaOP(page, "Servicios", { pagar: true });
  expect(await importeRet(page)).toBe("$1.000,00"); // (150.000 − 67.170) × 2% − 656,60
  await page.click("#pom-save");

  const ops = (await escrituras(page, "ordenes_pago")).map((x) => x[2]);
  expect(ops.map((o) => [o.retenido, o.retenciones[0].certificado])).toEqual([[656.6, 1], [1000, 2]]);
  const movs = (await escrituras(page, "movimientos")).map((x) => x[2].monto);
  expect(movs).toEqual([120343.4, 59500]);

  // Listado del mes y certificado
  await page.click('#subtabs-pagos .stabbtn[data-sub="retenciones"]');
  await page.fill("#ret-mes", "2026-10");
  await page.dispatchEvent("#ret-mes", "change");
  await expect(page.locator("#ret-body tr")).toHaveCount(2);
  const [cert] = await Promise.all([context.waitForEvent("page"), page.locator("#ret-body button").first().click()]);
  await expect(cert.locator("body")).toContainText("N° 000001");
  await expect(cert.locator("body")).toContainText("$656,60");
});
