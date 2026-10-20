// Conexión a Supabase. La key publishable es pública (va en el navegador).
// La base es SIEMPRE la misma que usa Gestión: se toma del config.js del
// sitio (window.SUPABASE_URL / window.SUPABASE_ANON_KEY, que se carga antes
// de la app desde ../config.js). Si no está (por ejemplo, corriendo la app
// sola en desarrollo), se usan las variables VITE_SUPABASE_URL/KEY.
// Ya NO hay valores fijos de la base vieja de Fichajes: así nunca se ficha
// por error en otra base.
const W = typeof window !== "undefined" ? window : {};
export const SUPABASE_URL = W.SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL || "";
export const SUPABASE_KEY = W.SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_KEY || "";
if (!SUPABASE_URL || !SUPABASE_KEY) console.error("Fichaje: falta la configuración de Supabase (config.js del sitio).");

const baseHeaders = () => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  "Content-Type": "application/json",
});

// Lee datos de una tabla (para tablas con lectura pública: horarios, locales)
export async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: baseHeaders() });
  if (!res.ok) throw new Error(`Error consultando ${path}: ${res.status}`);
  return res.json();
}

// Llama a una función (RPC) de Postgres — login, fichaje, historial, etc.
export async function sbRpc(fn, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: baseHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error RPC ${fn}: ${res.status}`);
  return res.json();
}

// Sube un archivo al bucket privado de legajos, solo en la carpeta
// certificados/<legajo>/ (la base no deja subir a otro lado ni leer nada).
export async function sbSubirCertificado(path, file) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/legajos/${path.split("/").map(encodeURIComponent).join("/")}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file,
  });
  if (!res.ok) throw new Error(`No se pudo subir el certificado: ${res.status}`);
  return res.json();
}

// Achica una foto (máx. 1600 px, JPEG) para que suba rápido desde el celular.
// Los PDF y lo que no se pueda leer como imagen se suben tal cual.
export async function achicarFoto(file, max = 1600) {
  if (!file || !/^image\//.test(file.type || "") || typeof document === "undefined") return file;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    URL.revokeObjectURL(url);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob], (file.name || "certificado").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch { return file; }
}
