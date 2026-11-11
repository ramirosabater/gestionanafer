-- =====================================================================
-- Borrar todos los proveedores (para cargar el listado nuevo y correcto)
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios) DESPUÉS de
-- limpiar-datos-administracion.sql: un proveedor no se puede borrar si
-- todavía tiene facturas, órdenes de compra u órdenes de pago. Si quedan,
-- este script no borra nada y avisa.
--
-- Antes de borrar guarda una copia en el esquema "respaldo_admin_20261111"
-- (tabla proveedores). Cuando ya no haga falta:
--   drop schema respaldo_admin_20261111 cascade;
--
-- También: los artículos quedan sin proveedores asociados (los artículos NO
-- se borran; se vuelven a asociar en Compras → Artículos o solos al cargar
-- facturas) y se olvidan los avisos de Sifoncito sobre proveedores.
-- No borra centros de costo, conceptos ni regímenes. Los archivos de los
-- proveedores que estén en Google Drive no se borran.
-- =====================================================================

begin;

do $$
declare n_f int; n_oc int; n_op int;
begin
  select count(*) into n_f  from facturas;
  select count(*) into n_oc from ordenes_compra;
  select count(*) into n_op from ordenes_pago;
  if n_f + n_oc + n_op > 0 then
    raise exception 'Todavía hay % facturas, % órdenes de compra y % órdenes de pago. Corré primero limpiar-datos-administracion.sql.', n_f, n_oc, n_op;
  end if;
end $$;

-- 1) Copia de respaldo
create schema if not exists respaldo_admin_20261111;
revoke all on schema respaldo_admin_20261111 from public, anon, authenticated;
do $$
begin
  if to_regclass('respaldo_admin_20261111.proveedores') is null then
    create table respaldo_admin_20261111.proveedores as table public.proveedores;
  end if;
  if to_regclass('public.articulos') is not null and to_regclass('respaldo_admin_20261111.articulos') is null then
    create table respaldo_admin_20261111.articulos as table public.articulos;
  end if;
end $$;

-- 2) Lo que apunta a proveedores
do $$
begin
  if to_regclass('public.cheques') is not null then update cheques set proveedor_id = null where proveedor_id is not null; end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'articulos' and column_name = 'proveedores') then
    update articulos set proveedores = '[]'::jsonb where proveedores <> '[]'::jsonb;
  end if;
  if to_regclass('public.ayudante_memoria') is not null then
    delete from ayudante_memoria where clave like 'monto:%' or clave like 'imput:%' or clave like 'falta:%' or clave like 'pago:%';
  end if;
end $$;

-- 3) Borrar los proveedores
delete from proveedores;

commit;

-- Control
select (select count(*) from respaldo_admin_20261111.proveedores) as habia_en_respaldo,
       (select count(*) from proveedores)                         as quedan;
