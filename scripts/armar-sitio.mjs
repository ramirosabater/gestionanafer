// Arma la carpeta dist/ que publica Netlify:
//   - dist/fichaje/  ya la generó el build de rrhh/ (Vite)
//   - acá se copian los archivos de gestion/ a la raíz de dist/
// Los SQL (base-de-datos/) y las funciones de Supabase NO se publican.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const origen = join(raiz, "gestion");
const destino = join(raiz, "dist");

if (!existsSync(join(origen, "config.js"))) {
  console.error("\n✖ Falta gestion/config.js (las claves de Supabase y Google de Gestión).");
  console.error("  Copiá tu config.js actual adentro de la carpeta gestion/ y volvé a publicar.\n");
  process.exit(1);
}
if (!existsSync(join(destino, "fichaje", "index.html"))) {
  console.error("\n✖ No está dist/fichaje: falló o no corrió el build de rrhh/.\n");
  process.exit(1);
}
mkdirSync(destino, { recursive: true });
for (const nombre of readdirSync(origen)) {
  if (nombre === "fichaje") continue; // por las dudas: no pisar el build de RR.HH.
  cpSync(join(origen, nombre), join(destino, nombre), { recursive: true });
}
console.log("✓ Sitio armado en dist/: Gestión en la raíz y Fichaje/RR.HH. en dist/fichaje");
