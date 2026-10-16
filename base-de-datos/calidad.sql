-- =====================================================================
-- Módulo CALIDAD (octubre 2026)
-- =====================================================================
--  calidad_reclamos  RG-0802  Control de producto reclamado (devoluciones)
--  calidad_pac       RG-0801  No conformidades y Plan de Acción Correctiva
--  calidad_listas    Listas desplegables editables (⚙ → Calidad)
-- Los registros no se borran: se anulan (anulado_en / por / motivo).
-- Se puede correr todas las veces que haga falta.
-- =====================================================================
create table if not exists calidad_reclamos (
  id text primary key,
  numero integer not null default 0,          -- Nº correlativo del año
  anio integer not null default 0,
  fecha date,
  hora text not null default '',
  producto text not null default '',
  lote text not null default '',
  vencimiento date,
  vencimiento_ilegible boolean not null default false, -- el vencimiento del envase no se lee ("borroso")
  desvio text not null default '',            -- lo que dice el reparto/cliente (Mal gusto, Otros...)
  reclamo_cliente text not null default '',   -- MG: cloro, EE: insecto...
  desvio_real text not null default '',       -- lo que se comprobó en el control
  observaciones text not null default '',
  envase text not null default '',            -- proveedor del envase
  lote_envase text not null default '',
  tapa text not null default '',              -- proveedor de la tapa
  cantidad numeric not null default 1,
  destino_envase text not null default '',
  estado text not null default 'Abierto',     -- Abierto | Cerrado justificado | Cerrado No justificado
  controlo text not null default '',
  pac_id text,                                -- NC/PAC que se abrió por este reclamo
  creado_por text not null default '',
  actualizado timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por text not null default '',
  motivo_anulacion text not null default ''
);
create index if not exists calidad_reclamos_fecha_idx on calidad_reclamos(fecha);
create index if not exists calidad_reclamos_lote_idx on calidad_reclamos(producto, lote);

create table if not exists calidad_pac (
  id text primary key,
  numero integer not null default 0,          -- nº del año: el código es "numero-aa" (ej. 12-26)
  anio integer not null default 0,
  fecha date,
  origen text not null default '',
  clasificacion text not null default '',
  proceso text not null default '',
  hallazgo text not null default '',
  riesgo text not null default '',
  opcion_riesgo text not null default '',
  causa text not null default '',
  correccion text not null default '',
  resp_correccion text not null default '',
  fecha_correccion date,
  accion text not null default '',            -- acción correctiva / de mejora
  resp_accion text not null default '',
  fecha_accion date,                          -- fecha límite de implementación de la AC
  resp_seguimiento text not null default '',
  fecha_seguimiento date,
  comentarios text not null default '',
  eficacia_criterio text not null default '', -- cómo se va a verificar
  eficacia_resultado text not null default '',-- Efectiva | No efectiva | No aplica | (vacío = pendiente)
  resp_eficacia text not null default '',
  fecha_eficacia date,
  eficacia_detalle text not null default '',
  estado text not null default 'Abierta',     -- Abierta | En gestión | Cerrada
  reclamo_ids jsonb not null default '[]'::jsonb,
  creado_por text not null default '',
  actualizado timestamptz not null default now(),
  anulado_en timestamptz,
  anulado_por text not null default '',
  motivo_anulacion text not null default ''
);
create index if not exists calidad_pac_estado_idx on calidad_pac(estado);

create table if not exists calidad_listas (
  id text primary key,                        -- productos, envases, tapas, responsables...
  valores jsonb not null default '[]'::jsonb
);

alter table calidad_reclamos enable row level security;
alter table calidad_pac      enable row level security;
alter table calidad_listas   enable row level security;
drop policy if exists "anon full access calidad_reclamos" on calidad_reclamos;
create policy "anon full access calidad_reclamos" on calidad_reclamos for all using (true) with check (true);
drop policy if exists "anon full access calidad_pac" on calidad_pac;
create policy "anon full access calidad_pac" on calidad_pac for all using (true) with check (true);
drop policy if exists "anon full access calidad_listas" on calidad_listas;
create policy "anon full access calidad_listas" on calidad_listas for all using (true) with check (true);
grant select, insert, update, delete on calidad_reclamos, calidad_pac, calidad_listas to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='calidad_reclamos') then
      alter publication supabase_realtime add table calidad_reclamos;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='calidad_pac') then
      alter publication supabase_realtime add table calidad_pac;
    end if;
  end if;
end $$;
