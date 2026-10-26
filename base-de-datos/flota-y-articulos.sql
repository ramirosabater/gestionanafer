-- =====================================================================
-- Flota (móviles) y artículos por proveedor
-- Origen: MOVILES_FLOTA_1.xls y PROD_X_PROV.xlsx (octubre 2026)
-- =====================================================================
-- Correr en Supabase (SQL Editor) DESPUÉS de articulos.sql.
-- Se puede correr más de una vez: no duplica nada ni pisa lo que ya está.
--
-- Qué hace:
--  1) Móviles: agrega a "trucks" los que faltan (id = N° de móvil).
--     Los que ya existen NO se tocan (nombre, chofer, ayudante, alcance),
--     solo se les completan patente / modelo / año / función / flota si
--     estaban vacíos.
--     Alcance de los nuevos:
--       - Pesada de REPARTO o REPARTO EMPRESAS  -> 'both' (se asignan a viajes)
--       - Depósito, livianas, autoelevadores y el acoplado -> 'gastos'
--         (no aparecen para viajes, pero sí para imputar gastos en facturas).
--     Se cambia después en ⚙ → Camiones.
--  2) Proveedores: tilda "📦 Carga artículos" en los 10 proveedores de la
--     lista (búsqueda por nombre, sin importar puntos ni mayúsculas).
--  3) Artículos: carga los de la lista que no existan (misma descripción),
--     con código correlativo después del último numérico, categoría según
--     el proveedor y la nota "Proveedor habitual: ...".
--
-- Al final muestra un INFORME con lo que hizo y lo que hay que revisar.
-- =====================================================================
alter table trucks add column if not exists patente text not null default '';
alter table trucks add column if not exists modelo  text not null default '';
alter table trucks add column if not exists anio    text not null default '';
alter table trucks add column if not exists funcion text not null default '';
alter table trucks add column if not exists flota   text not null default '';
alter table proveedores add column if not exists lleva_articulos boolean not null default false;

drop table if exists _informe, _moviles, _prov_art, _articulos, _prov_match, _art_nuevos;
create temp table _informe (orden int, seccion text, item text, resultado text, sub text default '');

-- ---------------------------------------------------------------------
-- 0) Datos de la planilla (tablas temporales: desaparecen al terminar)
-- ---------------------------------------------------------------------
create temp table _moviles (id text, label text, scope text, patente text, modelo text, anio text, funcion text, flota text);
insert into _moviles values
  ('2', 'Camión 2 · Daily 70c16', 'both', 'PGG-000', 'Daily 70c16', '2016', 'Reparto', 'Pesada'),
  ('5', 'Camión 5 · Accelo 1016', 'both', 'AB 329 EO', 'Accelo 1016', '2017', 'Reparto', 'Pesada'),
  ('7', 'Autoelevador 7', 'gastos', 'AYZ 89', 'Autoelevador', '2009', 'Depósito', 'Autoelevador'),
  ('8', 'Camión 8 · Ford 4000', 'both', 'OTY 241', 'Ford 4000', '2015', 'Reparto', 'Pesada'),
  ('11', 'Camión 11 · Cargo 916', 'both', 'AA900FJ', 'Cargo 916', '2017', 'Reparto', 'Pesada'),
  ('12', 'Camión 12 · Cargo 915', 'both', 'PMP 719', 'Cargo 915', '2016', 'Reparto', 'Pesada'),
  ('13', 'Camión 13 · Scania 310', 'both', 'MYV 160', 'Scania 310', '2013', 'Reparto empresas', 'Pesada'),
  ('14', 'Camión 14 · Ford 4000', 'both', 'KGJ 758', 'Ford 4000', '2011', 'Reparto', 'Pesada'),
  ('15', 'Camión 15 · Cargo 915', 'both', 'LII 697', 'Cargo 915', '2012', 'Reparto', 'Pesada'),
  ('16', 'Acoplado 16', 'gastos', 'LSE 846', 'Acoplado', '2012', 'Reparto empresas', 'Pesada'),
  ('17', 'Camión 17 · Cargo 1722', 'gastos', 'ITQ 964', 'Cargo 1722', '2010', 'Depósito', 'Pesada'),
  ('18', 'Autoelevador 18', 'gastos', 'ASK 076', 'Autoelevador', '2005', 'Depósito', 'Autoelevador'),
  ('20', 'Camión 20 · CARGO 1722e', 'both', 'NAE 255', 'CARGO 1722e', '2013', 'Reparto empresas', 'Pesada'),
  ('22', 'Camión 22 · Ford 4000', 'both', 'OTY 242', 'Ford 4000', '2015', 'Reparto', 'Pesada'),
  ('24', 'Camión 24 · Cargo 915', 'both', 'OCA 671', 'Cargo 915', '2014', 'Reparto', 'Pesada'),
  ('26', 'Camión 26 · Cargo 1722 E', 'gastos', 'NEI 877', 'Cargo 1722 E', '2014', 'Depósito', 'Pesada'),
  ('27', 'Móvil 27 · Fiat Uno Cargo', 'gastos', 'NSL 491', 'Fiat Uno Cargo', '2014', 'Administración', 'Liviana'),
  ('28', 'Autoelevador 28', 'gastos', 'BQL 26', 'Autoelevador', '2010', 'Depósito', 'Autoelevador'),
  ('30', 'Móvil 30 · Kangoo', 'gastos', 'NRL 950', 'Kangoo', '2014', 'Administración', 'Liviana'),
  ('31', 'Móvil 31 · Kangoo', 'gastos', 'AA580FW', 'Kangoo', '2017', 'Administración', 'Liviana'),
  ('32', 'Camión 32 · CARGO 1722 e Bal', 'both', 'OTY 318', 'CARGO 1722 e Bal', '2015', 'Reparto empresas', 'Pesada'),
  ('33', 'Camión 33 · Accelo 1016', 'both', 'AB 329 EP', 'Accelo 1016', '2017', 'Reparto', 'Pesada'),
  ('34', 'Camión 34 · Cargo 916', 'both', 'AD339WF', 'Cargo 916', '2018', 'Reparto', 'Pesada'),
  ('35', 'Móvil 35 · Sprinter', 'gastos', 'AE 021 QC', 'Sprinter', '2019', 'Depósito', 'Liviana'),
  ('36', 'Camión 36 · Accelo 1016', 'both', 'AF 123 CZ', 'Accelo 1016', '2022', 'Reparto', 'Pesada'),
  ('37', 'Camión 37 · Accelo 1016', 'gastos', 'AF 231 XK', 'Accelo 1016', '2022', 'Depósito', 'Pesada'),
  ('38', 'Móvil 38 · Kangoo', 'gastos', 'AF 459 XE', 'Kangoo', '2022', 'Depósito', 'Liviana'),
  ('39', 'Móvil 39 · Vitto', 'gastos', 'AC 917 AW', 'Vitto', '2018', 'Depósito', 'Liviana'),
  ('40', 'Camión 40 · Accelo 1016', 'both', 'AG998SF', 'Accelo 1016', '2025', 'Reparto empresas', 'Pesada'),
  ('41', 'Camión 41 · Atego', 'both', 'AG 241 CA', 'Atego', '2025', 'Reparto', 'Pesada');

create temp table _prov_art (clave text, buscar text);
insert into _prov_art values
  ('JAUREGUY', 'JAUREGUY'),
  ('POLIFORMAS SUDAMERICANAS', 'POLIFORMAS SUDAMERICANAS'),
  ('ABBATICCHIO LIDIA', 'ABBATICCHIO LIDIA'),
  ('AXEL QUIMICA SRL', 'AXEL QUIMICA'),
  ('LIVORE HNOS SRL', 'LIVORE HNOS'),
  ('SP PLASTICOS', 'SP PLASTICOS'),
  ('IDEAS MODI', 'IDEAS MODI'),
  ('SYPHON', 'SYPHON'),
  ('PLASTICOS CAMILLO', 'PLASTICOS CAMILLO'),
  ('FORMAS SRL', 'FORMAS CALCOMANIAS');

create temp table _articulos (orden serial, descripcion text, categoria text, proveedor text);
insert into _articulos (descripcion, categoria, proveedor) values
  ('ALIM LIQUIDO POMELO 0.5', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO LEMON 0.5', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO MANZANA 0.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO NARANJA 0.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO POMELO 1.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO LEMON 1.5', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO POMELO 1.5', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO CITRUS 1.5', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO NAR/DUR 1.5', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO MANZANA 1.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO PERA 1.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('ALIM LIQUIDO LIMA 1.5', 'Bebidas', 'JAUREGUY'),
  ('SIFON IVESS DESC 2 L', 'Bebidas', 'JAUREGUY'),
  ('SIFON IVESS DESC 1.75 L - SODIO', 'Bebidas', 'JAUREGUY'),
  ('AGUA MIN IVESS 0.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('AGUA MIN IVESS 1.5 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('AGUA MIN IVESS 2.25 SIN GAS', 'Bebidas', 'JAUREGUY'),
  ('AGUA MIN IVESS 0.5 CON GAS', 'Bebidas', 'JAUREGUY'),
  ('AGUA MIN IVESS SPORT 0.75', 'Bebidas', 'JAUREGUY'),
  ('BIDON POLICARB 20 LTS AZUL', 'Envases', 'POLIFORMAS SUDAMERICANAS'),
  ('BIDON POLICARB 12 LTS AZUL', 'Envases', 'POLIFORMAS SUDAMERICANAS'),
  ('REMERA JERSEY', 'Indumentaria', 'ABBATICCHIO LIDIA'),
  ('CHOMBA PIQUE', 'Indumentaria', 'ABBATICCHIO LIDIA'),
  ('CHALECO TRUCKER', 'Indumentaria', 'ABBATICCHIO LIDIA'),
  ('CAMISA', 'Indumentaria', 'ABBATICCHIO LIDIA'),
  ('BINAL 811', 'Limpieza y químicos', 'AXEL QUIMICA SRL'),
  ('BINAL CARBOLITE', 'Limpieza y químicos', 'AXEL QUIMICA SRL'),
  ('COVER TOP-TAPA SUPERIOR', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('COVER UP FRENTE SUP', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('CANILLA ROJA MACHO', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('CANILLA AZUL MACHO', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('RESISTENCIA LH', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('THERMOSTAT HOT', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('DISPENSER FRIO-CALOR DE PIE', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('DISPENSER FRIO-CALOR DE MESADA', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('PLASTIC DISPLAY LED', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('TAPA SUPERIOR 2000 BLANCA', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('BANDEJA GFO 2000 BLANCA', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('TAPA BANDEJA 2000 BLANCA', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('GOTERO CON TAPA LH', 'Dispensers y repuestos', 'LIVORE HNOS SRL'),
  ('TAPA ANTISEPTICA NATURAL', 'Tapas', 'SP PLASTICOS'),
  ('TAPA ANTISEPTICA VERDE', 'Tapas', 'SP PLASTICOS'),
  ('CAJON X 12 UNIDADES', 'Envases', 'IDEAS MODI'),
  ('SIFON 650 CC', 'Envases', 'IDEAS MODI'),
  ('SIFON 1500 CC', 'Envases', 'IDEAS MODI'),
  ('PREFORMA AZUL', 'Envases', 'SYPHON'),
  ('PREFORMA CRISTAL', 'Envases', 'SYPHON'),
  ('TAPAS PARA BID TRANSP', 'Envases', 'SYPHON'),
  ('ASAS PARA BID TRANSP', 'Envases', 'SYPHON'),
  ('BIDON POLICARB.20 LTS VERDE', 'Envases', 'PLASTICOS CAMILLO'),
  ('BIDON POLICARB. 12LTS VERDE', 'Envases', 'PLASTICOS CAMILLO'),
  ('CALCO BOTELLON IVESS HOGAR', 'Etiquetas', 'FORMAS SRL'),
  ('CALCO LEGALES X 20 LTS AZUL', 'Etiquetas', 'FORMAS SRL'),
  ('CALCO LEGALES X 12 LTS AZUL', 'Etiquetas', 'FORMAS SRL'),
  ('CALCO LEGALES X 20LTS VERDE', 'Etiquetas', 'FORMAS SRL'),
  ('CALCO LEGALES X 12 LTS VERDE', 'Etiquetas', 'FORMAS SRL'),
  ('ETIQUETAS MANTENIM DISP. A/N', 'Etiquetas', 'FORMAS SRL'),
  ('ETIQUETAS MANTENIM DISP F/C', 'Etiquetas', 'FORMAS SRL');

-- ---------------------------------------------------------------------
-- 1) Móviles
-- ---------------------------------------------------------------------
insert into _informe
select 1, 'Móviles', m.label || ' (' || m.patente || ')',
       case when t.id is null then 'AGREGADO · ' || case m.scope when 'both' then 'viajes y gastos' else 'solo gastos' end
            else 'ya estaba como "' || t.label || '"' end,
       lpad(m.id, 6, '0')
  from _moviles m left join trucks t on t.id = m.id;

insert into trucks (id, label, active, driver, helper, scope, patente, modelo, anio, funcion, flota)
select id, label, true, '', '', scope, patente, modelo, anio, funcion, flota from _moviles
on conflict (id) do nothing;

update trucks t set
  patente = case when coalesce(t.patente,'') = '' then m.patente else t.patente end,
  modelo  = case when coalesce(t.modelo,'')  = '' then m.modelo  else t.modelo  end,
  anio    = case when coalesce(t.anio,'')    = '' then m.anio    else t.anio    end,
  funcion = case when coalesce(t.funcion,'') = '' then m.funcion else t.funcion end,
  flota   = case when coalesce(t.flota,'')   = '' then m.flota   else t.flota   end
from _moviles m where m.id = t.id;

insert into _informe
select 2, 'Móviles · revisar', t.label || ' (id ' || t.id || ')',
       'está en la base pero NO en la planilla de móviles: ¿es otro número o se dio de baja?'
  from trucks t where not exists (select 1 from _moviles m where m.id = t.id);

-- ---------------------------------------------------------------------
-- 2) Proveedores que cargan artículos
-- ---------------------------------------------------------------------
create temp table _prov_match as
select pa.clave, p.id, p.nombre, p.lleva_articulos as ya_estaba
  from _prov_art pa
  join proveedores p
    on trim(regexp_replace(upper(p.nombre), '[^A-Z0-9Ñ]+', ' ', 'g')) like pa.buscar || '%'
    or trim(regexp_replace(upper(coalesce(p.nombre_fantasia,'')), '[^A-Z0-9Ñ]+', ' ', 'g')) like pa.buscar || '%';

update proveedores p set lleva_articulos = true
  from _prov_match m where m.id = p.id and not p.lleva_articulos;

insert into _informe
select 3, 'Proveedores', pa.clave,
       case when count(m.id) = 0 then 'NO ENCONTRADO: darlo de alta o tildarlo a mano'
            else string_agg(m.nombre || case when m.ya_estaba then ' (ya estaba tildado)' else ' → tildado' end, '; ')
            || case when count(m.id) > 1 then '  ⚠ hay más de uno con ese nombre: revisar' else '' end end
  from _prov_art pa left join _prov_match m on m.clave = pa.clave
 group by pa.clave;

-- ---------------------------------------------------------------------
-- 3) Artículos
-- ---------------------------------------------------------------------
create temp table _art_nuevos as
select a.*, row_number() over (order by a.orden) as n
  from _articulos a
 where not exists (select 1 from articulos x where lower(trim(x.descripcion)) = lower(trim(a.descripcion)));

insert into articulos (id, codigo, descripcion, unidad, categoria, activo, notas)
select 'art_' || substr(md5(lower(trim(a.descripcion))), 1, 12),
       lpad((coalesce((select max(codigo::bigint) from articulos where codigo ~ '^\d{1,15}$'), 0) + a.n)::text, 5, '0'),
       a.descripcion, 'Unidad', a.categoria, true, 'Proveedor habitual: ' || a.proveedor
  from _art_nuevos a
on conflict (id) do nothing;

insert into _informe
select 4, 'Artículos', a.proveedor || ' · ' || a.categoria,
       count(*) || ' en la lista: ' || count(n.descripcion) || ' agregados, ' || (count(*) - count(n.descripcion)) || ' ya existían'
  from _articulos a left join _art_nuevos n on n.orden = a.orden
 group by a.proveedor, a.categoria;

-- ---------------------------------------------------------------------
-- INFORME
-- ---------------------------------------------------------------------
select seccion, item, resultado from _informe order by orden, sub, item;

