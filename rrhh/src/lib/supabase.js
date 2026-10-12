// Conexión a Supabase. La key publishable es pública (va en el navegador),
// así que no hay problema en que esté acá.
// Se pueden cambiar sin tocar el código con las variables de entorno de
// Netlify VITE_SUPABASE_URL y VITE_SUPABASE_KEY (Site configuration →
// Environment variables). Sirve para pasar a la base única de Gestión.
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://mufkcgikyksuaoujicxl.supabase.co";
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY || "sb_publishable_fwAvWdIclQ_1a35-o46k8w_sMkhqeau";

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
