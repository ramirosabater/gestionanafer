// Módulo Calidad: Reclamos de PT (RG-0802), NC/PAC (RG-0801), Indicadores,
// listas y Sifoncito de calidad.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";

function iso(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }
function mas(n) { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); }
const ANIO = new Date().getFullYear();

function rec(n, extra = {}) {
  return { id: `rec_${ANIO}_${n}`, numero: n, anio: ANIO, fecha: mas(-2), producto: "Bx20Azul", lote: "343", desvio: "Mal gusto", reclamo_cliente: "MG: plastico",
    desvio_real: "MG: plastico", envase: "Camillo", lote_envase: "2/25", tapa: "PRIVA", cantidad: 1, destino_envase: "A la linea", estado: "Cerrado justificado", controlo: "PEREZ", ...extra };
}
function datosCalidad(extra = {}) {
  return baseDePrueba({
    calidad_reclamos: [rec(1), rec(2, { desvio_real: "SIN GUSTO", estado: "Cerrado No justificado" }), rec(3, { lote: "350", producto: "Bx12Azul" }), rec(4, { estado: "Abierto", desvio_real: "", fecha: mas(-12), lote: "777" })],
    calidad_pac: [
      { id: "pac_a", numero: 1, anio: ANIO, fecha: mas(-40), origen: "AUDITORIA INTERNA", clasificacion: "NC MENOR", proceso: "MANTENIMIENTO", hallazgo: "Falta registro de limpieza de tanques",
        riesgo: "MEDIO", resp_accion: "Responsable Uno", fecha_accion: mas(-5), estado: "En gestión", reclamo_ids: [] },
      { id: "pac_b", numero: 2, anio: ANIO, fecha: mas(-30), origen: "PROCESO (SGC)", clasificacion: "OBSERVACIÓN", proceso: "CALIDAD", hallazgo: "Planilla desactualizada",
        riesgo: "BAJO", fecha_accion: mas(20), estado: "Cerrada", eficacia_resultado: "Efectiva", reclamo_ids: [] },
    ],
    calidad_listas: [{ id: "controladores", valores: ["PEREZ", "GOMEZ"] }, { id: "responsables", valores: ["Responsable Uno", "Responsable Dos"] }],
    ayudante_memoria: [],
    ...extra,
  });
}
async function entrarCalidad(page) {
  await page.locator("#home-grid .area-card", { hasText: "Calidad" }).click();
}

test("Calidad aparece como área nueva para el administrador y muestra los reclamos", async ({ page }) => {
  const errores = await abrirGestion(page, datosCalidad(), { email: "admin@anafer.test" });
  await expect(page.locator("#home-grid .area-card h3")).toContainText(["Calidad"]);
  await entrarCalidad(page);
  await expect(page.locator("#brand-tag")).toHaveText("Calidad");
  await expect(page.locator("#tab-reclamos")).toBeVisible();
  await expect(page.locator("#tab-ncpac")).toBeVisible();
  await expect(page.locator("#tab-calidash")).toBeVisible();
  await expect(page.locator("#tab-pagos")).toBeHidden();
  await expect(page.locator("#rq-body tr")).toHaveCount(4);
  await expect(page.locator("#rq-count")).toHaveText("(4)");
  await page.fill("#rq-f-buscar", "350");
  await expect(page.locator("#rq-body tr")).toHaveCount(1);
  await expect(page.locator("#rq-f-buscar")).toHaveClass(/f-activo/);
  await page.click('[data-limpiar="rq"]');
  await expect(page.locator("#rq-f-buscar")).toHaveValue("");
  await expect(page.locator("#rq-body tr")).toHaveCount(4);
  await expect(page.locator('[data-limpiar="rq"]')).toBeHidden();
  await page.fill("#rq-f-buscar", "350");
  // volver al inicio no deja la pantalla de Calidad abierta
  await page.click("#home-btn");
  await expect(page.locator("#view-reclamos")).toBeHidden();
  await expect(page.locator("#menu-card")).toBeHidden();
  expect(errores).toEqual([]);
});

test("un perfil sin permisos de calidad no ve el área", async ({ page }) => {
  await abrirGestion(page, datosCalidad(), { email: "compras@anafer.test" });
  await expect(page.locator("#home-grid .area-card", { hasText: "Calidad" })).toHaveCount(0);
});

test("reclamo nuevo de un lote repetido: Sifoncito propone abrir la NC/PAC y la deja vinculada", async ({ page }) => {
  await abrirGestion(page, datosCalidad({ calidad_reclamos: [rec(1), rec(2)] }), { email: "admin@anafer.test" });
  await entrarCalidad(page);
  await page.click("#rq-nuevo");
  await page.selectOption("#rq-producto", "Bx20Azul");
  await page.fill("#rq-lote", "343");
  await page.check("#rq-venc-ilegible");
  await expect(page.locator("#rq-venc")).toBeDisabled();
  await page.selectOption("#rq-cliente", "MG: cloro");
  await page.selectOption("#rq-estado", "Cerrado justificado");
  await page.click("#rq-save");
  await expect(page.locator("#toast")).toContainText("desvío real");          // cerrar exige el desvío real
  await page.selectOption("#rq-real", "MG: plastico");
  await page.selectOption("#rq-envase", "Pedernera");
  await page.selectOption("#rq-controlo", "GOMEZ");
  await page.click("#rq-save");
  await expect(page.locator("#reclamo-overlay")).not.toHaveClass(/show/);
  const nuevo = (await escrituras(page, "calidad_reclamos")).map((x) => x[2]).pop();
  expect(nuevo).toMatchObject({ numero: 3, anio: ANIO, producto: "Bx20Azul", lote: "343", vencimiento_ilegible: true, vencimiento: null, desvio_real: "MG: plastico", controlo: "GOMEZ", creado_por: "admin@anafer.test" });

  const card = page.locator("#ayuda-sug");
  await expect(card).toContainText("3 reclamos");
  await expect(card).toContainText("lote 343");
  await card.locator("button", { hasText: "Abrir acción de mejora" }).click();
  await expect(page.locator("#pac-overlay")).toHaveClass(/show/);
  await expect(page.locator("#pq-origen")).toHaveValue("RECLAMO DE CLIENTE");
  await expect(page.locator("#pq-hallazgo")).toHaveValue(/lote 343/);
  await page.selectOption("#pq-resp-ac", "Responsable Dos");
  await page.fill("#pq-fecha-ac", mas(15));
  await page.click("#pq-save");
  await expect(page.locator("#pac-overlay")).not.toHaveClass(/show/);
  const pac = (await escrituras(page, "calidad_pac")).map((x) => x[2]).pop();
  expect(pac).toMatchObject({ numero: 3, anio: ANIO, origen: "RECLAMO DE CLIENTE", resp_accion: "Responsable Dos", estado: "Abierta" });
  expect(pac.reclamo_ids.length).toBe(3);
  const vinculados = (await escrituras(page, "calidad_reclamos")).map((x) => x[2]).filter((r) => r.pac_id === pac.id);
  expect(vinculados.length).toBe(3);
});

test("NC/PAC: avisa las vencidas, no deja cerrar sin eficacia y se anula en vez de borrarse", async ({ page }) => {
  await abrirGestion(page, datosCalidad({ calidad_reclamos: [rec(1)] }), { email: "admin@anafer.test" });
  await entrarCalidad(page);
  await page.click("#tab-ncpac");
  // De entrada: solo las pendientes
  await expect(page.locator("#pq-body tr")).toHaveCount(1);
  await expect(page.locator("#pq-body tr").first()).toContainText("⚠");
  const card = page.locator("#ayuda-sug");
  await expect(card).toContainText("con la acción vencida");
  await card.locator("button", { hasText: "Abrir" }).first().click();
  await expect(page.locator("#pq-title")).toHaveText("Acción de mejora 1-" + String(ANIO).slice(-2));
  await page.selectOption("#pq-estado", "Cerrada");
  await page.click("#pq-save");
  await expect(page.locator("#toast")).toContainText("verificación de eficacia");
  await page.click("#pq-anular");
  await page.fill("#anul-motivo", "Cargada dos veces");
  await page.click("#anul-ok");
  const a = (await escrituras(page, "calidad_pac")).map((x) => x[2]).pop();
  expect(a).toMatchObject({ id: "pac_a", motivo_anulacion: "Cargada dos veces", anulado_por: "admin@anafer.test" });
  expect((await escrituras(page, "calidad_pac")).filter((x) => x[1] === "delete")).toEqual([]);
  await page.selectOption("#pq-f-estado", "__anuladas");
  await expect(page.locator("#pq-body tr")).toHaveCount(1);
  await expect(page.locator("#pq-body tr").first()).toContainText("Anulada");
});

test("indicadores y listas de calidad", async ({ page }) => {
  await abrirGestion(page, datosCalidad(), { email: "admin@anafer.test" });
  await entrarCalidad(page);
  await page.click("#tab-calidash");
  const kpi = (sel, lab) => page.locator(sel + " .cq-kpi").filter({ has: page.locator(".lab", { hasText: new RegExp("^" + lab + "$") }) }).locator(".val");
  await expect(kpi("#cd-kpis", "Reclamos del período")).toHaveText("4");
  await expect(kpi("#cd-kpis", "Justificados")).toHaveText("67%");
  await expect(kpi("#cd-kpis", "Abiertos")).toHaveText("1");
  await expect(kpi("#cd-kpis-pac", "Con acción vencida")).toHaveText("1");
  await expect(page.locator("#cd-envase")).toContainText("Camillo");
  await expect(page.locator("#cd-dona-desvio .center b")).toHaveText("3");          // 3 reclamos controlados
  await expect(page.locator("#cd-vencidas tbody tr")).toHaveCount(1);
  // filtro por producto
  await page.selectOption("#cd-producto", "Bx12Azul");
  await expect(kpi("#cd-kpis", "Reclamos del período")).toHaveText("1");
  // ⚙ → Calidad → Listas
  await page.click("#settings-btn");
  await page.click("#scatbtn-calidad");
  const caja = page.locator('.cal-lista[data-lista="productos"]');
  await expect(caja).toContainText("Bx20Azul");
  await caja.locator("input").fill("Bx6Azul");
  await caja.locator(".addrow button").click();
  const l = (await escrituras(page, "calidad_listas")).map((x) => x[2]).pop();
  expect(l.id).toBe("productos");
  expect(l.valores).toContain("Bx6Azul");
});

test("Sifoncito se viste de calidad y recorre sus circuitos", async ({ page }) => {
  await abrirGestion(page, datosCalidad({ calidad_reclamos: [], calidad_pac: [] }), { email: "admin@anafer.test" });
  await entrarCalidad(page);
  await page.click("#ayuda-btn");
  await expect(page.locator("#ayuda-panel .ayuda-area")).toHaveText("Calidad");
  await page.getByRole("button", { name: /Seguir una acción de mejora/ }).click();
  await expect(page.locator("#pq-f-estado")).toHaveClass(/ayuda-foco/);
  while (await page.locator('#ayuda-panel [data-acc="sig"]').count()) await page.click('#ayuda-panel [data-acc="sig"]');
  await page.click('#ayuda-panel [data-acc="fin"]');
  await expect(page.locator("#ayuda-panel")).toBeHidden();
});

test("reclamo: queda quién lo cargó, el origen asignado a esa persona y el cliente; se filtra por origen", async ({ page }) => {
  const db = datosCalidad({ calidad_reclamos: [rec(1, { origen: "Planta", cliente: "Kiosco Sol" })] });
  db.calidad_listas.push({ id: "cargadores", valores: [{ email: "admin@anafer.test", origen: "Distribuidor" }] });
  await abrirGestion(page, db, { email: "admin@anafer.test" });
  await entrarCalidad(page);
  await expect(page.locator("#tab-ncpac")).toHaveText(/Acciones de mejora/);
  await page.click("#rq-nuevo");
  await expect(page.locator("#rq-sub")).toContainText("admin@anafer.test · Distribuidor");
  await expect(page.locator("#rq-origen")).toHaveValue("Distribuidor");
  await expect(page.locator("#rq-origen")).toBeDisabled();
  await expect(page.locator("#rq-producto option")).toContainText(["Bx5Azul", "Bx5Verde", "Soda retornable 1.5L", "Soda retornable 650ml"]);
  await page.selectOption("#rq-producto", "Soda retornable 650ml");
  await page.fill("#rq-clientenom", "Almacén Don Pepe");
  await page.click("#rq-save");
  await expect(page.locator("#reclamo-overlay")).not.toHaveClass(/show/);
  const nuevo = (await escrituras(page, "calidad_reclamos")).map((x) => x[2]).pop();
  expect(nuevo).toMatchObject({ origen: "Distribuidor", cliente: "Almacén Don Pepe", creado_por: "admin@anafer.test", producto: "Soda retornable 650ml" });
  await page.selectOption("#rq-f-origen", "Planta");
  await expect(page.locator("#rq-body tr")).toHaveCount(1);
  await expect(page.locator("#rq-body tr").first()).toContainText("Kiosco Sol");
  await page.selectOption("#rq-f-origen", "");
  await page.fill("#rq-f-buscar", "pepe");
  await expect(page.locator("#rq-body tr")).toHaveCount(1);
  // tablero: por origen
  await page.click("#tab-calidash");
  await expect(page.locator("#cd-origen-rk")).toContainText("Distribuidor");
  await expect(page.locator("#cd-origen-rk")).toContainText("Planta");
});

test("⚙ → Calidad: se asigna el origen de quien carga reclamos", async ({ page }) => {
  await abrirGestion(page, datosCalidad(), { email: "admin@anafer.test" });
  await page.click("#settings-btn");
  await page.click("#scatbtn-calidad");
  const box = page.locator('.cal-lista[data-lista="cargadores"]');
  await box.locator(".addrow input").fill("sucursal@anafer.test");
  await box.locator(".nuevo-origen").selectOption("Sucursal");
  await box.locator(".addrow button").click();
  await expect(box).toContainText("sucursal@anafer.test");
  const l = (await escrituras(page, "calidad_listas")).map((x) => x[2]).pop();
  expect(l).toEqual({ id: "cargadores", valores: [{ email: "sucursal@anafer.test", origen: "Sucursal" }] });
});

test("reclamo en dos partes: la recepción carga la 1ª parte con comentarios y no ve el control", async ({ page }) => {
  const db = datosCalidad({ calidad_reclamos: [] });
  db.calidad_listas.push({ id: "cargadores", valores: [{ email: "admin@anafer.test", origen: "Sucursal" }] });
  await abrirGestion(page, db, { email: "admin@anafer.test" });
  await entrarCalidad(page);
  await page.click("#rq-nuevo");
  await expect(page.locator("#rq-parte1")).toBeVisible();
  await expect(page.locator("#rq-parte2")).toBeHidden();
  await page.selectOption("#rq-producto", "Bx20Azul");
  await page.fill("#rq-lote", "343");
  await page.selectOption("#rq-desvio", { index: 1 });
  await page.fill("#rq-comentarios", "El cliente dice que tiene gusto raro");
  await page.click("#rq-save");
  await expect(page.locator("#reclamo-overlay")).not.toHaveClass(/show/);
  const r = (await escrituras(page, "calidad_reclamos")).map((x) => x[2]).pop();
  expect(r).toMatchObject({ origen: "Sucursal", comentarios: "El cliente dice que tiene gusto raro", estado: "Abierto", adjuntos: [] });
  expect(r.control_por).toBeFalsy();
  // abierto otra vez: el control se ve, pero no se puede tocar ni subir fotos
  await page.locator("#rq-body tr").first().click();
  await expect(page.locator("#rq-parte2")).toBeVisible();
  await expect(page.locator("#rq-real")).toBeDisabled();
  await expect(page.locator("#rq-foto-label")).toBeHidden();
});

test("control en fábrica: Calidad completa la 2ª parte y sube fotos a Google Drive", async ({ page }) => {
  await abrirGestion(page, datosCalidad({ calidad_reclamos: [rec(1, { estado: "Abierto", desvio_real: "", controlo: "", comentarios: "Llegó abollado", origen: "Sucursal" })] }), { email: "admin@anafer.test" });
  // Drive simulado: guarda lo que se sube
  await page.evaluate(() => {
    const G = window.GestionAnafer; window.__subidas = [];
    G.driveListo = () => true;
    G.driveSubir = (file, carpetas) => { window.__subidas.push({ name: file.name, carpetas }); return Promise.resolve({ id: "drv1", url: "https://drive.google.com/file/d/drv1/view", name: file.name, contentType: file.type, sizeBytes: file.size }); };
  });
  await entrarCalidad(page);
  await page.locator("#rq-body tr").first().click();
  await expect(page.locator("#rq-comentarios")).toHaveValue("Llegó abollado");
  await expect(page.locator("#rq-parte2")).toBeVisible();
  await page.selectOption("#rq-real", "MG: plastico");
  await page.selectOption("#rq-estado", "Cerrado justificado");
  await page.selectOption("#rq-controlo", "GOMEZ");
  await page.setInputFiles("#rq-foto-input", { name: "bidon.jpg", mimeType: "image/jpeg", buffer: Buffer.from([0xff, 0xd8, 0xff, 0xd9]) });
  await expect(page.locator("#rq-fotos")).toContainText("se sube al guardar");
  await page.click("#rq-save");
  await expect(page.locator("#reclamo-overlay")).not.toHaveClass(/show/);
  const subidas = await page.evaluate(() => window.__subidas);
  expect(subidas).toEqual([{ name: "bidon.jpg", carpetas: ["Calidad", "Reclamos " + ANIO, "Reclamo Nº 1"] }]);
  const r = (await escrituras(page, "calidad_reclamos")).map((x) => x[2]).pop();
  expect(r).toMatchObject({ estado: "Cerrado justificado", desvio_real: "MG: plastico", control_por: "admin@anafer.test", comentarios: "Llegó abollado" });
  expect(r.adjuntos).toHaveLength(1);
  expect(r.adjuntos[0]).toMatchObject({ id: "drv1", url: "https://drive.google.com/file/d/drv1/view", name: "bidon.jpg", subido_por: "admin@anafer.test" });
  await expect(page.locator("#rq-body tr").first()).toContainText("📷");
  await page.locator("#rq-body tr").first().click();
  await expect(page.locator("#rq-fotos a")).toHaveAttribute("href", "https://drive.google.com/file/d/drv1/view");
  await expect(page.locator("#rq-control-por")).toContainText("controlado por admin");
});
