// ============================================================
// CONFIGURACIÓN — completá estos dos valores con los de tu
// proyecto de Supabase (Project Settings -> API) y guardá.
// ============================================================
window.SUPABASE_URL = "https://sjhonbjphfacajftptgg.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNqaG9uYmpwaGZhY2FqZnRwdGdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODgzOTMyNjUsImV4cCI6MjEwMzk2OTI2NX0.KdKps-zzoT0IRJGzuAGZg_EFJ6lXCzRsqf2pm81x_ew";

// ============================================================
// LECTURA AUTOMÁTICA DE FACTURAS (opcional) — usa la API de Anthropic
// (Claude) para leer los datos de una factura desde una foto o PDF.
//
// ¡OJO! Esta clave queda visible en el código que corre en el navegador
// de quien sea que abra la página (cualquiera puede verla con "ver código
// fuente" y usarla a tu costo). Esto es una decisión ya tomada y aceptada
// para esta app — si en algún momento preferís evitarlo, hay que mover
// esta llamada a un backend propio en vez de hacerla desde aquí.
//
// Sacá la clave en https://console.anthropic.com/settings/keys. Dejala
// vacía ("") para que el botón "Leer desde archivo" quede oculto y solo
// se pueda cargar la factura a mano.
//
// Si al leer una factura te da el error "This API key is not scoped to
// a workspace... anthropic-workspace-id header", es porque tu clave es de
// las que sirven para varios workspaces a la vez (no quedó atada a uno
// solo). Dos soluciones, cualquiera de las dos anda:
//   (a) Lo más simple: en console.anthropic.com, creá una clave nueva
//       eligiendo un Workspace puntual al crearla (no "todos") y usá esa.
//   (b) O completá ANTHROPIC_WORKSPACE_ID abajo con el ID de tu workspace
//       (lo ves en console.anthropic.com -> Settings -> Workspaces; el ID
//       empieza con "wrkspc_").
// ============================================================
window.ANTHROPIC_API_KEY = ""; // RETIRADA: la clave anterior estaba expuesta en el codigo publico y hay que revocarla. Vacia = el boton "Leer desde archivo" queda oculto.
window.ANTHROPIC_MODEL = "claude-sonnet-4-5";
window.ANTHROPIC_WORKSPACE_ID = "wrkspc_01WohSvYML77dCBS1eD35PFB"; // solo si tu clave lo pide (ver arriba)

// ============================================================
// ADJUNTOS (proveedores y facturas) — se guardan en TU Google Drive, no en
// Supabase ni en Netlify, para no ocupar espacio ahí. Se crea sola una
// carpeta "Hoja de Ruta - Adjuntos" en tu Drive, con una subcarpeta por cada
// proveedor. Sin esto configurado, los botones de adjuntar/leer factura
// quedan ocultos y solo se puede cargar todo a mano.
//
// Es gratis y requiere un ID de cliente OAuth de Google (NO es secreto, a
// diferencia de la clave de Anthropic — está pensado para ir en código que
// corre en el navegador, y solo funciona desde los dominios que vos mismo
// autorices). Pasos, una sola vez:
//   1. Entrá a https://console.cloud.google.com/ y creá un proyecto (o usá
//      uno existente).
//   2. "APIs & Services" -> "Library" -> buscá "Google Drive API" -> Enable.
//   3. "APIs & Services" -> "OAuth consent screen": tipo "External", completá
//      nombre de la app y tu email. Alcanza con dejarla en modo "Testing" y
//      agregarte a vos mismo (tu email) como "Test user" — no hace falta
//      publicarla ni que Google la verifique para uso propio. La primera vez
//      que uses la app te va a avisar "app no verificada"; es normal, elegís
//      Avanzado -> Continuar (a la app).
//   4. "APIs & Services" -> "Credentials" -> "Create Credentials" -> "OAuth
//      client ID" -> tipo "Web application". En "Authorized JavaScript
//      origins" agregá la URL exacta donde publicaste esta app (por ej.
//      https://tu-sitio.netlify.app), sin barra al final.
//   5. Copiá el "Client ID" (termina en ".apps.googleusercontent.com") y
//      pegalo abajo.
// Si mudás el sitio a otro dominio, volvé al paso 4 y agregá el dominio
// nuevo a "Authorized JavaScript origins" (podés tener varios a la vez).
//
// Adjuntos que ya subiste con la versión anterior (a Supabase Storage) NO se
// migran solos — siguen donde estaban; solo lo nuevo va a Drive.
// ============================================================
window.GOOGLE_DRIVE_CLIENT_ID = "854153011058-euk95e5ks1t4llsfh7l6s604jchf479v.apps.googleusercontent.com";
window.GOOGLE_DRIVE_ROOT_FOLDER_ID = "1eIWdMIHd__Cp0hkPO6bpZr_E1Pt8KNrb";
