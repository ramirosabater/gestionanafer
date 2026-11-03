# Archivos de Gestión Anafer en una unidad compartida de Google Drive

Todos los archivos del sistema se guardan en **una sola unidad compartida** de
Google Drive de la empresa, **"Gestión Anafer"**, con una carpeta por módulo:

```
Gestión Anafer/
├── Administración/
│   ├── Facturas/<proveedor>/          adjuntos de facturas
│   └── Proveedores/<proveedor>/       archivos de la ficha del proveedor
├── Calidad/
│   └── Reclamos 2026/Reclamo Nº 12/   fotos del control
└── RR.HH./
    └── Legajos/123 - Pérez, Juan/     documentos del legajo y certificados médicos
```

Los módulos nuevos que necesiten adjuntos suman su carpeta acá (se define en
`MODULOS` de `supabase-functions/adjuntos-drive.ts`, con las secciones de
permiso que corresponden).

## Cómo funciona
- En la unidad **solo son miembros el administrador (Ramiro Sabater) y la
  cuenta de Google del sistema** (una cuenta de la empresa, por ejemplo
  sistemas@…, o la del administrador). Nadie más navega la unidad.
- Cada usuario sube y abre los archivos **desde la app**, según los permisos de
  su perfil: Compras y Pagos ven los de Administración, Calidad los suyos,
  RR.HH. los legajos. No se generan enlaces públicos.
- Lo hace la función del servidor `adjuntos-drive`, con la autorización que esa
  cuenta de Google dio **una sola vez** (un "refresh token" guardado como
  secreto en Supabase). Los empleados (legajo y PIN, sin cuenta de Google)
  suben sus certificados desde el fichaje igual.
- Quitar un archivo lo manda a la papelera de la unidad: se recupera durante
  30 días.

## Configuración (una sola vez)
1. **Unidad compartida.** En Google Drive, crear la unidad compartida
   **"Gestión Anafer"**. Copiar el id de la unidad (lo que sigue a `/folders/`
   en la dirección). Si la cuenta del sistema no es la del administrador,
   agregarla como miembro con rol **Administrador de contenido**.
2. **Pantalla de consentimiento interna.** En https://console.cloud.google.com,
   proyecto "Gestion Anafer": APIs y servicios → **Pantalla de consentimiento
   de OAuth** (o "Google Auth Platform" → Público) → tipo de usuario
   **Interno**. Así la autorización no vence (en modo "prueba" con usuarios
   externos, Google la corta a los 7 días). Verificar que la **Google Drive
   API** esté habilitada.
3. **Cliente OAuth para el servidor.** APIs y servicios → Credenciales → Crear
   credenciales → **ID de cliente de OAuth** → tipo **Aplicación web** →
   nombre "Gestión Anafer - servidor" → en **URI de redireccionamiento
   autorizados** agregar `https://developers.google.com/oauthplayground` →
   Crear. Anotar el **ID de cliente** y el **Secreto del cliente**.
4. **Autorizar una vez con la cuenta del sistema.** Abrir
   https://developers.google.com/oauthplayground (conviene en una ventana de
   incógnito, entrando con la cuenta del sistema):
   - Engranaje ⚙ arriba a la derecha → tildar **Use your own OAuth
     credentials** → pegar el ID y el secreto del paso 3 → Close.
   - En "Step 1", en el cuadro de abajo escribir
     `https://www.googleapis.com/auth/drive` → **Authorize APIs** → elegir la
     cuenta del sistema → Permitir.
   - En "Step 2" → **Exchange authorization code for tokens**. Copiar el
     **Refresh token**.
5. **Secretos en Supabase** (Edge Functions → Secrets):
   - `GOOGLE_OAUTH_CLIENT_ID`: el ID de cliente del paso 3.
   - `GOOGLE_OAUTH_CLIENT_SECRET`: el secreto del cliente del paso 3.
   - `GOOGLE_REFRESH_TOKEN`: el refresh token del paso 4.
   - `DRIVE_UNIDAD_ID`: el id del paso 1.
   El secreto del cliente y el refresh token son secretos: van solo en
   Supabase, nunca en `config.js`, el repositorio, el zip ni un chat.
6. **Publicar la función:** Edge Functions → Deploy a new function → Via
   Editor → nombre `adjuntos-drive` → pegar el contenido de
   `adjuntos-drive.ts` → Deploy.
7. **Base:** correr `legajos-en-drive.sql`.
8. **Subir el zip.**

### Si un día deja de andar ("la autorización … se venció o se revocó")
Pasa si se borra o suspende la cuenta del sistema, si alguien le quita el
acceso a la app en https://myaccount.google.com/permissions, o si la
pantalla de consentimiento vuelve a modo prueba. Se repite el paso 4 y se
reemplaza `GOOGLE_REFRESH_TOKEN` en Supabase. Si la cuenta del sistema deja la
unidad, también hay que volver a sumarla.

## Pasar los archivos que ya existen
- **Legajos** (estaban en el almacenamiento de Supabase): panel de RR.HH. →
  Personal → Vencimientos → **Pasar a Google Drive**.
- **Facturas, proveedores y fotos de Calidad** (estaban en el Drive de quien los
  subió): Gestión → ⚙ → Acceso → **Pasar los adjuntos viejos a la unidad
  compartida**. Lo tiene que hacer alguien que pueda abrir esos archivos (Google
  pide permiso una vez) y necesita que `config.js` todavía tenga
  `GOOGLE_DRIVE_CLIENT_ID`. Cuando termine, ese dato ya no hace falta.
- Los originales no se borran: quedan como resguardo hasta verificar que está
  todo en la unidad.
