// Pagos parciales de facturas, pagos anticipados (con o sin orden de compra)
// y estado de pago de las órdenes de compra. Importes calculados a mano:
// Servicios SA es inscripta, régimen 94 (no sujeto 67.170, 2%).
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras, FACTURAS } from "../apoyo/datos-compras.js";

const OC = { id: "oc_5", numero: 5, proveedor_id: "serv", fecha: "2026-10-01", descripcion: "Servicio de octubre", monto: 242000, estado: "aprobada" };
const S9 = { id: "s9", proveedor_id: "serv", numero: "S-9", fecha: "2026-10-04", monto: 242000, estado: "pendiente", oc_id: "oc_5" };

async function irAOrdenes(page) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
}
async function elegirProveedor(page, nombre) {
  await page.fill("#pom-proveedor-input", nombre);
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
}
async function pagarCon(page, fecha = "2026-10-05") {
  await page.fill("#pom-fecha", fecha);
  await page.dispatchEvent("#pom-fecha", "change");
  await page.selectOption("#pom-estado", "pagada");
  await page.dispatchEvent("#pom-estado", "change");
  await page.selectOption("#pom-formas .forma >> nth=0 >> .f-medio", "tr1");
}
const fila = (page, fid) => page.locator(`#pom-facturas-list .fact-line[data-fid="${fid}"]`);
const ultima = async (page, tabla) => (await escrituras(page, tabla)).map((x) => x[2]);

test("factura pagada en dos veces: queda en pago parcial y después pagada, con la retención sobre lo que se paga", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await irAOrdenes(page);

  // 1er pago: la mitad de S-1 (121.000 → 60.500, neto 50.000 < no sujeto: sin retención)
  await page.click("#new-pago-btn");
  await elegirProveedor(page, "Servicios");
  await fila(page, "s1").locator("input[type=checkbox]").check();
  await expect(fila(page, "s1").locator(".f-cancela")).toHaveValue("121.000");
  await fila(page, "s1").locator(".f-cancela").fill("60500");
  await fila(page, "s1").locator(".f-cancela").dispatchEvent("change");
  await expect(page.locator("#pom-monto-total")).toHaveText("$60.500,00");
  await expect(page.locator("#pom-resumen")).toContainText("con pago parcial");
  await pagarCon(page);
  await expect(page.locator("#pom-ret-lines .ret-line b").first()).toHaveText("$0,00");
  await page.click("#pom-save");
  await expect(page.locator("#pago-overlay")).not.toHaveClass(/show/);
  let op = (await ultima(page, "ordenes_pago")).pop();
  expect([op.monto, op.aplicaciones, op.tipo]).toEqual([60500, [{ factura_id: "s1", importe: 60500 }], "pago"]);
  expect((await ultima(page, "facturas")).filter((f) => f.id === "s1").pop().estado).toBe("parcial");
  await expect(page.locator("#pagos-body")).toContainText("S-1 (parcial $60.500,00)");

  // En Facturas: "Pago parcial" y lo que falta
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  const tr = page.locator("#facturas-body tr", { hasText: "S-1" });
  await expect(tr).toContainText("Pago parcial");
  await expect(tr).toContainText("falta pagar $60.500,00");

  // 2º pago: propone lo que falta; retiene sobre el acumulado del mes (50.000 + 50.000)
  await irAOrdenes(page);
  await page.click("#new-pago-btn");
  await elegirProveedor(page, "Servicios");
  await expect(fila(page, "s1")).toContainText("falta pagar $60.500,00");
  await fila(page, "s1").locator("input[type=checkbox]").check();
  await expect(fila(page, "s1").locator(".f-cancela")).toHaveValue("60.500");
  // no deja cancelar más de lo que falta
  await fila(page, "s1").locator(".f-cancela").fill("100000");
  await fila(page, "s1").locator(".f-cancela").dispatchEvent("change");
  await expect(fila(page, "s1").locator(".f-cancela")).toHaveValue("60.500");
  await pagarCon(page);
  await expect(page.locator("#pom-ret-lines .ret-line b").first()).toHaveText("$656,60"); // (100.000 − 67.170) × 2%
  await page.click("#pom-save");
  expect((await ultima(page, "facturas")).filter((f) => f.id === "s1").pop().estado).toBe("pagada");
  // ya no aparece para pagar
  await page.click("#new-pago-btn");
  await elegirProveedor(page, "Servicios");
  await expect(fila(page, "s1")).toHaveCount(0);
  expect(errores).toEqual([]);
});

test("pago anticipado desde la orden de compra: retiene al anticipar, queda a favor y se descuenta de la factura", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(datosCompras({ ordenes_compra: [OC], facturas: [...FACTURAS, S9] })), { email: "compras@anafer.test" });
  // Orden de compra sin pagar → 💸 Pago anticipado
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="ocs"]');
  const filaOC = page.locator("#oc-body tr", { hasText: "Servicio de octubre" });
  await expect(filaOC).toContainText("Sin pagar");
  await filaOC.click();
  await page.click("#ocm-anticipo");
  await expect(page.locator("#pago-overlay")).toHaveClass(/show/);
  await expect(page.locator("#pom-tipo-toggle button.on")).toHaveText("Pago anticipado");
  await expect(page.locator("#pom-ant-oc")).toHaveValue("oc_5");
  await expect(page.locator("#pom-ant-importe")).toHaveValue("242.000");
  // anticipa la mitad; la base de la retención es el neto (÷ 1,21)
  await page.fill("#pom-ant-importe", "121000");
  await page.dispatchEvent("#pom-ant-importe", "change");
  await expect(page.locator("#pom-ant-base")).toHaveValue("100.000");
  await pagarCon(page);
  await expect(page.locator("#pom-ret-lines .ret-line b").first()).toHaveText("$656,60");
  await expect(page.locator("#pom-neto")).toHaveText("$120.343,40");
  await page.click("#pom-save");
  await expect(page.locator("#pago-overlay")).not.toHaveClass(/show/);
  const ant = (await ultima(page, "ordenes_pago")).pop();
  expect([ant.tipo, ant.oc_id, ant.monto, ant.base_retencion, ant.retenido, ant.factura_ids]).toEqual(["anticipo", "oc_5", 121000, 100000, 656.6, []]);
  const mov = (await ultima(page, "movimientos")).pop();
  expect([mov.monto, mov.concepto]).toEqual([120343.4, `Anticipo ${await page.locator("#pagos-body tr").first().locator("td").first().textContent()} — Servicios SA`]);
  await expect(page.locator("#pagos-body tr").first()).toContainText("a favor $121.000,00");

  // La OC queda con pago parcial
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="ocs"]');
  await expect(filaOC).toContainText("Pago parcial");
  await expect(filaOC).toContainText("pagado $121.000,00 · falta $121.000,00");

  // Llega la factura S-9 de la OC: se paga usando el anticipo
  await irAOrdenes(page);
  await page.click("#new-pago-btn");
  await elegirProveedor(page, "Servicios");
  await fila(page, "s9").locator("input[type=checkbox]").check();
  await expect(page.locator("#pom-ant-usar-box")).toBeVisible();
  await page.locator("#pom-ant-usar .ant-line input[type=checkbox]").check();
  await expect(page.locator("#pom-ant-usar .a-importe")).toHaveValue("121.000");
  await pagarCon(page);
  // base: 200.000 de neto − 100.000 ya retenidos en el anticipo; acumulado del mes 200.000
  // → (200.000 − 67.170) × 2% − 656,60 = 2.000
  await expect(page.locator("#pom-ret-lines .ret-line b").first()).toHaveText("$2.000,00");
  await expect(page.locator("#pom-neto")).toHaveText("$119.000,00");
  await expect(page.locator("#pom-resumen")).toContainText("Anticipos usados − $121.000,00");
  await page.click("#pom-save");
  const op = (await ultima(page, "ordenes_pago")).pop();
  expect([op.monto, op.retenido, op.anticipos_usados]).toEqual([242000, 2000, [{ op_id: ant.id, importe: 121000 }]]);
  expect((await ultima(page, "movimientos")).pop().monto).toBe(119000);
  expect((await ultima(page, "facturas")).filter((f) => f.id === "s9").pop().estado).toBe("pagada");

  // El anticipo quedó usado y no se puede anular
  const filaAnt = page.locator("#pagos-body tr", { has: page.locator(".oc-badge.anticipo") });
  await expect(page.locator("#pagos-body tr").first()).toContainText("anticipo − $121.000,00");
  await expect(filaAnt).toContainText("usado completo");
  await filaAnt.click();
  await page.click("#pom-delete");
  await expect(page.locator("#toast")).toContainText("ya se usó");
  await page.click("#pom-cancel");

  // OC: pagada (factura pagada completa)
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="ocs"]');
  await expect(filaOC.locator("td").last()).toHaveText("Pagada");
  await filaOC.click();
  await expect(page.locator("#ocm-pagos")).toContainText("Factura S-9");
  await expect(page.locator("#ocm-pagos")).toContainText("Falta pagar de la orden ($242.000,00)$0,00");
  expect(errores).toEqual([]);
});

test("anticipo general (sin OC) que cubre toda la factura: no pide forma de pago", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await irAOrdenes(page);
  await page.click("#new-pago-btn");
  await elegirProveedor(page, "Mono");
  await page.click('#pom-tipo-toggle button[data-tipo="anticipo"]');
  await expect(page.locator("#pom-ant-oc")).toHaveValue("");
  await page.fill("#pom-ant-importe", "600000");
  await page.dispatchEvent("#pom-ant-importe", "change");
  await expect(page.locator("#pom-ant-base")).toHaveValue("600.000"); // monotributo: sin IVA
  await pagarCon(page);
  await page.click("#pom-save");
  await expect(page.locator("#pago-overlay")).not.toHaveClass(/show/);

  await page.click("#new-pago-btn");
  await elegirProveedor(page, "Mono");
  await fila(page, "mo1").locator("input[type=checkbox]").check();
  await page.locator("#pom-ant-usar .ant-line input[type=checkbox]").check();
  await expect(page.locator("#pom-ant-usar .a-importe")).toHaveValue("500.000");
  await page.selectOption("#pom-estado", "pagada");
  await page.dispatchEvent("#pom-estado", "change");
  await expect(page.locator("#pom-formas-box")).toBeHidden();
  await expect(page.locator("#pom-resumen")).toContainText("Neto a pagar $0,00");
  const movsAntes = (await escrituras(page, "movimientos")).length;
  await page.click("#pom-save");
  await expect(page.locator("#pago-overlay")).not.toHaveClass(/show/);
  expect((await escrituras(page, "movimientos")).length).toBe(movsAntes); // no sale plata
  expect((await ultima(page, "facturas")).filter((f) => f.id === "mo1").pop().estado).toBe("pagada");
  // quedan 100.000 a favor
  await page.selectOption("#pago-filter-estado", "anticipo_favor");
  await expect(page.locator("#pagos-body")).toContainText("a favor $100.000,00");
  expect(errores).toEqual([]);
});
