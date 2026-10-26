// Móviles de la planilla de flota: los de alcance 'gastos' (autoelevadores,
// utilitarios, acoplado) no se asignan a viajes pero muestran su ficha.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";

const TRUCKS = [
  { id: "13", label: "Camión 13", scope: "both", patente: "MYV 160", modelo: "Scania 310", anio: "2013", funcion: "Reparto empresas", flota: "Pesada" },
  { id: "5", label: "Camión 5 · Accelo 1016", scope: "both" },
  { id: "7", label: "Autoelevador 7", scope: "gastos", patente: "AYZ 89", flota: "Autoelevador" },
];

test("un móvil 'solo gastos' no aparece para viajes y la ficha muestra patente y modelo", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba({ trucks: TRUCKS }), { email: "admin@anafer.test" });
  const chips = page.locator("#stats-stripe");
  await expect(chips).toContainText("Camión 5 · Accelo 1016");
  await expect(chips).not.toContainText("Autoelevador 7");

  await page.click("#settings-btn");
  await page.click("#scatbtn-flota");
  await page.locator(".settings-subtabs .stabbtn", { hasText: "Camiones" }).click();
  const cards = page.locator("#trucks-list .truck-card");
  await expect(cards).toHaveCount(3);
  const auto = cards.nth(2);
  await expect(auto.locator('input[type="text"]')).toHaveValue("Autoelevador 7");
  await expect(auto.locator(".scope-select")).toHaveValue("gastos");
  await expect(auto.locator(".truck-card-ficha")).toHaveText("AYZ 89 · Autoelevador");
  await expect(cards.nth(0).locator(".truck-card-ficha"))
    .toHaveText("MYV 160 · Scania 310 · 2013 · Reparto empresas · Pesada");
  expect(errores).toEqual([]);
});
