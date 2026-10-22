// Calidad: reclamo en una línea con fecha fija y número a la vista; empleados que
// cargan reclamos y completan acciones de mejora desde el fichaje (legajo + PIN).
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOY = iso(new Date());
const ANIO = new Date().getFullYear();

// ---------- Fichaje (empleado) ----------
async function fichajeConCalidad(page, permisos, extra = {}) {
  const llamadas = [];
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, async (r) => {
    const req = r.request(), url = new URL(req.url());
    const json = (b) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(b) });
    if (!url.host.endsWith("supabase.co")) return r.abort();
    if (url.pathname.startsWith("/rest/v1/rpc/")) {
      const fn = url.pathname.replace("/rest/v1/rpc/", ""), body = JSON.parse(req.postData() || "{}");
      llamadas.push([fn, body]);
      if (fn === "login_empleado") return json({ ok: true, empleado: { legajo: 441, nombre: "Johana", apellido: "Ainol", horario_id: null, locales_asignados: [] }, fichajes_hoy: [] });
      if (fn === "mi_equipo") return json({ ok: true, modo: "gps" });
      if (fn === "calidad_mis_permisos") return json({ ok: true, hoy: HOY, anio: ANIO, proximo_numero: 603, listas: { productos: [] }, ...permisos });
      if (extra[fn]) return json(typeof extra[fn] === "function" ? extra[fn](body) : extra[fn]);
      return json({ ok: true });
    }
    return json([]);
  });
  return llamadas;
}
async function entrar(page, ruta = "/fichaje/") {
  await page.goto(ruta);
  await page.getByPlaceholder("Legajo").fill("441");
  await page.getByPlaceholder("PIN").first().fill("1234");
  await page.getByPlaceholder("PIN").first().press("Enter");
}

test("empleado que carga reclamos: entra por el link de Calidad, ve el Nº en gris, fecha fija y producto/lote/hora/vto. en una línea", async ({ page }) => {
  const llamadas = await fichajeConCalidad(page, { reclamos: true, acciones: false, origen: "Sucursal" }, {
    calidad_cargar_reclamo: { ok: true, numero: 603, anio: ANIO, fecha: HOY },
  });
  await entrar(page, "/fichaje/?ir=calidad");
  const f = page.locator("[data-form-reclamo]");
  await expect(f).toBeVisible();                                         // va directo a cargar el reclamo
  await expect(f.locator("[data-nro]")).toHaveText(`Nº 603 / ${ANIO}`);
  await expect(f.locator("[data-fecha]")).toHaveValue(HOY.split("-").reverse().join("/"));
  await expect(f.locator("[data-fecha]")).toHaveAttribute("readonly", "");
  // producto, lote, hora y vencimiento en la misma fila (en pantalla ancha)
  await page.setViewportSize({ width: 900, height: 900 });
  const tops = await f.locator("[data-linea] > div").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);
  await f.locator("[data-prod]").selectOption("Bx20Azul");               // (sin origen: viene fijo "Sucursal")
  await f.getByPlaceholder("Ej: 343").fill("343");
  await f.locator("[data-rc]").selectOption("MG: cloro");
  await f.getByPlaceholder("Nombre o Nº de cliente").fill("Kiosco Sol");
  await page.getByRole("button", { name: "Guardar reclamo" }).click();
  await expect(page.locator("[data-reclamo-listo]")).toContainText(`Reclamo Nº 603 / ${ANIO} cargado`);
  const enviado = llamadas.find((x) => x[0] === "calidad_cargar_reclamo")[1];
  expect(enviado).toMatchObject({ p_legajo: 441, p_pin: "1234", p_datos: { producto: "Bx20Azul", lote: "343", reclamo_cliente: "MG: cloro", cliente: "Kiosco Sol", origen: "Sucursal" } });
  expect(enviado.p_datos.fecha).toBeUndefined();                          // la fecha la pone la base (hoy)
  // no hay lista de reclamos: solo "Cargar otro"
  await expect(page.getByRole("button", { name: "Cargar otro reclamo" })).toBeVisible();
});

test("responsable de acciones de mejora: completa los puntos 2, 3 y 4 desde el fichaje", async ({ page }) => {
  const llamadas = await fichajeConCalidad(page, { reclamos: false, acciones: true, acciones_pendientes: 1 }, {
    calidad_mis_acciones: { ok: true, acciones: [{ id: "pac_a", numero: 7, anio: ANIO, fecha: HOY, origen: "RECLAMO DE CLIENTE", proceso: "PRODUCCIÓN", hallazgo: "Reclamos repetidos del lote 343", estado: "Abierta" }], listas: {} },
    calidad_guardar_accion: { ok: true },
  });
  await entrar(page);
  await expect(page.locator("[data-btn-calidad]")).toContainText("Mis acciones de mejora");
  await expect(page.locator("[data-btn-calidad]")).toContainText("1");
  await page.locator("[data-btn-calidad]").click();
  await page.locator('[data-accion-item="pac_a"]').click();
  await expect(page.locator("[data-accion]")).toContainText("Reclamos repetidos del lote 343");
  await page.getByRole("button", { name: "Guardar y enviar a Calidad" }).click();
  await expect(page.getByText("Escribí la causa")).toBeVisible();
  await page.locator("[data-causa]").fill("Falla del dosificador de cloro");
  await page.locator("[data-correccion]").fill("Se retiró el lote");
  await page.locator("[data-accion-txt]").fill("Calibrar el dosificador todas las semanas");
  await page.getByRole("button", { name: "Guardar y enviar a Calidad" }).click();
  await expect(page.locator("[data-mis-acciones]")).toBeVisible();
  const g = llamadas.find((x) => x[0] === "calidad_guardar_accion")[1];
  expect(g).toMatchObject({ p_id: "pac_a", p_datos: { causa: "Falla del dosificador de cloro", correccion: "Se retiró el lote", accion: "Calibrar el dosificador todas las semanas" } });
});

test("empleado sin permiso de Calidad: no ve el botón y por el link le avisa", async ({ page }) => {
  await fichajeConCalidad(page, { reclamos: false, acciones: false });
  await entrar(page, "/fichaje/?ir=calidad");
  await expect(page.getByText("No tenés permiso para cargar reclamos")).toBeVisible();
  await expect(page.locator("[data-btn-calidad]")).toHaveCount(0);
});

// ---------- Gestión (Calidad) ----------
function datos(extra = {}) {
  return baseDePrueba({
    calidad_reclamos: [{ id: "r1", numero: 602, anio: ANIO, fecha: HOY, producto: "Bx20Azul", lote: "1", estado: "Abierto" }],
    calidad_pac: [{ id: "pac_x", numero: 3, anio: ANIO, fecha: HOY, hallazgo: "Algo", estado: "Abierta", reclamo_ids: [], responsable_legajo: 57, resp_completo_en: new Date().toISOString(), resp_completo_por: "Legajo 57 · Ancapillan, José" }],
    calidad_listas: [], ayudante_memoria: [],
    __rpc: {
      calidad_personal: { ok: true, empleados: [
        { legajo: 57, apellido: "Ancapillan", nombre: "José", sector: "Producción", calidad_reclamos: false, calidad_acciones: true, calidad_origen: "" },
        { legajo: 441, apellido: "Ainol", nombre: "Johana", sector: "Ventas", calidad_reclamos: true, calidad_acciones: false, calidad_origen: "Sucursal" },
        { legajo: 90, apellido: "Zapata", nombre: "Luis", sector: "Logística", calidad_reclamos: false, calidad_acciones: false, calidad_origen: "" }] },
      calidad_set_personal: { ok: true },
    },
    ...extra,
  });
}

test("Gestión: reclamo nuevo con Nº en gris, fecha de hoy bloqueada y reclamo del cliente en la recepción", async ({ page }) => {
  const errores = await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await expect(page.locator(".login-calidad")).toHaveCount(1);         // el link está en el ingreso
  await page.locator("#home-grid .area-card", { hasText: "Calidad" }).click();
  await page.click("#rq-nuevo");
  await expect(page.locator("#rq-nro")).toHaveText(`Nº 603 / ${ANIO}`);
  await expect(page.locator("#rq-fecha")).toHaveValue(HOY);
  await expect(page.locator("#rq-fecha")).toHaveAttribute("readonly", "");
  await expect(page.locator("#rq-parte1 #rq-cliente")).toHaveCount(1);  // "Reclamo del cliente" es de la 1ª parte
  const tops = await page.locator(".rq-linea > .field").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  expect(new Set(tops).size).toBe(1);                                    // producto, lote, hora y vto. en una línea
  await page.selectOption("#rq-producto", "Bx5Azul");
  await page.selectOption("#rq-cliente", "EE: insecto");
  await page.click("#rq-save");
  const r = (await escrituras(page, "calidad_reclamos")).map((x) => x[2]).pop();
  expect(r).toMatchObject({ numero: 603, fecha: HOY, reclamo_cliente: "EE: insecto", producto: "Bx5Azul" });
  expect(errores).toEqual([]);
});

test("Gestión: acción de mejora con responsable empleado y ⚙ Personal de Calidad", async ({ page }) => {
  await abrirGestion(page, datos(), { email: "admin@anafer.test" });
  await page.locator("#home-grid .area-card", { hasText: "Calidad" }).click();
  await page.click("#tab-ncpac");
  await expect(page.locator('#pq-body tr[data-id="pac_x"]')).toContainText("✍");
  // Sifoncito avisa que el responsable ya completó los puntos 2, 3 y 4
  await expect(page.locator("#ayuda-sug")).toContainText("1 que su responsable ya completó");
  await expect(page.locator("#ayuda-sug")).toContainText("Ancapillan, José completó los puntos 2, 3 y 4");
  await page.locator("#ayuda-sug").getByRole("button", { name: "Mañana me recordás" }).click();
  await page.locator('#pq-body tr[data-id="pac_x"]').click();
  await expect(page.locator("#pq-resp-estado")).toContainText("Ancapillan, José completó los puntos 2, 3 y 4");
  await page.click("#pq-cancel");
  await page.click("#pq-nuevo");
  await expect(page.locator("#pq-responsable option")).toHaveCount(2);   // solo quien tiene el permiso
  await page.fill("#pq-hallazgo", "Reclamos de insectos en Bx5");
  await page.selectOption("#pq-responsable", "57");
  await page.click("#pq-save");
  const p = (await escrituras(page, "calidad_pac")).map((x) => x[2]).pop();
  expect(p).toMatchObject({ responsable_legajo: 57, resp_accion: "Ancapillan, José", resp_correccion: "Ancapillan, José" });
  // ⚙ → Calidad → Personal de Calidad
  await page.click("#settings-btn");
  await page.click("#scatbtn-calidad");
  const box = page.locator('.cal-lista[data-lista="personal"]');
  await expect(box).toContainText("1 cargan reclamos · 1 son responsables");
  const fila = box.locator('tr[data-leg="90"]');
  await fila.locator(".p-rec").check();
  await expect.poll(async () => (await escrituras(page, "__rpc")).filter((x) => x[1] === "calidad_set_personal").length).toBe(1);
  const set = (await escrituras(page, "__rpc")).filter((x) => x[1] === "calidad_set_personal").pop()[2];
  expect(set).toEqual({ p_legajo: 90, p_reclamos: true, p_acciones: false, p_origen: "" });
  await expect(box).toContainText("2 cargan reclamos");
});
