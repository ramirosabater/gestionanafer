// Sifoncito con memoria: sugerencias según el historial.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function mas(ds, n) { const d = new Date(ds + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); }
function hoy() { return iso(new Date()); }
// Primer martes del mes actual (siempre está en la grilla del mes).
function primerMartes() { const d = new Date(); d.setDate(1); while (d.getDay() !== 2) d.setDate(d.getDate() + 1); return iso(d); }

function datosViajes() {
  const fecha = primerMartes();
  const trips = [];
  // 26 martes anteriores, salvo 3: la ruta "norte" sale casi todos los martes con el camión 13
  for (let i = 1; i <= 26; i++) if (![5, 11, 19].includes(i)) trips.push({ id: `${mas(fecha, -7 * i)}_norte`, date: mas(fecha, -7 * i), route_id: "norte", truck: "13", driver: "Juan", helper: "", status: "actual", source: "manual" });
  // dentro de dos semanas el camión 13 ya está en otra ruta
  trips.push({ id: `${mas(fecha, 14)}_sur`, date: mas(fecha, 14), route_id: "sur", truck: "13", status: "actual", source: "manual" });
  return {
    fecha,
    db: baseDePrueba({
      routes: [{ id: "norte", label: "Norte", sort_order: 1 }, { id: "sur", label: "Sur", sort_order: 2 }],
      trucks: [{ id: "13", label: "Camión 13", driver: "Juan" }, { id: "20", label: "Camión 20" }],
      drivers: [{ id: "Juan", name: "Juan" }], helpers: [], cargo_types: [], branches: [], ayudante_memoria: [],
      trips,
    }),
  };
}
async function cargarViaje(page, fecha) {
  await page.locator("#home-grid .area-card", { hasText: "Logística" }).click();
  await page.click("#tab-grid");
  await page.locator(`td.cell[data-date="${fecha}"][data-route="norte"]`).click();
  await page.selectOption("#cm-truck", "13");
  await page.click("#cm-save");
}

test("viaje que se repite: propone cargarlo los próximos 6 meses, sin feriados ni días con el camión ocupado", async ({ page }) => {
  const { fecha, db } = datosViajes();
  await abrirGestion(page, db, { email: "admin@anafer.test" });
  await cargarViaje(page, fecha);
  const card = page.locator("#ayuda-sug");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Norte");
  await expect(card).toContainText("martes");
  await expect(card).toContainText("23 martes");
  // el día con el camión en otra ruta viene destildado
  await expect(card.locator(`input[value="${mas(fecha, 14)}"]`)).not.toBeChecked();
  await expect(card.locator(`input[value="${mas(fecha, 7)}"]`)).toBeChecked();
  const marcados = await card.locator(".sug-dias input:checked").count();
  await expect(card.locator("button.pri")).toHaveText(`Cargar ${marcados} viajes`);
  // saco uno a mano
  await card.locator(`input[value="${mas(fecha, 21)}"]`).uncheck();
  await expect(card.locator("button.pri")).toHaveText(`Cargar ${marcados - 1} viajes`);
  await card.locator("button.pri").click();
  await expect(card).toBeHidden();
  await expect(page.locator("#toast")).toContainText(`se cargaron ${marcados - 1} viajes`);
  const nuevos = (await escrituras(page, "trips")).map((x) => x[2]).filter((t) => t.source === "repetido");
  expect(nuevos.length).toBe(marcados - 1);
  expect(nuevos.every((t) => t.route_id === "norte" && t.truck === "13" && t.driver === "Juan" && new Date(t.date + "T12:00:00").getDay() === 2)).toBe(true);
  expect(nuevos.map((t) => t.date)).not.toContain(mas(fecha, 14));
  expect(nuevos.map((t) => t.date)).not.toContain(mas(fecha, 21));
  const mem = (await escrituras(page, "ayudante_memoria")).map((x) => x[2]).pop();
  expect(mem).toMatchObject({ usuario: "admin@anafer.test", clave: "repetir:trips:norte", decision: "aceptada" });
});

test("'No me lo preguntes más' queda en la memoria y no vuelve a preguntar", async ({ page }) => {
  const { fecha, db } = datosViajes();
  await abrirGestion(page, db, { email: "admin@anafer.test" });
  await cargarViaje(page, fecha);
  await page.locator("#ayuda-sug button", { hasText: "No me lo preguntes más" }).click();
  await expect(page.locator("#ayuda-sug")).toBeHidden();
  const mem = (await escrituras(page, "ayudante_memoria")).map((x) => x[2]).pop();
  expect(mem).toMatchObject({ clave: "repetir:trips:norte", decision: "nunca" });
  // Otro martes de la misma ruta: ya no pregunta
  await page.locator(`td.cell[data-date="${mas(fecha, 7)}"][data-route="norte"]`).click();
  await page.selectOption("#cm-truck", "13");
  await page.click("#cm-save");
  await page.waitForTimeout(800);
  await expect(page.locator("#ayuda-sug")).toBeHidden();
});

// Facturas de Servicios SA de los meses anteriores: rondan los 100.000
function datosConHistorial(extraFacturas = []) {
  const base = datosCompras();
  const previas = [1, 2, 3].map((m) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m); d.setDate(10);
    return { id: `hist${m}`, proveedor_id: "serv", numero: `H-${m}`, fecha: iso(d), monto: 100000 + m * 1000, estado: "pagada", centro_costo_id: "cc_logistica_deposito", concepto_id: "gasoil" };
  });
  return datosCompras({ facturas: [...base.facturas.filter((f) => f.proveedor_id !== "serv"), ...previas, ...extraFacturas], ayudante_memoria: [] });
}
async function nuevaFactura(page, numero, monto) {
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="facturas"]');
  await page.click("#new-factura-btn");
  await page.fill("#fm-proveedor-input", "Servicios");
  await page.locator("#fm-proveedor-menu .combo-item").first().click();
  await page.fill("#fm-numero", numero);
  await page.fill("#fm-fecha", hoy());
  await page.fill("#fm-monto", monto);
  await page.selectOption("#fm-centro-costo", "cc_logistica_deposito");
  await page.selectOption("#fm-concepto", "gasoil");
  await page.click("#fm-save");
}

test("factura con un importe muy distinto al habitual: avisa", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosConHistorial()), { email: "compras@anafer.test" });
  await nuevaFactura(page, "S-77", "350000");
  const card = page.locator("#ayuda-sug");
  await expect(card).toBeVisible();
  await expect(card).toContainText("más alta que lo habitual");
  await card.locator("button", { hasText: "Revisarla" }).click();
  await expect(page.locator("#factura-overlay")).toHaveClass(/show/);
  await expect(page.locator("#fm-numero")).toHaveValue("S-77");
});

test("factura que parece cargada dos veces: avisa y deja anularla", async ({ page }) => {
  await abrirGestion(page, baseDePrueba(datosConHistorial()), { email: "compras@anafer.test" });
  await nuevaFactura(page, "H-0001", "101000");   // misma que H-1
  const card = page.locator("#ayuda-sug");
  await expect(card).toContainText("¿No será la misma?");
  await card.locator("button", { hasText: "Anular esta" }).click();
  await expect(page.locator("#anular-overlay")).toHaveClass(/show/);
  await expect(page.locator("#anul-title")).toContainText("H-0001");
});

test("proveedor que factura todos los meses y este mes no llegó: avisa al entrar a Pagos", async ({ page }) => {
  test.skip(new Date().getDate() < 7, "a principio de mes todavía no corresponde avisar");
  const mensuales = [1, 2, 3, 4, 5, 6].map((m) => {
    const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - m);
    return { id: `alq${m}`, proveedor_id: "bien", numero: `A-${m}`, fecha: iso(d), monto: 242000, estado: "pagada" };
  });
  await abrirGestion(page, baseDePrueba(datosCompras({ facturas: mensuales, ayudante_memoria: [] })), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  const card = page.locator("#ayuda-sug");
  await expect(card).toContainText("Ferretería SA");
  await expect(card).toContainText("suele llegar el día 1");
  await card.locator("button", { hasText: "Cargar" }).first().click();
  await expect(page.locator("#factura-overlay")).toHaveClass(/show/);
  await expect(page.locator("#fm-proveedor-input")).toHaveValue("Ferretería SA");
});

test("orden de pago: propone pagar como siempre (echeq a 30 días)", async ({ page }) => {
  const ops = [20, 50, 80].map((dias, i) => {
    const f = mas(hoy(), -dias);
    return { id: `opv${i}`, numero: i + 1, proveedor_id: "mono", factura_ids: [], fecha: f, monto: 100000, estado: "pagada",
      formas: [{ medio_id: "ecs", cuenta_id: "bco", importe: 100000, cheque_ids: [], cheque_numero: `E-${i}`, cheque_fecha: mas(f, 30) }] };
  });
  await abrirGestion(page, baseDePrueba(datosCompras({ ordenes_pago: ops, ayudante_memoria: [] })), { email: "compras@anafer.test" });
  await page.click("#tab-pagos");
  await page.click('#subtabs-pagos .stabbtn[data-sub="ordenes"]');
  await page.click("#new-pago-btn");
  await page.fill("#pom-proveedor-input", "Mono");
  await page.locator("#pom-proveedor-menu .combo-item").first().click();
  await page.locator("#pom-facturas-list input[type=checkbox]").first().check();
  await page.fill("#pom-fecha", hoy());
  await page.selectOption("#pom-estado", "pagada");
  const card = page.locator("#ayuda-sug");
  await expect(card).toContainText("3 de las últimas 3");
  await expect(card).toContainText("30 días");
  await card.locator("button", { hasText: "Sí, armalo así" }).click();
  await expect(page.locator("#pom-formas .f-medio").first()).toHaveValue("ecs");
  await expect(page.locator("#pom-formas .f-chqfecha").first()).toHaveValue(mas(hoy(), 30));
  // al cerrar la orden, la sugerencia no queda colgada
  await page.click("#pom-cancel");
  await expect(card).toBeHidden();
});
