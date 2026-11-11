// Lectura automática de facturas: pasa por la función del servidor
// "leer-factura"; la clave de Anthropic nunca está en el navegador.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");

async function abrirNuevaFactura(page) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
}

test("leer factura desde una foto: completa los datos (menos el proveedor) y la muestra al costado", async ({ page }) => {
  const db = baseDePrueba(datosCompras({ __funciones: { "leer-factura": { data: { data: { proveedor_nombre: "Servicios SA", numero: "A-0001-00012345", fecha: "2026-10-10", monto: 121000.5 } }, error: null } } }));
  await abrirGestion(page, db, { email: "compras@anafer.test" });
  await abrirNuevaFactura(page);
  await expect(page.locator("#fm-read-row")).toBeVisible();      // no depende de ninguna clave en config.js
  await page.setInputFiles("#fm-read-input", { name: "factura.png", mimeType: "image/png", buffer: PNG });
  await expect(page.locator("#fm-numero")).toHaveValue("A-0001-00012345");
  // aunque el servidor devolviera un proveedor, no se completa: lo elige el operador
  await expect(page.locator("#fm-proveedor-input")).toHaveValue("");
  await expect(page.locator("#fm-vista")).toBeVisible();
  await expect(page.locator("#fm-vista-cuerpo img")).toHaveCount(1);
  await expect(page.locator("#fm-vista-nombre")).toHaveText("factura.png");
  await expect(page.locator("#fm-fecha")).toHaveValue("2026-10-10");
  const llamada = (await escrituras(page, "__funciones")).pop();
  expect(llamada[1]).toBe("leer-factura");
  expect(llamada[2].mediaType).toBe("image/png");
  expect(llamada[2].proveedores).toBeUndefined();
  expect(await page.evaluate(() => typeof window.ANTHROPIC_API_KEY === "string" && window.ANTHROPIC_API_KEY.length > 0)).toBe(false);
  // se oculta y se vuelve a ver; al cerrar la factura desaparece
  await page.click("#fm-vista-cerrar");
  await expect(page.locator("#fm-vista")).toBeHidden();
  await page.click("#fm-ver-archivo");
  await expect(page.locator("#fm-vista")).toBeVisible();
  await page.click("#fm-cancel");
  await page.click("#new-factura-btn");
  await expect(page.locator("#fm-vista")).toBeHidden();
  await expect(page.locator("#fm-ver-archivo")).toBeHidden();
});

test("PDF: la vista previa usa el visor del navegador al costado", async ({ page }) => {
  const db = baseDePrueba(datosCompras({ __funciones: { "leer-factura": { data: { data: { numero: "B-1", monto: 100 } }, error: null } } }));
  await abrirGestion(page, db, { email: "compras@anafer.test" });
  await abrirNuevaFactura(page);
  await page.evaluate(() => { window.pdfjsLib = undefined; });   // sin pdf.js la lectura falla, pero la vista igual se muestra
  await page.setInputFiles("#fm-read-input", { name: "factura.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await expect(page.locator("#fm-vista-cuerpo iframe")).toHaveCount(1);
  await expect(page.locator("#factura-overlay")).toHaveClass(/con-vista/);
});

test("si la función no está instalada en Supabase, lo dice claro", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await abrirNuevaFactura(page);
  await page.setInputFiles("#fm-read-input", { name: "factura.jpg", mimeType: "image/jpeg", buffer: PNG });
  await expect(page.locator("#toast")).toContainText("falta la función leer-factura");
});
