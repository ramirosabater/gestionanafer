-- =====================================================================
-- Auditoría de seguridad: 2ª CONSULTA DE SOLO LECTURA (no cambia nada)
-- =====================================================================
-- Producción tiene, además de las políticas "anon full access", otras por
-- área (facturas_leer, trips_actualizar…) y un segundo sistema de permisos
-- (tabla perfiles, gestiona_acceso()). Esto muestra cómo están definidas, para
-- armar la corrección sin romper nada. No muestra datos de personas.
-- =====================================================================

-- A) Qué controlan las políticas de INSERT (la 1ª consulta no mostraba el "with check")
select 'A-insert' as tipo, tablename as objeto, policyname as nombre,
       array_to_string(roles, ',') || ' | with check: ' || coalesce(with_check, '(ninguno)') as detalle
from pg_policies
where schemaname = 'public' and cmd in ('INSERT', 'ALL') and policyname not like 'anon full access%'
union all
-- B) Definición de las funciones de permisos que usan las políticas
select 'B-funcion', p.proname, pg_get_function_identity_arguments(p.oid), pg_get_functiondef(p.oid)
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('puede_ver', 'puede_editar', 'gestiona_acceso', 'mi_perfil_id', 'mi_email', 'es_admin',
                    'gestion_permiso_rrhh', 'gestion_puede_rrhh', 'gestion_es_admin', 'top_clientes')
union all
-- C) Tabla perfiles: columnas (sin datos) y cantidad de filas
select 'C-perfiles', 'columnas', string_agg(column_name || ' ' || data_type, ', ' order by ordinal_position), (select count(*)::text from public.perfiles)
from information_schema.columns where table_schema = 'public' and table_name = 'perfiles'
union all
-- D) Bucket "adjuntos" (público): cuántos archivos hay por carpeta y de qué tipo (sin nombres de archivo)
select 'D-adjuntos', coalesce((storage.foldername(name))[1], '(raíz)'),
       count(*)::text || ' archivos',
       string_agg(distinct coalesce(metadata->>'mimetype', '?'), ', ') || ' · último: ' || max(created_at)::date::text
from storage.objects where bucket_id = 'adjuntos'
group by 2
union all
-- E) Vistas: si corren con los permisos de quien consulta (security_invoker) o del dueño
select 'E-vista', c.relname, coalesce(array_to_string(c.reloptions, ','), 'sin security_invoker (corre como el dueño: saltea RLS)'), ''
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'v'
order by 1, 2;
