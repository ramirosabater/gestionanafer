-- =====================================================================
-- Quitar el campo "Rubro" de los proveedores
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios) DESPUÉS de subir la
-- versión nueva de Gestión (la vieja todavía manda el rubro al guardar).
-- Se puede correr más de una vez.
--
-- El rubro se usaba para dos cosas, que antes de borrarlo se pasan a su
-- propio campo para que no cambie nada:
--   1. Régimen de Ganancias por defecto (Bienes 78, Locación de servicios 94,
--      Honorarios 119, Alquileres 31, Transporte de carga 95): se copia a
--      proveedores.gan_regimen en los que no tenían régimen elegido.
--   2. Combustibles y lubricantes (facturas con km y litros): pasa a ser el
--      tilde "⛽ Proveedor de combustible" (proveedores.combustible).
-- Después se borra la columna proveedores.rubro y la tabla rubros.
-- =====================================================================

alter table proveedores add column if not exists combustible boolean not null default false;

do $$
declare n_reg int := 0; n_comb int := 0;
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'proveedores' and column_name = 'rubro') then

    -- 1) Régimen de Ganancias que salía del rubro
    with mapa(rubro, codigo) as (values
      ('bienes', 78), ('locacion de servicios', 94), ('honorarios', 119), ('alquileres', 31), ('transporte de carga', 95))
    update proveedores p
       set gan_regimen = m.codigo
      from mapa m
     where p.gan_regimen is null
       and lower(translate(trim(coalesce(p.rubro, '')), 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) = m.rubro
       and exists (select 1 from gan_regimenes g where g.codigo = m.codigo);
    get diagnostics n_reg = row_count;

    -- 2) Proveedores de combustible
    update proveedores
       set combustible = true
     where not combustible
       and (rubro ilike '%combust%' or rubro ilike '%lubric%');
    get diagnostics n_comb = row_count;

    raise notice 'Régimen copiado del rubro: % proveedores. Marcados como combustible: %.', n_reg, n_comb;

    alter table proveedores drop column rubro;
  end if;
end $$;

drop table if exists rubros;

-- Control
select count(*) filter (where combustible)           as proveedores_combustible,
       count(*) filter (where gan_regimen is not null) as con_regimen_ganancias,
       count(*) filter (where gan_regimen is null)     as sin_regimen_no_retienen
  from proveedores;
