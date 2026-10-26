-- =====================================================================
-- SEGURIDAD — ETAPA 1 (hallazgos críticos C-1, C-2, C-3 y A-1)
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede correr
-- de nuevo sin problema. Después, volver a correr
-- auditoria-seguridad-consulta.sql: no tiene que quedar ninguna tabla de
-- Gestión, Calidad ni Comercial con "ANON PUEDE…" ni "cualquier usuario
-- logueado puede escribir" (salvo app_config, que se lee entre todos los
-- logueados pero solo la escriben los administradores).
--
-- Qué hace:
--  1. app_config (perfiles y permisos): la leen los logueados; la escriben
--     solo los administradores ("administrar accesos").
--  2. Borra las políticas "abiertas" (using true / with check true) de las
--     tablas de Gestión, Calidad y Comercial. Producción ya tiene políticas
--     por área en Logística, Compras, Pagos y Tesorería: esas quedan.
--  3. Crea políticas por área donde faltaban (cheques, retenciones, Calidad,
--     artículos, Comercial…), con los mismos permisos de ⚙ → Acceso.
--  4. Quita a "anon" (la clave pública) todo acceso a esas tablas.
--  5. Las vistas pasan a respetar los permisos de quien consulta.
--  6. Bucket "adjuntos": deja de ser público; solo Compras / Pagos / Tesorería.
--  7. RR.HH.: vacaciones y computadoras para fichar, solo con permiso de RR.HH.
--  8. usuarios: se borran las políticas del sistema de permisos anterior
--     (tabla perfiles); queda solo el de Gestión.
--
-- No cambia nada del fichaje de los empleados: sus funciones (legajo + PIN)
-- siguen igual, y horarios, locales, feriados y recargos siguen de lectura
-- pública porque los usa el fichaje.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) app_config
-- ---------------------------------------------------------------------
drop policy if exists "anon full access app_config" on public.app_config;
drop policy if exists "app_config: leen logueados" on public.app_config;
drop policy if exists "app_config: escribe admin" on public.app_config;
create policy "app_config: leen logueados" on public.app_config for select to authenticated using (true);
create policy "app_config: escribe admin" on public.app_config for all to authenticated
  using (public.gestion_es_admin()) with check (public.gestion_es_admin());
revoke all on public.app_config from anon;

-- ---------------------------------------------------------------------
-- 2 a 4) Tablas: se borran las políticas abiertas y, si la tabla no tiene
-- política por área, se crean (ver / editar según la sección de ⚙ → Acceso)
-- ---------------------------------------------------------------------
do $$
declare
  r record; pol record; tiene_area boolean;
begin
  for r in select * from (values
    -- tabla                          puede ver (secciones)                                 puede editar
    -- Logística (ya tienen políticas por área en producción)
    ('routes',            '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('trucks',            '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('drivers',           '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('helpers',           '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('cargo_types',       '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('trips',             '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid,day}'),
    ('branches',          '{grid,branches,company,occasional,day,dashboard,tableros}', '{branches}'),
    ('visits',            '{grid,branches,company,occasional,day,dashboard,tableros}', '{branches,day}'),
    ('companies',         '{grid,branches,company,occasional,day,dashboard,tableros}', '{company}'),
    ('company_visits',    '{grid,branches,company,occasional,day,dashboard,tableros}', '{company,day}'),
    ('occasionals',       '{grid,branches,company,occasional,day,dashboard,tableros}', '{occasional}'),
    ('occasional_visits', '{grid,branches,company,occasional,day,dashboard,tableros}', '{occasional,day}'),
    -- Administración
    ('proveedores',       '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('ordenes_compra',    '{compras,pagos,tesoreria,tableros}', '{compras,pagos}'),
    ('centros_costo',     '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('conceptos',         '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('rubros',            '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('articulos',         '{compras,pagos,tesoreria,tableros}', '{compras,pagos}'),
    ('facturas',          '{compras,pagos,tesoreria,tableros}', '{compras,pagos}'),
    ('ordenes_pago',      '{compras,pagos,tesoreria,tableros}', '{pagos}'),
    ('cuentas',           '{pagos,tesoreria,tableros}',         '{tesoreria}'),
    ('movimientos',       '{pagos,tesoreria,tableros}',         '{tesoreria,pagos}'),
    ('cheques',           '{pagos,tesoreria,tableros}',         '{tesoreria,pagos}'),
    ('medios_caja',       '{compras,pagos,tesoreria}',          '{tesoreria}'),
    ('gan_regimenes',     '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('gan_escalas',       '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('parametros',        '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('tipos_retencion',   '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('conceptos_retencion','{compras,pagos,tesoreria}',         '{pagos,tesoreria}'),
    -- Calidad
    ('calidad_reclamos',  '{reclamos,ncpac,calidash,tableros}', '{reclamos,ncpac}'),
    ('calidad_pac',       '{reclamos,ncpac,calidash,tableros}', '{ncpac}'),
    ('calidad_listas',    '{reclamos,ncpac,calidash}',          '{reclamos,ncpac}'),
    -- Comercial
    ('comercial_mensual',          '{comercial,tableros}', '{comercial}'),
    ('comercial_producto_mensual', '{comercial,tableros}', '{comercial}'),
    ('comercial_altas_bajas',      '{comercial,tableros}', '{comercial}'),
    ('comercial_clientes',         '{comercial,tableros}', '{comercial}'),
    ('comercial_producto_ref',     '{comercial,tableros}', '{comercial}'),
    ('comercial_real',             '{comercial,tableros}', '{comercial}'),
    ('comercial_referencia',       '{comercial,tableros}', '{comercial}')
  ) as v(tabla, ver, editar)
  loop
    if to_regclass('public.' || r.tabla) is null then continue; end if;
    execute format('alter table public.%I enable row level security', r.tabla);
    -- borrar las políticas abiertas (sin condición)
    for pol in select policyname from pg_policies
               where schemaname = 'public' and tablename = r.tabla
                 and coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true'
    loop
      execute format('drop policy %I on public.%I', pol.policyname, r.tabla);
    end loop;
    -- ¿ya tiene políticas por área? (las de producción: <tabla>_leer, _insertar…)
    select exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tabla) into tiene_area;
    if not tiene_area or exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tabla and policyname like 'seg: %') then
      execute format('drop policy if exists %I on public.%I', 'seg: ver', r.tabla);
      execute format('drop policy if exists %I on public.%I', 'seg: crear', r.tabla);
      execute format('drop policy if exists %I on public.%I', 'seg: cambiar', r.tabla);
      execute format('drop policy if exists %I on public.%I', 'seg: borrar', r.tabla);
      execute format('create policy %I on public.%I for select to authenticated using ((select public.puede_ver(%L::text[])))', 'seg: ver', r.tabla, r.ver);
      execute format('create policy %I on public.%I for insert to authenticated with check ((select public.puede_editar(%L::text[])))', 'seg: crear', r.tabla, r.editar);
      execute format('create policy %I on public.%I for update to authenticated using ((select public.puede_editar(%L::text[]))) with check ((select public.puede_editar(%L::text[])))', 'seg: cambiar', r.tabla, r.editar, r.editar);
      execute format('create policy %I on public.%I for delete to authenticated using ((select public.puede_editar(%L::text[])))', 'seg: borrar', r.tabla, r.editar);
    end if;
    execute format('revoke all on public.%I from anon', r.tabla);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabla);
  end loop;
end $$;

-- Memoria de Sifoncito: cada uno ve y cambia solo lo suyo
do $$ begin
  if to_regclass('public.ayudante_memoria') is not null then
    drop policy if exists "anon full access ayudante_memoria" on public.ayudante_memoria;
    drop policy if exists "seg: lo propio" on public.ayudante_memoria;
    create policy "seg: lo propio" on public.ayudante_memoria for all to authenticated
      using (lower(usuario) = lower(coalesce(auth.jwt() ->> 'email', '')))
      with check (lower(usuario) = lower(coalesce(auth.jwt() ->> 'email', '')));
    revoke all on public.ayudante_memoria from anon;
  end if;
end $$;

-- Opiniones de los tableros: las ve y las pide quien ve Dashboards; las borra un administrador
do $$ begin
  if to_regclass('public.tableros_opiniones') is not null then
    drop policy if exists "anon full access tableros_opiniones" on public.tableros_opiniones;
    drop policy if exists "seg: ver" on public.tableros_opiniones;
    drop policy if exists "seg: crear" on public.tableros_opiniones;
    drop policy if exists "seg: admin" on public.tableros_opiniones;
    create policy "seg: ver" on public.tableros_opiniones for select to authenticated using ((select public.puede_ver(array['tableros'])));
    create policy "seg: crear" on public.tableros_opiniones for insert to authenticated with check ((select public.puede_ver(array['tableros'])));
    create policy "seg: admin" on public.tableros_opiniones for all to authenticated using (public.gestion_es_admin()) with check (public.gestion_es_admin());
    revoke all on public.tableros_opiniones from anon;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5) Vistas: que respeten los permisos de quien consulta
-- ---------------------------------------------------------------------
do $$
declare v text;
begin
  foreach v in array array['factura_articulos_v', 'comercial_altas_bajas_meses', 'comercial_clientes_meses',
                           'comercial_producto_resumen', 'comercial_resumen_meses'] loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v);
      execute format('revoke all on public.%I from anon', v);
      execute format('grant select on public.%I to authenticated', v);
    end if;
  end loop;
end $$;

-- Funciones que no tienen por qué llamarse sin usuario
do $$ begin
  if to_regprocedure('public.calidad_lista(text)') is not null then
    revoke execute on function public.calidad_lista(text) from public, anon; end if;
  if to_regprocedure('public.calidad_proximo_reclamo(integer)') is not null then
    revoke execute on function public.calidad_proximo_reclamo(integer) from public, anon; end if;
  if to_regprocedure('public.top_clientes(date, date, text, integer)') is not null then
    revoke execute on function public.top_clientes(date, date, text, integer) from public, anon;
    grant execute on function public.top_clientes(date, date, text, integer) to authenticated; end if;
end $$;

-- ---------------------------------------------------------------------
-- 6) Bucket "adjuntos": privado y solo para Compras / Pagos / Tesorería
-- ---------------------------------------------------------------------
update storage.buckets set public = false where id = 'adjuntos';
drop policy if exists "anon full access adjuntos" on storage.objects;
drop policy if exists "seg: adjuntos ver" on storage.objects;
drop policy if exists "seg: adjuntos editar" on storage.objects;
create policy "seg: adjuntos ver" on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and (select public.puede_ver(array['compras', 'pagos', 'tesoreria'])));
create policy "seg: adjuntos editar" on storage.objects for all to authenticated
  using (bucket_id = 'adjuntos' and (select public.puede_editar(array['compras', 'pagos'])))
  with check (bucket_id = 'adjuntos' and (select public.puede_editar(array['compras', 'pagos'])));

-- ---------------------------------------------------------------------
-- 7) RR.HH.: vacaciones y computadoras para fichar
-- ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.vacaciones_saldos') is not null then
    drop policy if exists "rrhh vacaciones_saldos" on public.vacaciones_saldos;
    create policy "rrhh vacaciones_saldos" on public.vacaciones_saldos for all to authenticated
      using (public.gestion_puede_rrhh()) with check (public.es_admin());
    revoke all on public.vacaciones_saldos from anon;
  end if;
  if to_regclass('public.equipos_fichaje') is not null then
    drop policy if exists "rrhh equipos_fichaje" on public.equipos_fichaje;
    create policy "rrhh equipos_fichaje" on public.equipos_fichaje for all to authenticated
      using (public.gestion_puede_rrhh()) with check (public.es_admin());
    revoke all on public.equipos_fichaje from anon;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8) usuarios: solo el sistema de permisos de Gestión (app_config)
-- ---------------------------------------------------------------------
drop policy if exists usuarios_leer on public.usuarios;
drop policy if exists usuarios_insertar on public.usuarios;
drop policy if exists usuarios_actualizar on public.usuarios;
drop policy if exists usuarios_borrar on public.usuarios;
revoke all on public.usuarios from anon;

-- Lo que se cree de ahora en más en public no queda abierto a la clave pública
alter default privileges in schema public revoke all on tables from anon;

-- Control: tablas de Gestión / Calidad / Comercial que todavía quedan abiertas (tiene que dar 0 filas)
select tablename as todavia_abierta, policyname, array_to_string(roles, ',') as roles
from pg_policies
where schemaname = 'public'
  and tablename not in ('horarios', 'locales', 'feriados', 'recargos', 'config_zona')
  and coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true'
  and policyname <> 'app_config: leen logueados'
order by 1;

-- ---------------------------------------------------------------------
-- DESHACER (solo si algo dejó de funcionar y hay que volver atrás YA):
-- para una tabla <t>:  create policy "anon full access <t>" on public.<t> for all using (true) with check (true);
-- y avisar: lo correcto es corregir el permiso del perfil en ⚙ → Acceso.
-- ---------------------------------------------------------------------
