// Factura con centro de costo en árbol (móvil obligatorio) y sugerencia de pagos.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

test("factura: centros agrupados por área, pide el móvil y lo guarda", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  const grupos = await page.locator("#fm-centro-costo optgroup").evaluateAll((g) => g.map((x) => x.label + ": " + [...x.children].map((o) => o.textContent).join(", ")));
  expect(grupos).toEqual(["Logística: Depósito, Móviles, Impuestos › Móvil 13"]); // el centro viejo inactivo no aparece
  await page.fill("#fm-proveedor-input", "Transp");
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.selectOption("#fm-centro-costo", "cc_logistica_moviles");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await expect(page.locator("#fm-ccref-field")).toBeVisible();
  await page.selectOption("#fm-concepto", "gasoil");
  await page.fill("#fm-numero", "T-9");
  await page.fill("#fm-monto", "121.000");
  await page.click("#fm-save");
  await expect(page.locator("#toast")).toContainText("móvil");
  await page.selectOption("#fm-ccref", { index: 1 });
  await page.click("#fm-save");
  const f = (await escrituras(page, "facturas")).map((x) => x[2]).find((x) => x.numero === "T-9");
  expect(f.centro_costo_id).toBe("cc_logistica_moviles");
  expect(f.cc_ref).toMatch(/^movil:/);
  expect(f.monto).toBe(121000);
});

test("sugerencia de pagos: prioritario primero, después lo más viejo, y crea las órdenes", async ({ page }) => {
  page.on("dialog", (d) => d.accept());
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="sugerencia"]');
  // Disponible: banco 2.000.000 + caja 50.000
  await expect(page.locator("#sug-monto")).toHaveValue("2.050.000");
  await page.fill("#sug-monto", "1.500.000");
  await page.click("#sug-recalc");
  const primera = await page.locator("#sug-tbody tr.sug-prov").first().textContent();
  expect(primera).toContain("Transporte SRL"); // ★ prioritario
  // Orden: T-1 (★) 1.210.000, S-1 (la más vieja) 121.000, y del 02/10 de menor a mayor:
  // N-1 10.000, S-2 60.500 → 1.401.500; B-1, M-1 y MO-1 ya no entran.
  await expect(page.locator("#sug-total")).toContainText("$1.401.500,00");
  await page.click("#sug-crear");
  const ops = (await escrituras(page, "ordenes_pago")).map((x) => x[2]);
  expect(ops.map((o) => [o.proveedor_id, o.factura_ids.join("+"), o.estado])).toEqual([
    ["trans", "t1", "pendiente"], ["serv", "s1+s2", "pendiente"], ["noins", "n1", "pendiente"],
  ]);
  await expect(page.locator('#subtabs-pagos .stabbtn[data-sub="ordenes"]')).toHaveClass(/active/);
});

test("ninguna pestaña de Administración tira errores de JavaScript", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(datosCompras()), { email: "admin@anafer.test" });
  await page.locator("#home-grid .area-card", { hasText: "Administración" }).click();
  for (const tab of ["#tab-compras", "#tab-pagos", "#tab-tesoreria", "#tab-dashboard"]) {
    await page.click(tab);
    for (const sub of await page.locator(".subtabs:visible .stabbtn").all()) await sub.click();
  }
  expect(errores).toEqual([]);
});

test("factura a un centro ligado a un camión: no pide móvil y lo guarda solo", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  await page.fill("#fm-proveedor-input", "Transp");
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.selectOption("#fm-centro-costo", "cc_logistica_impuestos_movil_13");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await expect(page.locator("#fm-ccref-field")).toBeHidden();
  await page.selectOption("#fm-concepto", "gasoil");
  await page.fill("#fm-numero", "PAT-1");
  await page.fill("#fm-monto", "50.000");
  await page.click("#fm-save");
  const f = (await escrituras(page, "facturas")).map((x) => x[2]).find((x) => x.numero === "PAT-1");
  expect(f.cc_ref).toBe("movil:13");
});

test("dashboard: mantenimiento de flota por móvil suma solo lo de Mantenimiento › Flota", async ({ page }) => {
  const hoy = new Date().toISOString().slice(0, 10);
  const centros = [
    { id: "cc_mantenimiento", descripcion: "Mantenimiento", parent_id: null, activo: true, orden: 1 },
    { id: "cc_mantenimiento_flota", descripcion: "Flota", parent_id: "cc_mantenimiento", activo: true, orden: 1 },
    { id: "cc_mantenimiento_flota_insumos", descripcion: "Insumos", parent_id: "cc_mantenimiento_flota", activo: true, orden: 1 },
    { id: "cc_mantenimiento_flota_insumos_movil_13", descripcion: "Móvil 13", parent_id: "cc_mantenimiento_flota_insumos", activo: true, orden: 1, ref_fijo: "movil:13" },
    { id: "cc_logistica", descripcion: "Logística", parent_id: null, activo: true, orden: 2 },
    { id: "cc_logistica_moviles", descripcion: "Móviles", parent_id: "cc_logistica", activo: true, orden: 1 },
    { id: "cc_logistica_moviles_movil_13", descripcion: "Móvil 13", parent_id: "cc_logistica_moviles", activo: true, orden: 1, ref_fijo: "movil:13" },
  ];
  const facturas = [
    { id: "r1", proveedor_id: "trans", numero: "R-1", fecha: hoy, monto: 1000, estado: "pendiente", centro_costo_id: "cc_mantenimiento_flota_insumos_movil_13", concepto_id: "gasoil" },
    { id: "g1", proveedor_id: "trans", numero: "G-1", fecha: hoy, monto: 5000, estado: "pendiente", centro_costo_id: "cc_logistica_moviles_movil_13", concepto_id: "gasoil" },
  ];
  await abrirGestion(page, baseDePrueba(datosCompras({ centros_costo: centros, facturas })), { email: "admin@anafer.test" });
  await page.locator("#home-grid .area-card", { hasText: "Administración" }).click();
  await page.click("#tab-dashboard");
  await expect(page.locator("#bar-gastos-mant-movil")).toContainText("1.000");
  await expect(page.locator("#bar-gastos-mant-movil")).not.toContainText("6.000");
  await expect(page.locator("#bar-gastos-movil")).toContainText("6.000");
});
