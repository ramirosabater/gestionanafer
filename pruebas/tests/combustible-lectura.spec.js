// Lectura de facturas de combustible: un PDF con varias facturas (una por
// página), cada una con móvil (interno), patente, chofer, km y litros.
// Datos inventados (con el formato de las facturas de las estaciones).
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras, PROVEEDORES, FACTURAS, CENTROS } from "../apoyo/datos-compras.js";

const ESTACION = { id: "est", nombre: "Estación de Servicio Ruta 3", cuit: "30-70000000-1", condicion_iva: "Responsable inscripto", combustible: true };
const TRUCKS = [
  { id: "36", label: "Camión 36 · Accelo 1016", active: true, scope: "both", patente: "AF 123 CZ" },
  { id: "41", label: "Camión 41 · Atego", active: true, scope: "both", patente: "AG 241 CA" },
];
// Gasoil por móvil: un centro por camión (como Logística › Móviles)
const CC = [...CENTROS,
  { id: "cc_moviles_36", codigo: "", descripcion: "Móvil 36", parent_id: "cc_logistica_moviles", activo: true, requiere: "", orden: 5, ref_fijo: "movil:36" },
  { id: "cc_moviles_41", codigo: "", descripcion: "Móvil 41", parent_id: "cc_logistica_moviles", activo: true, requiere: "", orden: 6, ref_fijo: "movil:41" },
].map((c) => (c.id === "cc_logistica_moviles" ? { ...c, requiere: "" } : c));
const LEIDO = [
  { pagina: 1, numero: "0044-00034047", fecha: "2026-11-10", monto: 225185.04, notas: null,
    combustible: { movil: "36", patente: "AF123CZ", chofer: "GOMEZ", km: 139402, litros: 87.1122, otros: null } },
  // la patente de la factura está mal tipeada: se reconoce por el interno
  { pagina: 2, numero: "0043-00045379", fecha: "2026-11-04", monto: 441767.78, notas: null,
    combustible: { movil: "41", patente: "AG 421 CA", chofer: "PEREZ", km: 65290, litros: 148.03, otros: "20,90 L Azul 32" } },
];

test("PDF con dos facturas de combustible: completa móvil, patente, chofer, km y litros y carga una tras otra", async ({ page }) => {
  const db = baseDePrueba(datosCompras({ proveedores: [...PROVEEDORES, ESTACION], facturas: FACTURAS, centros_costo: CC,
    __funciones: { "leer-factura": { data: { data: LEIDO[0], facturas: LEIDO }, error: null } } }));
  db.trucks = TRUCKS;
  const errores = await abrirGestion(page, db, { email: "compras@anafer.test" });
  const subidas = [];
  await page.route(/\/functions\/v1\/adjuntos-drive$/, async (r) => {
    subidas.push(1);
    return r.fulfill({ contentType: "application/json", body: JSON.stringify({ ok: true, archivo: { id: "DRVcomb1234567", name: "resumen-estacion.pdf", contentType: "application/pdf", sizeBytes: 9, unidad: true } }) });
  });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  await page.fill("#fm-proveedor-input", "Estación");
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.selectOption("#fm-centro-costo", "cc_moviles_41");          // la imputación habitual: un móvil
  await page.dispatchEvent("#fm-centro-costo", "change");
  await page.selectOption("#fm-concepto", "gasoil");
  await page.setInputFiles("#fm-read-input", { name: "resumen-estacion.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });

  // 1ª factura
  await expect(page.locator("#fm-cola")).toContainText("2 facturas");
  await expect(page.locator("#fm-cola")).toContainText("1 de 2");
  await expect(page.locator("#fm-numero")).toHaveValue("0044-00034047");
  await expect(page.locator("#fm-km")).toHaveValue("139.402");
  await expect(page.locator("#fm-litros")).toHaveValue("87,11");
  await expect(page.locator("#fm-movil")).toHaveValue("36");
  await expect(page.locator("#fm-patente")).toHaveValue("AF123CZ");
  await expect(page.locator("#fm-chofer")).toHaveValue("GOMEZ");
  await expect(page.locator("#fm-centro-costo")).toHaveValue("cc_moviles_36");   // pasó al centro del móvil leído
  await expect(page.locator("#fm-proveedor-input")).toHaveValue("Estación de Servicio Ruta 3");
  // el llamado manda el PDF entero
  const llamada = (await escrituras(page, "__funciones")).filter((x) => x[1] === "leer-factura").pop();
  expect(llamada[2].mediaType).toBe("application/pdf");
  await page.click("#fm-save");

  // 2ª factura: se abre sola, con el mismo proveedor y el archivo ya subido
  await expect(page.locator("#fm-cola")).toContainText("2 de 2");
  await expect(page.locator("#fm-numero")).toHaveValue("0043-00045379");
  await expect(page.locator("#fm-movil")).toHaveValue("41");
  await expect(page.locator("#fm-km")).toHaveValue("65.290");
  await expect(page.locator("#fm-notas")).toHaveValue(/Azul 32/);
  await expect(page.locator("#fm-proveedor-input")).toHaveValue("Estación de Servicio Ruta 3");
  await expect(page.locator("#fm-archivos-list")).toContainText("resumen-estacion.pdf");
  await expect(page.locator("#fm-archivos-list")).not.toContainText("se sube a Drive");
  await page.click("#fm-save");
  await expect(page.locator("#toast")).toContainText("se cargaron 2 facturas");
  await expect(page.locator("#factura-overlay")).not.toHaveClass(/show/);

  const fs = (await escrituras(page, "facturas")).map((x) => x[2]).filter((f) => f.proveedor_id === "est");
  expect(fs.map((f) => [f.numero, f.movil, f.patente, f.chofer, f.km, f.litros, f.centro_costo_id])).toEqual([
    ["0044-00034047", "36", "AF123CZ", "GOMEZ", 139402, 87.11, "cc_moviles_36"],
    ["0043-00045379", "41", "AG241CA", "PEREZ", 65290, 148.03, "cc_moviles_41"],
  ]);
  expect(fs[0].archivos[0].id).toBe("DRVcomb1234567");
  expect(fs[1].archivos[0].id).toBe("DRVcomb1234567");     // el mismo archivo, subido una sola vez
  expect(subidas.length).toBe(1);
  expect(errores).toEqual([]);
});

test("móvil que no está en Camiones: avisa y deja elegirlo a mano", async ({ page }) => {
  const otro = { ...LEIDO[0], combustible: { ...LEIDO[0].combustible, movil: "99", patente: "ZZ999ZZ" } };
  const db = baseDePrueba(datosCompras({ proveedores: [...PROVEEDORES, ESTACION], facturas: FACTURAS, centros_costo: CC,
    __funciones: { "leer-factura": { data: { data: otro, facturas: [otro] }, error: null } } }));
  db.trucks = TRUCKS;
  await abrirGestion(page, db, { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  await page.setInputFiles("#fm-read-input", { name: "f.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%%EOF") });
  await expect(page.locator("#toast")).toContainText("no está en ⚙ → Camiones");
  await expect(page.locator("#fm-cola")).toBeHidden();
  await expect(page.locator("#fm-movil")).toHaveValue("");
  await expect(page.locator("#fm-patente")).toHaveValue("ZZ999ZZ");
  await page.selectOption("#fm-movil", "41");
  await expect(page.locator("#fm-patente")).toHaveValue("AG241CA");
});
