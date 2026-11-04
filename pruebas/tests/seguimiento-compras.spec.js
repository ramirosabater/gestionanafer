// Seguimiento de compras: solicitud del sector → orden de compra → recepciones
// (parcial y total) → tablero. Datos inventados.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

const ultima = async (page, tabla) => (await escrituras(page, tabla)).map((x) => x[2]);
const OCULTO = { grid: "oculta", branches: "oculta", company: "oculta", occasional: "oculta", day: "oculta", dashboard: "oculta",
  compras: "oculta", pagos: "oculta", tesoreria: "oculta", comercial: "oculta", rrhh: "oculta" };

function conJefe(db) {
  db.__cuentas["jefe@anafer.test"] = "clave123";
  db.app_config[0].roles.push({ id: "jefe", nombre: "Jefe de sector", manageAccess: false, permisos: { ...OCULTO, solicitudes: "editar" } });
  db.usuarios.push({ email: "jefe@anafer.test", activo: true, perfil: "jefe" });
  return db;
}
const SOL = {
  id: "sol_1", numero: 1, fecha: "2026-10-01", sector: "Mantenimiento", solicitante: "jefe@anafer.test", necesaria_para: "2099-12-31", urgente: false,
  motivo: "Sopladora 2", estado: "pendiente", notas_compras: "", gestiona: "", anulado_en: null,
  items: [
    { id: "it_a", descripcion: "Guantes de nitrilo", cantidad: 10, unidad: "Caja", proveedor_id: "", precio: 0, oc_id: "" },
    { id: "it_b", descripcion: "Correa A-42", cantidad: 4, unidad: "Unidad", proveedor_id: "", precio: 0, oc_id: "" },
  ],
};

test("el jefe de sector carga su solicitud con su usuario y solo ve Solicitudes", async ({ page }) => {
  const errores = await abrirGestion(page, conJefe(baseDePrueba({ ...datosCompras(), solicitudes_compra: [], recepciones: [] })), { email: "jefe@anafer.test" });
  await expect(page.locator("#tab-solicitudes")).toBeVisible().catch(async () => { await page.getByText("Administración").first().click(); });
  await expect(page.locator("#view-solicitudes")).toBeVisible();
  await expect(page.locator("#tab-compras")).toBeHidden();
  await expect(page.locator("#sc-f-mias")).toBeChecked();
  await page.click("#sc-nueva");
  await expect(page.locator("#sol-compras")).toBeHidden();
  await page.click("#sol-save");
  await expect(page.locator("#toast")).toContainText("sector");
  await page.selectOption("#sol-sector", "Mantenimiento");
  await page.fill("#sol-para", "2026-11-20");
  await page.check("#sol-urgente");
  const filas = page.locator("#sol-items tbody tr");
  await filas.nth(0).locator(".i-desc").fill("Guantes de nitrilo");
  await filas.nth(0).locator(".i-desc").dispatchEvent("change");
  await filas.nth(0).locator(".i-cant").fill("10");
  await filas.nth(0).locator(".i-cant").dispatchEvent("change");
  await page.click("#sol-add");
  await filas.nth(1).locator(".i-desc").fill("Correa A-42");
  await filas.nth(1).locator(".i-desc").dispatchEvent("change");
  await filas.nth(1).locator(".i-cant").fill("4");
  await filas.nth(1).locator(".i-cant").dispatchEvent("change");
  await page.fill("#sol-motivo", "Se cortó la correa de la sopladora 2");
  await page.click("#sol-save");
  await expect(page.locator("#sol-overlay")).not.toHaveClass(/show/);
  const s = (await ultima(page, "solicitudes_compra")).pop();
  expect([s.numero, s.sector, s.solicitante, s.urgente, s.estado, s.necesaria_para]).toEqual([1, "Mantenimiento", "jefe@anafer.test", true, "pendiente", "2026-11-20"]);
  expect(s.items.map((i) => [i.descripcion, i.cantidad])).toEqual([["Guantes de nitrilo", 10], ["Correa A-42", 4]]);
  await expect(page.locator("#sc-body")).toContainText("SC-0001");
  await expect(page.locator("#sc-body")).toContainText("Pendiente");
  expect(errores).toEqual([]);
});

test("Compras genera la orden desde la solicitud, recibe en dos veces y queda entregada", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba({ ...datosCompras(), solicitudes_compra: [SOL], recepciones: [] }), { email: "compras@anafer.test" });
  await page.click("#tab-solicitudes");
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="solicitudes"]');
  await expect(page.locator("#sc-f-mias")).not.toBeChecked();
  await page.locator("#sc-body tr", { hasText: "SC-0001" }).click();
  await expect(page.locator("#sol-compras")).toBeVisible();
  const filas = page.locator("#sol-items tbody tr");
  for (const [i, precio] of [[0, "1500"], [1, "8000"]]) {
    await filas.nth(i).locator(".i-prov").fill("Ferretería SA");
    await filas.nth(i).locator(".i-prov").dispatchEvent("change");
    await filas.nth(i).locator(".i-precio").fill(precio);
    await filas.nth(i).locator(".i-precio").dispatchEvent("change");
  }
  await page.selectOption("#sol-estado-sel", "cotizando");
  await page.fill("#sol-entrega", "2099-11-15");
  await page.click("#sol-generar-oc");
  await expect(page.locator("#toast")).toContainText("OC-0001");
  const oc = (await ultima(page, "ordenes_compra")).pop();
  expect([oc.proveedor_id, oc.monto, oc.estado, oc.entrega_prevista]).toEqual(["bien", 47000, "aprobada", "2099-11-15"]);
  expect(oc.items.map((i) => [i.item_id, i.cantidad, i.solicitud_id])).toEqual([["it_a", 10, "sol_1"], ["it_b", 4, "sol_1"]]);
  let s = (await ultima(page, "solicitudes_compra")).pop();
  expect(s.items.map((i) => i.oc_id)).toEqual(["oc_1", "oc_1"]);
  expect(s.gestiona).toBe("compras@anafer.test");
  await expect(page.locator("#sol-estado")).toContainText("Comprada");
  await page.click("#sol-cancel");

  // 1ª recepción: llegan los guantes y 2 de las 4 correas
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="recepciones"]');
  await page.click("#rc-nueva");
  await page.selectOption("#rec-oc", "oc_1");
  const rf = page.locator("#rec-items tbody tr");
  await expect(rf.nth(1).locator(".r-cant")).toHaveValue("4");
  await rf.nth(1).locator(".r-cant").fill("2");
  await expect(page.locator("#rec-resumen")).toContainText("falta 2 Correa A-42");
  await page.fill("#rec-remito", "0001-00000077");
  await page.click("#rec-save");
  await expect(page.locator("#rec-overlay")).not.toHaveClass(/show/);
  const r1 = (await ultima(page, "recepciones")).pop();
  expect([r1.numero, r1.oc_id, r1.remito, r1.con_diferencias, r1.cierra]).toEqual([1, "oc_1", "0001-00000077", false, false]);
  expect(r1.items.map((x) => [x.item_id, x.recibido])).toEqual([["it_a", 10], ["it_b", 2]]);
  expect((await ultima(page, "ordenes_compra")).length).toBe(1); // la OC sigue Aprobada (parcial)
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="solicitudes"]');
  await page.selectOption("#sc-f-estado", "");
  await expect(page.locator("#sc-body tr", { hasText: "SC-0001" })).toContainText("Recibida parcial");

  // 2ª recepción desde la orden de compra: llega el resto → OC Recibida y solicitud Entregada
  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="ocs"]');
  await expect(page.locator("#oc-body tr", { hasText: "OC-0001" })).toContainText("recepción parcial");
  await page.locator("#oc-body tr", { hasText: "OC-0001" }).click();
  await expect(page.locator("#ocm-recepciones")).toContainText("2 de 4");
  await page.click("#ocm-recibir");
  await expect(page.locator("#rec-overlay")).toHaveClass(/show/);
  await expect(page.locator("#rec-items tbody tr").nth(0).locator(".r-cant")).toHaveValue("0");
  await expect(page.locator("#rec-items tbody tr").nth(1).locator(".r-cant")).toHaveValue("2");
  await page.click("#rec-save");
  await expect(page.locator("#toast")).toContainText("quedó recibida");
  const oc2 = (await ultima(page, "ordenes_compra")).pop();
  expect(oc2.estado).toBe("recibida");
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="solicitudes"]');
  await expect(page.locator("#sc-body tr", { hasText: "SC-0001" })).toContainText("Entregada");
  // Tablero: recibido y todavía sin factura
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="seguimiento"]');
  await expect(page.locator("#sg-kpis .kpi-tile", { hasText: "Recibido sin factura" })).toContainText("1");
  await expect(page.locator("#sg-sin-factura")).toContainText("OC-0001");
  expect(errores).toEqual([]);
});

test("tablero: demoradas, facturado sin recepción y diferencias; exporta RG-0708", async ({ page }) => {
  const OC = { id: "oc_7", numero: 7, proveedor_id: "bien", fecha: "2026-09-20", descripcion: "SC-0002", monto: 10000, estado: "aprobada",
    items: [{ item_id: "it_x", solicitud_id: "sol_2", descripcion: "Tornillos", cantidad: 100, unidad: "Unidad", precio: 100 }], entrega_prevista: "2026-09-30" };
  const OC8 = { id: "oc_8", numero: 8, proveedor_id: "serv", fecha: "2026-10-02", descripcion: "SC-0003", monto: 5000, estado: "aprobada",
    items: [{ item_id: "it_y", solicitud_id: "sol_3", descripcion: "Pintura", cantidad: 2, unidad: "Litro", precio: 2500 }] };
  const sol2 = { ...SOL, id: "sol_2", numero: 2, sector: "Producción", necesaria_para: "2026-09-25", items: [{ id: "it_x", descripcion: "Tornillos", cantidad: 100, unidad: "Unidad", proveedor_id: "bien", precio: 100, oc_id: "oc_7" }] };
  const sol3 = { ...SOL, id: "sol_3", numero: 3, sector: "Calidad", necesaria_para: "2099-01-01", items: [{ id: "it_y", descripcion: "Pintura", cantidad: 2, unidad: "Litro", proveedor_id: "serv", precio: 2500, oc_id: "oc_8" }] };
  const REC = { id: "rec_1", numero: 1, fecha: "2026-10-05", oc_id: "oc_8", proveedor_id: "serv", remito: "R-1", items: [{ item_id: "it_y", descripcion: "Pintura", pedido: 2, recibido: 3 }],
    con_diferencias: true, cierra: false, observaciones: "Vino una lata de más", anulado_en: null, archivos: [] };
  const F7 = { id: "f7", proveedor_id: "bien", numero: "B-77", fecha: "2026-10-03", monto: 12100, estado: "pendiente", oc_id: "oc_7" };
  const errores = await abrirGestion(page, baseDePrueba({ ...datosCompras({ ordenes_compra: [OC, OC8], facturas: [F7] }), solicitudes_compra: [SOL, sol2, sol3], recepciones: [REC] }), { email: "compras@anafer.test" });
  await page.click("#tab-solicitudes");
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="solicitudes"]');
  await expect(page.locator("#sc-body tr", { hasText: "SC-0002" })).toContainText("⏰");
  await page.selectOption("#sc-f-estado", "");
  await expect(page.locator("#sc-body tr", { hasText: "SC-0003" })).toContainText("Entregada"); // llegó (de más): completa
  await page.click('#subtabs-solicitudes .stabbtn[data-sub="seguimiento"]');
  await expect(page.locator("#sg-kpis .kpi-tile", { hasText: "Demoradas" })).toContainText("1");
  await expect(page.locator("#sg-demoradas")).toContainText("SC-0002");
  await expect(page.locator("#sg-sin-recepcion")).toContainText("B-77");
  await expect(page.locator("#sg-diferencias")).toContainText("Vino una lata de más");
  await expect(page.locator("#sg-sin-factura")).toContainText("OC-0008");

  await page.click('#subtabs-solicitudes .stabbtn[data-sub="solicitudes"]');
  const [descarga] = await Promise.all([page.waitForEvent("download"), page.click("#sc-exportar")]);
  expect(descarga.suggestedFilename()).toMatch(/^RG-0708 Seguimiento de compras/);
  const txt = (await (await import("node:fs/promises")).readFile(await descarga.path(), "utf8")).replace(/^﻿/, "");
  const lineas = txt.split("\r\n");
  expect(lineas[0]).toBe("FECHA SOLICITUD;NRO SOLICITUD;SECTOR;INSUMO;CANTIDAD;PROVEEDOR;ESTADO;FECHA PEDIDO;FECHA ENTREGA;OBSERVACIONES;FACTURA ASOCIADA;MONTO FINAL");
  expect(lineas).toContain("01/10/2026;2;Producción;Tornillos;100;Ferretería SA;Demorado;20/09/2026;;Sopladora 2;B-77;12100");
  expect(lineas.find((l) => l.includes(";3;Calidad;"))).toContain(";Entregado;02/10/2026;05/10/2026;");
  expect(errores).toEqual([]);
});
