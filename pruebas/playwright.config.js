// Pruebas del sitio con una base de datos SIMULADA (nunca la real).
// Antes hay que armar el sitio: en la raíz del repo `npm run build` con
// VITE_SUPABASE_URL=https://mock.supabase.co y VITE_SUPABASE_KEY=prueba
// (así lo hace el workflow de GitHub .github/workflows/pruebas.yml).
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 1000 },
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    // En una máquina con Chromium propio se puede indicar su ruta con PW_CHROMIUM.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: {
    command: "node servidor.mjs",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: !process.env.CI,
  },
});
