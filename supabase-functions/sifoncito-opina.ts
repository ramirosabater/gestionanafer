// =====================================================================
// sifoncito-opina — Supabase Edge Function
// Sifoncito lee los indicadores de los tableros (ya resumidos en el
// navegador: totales por mes, comparaciones, rankings) y escribe con IA una
// opinión sobre lo que está pasando en la empresa.
//
// La clave de Anthropic vive SOLO acá (secreto ANTHROPIC_API_KEY), igual que
// en leer-factura. Solo responde a usuarios con sesión y permiso de ver los
// tableros (función de la base puede_ver). El navegador no manda datos
// personales: solo números agregados.
//
// Secretos (Edge Functions > Secrets):
//   ANTHROPIC_API_KEY        obligatorio (el mismo de leer-factura)
//   ANTHROPIC_MODEL          opcional (por defecto claude-sonnet-4-5)
//   ANTHROPIC_WORKSPACE_ID   opcional
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_DATOS = 60_000; // caracteres del resumen de indicadores
const MODULOS = ['resumen', 'logistica', 'administracion', 'calidad', 'comercial', 'rrhh'];

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

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(req),
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: permitido, error: errPermiso } = await supabase.rpc('puede_ver', { secciones: ['tableros'] });
  if (errPermiso || permitido !== true) return json({ error: 'No tenés permiso para ver los tableros.' }, 403);

  let body: { modulo?: unknown; datos?: unknown } | null = null;
  try { body = await req.json(); } catch (_) { body = null; }
  const modulo = typeof body?.modulo === 'string' && MODULOS.includes(body.modulo) ? body.modulo : 'resumen';
  const datos = JSON.stringify(body?.datos ?? {});
  if (datos.length < 10) return json({ error: 'Faltan los indicadores.' }, 400);
  if (datos.length > MAX_DATOS) return json({ error: 'Demasiados datos para analizar.' }, 413);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'La IA no está configurada en el servidor (falta ANTHROPIC_API_KEY).' }, 500);
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5';

  const alcance = modulo === 'resumen' ? 'de toda la empresa (todos los módulos juntos)' : 'del módulo ' + modulo;
  const prompt =
    'Sos "Sifoncito", el asistente de Gestión Anafer, una empresa argentina que produce y reparte agua y soda ' +
    '(bidones, sifones, dispensers) con flota propia, sucursales, área de calidad, comercial y RR.HH. ' +
    'Te paso los indicadores ' + alcance + ', calculados a partir de TODA la historia cargada en el sistema ' +
    '(series mensuales, comparaciones contra el promedio, el año anterior y el presupuesto, rankings y alertas). ' +
    'Escribí tu opinión de lo que está pasando, en español rioplatense, claro y directo, para la gerencia. ' +
    'Formato: un título corto con el estado general; después "Lo bueno", "Lo que preocupa" y "Qué haría", ' +
    'cada uno con 2 a 4 viñetas cortas que citen los números. Si un dato es raro o incompleto (por ejemplo el mes en curso, ' +
    'que todavía no terminó), decilo. Relacioná módulos cuando tenga sentido (por ejemplo reclamos de calidad con un proveedor ' +
    'de envase, o gastos de mantenimiento con viajes de la flota). No inventes datos que no estén. Máximo 300 palabras. ' +
    'Indicadores (JSON):\n' + datos;

  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' };
  const workspace = Deno.env.get('ANTHROPIC_WORKSPACE_ID');
  if (workspace) headers['anthropic-workspace-id'] = workspace;

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers,
      body: JSON.stringify({ model, max_tokens: 1200, messages: [{ role: 'user', content: prompt }] }),
    });
  } catch (e) {
    console.error('sifoncito-opina: no se pudo contactar a Anthropic', e);
    return json({ error: 'No se pudo contactar al servicio de IA.' }, 502);
  }
  if (!resp.ok) {
    console.error('sifoncito-opina: Anthropic respondió', resp.status, await resp.text());
    if (resp.status === 429) return json({ error: 'Demasiados pedidos por ahora, probá en un rato.' }, 429);
    if (resp.status === 401 || resp.status === 403) return json({ error: 'La clave de Anthropic del servidor no es válida.' }, 502);
    return json({ error: 'El servicio de IA no pudo responder.' }, 502);
  }
  const out = await resp.json();
  const texto: string = (out?.content || []).filter((c: { type: string }) => c.type === 'text').map((c: { text: string }) => c.text).join('\n').trim();
  if (!texto) return json({ error: 'La IA no devolvió texto.' }, 502);
  return json({ texto, modelo: model });
});
