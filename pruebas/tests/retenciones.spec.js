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
    await page.selectOption("#pom-formas .forma >> nth=0 >> .f-medio", "tr1");
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

// Regímenes que usa Anafer (retenciones-reales.sql): honorarios de director por
// la 1ª escala, dividendos 7% y Factura M (Ganancias 0,25% + IVA 21%).
function datosReales() {
  const d = datosCompras();
  d.gan_regimenes = [...d.gan_regimenes,
    { codigo: 116, descripcion: "Honorarios de director", alic_insc: null, escala: "general", alic_no_insc: 28, alic_no_insc_ph: null, mnsr: 67170, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, activo: true, orden: 5 },
    { codigo: 900, descripcion: "Distribución de dividendos", alic_insc: 7, escala: null, alic_no_insc: 7, alic_no_insc_ph: null, mnsr: 0, mnsr_no_insc: false, min_insc: 0, min_no_insc: 0, activo: true, orden: 8 },
    { codigo: 901, descripcion: "Facturas M (Ganancias + IVA)", alic_insc: 0.25, escala: null, alic_no_insc: 0.25, alic_no_insc_ph: null, mnsr: 67170, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, iva_pct: 21, activo: true, orden: 9 },
    { codigo: 32, descripcion: "Alquileres rurales (ya no se usa)", alic_insc: 6, escala: null, alic_no_insc: 25, alic_no_insc_ph: 28, mnsr: 11200, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, activo: false, orden: 99 },
  ];
  d.gan_escalas = [...d.gan_escalas,
    { escala: "general", desde: 0, hasta: 8000, fijo: 0, pct: 5 }, { escala: "general", desde: 24000, hasta: 32000, fijo: 2080, pct: 15 },
    { escala: "general", desde: 32000, hasta: 48000, fijo: 3280, pct: 19 }, { escala: "general", desde: 96000, hasta: null, fijo: 18640, pct: 31 }];
  d.proveedores = [...d.proveedores,
    { id: "dire", nombre: "Director Gómez", cuit: "20-77777777-7", condicion_iva: "Responsable inscripto", rubro: "", gan_regimen: 116 },
    { id: "acc", nombre: "Accionista Ruiz", cuit: "20-88888888-8", condicion_iva: "Responsable inscripto", rubro: "", gan_regimen: 900 },
    { id: "mfac", nombre: "Emisor M SRL", cuit: "30-99999999-9", condicion_iva: "Responsable inscripto", rubro: "Bienes" },
    { id: "rural", nombre: "Campo SA", cuit: "30-12121212-1", condicion_iva: "Responsable inscripto", rubro: "", gan_regimen: 32 },
  ];
  d.facturas = [...d.facturas,
    { id: "d1", proveedor_id: "dire", numero: "C-0001-00000010", fecha: "2026-10-02", monto: 100000, neto: 100000, estado: "pendiente" },
    { id: "a1", proveedor_id: "acc", numero: "DIV-2026", fecha: "2026-10-02", monto: 500000, neto: 500000, estado: "pendiente" },
    { id: "fm1", proveedor_id: "mfac", numero: "M-0003-00001234", fecha: "2026-10-02", monto: 363000, neto: 300000, estado: "pendiente" },
    { id: "r1", proveedor_id: "rural", numero: "A-0001-00000077", fecha: "2026-10-02", monto: 121000, neto: 100000, estado: "pendiente" },
  ];
  return d;
}

test.describe("retenciones que usa Anafer", () => {
  test.beforeEach(async ({ page }) => {
    await abrirGestion(page, baseDePrueba(datosReales()), { email: "compras@anafer.test" });
    await irAOrdenes(page);
  });
  test("honorarios de director (116): (100.000 − 67.170) por la 1ª escala = 3.280 + 19% de 830", async ({ page }) => {
    await nuevaOP(page, "Director");
    expect(await importeRet(page)).toBe("$3.437,70");
  });
  test("dividendos (900): 7%", async ({ page }) => {
    await nuevaOP(page, "Accionista");
    expect(await importeRet(page)).toBe("$35.000,00");
  });
  test("régimen desactivado: no retiene y avisa", async ({ page }) => {
    await nuevaOP(page, "Campo");
    expect(await importeRet(page)).toBe("$0,00");
    await expect(page.locator("#pom-ret-lines")).toContainText("desactivado");
  });
  test("Factura M: Ganancias (300.000 − 67.170) × 0,25% e IVA 21% del neto, con dos certificados", async ({ page, context }) => {
    await nuevaOP(page, "Emisor M", { pagar: true });
    const lineas = page.locator("#pom-ret-lines .ret-line");
    await expect(lineas).toHaveCount(2);
    await expect(lineas.nth(0)).toContainText("901");
    await expect(lineas.nth(0).locator("b")).toHaveText("$582,08");
    await expect(lineas.nth(1)).toContainText("IVA");
    await expect(lineas.nth(1).locator("b").last()).toHaveText("$63.000,00");
    await expect(page.locator("#pom-neto")).toHaveText("$299.417,92");
    await page.click("#pom-save");
    const op = (await escrituras(page, "ordenes_pago")).map((x) => x[2]).pop();
    expect(op.retenciones.map((e) => [e.impuesto || "ganancias", e.regimen, e.importe, e.certificado])).toEqual([["ganancias", 901, 582.08, 1], ["iva", 901, 63000, 2]]);
    expect(op.retenido).toBe(63582.08);
    await page.click('#subtabs-pagos .stabbtn[data-sub="retenciones"]');
    await page.fill("#ret-mes", "2026-10");
    await page.dispatchEvent("#ret-mes", "change");
    await expect(page.locator("#ret-body tr")).toHaveCount(2);
    await expect(page.locator("#ret-body tr").nth(1)).toContainText("IVA · 901");
    const [cert] = await Promise.all([context.waitForEvent("page"), page.locator("#ret-body tr").nth(1).locator("button").click()]);
    await expect(cert.locator("body")).toContainText("Impuesto al Valor Agregado");
    await expect(cert.locator("body")).toContainText("$63.000,00");
  });
});

test("exento en IVA: la factura no lleva IVA (neto = total) pero se retiene Ganancias; exento total no", async ({ page }) => {
  const { PROVEEDORES, FACTURAS } = await import("../apoyo/datos-compras.js");
  await abrirGestion(page, baseDePrueba(datosCompras({
    proveedores: [...PROVEEDORES,
      { id: "exiva", nombre: "Exiva Servicios", cuit: "30-44444444-4", condicion_iva: "Exento en IVA", rubro: "Locación de servicios" },
      { id: "extot", nombre: "Extot Asociación", cuit: "30-55555555-5", condicion_iva: "Exento", rubro: "Locación de servicios" }],
    facturas: [...FACTURAS,
      { id: "x1", proveedor_id: "exiva", numero: "C-1", fecha: "2026-10-01", monto: 100000, estado: "pendiente" },
      { id: "x2", proveedor_id: "extot", numero: "C-2", fecha: "2026-10-01", monto: 100000, estado: "pendiente" }],
  })), { email: "compras@anafer.test" });
  await irAOrdenes(page);
  await nuevaOP(page, "Exiva");
  await expect.poll(() => importeRet(page)).toBe("$656,60");   // (100.000 − 67.170) × 2%, sin sacarle IVA
  await page.click("#pom-cancel");
  await nuevaOP(page, "Extot");
  await expect.poll(() => importeRet(page)).toBe("$0,00");
  await page.click("#pom-cancel");
  // en la ficha aparece la condición nueva y Ganancias automática → Inscripto
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="proveedores"]');
  await page.locator("#proveedores-body tr", { hasText: "Exiva" }).click();
  await expect(page.locator("#pm-condicion-iva")).toHaveValue("Exento en IVA");
  await expect(page.locator("#pm-gan-hint")).toHaveText("→ Inscripto");
});
