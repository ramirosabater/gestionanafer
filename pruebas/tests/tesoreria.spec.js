// Pagos con cheque/echeq propio diferido: la plata sale del banco el día de
// cobro (para el cashflow), no el día de la orden de pago.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

function enDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

test("echeq a 60 días: el egreso queda en la fecha de cobro y solo baja el saldo proyectado", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  const hoy = enDias(0), cobro = enDias(60);
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");          // monotributo: sin retención, monto redondo
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.fill("#pom-fecha", hoy);
  await page.selectOption("#pom-estado", "pagada");
  await page.selectOption("#pom-formas .forma >> nth=0 >> .f-medio", "ecs");
  await page.fill("#pom-formas .f-chqnum", "E-777");
  await page.fill("#pom-formas .f-chqfecha", cobro);
  await page.dispatchEvent("#pom-formas .f-chqfecha", "change");
  await page.click("#pom-save");

  const mov = (await escrituras(page, "movimientos")).map((x) => x[2]).pop();
  expect(mov.fecha).toBe(cobro);
  expect(mov.monto).toBe(500000);

  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cuentas"]');
  const fila = page.locator("#cuentas-body tr", { hasText: "Banco Santander" });
  await expect(fila).toContainText("$2.000.000,00");   // saldo hoy: todavía no se debitó
  await expect(fila).toContainText("−$500.000,00");     // a debitar
  await expect(fila).toContainText("$1.500.000,00");   // proyectado

  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await expect(page.locator("#movimientos-body tr.mov-futuro")).toContainText("a debitar");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cheques"]');
  await page.selectOption("#cheque-filter-estado", "emitido");
  await expect(page.locator("#cheques-body")).toContainText("Emitido · a debitar");
});

test("transferencia: el egreso queda el día del pago y baja el saldo hoy", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.fill("#pom-fecha", enDias(0));
  await page.selectOption("#pom-estado", "pagada");
  await page.selectOption("#pom-formas .forma >> nth=0 >> .f-medio", "tr1");
  await page.click("#pom-save");
  const mov = (await escrituras(page, "movimientos")).map((x) => x[2]).pop();
  expect(mov.fecha).toBe(enDias(0));
  await page.click("#tab-tesoreria");
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$1.500.000,00");
});

test("pago mixto: cheque de cartera + transferencia por la diferencia", async ({ page }) => {
  const extra = datosCompras({
    cuentas: [
      { id: "bco", nombre: "Banco Santander", tipo: "banco", saldo_inicial: 2000000 },
      { id: "cartera_cheques", nombre: "Cartera de cheques", tipo: "cartera", saldo_inicial: 0 },
    ],
    medios_caja: [
      { id: "tr1", codigo: "TR1", nombre: "Transferencia", cuenta_id: "bco", cheque: "no", activo: true },
      { id: "che", codigo: "CHE", nombre: "Cheque de terceros", cuenta_id: "cartera_cheques", cheque: "cartera", activo: true },
    ],
    cheques: [{ id: "c1", banco: "Banco Nación", numero: "111", titular: "Cliente X", importe: 300000, estado: "cartera", fecha_cobro: enDias(10), cuenta_id: "cartera_cheques" }],
  });
  await abrirGestion(page, baseDePrueba(extra), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");          // 500.000, sin retención
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.fill("#pom-fecha", enDias(0));
  await page.selectOption("#pom-estado", "pagada");
  // 1) cheque de cartera de 300.000
  await page.selectOption("#pom-formas .forma >> nth=0 >> .f-medio", "che");
  await page.locator("#pom-formas .forma >> nth=0 >> .forma-cartera input").check();
  await expect(page.locator("#pom-formas-estado")).toContainText("Falta asignar $200.000,00");
  // Guardar así tiene que avisar que no coincide
  await page.click("#pom-save");
  await expect(page.locator("#toast")).toContainText("tienen que coincidir");
  // 2) transferencia por la diferencia (se propone sola)
  await page.click("#pom-forma-add");
  await expect(page.locator("#pom-formas .forma >> nth=1 >> .f-importe")).toHaveValue("200.000");
  await page.selectOption("#pom-formas .forma >> nth=1 >> .f-medio", "tr1");
  await expect(page.locator("#pom-formas-estado")).toContainText("✓");
  await page.click("#pom-save");
  await expect(page.locator("#pago-overlay")).not.toHaveClass(/show/);

  const op = (await escrituras(page, "ordenes_pago")).map((x) => x[2]).pop();
  expect(op.formas.map((f) => [f.medio_id, f.cuenta_id, f.importe])).toEqual([["che", "cartera_cheques", 300000], ["tr1", "bco", 200000]]);
  const movs = (await escrituras(page, "movimientos")).map((x) => x[2]);
  expect(movs.map((m) => [m.cuenta_id, m.monto]).sort()).toEqual([["bco", 200000], ["cartera_cheques", 300000]]);
  const chq = (await escrituras(page, "cheques")).map((x) => x[2]).pop();
  expect(chq.estado).toBe("entregado");
});

test("movimiento entre cuentas: sale de una, entra en la otra, se edita y se anula junto", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosCompras()), { email: "compras@anafer.test" });
  await page.click("#tab-tesoreria");
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await page.click("#new-transfer-btn");
  await page.selectOption("#trf-desde", "bco");
  await page.selectOption("#trf-hacia", "bco");
  await expect(page.locator("#trf-aviso")).toContainText("dos cuentas distintas");
  await page.selectOption("#trf-hacia", "caja");
  await page.fill("#trf-monto", "2.100.000");
  await expect(page.locator("#trf-saldo-desde")).toContainText("queda −$100.000,00");
  await expect(page.locator("#trf-aviso")).toContainText("queda en negativo");
  await page.click("#trf-swap");                       // ahora de Caja al Banco
  await page.click("#trf-swap");                       // y de vuelta
  await page.fill("#trf-monto", "150.000");
  await page.fill("#trf-detalle", "Fondo fijo");
  await page.click("#trf-save");

  const movs = (await escrituras(page, "movimientos")).map((x) => x[2]);
  const sal = movs.find((m) => m.id.endsWith("_sal")), ent = movs.find((m) => m.id.endsWith("_ent"));
  expect(sal).toMatchObject({ cuenta_id: "bco", tipo: "egreso", monto: 150000, concepto: "Transferencia a Caja — Fondo fijo" });
  expect(ent).toMatchObject({ cuenta_id: "caja", tipo: "ingreso", monto: 150000, concepto: "Transferencia desde Banco Santander — Fondo fijo" });
  expect(sal.id.replace(/_sal$/, "")).toBe(ent.id.replace(/_ent$/, ""));
  await expect(page.locator("#movimientos-body .mov-origen-badge.trf")).toHaveCount(2);

  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cuentas"]');
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$1.850.000,00");
  await expect(page.locator("#cuentas-body tr", { hasText: "Caja" }).first()).toContainText("$200.000,00");

  // editar desde cualquiera de las dos filas: cambia las dos
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="movimientos"]');
  await page.locator("#movimientos-body tr", { hasText: "Transferencia desde" }).click();
  await expect(page.locator("#trf-desde")).toHaveValue("bco");
  await expect(page.locator("#trf-detalle")).toHaveValue("Fondo fijo");
  await page.fill("#trf-monto", "100000");
  await page.click("#trf-save");
  const ult = (await escrituras(page, "movimientos")).map((x) => x[2]).slice(-2);
  expect(ult.map((m) => m.monto)).toEqual([100000, 100000]);
  expect(ult.map((m) => m.id).sort()).toEqual([sal.id, ent.id].sort());

  // anular: se anulan las dos y vuelven los saldos
  await page.locator("#movimientos-body tr", { hasText: "Transferencia a Caja" }).click();
  await page.click("#trf-anular");
  await page.fill("#anul-motivo", "Cargado por error");
  await page.click("#anul-ok");
  const anul = (await escrituras(page, "movimientos")).map((x) => x[2]).slice(-2);
  expect(anul.every((m) => m.anulado_en && m.motivo_anulacion === "Cargado por error")).toBe(true);
  await page.click('#subtabs-tesoreria .stabbtn[data-sub="cuentas"]');
  await expect(page.locator("#cuentas-body tr", { hasText: "Banco Santander" })).toContainText("$2.000.000,00");
  expect((await escrituras(page, "movimientos")).filter((x) => x[1] === "delete")).toHaveLength(0);
});
