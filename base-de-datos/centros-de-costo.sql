-- =====================================================================
-- Centros de costo de ANAFER SA (árbol del Excel CENTRO_DE_COSTOS.xlsx)
-- =====================================================================
-- Correr DESPUÉS de schema.sql. Se puede correr más de una vez.
-- - Carga el árbol nuevo (ids "cc_..."). Solo se imputa a las hojas (las
--   ramas sin hijos); "requiere" = movil | sucursal pide además el camión o la
--   sucursal al cargar la factura.
-- - Los centros de costo anteriores (los que vinieron del sistema viejo)
--   quedan INACTIVOS: no aparecen para cargar, pero las facturas y los
--   proveedores que ya los tienen los conservan.
-- =====================================================================
insert into centros_costo (id, codigo, descripcion, parent_id, requiere, orden, activo) values
  ('cc_administracion', '', 'Administración', null, '', 1, true),
  ('cc_administracion_insumos', '', 'Insumos', 'cc_administracion', '', 1, true),
  ('cc_administracion_servicios', '', 'Servicios', 'cc_administracion', '', 2, true),
  ('cc_calidad', '', 'Calidad', null, '', 2, true),
  ('cc_calidad_insumos', '', 'Insumos', 'cc_calidad', '', 1, true),
  ('cc_calidad_servicios', '', 'Servicios', 'cc_calidad', '', 2, true),
  ('cc_control_documentario', '', 'Control documentario', null, '', 3, true),
  ('cc_control_documentario_insumos', '', 'Insumos', 'cc_control_documentario', '', 1, true),
  ('cc_control_documentario_servicios', '', 'Servicios', 'cc_control_documentario', '', 2, true),
  ('cc_impuestos', '', 'Impuestos', null, '', 4, true),
  ('cc_impuestos_imp_municipales', '', 'Imp. municipales', 'cc_impuestos', '', 1, true),
  ('cc_impuestos_imp_provinciales', '', 'Imp. provinciales', 'cc_impuestos', '', 2, true),
  ('cc_impuestos_imp_nacionales', '', 'Imp. nacionales', 'cc_impuestos', '', 3, true),
  ('cc_logistica', '', 'Logística', null, '', 5, true),
  ('cc_logistica_deposito', '', 'Depósito', 'cc_logistica', '', 1, true),
  ('cc_logistica_moviles', '', 'Móviles', 'cc_logistica', 'movil', 2, true),
  ('cc_logistica_impuestos', '', 'Impuestos', 'cc_logistica', 'movil', 3, true),
  ('cc_mantenimiento', '', 'Mantenimiento', null, '', 6, true),
  ('cc_mantenimiento_instalaciones', '', 'Instalaciones', 'cc_mantenimiento', '', 1, true),
  ('cc_mantenimiento_instalaciones_insumos', '', 'Insumos', 'cc_mantenimiento_instalaciones', '', 1, true),
  ('cc_mantenimiento_instalaciones_insumos_sucursales', '', 'Sucursales', 'cc_mantenimiento_instalaciones_insumos', 'sucursal', 1, true),
  ('cc_mantenimiento_instalaciones_insumos_base', '', 'Base', 'cc_mantenimiento_instalaciones_insumos', '', 2, true),
  ('cc_mantenimiento_instalaciones_insumos_sopladora', '', 'Sopladora', 'cc_mantenimiento_instalaciones_insumos', '', 3, true),
  ('cc_mantenimiento_instalaciones_insumos_taller', '', 'Taller', 'cc_mantenimiento_instalaciones_insumos', '', 4, true),
  ('cc_mantenimiento_instalaciones_servicios', '', 'Servicios', 'cc_mantenimiento_instalaciones', '', 2, true),
  ('cc_mantenimiento_instalaciones_servicios_sucursales', '', 'Sucursales', 'cc_mantenimiento_instalaciones_servicios', 'sucursal', 1, true),
  ('cc_mantenimiento_instalaciones_servicios_base', '', 'Base', 'cc_mantenimiento_instalaciones_servicios', '', 2, true),
  ('cc_mantenimiento_instalaciones_servicios_sopladora', '', 'Sopladora', 'cc_mantenimiento_instalaciones_servicios', '', 3, true),
  ('cc_mantenimiento_instalaciones_servicios_taller', '', 'Taller', 'cc_mantenimiento_instalaciones_servicios', '', 4, true),
  ('cc_mantenimiento_maquinas_y_equipos', '', 'Máquinas y equipos', 'cc_mantenimiento', '', 2, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos', '', 'Insumos', 'cc_mantenimiento_maquinas_y_equipos', '', 1, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos_linea_1', '', 'Línea 1 · Agua retornable', 'cc_mantenimiento_maquinas_y_equipos_insumos', '', 1, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos_linea_2', '', 'Línea 2 · Agua descartable', 'cc_mantenimiento_maquinas_y_equipos_insumos', '', 2, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos_linea_3', '', 'Línea 3 · Soda descartable', 'cc_mantenimiento_maquinas_y_equipos_insumos', '', 3, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos_linea_4', '', 'Línea 4 · Soda retornable', 'cc_mantenimiento_maquinas_y_equipos_insumos', '', 4, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos_ta', '', 'TA · Tratamiento de agua', 'cc_mantenimiento_maquinas_y_equipos_insumos', '', 5, true),
  ('cc_mantenimiento_maquinas_y_equipos_insumos_so', '', 'SO · Sopladora', 'cc_mantenimiento_maquinas_y_equipos_insumos', '', 6, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios', '', 'Servicios', 'cc_mantenimiento_maquinas_y_equipos', '', 2, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios_linea_1', '', 'Línea 1 · Agua retornable', 'cc_mantenimiento_maquinas_y_equipos_servicios', '', 1, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios_linea_2', '', 'Línea 2 · Agua descartable', 'cc_mantenimiento_maquinas_y_equipos_servicios', '', 2, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios_linea_3', '', 'Línea 3 · Soda descartable', 'cc_mantenimiento_maquinas_y_equipos_servicios', '', 3, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios_linea_4', '', 'Línea 4 · Soda retornable', 'cc_mantenimiento_maquinas_y_equipos_servicios', '', 4, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios_ta', '', 'TA · Tratamiento de agua', 'cc_mantenimiento_maquinas_y_equipos_servicios', '', 5, true),
  ('cc_mantenimiento_maquinas_y_equipos_servicios_so', '', 'SO · Sopladora', 'cc_mantenimiento_maquinas_y_equipos_servicios', '', 6, true),
  ('cc_mantenimiento_dispenser', '', 'Dispenser', 'cc_mantenimiento', '', 3, true),
  ('cc_mantenimiento_dispenser_insumos', '', 'Insumos', 'cc_mantenimiento_dispenser', '', 1, true),
  ('cc_mantenimiento_dispenser_servicios', '', 'Servicios', 'cc_mantenimiento_dispenser', '', 2, true),
  ('cc_mantenimiento_flota', '', 'Flota', 'cc_mantenimiento', '', 4, true),
  ('cc_mantenimiento_flota_insumos', '', 'Insumos', 'cc_mantenimiento_flota', 'movil', 1, true),
  ('cc_mantenimiento_flota_servicios', '', 'Servicios', 'cc_mantenimiento_flota', 'movil', 2, true),
  ('cc_produccion_y_sopladora', '', 'Producción y sopladora', null, '', 7, true),
  ('cc_produccion_y_sopladora_insumos', '', 'Insumos', 'cc_produccion_y_sopladora', '', 1, true),
  ('cc_produccion_y_sopladora_insumos_linea_1', '', 'Línea 1 · Agua retornable', 'cc_produccion_y_sopladora_insumos', '', 1, true),
  ('cc_produccion_y_sopladora_insumos_linea_2', '', 'Línea 2 · Agua descartable', 'cc_produccion_y_sopladora_insumos', '', 2, true),
  ('cc_produccion_y_sopladora_insumos_linea_3', '', 'Línea 3 · Soda descartable', 'cc_produccion_y_sopladora_insumos', '', 3, true),
  ('cc_produccion_y_sopladora_insumos_linea_4', '', 'Línea 4 · Soda retornable', 'cc_produccion_y_sopladora_insumos', '', 4, true),
  ('cc_produccion_y_sopladora_insumos_ta', '', 'TA · Tratamiento de agua', 'cc_produccion_y_sopladora_insumos', '', 5, true),
  ('cc_produccion_y_sopladora_insumos_so', '', 'SO · Sopladora', 'cc_produccion_y_sopladora_insumos', '', 6, true),
  ('cc_produccion_y_sopladora_materia_prima', '', 'Materia prima', 'cc_produccion_y_sopladora', '', 2, true),
  ('cc_produccion_y_sopladora_materia_prima_20', '20', 'Bidón 20 azul', 'cc_produccion_y_sopladora_materia_prima', '', 1, true),
  ('cc_produccion_y_sopladora_materia_prima_20v', '20V', 'Bidón 20 bajo sodio', 'cc_produccion_y_sopladora_materia_prima', '', 2, true),
  ('cc_produccion_y_sopladora_materia_prima_12', '12', 'Bidón 12', 'cc_produccion_y_sopladora_materia_prima', '', 3, true),
  ('cc_produccion_y_sopladora_materia_prima_12v', '12V', 'Bidón 12 bajo sodio', 'cc_produccion_y_sopladora_materia_prima', '', 4, true),
  ('cc_produccion_y_sopladora_materia_prima_8', '8', 'Bidón 8', 'cc_produccion_y_sopladora_materia_prima', '', 5, true),
  ('cc_produccion_y_sopladora_materia_prima_8v', '8V', 'Bidón 8 bajo sodio', 'cc_produccion_y_sopladora_materia_prima', '', 6, true),
  ('cc_produccion_y_sopladora_materia_prima_sr', 'SR', 'Soda retornable', 'cc_produccion_y_sopladora_materia_prima', '', 7, true),
  ('cc_produccion_y_sopladora_materia_prima_sd', 'SD', 'Soda descartable', 'cc_produccion_y_sopladora_materia_prima', '', 8, true),
  ('cc_sucursales', '', 'Sucursales', null, '', 8, true),
  ('cc_sucursales_insumos', '', 'Insumos', 'cc_sucursales', '', 1, true),
  ('cc_sucursales_servicios', '', 'Servicios', 'cc_sucursales', '', 2, true),
  ('cc_sueldos_y_cargas_sociales', '', 'Sueldos y cargas sociales', null, '', 9, true),
  ('cc_sueldos_y_cargas_sociales_sueldos', '', 'Sueldos', 'cc_sueldos_y_cargas_sociales', '', 1, true),
  ('cc_sueldos_y_cargas_sociales_servicios', '', 'Servicios', 'cc_sueldos_y_cargas_sociales', '', 2, true),
  ('cc_sueldos_y_cargas_sociales_cargas_sociales', '', 'Cargas sociales', 'cc_sueldos_y_cargas_sociales', '', 3, true),
  ('cc_ventas', '', 'Ventas', null, '', 10, true),
  ('cc_ventas_bienes_de_cambio', '', 'Bienes de cambio', 'cc_ventas', '', 1, true),
  ('cc_ventas_insumos', '', 'Insumos', 'cc_ventas', '', 2, true),
  ('cc_ventas_servicios', '', 'Servicios', 'cc_ventas', '', 3, true)
on conflict (id) do update set codigo = excluded.codigo, descripcion = excluded.descripcion,
  parent_id = excluded.parent_id, requiere = excluded.requiere, orden = excluded.orden;

-- Los anteriores (no "cc_") quedan inactivos
update centros_costo set activo = false where id not like 'cc\_%';

-- Control: activos del árbol nuevo / inactivos anteriores
select count(*) filter (where activo) as activos, count(*) filter (where not activo) as inactivos from centros_costo;
