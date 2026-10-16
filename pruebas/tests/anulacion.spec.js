// Los comprobantes no se borran: se anulan (quién, cuándo, por qué) y el
// número no se vuelve a usar.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";
import { datosConOPPagada } from "../apoyo/datos-op.js";

function enDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }
const TABLAS = ["facturas", "ordenes_pago", "ordenes_compra", "movimientos", "cheques"];

async function sinBorrados(page) {
  for (const t of TABLAS) expect((await escrituras(page, t)).filter((x) => x[1] === "delete"), t).toEqual([]);
}
async function anular(page, boton, motivo) {
  await page.click(boton);
  await expect(page.locator("#anular-overlay")).toHaveClass(/show/);
  await page.click("#anul-ok");                                    // sin motivo no deja
  await expect(page.locator("#toast")).toContainText("motivo");
  await page.fill("#anul-motivo", motivo);
  await page.click("#anul-ok");
  await expect(page.locator("#anular-overlay")).not.toHaveClass(/show/);
}


test("factura: se anula con motivo, queda tachada y deja de estar pendiente", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.locator("#facturas-body tr", { hasText: "S-1" }).click();
  await expect(page.locator("#fm-delete")).toHaveText("Anular");
  await anular(page, "#fm-delete", "Cargada dos veces");

  const f = (await escrituras(page, "facturas")).map((x) => x[2]).pop();
  expect(f).toMatchObject({ id: "s1", estado: "anulada", anulado_por: "compras@anafer.test", motivo_anulacion: "Cargada dos veces" });
  expect(f.anulado_en).toBeTruthy();
  await sinBorrados(page);

  const fila = page.locator("#facturas-body tr", { hasText: "S-1" });
  await expect(fila).toHaveClass(/anulado/);
  await expect(fila).toContainText("Anulada");
  // Ya no la propone la sugerencia de pagos ni se puede elegir en una orden
  await page.click('#subtabs-pagos .stabbtn[data-sub="sugerencia"]');
  await expect(page.locator("#sug-tbody")).not.toContainText("S-1");
  // Abierta: solo lectura, con la leyenda
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await fila.click();
  await expect(page.locator("#factura-overlay .anulado-banner")).toContainText("Motivo: Cargada dos veces");
  await expect(page.locator("#fm-save")).toBeHidden();
  await expect(page.locator("#fm-numero")).toBeDisabled();
});

test("factura incluida en una orden de pago vigente no se puede anular", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosConOPPagada()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.locator("#facturas-body tr", { hasText: "MO-1" }).click();
  await page.click("#fm-delete");
  await expect(page.locator("#toast")).toContainText("OP-0007");
  await expect(page.locator("#anular-overlay")).not.toHaveClass(/show/);
});

test("orden de pago pagada: al anularla vuelve todo atrás sin borrar nada y el número no se reutiliza", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosConOPPagada()), { email: "compras@anafer.test" });
  await page.click("#tab-tesoreria");
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$1.785.000,00");

  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.locator("#pagos-body tr", { hasText: "OP-0007" }).click();
  await anular(page, "#pom-delete", "Se pagó por otro lado");

  const op = (await escrituras(page, "ordenes_pago")).map((x) => x[2]).pop();
  expect(op).toMatchObject({ id: "op7", numero: 7, estado: "anulada", motivo_anulacion: "Se pagó por otro lado" });
  const fact = (await escrituras(page, "facturas")).map((x) => x[2]).pop();
  expect(fact).toMatchObject({ id: "mo1", estado: "pendiente" });
  const chq = (await escrituras(page, "cheques")).map((x) => x[2]).pop();
  expect(chq).toMatchObject({ id: "c1", estado: "cartera" });
  const movs = (await escrituras(page, "movimientos")).map((x) => x[2]);
  expect(movs.map((m) => m.id).sort()).toEqual(["mov_op_op7", "mov_op_op7_2"]);
  movs.forEach((m) => expect(m.anulado_en).toBeTruthy());
  await sinBorrados(page);
  await expect(page.locator("#pagos-body tr", { hasText: "OP-0007" })).toHaveClass(/anulado/);

  // El certificado 000005 sigue en el listado, marcado como anulado y sin sumar
  await page.click('#subtabs-pagos .stabbtn[data-sub="retenciones"]');
  const cert = page.locator("#ret-body tr", { hasText: "000005" });
  await expect(cert).toContainText("Anulado");
  await expect(page.locator("#ret-resumen")).toHaveText("");

  // La plata vuelve: el egreso anulado no cuenta en el saldo
  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cuentas"]');
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$1.985.000,00");

  // Una orden nueva no reutiliza el 7
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.click("#pom-save");
  const nueva = (await escrituras(page, "ordenes_pago")).map((x) => x[2]).pop();
  expect(nueva.numero).toBe(8);
});

test("movimiento manual y orden de compra: se anulan y quedan registrados", async ({ page }) => {
  const db = datosConOPPagada();
  db.ordenes_compra = [{ id: "oc3", numero: 3, proveedor_id: "bien", fecha: enDias(0), descripcion: "Bulones", monto: 50000, estado: "pendiente", notas: "", who: "" }];
  await abrirGestion(page, baseDePrueba(db), { email: "compras@anafer.test" });

  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await page.locator("#movimientos-body tr", { hasText: "Gasto mal cargado" }).click();
  await anular(page, "#movm-delete", "Importe equivocado");
  const m = (await escrituras(page, "movimientos")).map((x) => x[2]).pop();
  expect(m).toMatchObject({ id: "mov_caja", motivo_anulacion: "Importe equivocado" });
  await expect(page.locator("#movimientos-body tr", { hasText: "Gasto mal cargado" })).toHaveClass(/anulado/);
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cuentas"]');
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$1.800.000,00");

  await page.click("#tab-compras");
  await page.click('#subtabs-compras .stabbtn[data-sub="ocs"]');
  await page.locator("#oc-body tr", { hasText: "OC-0003" }).click();
  await anular(page, "#ocm-delete", "El proveedor no tenía stock");
  const oc = (await escrituras(page, "ordenes_compra")).map((x) => x[2]).pop();
  expect(oc).toMatchObject({ id: "oc3", numero: 3, estado: "anulada" });
  await expect(page.locator("#oc-body tr", { hasText: "OC-0003" })).toContainText("Anulada");
  await sinBorrados(page);
});
