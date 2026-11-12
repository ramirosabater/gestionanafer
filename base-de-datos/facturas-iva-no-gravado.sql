-- =====================================================================
-- Facturas: IVA y No gravado (además del Neto gravado y el Total)
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios). Se puede correr más
-- de una vez.
-- Las facturas de combustible (Régimen de Transparencia Fiscal) se reparten:
--   Neto gravado = "Precio sin impuestos"
--   IVA          = "IVA contenido"
--   No gravado   = ICL (imp. combustibles líquidos / imp. int.) + IDC (dióxido de carbono / tasas)
--   Total        = Neto + IVA + No gravado
-- La lectura automática las completa sola; en las demás facturas son opcionales.
-- =====================================================================
alter table facturas add column if not exists iva numeric;
alter table facturas add column if not exists no_gravado numeric;
