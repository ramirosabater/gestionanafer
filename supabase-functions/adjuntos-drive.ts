// =====================================================================
// adjuntos-drive — Supabase Edge Function
// Todos los archivos de Gestión Anafer se guardan en UNA unidad compartida de
// Google Drive de la empresa ("Gestión Anafer"), con una carpeta por módulo:
//
//   Administración / Proveedores / <proveedor>      (ficha del proveedor)
//   Administración / Facturas / <proveedor>         (facturas)
//   Calidad / Reclamos 2026 / Reclamo Nº 12         (fotos de reclamos)
//   RR.HH. / Legajos / 123 - Pérez, Juan            (documentos y certificados)
//
// En la unidad solo están el administrador y la CUENTA DE GOOGLE DEL SISTEMA
// (una cuenta de la empresa que autorizó una vez el acceso) que usa esta función. Nadie navega la unidad: cada usuario sube y abre los
// archivos desde la app, según los permisos de su perfil (los mismos de la
// base: puede_ver / puede_editar). Los empleados (legajo + PIN, sin cuenta de
// Google) suben sus certificados igual.
//
// Acciones (POST, multipart/form-data o JSON):
//   subir        usuario con permiso de editar el módulo      archivo a <módulo>/<carpetas…>
//   abrir        usuario con permiso de ver el módulo         devuelve el archivo
//   quitar       usuario con permiso de editar el módulo      manda el archivo a la papelera
//   documento    RR.HH. (editar)    documento del legajo (queda en empleado_documentos)
//   certificado  empleado (legajo + PIN)   certificado de una solicitud
//   ver          RR.HH. (ver)       documento del legajo registrado en la base
//   borrar       RR.HH. (editar)    borra el documento del legajo
//   migrar       RR.HH. (editar)    pasa los legajos del almacenamiento de Supabase (de a 15)
//
// Secretos (Edge Functions > Secrets):
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET   cliente OAuth "Aplicación web" del proyecto
//   GOOGLE_REFRESH_TOKEN      la autorización de la cuenta de Google del sistema (una sola vez)
//   DRIVE_UNIDAD_ID           id de la unidad compartida "Gestión Anafer"
//   (GOOGLE_SA_JSON solo si se usa una cuenta de servicio en vez de lo anterior)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase solo.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_BYTES = 15 * 1024 * 1024;
// Módulos: carpeta de primer nivel y secciones de permiso (las del perfil en ⚙ → Acceso)
const MODULOS: Record<string, { carpeta: string; ver: string[]; editar: string[] }> = {
  administracion: { carpeta: 'Administración', ver: ['compras', 'pagos', 'tesoreria'], editar: ['compras', 'pagos'] },
  calidad: { carpeta: 'Calidad', ver: ['reclamos', 'ncpac', 'calidash'], editar: ['reclamos', 'ncpac'] },
  rrhh: { carpeta: 'RR.HH.', ver: ['rrhh'], editar: ['rrhh'] },
};
const TIPOS_OK = /^(application\/pdf|image\/[a-z0-9.+-]+|application\/msword|application\/vnd\.openxmlformats-officedocument\.[a-z.]+|application\/vnd\.ms-excel|text\/(plain|csv|xml)|application\/(xml|zip|x-zip-compressed))$/i;
// Algunos navegadores no mandan el tipo: se deduce de la extensión
const POR_EXT: Record<string, string> = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', heic: 'image/heic', webp: 'image/webp',
  xml: 'application/xml', csv: 'text/csv', txt: 'text/plain', zip: 'application/zip', doc: 'application/msword', xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
const tipoDe = (a: File) => a.type || POR_EXT[(a.name.split('.').pop() || '').toLowerCase()] || '';
const DRIVE = 'https://www.googleapis.com/drive/v3';
const ALL = 'supportsAllDrives=true';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function publicKey(req: Request): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    if (keys && typeof keys.default === 'string' && keys.default) return keys.default;
  } catch (_) { /* sigue */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
}
const servicio = () => createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

// ---------- Google: token de acceso ----------
// Forma principal: la autorización que dio UNA VEZ una cuenta de Google de la
// empresa (miembro de la unidad): el servidor guarda su "refresh token" y con
// eso pide un token nuevo cada hora. Secretos:
//   GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN
// Alternativa (si algún día se habilitan las claves): cuenta de servicio con
// GOOGLE_SA_JSON.
let tokenCache: { token: string; vence: number } | null = null;
const b64url = (b: Uint8Array | string) =>
  btoa(typeof b === 'string' ? b : String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function pedirToken(body: URLSearchParams, quien: string): Promise<string> {
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const d = await res.json();
  if (!res.ok || !d.access_token) {
    const motivo = d.error === 'invalid_grant'
      ? 'la autorización de la cuenta de Google se venció o se revocó: hay que volver a autorizarla (ver ADJUNTOS-EN-DRIVE.md)'
      : (d.error_description || d.error || res.status);
    throw new Error(`Google no aceptó ${quien}: ${motivo}`);
  }
  tokenCache = { token: d.access_token, vence: Date.now() + (Number(d.expires_in) || 3600) * 1000 };
  return tokenCache.token;
}
async function googleToken(): Promise<string> {
  if (tokenCache && tokenCache.vence > Date.now() + 60_000) return tokenCache.token;
  const refresh = Deno.env.get('GOOGLE_REFRESH_TOKEN');
  if (refresh) {
    const id = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID'), secreto = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    if (!id || !secreto) throw new Error('Faltan los secretos GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET.');
    return pedirToken(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh, client_id: id, client_secret: secreto }), 'la cuenta de Google del sistema');
  }
  const raw = Deno.env.get('GOOGLE_SA_JSON');
  if (!raw) throw new Error('Google Drive no está configurado en el servidor (falta GOOGLE_REFRESH_TOKEN).');
  const sa = JSON.parse(raw);
  const ahora = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const cabecera = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const cuerpo = b64url(JSON.stringify({ iss: sa.client_email, scope: 'https://www.googleapis.com/auth/drive', aud: 'https://oauth2.googleapis.com/token', iat: ahora, exp: ahora + 3600 }));
  const pem = String(sa.private_key).replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const firma = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${cabecera}.${cuerpo}`)));
  return pedirToken(new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${cabecera}.${cuerpo}.${b64url(firma)}` }), 'la cuenta de servicio');
}
async function drive(path: string, init: RequestInit = {}): Promise<Response> {
  const t = await googleToken();
  return fetch(path.startsWith('http') ? path : `${DRIVE}${path}`, { ...init, headers: { Authorization: `Bearer ${t}`, ...(init.headers || {}) } });
}
function unidad(): string {
  const id = Deno.env.get('DRIVE_UNIDAD_ID');
  if (!id) throw new Error('Falta el secreto DRIVE_UNIDAD_ID (unidad compartida "Gestión Anafer").');
  return id;
}
// Carpeta (la crea si no está) dentro de otra, por nombre
const carpetasCache: Record<string, string> = {};
async function carpeta(nombre: string, padre: string): Promise<string> {
  const k = padre + '/' + nombre;
  if (carpetasCache[k]) return carpetasCache[k];
  const q = `'${padre}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and name='${nombre.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  const r = await drive(`/files?q=${encodeURIComponent(q)}&fields=files(id)&corpora=drive&driveId=${unidad()}&includeItemsFromAllDrives=true&${ALL}`);
  const d = await r.json();
  if (!r.ok) throw new Error('Drive: ' + (d.error?.message || r.status));
  let id = d.files?.[0]?.id;
  if (!id) {
    const c = await drive(`/files?fields=id&${ALL}`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nombre, mimeType: 'application/vnd.google-apps.folder', parents: [padre] }) });
    const dc = await c.json();
    if (!c.ok) throw new Error('Drive: no se pudo crear la carpeta ' + nombre + ' (' + (dc.error?.message || c.status) + ')');
    id = dc.id;
  }
  return (carpetasCache[k] = id);
}
async function ruta(nombres: string[]): Promise<string> {
  let p = unidad();
  for (const n of nombres) p = await carpeta(n, p);
  return p;
}
// Carpeta del empleado (RR.HH. / Legajos): se busca por la marca "legajo" (aunque la renombren)
async function carpetaEmpleado(legajo: number, nombre: string): Promise<string> {
  const legajos = await ruta(['RR.HH.', 'Legajos']);
  const q = `'${legajos}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false and appProperties has { key='legajo' and value='${legajo}' }`;
  const r = await drive(`/files?q=${encodeURIComponent(q)}&fields=files(id)&corpora=drive&driveId=${unidad()}&includeItemsFromAllDrives=true&${ALL}`);
  const d = await r.json();
  if (!r.ok) throw new Error('Drive: ' + (d.error?.message || r.status));
  if (d.files?.length) return d.files[0].id;
  const c = await drive(`/files?fields=id&${ALL}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: `${legajo} - ${nombre}`.trim(), mimeType: 'application/vnd.google-apps.folder', parents: [legajos], appProperties: { legajo: String(legajo), modulo: 'rrhh' } }),
  });
  const dc = await c.json();
  if (!c.ok) throw new Error('Drive: no se pudo crear la carpeta del empleado (' + (dc.error?.message || c.status) + ')');
  return dc.id;
}
async function subirArchivo(carpeta: string, nombre: string, mime: string, datos: Uint8Array, props: Record<string, string>) {
  const limite = 'legajo' + crypto.randomUUID().replace(/-/g, '');
  const meta = JSON.stringify({ name: nombre, parents: [carpeta], appProperties: props });
  const enc = new TextEncoder();
  const partes = [enc.encode(`--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${limite}\r\nContent-Type: ${mime}\r\n\r\n`), datos, enc.encode(`\r\n--${limite}--`)];
  const cuerpo = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of partes) { cuerpo.set(p, o); o += p.length; }
  const r = await drive(`https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size&${ALL}`, {
    method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${limite}` }, body: cuerpo,
  });
  const d = await r.json();
  if (!r.ok) throw new Error('Drive: no se pudo subir el archivo (' + (d.error?.message || r.status) + ')');
  return d as { id: string; name: string; mimeType: string; size: string };
}
const aPapelera = (id: string) => drive(`/files/${encodeURIComponent(id)}?${ALL}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) }).catch(() => null);
const idDrive = (path: string) => (String(path || '').startsWith('drive:') ? String(path).slice(6) : '');

// ---------- Lectura del pedido ----------
type Pedido = { campos: Record<string, string>; archivo: File | null };
async function leerPedido(req: Request): Promise<Pedido> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData();
    const campos: Record<string, string> = {};
    let archivo: File | null = null;
    for (const [k, v] of fd.entries()) { if (typeof v === 'string') campos[k] = v; else if (k === 'archivo') archivo = v; }
    return { campos, archivo };
  }
  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch (_) { /* vacío */ }
  const campos: Record<string, string> = {};
  for (const [k, v] of Object.entries(b)) if (v != null) campos[k] = String(v);
  return { campos, archivo: null };
}
function revisarArchivo(a: File | null): string | null {
  if (!a) return 'Falta el archivo.';
  if (a.size > MAX_BYTES) return 'El archivo pesa más de 15 MB.';
  if (!TIPOS_OK.test(tipoDe(a))) return 'Ese tipo de archivo no se acepta (subí PDF, foto o documento de Office).';
  return null;
}
const limpiar = (s: string) => s.replace(/[\\/:*?"<>|\r\n]+/g, ' ').trim().slice(0, 120);

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);
  try {
    const { campos, archivo } = await leerPedido(req);
    const accion = campos.accion || '';
    const admin = servicio();

    // ===== Empleado desde el fichaje: certificado de una solicitud =====
    if (accion === 'certificado') {
      const legajo = parseInt(campos.legajo, 10), pin = campos.pin || '', solicitud = campos.solicitud || '';
      if (!legajo || !pin || !solicitud) return json({ ok: false, motivo: 'faltan_datos' }, 400);
      const err = revisarArchivo(archivo); if (err) return json({ ok: false, motivo: 'archivo', error: err }, 400);
      // PIN y que la solicitud sea suya, antes de subir nada
      const pub = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(req));
      const { data: mis } = await pub.rpc('mis_solicitudes', { p_legajo: legajo, p_pin: pin });
      if (!mis?.ok) return json({ ok: false, motivo: mis?.motivo || 'pin_incorrecto' }, 403);
      if (!(mis.solicitudes || []).some((s: { id: string }) => s.id === solicitud)) return json({ ok: false, motivo: 'no_existe' }, 404);
      const { data: emp } = await admin.from('empleados').select('apellido,nombre').eq('legajo', legajo).maybeSingle();
      const carpeta = await carpetaEmpleado(legajo, emp ? `${emp.apellido}, ${emp.nombre}` : '');
      const ext = (archivo!.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const nombre = `Certificado médico ${new Date().toISOString().slice(0, 10)} (${solicitud.slice(0, 8)}).${ext}`;
      const up = await subirArchivo(carpeta, nombre, tipoDe(archivo!), new Uint8Array(await archivo!.arrayBuffer()), { modulo: 'rrhh', legajo: String(legajo), tipo: 'Certificado médico', solicitud });
      const { data: r, error } = await admin.rpc('adjuntar_certificado_drive', { p_legajo: legajo, p_pin: pin, p_id: solicitud, p_file_id: up.id, p_nombre: archivo!.name || 'certificado', p_mime: archivo!.type || null, p_tamano: archivo!.size });
      if (error || !r?.ok) { await aPapelera(up.id); return json({ ok: false, motivo: r?.motivo || 'error', error: error?.message }, 400); }
      return json({ ok: true });
    }

    // ===== Adjuntos de cualquier módulo: subir / abrir / quitar =====
    if (accion === 'subir' || accion === 'abrir' || accion === 'quitar') {
      const mod = MODULOS[campos.modulo || ''];
      if (!mod) return json({ error: 'Módulo desconocido.' }, 400);
      const usr = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(req),
        { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
      const edita = accion !== 'abrir';
      const { data: puede } = await usr.rpc(edita ? 'puede_editar' : 'puede_ver', { secciones: edita ? mod.editar : mod.ver });
      if (puede !== true) return json({ error: 'No tenés permiso para ' + (edita ? 'cargar archivos en ' : 'ver los archivos de ') + mod.carpeta + '.' }, 403);
      if (accion === 'subir') {
        const err = revisarArchivo(archivo); if (err) return json({ error: err }, 400);
        let sub: string[] = [];
        try { sub = JSON.parse(campos.carpetas || '[]'); } catch (_) { sub = []; }
        sub = (Array.isArray(sub) ? sub : []).map((x) => limpiar(String(x))).filter(Boolean).slice(0, 4);
        const { data: u } = await usr.auth.getUser();
        const dest = await ruta([mod.carpeta, ...sub]);
        const up = await subirArchivo(dest, limpiar(archivo!.name) || 'archivo', tipoDe(archivo!),
          new Uint8Array(await archivo!.arrayBuffer()), { modulo: campos.modulo, subido_por: u?.user?.email || '' });
        return json({ ok: true, archivo: { id: up.id, name: up.name, contentType: up.mimeType, sizeBytes: Number(up.size) || archivo!.size, unidad: true } });
      }
      // abrir / quitar: solo archivos de la unidad y de ese módulo
      const id = String(campos.id || '').replace(/[^A-Za-z0-9_-]/g, '');
      const m = await drive(`/files/${id}?fields=name,mimeType,driveId,appProperties,trashed&${ALL}`);
      const meta = await m.json();
      if (!m.ok || meta.driveId !== unidad() || meta.appProperties?.modulo !== campos.modulo) return json({ error: 'No existe ese archivo.' }, 404);
      if (accion === 'quitar') { await aPapelera(id); return json({ ok: true }); }
      const r = await drive(`/files/${id}?alt=media&${ALL}`);
      if (!r.ok) return json({ error: 'Drive no devolvió el archivo (' + r.status + ').' }, 502);
      return new Response(r.body, { headers: { ...CORS, 'Content-Type': meta.mimeType || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(meta.name || 'archivo')}`, 'Cache-Control': 'no-store' } });
    }

    // ===== RR.HH.: permisos según el perfil del usuario (los mismos de la base) =====
    const usuario = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(req),
      { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const editar = ['documento', 'borrar', 'migrar'].includes(accion);
    const { data: ok } = await usuario.rpc(editar ? 'puede_editar' : 'puede_ver', { secciones: ['rrhh'] });
    if (ok !== true) return json({ error: editar ? 'No tenés permiso para editar legajos.' : 'No tenés permiso para ver legajos.' }, 403);
    const { data: u } = await usuario.auth.getUser();
    const quien = u?.user?.email || 'RR.HH.';

    if (accion === 'documento') {
      const legajo = parseInt(campos.legajo, 10), tipo = limpiar(campos.tipo || 'Documento');
      if (!legajo) return json({ error: 'Falta el legajo.' }, 400);
      const err = revisarArchivo(archivo); if (err) return json({ error: err }, 400);
      const { data: emp } = await admin.from('empleados').select('apellido,nombre').eq('legajo', legajo).maybeSingle();
      if (!emp) return json({ error: 'No existe ese legajo.' }, 404);
      const carpeta = await carpetaEmpleado(legajo, `${emp.apellido}, ${emp.nombre}`);
      const nombre = `${tipo} - ${limpiar(archivo!.name)}`;
      const up = await subirArchivo(carpeta, nombre, tipoDe(archivo!), new Uint8Array(await archivo!.arrayBuffer()), { modulo: 'rrhh', legajo: String(legajo), tipo });
      const fila = { legajo, tipo, nombre_archivo: archivo!.name, path: `drive:${up.id}`, mime: archivo!.type || null, tamano: archivo!.size, vencimiento: campos.vencimiento || null, subido_por: quien };
      const { data: ins, error } = await admin.from('empleado_documentos').insert(fila).select().single();
      if (error) { await aPapelera(up.id); return json({ error: 'No se pudo registrar el documento: ' + error.message }, 400); }
      return json({ ok: true, documento: ins });
    }

    if (accion === 'ver') {
      const id = idDrive(campos.path || '');
      if (!id) return json({ error: 'Ese archivo no está en Drive.' }, 400);
      // Solo archivos que estén registrados en la base
      const path = `drive:${id}`;
      const [{ count: c1 }, { count: c2 }] = await Promise.all([
        admin.from('empleado_documentos').select('id', { count: 'exact', head: true }).eq('path', path),
        admin.from('solicitudes').select('id', { count: 'exact', head: true }).eq('certificado_path', path),
      ]);
      if (!c1 && !c2) return json({ error: 'No existe ese documento.' }, 404);
      const m = await drive(`/files/${encodeURIComponent(id)}?fields=name,mimeType,driveId&${ALL}`).then((x) => x.json()).catch(() => ({}));
      if (m.driveId !== unidad()) return json({ error: 'No existe ese documento.' }, 404);
      const r = await drive(`/files/${encodeURIComponent(id)}?alt=media&${ALL}`);
      if (!r.ok) return json({ error: 'Drive no devolvió el archivo (' + r.status + ').' }, 502);
      return new Response(r.body, { headers: { ...CORS, 'Content-Type': m.mimeType || r.headers.get('content-type') || 'application/octet-stream',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(m.name || 'documento')}`, 'Cache-Control': 'no-store' } });
    }

    if (accion === 'borrar') {
      const docId = campos.id || '';
      const { data: doc } = await admin.from('empleado_documentos').select('id,path').eq('id', docId).maybeSingle();
      if (!doc) return json({ error: 'No existe ese documento.' }, 404);
      const { error } = await admin.from('empleado_documentos').delete().eq('id', docId);
      if (error) return json({ error: 'No se pudo borrar: ' + error.message }, 400);
      const id = idDrive(doc.path);
      if (id) await aPapelera(id);   // queda 30 días en la papelera de la unidad
      else await admin.storage.from('legajos').remove([doc.path]);
      return json({ ok: true });
    }

    if (accion === 'migrar') {
      // De a 15 por llamada: el panel la vuelve a llamar hasta que no queden
      const { data: docs, error } = await admin.from('empleado_documentos').select('*').not('path', 'like', 'drive:%').limit(15);
      if (error) return json({ error: error.message }, 400);
      const nombres: Record<number, string> = {};
      const legs = [...new Set((docs || []).map((d) => d.legajo))];
      if (legs.length) {
        const { data: emps } = await admin.from('empleados').select('legajo,apellido,nombre').in('legajo', legs);
        (emps || []).forEach((e) => (nombres[e.legajo] = `${e.apellido}, ${e.nombre}`));
      }
      let pasados = 0; const fallas: string[] = [];
      for (const d of docs || []) {
        try {
          const { data: blob, error: e1 } = await admin.storage.from('legajos').download(d.path);
          if (e1 || !blob) throw new Error('no está en el almacenamiento');
          const carpeta = await carpetaEmpleado(d.legajo, nombres[d.legajo] || '');
          const up = await subirArchivo(carpeta, `${limpiar(d.tipo || 'Documento')} - ${limpiar(d.nombre_archivo || 'archivo')}`, d.mime || blob.type || 'application/octet-stream',
            new Uint8Array(await blob.arrayBuffer()), { modulo: 'rrhh', legajo: String(d.legajo), tipo: d.tipo || '' });
          const nuevo = `drive:${up.id}`;
          const { error: e2 } = await admin.from('empleado_documentos').update({ path: nuevo }).eq('id', d.id);
          if (e2) { await aPapelera(up.id); throw new Error(e2.message); }
          await admin.from('solicitudes').update({ certificado_path: nuevo }).eq('certificado_path', d.path);
          pasados++;
        } catch (e) {
          fallas.push(`${d.legajo} · ${d.nombre_archivo}: ${(e as Error).message}`);
          // marca para no reintentar en loop: queda con el path viejo y se informa
        }
      }
      const { count: quedan } = await admin.from('empleado_documentos').select('id', { count: 'exact', head: true }).not('path', 'like', 'drive:%');
      return json({ ok: true, pasados, fallas, quedan: quedan || 0, quien });
    }

    return json({ error: 'Acción desconocida.' }, 400);
  } catch (e) {
    return json({ error: (e as Error).message || 'Error en el servidor.' }, 500);
  }
});
