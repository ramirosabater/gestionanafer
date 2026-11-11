-- =====================================================================
-- Artículos por proveedor
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios). Se puede correr más de
-- una vez. También está al final de schema.sql.
--
-- articulos.proveedores = ["id_proveedor", ...]: quién vende cada artículo.
-- En la factura de un proveedor que carga artículos se elige de SU lista
-- (no se escribe a mano). Se completa sola con:
--   1. la nota "Proveedor habitual: X" que dejó flota-y-articulos.sql, y
--   2. los artículos que ya aparecen en facturas de cada proveedor.
-- Después se mantiene sola (al cargar una factura) y se edita en
-- Compras → Artículos.
-- =====================================================================

alter table articulos add column if not exists proveedores jsonb not null default '[]'::jsonb;

-- Normaliza nombres para comparar: mayúsculas, sin acentos ni signos, sin SRL/SA al final
create or replace function pg_temp.norm(t text) returns text language sql immutable as $$
  select trim(regexp_replace(
           regexp_replace(upper(translate(replace(coalesce(t, ''), '.', ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]+', ' ', 'g'),
           '( (SRL|SA|SAS|SH|SACI|SAIC|SCA))+ *$', ''));
$$;

with nota as (
  select a.id as articulo_id, pg_temp.norm(substr(a.notas, length('Proveedor habitual:') + 1)) as clave
    from articulos a
   where a.notas ilike 'Proveedor habitual:%'
), por_nota as (
  -- solo entre los proveedores que cargan artículos (así "FORMAS" no agarra cualquier otro)
  select n.articulo_id, p.id as proveedor_id
    from nota n
    join proveedores p
      on coalesce(p.lleva_articulos, false)
     and n.clave <> ''
     and (pg_temp.norm(p.nombre) = n.clave or pg_temp.norm(p.nombre) like n.clave || ' %')
), por_factura as (
  select distinct x ->> 'articulo_id' as articulo_id, f.proveedor_id
    from facturas f
    cross join lateral jsonb_array_elements(coalesce(f.articulos, '[]'::jsonb)) x
   where f.proveedor_id is not null
     and coalesce(f.estado, '') <> 'anulada'
     and x ->> 'articulo_id' is not null
), todos as (
  select articulo_id, proveedor_id from por_nota
  union
  select articulo_id, proveedor_id from por_factura
), nuevos as (
  select a.id, (
           select jsonb_agg(distinct v)
             from (select jsonb_array_elements_text(a.proveedores) v
                   union select t.proveedor_id from todos t where t.articulo_id = a.id) q
         ) as lista
    from articulos a
)
update articulos a
   set proveedores = n.lista
  from nuevos n
 where n.id = a.id
   and n.lista is not null
   and n.lista <> a.proveedores;

-- Control: cuántos artículos tiene cada proveedor que carga artículos
select p.nombre as proveedor,
       count(a.id) as articulos
  from proveedores p
  left join articulos a on a.proveedores ? p.id
 where coalesce(p.lleva_articulos, false)
 group by p.nombre
 order by p.nombre;
