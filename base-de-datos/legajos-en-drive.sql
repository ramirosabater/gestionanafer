-- =====================================================================
-- Documentos de legajo y certificados médicos en Google Drive
-- =====================================================================
-- Correr en Supabase (SQL Editor, base Envios). Se puede correr más de una vez.
--
-- Los archivos pasan del almacenamiento "legajos" de Supabase a una unidad
-- compartida de Google Drive. Los sube y los muestra la función del servidor
-- "adjuntos-drive" (con la cuenta de Google del sistema); en la base quedan
-- como path = 'drive:<id del archivo>'.
--
-- 1) adjuntar_certificado_drive: la usa SOLO la función del servidor
--    (service_role) cuando el empleado sube un certificado desde el fichaje.
--    Vuelve a verificar legajo + PIN y que la solicitud sea suya.
-- 2) El empleado ya no sube directo al almacenamiento de Supabase: se borra
--    la política que lo permitía.
-- Los archivos que ya estaban en Supabase se pasan a Drive desde el panel de
-- RR.HH. (Personal → Vencimientos → "Pasar a Google Drive").
-- =====================================================================

create or replace function public.adjuntar_certificado_drive(p_legajo integer, p_pin text, p_id uuid, p_file_id text,
  p_nombre text, p_mime text, p_tamano integer)
returns json language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare emp empleados; sol solicitudes; v_path text;
begin
  select * into emp from empleados where legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if emp.pin_hash is null or emp.pin_hash <> crypt(p_pin, emp.pin_hash) then
    return json_build_object('ok', false, 'motivo', 'pin_incorrecto'); end if;
  select * into sol from solicitudes where id = p_id and legajo = p_legajo;
  if not found then return json_build_object('ok', false, 'motivo', 'no_existe'); end if;
  if p_file_id is null or p_file_id !~ '^[A-Za-z0-9_-]{10,}$' then
    return json_build_object('ok', false, 'motivo', 'ruta'); end if;
  v_path := 'drive:' || p_file_id;
  update solicitudes set certificado_path = v_path, certificado_subido_en = now() where id = p_id;
  if not exists (select 1 from empleado_documentos where path = v_path) then
    insert into empleado_documentos (legajo, tipo, nombre_archivo, path, mime, tamano, subido_por)
    values (p_legajo, 'Certificado médico', coalesce(nullif(p_nombre, ''), 'certificado'), v_path, p_mime, p_tamano, 'el empleado (fichaje)');
  end if;
  return json_build_object('ok', true);
end; $$;
revoke all on function public.adjuntar_certificado_drive(integer, text, uuid, text, text, text, integer) from public, anon, authenticated;
grant execute on function public.adjuntar_certificado_drive(integer, text, uuid, text, text, text, integer) to service_role;

-- El empleado ya no sube archivos directo al almacenamiento de Supabase
drop policy if exists "empleados suben certificados" on storage.objects;

-- Control: cuántos archivos quedan en Supabase y cuántos ya están en Drive
select count(*) filter (where path like 'drive:%')     as en_drive,
       count(*) filter (where path not like 'drive:%') as en_supabase_para_pasar
  from public.empleado_documentos;
