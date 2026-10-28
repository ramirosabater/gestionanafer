-- =====================================================================
-- Pagos parciales y pagos anticipados
-- =====================================================================
-- Correr en Supabase (SQL Editor, base Envios). Se puede correr más de una vez.
--
-- 1) Facturas pagadas a medias: una orden de pago puede cancelar solo una
--    parte de cada factura. Lo que cancela de cada una queda en
--    ordenes_pago.aplicaciones = [{factura_id, importe}]. La factura queda
--    en estado 'parcial' hasta que se termina de pagar. Las órdenes de pago
--    viejas (sin aplicaciones) siguen cancelando sus facturas enteras.
--
-- 2) Pagos anticipados: una orden de pago con tipo = 'anticipo', sin
--    facturas, con o sin orden de compra (oc_id). Se paga como cualquier
--    otra (formas de pago, egreso en Tesorería) y se le practica la
--    retención de Ganancias (RG 830) sobre base_retencion (el neto de IVA
--    del anticipo). Queda como saldo a favor del proveedor: cuando llega la
--    factura, la orden de pago que la cancela "usa" el anticipo
--    (anticipos_usados = [{op_id, importe}]) y no vuelve a retener sobre la
--    parte ya anticipada.
--
-- 3) Órdenes de compra: su estado de pago (sin pagar / pago parcial /
--    pagada) se calcula en la app con lo pagado de sus facturas y los
--    anticipos hechos a cuenta de ella. No hace falta columna nueva.
-- =====================================================================
alter table ordenes_pago add column if not exists tipo text not null default 'pago';      -- 'pago' | 'anticipo'
alter table ordenes_pago add column if not exists oc_id text;                              -- anticipo a cuenta de esta OC
alter table ordenes_pago add column if not exists aplicaciones jsonb not null default '[]'::jsonb;
alter table ordenes_pago add column if not exists anticipos_usados jsonb not null default '[]'::jsonb;
alter table ordenes_pago add column if not exists base_retencion numeric;                 -- solo anticipos

create index if not exists ordenes_pago_tipo_idx on ordenes_pago(tipo);
create index if not exists ordenes_pago_oc_idx on ordenes_pago(oc_id);

comment on column facturas.estado is 'pendiente | parcial (pagada a medias) | pagada | anulada';
comment on column ordenes_pago.tipo is 'pago (cancela facturas) | anticipo (pago a cuenta, sin factura)';
comment on column ordenes_pago.aplicaciones is '[{factura_id, importe}]: cuánto cancela de cada factura. Vacío = facturas enteras (órdenes viejas)';
comment on column ordenes_pago.anticipos_usados is '[{op_id, importe}]: anticipos del proveedor que se usan en este pago';

-- Control: columnas nuevas
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'ordenes_pago'
   and column_name in ('tipo', 'oc_id', 'aplicaciones', 'anticipos_usados', 'base_retencion')
 order by column_name;
