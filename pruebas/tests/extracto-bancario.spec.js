// Tesorería → Importar extracto del banco: archivo de movimientos del home
// banking (formato Santander: texto con tabulaciones, Latin-1). Datos inventados.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

const T = "\t";
function archivoSantander(lineas, saldo) {
  const txt = ["Movimientos del Día", "", "Cuenta corriente en Pesos Nro. 000-000000/0", "",
    ["Fecha", "Suc. Origen", "Desc. Sucursal", "Cod. Operativo", "Referencia", "Concepto", "Importe", "Saldo"].join(T),
    ...lineas.map((l) => ["10/11/2026", "0000", "Casa Central - Work Café", l[0], l[1], l[2], l[3], ""].join(T)),
    "", `Saldo al 11/11/2026 ${saldo}`, "", "11/11/2026 15:12:10", ""].join("\r\n");
  return Buffer.from(txt, "latin1");
}
const LINEAS = [
  ["4805", "00000001", "Transferencia recibida - De cliente uno sa / anafer - fac / 30700000001", "6.900,00"],
  ["4805", "00000002", "Transferencia recibida - De cliente dos srl / anafer - fac / 30700000002", "17.800,00"],
  ["2030", "00000003", "Deposito de efectivo en sucursal - Casa Central", "100.000,00"],
  ["1253", "00000004", "Transferencia enviada - A proveedor del pago", "-250.000,00"],
];

test("importa el extracto: registra lo nuevo, concilia lo ya cargado y no duplica al volver a subirlo", async ({ page }) => {
  const db = baseDePrueba(datosCompras({
    // pago de una OP por transferencia que ya estaba cargado (fecha del día anterior)
    movimientos: [{ id: "mov_op_x", cuenta_id: "bco", fecha: "2026-11-09", concepto: "OP 0001 · Proveedor", monto: 250000, tipo: "egreso", pago_id: null, medio_id: "tr1", cheque_ids: [] }],
  }));
  const errores = await abrirGestion(page, db, { email: "compras@anafer.test" });
  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await page.click("#import-extracto-btn");
  await expect(page.locator("#ext-cuenta")).toHaveValue("bco");     // única cuenta banco
  await page.setInputFiles("#ext-file", { name: "descargaUltimosMovimientos.xls", mimeType: "application/vnd.ms-excel", buffer: archivoSantander(LINEAS, "1.874.700,00") });

  await expect(page.locator("#ext-body tr")).toHaveCount(4);
  await expect(page.locator("#ext-resumen")).toContainText("3 nuevas");
  await expect(page.locator("#ext-resumen")).toContainText("1 ya cargadas");
  await expect(page.locator("#ext-body tr", { hasText: "proveedor del pago" })).toContainText("Ya cargado");
  // 2.000.000 − 250.000 + 124.700 = 1.874.700: coincide con el banco
  await expect(page.locator("#ext-resumen .ext-saldo")).toHaveClass(/ok/);
  await expect(page.locator("#ext-save")).toHaveText("Registrar 3 y conciliar 1");
  await page.click("#ext-save");
  await expect(page.locator("#toast")).toContainText("3 movimientos registrados · 1 conciliado");

  const movs = (await escrituras(page, "movimientos")).map((x) => x[2]);
  const nuevos = movs.filter((m) => m.id.startsWith("mov_bco_"));
  expect(nuevos.map((m) => [m.fecha, m.tipo, m.monto])).toEqual([
    ["2026-11-10", "ingreso", 6900], ["2026-11-10", "ingreso", 17800], ["2026-11-10", "ingreso", 100000]]);
  expect(nuevos.every((m) => m.banco_ref && m.cuenta_id === "bco")).toBe(true);
  const conc = movs.find((m) => m.id === "mov_op_x");
  expect(conc.banco_ref).toBeTruthy();
  expect(conc.fecha).toBe("2026-11-09");                       // no se toca lo ya cargado
  await expect(page.locator("#movimientos-body")).toContainText("Extracto");
  await expect(page.locator("#movimientos-body .mov-conciliado")).toHaveCount(4);

  // se vuelve a subir el mismo día con una línea más: solo entra la nueva
  await page.click("#import-extracto-btn");
  await page.setInputFiles("#ext-file", { name: "otra.xls", mimeType: "application/vnd.ms-excel",
    buffer: archivoSantander([...LINEAS, ["4805", "00000005", "Transferencia recibida - De cliente tres", "1.000,00"]], "1.875.700,00") });
  await expect(page.locator("#ext-resumen")).toContainText("1 nuevas");
  await expect(page.locator("#ext-resumen")).toContainText("4 ya importadas antes");
  await expect(page.locator("#ext-save")).toHaveText("Registrar 1 movimiento");
  // destildar la única nueva: no hay nada para registrar
  await page.locator("#ext-body .ext-chk").uncheck();
  await expect(page.locator("#ext-save")).toBeDisabled();
  expect(errores).toEqual([]);
});

test("archivo que no es de movimientos: avisa y no registra nada", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await page.click("#import-extracto-btn");
  await page.setInputFiles("#ext-file", { name: "x.csv", mimeType: "text/csv", buffer: Buffer.from("nombre;apellido\nana;perez\n") });
  await expect(page.locator("#toast")).toContainText("No reconozco el archivo");
  await expect(page.locator("#ext-save")).toBeDisabled();
});
