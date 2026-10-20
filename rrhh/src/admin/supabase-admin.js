import { SUPABASE_URL, SUPABASE_KEY } from "../lib/supabase.js";

let AUTH_TOKEN = null;
let REFRESH_TOKEN = null;
let ADMIN_EMAIL = null;

const authHeader = () => `Bearer ${AUTH_TOKEN || SUPABASE_KEY}`;

// ---- Sesión compartida con Gestión Anafer ----
// Gestión y Comercial guardan la sesión de Supabase en el navegador con la
// clave "sb-<proyecto>-auth-token" (formato de supabase-js). Si este panel usa
// la MISMA base (base única), lee esa sesión y entra sin pedir login; y al
// loguearse acá la guarda igual, así Gestión también la reconoce.
const PROYECTO = (() => { try { return new URL(SUPABASE_URL).hostname.split(".")[0]; } catch { return "x"; } })();
const CLAVE_SESION = `sb-${PROYECTO}-auth-token`;
function guardarSesion(d) {
  try {
    const expires_at = d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600);
    localStorage.setItem(CLAVE_SESION, JSON.stringify({ ...d, expires_at }));
  } catch { /* sin storage */ }
}
function aplicarSesion(d) {
  AUTH_TOKEN = d.access_token;
  REFRESH_TOKEN = d.refresh_token || null;
  ADMIN_EMAIL = d.user?.email || ADMIN_EMAIL;
}
// Devuelve true si había una sesión válida guardada (de acá o de Gestión).
export async function sesionGuardada() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(CLAVE_SESION) || "null"); } catch { d = null; }
  if (!d || !d.access_token) return false;
  aplicarSesion(d);
  const vence = (d.expires_at || 0) * 1000;
  if (vence && vence - Date.now() < 60000) {
    if (!(await refrescar())) { AUTH_TOKEN = null; REFRESH_TOKEN = null; return false; }
  }
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${AUTH_TOKEN}` } });
  if (!res.ok) { AUTH_TOKEN = null; REFRESH_TOKEN = null; return false; }
  const u = await res.json();
  ADMIN_EMAIL = u.email || ADMIN_EMAIL;
  return true;
}

export async function loginAdmin(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error("Credenciales inválidas");
  const d = await res.json();
  aplicarSesion(d);
  ADMIN_EMAIL = d.user?.email || email;
  guardarSesion(d);
  return d;
}

// Permiso del perfil para el panel de RR.HH. (⚙ → Acceso de Gestión). Si la
// base todavía no tiene la tabla usuarios (base de Fichajes separada), no se
// controla nada y funciona como siempre.
export async function permisoRRHH() {
  try {
    const email = (ADMIN_EMAIL || "").toLowerCase();
    const r = await sbFetch(`usuarios?select=*&email=eq.${encodeURIComponent(email)}`);
    if (r.status === 404 || r.status === 400) return "editar"; // no existe la tabla: base separada
    if (!r.ok) return "editar";
    const filas = await r.json();
    const fila = filas[0];
    if (!fila || fila.activo === false || !fila.perfil) return "oculta";
    const c = await sbFetch("app_config?select=roles&id=eq.auth");
    const roles = ((await c.json())[0] || {}).roles || [];
    const rol = roles.find((x) => x.id === fila.perfil);
    if (!rol) return "oculta";
    return (rol.permisos && rol.permisos.rrhh) || (rol.manageAccess ? "editar" : "oculta");
  } catch { return "editar"; }
}

// borrarCompartida=false: solo sale de este panel, sin cerrar la sesión de Gestión.
export function logoutAdmin(borrarCompartida = true) {
  AUTH_TOKEN = null; REFRESH_TOKEN = null;
  if (borrarCompartida) { try { localStorage.removeItem(CLAVE_SESION); } catch { /* sin storage */ } }
}
export function getAdminEmail() { return ADMIN_EMAIL; }

async function refrescar() {
  if (!REFRESH_TOKEN) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: REFRESH_TOKEN }),
    });
    if (!res.ok) return false;
    const d = await res.json();
    if (d.access_token) { AUTH_TOKEN = d.access_token; REFRESH_TOKEN = d.refresh_token || REFRESH_TOKEN; guardarSesion(d); return true; }
    return false;
  } catch { return false; }
}

async function sbFetch(path, options = {}, base = "rest/v1") {
  const hacer = () => fetch(`${SUPABASE_URL}/${base}/${path}`, {
    ...options,
    headers: { apikey: SUPABASE_KEY, Authorization: authHeader(), ...(options.headers || {}) },
  });
  let res = await hacer();
  if ((res.status === 401 || res.status === 403) && AUTH_TOKEN) {
    if (await refrescar()) res = await hacer();
    else {
      AUTH_TOKEN = null; REFRESH_TOKEN = null;
      alert("Tu sesión expiró. Volvé a iniciar sesión.");
      location.reload();
      throw new Error("Sesión expirada");
    }
  }
  return res;
}

export async function sbGet(path) {
  const res = await sbFetch(path);
  if (!res.ok) throw new Error(`Error consultando ${path}: ${res.status}`);
  return res.json();
}
// Trae TODAS las filas de una consulta, de a páginas (Supabase corta cada respuesta en "Max rows", 1000 por defecto).
// `path` debe incluir un order estable (ej. order=timestamp.asc,id.asc).
export async function sbGetAll(path, pagina = 1000) {
  const out = [];
  let offset = 0;
  for (let guard = 0; guard < 2000; guard++) {
    const res = await sbFetch(path, { headers: { "Range-Unit": "items", Range: `${offset}-${offset + pagina - 1}` } });
    if (res.status === 416) break; // pedimos más allá del final
    if (!res.ok) throw new Error(`Error consultando ${path}: ${res.status}`);
    const filas = await res.json();
    if (!filas.length) break;
    out.push(...filas);
    offset += filas.length; // avanza por lo que realmente vino (por si el servidor corta en menos)
    const total = Number((res.headers.get("Content-Range") || "").split("/")[1]);
    if (total && offset >= total) break;
  }
  return out;
}
export async function sbPatch(path, body) {
  const res = await sbFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error actualizando ${path}: ${res.status}`);
  return res.json();
}
export async function sbPost(path, body) {
  const res = await sbFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error guardando en ${path}: ${res.status}`);
  return res.json();
}
// Inserta o actualiza (si ya existe la clave): POST con merge-duplicates.
export async function sbUpsert(tabla, filas, onConflict) {
  const res = await sbFetch(`${tabla}${onConflict ? `?on_conflict=${onConflict}` : ""}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(filas),
  });
  if (!res.ok) throw new Error(`Error guardando en ${tabla}: ${res.status}`);
  return res.json();
}
export async function sbDelete(path) {
  const res = await sbFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`Error borrando ${path}: ${res.status}`);
  return true;
}
export async function sbRpc(fn, body) {
  const res = await sbFetch(`rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Error RPC ${fn}: ${res.status}`);
  return res.json();
}

// ---- Storage (archivos privados, p. ej. escaneos de DNI) ----
const encPath = (p) => p.split("/").map(encodeURIComponent).join("/");

export async function sbUpload(bucket, path, file) {
  const res = await sbFetch(`object/${bucket}/${encPath(path)}`, {
    method: "POST",
    headers: { "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
    body: file,
  }, "storage/v1");
  if (!res.ok) {
    let msg = ""; try { msg = (await res.json()).message || ""; } catch { /* sin cuerpo */ }
    throw new Error(`No se pudo subir el archivo (${res.status}) ${msg}`);
  }
  return res.json();
}

// Link temporal (por defecto 5 minutos) para ver/descargar un archivo privado
export async function sbSignedUrl(bucket, path, segundos = 300) {
  const res = await sbFetch(`object/sign/${bucket}/${encPath(path)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: segundos }),
  }, "storage/v1");
  if (!res.ok) throw new Error(`No se pudo abrir el archivo: ${res.status}`);
  const d = await res.json();
  return `${SUPABASE_URL}/storage/v1${d.signedURL || d.signedUrl}`;
}

export async function sbStorageDelete(bucket, path) {
  const res = await sbFetch(`object/${bucket}/${encPath(path)}`, { method: "DELETE" }, "storage/v1");
  if (!res.ok && res.status !== 404) throw new Error(`No se pudo borrar el archivo: ${res.status}`);
  return true;
}

// Registra una acción en la auditoría (no bloquea si falla)
export async function registrarAuditoria(accion, detalle) {
  try {
    await sbFetch("auditoria", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quien: ADMIN_EMAIL || "admin", accion, detalle: detalle || null }),
    });
  } catch { /* la auditoría no debe romper la acción principal */ }
}

// Llama a una Edge Function con la sesión del usuario (sin el aviso de "sesión expirada":
// quien la usa decide qué hacer si falla).
export async function sbFuncion(nombre, body) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${nombre}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(`${nombre}: ${res.status}`);
  return res.json();
}
