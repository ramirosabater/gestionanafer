-- =====================================================================
-- Centros de costo nuevos que usa el listado de proveedores (noviembre 2026)
-- =====================================================================
-- Logística › Servicios y Producción y sopladora › Servicios.
-- (El script de alta de proveedores ya los crea; este queda para el árbol.)
-- Se puede correr más de una vez.
-- =====================================================================
alter table centros_costo add column if not exists ref_fijo text not null default '';
insert into centros_costo (id, codigo, descripcion, parent_id, requiere, orden, ref_fijo, activo) values
  ('cc_logistica_servicios', '', 'Servicios', 'cc_logistica', '', 4, '', true),
  ('cc_produccion_y_sopladora_servicios', '', 'Servicios', 'cc_produccion_y_sopladora', '', 3, '', true)
on conflict (id) do nothing;
