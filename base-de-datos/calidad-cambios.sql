-- =====================================================================
-- Calidad: cliente y origen en los reclamos + productos nuevos
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios), después de
-- calidad.sql. Se puede correr de nuevo sin problema.
-- 1) Reclamos: columnas "cliente" y "origen" (planta, sucursal, distribuidor…),
--    "comentarios" (1ª parte, recepción), "adjuntos" (fotos en Google Drive) y
--    "control_por / control_en" (quién completó la 2ª parte en fábrica).
--    Quien carga ya quedaba registrado en "creado_por".
-- 2) Productos: "Soda Retornable" pasa a "Soda retornable 1.5L" (en la lista y
--    en los reclamos ya cargados) y se suman Soda retornable 650ml, Bx5Azul y
--    Bx5Verde. Si la lista nunca se tocó desde ⚙, Gestión ya trae la nueva.
-- =====================================================================
alter table calidad_reclamos add column if not exists cliente text not null default '';
alter table calidad_reclamos add column if not exists origen  text not null default '';
create index if not exists calidad_reclamos_origen_idx on calidad_reclamos(origen);
-- Carga en dos partes: comentarios de quien recibe; fotos del control (Google Drive) y quién lo controló
alter table calidad_reclamos add column if not exists comentarios text not null default '';
alter table calidad_reclamos add column if not exists adjuntos jsonb not null default '[]'::jsonb;  -- [{id, url, name, contentType, sizeBytes, subido_por, subido_en}]
alter table calidad_reclamos add column if not exists control_por text;
alter table calidad_reclamos add column if not exists control_en timestamptz;

update calidad_reclamos set producto = 'Soda retornable 1.5L' where lower(producto) = 'soda retornable';

-- Lista de productos guardada (si existe): renombra y agrega lo que falte, con "Otro" al final
update calidad_listas l set valores = (
  with base as (
    select case when lower(v) = 'soda retornable' then 'Soda retornable 1.5L' else v end as v, ord
    from jsonb_array_elements_text(l.valores) with ordinality as t(v, ord)
  ), todos as (
    select v, ord from base
    union all
    select n.v, 1000 + n.i from (values ('Soda retornable 650ml', 1), ('Bx5Azul', 2), ('Bx5Verde', 3)) as n(v, i)
    where not exists (select 1 from base b where lower(b.v) = lower(n.v))
  )
  select coalesce(jsonb_agg(v order by (lower(v) = 'otro'), ord), '[]'::jsonb) from todos
)
where l.id = 'productos';

-- Control
select id, valores from calidad_listas where id in ('productos', 'origenes_reclamo', 'cargadores');
