-- =====================================================================
-- Compras: base de artículos + proveedores que cargan artículos en la factura
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede correr
-- de nuevo sin problema. También está al final de schema.sql.
--
-- * articulos: la base de artículos (código, descripción, unidad, categoría).
--   Se administra en Administración → Compras → Artículos, o se da de alta
--   desde la misma factura. Es la base que va a usar Stock.
-- * proveedores.lleva_articulos: si está tildado, al cargar una factura de
--   ese proveedor hay que detallar los artículos (cantidad y precio), además
--   de la imputación (una sola o repartida en centros de costo).
-- * facturas.articulos: el detalle [{articulo_id, cantidad, precio, importe}].
-- * Vista factura_articulos_v: una fila por artículo comprado (sin las
--   facturas anuladas), lista para Stock y reportes.
-- =====================================================================
create table if not exists articulos (
  id          text primary key,
  codigo      text not null default '',
  descripcion text not null,
  unidad      text not null default 'Unidad',
  categoria   text not null default '',
  activo      boolean not null default true,
  notas       text not null default '',
  created_at  timestamptz not null default now()
);
create unique index if not exists articulos_codigo_uq on articulos (lower(codigo)) where codigo <> '';
create index if not exists articulos_descripcion_idx on articulos (lower(descripcion));

alter table articulos enable row level security;
drop policy if exists "anon full access articulos" on articulos;
create policy "anon full access articulos" on articulos for all using (true) with check (true);
grant select, insert, update, delete on articulos to anon, authenticated;

alter table proveedores add column if not exists lleva_articulos boolean not null default false;
alter table facturas    add column if not exists articulos jsonb not null default '[]'::jsonb;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'articulos') then
    alter publication supabase_realtime add table articulos;
  end if;
end $$;

create or replace view factura_articulos_v as
select f.id                          as factura_id,
       f.proveedor_id,
       f.numero                      as factura_numero,
       f.fecha,
       a.ord                         as linea,
       a.item->>'articulo_id'        as articulo_id,
       coalesce((a.item->>'cantidad')::numeric, 0) as cantidad,
       coalesce((a.item->>'precio')::numeric, 0)   as precio,
       coalesce((a.item->>'importe')::numeric, 0)  as importe
from facturas f
cross join lateral jsonb_array_elements(coalesce(f.articulos, '[]'::jsonb)) with ordinality as a(item, ord)
where coalesce(f.estado, '') <> 'anulada';
grant select on factura_articulos_v to anon, authenticated;

-- Control
select (select count(*) from articulos) as articulos,
       (select count(*) from proveedores where lleva_articulos) as proveedores_con_articulos;
