// Ayudas para las pruebas de Gestión: abrir el sitio con una base simulada.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SUPABASE_FALSO = readFileSync(fileURLToPath(new URL("./supabase-falso.js", import.meta.url)), "utf8");

const TODO = { grid: "editar", branches: "editar", company: "editar", occasional: "editar", day: "editar", dashboard: "editar",
  compras: "editar", pagos: "editar", tesoreria: "editar", comercial: "editar", rrhh: "editar" };
const SOLO_ADMINISTRACION = { grid: "oculta", branches: "oculta", company: "oculta", occasional: "oculta", day: "oculta", dashboard: "oculta",
  compras: "editar", pagos: "editar", tesoreria: "editar", comercial: "oculta", rrhh: "oculta" };

// Base mínima con la que arranca cada prueba (se puede ampliar con `extra`).
export function baseDePrueba(extra = {}) {
  const base = {
    __cuentas: { "admin@anafer.test": "clave123", "compras@anafer.test": "clave123", "rrhh@anafer.test": "clave123" },
    app_config: [{ id: "auth", roles: [
      { id: "admin", nombre: "Admin", manageAccess: true, permisos: TODO },
      { id: "compras", nombre: "Compras", manageAccess: false, permisos: SOLO_ADMINISTRACION },
      { id: "rrhh", nombre: "RRHH", manageAccess: false, permisos: { ...Object.fromEntries(Object.keys(TODO).map((k) => [k, "oculta"])), rrhh: "editar" } },
    ] }],
    usuarios: [
      { email: "admin@anafer.test", activo: true, perfil: "admin" },
      { email: "compras@anafer.test", activo: true, perfil: "compras" },
      { email: "rrhh@anafer.test", activo: true, perfil: "rrhh" },
    ],
    proveedores: [], facturas: [], ordenes_pago: [], ordenes_compra: [], conceptos: [{ id: "gasoil", nombre: "Gasoil" }],
    centros_costo: [], rubros: [], cuentas: [], movimientos: [], cheques: [], medios_caja: [],
    gan_regimenes: [], gan_escalas: [], parametros: [],
  };
  for (const [k, v] of Object.entries(extra)) base[k] = v;
  return base;
}

// Abre Gestión con la base simulada. Si `email` viene, entra ya logueado.
export async function abrirGestion(page, db, { email = null, ruta = "/index.html" } = {}) {
  const errores = [];
  page.on("pageerror", (e) => errores.push(e.message));
  // Nada sale a internet: supabase-js se reemplaza por la base simulada y el
  // resto de lo externo (fuentes, Google, etc.) se corta.
  await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) =>
    /supabase-js|supabase(\.min)?\.js/.test(r.request().url())
      ? r.fulfill({ contentType: "application/javascript", body: SUPABASE_FALSO })
      : r.abort());
  await page.addInitScript(({ db, email }) => {
    window.__DB = db;
    if (email && !sessionStorage.getItem("prueba_iniciada")) {
      localStorage.clear();
      localStorage.setItem("prueba_sesion_email", email);
    }
    sessionStorage.setItem("prueba_iniciada", "1");
  }, { db, email });
  await page.goto(ruta);
  await page.waitForLoadState("networkidle");
  return errores;
}

export async function entrarAdministracion(page) {
  const tarjeta = page.getByText("Administración", { exact: false }).first();
  if (await page.locator("#view-home").isVisible().catch(() => false)) await tarjeta.click();
}

export async function escrituras(page, tabla) {
  return page.evaluate((t) => window.__S.escrituras.filter((x) => x[0] === t), tabla);
}
