-- =====================================================================
-- Permisos por usuario: perfil + excepciones
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios). Se puede correr más de
-- una vez. También está al final de schema.sql.
--
-- Cada persona tiene un PERFIL (Compras, Jefe de sector, RR.HH.…) y, si le
-- hace falta algo distinto, EXCEPCIONES solo para ella:
--   usuarios.permisos_extra = {"tesoreria": "ver", "pagos": "oculta"}
-- La excepción manda sobre lo que dice el perfil (puede dar más o menos).
-- Un perfil administrador (administra accesos) ve y edita todo.
--
-- gestion_nivel(seccion) devuelve 'oculta' | 'ver' | 'editar' para quien
-- llama (por el email de su sesión). puede_ver, puede_editar y el permiso de
-- RR.HH. pasan a usarla, así la base aplica las excepciones igual que la app.
-- =====================================================================

alter table usuarios add column if not exists permisos_extra jsonb not null default '{}'::jsonb;
alter table usuarios add column if not exists nombre text;

create or replace function public.gestion_nivel(seccion text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
      when coalesce((r ->> 'manageAccess')::boolean, false) then 'editar'
      else coalesce(
        nullif(u.permisos_extra ->> seccion, ''),
        r -> 'permisos' ->> seccion,
        -- Solicitudes de compra: si no está configurado, igual que Compras
        case when seccion = 'solicitudes' then coalesce(nullif(u.permisos_extra ->> 'compras', ''), r -> 'permisos' ->> 'compras') end,
        -- Sin perfil = "Solo Comercial"
        case when u.perfil is null and seccion = 'comercial' then 'editar' end,
        'oculta')
      end
    from usuarios u
    left join app_config c on c.id = 'auth'
    left join lateral (
      select x from jsonb_array_elements(coalesce(c.roles, '[]'::jsonb)) x where x ->> 'id' = u.perfil limit 1
    ) rr(r) on true
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.activo is not false
      and (u.perfil is null or r is not null)
    limit 1), 'oculta');
$$;
revoke all on function public.gestion_nivel(text) from public, anon;
grant execute on function public.gestion_nivel(text) to authenticated;

create or replace function public.puede_ver(secciones text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from unnest(secciones) s where public.gestion_nivel(s) in ('ver', 'editar'));
$$;
revoke all on function public.puede_ver(text[]) from public, anon;
grant execute on function public.puede_ver(text[]) to authenticated;

create or replace function public.puede_editar(secciones text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from unnest(secciones) s where public.gestion_nivel(s) = 'editar');
$$;
revoke all on function public.puede_editar(text[]) from public, anon;
grant execute on function public.puede_editar(text[]) to authenticated;

-- RR.HH. (panel y funciones de Fichajes)
create or replace function public.gestion_permiso_rrhh() returns text
language sql security definer stable set search_path = public as $$
  select public.gestion_nivel('rrhh');
$$;
create or replace function public.gestion_puede_rrhh() returns boolean
language sql security definer stable set search_path = public as $$
  select public.gestion_nivel('rrhh') in ('ver', 'editar');
$$;
revoke all on function public.gestion_permiso_rrhh() from public, anon;
revoke all on function public.gestion_puede_rrhh() from public, anon;
grant execute on function public.gestion_permiso_rrhh() to authenticated;
grant execute on function public.gestion_puede_rrhh() to authenticated;

-- Control: usuarios con excepciones
select email, perfil, permisos_extra from usuarios where permisos_extra <> '{}'::jsonb order by email;
