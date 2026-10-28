// Débitos internos (pagos sin factura ni impuestos) y kilómetros/litros en
// las facturas de combustibles y lubricantes.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras, PROVEEDORES, FACTURAS } from "../apoyo/datos-compras.js";

const YPF = { id: "ypf", nombre: "Estación YPF Centro", cuit: "30-77777777-7", condicion_iva: "Responsable inscripto", rubro: "Combustibles y lubricantes" };
const CARGA_ANT = { id: "y0", proveedor_id: "ypf", numero: "B-0001-00000900", fecha: "2026-10-10", monto: 150000, estado: "pagada",
  centro_costo_id: "cc_logistica_impuestos_movil_13", concepto_id: "gasoil", cc_ref: "movil:13", km: 151850, litros: 100 };
const datos = () => baseDePrueba(datosCompras({ proveedores: [...PROVEEDORES, YPF], facturas: [...FACTURAS, CARGA_ANT] }));
const ultima = async (page, t) => (await escrituras(page, t)).map((x) => x[2]);

async function nuevaFactura(page, prov) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  if (prov) {
    await page.fill("#fm-proveedor-input", prov);
    await page.locator("#fm-proveedor-menu .combo-item").first().click();
  }
}

test("débito interno: número propio, sin IVA ni retención, se paga con una orden de pago", async ({ page }) => {
  const errores = await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await nuevaFactura(page);
  await page.click('#fm-tipo-toggle button[data-tipo="debito_interno"]');
  await expect(page.locator("#fm-title")).toHaveText("Nuevo débito interno");
  await expect(page.locator("#fm-numero")).toHaveValue("DI-0001");
  await expect(page.locator("#fm-numero")).toHaveJSProperty("readOnly", true);
  await expect(page.locator("#fm-impuestos")).toBeHidden();
  await expect(page.locator("#fm-di-aviso")).toBeVisible();
  await page.fill("#fm-proveedor-input", "Servicios");
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.selectOption("#fm-centro-costo", "cc_logistica_deposito");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await page.selectOption("#fm-concepto", "gasoil");
  await page.fill("#fm-monto", "300000");
  await page.fill("#fm-notas", "Reintegro de gastos de viaje");
  await page.click("#fm-save");
  await expect(page.locator("#factura-overlay")).not.toHaveClass(/show/);
  const di = (await ultima(page, "facturas")).pop();
  expect([di.tipo_comprobante, di.numero, di.neto, di.monto]).toEqual(["debito_interno", "DI-0001", 300000, 300000]);
  await expect(page.locator("#facturas-body tr", { hasText: "DI-0001" })).toContainText("Débito interno");
  await page.selectOption("#factura-filter-estado", "tipo:debito_interno");
  await expect(page.locator("#facturas-body tr")).toHaveCount(1);

  // El siguiente toma DI-0002
  await page.click("#new-factura-btn");
  await page.click('#fm-tipo-toggle button[data-tipo="debito_interno"]');
  await expect(page.locator("#fm-numero")).toHaveValue("DI-0002");
  await page.click("#fm-cancel");

  // Se paga con una orden de pago: sin retención (Servicios SA retendría si fuera factura)
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Servicios");
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator(`#pom-facturas-list .fact-line[data-fid="${di.id}"] input[type=checkbox]`).check();
  await page.selectOption("#pom-estado", "pagada");
  await page.dispatchEvent("#pom-estado", "change");
  await expect(page.locator("#pom-ret-box")).toBeHidden();
  await page.selectOption("#pom-formas .forma >> nth=0 >> .f-medio", "tr1");
  await expect(page.locator("#pom-formas .f-importe")).toHaveValue("300.000");
  await page.click("#pom-save");
  const op = (await ultima(page, "ordenes_pago")).pop();
  expect([op.monto, op.retenido]).toEqual([300000, 0]);
  expect((await ultima(page, "facturas")).filter((f) => f.id === di.id).pop().estado).toBe("pagada");
  expect(errores).toEqual([]);
});

test("combustible: km y litros opcionales en las facturas de combustibles y lubricantes, con el consumo del móvil", async ({ page }) => {
  const errores = await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  // Un proveedor que no es de combustible no los pide
  await nuevaFactura(page, "Servicios");
  await expect(page.locator("#fm-combustible")).toBeHidden();
  await page.click("#fm-cancel");

  await nuevaFactura(page, "YPF");
  await expect(page.locator("#fm-combustible")).toBeVisible();
  await page.selectOption("#fm-centro-costo", "cc_logistica_impuestos_movil_13");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await page.selectOption("#fm-concepto", "gasoil");
  await page.fill("#fm-km", "152300");
  await page.fill("#fm-litros", "120,5");
  await page.dispatchEvent("#fm-litros", "change");
  // 152.300 − 151.850 = 450 km; 120,5 L / 450 km × 100 = 26,78 L/100 km
  await expect(page.locator("#fm-comb-hint")).toHaveText("Desde la carga anterior (10/10/2026, 151.850 km): 450 km · 26,78 L/100 km");
  await page.fill("#fm-numero", "B-0001-00000950");
  await page.fill("#fm-monto", "181500");
  await page.click("#fm-save");
  await expect(page.locator("#factura-overlay")).not.toHaveClass(/show/);
  const f = (await ultima(page, "facturas")).pop();
  expect([f.km, f.litros, f.tipo_comprobante]).toEqual([152300, 120.5, "factura"]);
  await expect(page.locator("#facturas-body tr", { hasText: "B-0001-00000950" })).toContainText("⛽ 120,5 L · 152.300 km");

  // Son opcionales: sin km ni litros se guarda igual
  await nuevaFactura(page, "YPF");
  await page.selectOption("#fm-centro-costo", "cc_logistica_deposito");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await page.selectOption("#fm-concepto", "gasoil");
  await page.fill("#fm-numero", "B-0001-00000951");
  await page.fill("#fm-monto", "50000");
  await page.click("#fm-save");
  await expect(page.locator("#factura-overlay")).not.toHaveClass(/show/);
  const g = (await ultima(page, "facturas")).pop();
  expect([g.km, g.litros]).toEqual([null, null]);
  expect(errores).toEqual([]);
});
