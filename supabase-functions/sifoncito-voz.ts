// =====================================================================
// sifoncito-voz — Supabase Edge Function
// Convierte en audio lo que dice Sifoncito, con una voz de mujer simpática
// en español de Argentina (tonada del interior, no porteña). El navegador
// la reproduce; si esta función no está o falla, Sifoncito usa la voz del
// navegador como antes.
//
// Proveedor (las claves viven SOLO acá, como secretos):
//   OPENAI_API_KEY           → OpenAI gpt-4o-mini-tts (por defecto). El acento
//                              se le pide con instrucciones (SIFONCITO_VOZ_ESTILO).
//   ELEVENLABS_API_KEY +     → si están los dos, usa ElevenLabs con esa voz
//   ELEVENLABS_VOICE_ID        (por ejemplo una voz argentina de su biblioteca).
// Opcionales:
//   SIFONCITO_VOZ            voz de OpenAI (por defecto "marin"; otras femeninas: "coral", "shimmer", "nova")
//   SIFONCITO_VOZ_ESTILO     reemplaza las instrucciones de acento y tono
//
// Solo responde a usuarios con sesión iniciada (no a la clave pública sola).
// Devuelve { audio: <mp3 en base64>, tipo: "audio/mpeg" }.
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_TEXTO = 700; // Sifoncito habla de a una frase o un paso

const ESTILO = [
  'Sos Sifoncito, la asistente del sistema de una empresa argentina de agua y soda.',
  'Voz de mujer joven, simpática, cálida y alegre, con una sonrisa en la voz; cercana pero profesional.',
  'Acento: español de Argentina del interior, con una tonada cordobesa suave',
  '(estirando apenas la sílaba antes de la acentuada). NO porteño: nada de entonación de Buenos Aires.',
  'Usá el voseo con naturalidad ("vos tenés", "fijate"). La "ll" y la "y" suaves, sin "sh" marcada.',
  'Ritmo tranquilo y claro, como explicándole algo a un compañero de trabajo. Los números leelos completos y claros.',
].join(' ');

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
function base64(buf: ArrayBuffer): string {
  const b = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s);
}

async function conOpenAI(texto: string): Promise<Response> {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) return json({ error: 'La voz no está configurada en el servidor (falta OPENAI_API_KEY).' }, 501);
  return fetch('https://api.openai.com/v1/audio/speech', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-4o-mini-tts',
      voice: Deno.env.get('SIFONCITO_VOZ') || 'marin',
      input: texto,
      instructions: Deno.env.get('SIFONCITO_VOZ_ESTILO') || ESTILO,
      response_format: 'mp3',
    }),
  });
}
async function conElevenLabs(texto: string, key: string, voz: string): Promise<Response> {
  return fetch('https://api.elevenlabs.io/v1/text-to-speech/' + encodeURIComponent(voz) + '?output_format=mp3_44100_64', {
    method: 'POST',
    headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
    body: JSON.stringify({ text: texto, model_id: 'eleven_multilingual_v2', voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.35 } }),
  });
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', publicKey(req),
    { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: u, error: errU } = await supabase.auth.getUser();
  if (errU || !u?.user) return json({ error: 'Tenés que iniciar sesión.' }, 401);

  let body: { texto?: unknown } | null = null;
  try { body = await req.json(); } catch (_) { body = null; }
  const texto = typeof body?.texto === 'string' ? body.texto.replace(/\s+/g, ' ').trim() : '';
  if (!texto) return json({ error: 'Falta el texto.' }, 400);
  if (texto.length > MAX_TEXTO) return json({ error: 'Texto demasiado largo.' }, 413);

  const elKey = Deno.env.get('ELEVENLABS_API_KEY'), elVoz = Deno.env.get('ELEVENLABS_VOICE_ID');
  let resp: Response;
  try {
    resp = elKey && elVoz ? await conElevenLabs(texto, elKey, elVoz) : await conOpenAI(texto);
  } catch (e) {
    console.error('sifoncito-voz: no se pudo contactar al servicio de voz', e);
    return json({ error: 'No se pudo contactar al servicio de voz.' }, 502);
  }
  if (resp.headers.get('Content-Type')?.includes('application/json') && resp.status === 501) return resp; // falta configurar
  if (!resp.ok) {
    console.error('sifoncito-voz: el servicio respondió', resp.status, await resp.text());
    if (resp.status === 429) return json({ error: 'Demasiados pedidos por ahora.' }, 429);
    return json({ error: 'El servicio de voz no pudo responder.' }, 502);
  }
  return json({ audio: base64(await resp.arrayBuffer()), tipo: 'audio/mpeg' });
});
