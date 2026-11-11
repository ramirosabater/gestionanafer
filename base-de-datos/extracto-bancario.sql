-- =====================================================================
-- Importar extractos del banco (Santander, Credicoop...) en Tesorería
-- =====================================================================
-- Correr en el SQL Editor de Supabase (base Envios). Se puede correr más
-- de una vez.
--
-- Cada línea del extracto que se importa queda marcada en el movimiento con
-- una "huella" (banco_ref). Así:
--  * si se vuelve a subir el mismo archivo, o uno de varios días que se pisa
--    con otro, las líneas que ya estaban no se cargan dos veces;
--  * si la línea del banco coincide con un movimiento que ya estaba cargado
--    (ej. el pago de una orden de pago por transferencia), no se duplica: ese
--    movimiento queda "conciliado" con el banco.
-- =====================================================================
alter table movimientos add column if not exists banco_ref text;
alter table movimientos add column if not exists banco_detalle text not null default '';
create unique index if not exists movimientos_banco_ref_idx on movimientos(cuenta_id, banco_ref) where banco_ref is not null;
