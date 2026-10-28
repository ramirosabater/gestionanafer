-- =====================================================================
-- Débitos internos y datos de combustible en las facturas
-- =====================================================================
-- Correr en Supabase (SQL Editor, base Envios). Se puede correr más de una vez.
--
-- 1) Débito interno: un comprobante propio para lo que se paga sin factura
--    y sin impuestos. Se carga desde Pagos → Facturas (+ Nueva factura →
--    "Débito interno"), con número propio correlativo (DI-0001, DI-0002…),
--    proveedor o beneficiario, imputación y monto. No lleva IVA (neto =
--    monto) ni retención de Ganancias, y se paga con una orden de pago como
--    cualquier factura.
--
-- 2) Combustibles y lubricantes: en las facturas de esos proveedores (rubro
--    "Combustibles y lubricantes") se pueden cargar, opcionales, los
--    kilómetros (lo que marca el odómetro) y los litros.
-- =====================================================================
alter table facturas add column if not exists tipo_comprobante text not null default 'factura';  -- 'factura' | 'debito_interno'
alter table facturas add column if not exists km numeric;
alter table facturas add column if not exists litros numeric;

create index if not exists facturas_tipo_comprobante_idx on facturas(tipo_comprobante);

comment on column facturas.tipo_comprobante is 'factura | debito_interno (pago sin factura ni impuestos, número DI-0001…)';
comment on column facturas.km is 'Combustible: kilómetros del odómetro al cargar (opcional)';
comment on column facturas.litros is 'Combustible: litros cargados (opcional)';

-- Control: columnas nuevas
select column_name, data_type, column_default
  from information_schema.columns
 where table_schema = 'public' and table_name = 'facturas'
   and column_name in ('tipo_comprobante', 'km', 'litros')
 order by column_name;
