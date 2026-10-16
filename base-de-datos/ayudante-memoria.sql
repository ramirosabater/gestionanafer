-- =====================================================================
-- Memoria del ayudante (Sifoncito sugiere)
-- =====================================================================
-- Guarda lo que cada usuario le contestó al ayudante: "No me lo preguntes
-- más" (decision = 'nunca'), "Ahora no" ('pospuesta' hasta una fecha) y lo
-- que aceptó ('aceptada', con la fecha desde la que puede volver a ofrecer).
-- Una fila por usuario y por tema (clave), ej. 'repetir:trips:ruta-x',
-- 'monto:<proveedor>', 'faltantes', 'pago:<proveedor>'.
-- Sin esta tabla el ayudante funciona igual, pero recuerda solo en cada
-- navegador. Se puede correr todas las veces que haga falta.
-- =====================================================================
create table if not exists ayudante_memoria (
  id text primary key,                 -- usuario|clave
  usuario text not null default '',
  clave text not null default '',
  decision text not null default '',   -- 'nunca' | 'pospuesta' | 'aceptada'
  hasta date,
  actualizado timestamptz not null default now()
);
create index if not exists ayudante_memoria_usuario_idx on ayudante_memoria(usuario);
alter table ayudante_memoria enable row level security;
drop policy if exists "anon full access ayudante_memoria" on ayudante_memoria;
create policy "anon full access ayudante_memoria" on ayudante_memoria for all using (true) with check (true);
grant select, insert, update, delete on ayudante_memoria to authenticated;
