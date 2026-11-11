-- =====================================================================
-- Facturas de combustible: móvil, patente y chofer
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios). Se puede correr más de
-- una vez. También está al final de schema.sql.
--
-- Las facturas de las estaciones de servicio (Orve, 13 de Diciembre…) traen
-- el vehículo (interno), la patente, el chofer y el kilometraje. La lectura
-- automática los completa y quedan guardados con la factura, además de los
-- km y litros (debitos-internos-y-combustible.sql). Con eso sale el consumo
-- por móvil y la planilla de COMBUSTIBLE Y KMS.
-- =====================================================================
alter table facturas add column if not exists movil   text not null default '';   -- id del camión (⚙ → Camiones)
alter table facturas add column if not exists patente text not null default '';   -- como está en la factura, sin espacios ni guiones
alter table facturas add column if not exists chofer  text not null default '';

create index if not exists facturas_movil_idx on facturas (movil) where movil <> '';

select count(*) filter (where movil <> '') as facturas_con_movil from facturas;
