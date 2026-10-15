// Pagos con cheque/echeq propio diferido: la plata sale del banco el día de
// cobro (para el cashflow), no el día de la orden de pago.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

function enDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

test("echeq a 60 días: el egreso queda en la fecha de cobro y solo baja el saldo proyectado", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  const hoy = enDias(0), cobro = enDias(60);
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");          // monotributo: sin retención, monto redondo
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.fill("#pom-fecha", hoy);
  await page.selectOption("#pom-estado", "pagada");
  await page.selectOption("#pom-medio", "ecs");
  await page.dispatchEvent("#pom-medio", "change");
  await page.fill("#pom-chq-numero", "E-777");
  await page.fill("#pom-chq-fecha", cobro);
  await page.click("#pom-save");

  const mov = (await escrituras(page, "movimientos")).map((x) => x[2]).pop();
  expect(mov.fecha).toBe(cobro);
  expect(mov.monto).toBe(500000);

  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cuentas"]');
  const fila = page.locator("#cuentas-body tr", { hasText: "Banco Santander" });
  await expect(fila).toContainText("$2.000.000,00");   // saldo hoy: todavía no se debitó
  await expect(fila).toContainText("−$500.000,00");     // a debitar
  await expect(fila).toContainText("$1.500.000,00");   // proyectado

  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await expect(page.locator("#movimientos-body tr.mov-futuro")).toContainText("a debitar");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cheques"]');
  await page.selectOption("#cheque-filter-estado", "emitido");
  await expect(page.locator("#cheques-body")).toContainText("Emitido · a debitar");
});

test("transferencia: el egreso queda el día del pago y baja el saldo hoy", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.fill("#pom-fecha", enDias(0));
  await page.selectOption("#pom-estado", "pagada");
  await page.selectOption("#pom-medio", "tr1");
  await page.dispatchEvent("#pom-medio", "change");
  await page.click("#pom-save");
  const mov = (await escrituras(page, "movimientos")).map((x) => x[2]).pop();
  expect(mov.fecha).toBe(enDias(0));
  await page.click("#tab-tesoreria");
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$1.500.000,00");
});
