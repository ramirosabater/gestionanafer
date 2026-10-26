-- ⚠ SEGURIDAD: este archivo crea políticas abiertas ("anon full access"). Si lo
--   volvés a correr, corré DESPUÉS base-de-datos/seguridad-etapa1.sql para cerrarlas.
-- =====================================================================
-- RR.HH.: vacaciones (saldo por período + pedido desde el fichaje)
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede
-- correr de nuevo sin problema.
--
-- * vacaciones_saldos: los días de vacaciones de cada legajo por período
--   (ej. período 2026). Se cargan de a muchos con la subida anual
--   (RR.HH. → Asistencia → Vacaciones) o uno por uno.
-- * Los pedidos de vacaciones son solicitudes (tipo 'vacaciones') con el
--   período al que corresponden: los aprueba el responsable desde el fichaje
--   o RR.HH. desde Ausencias, como siempre.
-- * Los días se cuentan corridos (Ley de Contrato de Trabajo): del primero
--   al último día del pedido, inclusive.
-- * El empleado no puede pedir más días de los que le quedan (saldo − lo
--   aprobado − lo que está pendiente).
-- * empleados.vacaciones_por_app: si es false, el empleado no las pide por la
--   app (o no ficha) y se las carga RR.HH. desde Asistencia → Vacaciones.
-- =====================================================================
create table if not exists public.vacaciones_saldos (
  legajo        integer not null,
  periodo       integer not null,              -- año del período (ej. 2026)
  dias          numeric not null default 0,    -- días que le corresponden
  observaciones text not null default '',
  cargado_por   text,
  cargado_en    timestamptz not null default now(),
  primary key (legajo, periodo)
);
alter table public.vacaciones_saldos enable row level security;
drop policy if exists "rrhh vacaciones_saldos" on public.vacaciones_saldos;
create policy "rrhh vacaciones_saldos" on public.vacaciones_saldos for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.vacaciones_saldos to authenticated;

alter table public.solicitudes add column if not exists periodo integer;   -- solo en las de vacaciones
-- En la ficha: si el empleado pide sus vacaciones por la app (fichaje) o se las carga RR.HH.
alter table public.empleados add column if not exists vacaciones_por_app boolean not null default true;

-- Días corridos de una solicitud
create or replace function public.dias_solicitud(d1 date, d2 date) returns integer
language sql immutable as $$ select greatest(0, (coalesce(d2, d1) - d1) + 1) $$;

-- Saldo de vacaciones de un legajo (para el fichaje del empleado)
create or replace function public.mis_vacaciones(p_legajo integer, p_pin text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; res json;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  select coalesce(json_agg(row_to_json(x) order by x.periodo desc), '[]'::json) into res from (
    select v.periodo, v.dias,
      coalesce((select sum(dias_solicitud(s.fecha_desde, s.fecha_hasta)) from solicitudes s
        where s.legajo = v.legajo and s.tipo = 'vacaciones' and s.periodo = v.periodo and s.estado = 'aprobada'), 0) as tomados,
      coalesce((select sum(dias_solicitud(s.fecha_desde, s.fecha_hasta)) from solicitudes s
        where s.legajo = v.legajo and s.tipo = 'vacaciones' and s.periodo = v.periodo and s.estado = 'pendiente'), 0) as pendientes
    from vacaciones_saldos v where v.legajo = p_legajo
  ) x;
  return json_build_object('ok', true, 'saldos', res, 'por_app', coalesce(emp.vacaciones_por_app, true));
end; $$;
revoke all on function public.mis_vacaciones(integer, text) from public;
grant execute on function public.mis_vacaciones(integer, text) to anon, authenticated;

-- Pedido de vacaciones del empleado: controla que le alcancen los días
create or replace function public.pedir_vacaciones(p_legajo integer, p_pin text, p_periodo integer, p_desde date, p_hasta date, p_motivo text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; saldo numeric; usado numeric; pedido integer;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  if not coalesce(emp.vacaciones_por_app, true) then
    return json_build_object('ok', false, 'motivo', 'por_rrhh'); end if;
  if p_desde is null or coalesce(p_hasta, p_desde) < p_desde then
    return json_build_object('ok', false, 'motivo', 'fechas'); end if;
  select dias into saldo from vacaciones_saldos where legajo = p_legajo and periodo = p_periodo;
  if not found then return json_build_object('ok', false, 'motivo', 'sin_saldo'); end if;
  select coalesce(sum(dias_solicitud(fecha_desde, fecha_hasta)), 0) into usado from solicitudes
    where legajo = p_legajo and tipo = 'vacaciones' and periodo = p_periodo and estado in ('aprobada', 'pendiente');
  pedido := dias_solicitud(p_desde, p_hasta);
  if pedido > saldo - usado then
    return json_build_object('ok', false, 'motivo', 'no_alcanza', 'disponibles', saldo - usado, 'pedidos', pedido); end if;
  if exists (select 1 from solicitudes where legajo = p_legajo and tipo = 'vacaciones' and estado in ('aprobada', 'pendiente')
             and fecha_desde <= coalesce(p_hasta, p_desde) and fecha_hasta >= p_desde) then
    return json_build_object('ok', false, 'motivo', 'superpuesto'); end if;
  insert into solicitudes(legajo, tipo, fecha_desde, fecha_hasta, motivo, periodo)
  values (p_legajo, 'vacaciones', p_desde, coalesce(p_hasta, p_desde), p_motivo, p_periodo);
  return json_build_object('ok', true, 'dias', pedido, 'quedan', saldo - usado - pedido);
end; $$;
revoke all on function public.pedir_vacaciones(integer, text, integer, date, date, text) from public;
grant execute on function public.pedir_vacaciones(integer, text, integer, date, date, text) to anon, authenticated;

-- Control
select count(*) as saldos_cargados from public.vacaciones_saldos;
