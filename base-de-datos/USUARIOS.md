# Usuarios y permisos (⚙ → Acceso)

## Cómo funciona
- Cada persona entra con **email y contraseña** y ve lo que le permite su **perfil** (Compras, Jefe de sector, RR.HH.…).
- Si a alguien le hace falta algo distinto, se le agrega una **excepción** solo a esa persona (ej.: perfil Compras, pero además ve Tesorería). La excepción manda sobre el perfil: puede dar más o menos.
- Un perfil que **administra accesos** ve y edita todo y puede dar de alta usuarios.

## Puesta en marcha (una sola vez)
1. Supabase → SQL Editor (base Envios): correr `permisos-por-usuario.sql`.
2. Supabase → Edge Functions → **Deploy a new function** → nombre `usuarios-admin` → pegar el contenido de `supabase-functions/usuarios-admin.ts` → Deploy. Dejar **Verify JWT** activado.
   No hay que cargar ningún secreto: usa la clave de servicio que Supabase le da sola a la función.
3. Subir los archivos de Gestión.

## Dar de alta a alguien
⚙ → Acceso → Usuarios y permisos → **+ Nuevo usuario**: email, nombre, perfil y contraseña inicial (o **Generar**). Si hace falta, tocar los niveles distintos para esa persona. Guardar: la cuenta queda creada y confirmada; ya puede entrar.

- Si la función todavía no está publicada, se anota el usuario y la cuenta se crea a mano en Supabase → Authentication → Users → Add user ("Auto Confirm User" tildado).
- Las cuentas que existen en Supabase pero no están anotadas aparecen arriba en amarillo con **→ anotar**.
- **🔒 Cambiar contraseña** (dentro del usuario) le pone una contraseña nueva.
- Para que alguien deje de entrar: destildar **Activo**.
