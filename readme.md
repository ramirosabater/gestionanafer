# Gestión Anafer — versión propia (Supabase + Netlify)

Esta carpeta es una copia independiente de la herramienta de planificación de
viajes. No depende de Claude para nada: la base de datos es tuya (en
Supabase, gratis) y el sitio lo alojás donde quieras (acá van los pasos para
Netlify).

Archivos:
- `index.html` — la página.
- `app.js` — toda la lógica (grilla, edición, planificación automática).
- `config.js` — **el único archivo que tenés que editar** antes de publicar.
- `schema.sql` — crea las tablas en Supabase y las carga con tus rutas,
  camiones, choferes y ayudantes.
- `historial.sql` — carga los **4.240 viajes reales de octubre 2019 a
  septiembre 2026** que había en tu Excel (VIAJES.xlsx). Se corre una sola
  vez, después de `schema.sql`.
- `historial_sucursales_part01.sql` a `..._part13.sql` — cargan los
  **4.639 registros día por día de envíos a sucursales (2021-2026)**,
  reconstruidos directamente desde las hojas mensuales originales de tu
  Excel (SUCURSALES.xlsx). Está partido en 13 archivos porque el SQL
  Editor de Supabase rechaza una consulta única tan grande ("Query is
  too large to be run via the SQL Editor") — se corren los 13, en orden,
  después de `schema.sql`. Ver la sección "Sucursales" más abajo.

## 1. Crear la base de datos en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta (el plan
   gratis alcanza de sobra para esto).
2. Creá un proyecto nuevo (**New project**). Elegí cualquier nombre y una
   contraseña de base de datos (no la vas a necesitar de nuevo, guardala
   igual por las dudas). Esperá 1-2 minutos a que termine de crearse.
3. En el menú de la izquierda, andá a **SQL Editor** → **New query**.
4. Abrí el archivo `schema.sql` de esta carpeta, copiá todo su contenido,
   pegalo en el editor y apretá **Run**. Esto crea las tablas `routes`,
   `trucks`, `drivers`, `helpers`, `trips`, `branches`, `visits` y
   `app_config` (esta última guarda las dos contraseñas del login — ver
   "Login" más abajo), y las carga con los datos base.
5. Abrí una **New query** de nuevo, ahora con el archivo `historial.sql`
   (es un archivo grande — 4.240 viajes — puede tardar unos segundos en
   pegarse y en correr, es normal). Esto carga todo el histórico real del
   Excel para que el dashboard tenga datos desde el primer día.
6. Repetí el mismo paso con `historial_sucursales_part01.sql`, y cuando
   termine de correr abrí una **New query** de nuevo con
   `historial_sucursales_part02.sql`, y así hasta `_part13.sql` — son 13
   archivos en total, hay que correrlos todos, en orden (uno por uno, no
   se pueden pegar juntos porque el SQL Editor rechaza una consulta tan
   grande). Cargan el histórico de envíos a sucursales — ver la sección
   "Sucursales" más abajo.

   Cosas para saber sobre esta carga:
   - Los **camiones y rutas que ya no se usan** (por ejemplo camiones que
     se vendieron, o rutas que se dejaron de hacer) se cargan igual, pero
     **inactivos** — no van a aparecer en la grilla del mes ni en la lista
     desplegable al cargar un viaje nuevo, pero sí se cuentan en el
     dashboard histórico. Podés reactivar cualquiera desde ⚙ si en realidad
     sigue en uso.
   - En algunas celdas del Excel había más de un número anotado (notas a
     mano, aclaraciones, etc.). En esos casos tomé el primer número como el
     camión y guardé el texto completo original en la nota del viaje, para
     que no se pierda esa información.
   - Alrededor de un 5% de las celdas con contenido no tenían ningún
     número de camión reconocible (solo una marca, un espacio, o una nota
     sin número) — esas quedaron sin cargar, ya que no hay forma de saber
     qué camión fue.
   - Es seguro volver a correr `historial.sql` las veces que quieras: usa
     `ON CONFLICT DO NOTHING`, así que nunca duplica viajes ni pisa algo
     que ya hayas cargado o editado a mano.

## 2. Conectar la página con tu proyecto

1. En Supabase, andá a **Project Settings** (el engranaje) → **API**.
2. Copiá el valor de **Project URL**.
3. Copiá el valor de **anon public** (la clave pública, no la `service_role`).
4. Abrí `config.js` en esta carpeta con cualquier editor de texto y
   reemplazá los dos valores:

   ```js
   window.SUPABASE_URL = "https://tu-proyecto.supabase.co";
   window.SUPABASE_ANON_KEY = "eyJhbGciOi....";
   ```

5. Guardá el archivo.

## 3. Publicar en Netlify

**Opción rápida (arrastrar y soltar), sin cuenta de GitHub:**

1. Entrá a [app.netlify.com/drop](https://app.netlify.com/drop).
2. Arrastrá esta carpeta completa (`hoja-de-ruta-standalone`, con los 4
   archivos adentro) a la página.
3. En unos segundos te da un link (algo como
   `https://nombre-al-azar.netlify.app`). Ese es el link que le pasás a tu
   equipo.

**Opción con cuenta (para poder actualizarlo más adelante):**

1. Subí esta carpeta a un repositorio de GitHub.
2. En Netlify, **Add new site** → **Import an existing project** → elegí el
   repositorio. No hace falta build command ni carpeta de publicación
   especial (el sitio es estático).

## Chofer y ayudante por viaje

Como los choferes no siempre usan el mismo camión, el chofer y el
ayudante se cargan **por viaje**, no fijos por camión:

- Al hacer clic en una celda para cargar o editar un viaje, además del
  camión hay dos campos: Chofer y Ayudante.
- Una vez guardado, el nombre del chofer aparece directamente debajo del
  número de camión en la celda de la grilla (se ve sin tener que abrir
  nada). Pasando el mouse por arriba se ve el detalle completo.
- Desde el botón ⚙ podés cargar además un "chofer habitual" y "ayudante
  habitual" por camión — es solo una sugerencia que se autocompleta al
  elegir ese camión en un viaje nuevo, pero se puede cambiar en cada
  carga si ese día lo manejó otra persona.

Si ya habías corrido `schema.sql` antes de esta versión, volvé a pegar el
archivo completo en el SQL Editor de Supabase y correlo de nuevo — agrega
las tablas y columnas que falten sin borrar nada de lo que ya cargaste.

## Listas desplegables y ABM de choferes, ayudantes y rutas

Ahora el chofer y el ayudante de cada viaje se eligen de una lista
desplegable en vez de escribirlos a mano, para evitar que un mismo chofer
quede cargado con el nombre escrito de dos formas distintas.

Esas listas (y también la de rutas y camiones) se administran desde el
botón ⚙ arriba a la derecha, que ahora tiene 4 pestañas:

- **Rutas** y **Camiones**: igual que antes — activar, desactivar, renombrar
  o agregar.
- **Choferes** y **Ayudantes**: mismo esquema. El interruptor de cada fila
  no borra a la persona (para no perder el historial de viajes ya
  cargados con su nombre), sólo la saca de la lista desplegable para
  viajes nuevos — queda al final de la lista, marcada como dada de baja.
  Para agregar alguien nuevo, escribí el nombre completo abajo de la
  lista y tocá "+".

El `schema.sql` ya viene con los choferes y ayudantes que me pasaste
cargados de entrada, así que no hace falta cargarlos a mano la primera
vez — solo se usa esa pantalla para altas, bajas o correcciones futuras.

## Carga por viaje

Cada viaje puede llevar cantidades de varios productos a la vez. La carga
se completa como una planilla: una tabla con todos los productos como
filas, y al lado de cada uno un casillero para la cantidad — se llenan
solo los que corresponden a ese viaje y se deja el resto vacío, sin tener
que ir agregando de a una línea.

- Al cargar o editar un viaje, abajo del campo "Nota" hay una sección
  "Carga" con esa tabla (Producto | Cantidad) y, arriba, un campo
  "Unidad" único para todo el viaje (pallets, bolsas, cajones, etc. — se
  completa una sola vez y aplica a todos los productos cargados en ese
  viaje).
- En la grilla, las celdas con carga cargada muestran un ícono 📦 junto al
  número de camión, y pasando el mouse por arriba se ve el detalle completo.
- Los tipos de carga se administran desde ⚙ → pestaña **Cargas**, con el
  mismo esquema de alta/baja/renombrado que choferes y ayudantes. El
  `schema.sql` ya viene con los 30 artículos que me pasaste (S1500, S2000,
  X8, X20, PROMO MUNDIAL, etc.) cargados de entrada.
- El Dashboard suma la cantidad despachada por tipo de carga en el período
  elegido (panel "Cantidad despachada por tipo de carga").

Si ya habías corrido `schema.sql` antes de esta versión, volvé a pegar el
archivo completo en el SQL Editor de Supabase y correlo de nuevo — agrega
la tabla `cargo_types` y la columna `cargo` en `trips` sin tocar nada de lo
que ya tenías cargado.

## Vista "Día"

Entre "FlotaPesada" y "Dashboard" hay una pestaña **Día** para ver un día
puntual completamente abierto: una fila por ruta activa, con camión,
chofer, ayudante, carga y nota — todo junto, sin tener que pasar el mouse
por cada celda de la grilla.

- Navegá con las flechas, el botón "Hoy" o eligiendo una fecha directamente
  en el calendario de arriba a la derecha.
- Las rutas sin viaje cargado ese día aparecen atenuadas con "Sin
  asignar".
- Hacé clic en cualquier fila (tenga carga o no) para abrir el mismo
  formulario de siempre y cargar o editar ese viaje — los cambios se ven
  al instante ahí mismo.

## Sucursales

Esta es una segunda operación, separada de FlotaPesada (rutas/camiones):
los envíos mensuales a las sucursales de la empresa (KM5, Kennedy, Rada
Tilly, etc.). Tiene su propia pestaña **Sucursales**, con una grilla igual
a la de FlotaPesada pero una fila por día y una columna por sucursal:

- Hacé clic en una celda para cargar o editar el envío de ese día a esa
  sucursal: se abre una tabla de Carga (Producto | Cantidad) igual a la de
  FlotaPesada — mismo catálogo de tipos de carga, administrado desde el
  mismo ⚙ → Cargas — más un campo de Nota. No tiene camión, chofer ni
  ayudante: es un destino de entrega, no un viaje de reparto.
- La celda muestra la cantidad total despachada ese día (todos los
  productos sumados) y, pasando el mouse, el detalle producto por
  producto.
- Las sucursales se administran desde ⚙ → pestaña **Sucursales** (alta,
  baja, renombrado), igual que rutas o camiones. El `schema.sql` ya viene
  con las 14 sucursales reales cargadas (10 activas hoy, 4 dadas de baja
  hace tiempo — Palazzo, KM3, Caleta 2 y Base Caleta — que se ven en el
  histórico pero no en la grilla de meses nuevos).
- El Dashboard tiene una sección aparte **Sucursales** (debajo de la de
  FlotaPesada) con el total de envíos del período y la cantidad
  despachada por sucursal y por producto.
- También tiene su propio botón **✨ Planificar automáticamente**: analiza,
  para cada sucursal, en qué días de la semana recibe envíos realmente
  (calculado sobre datos día por día de las hojas mensuales del Excel
  original, últimos 24 meses) y sugiere una visita en esos días del mes
  visible, con la cantidad promedio de cada producto que esa sucursal recibe
  por visita. Por ejemplo, si Rivadavia históricamente recibe envíos los
  lunes, martes y miércoles, el botón sugiere una visita esos días del mes.
  No pisa visitas ya cargadas, y lo que sugiere se puede editar o borrar
  como cualquier otra.

**Histórico**: corré, en orden, `historial_sucursales_part01.sql` hasta
`historial_sucursales_part13.sql` en el SQL Editor de Supabase (después
de `schema.sql` y, si querés, de `historial.sql`) para cargar los
**4.639 registros día por día de sucursal** (2021-08 a 2026-08)
reconstruidos directamente desde las hojas mensuales originales de tu
Excel (SUCURSALES.xlsx). Está partido en 13 archivos porque el conjunto
completo es demasiado grande para pegarlo de una sola vez — el SQL
Editor de Supabase da el error "Query is too large to be run via the SQL
Editor" si lo intentás con un solo archivo enorme. Cada parte se abre
como **New query**, se pega y se corre con **Run**, y recién ahí se pasa
a la siguiente parte. Es seguro volver a correr cualquiera de las partes
las veces que quieras — usa `ON CONFLICT DO NOTHING`, así que si algo
falla a mitad de camino (se corta la conexión, etc.) simplemente volvés
a correr desde la parte que falló, sin miedo a duplicar nada.

**Importante si ya habías corrido una versión anterior de este archivo**:
la primera vez que armamos este histórico lo hicimos a partir de la hoja
"Consolidado" del Excel (un resumen ya sumado por mes), y esa hoja
resultó tener un error de desplazamiento de columnas — a partir de más o
menos la columna 22 ("X8V" en adelante), cuando una celda anterior daba
0, los valores quedaban emparejados con el producto equivocado. Esto
afectaba a la mayoría de los ~470 registros mensuales que se habían
cargado con esa primera versión. Al notarlo, se volvió a extraer todo
directamente de las 59 hojas mensuales originales (día por día, no desde
el resumen), y se verificaron los totales cruzándolos con la fila
"ACUMULADO MENSUAL" de cada hoja — coinciden de forma exacta. La
`historial_sucursales_part01.sql` borra automáticamente los registros
viejos (los que quedaron marcados como cargados por "Importado del
histórico", sin el "(corregido)") antes de insertar los nuevos, así que
alcanza con correr las 13 partes una vez — no hace falta borrar nada a
mano.

Cosas para saber sobre esta carga:

- Ahora cada registro es un **día real** con entregas a esa sucursal, no
  un total mensual — se conserva la fecha exacta de cada entrega tal
  como figuraba en la planilla original.
- El Excel cambió de formato tres veces en estos 5 años: hojas
  2021-08/2022-08 con fecha completa o sólo el día del mes (según la
  hoja); hojas 2022-09/2023-09 con los nombres de producto escritos de
  formas muy inconsistentes entre sucursales (se normalizaron con
  cuidado, descartando los códigos ambiguos que no están en el
  catálogo en vez de adivinarlos); y hojas 2023-10/2026-08 con un
  formato consistente. Los nombres de sucursal también se unificaron
  (ej. "RIVAD." / "RIVADAVIA" → Rivadavia).
- Se agregaron tres tipos de carga nuevos que no estaban en FlotaPesada:
  **SIFON DESC**, **BMB AUT.** y **MATE** — aparecen en ⚙ → Cargas junto
  a los demás.
- Cuando dos entregas caían el mismo día en la misma sucursal, se
  sumaron en un solo registro.
- Si alguna sucursal o producto del futuro cambia de nombre otra vez,
  se administra igual que todo lo demás desde ⚙ — no hace falta tocar
  el código.

## Dashboard

La pestaña **Dashboard** (al lado de "FlotaPesada", arriba) muestra un resumen
de la actividad, con un selector de período arriba a la derecha (este
mes / últimos 3 meses / últimos 6 meses / todo el historial):

- 4 indicadores arriba: total de viajes en el período, y cuál es el
  camión, chofer y ruta con más viajes.
- Viajes por camión, por ruta, por chofer y por ayudante (rankings de
  mayor a menor).
- Viajes por día de la semana, para ver qué días se concentra más la
  operación.
- Origen de la carga (manual, planificación automática, o importado del
  Excel original), útil para ver cuánto se está usando el botón de
  planificación automática.

## 4. Probarlo

Abrí el link que te dio Netlify. Deberías ver la grilla de septiembre 2026
ya cargada con los viajes reales del Excel. Probá:
- Hacer clic en una celda vacía y cargar un camión.
- Apretar "Planificar automáticamente" para ver las sugerencias basadas en
  el historial.
- Abrir el mismo link desde otro celular o computadora: los cambios se
  tienen que ver en todos lados (recargando la página, o al toque si el
  navegador soporta bien la conexión en tiempo real).

## Login (acceso completo / solo lectura)

La página pide una contraseña antes de mostrar nada. Hay dos, compartidas
entre todos los que las tengan (no es un login por persona, es solo una
puerta de entrada simple):

- **Acceso completo** (por defecto `admin`): ve y edita todo, igual que
  antes de tener login.
- **Solo lectura** (por defecto `lectura`): entra directo a la vista "Día"
  sin ver el resto de las pestañas, y no puede editar nada — solo mirar los
  viajes y envíos del día, y navegar entre días.

Las dos contraseñas se cambian desde ⚙ → **Acceso**, una vez que entraste
como admin. Cambialas apenas publiques el sitio — las que trae `schema.sql`
por defecto (`admin` / `lectura`) son solo para el primer ingreso. El botón
"Salir" (al lado de ⚙) cierra la sesión en ese navegador.

## Sobre la seguridad

El login de arriba es una comodidad de uso, no una barrera de seguridad
real: la base de datos sigue siendo de acceso abierto para quien tenga la
URL y la anon key de Supabase (mismas políticas `anon full access` de
siempre), así que alguien con conocimientos técnicos podría saltearse la
pantalla de acceso. Para una herramienta interna de uso diario entre pocas
personas de confianza esto suele ser aceptable, pero tené en cuenta:

- No compartas el link ni las contraseñas públicamente (redes sociales,
  etc.).
- Si en algún momento querés un login real por persona con permisos
  reforzados del lado del servidor, se puede agregar con Supabase Auth —
  avisame y lo sumamos.

## Si algo no funciona

- **"No se pudo conectar a Supabase"**: revisá que copiaste bien la URL y
  la anon key en `config.js`, sin espacios de más ni comillas de menos.
- **Los cambios no se ven en tiempo real entre dos personas**: en Supabase,
  andá a **Database** → **Replication** y confirmá que las tablas `trips`,
  `routes` y `trucks` estén marcadas para Realtime (el `schema.sql` ya
  intenta activarlo solo, pero a veces hay que tildarlo a mano ahí).
- Cualquier otro error: abrí la consola del navegador (F12 → pestaña
  "Console") y vas a ver el mensaje exacto de Supabase.
