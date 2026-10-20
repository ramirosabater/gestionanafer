-- =====================================================================
-- RR.HH.: vencimientos de documentos y licencias con certificado
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios), después de
-- vacaciones.sql. Se puede correr de nuevo sin problema.
--
-- 1) documentos_requeridos: qué documentos tiene que tener cada sector (o
--    todos) y con cuántos días de anticipación avisar el vencimiento
--    (ej. Logística: Licencia de conducir y Psicofísico; Producción: Carnet
--    de manipulador). Se edita en RR.HH. → Personal → Vencimientos.
-- 2) Licencias con certificado: el empleado sube la foto del certificado
--    desde el fichaje. Se guarda en el bucket privado "legajos" (carpeta
--    certificados/<legajo>/), queda en la solicitud y en el legajo.
-- =====================================================================

-- 1) Documentos obligatorios por sector
create table if not exists public.documentos_requeridos (
  sector     text not null default '',      -- '' = todos los sectores
  tipo       text not null,                 -- mismo nombre que el tipo de documento del legajo
  dias_aviso integer not null default 30,   -- avisar cuando falten estos días para el vencimiento
  primary key (sector, tipo)
);
alter table public.documentos_requeridos enable row level security;
drop policy if exists "rrhh documentos_requeridos" on public.documentos_requeridos;
create policy "rrhh documentos_requeridos" on public.documentos_requeridos for all to authenticated
  using (public.gestion_puede_rrhh()) with check (public.gestion_puede_rrhh());
grant select, insert, update, delete on public.documentos_requeridos to authenticated;

-- 2) Certificado en las solicitudes (licencias)
alter table public.solicitudes add column if not exists certificado_path text;
alter table public.solicitudes add column if not exists certificado_subido_en timestamptz;
-- Nuevos tipos: 'enfermedad' (con certificado) y 'licencia' (licencia especial).
-- Si la tabla tenía un control con la lista vieja de tipos, se reemplaza.
do $$ declare c record; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.solicitudes'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%tipo%'
  loop execute format('alter table public.solicitudes drop constraint %I', c.conname); end loop;
end $$;
alter table public.solicitudes add constraint solicitudes_tipo_check
  check (tipo in ('dia_libre', 'ausencia', 'vacaciones', 'otro', 'enfermedad', 'licencia')) not valid;

-- El empleado (desde el fichaje, sin usuario) solo puede SUBIR archivos a la
-- carpeta certificados/ del bucket privado; no puede leer ni borrar nada.
drop policy if exists "empleados suben certificados" on storage.objects;
create policy "empleados suben certificados" on storage.objects for insert to anon
  with check (bucket_id = 'legajos' and (storage.foldername(name))[1] = 'certificados');

-- Pedido de licencia/ausencia que devuelve el id (para adjuntarle el certificado)
create or replace function public.crear_licencia(p_legajo integer, p_pin text, p_tipo text, p_desde date, p_hasta date, p_motivo text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; nuevo uuid;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  if p_tipo = 'vacaciones' then return json_build_object('ok', false, 'motivo', 'usar_pedir_vacaciones'); end if;
  insert into solicitudes(legajo, tipo, fecha_desde, fecha_hasta, motivo)
  values (p_legajo, p_tipo, p_desde, coalesce(p_hasta, p_desde), p_motivo) returning id into nuevo;
  return json_build_object('ok', true, 'id', nuevo);
end; $$;
revoke all on function public.crear_licencia(integer, text, text, date, date, text) from public;
grant execute on function public.crear_licencia(integer, text, text, date, date, text) to anon, authenticated;

-- Deja asentado el certificado subido (en la solicitud y en el legajo)
create or replace function public.adjuntar_certificado(p_legajo integer, p_pin text, p_id uuid, p_path text, p_nombre text, p_mime text, p_tamano integer)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; sol solicitudes;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  select * into sol from solicitudes where id = p_id and legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if p_path is null or p_path not like 'certificados/' || p_legajo || '/%' then
    return json_build_object('ok', false, 'motivo', 'ruta'); end if;
  update solicitudes set certificado_path = p_path, certificado_subido_en = now() where id = p_id;
  if not exists (select 1 from empleado_documentos where path = p_path) then
    insert into empleado_documentos (legajo, tipo, nombre_archivo, path, mime, tamano, subido_por)
    values (p_legajo, 'Certificado médico', coalesce(nullif(p_nombre, ''), 'certificado'), p_path, p_mime, p_tamano, 'el empleado (fichaje)');
  end if;
  return json_build_object('ok', true);
end; $$;
revoke all on function public.adjuntar_certificado(integer, text, uuid, text, text, text, integer) from public;
grant execute on function public.adjuntar_certificado(integer, text, uuid, text, text, text, integer) to anon, authenticated;

-- Mis solicitudes: ahora también con el período (vacaciones) y el certificado
create or replace function public.mis_solicitudes(p_legajo integer, p_pin text)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; res json;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  select coalesce(json_agg(row_to_json(s) order by s.creado_en desc), '[]'::json) into res
  from (select id, tipo, fecha_desde, fecha_hasta, motivo, estado, resolucion, creado_en, periodo,
               (certificado_path is not null) as tiene_certificado
        from solicitudes where legajo = p_legajo) s;
  return json_build_object('ok', true, 'solicitudes', res);
end; $$;

-- Control
select count(*) as requisitos from public.documentos_requeridos;
