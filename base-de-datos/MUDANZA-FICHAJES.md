# Mudanza de la base de Fichajes a la base única (la de Gestión)

Hoy Fichajes/RR.HH. usa su propia base de Supabase (proyecto `mufkcgikyksuaoujicxl`)
y Gestión + Comercial usan otra (`sjhonbjphfacajftptgg`). El objetivo es que quede
**una sola base** (la de Gestión), así hay un único login para todo.

El sitio ya está preparado: el panel de RR.HH. y el fichaje leen la base desde
dos variables de Netlify (`VITE_SUPABASE_URL` y `VITE_SUPABASE_KEY`). Mientras no
existan, siguen usando la base vieja y **todo funciona como hoy**. El cambio de
base es cambiar esas dos variables, sin tocar código.

## Antes de empezar
- Hacelo en un horario sin fichadas (de noche o un domingo): durante la mudanza
  lo que se fiche en la base vieja no pasa a la nueva.
- No borres nada de la base vieja. Queda como respaldo hasta que todo ande.

## Paso 1 — Inventario ✓ (hecho)
Resultado: 15 tablas, 13 funciones, sin choques de nombres con Gestión (la
`es_admin()` de Fichajes no choca porque la de Gestión se llama
`gestion_es_admin()`). Hay 18 empleados, 776 fichadas, 110 registros de
auditoría y 3 usuarios administradores. El bucket `legajos` está vacío.

## Paso 2 — Exportar ✓ (hecho)
En el proyecto de **Fichajes** → SQL Editor → pegá `fichajes-exportar.sql` →
Run → **Download CSV** (o Export → CSV). Pasale ese CSV a Claude. Trae la
estructura completa y los datos (con los PIN, que ya están cifrados).

## Arreglo urgente en la base vieja (hacelo ya)
`set_pin_admin` (cambiar el PIN de un empleado) no controlaba quién la llamaba:
con la clave pública de la app se podía cambiar el PIN de cualquiera. Corré
`arreglo-urgente-base-vieja.sql` en la base de **Fichajes**. En la base nueva ya
viene corregido (solo RR.HH. en Editar puede cambiar PINs).

## Paso 3 — Correr la mudanza en Gestión
Claude te devuelve `mudanza-fichajes.sql` (**no lo subas a GitHub**: tiene los datos de los empleados) (lo arma `scripts/armar-mudanza-fichajes.py`
a partir del CSV). En el proyecto de **Gestión** → SQL Editor → pegalo → Run.
Al final muestra cuántas filas tenía cada tabla en la base vieja, para comparar.
Lo que hace:
- Crea las tablas, claves, índices y funciones de Fichajes (login con PIN, fichar,
  solicitudes, etc.) tal cual están.
- **Seguridad:** las políticas de "admin" de Fichajes dejaban hacer todo a
  cualquier usuario logueado. Acá se limitan a quien tenga "Panel RR.HH." en su
  perfil (⚙ → Acceso). `es_admin()` pasa a ser "RR.HH. en Editar". Las lecturas
  públicas que usa el fichaje de los empleados quedan igual.
- Copia los datos (no duplica si se corre dos veces) y crea el bucket `legajos`,
  privado y solo para RR.HH.
- No toca ninguna tabla de Gestión.

## Paso 4 — (no hace falta) Archivos de legajos
El bucket estaba vacío, así que no hay archivos para pasar.

## Paso 5 — Usuarios de RR.HH.
Las cuentas de email del panel de RR.HH. no se mudan solas: en Gestión →
⚙ → Acceso → Usuarios, agregá a cada persona de RR.HH. con un perfil que tenga
"Panel RR.HH." en Ver o Editar. Los empleados que fichan con legajo + PIN no
necesitan nada: sus PIN viajan con la tabla de empleados.

## Paso 6 — Cambiar de base
En Netlify → el sitio → Site configuration → Environment variables:
- `VITE_SUPABASE_URL` = `https://sjhonbjphfacajftptgg.supabase.co`
- `VITE_SUPABASE_KEY` = la clave pública (anon) de Gestión, la misma de `gestion/config.js`

Después: Deploys → Trigger deploy. Probá: fichar con un legajo de prueba, entrar
al panel de RR.HH. desde el inicio (tiene que entrar sin pedir login) y mirar el
Dashboard de RR.HH.

## Si algo sale mal
Borrá las dos variables y volvé a publicar: vuelve a usar la base vieja, que
quedó intacta.
