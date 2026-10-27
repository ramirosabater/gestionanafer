-- =====================================================================
-- Corrección de la flota: planilla moviles.xlsx (26/10/2026)
-- =====================================================================
-- La planilla MOVILES_FLOTA_1.xls que se usó en flota-y-articulos.sql
-- estaba mal. Este script deja la flota según la planilla correcta
-- (25 móviles). Se puede correr aunque flota-y-articulos.sql no se haya
-- corrido, y más de una vez.
--
--  1) Los móviles que dio de alta flota-y-articulos.sql y NO están en la
--     planilla correcta (2, 7, 18, 24, 28) se BORRAN. Si alguno ya se usó
--     en un viaje, visita o factura, no se borra: se desactiva.
--     Solo se tocan los que creó ese script (se reconocen por el nombre que
--     les puso); los camiones que ya estaban antes no se borran nunca.
--  2) Los 25 de la planilla correcta:
--     - los que falten se agregan (camiones -> viajes y gastos; utilitarios
--       y el acoplado -> solo gastos);
--     - a todos se les corrige patente y modelo según la planilla;
--     - año, función y flota que había puesto la planilla mala se borran;
--     - a los que creó flota-y-articulos.sql se les corrige el nombre y el
--       alcance (con la misma regla);
--       a los que ya estaban antes se les respeta nombre, chofer y alcance.
-- Al final muestra un INFORME.
-- =====================================================================
alter table trucks add column if not exists patente text not null default '';
alter table trucks add column if not exists modelo  text not null default '';
alter table trucks add column if not exists anio    text not null default '';
alter table trucks add column if not exists funcion text not null default '';
alter table trucks add column if not exists flota   text not null default '';

drop table if exists _inf, _ok, _mal;
create temp table _inf (orden int, sub text, item text, resultado text);

-- planilla correcta: id, nombre, alcance, patente, modelo
create temp table _ok (id text, label text, scope text, patente text, modelo text);
insert into _ok values
  ('5', 'Camión 5 · M. Benz Accelo 1016', 'both', 'AB329EO', 'M. Benz Accelo 1016'),
  ('8', 'Camión 8 · F-4000', 'both', 'OTY241', 'F-4000'),
  ('11', 'Camión 11 · F. Cargo 916', 'both', 'AA900FJ', 'F. Cargo 916'),
  ('12', 'Camión 12 · F-4000', 'both', 'PMP719', 'F-4000'),
  ('13', 'Camión 13 · Scania 310', 'both', 'MVY160', 'Scania 310'),
  ('14', 'Camión 14 · F-4000', 'both', 'KGJ758', 'F-4000'),
  ('15', 'Camión 15 · F. Cargo 915', 'both', 'LII697', 'F. Cargo 915'),
  ('16', 'Acoplado 16', 'gastos', 'LSE846', 'Acoplado'),
  ('17', 'Camión 17 · F. Cargo 1722', 'both', 'ITQ964', 'F. Cargo 1722'),
  ('20', 'Camión 20 · F. Cargo 1722', 'both', 'NAE255', 'F. Cargo 1722'),
  ('22', 'Camión 22 · F-4000', 'both', 'OTY242', 'F-4000'),
  ('26', 'Camión 26 · F. Cargo 1722', 'both', 'NEI877', 'F. Cargo 1722'),
  ('27', 'Móvil 27 · Fiat uno cargo', 'gastos', 'NSL491', 'Fiat uno cargo'),
  ('30', 'Móvil 30 · Kangoo', 'gastos', 'NRL950', 'Kangoo'),
  ('31', 'Móvil 31 · Kangoo', 'gastos', 'AA580FW', 'Kangoo'),
  ('32', 'Camión 32 · F. Cargo 1722', 'both', 'OTY318', 'F. Cargo 1722'),
  ('33', 'Camión 33 · M. Benz Accelo 1016', 'both', 'AB329EP', 'M. Benz Accelo 1016'),
  ('34', 'Camión 34 · F. Cargo 916', 'both', 'AD339WF', 'F. Cargo 916'),
  ('35', 'Móvil 35 · Sprinter', 'gastos', 'AE021QC', 'Sprinter'),
  ('36', 'Camión 36 · M. Benz Accelo 1016', 'both', 'AF123CZ', 'M. Benz Accelo 1016'),
  ('37', 'Camión 37 · M. Benz Accelo 1016', 'both', 'AF231XK', 'M. Benz Accelo 1016'),
  ('38', 'Móvil 38 · Kangoo II Express', 'gastos', 'AF459XE', 'Kangoo II Express'),
  ('39', 'Móvil 39 · M. Benz Vito', 'gastos', 'AC917AW', 'M. Benz Vito'),
  ('40', 'Camión 40 · M. Benz Accelo 1016/36', 'both', 'AG998SF', 'M. Benz Accelo 1016/36'),
  ('41', 'Camión 41 · M. Benz Atego 1729', 'both', 'AG421CA', 'M. Benz Atego 1729');

-- lo que había cargado flota-y-articulos.sql: id, nombre, patente, modelo, año, función, flota
create temp table _mal (id text, label text, patente text, modelo text, anio text, funcion text, flota text);
insert into _mal values
  ('2', 'Camión 2 · Daily 70c16', 'PGG-000', 'Daily 70c16', '2016', 'Reparto', 'Pesada'),
  ('5', 'Camión 5 · Accelo 1016', 'AB 329 EO', 'Accelo 1016', '2017', 'Reparto', 'Pesada'),
  ('7', 'Autoelevador 7', 'AYZ 89', 'Autoelevador', '2009', 'Depósito', 'Autoelevador'),
  ('8', 'Camión 8 · Ford 4000', 'OTY 241', 'Ford 4000', '2015', 'Reparto', 'Pesada'),
  ('11', 'Camión 11 · Cargo 916', 'AA900FJ', 'Cargo 916', '2017', 'Reparto', 'Pesada'),
  ('12', 'Camión 12 · Cargo 915', 'PMP 719', 'Cargo 915', '2016', 'Reparto', 'Pesada'),
  ('13', 'Camión 13 · Scania 310', 'MYV 160', 'Scania 310', '2013', 'Reparto empresas', 'Pesada'),
  ('14', 'Camión 14 · Ford 4000', 'KGJ 758', 'Ford 4000', '2011', 'Reparto', 'Pesada'),
  ('15', 'Camión 15 · Cargo 915', 'LII 697', 'Cargo 915', '2012', 'Reparto', 'Pesada'),
  ('16', 'Acoplado 16', 'LSE 846', 'Acoplado', '2012', 'Reparto empresas', 'Pesada'),
  ('17', 'Camión 17 · Cargo 1722', 'ITQ 964', 'Cargo 1722', '2010', 'Depósito', 'Pesada'),
  ('18', 'Autoelevador 18', 'ASK 076', 'Autoelevador', '2005', 'Depósito', 'Autoelevador'),
  ('20', 'Camión 20 · CARGO 1722e', 'NAE 255', 'CARGO 1722e', '2013', 'Reparto empresas', 'Pesada'),
  ('22', 'Camión 22 · Ford 4000', 'OTY 242', 'Ford 4000', '2015', 'Reparto', 'Pesada'),
  ('24', 'Camión 24 · Cargo 915', 'OCA 671', 'Cargo 915', '2014', 'Reparto', 'Pesada'),
  ('26', 'Camión 26 · Cargo 1722 E', 'NEI 877', 'Cargo 1722 E', '2014', 'Depósito', 'Pesada'),
  ('27', 'Móvil 27 · Fiat Uno Cargo', 'NSL 491', 'Fiat Uno Cargo', '2014', 'Administración', 'Liviana'),
  ('28', 'Autoelevador 28', 'BQL 26', 'Autoelevador', '2010', 'Depósito', 'Autoelevador'),
  ('30', 'Móvil 30 · Kangoo', 'NRL 950', 'Kangoo', '2014', 'Administración', 'Liviana'),
  ('31', 'Móvil 31 · Kangoo', 'AA580FW', 'Kangoo', '2017', 'Administración', 'Liviana'),
  ('32', 'Camión 32 · CARGO 1722 e Bal', 'OTY 318', 'CARGO 1722 e Bal', '2015', 'Reparto empresas', 'Pesada'),
  ('33', 'Camión 33 · Accelo 1016', 'AB 329 EP', 'Accelo 1016', '2017', 'Reparto', 'Pesada'),
  ('34', 'Camión 34 · Cargo 916', 'AD339WF', 'Cargo 916', '2018', 'Reparto', 'Pesada'),
  ('35', 'Móvil 35 · Sprinter', 'AE 021 QC', 'Sprinter', '2019', 'Depósito', 'Liviana'),
  ('36', 'Camión 36 · Accelo 1016', 'AF 123 CZ', 'Accelo 1016', '2022', 'Reparto', 'Pesada'),
  ('37', 'Camión 37 · Accelo 1016', 'AF 231 XK', 'Accelo 1016', '2022', 'Depósito', 'Pesada'),
  ('38', 'Móvil 38 · Kangoo', 'AF 459 XE', 'Kangoo', '2022', 'Depósito', 'Liviana'),
  ('39', 'Móvil 39 · Vitto', 'AC 917 AW', 'Vitto', '2018', 'Depósito', 'Liviana'),
  ('40', 'Camión 40 · Accelo 1016', 'AG998SF', 'Accelo 1016', '2025', 'Reparto empresas', 'Pesada'),
  ('41', 'Camión 41 · Atego', 'AG 241 CA', 'Atego', '2025', 'Reparto', 'Pesada');

-- ---------------------------------------------------------------------
-- 1) Bajas: los que creó el script anterior y no están en la planilla
-- ---------------------------------------------------------------------
create temp table _baja as
select t.id, t.label,
       (exists (select 1 from trips where truck = t.id)
        or exists (select 1 from visits where truck = t.id)
        or exists (select 1 from company_visits where truck = t.id)
        or exists (select 1 from occasional_visits where truck = t.id)
        or exists (select 1 from facturas f where f.cc_ref = 'movil:' || t.id
                     or exists (select 1 from jsonb_array_elements(case when jsonb_typeof(f.items) = 'array' then f.items else '[]'::jsonb end) it
                                 where it->>'cc_ref' = 'movil:' || t.id))
        or exists (select 1 from centros_costo where ref_fijo = 'movil:' || t.id)) as usado
  from trucks t join _mal m on m.id = t.id and m.label = t.label
 where not exists (select 1 from _ok o where o.id = t.id);

insert into _inf select 1, lpad(id, 6, '0'), label,
  case when usado then 'DESACTIVADO (ya tenía viajes, visitas o gastos: no se puede borrar)' else 'BORRADO' end from _baja;
update trucks set active = false where id in (select id from _baja where usado);
delete from trucks where id in (select id from _baja where not usado);

insert into _inf select 1, lpad(m.id, 6, '0'), t.label, 'no está en la planilla correcta, pero ya existía antes: no se tocó (revisar a mano)'
  from _mal m join trucks t on t.id = m.id
 where m.label <> t.label and not exists (select 1 from _ok o where o.id = m.id);

-- ---------------------------------------------------------------------
-- 2) Planilla correcta
-- ---------------------------------------------------------------------
insert into _inf
select 2, lpad(o.id, 6, '0'), o.label || ' (' || o.patente || ')',
       case when t.id is null then 'AGREGADO · ' || case o.scope when 'both' then 'viajes y gastos' else 'solo gastos' end
            when m.id is not null and m.label = t.label then 'corregido (lo había creado el script anterior)'
            else 'ya estaba como "' || t.label || '": se corrigió patente y modelo' end
  from _ok o left join trucks t on t.id = o.id left join _mal m on m.id = o.id;

-- nombre: solo en los que creó el script anterior
update trucks t set label = o.label, scope = o.scope
  from _ok o, _mal m where o.id = t.id and m.id = t.id and m.label = t.label;

insert into trucks (id, label, active, driver, helper, scope, patente, modelo)
select id, label, true, '', '', scope, patente, modelo from _ok
on conflict (id) do nothing;

update trucks t set patente = o.patente, modelo = o.modelo, active = true
  from _ok o where o.id = t.id;

-- datos de la planilla mala que no están en la correcta
update trucks t set
  anio    = case when t.anio    = m.anio    then '' else t.anio    end,
  funcion = case when t.funcion = m.funcion then '' else t.funcion end,
  flota   = case when t.flota   = m.flota   then '' else t.flota   end
  from _mal m where m.id = t.id;

insert into _inf
select 3, lpad(t.id, 6, '0'), t.label || ' (id ' || t.id || ')',
       case when t.active then 'activo' else 'inactivo' end || ' · está en la base pero NO en la planilla correcta: ¿se da de baja?'
  from trucks t where not exists (select 1 from _ok o where o.id = t.id) and not exists (select 1 from _baja b where b.id = t.id and not b.usado);

-- ---------------------------------------------------------------------
-- INFORME
-- ---------------------------------------------------------------------
select case orden when 1 then 'Bajas' when 2 then 'Planilla correcta' else 'Revisar' end as seccion, item, resultado
  from _inf order by orden, sub;
