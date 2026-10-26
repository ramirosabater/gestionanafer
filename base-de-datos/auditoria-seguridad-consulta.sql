-- =====================================================================
-- Auditoría de seguridad: CONSULTA DE SOLO LECTURA (no cambia nada)
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios) y pasar el resultado.
-- Sirve para confirmar en producción lo que la revisión del código encontró:
-- qué tablas puede leer o escribir alguien sin usuario (clave pública "anon")
-- o cualquier usuario logueado, qué funciones se pueden llamar sin usuario y
-- si hay buckets públicos.
-- =====================================================================
with t as (
  select c.oid, c.relname as tabla, c.relrowsecurity as rls,
         has_table_privilege('anon', c.oid, 'SELECT') as anon_lee,
         has_table_privilege('anon', c.oid, 'INSERT') or has_table_privilege('anon', c.oid, 'UPDATE') or has_table_privilege('anon', c.oid, 'DELETE') as anon_escribe,
         has_table_privilege('authenticated', c.oid, 'UPDATE') as auth_escribe
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v', 'm')
), p as (
  select tablename, string_agg(policyname || ' [' || cmd || ' → ' || array_to_string(roles, ',') || ' | ' || coalesce(qual, '-') || ']', ' ; ') as politicas,
         bool_or((roles && array['public', 'anon']::name[]) and coalesce(qual, 'true') = 'true') as abierta_a_anon,
         bool_or((roles && array['public', 'authenticated']::name[]) and coalesce(qual, 'true') = 'true') as abierta_a_logueados
  from pg_policies where schemaname = 'public' group by tablename
)
select '1-tabla' as tipo, t.tabla as objeto,
       case when not t.rls and t.anon_lee then 'SIN RLS y anon puede leer'
            when coalesce(p.abierta_a_anon, false) and t.anon_lee then 'ANON PUEDE LEER' || case when t.anon_escribe then ' Y ESCRIBIR' else '' end
            when coalesce(p.abierta_a_logueados, false) and t.auth_escribe then 'cualquier usuario logueado puede escribir'
            else 'ok' end as riesgo,
       coalesce(p.politicas, '(sin políticas)') as detalle
from t left join p on p.tablename = t.tabla
union all
-- Funciones que se pueden llamar sin usuario (clave pública)
select '2-funcion-anon', p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')',
       case when p.prosecdef then 'security definer' else 'invoker' end,
       coalesce(array_to_string(p.proconfig, ','), 'SIN search_path fijo')
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'EXECUTE')
  and p.prokind = 'f' and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
union all
-- Buckets de Storage
select '3-bucket', b.name, case when b.public then 'PÚBLICO' else 'privado' end,
       'límite de tamaño: ' || coalesce(b.file_size_limit::text, 'sin límite') || ' · tipos: ' || coalesce(array_to_string(b.allowed_mime_types, ','), 'todos')
from storage.buckets b
union all
-- Políticas de Storage
select '4-storage-politica', policyname, cmd || ' → ' || array_to_string(roles, ','), coalesce(qual, '') || ' ' || coalesce(with_check, '')
from pg_policies where schemaname = 'storage'
union all
-- Usuarios de Gestión y si tienen MFA (factor TOTP verificado)
select '5-usuario', u.email, coalesce(u.perfil, '(sin perfil)') || case when u.activo then '' else ' · INACTIVO' end,
       case when exists (select 1 from auth.users au join auth.mfa_factors f on f.user_id = au.id and f.status = 'verified' where lower(au.email) = lower(u.email))
            then 'MFA activo' else 'sin MFA' end
from usuarios u
order by 1, 3 desc, 2;
