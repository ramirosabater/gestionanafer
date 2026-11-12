// Nomenclatura nueva de productos: se muestra la abreviatura y, al pasar el
// mouse por arriba, la descripción.
import { test, expect } from "@playwright/test";
import { baseDePrueba, abrirGestion } from "../apoyo/gestion.js";

test("abreviaturas nuevas y cartelito con la descripción al pasar el mouse", async ({ page }) => {
  const errores = await abrirGestion(page, baseDePrueba(), { email: "admin@anafer.test" });
  const r = await page.evaluate(() => ({
    soda: ProductosAnafer.mostrar("SODA 1.500 CC."),
    bidon: ProductosAnafer.mostrar("BIDON DE  12 LTS VERDE"),         // doble espacio como viene en Comercial
    sinAbrev: ProductosAnafer.mostrar("BUZO IVESS ANAFER"),
    otra: ProductosAnafer.mostrar("PROMO FAMILIA 1 MENOS SODIO"),
    desc: ProductosAnafer.descripcion("B20A"),
  }));
  expect(r).toEqual({ soda: "S1500", bidon: "B12V", sinAbrev: "BUZO IVESS ANAFER", otra: "PROMO FAMILIA 1 MENOS SODIO", desc: "BIDON 20 L." });

  // un chip de carga como los de Logística
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.innerHTML = '<span class="day-cargo-chip" id="chip">B20A × 12</span> <span id="celda">S1750</span> <span id="nada">Sucursal Centro</span>'
      + '<select id="sel"><option>B12A</option><option>Otro</option></select>';
    d.style.cssText = "position:fixed;top:10px;left:10px;z-index:99999;background:#fff";
    document.body.appendChild(d);
  });
  await page.hover("#chip");
  await expect(page.locator("#chip")).toHaveAttribute("title", "BIDON 20 L. (cód. 13)");
  await page.hover("#celda");
  await expect(page.locator("#celda")).toHaveAttribute("title", "SIF.1.750 CC MENOS SODIO (cód. 05)");
  await page.hover("#nada");
  expect(await page.locator("#nada").getAttribute("title")).toBeNull();
  await page.hover("#sel");
  await expect(page.locator("#sel option").first()).toHaveAttribute("title", "BIDON 12 L. (cód. 14)");
  expect(errores).toEqual([]);
});

