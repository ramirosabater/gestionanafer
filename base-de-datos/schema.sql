-- ============================================================
-- Hoja de Ruta — esquema de base de datos para Supabase
-- Pegá todo este archivo en Supabase > SQL Editor > New query
-- y hacé click en "Run". Es seguro volver a correrlo las veces
-- que haga falta (no borra ni duplica lo que ya cargaste).
-- ============================================================

create table if not exists routes (
  id text primary key,
  label text not null,
  sort_order int not null default 99,
  active boolean not null default true
);

-- scope: dónde puede aparecer este camión para asignar — 'both' (default,
-- FlotaPesada y Sucursales), 'flota' (solo FlotaPesada) o 'sucursales'
-- (solo Sucursales, ej. un camión chico que solo hace entregas a sucursal).
create table if not exists trucks (
  id text primary key,
  label text not null,
  active boolean not null default true,
  driver text not null default '',   -- chofer HABITUAL (solo una sugerencia por defecto)
  helper text not null default '',   -- ayudante HABITUAL (solo una sugerencia por defecto)
  scope text not null default 'both'
);
-- Ficha del móvil (planilla de flota) y alcance 'gastos' = no hace viajes,
-- solo se le imputan gastos (autoelevadores, utilitarios, acoplado).
alter table trucks add column if not exists patente text not null default '';
alter table trucks add column if not exists modelo  text not null default '';
alter table trucks add column if not exists anio    text not null default '';
alter table trucks add column if not exists funcion text not null default '';
alter table trucks add column if not exists flota   text not null default '';

-- scope: dónde puede aparecer esta persona para asignar — 'both' (default,
-- FlotaPesada y Sucursales), 'flota' (solo FlotaPesada) o 'sucursales'
-- (solo Sucursales). Se elige por persona desde ⚙ → Choferes / Ayudantes.
create table if not exists drivers (
  id text primary key,
  name text not null,
  active boolean not null default true,
  scope text not null default 'both'
);

create table if not exists helpers (
  id text primary key,
  name text not null,
  active boolean not null default true,
  scope text not null default 'both'
);

create table if not exists cargo_types (
  id text primary key,
  name text not null,
  active boolean not null default true,
  sort_order int not null default 99
);

create table if not exists trips (
  id text primary key,              -- formato: "YYYY-MM-DD_RUTAID"; si dos camiones hacen la misma ruta el mismo día, el segundo (y siguientes) usan "YYYY-MM-DD_RUTAID_2", "_3", etc.
  date date not null,
  route_id text not null references routes(id),
  truck text references trucks(id),
  driver text default '',           -- chofer REAL de ese viaje puntual (nombre, no id)
  helper text default '',           -- ayudante REAL de ese viaje puntual (nombre, no id)
  note text default '',
  status text default 'actual',     -- 'actual' | reservado a futuro
  updated_by text,
  updated_at timestamptz default now(),
  source text default 'manual',     -- 'manual' | 'auto' | 'import'
  cargo jsonb not null default '[]'::jsonb  -- [{type:'s1500', qty:10, unit:'pallets'}, ...]
);

-- Sucursales: catálogo propio de puntos de entrega (KM5, Kennedy, etc.),
-- separado de las rutas de camiones de FlotaPesada.
create table if not exists branches (
  id text primary key,
  label text not null,
  sort_order int not null default 99,
  active boolean not null default true
);

-- Envíos a sucursales: un registro por día y por sucursal (destino de
-- entrega, no un viaje de reparto — pero igual puede tener camión, chofer y
-- ayudante asignados, como referencia de quién hizo esa entrega).
-- Comparte el mismo catálogo de tipos de carga que trips.cargo.
create table if not exists visits (
  id text primary key,              -- formato: "YYYY-MM-DD_SUCURSALID"; si hay dos envíos distintos a la misma sucursal el mismo día, el segundo (y siguientes) usan "YYYY-MM-DD_SUCURSALID_2", "_3", etc.
  date date not null,
  branch_id text not null references branches(id),
  truck text references trucks(id),
  driver text default '',           -- chofer que hizo esta entrega (nombre, no id)
  helper text default '',           -- ayudante que hizo esta entrega (nombre, no id)
  helper2 text default '',          -- subayudante (opcional, para viajes con 3 personas)
  note text default '',
  status text default 'actual',
  updated_by text,
  updated_at timestamptz default now(),
  source text default 'manual',     -- 'manual' | 'import' (histórico importado del Excel)
  cargo jsonb not null default '[]'::jsonb  -- [{type:'s1500', qty:10}, ...]
);

-- Empresas: hoja nueva, estructuralmente idéntica a Sucursales (branches +
-- visits) pero con su propio catálogo independiente de destinos — se agregan
-- desde ⚙ → Empresas y arrancan vacías (sin datos precargados).
create table if not exists companies (
  id text primary key,
  label text not null,
  sort_order int not null default 99,
  active boolean not null default true
);

create table if not exists company_visits (
  id text primary key,              -- formato: "YYYY-MM-DD_EMPRESAID"; segundo envío el mismo día usa "_2", "_3", etc.
  date date not null,
  company_id text not null references companies(id),
  truck text references trucks(id),
  driver text default '',
  helper text default '',
  helper2 text default '',          -- subayudante (opcional, para viajes con 3 personas)
  note text default '',
  status text default 'actual',
  updated_by text,
  updated_at timestamptz default now(),
  source text default 'manual',
  cargo jsonb not null default '[]'::jsonb
);

-- Eventuales: misma idea que Empresas, con su propio catálogo independiente
-- (no comparte lista con Sucursales ni con Empresas).
create table if not exists occasionals (
  id text primary key,
  label text not null,
  sort_order int not null default 99,
  active boolean not null default true
);

create table if not exists occasional_visits (
  id text primary key,              -- formato: "YYYY-MM-DD_EVENTUALID"; segundo envío el mismo día usa "_2", "_3", etc.
  date date not null,
  occasional_id text not null references occasionals(id),
  truck text references trucks(id),
  driver text default '',
  helper text default '',
  helper2 text default '',          -- subayudante (opcional, para viajes con 3 personas)
  note text default '',
  status text default 'actual',
  updated_by text,
  updated_at timestamptz default now(),
  source text default 'manual',
  cargo jsonb not null default '[]'::jsonb
);

create index if not exists company_visits_date_idx on company_visits(date);
create index if not exists occasional_visits_date_idx on occasional_visits(date);

-- Login por perfiles: una fila única (id='auth') con la lista de perfiles en
-- la columna roles (jsonb) — cada perfil tiene su propia contraseña y sus
-- propios permisos por pestaña ('oculta'/'ver'/'editar'), más un flag
-- manageAccess para poder administrar los perfiles desde ⚙ → Acceso. No es
-- un sistema de cuentas por persona; es solo una puerta de entrada simple,
-- editable desde la app. admin_password/viewer_password quedan solo para
-- migrar instalaciones viejas (2 contraseñas fijas) — la app los lee una vez
-- y los reemplaza por roles.
create table if not exists app_config (
  id text primary key,
  admin_password text not null default 'admin',
  viewer_password text not null default 'lectura',
  roles jsonb
);
alter table app_config add column if not exists roles jsonb;

-- Compras: primer módulo de Compras/Órdenes de pago/Tesorería — por ahora
-- solo Proveedores y Órdenes de compra. Las órdenes son independientes (no
-- se vinculan a sucursales/empresas/eventuales/camiones) y llevan
-- descripción libre + monto total (sin desglose de ítems).
create table if not exists proveedores (
  id text primary key,
  nombre text not null,
  cuit text default '',
  rubro text default '',
  contacto text default '',
  telefono text default '',
  email text default '',
  direccion text default '',
  banco text default '',
  cbu text default '',
  notas text default '',
  archivos jsonb default '[]'::jsonb  -- adjuntos: [{name, path, url, contentType, sizeBytes}, ...]
);
alter table proveedores add column if not exists archivos jsonb default '[]'::jsonb;

-- Imputaciones contables por proveedor (octubre 2026): un proveedor puede
-- tener varias combinaciones Centro de costo + Concepto (ej. una estación de
-- servicio que factura combustible para Logística y lavado para
-- Mantenimiento vehículos). Se guardan como lista JSON:
--   [{"centro_costo_id": "...", "concepto_id": "..."}, ...]
-- Al cargar una factura, la app propone la combinación que más se usó en
-- las facturas de ese proveedor (si todavía no tiene facturas, la primera
-- de la lista = la "principal"), y se puede cambiar a mano.
-- También se suman datos que vienen del sistema anterior (código de
-- cuenta, nombre de fantasía, localidad, provincia, condición de IVA y de
-- pago). Seguro de volver a correr.
alter table proveedores add column if not exists codigo text default '';
alter table proveedores add column if not exists nombre_fantasia text default '';
alter table proveedores add column if not exists localidad text default '';
alter table proveedores add column if not exists provincia text default '';
alter table proveedores add column if not exists condicion_iva text default '';
alter table proveedores add column if not exists condicion_pago text default '';
alter table proveedores add column if not exists imputaciones jsonb default '[]'::jsonb;
create index if not exists proveedores_codigo_idx on proveedores(codigo);

create table if not exists ordenes_compra (
  id text primary key,
  numero int not null,
  proveedor_id text references proveedores(id),
  fecha date,
  descripcion text default '',
  monto numeric not null default 0,
  estado text not null default 'pendiente',  -- 'pendiente' | 'aprobada' | 'recibida'
  notas text default '',
  who text default '',
  updated_at timestamptz default now()
);

create index if not exists ordenes_compra_numero_idx on ordenes_compra(numero);
create index if not exists ordenes_compra_estado_idx on ordenes_compra(estado);

-- Centros de costo y Conceptos: listas fijas (se administran desde Compras,
-- junto a Proveedores) para clasificar cada factura y poder separar los
-- gastos por centro de costo/concepto en el dashboard.
create table if not exists centros_costo (
  id text primary key,
  codigo text not null default '',
  descripcion text not null default ''
);

create table if not exists conceptos (
  id text primary key,
  nombre text not null default ''
);

-- Rubros de proveedor (octubre 2026): lista administrable desde ⚙ → Compras
-- → Rubros. El proveedor guarda el NOMBRE del rubro en proveedores.rubro
-- (texto), así que al renombrar un rubro la app actualiza también a los
-- proveedores que lo tenían.
create table if not exists rubros (
  id text primary key,
  nombre text not null default ''
);
insert into rubros (id, nombre) values
  ('alquileres', 'Alquileres'),
  ('bienes', 'Bienes'),
  ('honorarios', 'Honorarios'),
  ('locacion_de_servicios', 'Locación de servicios'),
  ('transporte_de_carga', 'Transporte de carga')
on conflict (id) do nothing;

-- Facturas y Órdenes de pago: facturas de proveedor (con o sin orden de
-- compra asociada — la mayoría no tiene una) y órdenes de pago que agrupan
-- una o más facturas pendientes de un mismo proveedor.
create table if not exists facturas (
  id text primary key,
  proveedor_id text references proveedores(id),
  oc_id text references ordenes_compra(id),
  centro_costo_id text references centros_costo(id),
  concepto_id text references conceptos(id),
  numero text default '',
  fecha date,
  monto numeric not null default 0,
  estado text not null default 'pendiente',  -- 'pendiente' | 'pagada'
  notas text default '',
  archivos jsonb default '[]'::jsonb  -- adjuntos: [{name, path, url, contentType, sizeBytes}, ...]
);
alter table facturas add column if not exists archivos jsonb default '[]'::jsonb;
alter table facturas add column if not exists centro_costo_id text references centros_costo(id);
alter table facturas add column if not exists concepto_id text references conceptos(id);
-- Factura repartida en varias imputaciones (octubre 2026): cuando una misma
-- factura tiene ítems que van a distintos centros de costo/conceptos, se
-- guardan las líneas acá:
--   [{"centro_costo_id": "...", "concepto_id": "...", "monto": 123.45, "detalle": "..."}, ...]
-- Vacío (o una sola línea) = factura con una sola imputación, la de las
-- columnas centro_costo_id/concepto_id de siempre. Cuando hay varias líneas,
-- esas columnas quedan con la línea de mayor monto (para filtros simples) y
-- el Dashboard reparte el gasto según las líneas.
alter table facturas add column if not exists items jsonb default '[]'::jsonb;

create index if not exists facturas_proveedor_idx on facturas(proveedor_id);
create index if not exists facturas_estado_idx on facturas(estado);
create index if not exists facturas_centro_costo_idx on facturas(centro_costo_id);
create index if not exists facturas_concepto_idx on facturas(concepto_id);

create table if not exists ordenes_pago (
  id text primary key,
  numero int not null,
  proveedor_id text references proveedores(id),
  factura_ids jsonb not null default '[]'::jsonb,
  fecha date,
  monto numeric not null default 0,
  medio_pago text not null default 'transferencia',
  estado text not null default 'pendiente',  -- 'pendiente' | 'pagada'
  notas text default '',
  who text default '',
  updated_at timestamptz default now()
);

create index if not exists ordenes_pago_numero_idx on ordenes_pago(numero);
create index if not exists ordenes_pago_estado_idx on ordenes_pago(estado);

-- Tesorería: cuentas de caja/banco y sus movimientos. Por ahora solo
-- egresos (pagos a proveedores, incluido el egreso automático que se genera
-- al marcar una orden de pago como Pagada, y egresos manuales como sueldos
-- o impuestos). El saldo de cada cuenta se calcula como saldo inicial menos
-- la suma de sus movimientos (se hace en la app, no en la base).
create table if not exists cuentas (
  id text primary key,
  nombre text not null,
  tipo text not null default 'caja',  -- 'caja' | 'banco'
  saldo_inicial numeric not null default 0,
  notas text default ''
);

create table if not exists movimientos (
  id text primary key,
  cuenta_id text references cuentas(id),
  fecha date,
  concepto text default '',
  monto numeric not null default 0,
  -- Si viene de una orden de pago (egreso automático al marcarla Pagada),
  -- pago_id queda seteado y ese movimiento no se edita/borra a mano.
  pago_id text references ordenes_pago(id),
  notas text default ''
);

-- Conceptos de caja y cartera de cheques (octubre 2026) -----------------
-- Conceptos de caja (los códigos del sistema anterior: CHE, TR1, EF2...):
-- cada uno tiene su cuenta por defecto y un modo de cheque:
--   'no'      = sin datos de cheque (transferencias, efectivo, tarjetas...)
--   'cartera' = cheque de terceros: al entrar queda en la cartera, y después
--               se deposita, se entrega a un proveedor o se rechaza
--   'datos'   = pide los datos del cheque/echeq pero no va a cartera
--               (ej. echeq propio que se emite para pagar)
create table if not exists medios_caja (
  id text primary key,
  codigo text not null default '',
  nombre text not null default '',
  cuenta_id text references cuentas(id) on delete set null,
  cheque text not null default 'no',
  activo boolean not null default true
);

-- Cheques (de terceros en cartera, y los que se registran con datos).
-- estado: 'cartera' | 'depositado' | 'entregado' | 'rechazado'
--         | 'recibido' (modo datos, entrada) | 'emitido' (modo datos, salida)
create table if not exists cheques (
  id text primary key,
  medio_id text,
  banco text default '',
  sucursal text default '',
  localidad text default '',
  numero text default '',
  nro_cuenta text default '',
  titular text default '',
  fecha_cobro date,          -- fecha del cheque (diferido: desde cuándo se puede cobrar)
  importe numeric not null default 0,
  estado text not null default 'cartera',
  fecha_ingreso date,
  cuenta_id text,            -- cuenta donde está ahora (la de cartera al entrar; el banco si se depositó)
  mov_ingreso_id text,       -- movimiento de entrada que lo trajo
  fecha_salida date,
  destino text default '',   -- texto: "Depositado en ...", "Entregado a ..."
  pago_id text,              -- orden de pago en la que se entregó
  proveedor_id text,
  mov_salida_id text,        -- movimiento de salida (entrega manual)
  notas text default ''
);
create index if not exists cheques_estado_idx on cheques(estado);

-- Movimientos: ahora pueden ser entradas (DEBE) o salidas (HABER), con su
-- concepto de caja y los cheques involucrados. Los que ya existían quedan
-- como salidas ('egreso'), que es lo único que había.
alter table movimientos add column if not exists tipo text not null default 'egreso';  -- 'egreso' | 'ingreso'
alter table movimientos add column if not exists medio_id text;
alter table movimientos add column if not exists cheque_ids jsonb default '[]'::jsonb;

-- Órdenes de pago: concepto de caja con el que se paga y, si son cheques de
-- cartera, cuáles se entregaron.
alter table ordenes_pago add column if not exists medio_id text;
alter table ordenes_pago add column if not exists cheque_ids jsonb default '[]'::jsonb;

-- Cuenta de la cartera de cheques + los 11 conceptos del sistema anterior.
-- Las cuentas de cada concepto (bancos, caja de gerencia) se completan desde
-- ⚙ → Tesorería → Conceptos de caja. Seguro de volver a correr: no pisa
-- lo que ya se haya configurado.
insert into cuentas (id, nombre, tipo, saldo_inicial, notas) values
  ('cartera_cheques', 'Cheques en cartera', 'cartera', 0, 'Cheques de terceros recibidos y todavía no depositados ni entregados')
on conflict (id) do nothing;
insert into medios_caja (id, codigo, nombre, cuenta_id, cheque) values
  ('can', 'CAN', 'Compensación',          null, 'no'),
  ('ecs', 'ECS', 'Echeq Santander',       null, 'datos'),
  ('ef2', 'EF2', 'Efectivo de gerencia',  null, 'no'),
  ('che', 'CHE', 'Cheque de terceros',    'cartera_cheques', 'cartera'),
  ('tr1', 'TR1', 'Transf. Bco Chubut',    null, 'no'),
  ('tr2', 'TR2', 'Transf. Bco Santander', null, 'no'),
  ('tr3', 'TR3', 'Transf. Bco Credicoop', null, 'no'),
  ('cca', 'CCA', 'Credicoop Cabal',       null, 'no'),
  ('cvi', 'CVI', 'Credicoop Visa',        null, 'no'),
  ('svi', 'SVI', 'Santander Visa',        null, 'no'),
  ('do1', 'DO1', 'Salida sin concepto',   null, 'no')
on conflict (id) do nothing;

create index if not exists movimientos_cuenta_idx on movimientos(cuenta_id);
create index if not exists movimientos_pago_idx on movimientos(pago_id);

-- Si ya habías corrido una versión anterior de este archivo, estas líneas
-- agregan las columnas que falten sin tocar lo que ya tenías cargado. Son
-- seguras de correr aunque las tablas ya tengan las columnas.
alter table trucks add column if not exists driver text not null default '';
alter table trucks add column if not exists helper text not null default '';
alter table trips  add column if not exists driver text default '';
alter table trips  add column if not exists helper text default '';
alter table trips  add column if not exists cargo jsonb not null default '[]'::jsonb;
alter table visits add column if not exists driver text default '';
alter table visits add column if not exists helper text default '';
alter table drivers add column if not exists scope text not null default 'both';
alter table helpers add column if not exists scope text not null default 'both';
alter table trucks add column if not exists scope text not null default 'both';
alter table visits add column if not exists truck text references trucks(id);
alter table ordenes_pago add column if not exists cuenta_id text references cuentas(id);
-- Subayudante (segundo ayudante, opcional, para viajes con 3 personas) —
-- Sucursales, Empresas y Eventuales; FlotaPesada (trips) no lo usa.
alter table visits            add column if not exists helper2 text default '';
alter table company_visits    add column if not exists helper2 text default '';
alter table occasional_visits add column if not exists helper2 text default '';

create index if not exists trips_date_idx on trips(date);
create index if not exists visits_date_idx on visits(date);

-- ------------------------------------------------------------
-- Seguridad: esta es una herramienta interna sin login propio,
-- así que cualquiera que tenga la URL del sitio y la anon key
-- puede leer y escribir. Habilitamos RLS igual (buena práctica)
-- y le damos permiso total a la clave pública "anon".
-- Si más adelante querés pedir usuario/contraseña, avisame y
-- lo agregamos con Supabase Auth.
-- ------------------------------------------------------------
alter table routes      enable row level security;
alter table trucks      enable row level security;
alter table drivers     enable row level security;
alter table helpers     enable row level security;
alter table cargo_types enable row level security;
alter table trips       enable row level security;
alter table branches    enable row level security;
alter table visits      enable row level security;
alter table companies         enable row level security;
alter table company_visits    enable row level security;
alter table occasionals       enable row level security;
alter table occasional_visits enable row level security;
alter table app_config  enable row level security;
alter table proveedores      enable row level security;
alter table ordenes_compra   enable row level security;
alter table centros_costo    enable row level security;
alter table conceptos        enable row level security;
alter table rubros           enable row level security;
alter table facturas         enable row level security;
alter table ordenes_pago     enable row level security;
alter table cuentas          enable row level security;
alter table movimientos      enable row level security;
alter table medios_caja      enable row level security;
alter table cheques          enable row level security;

-- drop+create en vez de "create policy" a secas: así este archivo se puede
-- volver a correr todas las veces que haga falta sin que tire error por
-- políticas que ya existen.
drop policy if exists "anon full access routes" on routes;
create policy "anon full access routes" on routes
  for all using (true) with check (true);
drop policy if exists "anon full access trucks" on trucks;
create policy "anon full access trucks" on trucks
  for all using (true) with check (true);
drop policy if exists "anon full access drivers" on drivers;
create policy "anon full access drivers" on drivers
  for all using (true) with check (true);
drop policy if exists "anon full access helpers" on helpers;
create policy "anon full access helpers" on helpers
  for all using (true) with check (true);
drop policy if exists "anon full access cargo_types" on cargo_types;
create policy "anon full access cargo_types" on cargo_types
  for all using (true) with check (true);
drop policy if exists "anon full access trips" on trips;
create policy "anon full access trips" on trips
  for all using (true) with check (true);
drop policy if exists "anon full access branches" on branches;
create policy "anon full access branches" on branches
  for all using (true) with check (true);
drop policy if exists "anon full access visits" on visits;
create policy "anon full access visits" on visits
  for all using (true) with check (true);
drop policy if exists "anon full access companies" on companies;
create policy "anon full access companies" on companies
  for all using (true) with check (true);
drop policy if exists "anon full access company_visits" on company_visits;
create policy "anon full access company_visits" on company_visits
  for all using (true) with check (true);
drop policy if exists "anon full access occasionals" on occasionals;
create policy "anon full access occasionals" on occasionals
  for all using (true) with check (true);
drop policy if exists "anon full access occasional_visits" on occasional_visits;
create policy "anon full access occasional_visits" on occasional_visits
  for all using (true) with check (true);
drop policy if exists "anon full access app_config" on app_config;
create policy "anon full access app_config" on app_config
  for all using (true) with check (true);
drop policy if exists "anon full access proveedores" on proveedores;
create policy "anon full access proveedores" on proveedores
  for all using (true) with check (true);
drop policy if exists "anon full access ordenes_compra" on ordenes_compra;
create policy "anon full access ordenes_compra" on ordenes_compra
  for all using (true) with check (true);
drop policy if exists "anon full access centros_costo" on centros_costo;
create policy "anon full access centros_costo" on centros_costo
  for all using (true) with check (true);
drop policy if exists "anon full access conceptos" on conceptos;
create policy "anon full access conceptos" on conceptos
  for all using (true) with check (true);
drop policy if exists "anon full access rubros" on rubros;
create policy "anon full access rubros" on rubros
  for all using (true) with check (true);
drop policy if exists "anon full access facturas" on facturas;
create policy "anon full access facturas" on facturas
  for all using (true) with check (true);
drop policy if exists "anon full access ordenes_pago" on ordenes_pago;
create policy "anon full access ordenes_pago" on ordenes_pago
  for all using (true) with check (true);
drop policy if exists "anon full access cuentas" on cuentas;
create policy "anon full access cuentas" on cuentas
  for all using (true) with check (true);
drop policy if exists "anon full access movimientos" on movimientos;
create policy "anon full access movimientos" on movimientos
  for all using (true) with check (true);
drop policy if exists "anon full access medios_caja" on medios_caja;
create policy "anon full access medios_caja" on medios_caja
  for all using (true) with check (true);
drop policy if exists "anon full access cheques" on cheques;
create policy "anon full access cheques" on cheques
  for all using (true) with check (true);

-- ------------------------------------------------------------
-- Adjuntos (proveedores y facturas): desde esta versión se guardan en el
-- Google Drive de quien usa la app (ver GOOGLE_DRIVE_CLIENT_ID en
-- config.js), no en Supabase Storage — así no ocupan espacio/costo acá.
-- Ya NO hace falta crear el bucket "adjuntos"; este script no lo crea más.
--
-- Si ya habías corrido una versión anterior de este schema.sql, es probable
-- que el bucket "adjuntos" siga existiendo en tu proyecto (con los archivos
-- que se hayan subido en su momento). No se borra solo, porque borrarlo
-- automáticamente implicaría borrar esos archivos. Si querés liberar ese
-- espacio y ya no necesitás esos adjuntos viejos, hacelo a mano desde el
-- Dashboard de Supabase -> Storage -> bucket "adjuntos" -> Delete bucket.
-- ------------------------------------------------------------

-- ------------------------------------------------------------
-- Datos iniciales: las rutas y camiones de tu operación, los
-- choferes y ayudantes de tu equipo, y los viajes reales de
-- septiembre 2026 que ya estaban en tu Excel.
-- ------------------------------------------------------------
insert into routes (id, label, sort_order, active) values
  ('80',   '80',    1, true),
  ('82',   '82',    2, true),
  ('81',   '81',    3, true),
  ('50',   '50',    4, true),
  ('52',   '52',    5, true),
  ('YAC',  'YAC',   6, true),
  ('51',   '51',    7, true),
  ('L12',  'L 1-2', 8, true),
  ('SARM', 'SARM.', 9, true),
  ('ANTI', 'ANTI.', 10, true),
  ('56',   '56',    11, true),
  ('MINE', 'MINE.', 12, true),
  ('MAN',  'MAN',   13, true)
on conflict (id) do nothing;

-- FlotaPesada: 13, 20, 32, 41 y 17 (todos scope 'both' — también sirven para
-- Sucursales). 4000 es exclusivo de Sucursales (camión chico de reparto).
insert into trucks (id, label, active, scope) values
  ('13',   'Camión 13',   true, 'both'),
  ('20',   'Camión 20',   true, 'both'),
  ('32',   'Camión 32',   true, 'both'),
  ('41',   'Camión 41',   true, 'both'),
  ('17',   'Camión 17',   true, 'both'),
  ('4000', 'Camión 4000', true, 'sucursales')
on conflict (id) do nothing;

-- Choferes y ayudantes: mismo pool de 11 personas para los dos roles. 6
-- trabajan tanto FlotaPesada como Sucursales (scope 'both'); las otras 5
-- solo Sucursales (scope 'sucursales').
insert into drivers (id, name, active, scope) values
  ('ankao',           'Ancao',           true, 'both'),
  ('scart',           'Scarttezzini',    true, 'both'),
  ('haro',            'Haro',            true, 'both'),
  ('lopez',           'Lopez',           true, 'both'),
  ('cornejo',         'Cornejo',         true, 'both'),
  ('sardak',          'Sardak',          true, 'both'),
  ('molina_victor',   'Molina Victor',   true, 'sucursales'),
  ('garcia_fernando', 'Garcia Fernando', true, 'sucursales'),
  ('peralta_franco',  'Peralta Franco',  true, 'sucursales'),
  ('martin_ivan',     'Martin Ivan',     true, 'sucursales'),
  ('rojas',           'Rojas',           true, 'sucursales')
on conflict (id) do nothing;

insert into helpers (id, name, active, scope) values
  ('ankao',           'Ancao',           true, 'both'),
  ('scart',           'Scarttezzini',    true, 'both'),
  ('haro',            'Haro',            true, 'both'),
  ('lopez',           'Lopez',           true, 'both'),
  ('cornejo',         'Cornejo',         true, 'both'),
  ('sardak',          'Sardak',          true, 'both'),
  ('molina_victor',   'Molina Victor',   true, 'sucursales'),
  ('garcia_fernando', 'Garcia Fernando', true, 'sucursales'),
  ('peralta_franco',  'Peralta Franco',  true, 'sucursales'),
  ('martin_ivan',     'Martin Ivan',     true, 'sucursales'),
  ('rojas',           'Rojas',           true, 'sucursales')
on conflict (id) do nothing;

insert into cargo_types (id, name, active, sort_order) values
  ('s1500',         'S1500',         true, 1),
  ('s2000',         'S2000',         true, 2),
  ('s175_b_s',      'S175 B/S',      true, 3),
  ('a1_5',          'A1.5',          true, 4),
  ('a2_25',         'A2.25',         true, 5),
  ('a500',          'A500',          true, 6),
  ('a_g_500',       'A/G 500',       true, 7),
  ('x8',            'X8',            true, 8),
  ('x20',           'X20',           true, 9),
  ('x12',           'X12',           true, 10),
  ('sab1_5',        'SAB1.5',        true, 11),
  ('sab500',        'SAB500',        true, 12),
  ('caj',           'CAJ',           true, 13),
  ('disp',          'DISP',          true, 14),
  ('ex12',          'EX12',          true, 15),
  ('ex20',          'EX20',          true, 16),
  ('evs1500',       'EVS1500',       true, 17),
  ('x8v',           'X8V',           true, 18),
  ('x12v',          'X12V',          true, 19),
  ('x20v',          'X20V',          true, 20),
  ('ex12v',         'EX12V',         true, 21),
  ('ex20v',         'EX20V',         true, 22),
  ('promo_mundial', 'PROMO MUNDIAL', true, 23),
  ('m_f_c',         'M F/C',         true, 24),
  ('bba',           'BBA',           true, 25),
  ('vasos',         'VASOS',         true, 26),
  ('can',           'CAN',           true, 27),
  ('r_8',           'R-8',           true, 28),
  ('r12_20',        'R12/20',        true, 29),
  ('sport',         'SPORT',         true, 30),
  ('sifon_desc',    'SIFON DESC',    true, 31),
  ('bmb_aut',       'BMB AUT.',      true, 32),
  ('mate',          'MATE',          true, 33)
on conflict (id) do nothing;

-- Sucursales: activas/inactivas según el histórico real (Consolidado
-- 2021-2026) — las inactivas dejaron de recibir envíos hace varios meses.
insert into branches (id, label, sort_order, active) values
  ('rivadavia',   'Rivadavia',   1,  true),
  ('km5',         'KM5',         2,  true),
  ('km8',         'KM8',         3,  true),
  ('km12',        'KM12',        4,  true),
  ('kennedy',     'Kennedy',     5,  true),
  ('polonia',     'Polonia',     6,  true),
  ('rada_tilly',  'Rada Tilly',  7,  true),
  ('caleta_1',    'Caleta 1',    8,  true),
  ('canada',      'Canadá',      9,  true),
  ('eeuu',        'EEUU',        10, true),
  ('palazzo',     'Palazzo',     11, false),
  ('km3',         'KM3',         12, false),
  ('caleta_2',    'Caleta 2',    13, false),
  ('base_caleta', 'Base Caleta', 14, false)
on conflict (id) do nothing;

insert into trips (id, date, route_id, truck, note, status, updated_by, source) values
  ('2026-09-01_81',   '2026-09-01', '81',   '20', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-01_L12',  '2026-09-01', 'L12',  '32', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-01_SARM', '2026-09-01', 'SARM', '41', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-02_80',   '2026-09-02', '80',   '13', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-02_50',   '2026-09-02', '50',   '41', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-03_80',   '2026-09-03', '80',   '13', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-03_MAN',  '2026-09-03', 'MAN',  '20', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-04_80',   '2026-09-04', '80',   '13', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-04_L12',  '2026-09-04', 'L12',  '41', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-08_YAC',  '2026-09-08', 'YAC',  '32', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-09_80',   '2026-09-09', '80',   '13', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-09_50',   '2026-09-09', '50',   '41', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-10_80',   '2026-09-10', '80',   '13', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-10_52',   '2026-09-10', '52',   '32', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-10_51',   '2026-09-10', '51',   '32', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-11_80',   '2026-09-11', '80',   '32', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-11_MINE', '2026-09-11', 'MINE', '13', '', 'actual', 'Importado del Excel', 'import'),
  ('2026-09-14_81',   '2026-09-14', '81',   '20', '', 'actual', 'Importado del Excel', 'import')
on conflict (id) do nothing;

-- Login por perfiles: perfiles por defecto (Admin con acceso completo a
-- todo, Lectura con solo la vista Día en modo "ver") — cambialos cuanto
-- antes desde ⚙ → Acceso, una vez que entres con "admin".
insert into app_config (id, admin_password, viewer_password, roles) values
  ('auth', 'admin', 'lectura', '[
    {"id":"admin","nombre":"Admin","password":"admin","manageAccess":true,"permisos":{"grid":"editar","branches":"editar","company":"editar","occasional":"editar","compras":"editar","pagos":"editar","tesoreria":"editar","day":"editar","dashboard":"editar"}},
    {"id":"lectura","nombre":"Lectura","password":"lectura","manageAccess":false,"permisos":{"grid":"oculta","branches":"oculta","company":"oculta","occasional":"oculta","compras":"oculta","pagos":"oculta","tesoreria":"oculta","day":"ver","dashboard":"oculta"}}
  ]'::jsonb)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Tiempo real: para que los cambios se vean al instante entre
-- varias personas, agregá las tablas a la publicación de
-- Realtime (Supabase lo pide aparte de RLS). El bloque de abajo
-- se fija primero si la tabla ya está agregada, así este archivo
-- se puede volver a correr sin error.
-- ------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='routes') then
    alter publication supabase_realtime add table routes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trucks') then
    alter publication supabase_realtime add table trucks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='drivers') then
    alter publication supabase_realtime add table drivers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='helpers') then
    alter publication supabase_realtime add table helpers;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cargo_types') then
    alter publication supabase_realtime add table cargo_types;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='trips') then
    alter publication supabase_realtime add table trips;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='branches') then
    alter publication supabase_realtime add table branches;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='visits') then
    alter publication supabase_realtime add table visits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='companies') then
    alter publication supabase_realtime add table companies;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='company_visits') then
    alter publication supabase_realtime add table company_visits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='occasionals') then
    alter publication supabase_realtime add table occasionals;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='occasional_visits') then
    alter publication supabase_realtime add table occasional_visits;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='app_config') then
    alter publication supabase_realtime add table app_config;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='proveedores') then
    alter publication supabase_realtime add table proveedores;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ordenes_compra') then
    alter publication supabase_realtime add table ordenes_compra;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='rubros') then
    alter publication supabase_realtime add table rubros;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='facturas') then
    alter publication supabase_realtime add table facturas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='ordenes_pago') then
    alter publication supabase_realtime add table ordenes_pago;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cuentas') then
    alter publication supabase_realtime add table cuentas;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='movimientos') then
    alter publication supabase_realtime add table movimientos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='medios_caja') then
    alter publication supabase_realtime add table medios_caja;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='cheques') then
    alter publication supabase_realtime add table cheques;
  end if;
end $$;

-- ------------------------------------------------------------
-- Actualización de flota y equipo (septiembre 2026): FlotaPesada
-- pasa a usar los camiones 13, 20, 32, 41 y 17 (se da de baja el 36);
-- choferes y ayudantes quedan en un mismo pool de 11 personas —
-- Ancao, Scarttezzini, Haro, Lopez, Cornejo y Sardak en los dos lados
-- (FlotaPesada y Sucursales), y Molina Victor, Garcia Fernando,
-- Peralta Franco, Martin Ivan y Rojas solo en Sucursales; y se agrega
-- el camión 4000, exclusivo de Sucursales. Este bloque es seguro de
-- volver a correr las veces que haga falta: sólo fuerza estos valores,
-- no toca viajes ni envíos ya cargados.
-- ------------------------------------------------------------

-- Camiones: 13/20/32/41 quedan 'both'; se da de baja el 36 (se desactiva,
-- no se borra, para no romper viajes históricos que ya lo tengan asignado);
-- se agrega el 17 ('both') y el 4000 ('sucursales').
insert into trucks (id, label, active, scope) values
  ('13',   'Camión 13',   true,  'both'),
  ('20',   'Camión 20',   true,  'both'),
  ('32',   'Camión 32',   true,  'both'),
  ('41',   'Camión 41',   true,  'both'),
  ('17',   'Camión 17',   true,  'both'),
  ('4000', 'Camión 4000', true,  'sucursales')
on conflict (id) do update set active = excluded.active, scope = excluded.scope;

update trucks set active = false where id = '36';

-- Choferes: mismos 11, se corrige el nombre de 'ankao'->Ancao y
-- 'scart'->Scarttezzini, y se fija el scope de cada uno.
insert into drivers (id, name, active, scope) values
  ('ankao',           'Ancao',           true, 'both'),
  ('scart',           'Scarttezzini',    true, 'both'),
  ('haro',            'Haro',            true, 'both'),
  ('lopez',           'Lopez',           true, 'both'),
  ('cornejo',         'Cornejo',         true, 'both'),
  ('sardak',          'Sardak',          true, 'both'),
  ('molina_victor',   'Molina Victor',   true, 'sucursales'),
  ('garcia_fernando', 'Garcia Fernando', true, 'sucursales'),
  ('peralta_franco',  'Peralta Franco',  true, 'sucursales'),
  ('martin_ivan',     'Martin Ivan',     true, 'sucursales'),
  ('rojas',           'Rojas',           true, 'sucursales')
on conflict (id) do update set name = excluded.name, active = excluded.active, scope = excluded.scope;

-- Ayudantes: se reemplaza la lista anterior (Campillay, Flores, Perez,
-- Cardenas, Silvera, Alfonso, Maldonado, Herrera, Nieva, Ancapillan) por el
-- mismo pool de 11 personas de arriba, para que cualquiera pueda aparecer
-- como chofer o como ayudante.
delete from helpers where id in (
  'campillay_jonathan','flores_lucas','perez_jose','cardenas_maximiliano',
  'silvera_juan','alfonso_emanuel','maldonado_cristian','herrera_franco',
  'nieva_lucas','ancapillan_carlos'
);
insert into helpers (id, name, active, scope) values
  ('ankao',           'Ancao',           true, 'both'),
  ('scart',           'Scarttezzini',    true, 'both'),
  ('haro',            'Haro',            true, 'both'),
  ('lopez',           'Lopez',           true, 'both'),
  ('cornejo',         'Cornejo',         true, 'both'),
  ('sardak',          'Sardak',          true, 'both'),
  ('molina_victor',   'Molina Victor',   true, 'sucursales'),
  ('garcia_fernando', 'Garcia Fernando', true, 'sucursales'),
  ('peralta_franco',  'Peralta Franco',  true, 'sucursales'),
  ('martin_ivan',     'Martin Ivan',     true, 'sucursales'),
  ('rojas',           'Rojas',           true, 'sucursales')
on conflict (id) do update set name = excluded.name, active = excluded.active, scope = excluded.scope;

-- ------------------------------------------------------------
-- Rubros: suma a la lista cualquier rubro que ya tenga cargado algún
-- proveedor y todavía no esté en la tabla (ej. rubros escritos a mano antes
-- de que existiera la lista). Seguro de volver a correr.
-- ------------------------------------------------------------
insert into rubros (id, nombre)
select distinct on (lower(trim(p.rubro)))
       'r_' || left(regexp_replace(lower(trim(p.rubro)), '[^a-z0-9]+', '_', 'g'), 40), trim(p.rubro)
from proveedores p
where trim(coalesce(p.rubro,'')) <> ''
  and not exists (select 1 from rubros r where lower(trim(r.nombre)) = lower(trim(p.rubro)))
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Áreas (Logística / Administración / Comercial) e ingreso único con email
-- (octubre 2026). Seguro de volver a correr.
--
-- Todos entran con email + contraseña (Supabase Auth, el mismo ingreso que ya
-- usaba el tablero Comercial). La tabla usuarios dice quién puede entrar
-- (activo) y con qué perfil de ⚙ → Acceso (columna perfil = id del perfil).
-- Sin perfil = "Solo Comercial", que es como funcionaban los usuarios que ya
-- existían. Para el primer administrador ver primer-admin.sql.
-- ------------------------------------------------------------
create table if not exists usuarios (
  email text primary key,
  activo boolean not null default true
);
alter table usuarios add column if not exists perfil text;
alter table usuarios add column if not exists nombre text default '';
create unique index if not exists usuarios_email_uidx on usuarios(email);
alter table usuarios enable row level security;

-- ¿La persona logueada es administradora? (perfil con "administrar accesos")
-- security definer: lee usuarios/app_config sin pasar por las políticas, así
-- la política de usuarios puede usarla sin recursión.
create or replace function gestion_es_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from usuarios u
    join app_config c on c.id = 'auth'
    cross join lateral jsonb_array_elements(coalesce(c.roles, '[]'::jsonb)) r
    where u.email = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.activo
      and r ->> 'id' = u.perfil
      and coalesce((r ->> 'manageAccess')::boolean, false)
  );
$$;

-- Cada uno lee su propia fila; los administradores leen y modifican todas.
drop policy if exists "usuarios: leer la propia o admin" on usuarios;
create policy "usuarios: leer la propia o admin" on usuarios
  for select to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email', '')) or gestion_es_admin());
drop policy if exists "usuarios: admin escribe" on usuarios;
create policy "usuarios: admin escribe" on usuarios
  for all to authenticated
  using (gestion_es_admin()) with check (gestion_es_admin());
-- Limpieza: una versión anterior de este archivo creó la función es_admin()
-- para lo mismo. Se renombró a gestion_es_admin() para que no choque con la
-- base de Fichajes al juntarlas. Solo se borra si es la nuestra (la que lee
-- app_config); si es_admin() es de Fichajes, no se toca.
do $$
begin
  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'es_admin' and p.pronargs = 0
      and pg_get_functiondef(p.oid) like '%app_config%'
  ) then
    drop function public.es_admin();
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Permisos base para quien entra con email (rol authenticated). Sin esto:
-- "permission denied for table ..." (42501). Lo que cada uno ve lo deciden
-- las políticas RLS de arriba. (Igual que permisos-usuarios-logueados.sql)
-- ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                  on all sequences in schema public to authenticated;
grant execute                        on all functions in schema public to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables    to authenticated;
alter default privileges in schema public grant usage, select                  on sequences to authenticated;
alter default privileges in schema public grant execute                        on functions to authenticated;

-- Sugerencia de pagos: proveedores que se pagan primero (combustible, servicios...)
alter table proveedores add column if not exists prioritario boolean not null default false;

-- usuarios.perfil_id viene del Comercial anterior (NOT NULL con FK). Gestión
-- usa usuarios.perfil; sin esto, "+ Agregar usuario" falla con
-- 'null value in column "perfil_id" ... violates not-null constraint'.
do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema='public' and table_name='usuarios' and column_name='perfil_id') then
    execute 'alter table public.usuarios alter column perfil_id drop not null';
  end if;
end $$;

-- =====================================================================
-- Centros de costo en árbol + Retenciones de Ganancias (RG 830 / RG 5423)
-- =====================================================================
-- Centros de costo: árbol (parent_id). Solo se imputa a las hojas.
-- requiere: '' | 'movil' | 'sucursal' (pide el camión o la sucursal).
alter table centros_costo add column if not exists parent_id text;
alter table centros_costo add column if not exists activo boolean not null default true;
alter table centros_costo add column if not exists requiere text not null default '';
alter table centros_costo add column if not exists orden int not null default 0;

-- Factura: camión/sucursal del centro ("movil:<id>" | "suc:<id>"), neto
-- gravado (base de la retención) y régimen de Ganancias.
alter table facturas add column if not exists cc_ref text not null default '';
alter table facturas add column if not exists neto numeric;
alter table facturas add column if not exists regimen_gan int;

-- Proveedor: condición en Ganancias ('' = automática según IVA |
-- 'inscripto' | 'no_inscripto' | 'exento' | 'monotributo' | 'no_retener')
-- y régimen por defecto (si no, sale del rubro).
alter table proveedores add column if not exists gan_condicion text not null default '';
alter table proveedores add column if not exists gan_regimen int;

-- Orden de pago: retenciones practicadas
-- [{regimen, base, acum_prev, ret_prev, importe, certificado, condicion}]
alter table ordenes_pago add column if not exists retenciones jsonb not null default '[]'::jsonb;
alter table ordenes_pago add column if not exists retenido numeric not null default 0;

-- Régimenes del Anexo VIII de la RG 830 (valores de la RG 5423). Se editan
-- desde ⚙ → Retenciones cuando ARCA los actualiza.
create table if not exists gan_regimenes (
  codigo int primary key,
  descripcion text not null default '',
  alic_insc numeric,                 -- % inscriptos (null si va por escala)
  escala text,                       -- 'general' | '119' | null
  alic_no_insc numeric,              -- % no inscriptos (sociedades / todos)
  alic_no_insc_ph numeric,           -- % no inscriptos personas humanas (si difiere)
  mnsr numeric not null default 0,   -- monto no sujeto a retención (mensual, inscriptos)
  mnsr_no_insc boolean not null default false, -- 112/113: también para no inscriptos
  min_insc numeric not null default 240,
  min_no_insc numeric not null default 240,
  activo boolean not null default true,
  orden int not null default 0
);
create table if not exists gan_escalas (
  escala text not null,
  desde numeric not null,
  hasta numeric,                     -- null = en adelante
  fijo numeric not null default 0,
  pct numeric not null default 0,
  primary key (escala, desde)
);
-- Parámetros generales (datos del agente de retención para el certificado).
create table if not exists parametros (
  id text primary key,
  valor jsonb not null default '{}'::jsonb
);

insert into gan_regimenes (codigo, descripcion, alic_insc, escala, alic_no_insc, alic_no_insc_ph, mnsr, mnsr_no_insc, min_insc, min_no_insc, orden) values
  (78,  'Enajenación de bienes muebles y bienes de cambio', 2, null, 10, null, 224000, false, 240, 240, 1),
  (94,  'Locaciones de obra y/o servicios no ejecutados en relación de dependencia', 2, null, 25, 28, 67170, false, 240, 240, 2),
  (95,  'Operaciones de transporte de carga nacional e internacional', 0.25, null, 25, 28, 67170, false, 240, 240, 3),
  (119, 'Profesiones liberales, oficios', null, '119', 28, null, 160000, false, 240, 240, 4),
  (31,  'Alquileres de inmuebles urbanos (incluye leasing y suburbanos)', 6, null, 25, 28, 11200, false, 240, 1020, 5),
  (32,  'Alquileres de inmuebles rurales (incluye leasing y subrurales)', 6, null, 25, 28, 11200, false, 240, 240, 6),
  (30,  'Alquileres o arrendamientos de bienes muebles', 6, null, 25, 28, 11200, false, 240, 240, 7),
  (116, 'Honorarios de director, síndico, fiduciario, consejero, socio administrador; albacea, mandatario, gestor', null, 'general', 28, null, 67170, false, 240, 240, 8),
  (124, 'Corredor, viajante de comercio y despachante de aduana', null, 'general', 28, null, 16830, false, 240, 240, 9),
  (25,  'Comisiones (comisionista, rematador, consignatario y auxiliares de comercio)', null, 'general', 28, null, 16830, false, 240, 240, 10),
  (110, 'Explotación de derechos de autor (Ley 11.723)', null, 'general', 28, null, 10000, false, 240, 240, 11),
  (86,  'Transferencia de derechos de llave, marcas, patentes, regalías, concesiones', 2, null, 10, null, 224000, false, 240, 240, 12),
  (21,  'Intereses originados en operaciones no comprendidas en el código 19', 6, null, 25, 28, 7870, false, 240, 240, 13),
  (19,  'Intereses por operaciones en entidades financieras (Ley 21.526), agentes de bolsa o mercado abierto', 3, null, 10, null, 0, false, 240, 240, 14),
  (35,  'Regalías', 6, null, 25, 28, 7870, false, 240, 240, 15),
  (43,  'Interés accionario, excedentes y retornos de cooperativas (excepto consumo)', 6, null, 25, 28, 7870, false, 240, 240, 16),
  (51,  'Obligaciones de no hacer, o por abandono o no ejercicio de una actividad', 6, null, 25, 28, 7870, false, 240, 240, 17),
  (53,  'Operaciones en mercados de cereales a término, futuros y opciones', 0.5, null, 2, null, 0, false, 240, 240, 18),
  (55,  'Distribución de películas. Transmisión de programación. Televisión satelital', 0.5, null, 2, null, 0, false, 240, 240, 19),
  (111, 'Cualquier otra cesión o locación de derechos', 0.5, null, 2, null, 0, false, 240, 240, 20),
  (112, 'Beneficios de planes de seguro de retiro privados', 3, null, 3, null, 16830, true, 240, 240, 21),
  (113, 'Rescates de planes de seguro de retiro', 3, null, 3, null, 16830, true, 240, 240, 22),
  (779, 'Subsidios del Estado por enajenación de bienes muebles y bienes de cambio', 2, null, 10, null, 76140, false, 240, 240, 23),
  (780, 'Subsidios del Estado por locaciones de obra y/o servicios', 2, null, 25, 28, 31460, false, 240, 240, 24)
on conflict (codigo) do nothing;

insert into gan_escalas (escala, desde, hasta, fijo, pct) values
  ('general', 0, 8000, 0, 5), ('general', 8000, 16000, 400, 9), ('general', 16000, 24000, 1120, 12),
  ('general', 24000, 32000, 2080, 15), ('general', 32000, 48000, 3280, 19), ('general', 48000, 64000, 6320, 23),
  ('general', 64000, 96000, 10000, 27), ('general', 96000, null, 18640, 31),
  ('119', 0, 71000, 0, 5), ('119', 71000, 142000, 3550, 9), ('119', 142000, 213000, 9940, 12),
  ('119', 213000, 284000, 18460, 15), ('119', 284000, 426000, 29110, 19), ('119', 426000, 568000, 56090, 23),
  ('119', 568000, 852000, 88750, 27), ('119', 852000, null, 165430, 31)
on conflict (escala, desde) do nothing;

insert into parametros (id, valor) values
  ('agente_retencion', '{"razon_social":"ANAFER S.A.","cuit":"","domicilio":"","localidad":"Comodoro Rivadavia","provincia":"Chubut"}'::jsonb)
on conflict (id) do nothing;

alter table gan_regimenes enable row level security;
alter table gan_escalas   enable row level security;
alter table parametros    enable row level security;
drop policy if exists "anon full access gan_regimenes" on gan_regimenes;
create policy "anon full access gan_regimenes" on gan_regimenes for all using (true) with check (true);
drop policy if exists "anon full access gan_escalas" on gan_escalas;
create policy "anon full access gan_escalas" on gan_escalas for all using (true) with check (true);
drop policy if exists "anon full access parametros" on parametros;
create policy "anon full access parametros" on parametros for all using (true) with check (true);
grant select, insert, update, delete on gan_regimenes, gan_escalas, parametros to authenticated;
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gan_regimenes') then
      alter publication supabase_realtime add table gan_regimenes;
    end if;
    if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='parametros') then
      alter publication supabase_realtime add table parametros;
    end if;
  end if;
end $$;

-- Centro de costo ligado a un camión ("movil:13") o una sucursal ("suc:km12")
alter table centros_costo add column if not exists ref_fijo text not null default '';

-- Pagos mixtos: una orden de pago con varias formas de pago
-- [{medio_id, cuenta_id, importe, cheque_ids, cheque_numero, cheque_fecha}]
alter table ordenes_pago add column if not exists formas jsonb not null default '[]'::jsonb;

-- Anulación de comprobantes (octubre 2026): los comprobantes no se borran,
-- se anulan. Queda quién, cuándo y por qué; el número no se vuelve a usar.
-- Facturas, órdenes de pago y órdenes de compra pasan a estado 'anulada';
-- los movimientos de caja anulados (anulado_en con fecha) no suman al saldo.
alter table facturas       add column if not exists anulado_en timestamptz;
alter table facturas       add column if not exists anulado_por text not null default '';
alter table facturas       add column if not exists motivo_anulacion text not null default '';
alter table ordenes_pago   add column if not exists anulado_en timestamptz;
alter table ordenes_pago   add column if not exists anulado_por text not null default '';
alter table ordenes_pago   add column if not exists motivo_anulacion text not null default '';
alter table ordenes_compra add column if not exists anulado_en timestamptz;
alter table ordenes_compra add column if not exists anulado_por text not null default '';
alter table ordenes_compra add column if not exists motivo_anulacion text not null default '';
alter table movimientos    add column if not exists anulado_en timestamptz;
alter table movimientos    add column if not exists anulado_por text not null default '';
alter table movimientos    add column if not exists motivo_anulacion text not null default '';

-- Memoria del ayudante (octubre 2026): ver ayudante-memoria.sql
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

-- Lectura de facturas (octubre 2026): ver leer-facturas.sql
create or replace function puede_editar(secciones text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios u
    join app_config c on c.id = 'auth'
    cross join lateral jsonb_array_elements(coalesce(c.roles, '[]'::jsonb)) r
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.activo is not false
      and r ->> 'id' = u.perfil
      and (
        (r ->> 'manageAccess')::boolean is true
        or exists (select 1 from unnest(secciones) s where r -> 'permisos' ->> s = 'editar')
      )
  );
$$;
revoke all on function puede_editar(text[]) from public, anon;
grant execute on function puede_editar(text[]) to authenticated;

-- Módulo Calidad (octubre 2026): ver calidad.sql
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

-- Módulo Dashboards (octubre 2026): ver tableros.sql
create or replace function puede_ver(secciones text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios u
    join app_config c on c.id = 'auth'
    cross join lateral jsonb_array_elements(coalesce(c.roles, '[]'::jsonb)) r
    where lower(u.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and u.activo is not false
      and r ->> 'id' = u.perfil
      and (
        (r ->> 'manageAccess')::boolean is true
        or exists (select 1 from unnest(secciones) s where r -> 'permisos' ->> s in ('ver', 'editar'))
      )
  );
$$;
revoke all on function puede_ver(text[]) from public, anon;
grant execute on function puede_ver(text[]) to authenticated;

create table if not exists tableros_opiniones (
  id text primary key,
  creado timestamptz not null default now(),
  usuario text not null default '',
  modulo text not null default 'resumen',   -- resumen | logistica | administracion | calidad | comercial | rrhh
  texto text not null default '',
  datos jsonb not null default '{}'::jsonb  -- los indicadores que se le pasaron (para saber en qué se basó)
);
create index if not exists tableros_opiniones_creado_idx on tableros_opiniones(creado desc);
alter table tableros_opiniones enable row level security;
drop policy if exists "anon full access tableros_opiniones" on tableros_opiniones;
create policy "anon full access tableros_opiniones" on tableros_opiniones for all using (true) with check (true);
grant select, insert, update, delete on tableros_opiniones to authenticated;


-- ===== retenciones-reales.sql =====
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


-- ===== calidad-cambios.sql =====
-- =====================================================================
-- Calidad: cliente y origen en los reclamos + productos nuevos
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios), después de
-- calidad.sql. Se puede correr de nuevo sin problema.
-- 1) Reclamos: columnas "cliente" y "origen" (planta, sucursal, distribuidor…),
--    "comentarios" (1ª parte, recepción), "adjuntos" (fotos en Google Drive) y
--    "control_por / control_en" (quién completó la 2ª parte en fábrica).
--    Quien carga ya quedaba registrado en "creado_por".
-- 2) Productos: "Soda Retornable" pasa a "Soda retornable 1.5L" (en la lista y
--    en los reclamos ya cargados) y se suman Soda retornable 650ml, Bx5Azul y
--    Bx5Verde. Si la lista nunca se tocó desde ⚙, Gestión ya trae la nueva.
-- =====================================================================
alter table calidad_reclamos add column if not exists cliente text not null default '';
alter table calidad_reclamos add column if not exists origen  text not null default '';
create index if not exists calidad_reclamos_origen_idx on calidad_reclamos(origen);
-- Carga en dos partes: comentarios de quien recibe; fotos del control (Google Drive) y quién lo controló
alter table calidad_reclamos add column if not exists comentarios text not null default '';
alter table calidad_reclamos add column if not exists adjuntos jsonb not null default '[]'::jsonb;  -- [{id, url, name, contentType, sizeBytes, subido_por, subido_en}]
alter table calidad_reclamos add column if not exists control_por text;
alter table calidad_reclamos add column if not exists control_en timestamptz;

update calidad_reclamos set producto = 'Soda retornable 1.5L' where lower(producto) = 'soda retornable';

-- Lista de productos guardada (si existe): renombra y agrega lo que falte, con "Otro" al final
update calidad_listas l set valores = (
  with base as (
    select case when lower(v) = 'soda retornable' then 'Soda retornable 1.5L' else v end as v, ord
    from jsonb_array_elements_text(l.valores) with ordinality as t(v, ord)
  ), todos as (
    select v, ord from base
    union all
    select n.v, 1000 + n.i from (values ('Soda retornable 650ml', 1), ('Bx5Azul', 2), ('Bx5Verde', 3)) as n(v, i)
    where not exists (select 1 from base b where lower(b.v) = lower(n.v))
  )
  select coalesce(jsonb_agg(v order by (lower(v) = 'otro'), ord), '[]'::jsonb) from todos
)
where l.id = 'productos';

-- Control
select id, valores from calidad_listas where id in ('productos', 'origenes_reclamo', 'cargadores');

-- =====================================================================
-- Compras: base de artículos + proveedores que cargan artículos en la factura
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede correr
-- de nuevo sin problema. También está al final de schema.sql.
--
-- * articulos: la base de artículos (código, descripción, unidad, categoría).
--   Se administra en Administración → Compras → Artículos, o se da de alta
--   desde la misma factura. Es la base que va a usar Stock.
-- * proveedores.lleva_articulos: si está tildado, al cargar una factura de
--   ese proveedor hay que detallar los artículos (cantidad y precio), además
--   de la imputación (una sola o repartida en centros de costo).
-- * facturas.articulos: el detalle [{articulo_id, cantidad, precio, importe}].
-- * Vista factura_articulos_v: una fila por artículo comprado (sin las
--   facturas anuladas), lista para Stock y reportes.
-- =====================================================================
create table if not exists articulos (
  id          text primary key,
  codigo      text not null default '',
  descripcion text not null,
  unidad      text not null default 'Unidad',
  categoria   text not null default '',
  activo      boolean not null default true,
  notas       text not null default '',
  created_at  timestamptz not null default now()
);
create unique index if not exists articulos_codigo_uq on articulos (lower(codigo)) where codigo <> '';
create index if not exists articulos_descripcion_idx on articulos (lower(descripcion));

alter table articulos enable row level security;
drop policy if exists "anon full access articulos" on articulos;
drop policy if exists "seg: ver" on articulos;
drop policy if exists "seg: crear" on articulos;
drop policy if exists "seg: cambiar" on articulos;
drop policy if exists "seg: borrar" on articulos;
create policy "seg: ver" on articulos for select to authenticated using ((select public.puede_ver(array['compras','pagos','tesoreria','tableros'])));
create policy "seg: crear" on articulos for insert to authenticated with check ((select public.puede_editar(array['compras','pagos'])));
create policy "seg: cambiar" on articulos for update to authenticated using ((select public.puede_editar(array['compras','pagos']))) with check ((select public.puede_editar(array['compras','pagos'])));
create policy "seg: borrar" on articulos for delete to authenticated using ((select public.puede_editar(array['compras','pagos'])));
revoke all on articulos from anon;
grant select, insert, update, delete on articulos to authenticated;

alter table proveedores add column if not exists lleva_articulos boolean not null default false;
alter table facturas    add column if not exists articulos jsonb not null default '[]'::jsonb;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'articulos') then
    alter publication supabase_realtime add table articulos;
  end if;
end $$;

create or replace view factura_articulos_v with (security_invoker = true) as
select f.id                          as factura_id,
       f.proveedor_id,
       f.numero                      as factura_numero,
       f.fecha,
       a.ord                         as linea,
       a.item->>'articulo_id'        as articulo_id,
       coalesce((a.item->>'cantidad')::numeric, 0) as cantidad,
       coalesce((a.item->>'precio')::numeric, 0)   as precio,
       coalesce((a.item->>'importe')::numeric, 0)  as importe
from facturas f
cross join lateral jsonb_array_elements(coalesce(f.articulos, '[]'::jsonb)) with ordinality as a(item, ord)
where coalesce(f.estado, '') <> 'anulada';
revoke all on factura_articulos_v from anon;
grant select on factura_articulos_v to authenticated;

-- =====================================================================
-- SEGURIDAD — ETAPA 1 (hallazgos críticos C-1, C-2, C-3 y A-1)
-- =====================================================================
-- Correr una vez en el SQL Editor de Supabase (base Envios). Se puede correr
-- de nuevo sin problema. Después, volver a correr
-- auditoria-seguridad-consulta.sql: no tiene que quedar ninguna tabla de
-- Gestión, Calidad ni Comercial con "ANON PUEDE…" ni "cualquier usuario
-- logueado puede escribir" (salvo app_config, que se lee entre todos los
-- logueados pero solo la escriben los administradores).
--
-- Qué hace:
--  1. app_config (perfiles y permisos): la leen los logueados; la escriben
--     solo los administradores ("administrar accesos").
--  2. Borra las políticas "abiertas" (using true / with check true) de las
--     tablas de Gestión, Calidad y Comercial. Producción ya tiene políticas
--     por área en Logística, Compras, Pagos y Tesorería: esas quedan.
--  3. Crea políticas por área donde faltaban (cheques, retenciones, Calidad,
--     artículos, Comercial…), con los mismos permisos de ⚙ → Acceso.
--  4. Quita a "anon" (la clave pública) todo acceso a esas tablas.
--  5. Las vistas pasan a respetar los permisos de quien consulta.
--  6. Bucket "adjuntos": deja de ser público; solo Compras / Pagos / Tesorería.
--  7. RR.HH.: vacaciones y computadoras para fichar, solo con permiso de RR.HH.
--  8. usuarios: se borran las políticas del sistema de permisos anterior
--     (tabla perfiles); queda solo el de Gestión.
--
-- No cambia nada del fichaje de los empleados: sus funciones (legajo + PIN)
-- siguen igual, y horarios, locales, feriados y recargos siguen de lectura
-- pública porque los usa el fichaje.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) app_config
-- ---------------------------------------------------------------------
drop policy if exists "anon full access app_config" on public.app_config;
drop policy if exists "app_config: leen logueados" on public.app_config;
drop policy if exists "app_config: escribe admin" on public.app_config;
create policy "app_config: leen logueados" on public.app_config for select to authenticated using (true);
create policy "app_config: escribe admin" on public.app_config for all to authenticated
  using (public.gestion_es_admin()) with check (public.gestion_es_admin());
revoke all on public.app_config from anon;

-- ---------------------------------------------------------------------
-- 2 a 4) Tablas: se borran las políticas abiertas y, si la tabla no tiene
-- política por área, se crean (ver / editar según la sección de ⚙ → Acceso)
-- ---------------------------------------------------------------------
do $$
declare
  r record; pol record; tiene_area boolean;
begin
  for r in select * from (values
    -- tabla                          puede ver (secciones)                                 puede editar
    -- Logística (ya tienen políticas por área en producción)
    ('routes',            '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('trucks',            '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('drivers',           '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('helpers',           '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('cargo_types',       '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid}'),
    ('trips',             '{grid,branches,company,occasional,day,dashboard,tableros}', '{grid,day}'),
    ('branches',          '{grid,branches,company,occasional,day,dashboard,tableros}', '{branches}'),
    ('visits',            '{grid,branches,company,occasional,day,dashboard,tableros}', '{branches,day}'),
    ('companies',         '{grid,branches,company,occasional,day,dashboard,tableros}', '{company}'),
    ('company_visits',    '{grid,branches,company,occasional,day,dashboard,tableros}', '{company,day}'),
    ('occasionals',       '{grid,branches,company,occasional,day,dashboard,tableros}', '{occasional}'),
    ('occasional_visits', '{grid,branches,company,occasional,day,dashboard,tableros}', '{occasional,day}'),
    -- Administración
    ('proveedores',       '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('ordenes_compra',    '{compras,pagos,tesoreria,tableros}', '{compras,pagos}'),
    ('centros_costo',     '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('conceptos',         '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('rubros',            '{compras,pagos,tesoreria,tableros}', '{compras}'),
    ('articulos',         '{compras,pagos,tesoreria,tableros}', '{compras,pagos}'),
    ('facturas',          '{compras,pagos,tesoreria,tableros}', '{compras,pagos}'),
    ('ordenes_pago',      '{compras,pagos,tesoreria,tableros}', '{pagos}'),
    ('cuentas',           '{pagos,tesoreria,tableros}',         '{tesoreria}'),
    ('movimientos',       '{pagos,tesoreria,tableros}',         '{tesoreria,pagos}'),
    ('cheques',           '{pagos,tesoreria,tableros}',         '{tesoreria,pagos}'),
    ('medios_caja',       '{compras,pagos,tesoreria}',          '{tesoreria}'),
    ('gan_regimenes',     '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('gan_escalas',       '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('parametros',        '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('tipos_retencion',   '{compras,pagos,tesoreria}',          '{pagos,tesoreria}'),
    ('conceptos_retencion','{compras,pagos,tesoreria}',         '{pagos,tesoreria}'),
    -- Calidad
    ('calidad_reclamos',  '{reclamos,ncpac,calidash,tableros}', '{reclamos,ncpac}'),
    ('calidad_pac',       '{reclamos,ncpac,calidash,tableros}', '{ncpac}'),
    ('calidad_listas',    '{reclamos,ncpac,calidash}',          '{reclamos,ncpac}'),
    -- Comercial
    ('comercial_mensual',          '{comercial,tableros}', '{comercial}'),
    ('comercial_producto_mensual', '{comercial,tableros}', '{comercial}'),
    ('comercial_altas_bajas',      '{comercial,tableros}', '{comercial}'),
    ('comercial_clientes',         '{comercial,tableros}', '{comercial}'),
    ('comercial_producto_ref',     '{comercial,tableros}', '{comercial}'),
    ('comercial_real',             '{comercial,tableros}', '{comercial}'),
    ('comercial_referencia',       '{comercial,tableros}', '{comercial}')
  ) as v(tabla, ver, editar)
  loop
    if to_regclass('public.' || r.tabla) is null then continue; end if;
    execute format('alter table public.%I enable row level security', r.tabla);
    -- borrar las políticas abiertas (sin condición)
    for pol in select policyname from pg_policies
               where schemaname = 'public' and tablename = r.tabla
                 and coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true'
    loop
      execute format('drop policy %I on public.%I', pol.policyname, r.tabla);
    end loop;
    -- ¿ya tiene políticas por área? (las de producción: <tabla>_leer, _insertar…)
    select exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tabla) into tiene_area;
    if not tiene_area or exists (select 1 from pg_policies where schemaname = 'public' and tablename = r.tabla and policyname like 'seg: %') then
      execute format('drop policy if exists %I on public.%I', 'seg: ver', r.tabla);
      execute format('drop policy if exists %I on public.%I', 'seg: crear', r.tabla);
      execute format('drop policy if exists %I on public.%I', 'seg: cambiar', r.tabla);
      execute format('drop policy if exists %I on public.%I', 'seg: borrar', r.tabla);
      execute format('create policy %I on public.%I for select to authenticated using ((select public.puede_ver(%L::text[])))', 'seg: ver', r.tabla, r.ver);
      execute format('create policy %I on public.%I for insert to authenticated with check ((select public.puede_editar(%L::text[])))', 'seg: crear', r.tabla, r.editar);
      execute format('create policy %I on public.%I for update to authenticated using ((select public.puede_editar(%L::text[]))) with check ((select public.puede_editar(%L::text[])))', 'seg: cambiar', r.tabla, r.editar, r.editar);
      execute format('create policy %I on public.%I for delete to authenticated using ((select public.puede_editar(%L::text[])))', 'seg: borrar', r.tabla, r.editar);
    end if;
    execute format('revoke all on public.%I from anon', r.tabla);
    execute format('grant select, insert, update, delete on public.%I to authenticated', r.tabla);
  end loop;
end $$;

-- Memoria de Sifoncito: cada uno ve y cambia solo lo suyo
do $$ begin
  if to_regclass('public.ayudante_memoria') is not null then
    drop policy if exists "anon full access ayudante_memoria" on public.ayudante_memoria;
    drop policy if exists "seg: lo propio" on public.ayudante_memoria;
    create policy "seg: lo propio" on public.ayudante_memoria for all to authenticated
      using (lower(usuario) = lower(coalesce(auth.jwt() ->> 'email', '')))
      with check (lower(usuario) = lower(coalesce(auth.jwt() ->> 'email', '')));
    revoke all on public.ayudante_memoria from anon;
  end if;
end $$;

-- Opiniones de los tableros: las ve y las pide quien ve Dashboards; las borra un administrador
do $$ begin
  if to_regclass('public.tableros_opiniones') is not null then
    drop policy if exists "anon full access tableros_opiniones" on public.tableros_opiniones;
    drop policy if exists "seg: ver" on public.tableros_opiniones;
    drop policy if exists "seg: crear" on public.tableros_opiniones;
    drop policy if exists "seg: admin" on public.tableros_opiniones;
    create policy "seg: ver" on public.tableros_opiniones for select to authenticated using ((select public.puede_ver(array['tableros'])));
    create policy "seg: crear" on public.tableros_opiniones for insert to authenticated with check ((select public.puede_ver(array['tableros'])));
    create policy "seg: admin" on public.tableros_opiniones for all to authenticated using (public.gestion_es_admin()) with check (public.gestion_es_admin());
    revoke all on public.tableros_opiniones from anon;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 5) Vistas: que respeten los permisos de quien consulta
-- ---------------------------------------------------------------------
do $$
declare v text;
begin
  foreach v in array array['factura_articulos_v', 'comercial_altas_bajas_meses', 'comercial_clientes_meses',
                           'comercial_producto_resumen', 'comercial_resumen_meses'] loop
    if to_regclass('public.' || v) is not null then
      execute format('alter view public.%I set (security_invoker = true)', v);
      execute format('revoke all on public.%I from anon', v);
      execute format('grant select on public.%I to authenticated', v);
    end if;
  end loop;
end $$;

-- Funciones que no tienen por qué llamarse sin usuario
do $$ begin
  if to_regprocedure('public.calidad_lista(text)') is not null then
    revoke execute on function public.calidad_lista(text) from public, anon; end if;
  if to_regprocedure('public.calidad_proximo_reclamo(integer)') is not null then
    revoke execute on function public.calidad_proximo_reclamo(integer) from public, anon; end if;
  if to_regprocedure('public.top_clientes(date, date, text, integer)') is not null then
    revoke execute on function public.top_clientes(date, date, text, integer) from public, anon;
    grant execute on function public.top_clientes(date, date, text, integer) to authenticated; end if;
end $$;

-- ---------------------------------------------------------------------
-- 6) Bucket "adjuntos": privado y solo para Compras / Pagos / Tesorería
-- ---------------------------------------------------------------------
update storage.buckets set public = false where id = 'adjuntos';
drop policy if exists "anon full access adjuntos" on storage.objects;
drop policy if exists "seg: adjuntos ver" on storage.objects;
drop policy if exists "seg: adjuntos editar" on storage.objects;
create policy "seg: adjuntos ver" on storage.objects for select to authenticated
  using (bucket_id = 'adjuntos' and (select public.puede_ver(array['compras', 'pagos', 'tesoreria'])));
create policy "seg: adjuntos editar" on storage.objects for all to authenticated
  using (bucket_id = 'adjuntos' and (select public.puede_editar(array['compras', 'pagos'])))
  with check (bucket_id = 'adjuntos' and (select public.puede_editar(array['compras', 'pagos'])));

-- ---------------------------------------------------------------------
-- 7) RR.HH.: vacaciones y computadoras para fichar
-- ---------------------------------------------------------------------
do $$ begin
  if to_regclass('public.vacaciones_saldos') is not null then
    drop policy if exists "rrhh vacaciones_saldos" on public.vacaciones_saldos;
    create policy "rrhh vacaciones_saldos" on public.vacaciones_saldos for all to authenticated
      using (public.gestion_puede_rrhh()) with check (public.es_admin());
    revoke all on public.vacaciones_saldos from anon;
  end if;
  if to_regclass('public.equipos_fichaje') is not null then
    drop policy if exists "rrhh equipos_fichaje" on public.equipos_fichaje;
    create policy "rrhh equipos_fichaje" on public.equipos_fichaje for all to authenticated
      using (public.gestion_puede_rrhh()) with check (public.es_admin());
    revoke all on public.equipos_fichaje from anon;
  end if;
end $$;

-- ---------------------------------------------------------------------
-- 8) usuarios: solo el sistema de permisos de Gestión (app_config)
-- ---------------------------------------------------------------------
drop policy if exists usuarios_leer on public.usuarios;
drop policy if exists usuarios_insertar on public.usuarios;
drop policy if exists usuarios_actualizar on public.usuarios;
drop policy if exists usuarios_borrar on public.usuarios;
revoke all on public.usuarios from anon;

-- Lo que se cree de ahora en más en public no queda abierto a la clave pública
alter default privileges in schema public revoke all on tables from anon;

-- Control: tablas de Gestión / Calidad / Comercial que todavía quedan abiertas (tiene que dar 0 filas)
select tablename as todavia_abierta, policyname, array_to_string(roles, ',') as roles
from pg_policies
where schemaname = 'public'
  and tablename not in ('horarios', 'locales', 'feriados', 'recargos', 'config_zona')
  and coalesce(qual, 'true') = 'true' and coalesce(with_check, 'true') = 'true'
  and policyname <> 'app_config: leen logueados'
order by 1;

-- ---------------------------------------------------------------------
-- DESHACER (solo si algo dejó de funcionar y hay que volver atrás YA):
-- para una tabla <t>:  create policy "anon full access <t>" on public.<t> for all using (true) with check (true);
-- y avisar: lo correcto es corregir el permiso del perfil en ⚙ → Acceso.
-- ---------------------------------------------------------------------
