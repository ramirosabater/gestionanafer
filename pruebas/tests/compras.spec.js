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
  expect(grupos).toEqual(["Logística: Depósito, Móviles"]); // el centro viejo inactivo no aparece
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
