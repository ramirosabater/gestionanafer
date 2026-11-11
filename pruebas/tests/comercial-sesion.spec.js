// Tablero Comercial: si el token del usuario venció (la página quedó abierta
// más de una hora), las llamadas a la base renuevan la sesión y reintentan.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";

test("importar con el token vencido: renueva la sesión y reintenta en vez de mostrar 'JWT expired'", async ({ page }) => {
  const db = baseDePrueba({ __tokenRenovado: "token-nuevo" });
  const errores = await abrirGestion(page, db, { email: "admin@anafer.test", ruta: "/comercial-dashboard.html" });
  const vistos = [];
  await page.route(/\/rest\/v1\/comercial_clientes/, (r) => {
    const auth = r.request().headers()["authorization"];
    vistos.push(auth);
    if (auth !== "Bearer token-nuevo")
      return r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ code: "PGRST303", details: null, hint: null, message: "JWT expired" }) });
    return r.fulfill({ status: 201, body: "" });
  });
  const estado = await page.evaluate(async () => {
    const res = await sbFetch(SUPABASE_URL + "/rest/v1/comercial_clientes", { method: "POST", headers: { ...H(), "Content-Type": "application/json" }, body: "[]" });
    return res.status;
  });
  expect(estado).toBe(201);
  expect(vistos.length).toBe(2);
  expect(vistos[1]).toBe("Bearer token-nuevo");
  expect(errores).toEqual([]);
});
