# ANAFER — sistema de gestión (un solo sitio)

Todo junto en un repositorio y un sitio de Netlify:

| Dirección | Qué es |
|---|---|
| `/` | **Gestión Anafer**: ingreso con email e inicio con las áreas Logística, Administración, Comercial y Recursos Humanos |
| `/comercial-dashboard.html` (o `/comercial`) | Tablero Comercial |
| `/fichaje/` (o `/fichar`) | **Fichaje de empleados** (legajo + PIN, se instala en el celular) |
| `/fichaje/admin.html` (o `/rrhh`) | **Panel de RR.HH.** |

## Carpetas
- `gestion/` — Gestión Anafer y Comercial (HTML + JS, sin compilar). Acá va tu
  **`config.js`** (no viene en este zip: copiá el que ya tenés).
- `rrhh/` — Fichaje y panel de RR.HH. (React + Vite; Netlify lo compila solo).
- `base-de-datos/` — SQL para Supabase: `schema.sql`, `importar-proveedores.sql`,
  `primer-admin.sql`, y la mudanza de Fichajes (`MUDANZA-FICHAJES.md` +
  `fichajes-inventario.sql`). **No se publican** en el sitio.
- `supabase-functions/` — función `leer-factura` (Edge Function de Supabase).
- `scripts/armar-sitio.mjs` + `netlify.toml` + `package.json` — arman el sitio.

## Publicar (una vez)
1. Subí esta carpeta a un repositorio de GitHub (puede ser el de Gestión,
   reemplazando su contenido) y copiá tu `config.js` adentro de `gestion/`.
2. En Netlify, el sitio de Gestión (`anafergestion.netlify.app`) → Site
   configuration → Build & deploy → conectalo a ese repositorio. No hace falta
   completar nada más: `netlify.toml` ya dice cómo compilar (`npm run build`) y
   qué publicar (`dist`).
3. Cuando termine el deploy, probá `/`, `/fichaje/` y `/fichaje/admin.html`.
4. Sitios viejos: en `fichadas.netlify.app` y en el sitio de la portada
   (`anafer-main`) dejá solo un archivo `_redirects` con:
   - fichadas: `/* https://anafergestion.netlify.app/fichaje/:splat 301!`
   - portada: `/* https://anafergestion.netlify.app/ 301!`

   Así los accesos directos viejos siguen funcionando. Los empleados que
   tenían el fichaje instalado en el celular conviene que lo vuelvan a
   instalar desde la dirección nueva.

## Base de datos
Gestión y Comercial usan una base de Supabase y Fichajes otra. Para unificarlas
ver `base-de-datos/MUDANZA-FICHAJES.md`. Hasta que se haga la mudanza, el panel de
RR.HH. sigue pidiendo su propio login.

El detalle de cada parte está en `gestion/readme.md` (Gestión y Comercial).
