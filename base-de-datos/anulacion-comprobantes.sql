-- =====================================================================
-- Anulación de comprobantes (en vez de borrarlos)
-- =====================================================================
-- Facturas, órdenes de pago, órdenes de compra y movimientos de caja ya no
-- se eliminan: se anulan. Quedan guardados con quién, cuándo y por qué, y
-- su número (OP, OC, certificado de retención) no se vuelve a usar.
-- Se puede correr todas las veces que haga falta.
-- =====================================================================
alter table facturas       add column if not exists anulado_en timestamptz;
alter table facturas       add column if not exists anulado_por text not null default '';
alter table facturas       add column if not exists motivo_anulacion text not null default '';
alter table ordenes_pago   add column if not exists anulado_en timestamptz;
alter table ordenes_pago   add column if not exists anulado_por text not null default '';
alter table ordenes_pago   add column if not exists motivo_anulacion text not null default '';
alter table ordenes_compra add column if not exists anulado_en timestamptz;
alter table ordenes_compra add column if not exists anulado_por text not null default '';
alter table ordenes_compra add column if not exists motivo_anulacion text not null default '';
alter table movimientos    add column if not exists anulado_en timestamptz;
alter table movimientos    add column if not exists anulado_por text not null default '';
alter table movimientos    add column if not exists motivo_anulacion text not null default '';

-- Control: tienen que salir las 4 tablas
select table_name from information_schema.columns
where table_schema='public' and column_name='motivo_anulacion' order by 1;
