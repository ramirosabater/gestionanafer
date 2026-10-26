-- ⚠ SEGURIDAD: este archivo crea políticas abiertas ("anon full access"). Si lo
--   volvés a correr, corré DESPUÉS base-de-datos/seguridad-etapa1.sql para cerrarlas.
-- =====================================================================
-- Módulo DASHBOARDS (octubre 2026)
-- =====================================================================
-- puede_ver(secciones): true si quien llama tiene "ver" o "editar" en alguna
--   de esas secciones (o es administrador). La usa la función del servidor
--   "sifoncito-opina" para dejar pedir el análisis con IA.
-- tableros_opiniones: los análisis que escribió Sifoncito con IA (quedan
--   guardados para no tener que pedirlos de nuevo y para ver la historia).
-- Se puede correr todas las veces que haga falta.
-- =====================================================================
create or replace function puede_ver(secciones text[])
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
        or exists (select 1 from unnest(secciones) s where r -> 'permisos' ->> s in ('ver', 'editar'))
      )
  );
$$;
revoke all on function puede_ver(text[]) from public, anon;
grant execute on function puede_ver(text[]) to authenticated;

create table if not exists tableros_opiniones (
  id text primary key,
  creado timestamptz not null default now(),
  usuario text not null default '',
  modulo text not null default 'resumen',   -- resumen | logistica | administracion | calidad | comercial | rrhh
  texto text not null default '',
  datos jsonb not null default '{}'::jsonb  -- los indicadores que se le pasaron (para saber en qué se basó)
);
create index if not exists tableros_opiniones_creado_idx on tableros_opiniones(creado desc);
alter table tableros_opiniones enable row level security;
drop policy if exists "anon full access tableros_opiniones" on tableros_opiniones;
create policy "anon full access tableros_opiniones" on tableros_opiniones for all using (true) with check (true);
grant select, insert, update, delete on tableros_opiniones to authenticated;
