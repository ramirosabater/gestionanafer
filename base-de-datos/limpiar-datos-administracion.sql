-- =====================================================================
-- Limpiar los datos de prueba de Administración (arrancar de cero)
-- =====================================================================
-- Correr UNA vez en el SQL Editor de Supabase (base Envios).
--
-- BORRA: solicitudes de compra y recepciones, órdenes de compra, órdenes de
-- pago (con sus retenciones y certificados), facturas (y débitos internos),
-- cuentas de caja y banco, movimientos de tesorería y cheques.
-- NO toca: proveedores, artículos, centros de costo, conceptos, conceptos de
-- caja, regímenes de Ganancias, usuarios, Logística, Calidad, Comercial ni RR.HH.
--
-- Antes de borrar guarda una COPIA de todo en el esquema
-- "respaldo_admin_20261111" (no se ve desde la app). Si algo se borró por
-- error se puede recuperar desde ahí; cuando ya no haga falta:
--   drop schema respaldo_admin_20261111 cascade;
--
-- Se queda la cuenta del sistema "Cheques en cartera" (la usa el concepto
-- CHE). Los conceptos de caja que apuntaban a una cuenta borrada quedan sin
-- cuenta: al crear las cuentas nuevas, asignalas en ⚙ → Tesorería → Conceptos de caja.
-- Los archivos de las facturas que ya estaban en Google Drive NO se borran.
--
-- IMPORTANTE: si todavía no corriste articulos-por-proveedor.sql, corrélo
-- ANTES que este (usa las facturas para saber qué artículos vende cada proveedor).
-- =====================================================================

begin;

-- 1) Copia de respaldo
create schema if not exists respaldo_admin_20261111;
revoke all on schema respaldo_admin_20261111 from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['solicitudes_compra','recepciones','ordenes_compra','ordenes_pago','facturas','cuentas','movimientos','cheques','medios_caja'] loop
    if to_regclass('public.' || t) is not null and to_regclass('respaldo_admin_20261111.' || t) is null then
      execute format('create table respaldo_admin_20261111.%I as table public.%I', t, t);
    end if;
  end loop;
end $$;

-- 2) Borrado, en orden (primero lo que depende de otra cosa)
do $$
begin
  if to_regclass('public.recepciones') is not null then delete from recepciones; end if;
  if to_regclass('public.solicitudes_compra') is not null then delete from solicitudes_compra; end if;
  delete from cheques;
  delete from movimientos;
  delete from ordenes_pago;
  delete from facturas;
  delete from ordenes_compra;
  update medios_caja set cuenta_id = null where cuenta_id is not null and cuenta_id <> 'cartera_cheques';
  delete from cuentas where id <> 'cartera_cheques';
end $$;

-- Si la cuenta de cartera no existía, se crea (la usa el concepto CHE)
insert into cuentas (id, nombre, tipo, saldo_inicial, notas)
values ('cartera_cheques', 'Cheques en cartera', 'cartera', 0, 'Cheques de terceros recibidos y todavía no depositados ni entregados')
on conflict (id) do update set saldo_inicial = 0;

commit;

-- 3) Control: lo que había (está en el respaldo) y lo que quedó
select t.tabla,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from respaldo_admin_20261111.%I', t.tabla), false, true, '')))[1]::text::int as habia_en_respaldo,
       (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', t.tabla), false, true, '')))[1]::text::int as quedan
  from unnest(array['solicitudes_compra','recepciones','ordenes_compra','ordenes_pago','facturas','cuentas','movimientos','cheques']) as t(tabla)
 where to_regclass('public.' || t.tabla) is not null
 order by t.tabla;
