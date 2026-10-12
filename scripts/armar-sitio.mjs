// Arma la carpeta dist/ que publica Netlify:
//   - dist/fichaje/  ya la generó el build de rrhh/ (Vite)
//   - acá se copian los archivos de gestion/ a la raíz de dist/
// Los SQL (base-de-datos/) y las funciones de Supabase NO se publican.
import { cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "gestion");
const destino = join(raiz, "dist");

if (!existsSync(join(destino, "fichaje", "index.html"))) {
  console.error("\n✖ No está dist/fichaje: falló o no corrió el build de rrhh/ (mirá los mensajes de arriba).\n");
  process.exit(1);
}
mkdirSync(destino, { recursive: true });
for (const nombre of readdirSync(origen)) {
  if (nombre === "fichaje") continue; // no pisar el build de RR.HH.
  cpSync(join(origen, nombre), join(destino, nombre), { recursive: true });
}

// config.js de Gestión: se busca en gestion/ y, si no está, en la raíz del
// repo (donde estaba antes). Si no está en ningún lado, se arma uno mínimo con
// las variables de Netlify (VITE_SUPABASE_URL / VITE_SUPABASE_KEY): la app
// anda, pero sin Google Drive ni lectura de facturas hasta que subas tu config.js.
const enGestion = join(origen, "config.js");
const enRaiz = join(raiz, "config.js");
if (existsSync(enGestion)) {
  console.log("✓ config.js tomado de gestion/");
} else if (existsSync(enRaiz)) {
  cpSync(enRaiz, join(destino, "config.js"));
  console.log("✓ config.js tomado de la raíz del repositorio");
} else if (process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_KEY) {
  writeFileSync(join(destino, "config.js"),
    `// Generado en el build (no se encontró config.js en el repositorio).\n` +
    `window.SUPABASE_URL = ${JSON.stringify(process.env.VITE_SUPABASE_URL)};\n` +
    `window.SUPABASE_ANON_KEY = ${JSON.stringify(process.env.VITE_SUPABASE_KEY)};\n` +
    `window.ANTHROPIC_API_KEY = "";\nwindow.GOOGLE_DRIVE_CLIENT_ID = "";\nwindow.GOOGLE_DRIVE_ROOT_FOLDER_ID = "";\n`);
  console.warn("⚠ No se encontró config.js: se armó uno con VITE_SUPABASE_URL/KEY (sin Google Drive). Subí tu config.js a gestion/ para tener todo.");
} else {
  console.error("\n✖ Falta config.js (ni en gestion/ ni en la raíz) y no están las variables VITE_SUPABASE_URL / VITE_SUPABASE_KEY.\n");
  process.exit(1);
}
console.log("✓ Sitio armado en dist/: Gestión en la raíz y Fichaje/RR.HH. en dist/fichaje");
