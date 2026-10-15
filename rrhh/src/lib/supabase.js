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
