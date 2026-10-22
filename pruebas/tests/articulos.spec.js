// Proveedores que cargan artículos: base de artículos (Compras → Artículos) y
// detalle de artículos en la factura, aparte de la imputación.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras, PROVEEDORES, FACTURAS } from "../apoyo/datos-compras.js";

const ARTICULOS = [
  { id: "a1", codigo: "00001", descripcion: "Tapa 28 mm azul", unidad: "Unidad", categoria: "Envases", activo: true },
  { id: "a2", codigo: "00002", descripcion: "Etiqueta soda 1.5L", unidad: "Rollo", categoria: "Envases", activo: true },
  { id: "a9", codigo: "00009", descripcion: "Artículo viejo", unidad: "Unidad", categoria: "", activo: false },
];
function datos() {
  return baseDePrueba(datosCompras({
    articulos: ARTICULOS,
    proveedores: PROVEEDORES.map((p) => (p.id === "bien" ? { ...p, lleva_articulos: true } : { ...p, lleva_articulos: false })),
    facturas: [...FACTURAS, { id: "bv", proveedor_id: "bien", numero: "B-0", fecha: "2026-09-10", monto: 605, estado: "pagada",
      articulos: [{ articulo_id: "a1", cantidad: 10, precio: 50, importe: 500 }] }],
  }));
}
async function nuevaFactura(page, prov) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  await page.fill("#fm-proveedor-input", prov);
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.selectOption("#fm-centro-costo", "cc_logistica_deposito");
  await page.dispatchEvent("#fm-centro-costo", "change");
  await page.selectOption("#fm-concepto", "gasoil");
}

test("factura de un proveedor que carga artículos: elige, sugiere el último precio, crea uno nuevo y guarda el detalle", async ({ page }) => {
  const errores = await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await nuevaFactura(page, "Ferret");
  await expect(page.locator("#fm-articulos")).toBeVisible();
  await page.fill("#fm-numero", "B-9");
  await page.fill("#fm-monto", "1.331");                       // RI: neto automático 1.100
  await page.click("#fm-save");
  await expect(page.locator("#toast")).toContainText("agregá al menos un artículo");

  // 1ª línea: por código; el precio sale del último pagado (50)
  const l1 = page.locator("#fm-art-lines .art-line").nth(0);
  await l1.locator(".art").fill("00001");
  await l1.locator(".art").dispatchEvent("change");
  await expect(l1.locator(".art")).toHaveValue("00001 · Tapa 28 mm azul");
  await expect(l1.locator(".precio")).toHaveValue("50");
  await l1.locator(".cant").fill("10");
  await expect(l1.locator(".imp")).toHaveText("$500,00");
  // 2ª línea: un artículo que no existe → se crea desde la factura
  await page.click("#fm-art-add");
  const l2 = page.locator("#fm-art-lines .art-line").nth(1);
  await l2.locator(".art").fill("Cinta de embalar 48mm");
  await l2.locator(".art").dispatchEvent("change");
  await expect(page.locator("#fm-art-lines")).toContainText("no está en la base");
  await page.getByRole("button", { name: "Crearlo como artículo nuevo" }).click();
  await expect(page.locator("#artm-descripcion")).toHaveValue("Cinta de embalar 48mm");
  await page.fill("#artm-categoria", "Embalaje");
  await page.click("#artm-save");
  await expect(page.locator("#fm-art-lines .art-line").nth(1).locator(".art")).toHaveValue("00010 · Cinta de embalar 48mm");
  await page.locator("#fm-art-lines .art-line").nth(1).locator(".cant").fill("2");
  await page.locator("#fm-art-lines .art-line").nth(1).locator(".precio").fill("300");
  await expect(page.locator("#fm-art-total")).toContainText("Total artículos $1.100,00");
  await expect(page.locator("#fm-art-total")).toContainText("✓");
  await page.click("#fm-save");

  const nuevo = (await escrituras(page, "articulos")).map((x) => x[2]).pop();
  expect(nuevo).toMatchObject({ codigo: "00010", descripcion: "Cinta de embalar 48mm", categoria: "Embalaje", unidad: "Unidad", activo: true });
  const f = (await escrituras(page, "facturas")).map((x) => x[2]).find((x) => x.numero === "B-9");
  expect(f.articulos).toEqual([
    { articulo_id: "a1", cantidad: 10, precio: 50, importe: 500 },
    { articulo_id: nuevo.id, cantidad: 2, precio: 300, importe: 600 },
  ]);
  expect(f.centro_costo_id).toBe("cc_logistica_deposito");   // la imputación sigue igual
  expect(errores).toEqual([]);
});

test("proveedor sin el tilde: no aparecen artículos; el tilde se guarda desde la ficha", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await nuevaFactura(page, "Servicios");
  await expect(page.locator("#fm-articulos")).toBeHidden();
  await page.click("#fm-cancel");
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="proveedores"]');
  await expect(page.locator("#proveedores-body tr", { hasText: "Ferretería" })).toContainText("📦");
  await page.locator("#proveedores-body tr", { hasText: "Servicios SA" }).click();
  await page.check("#pm-lleva-articulos");
  await page.click("#pm-save");
  const p = (await escrituras(page, "proveedores")).map((x) => x[2]).pop();
  expect(p).toMatchObject({ id: "serv", lleva_articulos: true });
});

test("Compras → Artículos: lista con lo comprado, búsqueda, inactivos y no se borra uno usado", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="articulos"]');
  const fila = page.locator("#articulos-body tr", { hasText: "Tapa 28 mm" });
  await expect(fila).toContainText("10 unidad");
  await expect(fila).toContainText("$50,00");
  await expect(page.locator("#articulos-body tr")).toHaveCount(2);           // el inactivo no se ve
  await page.selectOption("#articulos-filter", "inactivos");
  await expect(page.locator("#articulos-body")).toContainText("Artículo viejo");
  await page.selectOption("#articulos-filter", "activos");
  await page.fill("#articulos-search", "etiq");
  await expect(page.locator("#articulos-body tr")).toHaveCount(1);
  await page.fill("#articulos-search", "");
  await fila.click();
  await expect(page.locator("#artm-uso")).toContainText("Está en 1 factura");
  page.once("dialog", (d) => d.accept());
  await page.click("#artm-delete");
  await expect(page.locator("#toast")).toContainText("No se puede eliminar");
  // código repetido
  await page.click("#artm-cancel");
  await page.click("#new-articulo-btn");
  await page.fill("#artm-codigo", "00002");
  await page.fill("#artm-descripcion", "Otra cosa");
  await page.click("#artm-save");
  await expect(page.locator("#toast")).toContainText("ya es de");
});
