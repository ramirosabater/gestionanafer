-- =====================================================================
-- Calidad: reclamos y acciones de mejora cargados por empleados
-- (desde el fichaje, con legajo + PIN)
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios), después de
-- calidad.sql y calidad-cambios.sql. Se puede correr de nuevo sin problema.
--
-- * Permisos por empleado (Gestión → ⚙ → Calidad → Personal de Calidad):
--     empleados.calidad_reclamos  → ve "Cargar un reclamo" (1ª parte: recepción)
--     empleados.calidad_acciones  → puede ser responsable de acciones de mejora
--                                   y completa los puntos 2, 3 y 4
--     empleados.calidad_origen    → origen fijo de sus reclamos (Sucursal, Planta…)
-- * El empleado entra al fichaje (o al link "Reclamos y acciones de mejora" del
--   ingreso de Gestión) con su legajo y PIN. No ve los reclamos ya cargados:
--   los sigue Calidad desde Gestión.
-- * La fecha del reclamo es siempre la del día en que se carga (hora argentina).
-- * calidad_pac.responsable_legajo: quién completa los puntos 2, 3 y 4.
-- =====================================================================
alter table public.empleados add column if not exists calidad_reclamos boolean not null default false;
alter table public.empleados add column if not exists calidad_acciones boolean not null default false;
alter table public.empleados add column if not exists calidad_origen  text not null default '';

alter table public.calidad_reclamos add column if not exists cargado_legajo integer;
alter table public.calidad_pac add column if not exists responsable_legajo integer;
alter table public.calidad_pac add column if not exists resp_completo_en timestamptz;
alter table public.calidad_pac add column if not exists resp_completo_por text not null default '';
create index if not exists calidad_pac_responsable_idx on public.calidad_pac(responsable_legajo);

-- Hoy en Argentina
create or replace function public.calidad_hoy() returns date
language sql stable as $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;

-- Próximo número de reclamo del año (el que se va a asignar)
create or replace function public.calidad_proximo_reclamo(p_anio integer) returns integer
language sql stable security definer set search_path to 'public' as $$
  select coalesce(max(numero), 0) + 1 from calidad_reclamos where anio = p_anio
$$;

-- Lista de calidad_listas (o vacía si nunca se editó: el fichaje usa las de siempre)
create or replace function public.calidad_lista(p_id text) returns jsonb
language sql stable security definer set search_path to 'public' as $$
  select coalesce((select valores from calidad_listas where id = p_id), '[]'::jsonb)
$$;

-- ¿Qué puede hacer este empleado en Calidad?
create or replace function public.calidad_mis_permisos(p_legajo integer, p_pin text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; anio integer := extract(year from public.calidad_hoy());
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  return json_build_object('ok', true,
    'reclamos', coalesce(emp.calidad_reclamos, false),
    'acciones', coalesce(emp.calidad_acciones, false),
    'origen', coalesce(emp.calidad_origen, ''),
    'hoy', public.calidad_hoy(), 'anio', anio,
    'proximo_numero', public.calidad_proximo_reclamo(anio),
    'acciones_pendientes', (select count(*) from calidad_pac where responsable_legajo = p_legajo and anulado_en is null and estado <> 'Cerrada' and resp_completo_en is null),
    'listas', json_build_object(
      'productos', public.calidad_lista('productos'), 'desvios', public.calidad_lista('desvios'),
      'reclamos_cliente', public.calidad_lista('reclamos_cliente'), 'origenes_reclamo', public.calidad_lista('origenes_reclamo'),
      'riesgos', public.calidad_lista('riesgos'), 'opciones_riesgo', public.calidad_lista('opciones_riesgo')));
end; $$;

-- Carga de la 1ª parte del reclamo (recepción). Devuelve el número asignado.
create or replace function public.calidad_cargar_reclamo(p_legajo integer, p_pin text, p_datos jsonb)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; hoy date := public.calidad_hoy(); anio integer; nro integer; nuevo text; prod text;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  if not coalesce(emp.calidad_reclamos, false) then return json_build_object('ok', false, 'motivo', 'sin_permiso'); end if;
  prod := trim(coalesce(p_datos->>'producto', ''));
  if prod = '' then return json_build_object('ok', false, 'motivo', 'falta_producto'); end if;
  anio := extract(year from hoy);
  -- numeración correlativa del año sin repetir aunque carguen dos a la vez
  perform pg_advisory_xact_lock(hashtext('calidad_reclamos'), anio);
  nro := public.calidad_proximo_reclamo(anio);
  nuevo := 'rec_' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || '_' || substr(md5(random()::text), 1, 4);
  insert into calidad_reclamos (id, numero, anio, fecha, hora, producto, lote, vencimiento, vencimiento_ilegible, cantidad,
    desvio, reclamo_cliente, cliente, comentarios, origen, estado, creado_por, cargado_legajo, actualizado)
  values (nuevo, nro, anio, hoy, left(coalesce(p_datos->>'hora', ''), 5), prod, left(trim(coalesce(p_datos->>'lote', '')), 30),
    nullif(p_datos->>'vencimiento', '')::date, coalesce((p_datos->>'vencimiento_ilegible')::boolean, false),
    greatest(1, coalesce(nullif(p_datos->>'cantidad', '')::numeric, 1)),
    coalesce(p_datos->>'desvio', ''), coalesce(p_datos->>'reclamo_cliente', ''), left(trim(coalesce(p_datos->>'cliente', '')), 80),
    coalesce(p_datos->>'comentarios', ''),
    case when coalesce(emp.calidad_origen, '') <> '' then emp.calidad_origen else coalesce(p_datos->>'origen', '') end,
    'Abierto', 'Legajo ' || emp.legajo || ' · ' || coalesce(emp.apellido, '') || ', ' || coalesce(emp.nombre, '') || ' (fichaje)', emp.legajo, now());
  return json_build_object('ok', true, 'numero', nro, 'anio', anio, 'fecha', hoy);
end; $$;

-- Acciones de mejora de las que el empleado es responsable (abiertas)
create or replace function public.calidad_mis_acciones(p_legajo integer, p_pin text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; res json;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  if not coalesce(emp.calidad_acciones, false) then return json_build_object('ok', false, 'motivo', 'sin_permiso'); end if;
  select coalesce(json_agg(row_to_json(x) order by x.anio desc, x.numero desc), '[]'::json) into res from (
    select id, numero, anio, fecha, origen, clasificacion, proceso, hallazgo, riesgo, opcion_riesgo, causa,
           correccion, resp_correccion, fecha_correccion, accion, resp_accion, fecha_accion, estado, resp_completo_en
    from calidad_pac where responsable_legajo = p_legajo and anulado_en is null and estado <> 'Cerrada') x;
  return json_build_object('ok', true, 'acciones', res,
    'listas', json_build_object('riesgos', public.calidad_lista('riesgos'), 'opciones_riesgo', public.calidad_lista('opciones_riesgo')));
end; $$;

-- El responsable completa los puntos 2 (riesgo y causa), 3 (corrección) y 4 (acción)
create or replace function public.calidad_guardar_accion(p_legajo integer, p_pin text, p_id text, p_datos jsonb)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; pac calidad_pac;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  if not coalesce(emp.calidad_acciones, false) then return json_build_object('ok', false, 'motivo', 'sin_permiso'); end if;
  select * into pac from calidad_pac where id = p_id;
  if not found or pac.responsable_legajo is distinct from p_legajo then return json_build_object('ok', false, 'motivo', 'no_es_responsable'); end if;
  if pac.anulado_en is not null or pac.estado = 'Cerrada' then return json_build_object('ok', false, 'motivo', 'cerrada'); end if;
  update calidad_pac set
    riesgo = coalesce(p_datos->>'riesgo', riesgo), opcion_riesgo = coalesce(p_datos->>'opcion_riesgo', opcion_riesgo),
    causa = coalesce(p_datos->>'causa', causa), correccion = coalesce(p_datos->>'correccion', correccion),
    fecha_correccion = case when p_datos ? 'fecha_correccion' then nullif(p_datos->>'fecha_correccion', '')::date else fecha_correccion end,
    accion = coalesce(p_datos->>'accion', accion),
    fecha_accion = case when p_datos ? 'fecha_accion' then nullif(p_datos->>'fecha_accion', '')::date else fecha_accion end,
    estado = case when estado = 'Abierta' then 'En gestión' else estado end,
    resp_completo_en = now(),
    resp_completo_por = 'Legajo ' || emp.legajo || ' · ' || coalesce(emp.apellido, '') || ', ' || coalesce(emp.nombre, ''),
    actualizado = now()
  where id = p_id;
  return json_build_object('ok', true);
end; $$;

revoke all on function public.calidad_mis_permisos(integer, text) from public;
revoke all on function public.calidad_cargar_reclamo(integer, text, jsonb) from public;
revoke all on function public.calidad_mis_acciones(integer, text) from public;
revoke all on function public.calidad_guardar_accion(integer, text, text, jsonb) from public;
grant execute on function public.calidad_mis_permisos(integer, text) to anon, authenticated;
grant execute on function public.calidad_cargar_reclamo(integer, text, jsonb) to anon, authenticated;
grant execute on function public.calidad_mis_acciones(integer, text) to anon, authenticated;
grant execute on function public.calidad_guardar_accion(integer, text, text, jsonb) to anon, authenticated;

-- Gestión (Calidad): lista de empleados con sus permisos de Calidad
create or replace function public.calidad_personal()
returns json language plpgsql stable security definer set search_path to 'public' as $$
begin
  if not public.puede_ver(array['reclamos', 'ncpac']) then return json_build_object('ok', false, 'motivo', 'sin_permiso'); end if;
  return json_build_object('ok', true, 'empleados', (select coalesce(json_agg(row_to_json(x) order by x.apellido, x.nombre), '[]'::json) from (
    select legajo, apellido, nombre, sector, coalesce(calidad_reclamos, false) as calidad_reclamos,
           coalesce(calidad_acciones, false) as calidad_acciones, coalesce(calidad_origen, '') as calidad_origen
    from empleados where activo is not false) x));
end; $$;

create or replace function public.calidad_set_personal(p_legajo integer, p_reclamos boolean, p_acciones boolean, p_origen text)
returns json language plpgsql security definer set search_path to 'public' as $$
begin
  if not public.puede_editar(array['reclamos', 'ncpac']) then return json_build_object('ok', false, 'motivo', 'sin_permiso'); end if;
  update empleados set calidad_reclamos = coalesce(p_reclamos, false), calidad_acciones = coalesce(p_acciones, false),
    calidad_origen = coalesce(p_origen, '') where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  return json_build_object('ok', true);
end; $$;
revoke all on function public.calidad_personal() from public, anon;
revoke all on function public.calidad_set_personal(integer, boolean, boolean, text) from public, anon;
grant execute on function public.calidad_personal() to authenticated;
grant execute on function public.calidad_set_personal(integer, boolean, boolean, text) to authenticated;

-- Control
select count(*) filter (where calidad_reclamos) as cargan_reclamos,
       count(*) filter (where calidad_acciones) as responsables_acciones
from public.empleados;
