-- =====================================================================
-- Seguimiento de compras: solicitudes de compra y recepciones
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede correr
-- de nuevo sin problema. También está al final de schema.sql.
--
-- El circuito (reemplaza la planilla RG-0708 "Seguimiento de solicitud de
-- compras"):
--   1. El jefe de cada sector carga la SOLICITUD con su usuario de Gestión
--      (Administración → Solicitudes): qué necesita, cuánto y para cuándo.
--   2. Compras la toma: la pone "Cotizando", elige el proveedor de cada ítem
--      y genera la ORDEN DE COMPRA (una por proveedor) desde la solicitud.
--   3. Cuando llega la mercadería, Compras registra la RECEPCIÓN de la orden:
--      remito, lo que llegó de cada ítem (total o parcial) y si vino conforme
--      o con diferencias.
--   4. La factura se asocia a la orden de compra (como hasta ahora). Con eso
--      el tablero "Seguimiento" cruza pedido / recibido / facturado.
--
-- Permisos: pestaña nueva "Solicitudes de compra" (⚙ → Acceso). Quien no la
-- tiene configurada usa el permiso de Compras; a los jefes de sector se les
-- da "Editar" en Solicitudes y "Oculta" en el resto.
-- =====================================================================

create table if not exists solicitudes_compra (
  id               text primary key,
  numero           integer not null,
  fecha            date not null default current_date,
  sector           text not null default '',
  solicitante      text not null default '',      -- email de quien la cargó
  necesaria_para   date,
  urgente          boolean not null default false,
  motivo           text not null default '',      -- para qué / observaciones del sector
  -- [{id, descripcion, articulo_id, cantidad, unidad, proveedor_id, precio, oc_id, cancelado}]
  items            jsonb not null default '[]'::jsonb,
  estado           text not null default 'pendiente',  -- pendiente | cotizando | rechazada (lo demás se calcula)
  notas_compras    text not null default '',
  gestiona         text not null default '',      -- quién de Compras la tomó
  creado           timestamptz not null default now(),
  actualizado      timestamptz not null default now(),
  anulado_en       timestamptz,
  anulado_por      text not null default '',
  motivo_anulacion text not null default ''
);
create unique index if not exists solicitudes_compra_numero_uq on solicitudes_compra (numero);
create index if not exists solicitudes_compra_fecha_idx on solicitudes_compra (fecha desc);

create table if not exists recepciones (
  id               text primary key,
  numero           integer not null,
  fecha            date not null default current_date,
  oc_id            text references ordenes_compra(id),
  proveedor_id     text,
  remito           text not null default '',
  -- [{item_id, solicitud_id, descripcion, unidad, pedido, recibido, nota}]
  items            jsonb not null default '[]'::jsonb,
  con_diferencias  boolean not null default false,
  cierra           boolean not null default false,  -- "no llega más": da la orden por completa
  observaciones    text not null default '',
  recibido_por     text not null default '',
  archivos         jsonb not null default '[]'::jsonb,
  creado           timestamptz not null default now(),
  anulado_en       timestamptz,
  anulado_por      text not null default '',
  motivo_anulacion text not null default ''
);
create unique index if not exists recepciones_numero_uq on recepciones (numero);
create index if not exists recepciones_oc_idx on recepciones (oc_id);

-- La orden de compra guarda qué ítems de qué solicitud compra y cuándo llega
alter table ordenes_compra add column if not exists items jsonb not null default '[]'::jsonb;  -- [{item_id, solicitud_id, descripcion, cantidad, unidad, precio}]
alter table ordenes_compra add column if not exists entrega_prevista date;

-- Seguridad: ven Solicitudes, Compras, Pagos y Dashboards; cargan Solicitudes y Compras.
-- Las recepciones las carga solo Compras.
alter table solicitudes_compra enable row level security;
alter table recepciones enable row level security;
drop policy if exists "seg: ver" on solicitudes_compra;
drop policy if exists "seg: crear" on solicitudes_compra;
drop policy if exists "seg: cambiar" on solicitudes_compra;
drop policy if exists "seg: borrar" on solicitudes_compra;
create policy "seg: ver" on solicitudes_compra for select to authenticated using ((select public.puede_ver(array['solicitudes','compras','pagos','tableros'])));
create policy "seg: crear" on solicitudes_compra for insert to authenticated with check ((select public.puede_editar(array['solicitudes','compras'])));
create policy "seg: cambiar" on solicitudes_compra for update to authenticated using ((select public.puede_editar(array['solicitudes','compras']))) with check ((select public.puede_editar(array['solicitudes','compras'])));
drop policy if exists "seg: ver" on recepciones;
drop policy if exists "seg: crear" on recepciones;
drop policy if exists "seg: cambiar" on recepciones;
drop policy if exists "seg: borrar" on recepciones;
create policy "seg: ver" on recepciones for select to authenticated using ((select public.puede_ver(array['solicitudes','compras','pagos','tableros'])));
create policy "seg: crear" on recepciones for insert to authenticated with check ((select public.puede_editar(array['compras'])));
create policy "seg: cambiar" on recepciones for update to authenticated using ((select public.puede_editar(array['compras']))) with check ((select public.puede_editar(array['compras'])));
-- (no se borran: se anulan con motivo)
grant select, insert, update on solicitudes_compra, recepciones to authenticated;

-- Que la pantalla se actualice sola cuando otro carga algo
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'solicitudes_compra') then
      alter publication supabase_realtime add table solicitudes_compra;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'recepciones') then
      alter publication supabase_realtime add table recepciones;
    end if;
  end if;
end $$;

-- Control
select (select count(*) from solicitudes_compra) as solicitudes,
       (select count(*) from recepciones)        as recepciones;
