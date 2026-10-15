// Servidor estático mínimo para probar el sitio armado (../dist), como lo
// publica Netlify: una carpeta pide su index.html.
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(fileURLToPath(new URL(".", import.meta.url)), "..", "dist");
const tipos = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css",
  ".svg": "image/svg+xml", ".png": "image/png", ".json": "application/json", ".webmanifest": "application/manifest+json" };
const puerto = Number(process.env.PUERTO || 4173);

createServer(async (req, res) => {
  try {
    let ruta = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let archivo = join(raiz, ruta);
    if ((await stat(archivo).catch(() => null))?.isDirectory()) archivo = join(archivo, "index.html");
    const cuerpo = await readFile(archivo);
    res.writeHead(200, { "Content-Type": tipos[extname(archivo)] || "application/octet-stream" });
    res.end(cuerpo);
  } catch {
    res.writeHead(404); res.end("no encontrado");
  }
}).listen(puerto, () => console.log(`Sitio de prueba en http://127.0.0.1:${puerto}`));
