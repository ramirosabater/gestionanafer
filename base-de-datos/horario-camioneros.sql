-- =====================================================================
-- RR.HH. — Horario "Camioneros" con horas extras propias y descanso de 12 h
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede
-- correr de nuevo sin problema.
--
-- 1) Agrega a los horarios la columna "extras": la regla de horas extras
--    propia del horario. Vacía (null) = rige la regla general de recargos,
--    como hasta ahora; los demás horarios no cambian.
-- 2) Crea el horario "Camioneros" (si no existe):
--      Lun a vie 08:00–16:00 · extras al 50% de 16 a 21 · después de las 21
--      todas las extras desde las 16 van al 100%.
--      Sábado 08:00–12:00 · 50% de 12 a 13 · después de las 13 al 100%.
--      Domingos y feriados: todo al 100%.
--      Descanso de 12 h entre jornadas: si volvió 00:05, entra 12:05 sin
--      que cuente como llegada tarde.
--    Después se le asigna a cada chofer en RR.HH. → Empleados.
-- =====================================================================
alter table public.horarios add column if not exists extras jsonb;

insert into public.horarios (id, nombre, bloques, tolerancia_minutos, tipo, extras)
select 'camioneros', 'Camioneros',
  '[{"dias":[1,2,3,4,5],"inicio":"08:00","fin":"16:00"},{"dias":[6],"inicio":"08:00","fin":"12:00"}]'::jsonb,
  10, 'fijo',
  '{"tramos":[{"dias":[1,2,3,4,5],"hasta_50":"21:00","todo_100_si_pasa":true},{"dias":[6],"hasta_50":"13:00","todo_100_si_pasa":false}],"descanso_horas":12}'::jsonb
where not exists (select 1 from public.horarios where id = 'camioneros');

-- Control
select id, nombre, bloques, tolerancia_minutos, extras from public.horarios where id = 'camioneros';
