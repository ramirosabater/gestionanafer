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
alter table facturas         enable row level security;
alter table ordenes_pago     enable row level security;
alter table cuentas          enable row level security;
alter table movimientos      enable row level security;

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
