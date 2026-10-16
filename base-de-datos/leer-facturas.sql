-- =====================================================================
-- Lectura automática de facturas: permiso que consulta la función del
-- servidor "leer-factura" (Supabase → Edge Functions).
-- =====================================================================
-- puede_editar(['compras','pagos']) devuelve true si quien llama (el email
-- de su sesión) es un usuario activo cuyo perfil tiene "editar" en alguna de
-- esas secciones, o es un perfil administrador (maneja accesos).
-- Corre como "security definer" para poder leer perfiles y usuarios sin
-- abrirle esas tablas a nadie más. Se puede correr todas las veces que haga falta.
-- =====================================================================
create or replace function puede_editar(secciones text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios u
    join app_config c on c.id = 'auth'
    cross join lateral jsonb_array_elements(coalesce(c.roles, '[]'::jsonb)) r
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.activo is not false
      and r ->> 'id' = u.perfil
      and (
        (r ->> 'manageAccess')::boolean is true
        or exists (select 1 from unnest(secciones) s where r -> 'permisos' ->> s = 'editar')
      )
  );
$$;
revoke all on function puede_editar(text[]) from public, anon;
grant execute on function puede_editar(text[]) to authenticated;

-- Control (en el editor SQL da false porque no hay sesión; está bien):
select puede_editar(array['compras','pagos']) as probar_desde_la_app;
