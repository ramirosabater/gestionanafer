-- =====================================================================
-- RR.HH.: fichar desde la computadora del escritorio (sin GPS)
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede
-- correr de nuevo sin problema.
--
-- * empleados.modo_fichaje: 'gps' (como siempre, con el celular y la
--   ubicación) o 'pc' (solo desde una computadora aprobada por RR.HH.).
-- * equipos_fichaje: las computadoras de cada empleado. La primera vez que
--   ficha desde una, queda "pendiente" hasta que RR.HH. la aprueba
--   (RR.HH. → Reportes y control → Dispositivos).
-- * La base de datos controla que un empleado 'pc' solo fiche desde un equipo
--   aprobado: si lo intenta desde otro aparato, la fichada se rechaza. Las
--   correcciones de RR.HH. y la importación del reloj no se ven afectadas.
-- =====================================================================
alter table public.empleados add column if not exists modo_fichaje text not null default 'gps';

create table if not exists public.equipos_fichaje (
  device_id   text not null,                    -- el código que el sistema le da a cada navegador
  legajo      integer not null,
  estado      text not null default 'pendiente', -- pendiente | aprobado | rechazado
  aparato     text not null default '',          -- navegador / sistema (para reconocerlo)
  local_id    text,                              -- ubicación donde está la computadora (opcional)
  nombre      text not null default '',          -- ej. "PC escritorio caja"
  pedido_en   timestamptz not null default now(),
  resuelto_por text,
  resuelto_en timestamptz,
  primary key (device_id, legajo)
);
alter table public.equipos_fichaje enable row level security;
drop policy if exists "rrhh equipos_fichaje" on public.equipos_fichaje;
create policy "rrhh equipos_fichaje" on public.equipos_fichaje for all to authenticated using (true) with check (true);
grant select, insert, update, delete on public.equipos_fichaje to authenticated;

-- El fichaje pregunta cómo ficha el empleado y en qué estado está este equipo.
-- Si es 'pc' y el equipo es nuevo, lo deja pendiente de aprobación.
create or replace function public.mi_equipo(p_legajo integer, p_pin text, p_device_id text, p_aparato text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; eq equipos_fichaje; loc text;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto');
  end if;
  if coalesce(emp.modo_fichaje, 'gps') <> 'pc' then return json_build_object('ok', true, 'modo', 'gps'); end if;
  if coalesce(p_device_id, '') = '' or p_device_id = 'sin-id' then
    return json_build_object('ok', true, 'modo', 'pc', 'estado', 'sin_id');
  end if;
  select * into eq from equipos_fichaje where device_id = p_device_id and legajo = p_legajo;
  if not found then
    insert into equipos_fichaje (device_id, legajo, aparato) values (p_device_id, p_legajo, left(coalesce(p_aparato, ''), 300))
    returning * into eq;
  end if;
  select nombre into loc from locales where id = eq.local_id;
  return json_build_object('ok', true, 'modo', 'pc', 'estado', eq.estado, 'local_id', eq.local_id, 'local_nombre', loc,
    'otros_aprobados', (select count(*) from equipos_fichaje where legajo = p_legajo and estado = 'aprobado' and device_id <> p_device_id));
end; $$;
revoke all on function public.mi_equipo(integer, text, text, text) from public;
grant execute on function public.mi_equipo(integer, text, text, text) to anon, authenticated;

-- Control en la base: quien ficha "desde su computadora" solo puede hacerlo
-- desde un equipo aprobado. Lo que carga RR.HH. con su usuario (correcciones,
-- reloj importado) o lo que se corre en el SQL Editor no pasa por este control.
create or replace function public.fichajes_control_equipo()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare modo text; rol text;
begin
  rol := coalesce(nullif(current_setting('request.jwt.claims', true), '')::json->>'role', '');
  if rol <> 'anon' then return new; end if;   -- solo se controla el fichaje del empleado (clave pública)
  select modo_fichaje into modo from empleados where legajo = new.legajo;
  if coalesce(modo, 'gps') = 'pc' and not exists (
    select 1 from equipos_fichaje where legajo = new.legajo and device_id = new.device_id and estado = 'aprobado') then
    raise exception 'equipo_no_autorizado: el legajo % solo puede fichar desde su computadora aprobada', new.legajo;
  end if;
  return new;
end; $$;
drop trigger if exists fichajes_control_equipo on public.fichajes;
create trigger fichajes_control_equipo before insert on public.fichajes
  for each row execute function public.fichajes_control_equipo();

-- Control
select count(*) filter (where modo_fichaje = 'pc') as fichan_desde_pc, count(*) as empleados from public.empleados;
