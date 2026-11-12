// =====================================================================
// leer-factura — Supabase Edge Function
// Lee los datos de una factura (foto o primera página del PDF) con Claude.
//
// Por qué existe: la clave de Anthropic vive SOLO acá, como secreto del
// servidor (ANTHROPIC_API_KEY). Nunca viaja al navegador ni a config.js.
//
// Seguridad:
//   1. Solo responde a usuarios con sesión iniciada (Verify JWT activado).
//   2. Además exige permiso de edición en Compras o Pagos: usa la misma
//      función de la base (puede_editar) que aplican las políticas RLS.
//   3. No es un "proxy libre": el modelo, el prompt y el tamaño están
//      fijos acá. El navegador solo manda la imagen (el proveedor no se
//      lee: lo elige el operador a mano).
//
// Secretos (Edge Functions > Secrets):
//   ANTHROPIC_API_KEY        obligatorio
//   ANTHROPIC_MODEL          opcional (por defecto claude-sonnet-4-5)
//   ANTHROPIC_WORKSPACE_ID   opcional (solo si tu clave lo exige)
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MEDIA_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_BASE64_CHARS = 7_000_000; // ~5 MB de imagen o PDF
const MAX_PROVEEDORES = 1500;

// Clave pública del proyecto. Supabase tiene dos generaciones de claves: las nuevas
// (SUPABASE_PUBLISHABLE_KEYS) y las viejas (SUPABASE_ANON_KEY). Se prueba en ese orden y,
// como último recurso, se usa la que manda el propio navegador en el encabezado "apikey".
// Es una clave pública: la seguridad real la da el chequeo de permisos más abajo.
function publicKey(req: Request): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') ?? '{}');
    if (keys && typeof keys.default === 'string' && keys.default) return keys.default;
  } catch (_) { /* sigue */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || req.headers.get('apikey') || '';
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function extractJson(text: string | undefined): Record<string, unknown> | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch (_) { /* sigue */ }
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1]); } catch (_) { /* sigue */ } }
  const start = text.search(/[{[]/);
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (_) { /* sigue */ }
  }
  return null;
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  // 1) ¿Quién llama? Usuario logueado con permiso de edición en Compras o Pagos.
  const authHeader = req.headers.get('Authorization') ?? '';
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    publicKey(req),
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: permitido, error: errPermiso } = await supabase.rpc('puede_editar', {
    secciones: ['compras', 'pagos'],
  });
  if (errPermiso || permitido !== true) {
    return json({ error: 'No tenés permiso para leer facturas.' }, 403);
  }

  // 2) Validar lo que manda el navegador
  let body: { imagen?: unknown; mediaType?: unknown; proveedores?: unknown } | null = null;
  try { body = await req.json(); } catch (_) { body = null; }
  if (!body) return json({ error: 'Pedido inválido.' }, 400);

  const { imagen, mediaType } = body;
  if (typeof imagen !== 'string' || imagen.length === 0) return json({ error: 'Falta la imagen.' }, 400);
  if (typeof mediaType !== 'string' || !MEDIA_TYPES.includes(mediaType)) {
    return json({ error: 'Formato no soportado (usá PDF, PNG, JPG, WEBP o GIF).' }, 400);
  }
  if (imagen.length > MAX_BASE64_CHARS) {
    return json({ error: 'La imagen es demasiado grande (máximo 5 MB).' }, 413);
  }
  // (body.proveedores ya no se usa: el proveedor lo elige el operador)

  // 3) Clave y modelo: solo del servidor
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'La lectura automática no está configurada en el servidor.' }, 500);
  const model = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-5';

  const esPdf = mediaType === 'application/pdf';
  const prompt =
    (esPdf ? 'Este PDF tiene una o varias facturas de proveedor (puede haber una por página). '
           : 'Esta imagen es una foto o escaneo de una factura de proveedor. ') +
    'Leé TODAS las facturas y devolvé SOLO un objeto JSON con esta forma exacta, sin texto adicional:\n' +
    '{"facturas": [{"pagina": number o null, "numero": string o null, "fecha": "YYYY-MM-DD" o null, "monto": number o null, ' +
    '"neto": number o null, "iva": number o null, "no_gravado": number o null, "percepciones": number o null, "notas": string o null, ' +
    '"combustible": null o {"movil": string o null, "patente": string o null, "chofer": string o null, "km": number o null, "litros": number o null, "otros": string o null}}]}\n' +
    'Una entrada por factura, en el orden en que aparecen; "pagina" es la página del PDF donde está (1 = la primera). ' +
    'No hace falta leer el nombre del proveedor: lo elige el operador. ' +
    '"numero" como figura (ej. 0043-00045379). "monto" es el TOTAL de la factura, como número (sin separador de miles, con punto decimal, sin símbolo de moneda). ' +
    '"neto" = neto gravado (sin IVA); "iva" = el IVA total; "no_gravado" = conceptos no gravados / exentos / impuestos internos que no llevan IVA; "percepciones" = percepciones de IVA/IIBB/Ganancias. ' +
    'En las facturas de COMBUSTIBLE con "Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)": "neto" = "Precio sin impuestos"; "iva" = "IVA contenido"; ' +
    '"no_gravado" = la SUMA de los "Otros impuestos nacionales indirectos" (ICL / Imp. comb. líq. / imp. int. + IDC / Imp. dióx. carb / Tasas); "percepciones" = Percepciones + Impuestos municipales + Tasa vial. ' +
    'Tiene que cumplirse neto + iva + no_gravado + percepciones = monto (total). Todos como número con punto decimal. ' +
    'Si es una factura de COMBUSTIBLE (estación de servicio, YPF, diesel, nafta, Infinia), completá "combustible": ' +
    '"movil" = el número de vehículo o interno (ej. "INT 41" → "41", "Vehículo 36" → "36"); "patente" tal como está impresa; "chofer" = el nombre del chofer; ' +
    '"km" = el kilometraje u odómetro; "litros" = la suma de las cantidades de COMBUSTIBLE (diesel, Infinia, nafta, súper, GNC) SIN contar AdBlue/Azul 32/urea ni lubricantes; ' +
    '"otros" = otros productos de la misma factura que no son combustible, con su cantidad (ej. "20,90 L Azul 32"). Si no es de combustible, "combustible": null. ' +
    'Si algún dato no se puede leer con confianza, devolvé null en ese campo en vez de inventarlo.';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };
  const workspace = Deno.env.get('ANTHROPIC_WORKSPACE_ID');
  if (workspace) headers['anthropic-workspace-id'] = workspace;

  let resp: Response;
  try {
    resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: [
            esPdf
              ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imagen } }
              : { type: 'image', source: { type: 'base64', media_type: mediaType, data: imagen } },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    });
  } catch (e) {
    console.error('leer-factura: no se pudo contactar a Anthropic', e);
    return json({ error: 'No se pudo contactar al servicio de lectura.' }, 502);
  }

  if (!resp.ok) {
    // el detalle queda en los logs del servidor; al navegador solo va un mensaje general
    console.error('leer-factura: Anthropic respondió', resp.status, await resp.text());
    if (resp.status === 429) return json({ error: 'Demasiados pedidos por ahora.' }, 429);
    if (resp.status === 401 || resp.status === 403) return json({ error: 'La clave de Anthropic del servidor no es válida.' }, 502);
    return json({ error: 'El servicio de lectura no pudo procesar la factura.' }, 502);
  }

  const out = await resp.json();
  const text: string | undefined = out?.content?.[0]?.text;
  const leido = extractJson(text);
  if (!leido) return json({ error: 'No se pudo interpretar la respuesta.' }, 422);
  // "facturas": todas las del archivo; "data": la primera (la app vieja lee solo esa)
  const facturas = Array.isArray(leido.facturas) ? leido.facturas.filter((f: unknown) => f && typeof f === 'object') : [leido];
  if (!facturas.length) return json({ error: 'No se encontró ninguna factura en el archivo.' }, 422);
  return json({ data: facturas[0], facturas });
});
