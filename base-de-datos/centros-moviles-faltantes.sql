-- =====================================================================
-- Centros de costo: un centro por cada móvil de la flota
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios), después de
-- centros-de-costo.sql. Se puede correr más de una vez.
--
-- El árbol tenía centro propio solo para los móviles 13, 17, 20, 32 y 41.
-- Este script agrega los que faltan de la planilla de móviles (25 en total)
-- en las 4 ramas que se abren por móvil:
--   Logística › Móviles · Logística › Impuestos ·
--   Mantenimiento › Flota › Insumos · Mantenimiento › Flota › Servicios
-- Cada centro queda ligado a su camión (ref_fijo "movil:N"), así el gasto se
-- suma por móvil en el Dashboard y la lectura de facturas de combustible lo
-- elige sola. Si un móvil ya tiene su centro en una rama (aunque tenga otro
-- código), no se duplica. Los móviles se ordenan por número.
-- =====================================================================
alter table centros_costo add column if not exists ref_fijo text not null default '';

with moviles(n) as (values
  (5), (8), (11), (12), (13), (14), (15), (16), (17), (20), (22), (26), (27),
  (30), (31), (32), (33), (34), (35), (36), (37), (38), (39), (40), (41)
), ramas(parent_id) as (values
  ('cc_logistica_moviles'), ('cc_logistica_impuestos'),
  ('cc_mantenimiento_flota_insumos'), ('cc_mantenimiento_flota_servicios')
), faltan as (
  select r.parent_id, m.n
    from ramas r cross join moviles m
   where exists (select 1 from centros_costo p where p.id = r.parent_id)
     and not exists (select 1 from centros_costo c where c.parent_id = r.parent_id and c.ref_fijo = 'movil:' || m.n)
)
insert into centros_costo (id, codigo, descripcion, parent_id, requiere, orden, ref_fijo, activo)
select parent_id || '_movil_' || n, '', 'Móvil ' || n, parent_id, '', n, 'movil:' || n, true
  from faltan
on conflict (id) do nothing;

-- Orden por número de móvil en las 4 ramas (también los que ya estaban)
update centros_costo c
   set orden = substring(c.ref_fijo from 'movil:(\d+)')::int
 where c.parent_id in ('cc_logistica_moviles', 'cc_logistica_impuestos', 'cc_mantenimiento_flota_insumos', 'cc_mantenimiento_flota_servicios')
   and c.ref_fijo ~ '^movil:\d+$'
   and c.orden is distinct from substring(c.ref_fijo from 'movil:(\d+)')::int;

-- Control: cuántos móviles tiene cada rama, y móviles sin camión en ⚙ → Camiones
select p.descripcion as rama, count(c.id) as moviles
  from centros_costo p
  left join centros_costo c on c.parent_id = p.id and c.ref_fijo like 'movil:%' and c.activo
 where p.id in ('cc_logistica_moviles', 'cc_logistica_impuestos', 'cc_mantenimiento_flota_insumos', 'cc_mantenimiento_flota_servicios')
 group by p.id, p.descripcion
 order by p.id;

select distinct substring(c.ref_fijo from 'movil:(.+)') as movil_sin_camion
  from centros_costo c
 where c.ref_fijo like 'movil:%'
   and not exists (select 1 from trucks t where t.id = substring(c.ref_fijo from 'movil:(.+)'))
 order by 1;
