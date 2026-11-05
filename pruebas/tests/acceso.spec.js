// ⚙ → Acceso: alta de usuarios desde la app, perfiles y excepciones por persona.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion, escrituras } from "../apoyo/gestion.js";

async function abrirAcceso(page) {
  await page.click("#settings-btn");
  await page.click("#scatbtn-acceso");
  await expect(page.locator("#acc-usuarios tr").first()).toBeVisible();
}
// La función usuarios-admin simulada: lista cuentas y registra lo que llega
async function conFuncion(page, cuentas) {
  await page.addInitScript((cuentas) => {
    window.__FN = { "usuarios-admin": (body) => body.accion === "listar" ? { data: { cuentas } } : { data: { ok: true, ya_existia: false } } };
  }, cuentas);
}
const llamadas = async (page) => (await escrituras(page, "__funciones")).filter((x) => x[1] === "usuarios-admin").map((x) => x[2]);

test("alta desde la app: crea la cuenta con perfil y una excepción solo para esa persona", async ({ page }) => {
  await conFuncion(page, [
    { email: "admin@anafer.test", creado: "2026-10-01T10:00:00Z", ultimo_ingreso: new Date().toISOString() },
    { email: "suelto@anafer.test", creado: "2026-11-01T10:00:00Z", ultimo_ingreso: null },
  ]);
  const errores = await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test" });
  await abrirAcceso(page);
  await expect(page.locator("#acc-usuarios")).toContainText("admin@anafer.test");
  await expect(page.locator("#acc-usuarios tr", { hasText: "admin@anafer.test" })).toContainText("hoy");
  // cuenta de Supabase que no está anotada
  await expect(page.locator("#acc-sin-anotar")).toContainText("suelto@anafer.test");

  await page.click("#acc-nuevo");
  await page.fill("#usr-email", "Juan@Anafer.test");
  await page.fill("#usr-nombre", "Juan Pérez");
  await page.selectOption("#usr-perfil", "compras");
  // Tesorería: el perfil dice Editar; para Juan solo Ver → excepción resaltada
  const fila = page.locator('#usr-permisos .acc-perm[data-tab="tesoreria"]');
  await fila.locator('button[data-v="ver"]').click();
  await expect(page.locator('#usr-permisos .acc-perm[data-tab="tesoreria"]')).toHaveClass(/ex/);
  await page.locator('#usr-permisos .acc-perm[data-tab="grid"] button[data-v="ver"]').click();
  await page.click("#usr-save");
  await expect(page.locator("#toast")).toContainText("contraseña inicial");
  await page.click("#usr-generar");
  expect((await page.inputValue("#usr-pass")).length).toBe(10);
  await page.click("#usr-save");
  await expect(page.locator("#usr-overlay")).not.toHaveClass(/show/);
  await expect(page.locator("#toast")).toContainText("Usuario creado");
  const alta = (await llamadas(page)).find((b) => b.accion === "crear");
  expect([alta.email, alta.nombre, alta.perfil, alta.permisos_extra]).toEqual(["juan@anafer.test", "Juan Pérez", "compras", { tesoreria: "ver", grid: "ver" }]);
  expect(alta.password.length).toBe(10);
  expect(errores).toEqual([]);
});

test("sin la función publicada: anota al usuario y avisa que la cuenta se crea en Supabase; editar y quitar excepciones", async ({ page }) => {
  const db = baseDePrueba();
  db.usuarios.find((u) => u.email === "compras@anafer.test").permisos_extra = { tesoreria: "oculta" };
  const errores = await abrirGestion(page, db, { email: "admin@anafer.test" });
  await abrirAcceso(page);
  await expect(page.locator("#acc-sin-funcion")).toBeVisible();
  await expect(page.locator("#acc-usuarios tr", { hasText: "compras@anafer.test" })).toContainText("Tesorería: no");

  await page.click("#acc-nuevo");
  await expect(page.locator("#usr-sin-funcion")).toBeVisible();
  await page.fill("#usr-email", "ana@anafer.test");
  await page.fill("#usr-pass", "unaclave123");
  await page.click("#usr-save");
  await expect(page.locator("#toast")).toContainText("Authentication");
  const ana = (await escrituras(page, "usuarios")).map((x) => x[2]).find((u) => u.email === "ana@anafer.test");
  expect([ana.perfil, ana.activo]).toEqual(["compras", true]);

  // Editar a compras@: quitar la excepción y desactivarlo
  await page.locator("#acc-usuarios tr", { hasText: "compras@anafer.test" }).click();
  await expect(page.locator('#usr-permisos .acc-perm[data-tab="tesoreria"]')).toHaveClass(/ex/);
  await page.click("#usr-sin-ex");
  await expect(page.locator('#usr-permisos .acc-perm.ex')).toHaveCount(0);
  await page.uncheck("#usr-activo");
  await page.click("#usr-save");
  const upd = (await escrituras(page, "usuarios")).filter((x) => x[1] === "update").pop();
  expect([upd[2].permisos_extra, upd[2].activo, upd[3]]).toEqual([{}, false, [["email", "compras@anafer.test"]]]);
  expect(errores).toEqual([]);
});

test("la excepción manda sobre el perfil al entrar", async ({ page }) => {
  const db = baseDePrueba();
  db.usuarios.find((u) => u.email === "compras@anafer.test").permisos_extra = { tesoreria: "oculta", grid: "ver" };
  const errores = await abrirGestion(page, db, { email: "compras@anafer.test" });
  // Por la excepción ve Logística (además de Administración): aparece el inicio con las dos áreas
  await expect(page.locator("#view-home")).toBeVisible();
  await page.getByRole("button", { name: /Administración/ }).first().click();
  await expect(page.locator("#tab-compras")).toBeVisible();
  await expect(page.locator("#tab-tesoreria")).toBeHidden();
  expect(errores).toEqual([]);
});

test("perfiles: crear uno nuevo y no dejar borrar uno en uso", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test" });
  await abrirAcceso(page);
  await page.click('#acc-tabs button[data-acc="perfiles"]');
  await page.click("#acc-nuevo-perfil");
  await page.fill("#pf-nombre", "Jefe de sector");
  await page.locator('#pf-permisos .acc-perm[data-tab="solicitudes"] button[data-v="editar"]').click();
  await page.click("#pf-guardar");
  await expect(page.locator("#toast")).toContainText('Perfil "Jefe de sector" guardado');
  const roles = (await escrituras(page, "app_config")).map((x) => x[2]).pop().roles;
  const jefe = roles.find((r) => r.nombre === "Jefe de sector");
  expect([jefe.id, jefe.manageAccess, jefe.permisos.solicitudes, jefe.permisos.compras]).toEqual(["jefe_de_sector", false, "editar", "oculta"]);
  // El perfil Compras lo usa compras@: no se puede eliminar
  await page.locator(".acc-pf", { hasText: "Compras" }).click();
  await page.click("#pf-borrar");
  await expect(page.locator("#toast")).toContainText("No se puede eliminar");
  // El nuevo perfil aparece para asignar
  await page.click('#acc-tabs button[data-acc="usuarios"]');
  await page.click("#acc-nuevo");
  await expect(page.locator("#usr-perfil option", { hasText: "Jefe de sector" })).toHaveCount(1);
  expect(errores).toEqual([]);
});
