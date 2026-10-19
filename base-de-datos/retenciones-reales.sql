-- =====================================================================
-- Retenciones: dejar SOLO las que usa Anafer (pedido de Administración)
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede
-- correr de nuevo sin problema.
--
-- Quedan estos regímenes (RG 830, Anexo VIII · valores de la RG 5423):
--   30  Alquileres o arrendamientos de bienes muebles .... (neto − 11.200) × 6%  | no insc. 25% / 28% PH
--   31  Alquileres de inmuebles urbanos (leasing, suburb.) (neto − 11.200) × 6%  | no insc. 25% / 28% PH
--   78  Enajenación de bienes muebles y bienes de cambio . (neto − 224.000) × 2% | no insc. 10%
--   94  Locaciones de obra y/o servicios ................. (neto − 67.170) × 2%  | no insc. 25% / 28% PH
--   116 Honorarios de director, síndico, socio gerente ... (neto − 67.170) por la 1ª escala | no insc. 28%
--   95  Transporte de carga nacional e internacional ..... (neto − 67.170) × 0,25% | no insc. 25% / 28% PH
--   119 Profesiones liberales y oficios .................. (neto − 160.000) por la 2ª escala | no insc. 28%
--   900 Distribución de dividendos ....................... 7% (código provisorio)
--   901 Facturas M ....................................... Ganancias (neto − 67.170) × 0,25%
--                                                          + retención de IVA 21% del neto (código provisorio)
-- Los montos no sujetos son mensuales (se acumulan los pagos del mes al mismo
-- proveedor por el mismo régimen). Retención mínima $240 (alquileres de
-- inmuebles a no inscriptos $1.020); dividendos sin mínimo.
--
-- Los demás regímenes se BORRAN. Los que ya se usaron en alguna factura,
-- proveedor u orden de pago no se pueden borrar sin perder ese dato: esos
-- quedan desactivados (no aparecen para elegir) y se listan al final para
-- reasignar el régimen a esos proveedores / facturas pendientes.
-- =====================================================================

-- Factura M: % de IVA a retener además de Ganancias
alter table gan_regimenes add column if not exists iva_pct numeric;

insert into gan_regimenes (codigo, descripcion, alic_insc, escala, alic_no_insc, alic_no_insc_ph, mnsr, mnsr_no_insc, min_insc, min_no_insc, iva_pct, activo, orden) values
  (30,  'Alquileres o arrendamientos de bienes muebles', 6, null, 25, 28, 11200, false, 240, 240, null, true, 1),
  (31,  'Alquileres de inmuebles urbanos (incluye leasing y suburbanos)', 6, null, 25, 28, 11200, false, 240, 1020, null, true, 2),
  (78,  'Enajenación de bienes muebles y bienes de cambio', 2, null, 10, null, 224000, false, 240, 240, null, true, 3),
  (94,  'Locaciones de obra y/o servicios no ejecutados en relación de dependencia', 2, null, 25, 28, 67170, false, 240, 240, null, true, 4),
  (116, 'Honorarios de director de S.A., síndico, fiduciario, consejero de cooperativas, consejo de vigilancia y socios administradores', null, 'general', 28, null, 67170, false, 240, 240, null, true, 5),
  (95,  'Operaciones de transporte de carga nacional e internacional', 0.25, null, 25, 28, 67170, false, 240, 240, null, true, 6),
  (119, 'Profesiones liberales y oficios', null, '119', 28, null, 160000, false, 240, 240, null, true, 7),
  (900, 'Distribución de dividendos', 7, null, 7, null, 0, false, 0, 0, null, true, 8),
  (901, 'Facturas M (Ganancias + IVA)', 0.25, null, 0.25, null, 67170, false, 240, 240, 21, true, 9)
on conflict (codigo) do update set
  descripcion = excluded.descripcion, alic_insc = excluded.alic_insc, escala = excluded.escala,
  alic_no_insc = excluded.alic_no_insc, alic_no_insc_ph = excluded.alic_no_insc_ph, mnsr = excluded.mnsr,
  mnsr_no_insc = excluded.mnsr_no_insc, min_insc = excluded.min_insc, min_no_insc = excluded.min_no_insc,
  iva_pct = excluded.iva_pct, activo = true, orden = excluded.orden;

-- Escalas (1ª: general, para el 116 · 2ª: la del 119), tal cual el Anexo VIII
insert into gan_escalas (escala, desde, hasta, fijo, pct) values
  ('general', 0, 8000, 0, 5), ('general', 8000, 16000, 400, 9), ('general', 16000, 24000, 1120, 12),
  ('general', 24000, 32000, 2080, 15), ('general', 32000, 48000, 3280, 19), ('general', 48000, 64000, 6320, 23),
  ('general', 64000, 96000, 10000, 27), ('general', 96000, null, 18640, 31),
  ('119', 0, 71000, 0, 5), ('119', 71000, 142000, 3550, 9), ('119', 142000, 213000, 9940, 12),
  ('119', 213000, 284000, 18460, 15), ('119', 284000, 426000, 29110, 19), ('119', 426000, 568000, 56090, 23),
  ('119', 568000, 852000, 88750, 27), ('119', 852000, null, 165430, 31)
on conflict (escala, desde) do update set hasta = excluded.hasta, fijo = excluded.fijo, pct = excluded.pct;

-- Los que no se usan: se borran; los que ya figuran en algo, se desactivan.
update gan_regimenes set activo = false where codigo not in (30, 31, 78, 94, 116, 95, 119, 900, 901);
delete from gan_regimenes g
where g.codigo not in (30, 31, 78, 94, 116, 95, 119, 900, 901)
  and not exists (select 1 from facturas f where f.regimen_gan = g.codigo)
  and not exists (select 1 from proveedores p where p.gan_regimen = g.codigo)
  and not exists (select 1 from ordenes_pago o, jsonb_array_elements(coalesce(o.retenciones, '[]'::jsonb)) e
                  where (e->>'regimen') = g.codigo::text);

-- Control 1: regímenes que quedaron
select codigo, descripcion, activo from gan_regimenes order by activo desc, orden, codigo;

-- Control 2: proveedores y facturas PENDIENTES con un régimen que ya no se usa
-- (conviene cambiarles el régimen en Gestión)
select 'proveedor' as que, p.nombre as detalle, p.gan_regimen as regimen
  from proveedores p where p.gan_regimen is not null and p.gan_regimen not in (30, 31, 78, 94, 116, 95, 119, 900, 901)
union all
select 'factura pendiente', f.numero, f.regimen_gan
  from facturas f where f.estado = 'pendiente' and f.regimen_gan is not null and f.regimen_gan not in (0, 30, 31, 78, 94, 116, 95, 119, 900, 901);
