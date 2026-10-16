// Módulo Dashboards: resumen + tablero de cada módulo con la lectura de Sifoncito.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";
import { datosCompras } from "../apoyo/datos-compras.js";

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function diaDelMes(mesesAtras, dia) { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - mesesAtras); d.setDate(dia); return iso(d); }

function datos() {
  const trips = [];
  // 6 meses con 20 viajes, y el mes pasado 40: Sifoncito tiene que notar la suba
  for (let m = 7; m >= 2; m--) for (let d = 1; d <= 20; d++) trips.push({ id: `t${m}_${d}`, date: diaDelMes(m, d), route_id: "norte", truck: d % 2 ? "13" : "20", driver: "Juan", status: "actual" });
  for (let d = 1; d <= 20; d++) { trips.push({ id: `u${d}a`, date: diaDelMes(1, d), route_id: "norte", truck: "13", driver: "Juan" }); trips.push({ id: `u${d}b`, date: diaDelMes(1, d), route_id: "sur", truck: "20", driver: "Pedro" }); }
  const comercial = [];
  for (let m = 1; m <= 12; m++) { comercial.push({ anio: new Date().getFullYear() - 1, mes: m, unidad: "Compañía", presu_monto: 100, real_monto: 100 }); }
  const mesAct = new Date().getMonth(); // 0-based: cargado hasta el mes pasado
  for (let m = 1; m <= Math.max(1, mesAct); m++) comercial.push({ anio: new Date().getFullYear(), mes: m, unidad: "Compañía", presu_monto: 200, real_monto: 150 });
  return baseDePrueba(datosCompras({
    routes: [{ id: "norte", label: "Norte" }, { id: "sur", label: "Sur" }],
    trucks: [{ id: "13", label: "Camión 13" }, { id: "20", label: "Camión 20" }, { id: "99", label: "Camión 99" }],
    trips, visits: [],
    facturas: [
      { id: "vieja", proveedor_id: "serv", numero: "V-1", fecha: diaDelMes(4, 5), monto: 500000, estado: "pendiente" },
      { id: "nueva", proveedor_id: "bien", numero: "N-1", fecha: diaDelMes(0, 1), monto: 100000, estado: "pendiente" },
    ],
    calidad_reclamos: [], calidad_pac: [],
    comercial_mensual: comercial, comercial_altas_bajas: [],
    empleados: [{ legajo: 1, sector: "Planta", activo: true }],
    fichajes: [],
    tableros_opiniones: [], ayudante_memoria: [],
    __funciones: { "sifoncito-opina": { data: { texto: "## Estado general: bien\n- Los viajes **subieron** fuerte.\n- Ojo con las facturas viejas." }, error: null } },
  }));
}
async function entrar(page) {
  await page.locator("#home-grid .area-card", { hasText: "Dashboards" }).click();
}

test("Resumen: una tarjeta por módulo y la lectura general de Sifoncito", async ({ page }) => {
  const errores = await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await expect(page.locator("#subtabs-tableros .stabbtn")).toHaveText(["🏠 Resumen", "🚛 Logística", "🧾 Administración", "🔬 Calidad", "📊 Comercial", "👥 RR.HH."]);
  const tarjetas = page.locator(".tb-kpis-resumen .cq-kpi");
  await expect(tarjetas).toHaveCount(5);
  await expect(page.locator(".tb-sif .tb-lect")).toContainText("Logística");
  await expect(page.locator(".tb-sif .tb-lect")).toContainText("Administración");
  // tocar una tarjeta lleva al tablero del módulo
  await tarjetas.filter({ hasText: "Logística" }).click();
  await expect(page.locator("#subtabs-tableros .stabbtn.active")).toContainText("Logística");
  expect(errores).toEqual([]);
});

test("Logística: compara con la historia y avisa camiones parados", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await page.click('#subtabs-tableros [data-tb="logistica"]');
  const lect = page.locator(".tb-sif .tb-lect");
  await expect(lect).toContainText("100% más");          // 40 viajes vs promedio 20
  await expect(lect).toContainText("Camión 99");          // sin viajes en 30 días
  await expect(page.locator(".tb-sif-estado")).toContainText("para mirar");
  await expect(page.locator(".cq-kpi", { hasText: "Viajes de" }).locator(".val")).toHaveText("40");
});

test("Administración y Comercial: facturas viejas y cumplimiento del presupuesto", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await page.click('#subtabs-tableros [data-tb="administracion"]');
  await expect(page.locator(".tb-sif .tb-lect")).toContainText("más de 60 días");
  await page.click('#subtabs-tableros [data-tb="comercial"]');
  await expect(page.locator(".tb-sif .tb-lect")).toContainText("75,0%");   // 150 de 200
  await expect(page.locator(".tb-sif .tb-lect")).toContainText("creció");   // 150 vs 100 del año anterior
});

test("Opinión con IA: manda solo indicadores, la muestra y la guarda", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await expect(page.locator(".tb-kpis-resumen .cq-kpi")).toHaveCount(5);
  await page.click('[data-acc="ia"][data-modulo="resumen"]');
  await expect(page.locator("#tb-ia-resumen")).toContainText("Estado general: bien");
  await expect(page.locator("#tb-ia-resumen li").first()).toContainText("subieron");
  const llamada = (await escrituras(page, "__funciones")).pop();
  expect(llamada[1]).toBe("sifoncito-opina");
  expect(llamada[2].modulo).toBe("resumen");
  expect(llamada[2].datos.logistica.viajes_por_mes.length).toBe(24);
  expect(JSON.stringify(llamada[2].datos)).not.toContain("@");                // sin emails ni datos personales
  const guardada = (await escrituras(page, "tableros_opiniones")).pop();
  expect(guardada[2]).toMatchObject({ modulo: "resumen", usuario: "admin@anafer.test" });
});

test("un perfil sin permiso no ve Dashboards y Sifoncito tiene su recorrido", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "compras@anafer.test" });
  await expect(page.locator("#home-grid .area-card", { hasText: "Dashboards" })).toHaveCount(0);
  await page.click("#logout-btn").catch(() => {});
});

test("Sifoncito se viste de gerente en Dashboards", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await page.click("#ayuda-btn");
  await expect(page.locator("#ayuda-panel .ayuda-area")).toHaveText("Dashboards");
  await page.getByRole("button", { name: /Usar los Dashboards/ }).click();
  while (await page.locator('#ayuda-panel [data-acc="sig"]').count()) await page.click('#ayuda-panel [data-acc="sig"]');
  await page.click('#ayuda-panel [data-acc="fin"]');
  await expect(page.locator("#ayuda-panel")).toBeHidden();
});

// Voz simulada: cada frase "dura" poco; cancel() la corta como lo hace el navegador.
async function vozFalsa(page, ms = 350) {
  await page.addInitScript((ms) => {
    window.__dichos = []; window.__cancelados = 0;
    let actual = null, timer = null;
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, writable: true, value: function (t) { this.text = t; } });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      getVoices: () => [], addEventListener() {},
      speak(u) { actual = u; window.__dichos.push(u.text); timer = setTimeout(() => { if (actual === u) { actual = null; u.onend && u.onend(); } }, ms); },
      cancel() { window.__cancelados++; clearTimeout(timer); const u = actual; actual = null; if (u && u.onerror) u.onerror({ error: "interrupted" }); },
    } });
  }, ms);
}

test("Escuchar: Sifoncito de Dashboards sale a señalar y 'Detener' lo calla", async ({ page }) => {
  await vozFalsa(page, 1500);
  const errores = await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await expect(page.locator(".tb-kpis-resumen .cq-kpi")).toHaveCount(5);
  // la ropa de Dashboards: gorra verde agua con visera
  await expect(page.locator('.tb-sif-av svg path[fill="#0d9488"]').first()).toBeAttached();
  const btn = page.locator('.tb-btn-escuchar[data-modulo="resumen"]');
  await btn.click();
  await expect(btn).toHaveText("⏹ Detener");
  await expect(page.locator(".tb-actor .sif-brazo-puntero")).toBeAttached();
  const estado = (await page.locator('.tb-sif[data-modulo="resumen"] .tb-sif-estado').textContent()).replace(/\.$/, "");
  await expect.poll(() => page.evaluate(() => window.__dichos[0] || "")).toContain(estado);
  // en la primera línea de la lectura señala la tarjeta del módulo y muestra el globo
  await expect(page.locator(".tb-kpis-resumen .cq-kpi.tb-senalado")).toHaveCount(1, { timeout: 5000 });
  await expect(page.locator(".tb-actor .tb-globo")).toBeVisible();
  await expect(page.locator(".tb-lect li.tb-leyendo")).toHaveCount(1);
  await btn.click();
  await expect(btn).toHaveText("🔊 Escuchar");
  await expect(page.locator(".tb-actor")).toHaveCount(0);
  await expect(page.locator(".tb-senalado, .tb-leyendo")).toHaveCount(0);
  const dichos = await page.evaluate(() => window.__dichos.length);
  await page.waitForTimeout(2500);
  expect(await page.evaluate(() => window.__dichos.length)).toBe(dichos);      // no sigue hablando
  expect(errores).toEqual([]);
});

test("Escuchar en Logística: recorre los gráficos que corresponden y vuelve a su lugar", async ({ page }) => {
  await vozFalsa(page, 250);
  await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await entrar(page);
  await page.click('#subtabs-tableros [data-tb="logistica"]');
  await expect(page.locator(".tb-sif .tb-lect")).toContainText("Camión 99");
  const items = await page.locator(".tb-sif .tb-lect li").count();
  await page.evaluate(() => {
    window.__senalados = [];
    new MutationObserver((ms) => ms.forEach((m) => { const el = m.target;
      if (el.classList && el.classList.contains("tb-senalado")) { const t = el.querySelector("h2, .lab"); window.__senalados.push(t ? t.textContent : ""); } }))
      .observe(document.body, { subtree: true, attributes: true, attributeFilter: ["class"] });
  });
  await page.click('.tb-btn-escuchar[data-modulo="logistica"]');
  await expect(page.locator(".tb-actor")).toHaveCount(1);
  await expect(page.locator(".tb-actor")).toHaveCount(0, { timeout: 25000 });
  const senalados = await page.evaluate(() => [...new Set(window.__senalados)]);
  expect(senalados).toContain("Viajes por mes");
  expect(senalados.some((t) => t.startsWith("Camiones sin viajes"))).toBe(true);
  await expect(page.locator('.tb-btn-escuchar[data-modulo="logistica"]')).toHaveText("🔊 Escuchar");
  expect(await page.evaluate(() => window.__dichos.length)).toBe(1 + items);
  // cambiar de pestaña también lo corta
  await page.click('.tb-btn-escuchar[data-modulo="logistica"]');
  await expect(page.locator(".tb-actor")).toHaveCount(1);
  await page.click('#subtabs-tableros [data-tb="resumen"]');
  await expect(page.locator(".tb-actor")).toHaveCount(0);
});
