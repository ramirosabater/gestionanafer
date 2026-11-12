-- =====================================================================
-- Nomenclatura nueva de productos (listado de noviembre 2026)
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios). Se puede correr más de
-- una vez. Todo va en un solo bloque.
--
-- Cambia el NOMBRE que se ve (los viajes y reclamos ya cargados siguen
-- apuntando al mismo producto):
--  * Logística · tipos de carga: X20 → B20A, X12V → B12V, SAB1.5 → SB1500,
--    DISP → DAN, M F/C → DFC, etc. (el código interno no cambia, así que los
--    viajes ya cargados muestran el nombre nuevo).
--  * Calidad · productos de los reclamos: Bx20Azul → B20A, Bx12Verde → B12V,
--    Soda retornable 1.5L → S1500, Soda retornable 650ml → S650, etc. (en la
--    lista y en los reclamos ya cargados).
--  * Comercial: no se toca la base; el tablero muestra la abreviatura nueva.
-- Los que no tienen abreviatura en el listado quedan como están
-- (PROMO MUNDIAL, BBA, R-8, R12/20, SIFON DESC, BMB AUT., MATE, Bx5,
-- Soda Descartable).
-- En toda la app, al pasar el mouse por arriba de una abreviatura se ve la
-- descripción del producto.
-- =====================================================================
do $nom$
begin
  -- Logística
  if to_regclass('public.cargo_types') is not null then
    update cargo_types c set name = n.nuevo
      from (values ('S175 B/S','S1750'), ('A1.5','A1500'), ('A2.25','A2250'), ('A/G 500','A500CG'),
                   ('X8','B8A'), ('X20','B20A'), ('X12','B12A'), ('X8V','B8V'), ('X12V','B12V'), ('X20V','B20V'),
                   ('SAB1.5','SB1500'), ('SAB500','SB500'), ('CAJ','C1500'), ('DISP','DAN'),
                   ('EX12','E12A'), ('EX20','E20A'), ('EX12V','E12V'), ('EX20V','E20V'), ('EVS1500','ES1500'),
                   ('M F/C','DFC'), ('VASOS','VA'), ('CAN','CDISP'), ('SPORT','AS750')) as n(viejo, nuevo)
     where upper(trim(c.name)) = n.viejo;
  end if;

  -- Calidad
  if to_regclass('public.calidad_reclamos') is not null then
    create temp table _nom_cal (viejo text, nuevo text) on commit drop;
    insert into _nom_cal values ('bx8azul','B8A'), ('bx12azul','B12A'), ('bx20azul','B20A'),
      ('bx8verde','B8V'), ('bx12verde','B12V'), ('bx20verde','B20V'),
      ('soda retornable 1.5l','S1500'), ('soda retornable','S1500'), ('soda retornable 650ml','S650');
    update calidad_reclamos r set producto = n.nuevo from _nom_cal n where lower(trim(r.producto)) = n.viejo;
    if to_regclass('public.calidad_listas') is not null then
      update calidad_listas l set valores = (
        select coalesce(jsonb_agg(v order by ord), '[]'::jsonb)
          from (select distinct on (v) v, ord
                  from (select coalesce(n.nuevo, t.v) as v, t.ord
                          from jsonb_array_elements_text(l.valores) with ordinality as t(v, ord)
                          left join _nom_cal n on n.viejo = lower(trim(t.v))) x
                 order by v, ord) y)
       where l.id = 'productos';
    end if;
  end if;
end $nom$;

-- Control
select 'Logística' as modulo, name as nombre from cargo_types where active order by sort_order;
select 'Calidad' as modulo, producto, count(*) from calidad_reclamos group by producto order by 3 desc;
select valores from calidad_listas where id = 'productos';
