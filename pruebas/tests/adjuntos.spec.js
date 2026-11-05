// Adjuntos de Gestión en la unidad compartida "Gestión Anafer": se suben y se
// abren por la función del servidor (adjuntos-drive), con carpeta por módulo.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras, FACTURAS } from "../apoyo/datos-compras.js";

async function simularFuncion(page) {
  const llamadas = [];
  await page.route(/\/functions\/v1\/adjuntos-drive$/, async (r) => {
    const req = r.request();
    const ct = req.headers()["content-type"] || "";
    let b;
    if (ct.includes("multipart/form-data")) {
      const cuerpo = req.postDataBuffer().toString("utf8");
      const campo = (n) => (cuerpo.match(new RegExp(`name="${n}"\\r\\n\\r\\n([^\\r]*)`)) || [])[1];
      b = { accion: campo("accion"), modulo: campo("modulo"), carpetas: JSON.parse(campo("carpetas") || "[]"), archivo: (cuerpo.match(/filename="([^"]+)"/) || [])[1] };
    } else b = JSON.parse(req.postData() || "{}");
    llamadas.push({ ...b, auth: req.headers()["authorization"] || "" });
    if (b.accion === "subir") return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, archivo: { id: "DRV" + llamadas.length + "abcdefghij", name: b.archivo, contentType: "application/pdf", sizeBytes: 9, unidad: true } }) });
    if (b.accion === "abrir") return r.fulfill({ contentType: "application/pdf", body: "%PDF-1.4" });
    return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return llamadas;
}

test("factura con adjunto: va a Administración / Facturas / proveedor en la unidad y se abre por el servidor", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  const llamadas = await simularFuncion(page);
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  await page.fill("#fm-proveedor-input", "Ferret");
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.selectOption("#fm-centro-costo", "cc_logistica_deposito");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await page.selectOption("#fm-concepto", "gasoil");
  await page.fill("#fm-numero", "B-0001-00000077");
  await page.fill("#fm-monto", "12100");
  await page.setInputFiles("#fm-archivo-input", { name: "factura77.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 x") });
  await expect(page.locator("#fm-archivos-list")).toContainText("se sube a Drive al guardar");
  await page.click("#fm-save");
  await expect(page.locator("#factura-overlay")).not.toHaveClass(/show/);
  expect(llamadas[0]).toMatchObject({ accion: "subir", modulo: "administracion", carpetas: ["Facturas", "Ferretería SA"], archivo: "factura77.pdf" });
  expect(llamadas[0].auth).toMatch(/^Bearer /);
  const f = (await escrituras(page, "facturas")).map((x) => x[2]).pop();
  expect(f.archivos).toEqual([{ id: "DRV1abcdefghij", url: "", name: "factura77.pdf", contentType: "application/pdf", sizeBytes: 9, unidad: true, modulo: "administracion" }]);

  // Se abre desde la app (nadie tiene enlace de Drive)
  await page.locator("#facturas-body tr", { hasText: "B-0001-00000077" }).click();
  const popup = page.waitForEvent("popup");
  await page.locator("#fm-archivos-list a", { hasText: "factura77.pdf" }).click();
  await popup;
  await expect.poll(() => llamadas.filter((l) => l.accion === "abrir").length).toBe(1);
  expect(llamadas.find((l) => l.accion === "abrir")).toMatchObject({ modulo: "administracion", id: "DRV1abcdefghij" });
  // Quitarlo lo manda a la papelera de la unidad
  await page.locator("#fm-archivos-list .attach-del").click();
  await expect.poll(() => llamadas.filter((l) => l.accion === "quitar").length).toBe(1);
  expect(errores).toEqual([]);
});

test("proveedor: sus archivos van a Administración / Proveedores / nombre; en ⚙ → Acceso avisa de los adjuntos viejos", async ({ page }) => {
  const VIEJA = { ...FACTURAS[0], archivos: [{ id: "viejo1", url: "https://drive.google.com/file/d/viejo1/view", name: "vieja.pdf", contentType: "application/pdf", sizeBytes: 5 }] };
  const errores = await abrirGestion(page, baseDePrueba(datosCompras({ facturas: [VIEJA, ...FACTURAS.slice(1)] })), { email: "admin@anafer.test" });
  const llamadas = await simularFuncion(page);
  await page.getByRole("button", { name: /Administración Proveedores/ }).click();
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="proveedores"]');
  await page.locator("#proveedores-body tr", { hasText: "Servicios SA" }).click();
  await page.setInputFiles("#pm-archivo-input", { name: "constancia-afip.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 y") });
  await page.click("#pm-save");
  await expect.poll(() => llamadas.length).toBe(1);
  expect(llamadas[0]).toMatchObject({ accion: "subir", modulo: "administracion", carpetas: ["Proveedores", "Servicios SA"], archivo: "constancia-afip.pdf" });

  await page.click("#settings-btn");
  await page.click("#scatbtn-acceso");
  await page.click('#acc-tabs button[data-acc="drive"]');
  await expect(page.locator("#adj-mig-msg")).toContainText("Hay 1 adjunto(s) subidos antes");
  await expect(page.locator("#adj-mig-btn")).toBeVisible();
  expect(errores).toEqual([]);
});
