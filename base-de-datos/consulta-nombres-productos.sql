-- =====================================================================
-- Nombres de productos en cada módulo (SOLO LECTURA sobre los datos)
-- =====================================================================
-- Para unificar cómo se llama cada producto en Comercial, Logística,
-- Calidad y Administración. Correr en el SQL Editor de Supabase, en la
-- base "Envios" (la de Gestión Anafer), y exportar el resultado a CSV.
--
-- Si alguna tabla no existe en la base elegida, no falla: lo avisa en el
-- listado con una fila "⚠ No está en esta base". Solo usa una tabla
-- temporal (_nombres) que desaparece al cerrar la sesión.
--
-- Columnas:
--   modulo · lista   de dónde sale el nombre
--   codigo           código interno (tipo de carga, clave de Comercial, código de artículo)
--   nombre           cómo lo escribe ese sector
--   usos             veces que aparece (viajes/visitas con esa carga, reclamos,
--                    meses con venta, facturas con ese artículo)
--   desde · hasta    primera y última vez que se usó
--   activo           si hoy se puede elegir al cargar
-- =====================================================================
drop table if exists _nombres;
create temp table _nombres (modulo text, lista text, codigo text, nombre text, usos bigint, desde date, hasta date, activo boolean);

do $$
declare
  falta text;
  partes text[] := '{}';
  t text;
begin
  -- ---------------- Logística: tipos de carga y su uso ----------------
  if to_regclass('public.cargo_types') is null then
    insert into _nombres values ('Logística', '⚠ No está en esta base', '', 'Falta la tabla cargo_types', null, null, null, null);
  else
    foreach t in array array['trips', 'visits', 'company_visits', 'occasional_visits'] loop
      if to_regclass('public.' || t) is not null then
        partes := partes || format('select date as d, cargo from %I', t);
      end if;
    end loop;
    if array_length(partes, 1) is null then
      partes := array['select null::date as d, ''[]''::jsonb as cargo where false'];
    end if;
    execute format($q$
      insert into _nombres
      with log_uso as (
        select c->>'type' as tipo, count(*) as usos, min(d) as desde, max(d) as hasta
        from (%s) v
        cross join lateral jsonb_array_elements(case when jsonb_typeof(v.cargo) = 'array' then v.cargo else '[]'::jsonb end) c
        group by 1
      )
      select 'Logística', 'Tipos de carga', t.id, t.name, coalesce(u.usos, 0), u.desde, u.hasta, t.active
        from cargo_types t left join log_uso u on u.tipo = t.id
      union all
      select 'Logística', 'Tipos de carga (borrados)', u.tipo, u.tipo, u.usos, u.desde, u.hasta, false
        from log_uso u where not exists (select 1 from cargo_types t where t.id = u.tipo)
    $q$, array_to_string(partes, ' union all '));
  end if;

  -- ---------------- Calidad: productos de reclamos ----------------
  if to_regclass('public.calidad_reclamos') is null then
    insert into _nombres values ('Calidad', '⚠ No está en esta base', '', 'Falta la tabla calidad_reclamos', null, null, null, null);
  else
    execute $q$
      insert into _nombres
      with cal_lista as (
        select coalesce(
          (select valores from calidad_listas where id = 'productos' and jsonb_typeof(valores) = 'array' and jsonb_array_length(valores) > 0),
          '["Bx5Azul","Bx8Azul","Bx12Azul","Bx20Azul","Bx5Verde","Bx8Verde","Bx12Verde","Bx20Verde","Soda Descartable","Soda retornable 1.5L","Soda retornable 650ml","Otro"]'::jsonb
        ) as valores
      ),
      cal_uso as (
        select producto, count(*) as usos, min(fecha) as desde, max(fecha) as hasta
          from calidad_reclamos where anulado_en is null and producto <> '' group by producto
      )
      select 'Calidad', 'Productos (reclamos)', '', p.nombre, coalesce(u.usos, 0), u.desde, u.hasta, true
        from cal_lista l cross join lateral jsonb_array_elements_text(l.valores) as p(nombre)
        left join cal_uso u on u.producto = p.nombre
      union all
      select 'Calidad', 'Productos (fuera de la lista)', '', u.producto, u.usos, u.desde, u.hasta, false
        from cal_uso u, cal_lista l
       where not exists (select 1 from jsonb_array_elements_text(l.valores) x where x = u.producto)
    $q$;
  end if;

  -- ---------------- Comercial: productos de ventas y presupuesto ----------------
  if to_regclass('public.comercial_producto_mensual') is null then
    insert into _nombres values ('Comercial', '⚠ No está en esta base', '', 'Falta la tabla comercial_producto_mensual', null, null, null, null);
  else
    execute $q$
      insert into _nombres
      select 'Comercial', 'Productos · ' || coalesce(nullif(unidad, ''), 'sin unidad'), coalesce(producto_clave, ''),
             (array_agg(producto order by anio desc, mes desc))[1],   -- el nombre más reciente
             count(*),
             make_date(min(anio * 100 + mes) / 100, min(anio * 100 + mes) % 100, 1),
             make_date(max(anio * 100 + mes) / 100, max(anio * 100 + mes) % 100, 1),
             bool_or(anio >= extract(year from current_date)::int - 1)
        from comercial_producto_mensual
       where coalesce(producto, '') <> ''
       group by unidad, producto_clave
    $q$;
  end if;

  -- ---------------- Administración: artículos y uso en facturas ----------------
  if to_regclass('public.articulos') is null then
    insert into _nombres values ('Administración', '⚠ No está en esta base', '', 'Falta la tabla articulos (correr articulos.sql)', null, null, null, null);
  else
    execute $q$
      insert into _nombres
      with adm_uso as (
        select a->>'articulo_id' as id, count(*) as usos, min(f.fecha::date) as desde, max(f.fecha::date) as hasta
          from facturas f
          cross join lateral jsonb_array_elements(case when jsonb_typeof(f.articulos) = 'array' then f.articulos else '[]'::jsonb end) a
         where f.anulado_en is null and f.estado is distinct from 'anulada'
         group by 1
      )
      select 'Administración', 'Artículos · ' || coalesce(nullif(a.categoria, ''), 'sin categoría'), a.codigo, a.descripcion,
             coalesce(u.usos, 0), u.desde, u.hasta, a.activo
        from articulos a left join adm_uso u on u.id = a.id
    $q$;
  end if;
end $$;

select * from _nombres order by modulo, lista, nombre;
