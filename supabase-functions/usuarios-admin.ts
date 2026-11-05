// =====================================================================
// usuarios-admin — Supabase Edge Function
// Alta de usuarios desde Gestión (⚙ → Acceso → Usuarios) sin tener que
// entrar a Supabase: crea la cuenta (email + contraseña, ya confirmada) y la
// anota en la tabla usuarios con su perfil y sus excepciones.
//
// Solo la puede usar un administrador de Gestión (perfil con "administrar
// accesos"): se verifica con gestion_es_admin() usando la sesión de quien
// llama. Las cuentas se crean con la clave de servicio, que Supabase le da
// sola a la función (SUPABASE_SERVICE_ROLE_KEY): no hay que cargar secretos.
//
// Acciones (POST JSON {accion, ...}):
//   listar  → { cuentas: [{email, creado, ultimo_ingreso}] }  (cuentas de Supabase)
//   crear   → {email, password, nombre, perfil, permisos_extra}
//             Si la cuenta ya existía no le cambia la contraseña (ya_existia: true).
//   clave   → {email, password}  cambia la contraseña de esa cuenta
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const NIVELES = ['oculta', 'ver', 'editar'];

function publicKey(req: Request): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    if (keys && typeof keys.default === 'string' && keys.default) return keys.default;
  } catch (_) { /* sigue */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
const emailOk = (e: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
function limpiarExtra(x: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x as Record<string, unknown>)) {
      if (/^[a-z_]{2,30}$/.test(k) && typeof v === 'string' && NIVELES.includes(v)) out[k] = v;
    }
  }
  return out;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  // ¿Quién llama? Tiene que ser administrador de Gestión.
  const usuario = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(req),
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: u } = await usuario.auth.getUser();
  if (!u?.user) return json({ error: 'Tenés que haber ingresado.' }, 401);
  const { data: esAdmin, error: errAdmin } = await usuario.rpc('gestion_es_admin');
  if (errAdmin) return json({ error: 'No se pudo verificar tu permiso: ' + errAdmin.message }, 500);
  if (esAdmin !== true) return json({ error: 'Solo un administrador de accesos puede dar de alta usuarios.' }, 403);

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { return json({ error: 'Pedido inválido.' }, 400); }
  const accion = String(body.accion || '');

  async function todasLasCuentas() {
    const cuentas: { id: string; email: string; creado: string; ultimo_ingreso: string | null }[] = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      for (const x of data.users) cuentas.push({ id: x.id, email: (x.email || '').toLowerCase(), creado: x.created_at, ultimo_ingreso: x.last_sign_in_at ?? null });
      if (data.users.length < 200) break;
    }
    return cuentas;
  }

  try {
    if (accion === 'listar') {
      const cuentas = await todasLasCuentas();
      return json({ cuentas: cuentas.map(({ id: _id, ...c }) => c) });
    }

    const email = String(body.email || '').trim().toLowerCase();
    if (!emailOk(email)) return json({ error: 'El email no es válido.' }, 400);
    const password = String(body.password || '');

    if (accion === 'crear') {
      const perfil = body.perfil ? String(body.perfil) : null;
      const nombre = String(body.nombre || '').trim().slice(0, 80);
      if (perfil) {
        const { data: cfg } = await admin.from('app_config').select('roles').eq('id', 'auth').maybeSingle();
        const roles = (cfg?.roles || []) as { id: string }[];
        if (!roles.some((r) => r.id === perfil)) return json({ error: 'Ese perfil no existe. Guardá los perfiles primero.' }, 400);
      }
      let yaExistia = false;
      if (password.length < 8) return json({ error: 'La contraseña inicial tiene que tener al menos 8 caracteres.' }, 400);
      const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: nombre ? { nombre } : {} });
      if (error) {
        if (/already|registered|exists/i.test(error.message)) yaExistia = true;
        else return json({ error: 'No se pudo crear la cuenta: ' + error.message }, 400);
      }
      const fila: Record<string, unknown> = { email, activo: true, perfil, permisos_extra: limpiarExtra(body.permisos_extra) };
      if (nombre) fila.nombre = nombre;
      const { error: e2 } = await admin.from('usuarios').upsert(fila, { onConflict: 'email' });
      if (e2) return json({ error: 'La cuenta se creó pero no se pudo anotar el usuario: ' + e2.message }, 500);
      return json({ ok: true, ya_existia: yaExistia });
    }

    if (accion === 'clave') {
      if (password.length < 8) return json({ error: 'La contraseña tiene que tener al menos 8 caracteres.' }, 400);
      const c = (await todasLasCuentas()).find((x) => x.email === email);
      if (!c) return json({ error: 'Ese email no tiene cuenta todavía.' }, 404);
      const { error } = await admin.auth.admin.updateUserById(c.id, { password });
      if (error) return json({ error: 'No se pudo cambiar la contraseña: ' + error.message }, 400);
      return json({ ok: true });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return json({ error: 'Error del servidor: ' + ((e as Error)?.message || 'desconocido') }, 500);
  }
});
