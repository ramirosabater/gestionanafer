// Impresiones con el formato de la empresa: orden de pago, orden de compra,
// certificado de retención (y anulados con marca de agua).
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";
import { datosConOPPagada } from "../apoyo/datos-op.js";

function enDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
function datos() {
  const d = datosConOPPagada();
  d.parametros = [{ id: "agente_retencion", valor: { razon_social: "ANAFER S.A.", cuit: "30-00000000-0", domicilio: "Calle 1", localidad: "Comodoro Rivadavia", provincia: "Chubut" } }];
  d.ordenes_compra = [{ id: "oc3", numero: 3, proveedor_id: "bien", fecha: enDias(0), descripcion: "200 bulones 3/8", monto: 50000, estado: "aprobada", notas: "", who: "" }];
  return baseDePrueba(d);
}
async function abrirOP(page) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.locator("#pagos-body tr", { hasText: "OP-0007" }).click();
}

test("orden de pago: se imprime con logo, comprobantes, retenciones, formas de pago y neto", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await abrirOP(page);
  const [hoja] = await Promise.all([page.waitForEvent("popup"), page.click("#pom-imprimir")]);
  await hoja.waitForLoadState();
  const cuerpo = hoja.locator("body");
  await expect(cuerpo).toContainText("Orden de pago");
  await expect(hoja.locator(".doc .num")).toHaveText("OP-0007");
  await expect(hoja.locator(".emp img")).toHaveAttribute("src", /^data:image/);
  await expect(hoja.locator(".emp")).toContainText("ANAFER S.A.");
  await expect(cuerpo).toContainText("Mono Juan");
  await expect(cuerpo).toContainText("MO-1");
  await expect(cuerpo).toContainText("Certificado");           // retención con su certificado
  await expect(cuerpo).toContainText("CHE — Cheque de terceros");
  await expect(cuerpo).toContainText("Banco Nación N° 111");
  await expect(hoja.locator(".totales tr.total")).toContainText("Neto a pagar");
  await expect(hoja.locator(".firmas")).toContainText("Recibí conforme");
  await expect(hoja.locator(".estado")).toHaveText("Pagada");
  await expect(hoja.locator(".anulado")).toHaveCount(0);
});

test("una orden anulada se sigue pudiendo imprimir, con la marca ANULADO", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await abrirOP(page);
  await page.click("#pom-delete");
  await page.fill("#anul-motivo", "Prueba de impresión");
  await page.click("#anul-ok");
  await page.locator("#pagos-body tr", { hasText: "OP-0007" }).click();
  await expect(page.locator("#pom-imprimir")).toBeEnabled();
  const [hoja] = await Promise.all([page.waitForEvent("popup"), page.click("#pom-imprimir")]);
  await hoja.waitForLoadState();
  await expect(hoja.locator(".anulado")).toContainText("ANULADO");
  await expect(hoja.locator(".anul-motivo")).toContainText("Prueba de impresión");
});

test("orden de compra y certificado de retención con el mismo formato", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="ocs"]');
  await page.locator("#oc-body tr", { hasText: "OC-0003" }).click();
  const [oc] = await Promise.all([page.waitForEvent("popup"), page.click("#ocm-imprimir")]);
  await oc.waitForLoadState();
  await expect(oc.locator(".doc .num")).toHaveText("OC-0003");
  await expect(oc.locator("body")).toContainText("200 bulones 3/8");
  await expect(oc.locator(".estado")).toHaveText("Aprobada");
  await page.click("#ocm-cancel");
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="retenciones"]');
  const [cert] = await Promise.all([page.waitForEvent("popup"), page.locator("#ret-body tr", { hasText: "000005" }).locator("button").click()]);
  await cert.waitForLoadState();
  await expect(cert.locator(".doc .tipo")).toHaveText("Certificado de retención");
  await expect(cert.locator(".doc .num")).toHaveText("N° 000005");
  await expect(cert.locator("body")).toContainText("Agente de retención");
  await expect(cert.locator(".totales tr.total")).toContainText("Importe retenido");
});
