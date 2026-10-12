"""Convierte el CSV de fichajes-exportar.sql en el script de mudanza para la base de Gestión."""
import csv, sys, re, json, collections
src, out = sys.argv[1], sys.argv[2]
csv.field_size_limit(10**9)
rows = list(csv.DictReader(open(src, encoding='utf-8-sig')))
by = collections.defaultdict(list)
for r in rows: by[r['tipo']].append(r)

def safe(stmt, extra=''):
    stmt = stmt.rstrip().rstrip(';')
    return ("do $m$ begin\n  execute %s;\nexception when duplicate_object or duplicate_table or invalid_table_definition%s then null;\nend $m$;"
            % ("$q$" + stmt + "$q$", extra))

L = []
L.append("""-- ============================================================
-- MUDANZA DE FICHAJES A LA BASE ÚNICA (la de Gestión)
-- Generado a partir del CSV exportado de la base de Fichajes.
-- Se corre UNA vez en el proyecto de GESTIÓN (sjhonbjphfacajftptgg),
-- DESPUÉS del schema.sql de Gestión. Es seguro volver a correrlo:
-- no duplica datos (on conflict do nothing) ni rompe lo ya creado.
-- No toca ninguna tabla de Gestión.
-- ============================================================
create extension if not exists pgcrypto with schema extensions;
create extension if not exists "uuid-ossp" with schema extensions;
""")
L.append("-- 1) Secuencias")
for r in by['secuencia']: L.append(r['sql'])
L.append("\n-- 2) Tablas")
for r in by['tabla']: L.append(r['sql'])
L.append("\n-- 3) Claves y restricciones")
fks = []
skipped = []
for r in by['restriccion']:
    s = r['sql']
    if re.search(r'REFERENCES\s+auth\.', s):
        skipped.append(r['objeto']); continue   # usuarios de auth de la base vieja: no existen acá
    if 'FOREIGN KEY' in s: fks.append(r); continue
    L.append(safe(s))
for r in fks: L.append(safe(r['sql']))
if skipped: L.append("-- (omitidas, apuntaban a usuarios de la base vieja: %s)" % ', '.join(skipped))
# Columnas cuyo número sale de una secuencia/identity y que el exportador no trajo como default
seqs = [r['objeto'] for r in by['secuencia']]
tabla_sql = {r['objeto']: r['sql'] for r in by['tabla']}
seq_cols = []
for sq in seqs:
    for t in sorted(tabla_sql, key=len, reverse=True):
        if sq.startswith(t + '_') and sq.endswith('_seq'):
            col = sq[len(t)+1:-4]
            if re.search(r'\b%s \w[\w ]*?(?<!default nextval)' % re.escape(col), tabla_sql[t]) and ("nextval('%s'" % sq) not in tabla_sql[t] and ("nextval('public.%s'" % sq) not in tabla_sql[t]:
                seq_cols.append((t, col, sq))
            break
if seq_cols:
    L.append("\n-- 3b) Numeración automática (identity/secuencia) de columnas sin default exportado")
    for t, col, sq in seq_cols:
        L.append("alter sequence public.%s owned by public.%s.%s;" % (sq, t, col))
        L.append("alter table public.%s alter column %s set default nextval('public.%s');" % (t, col, sq))

L.append("\n-- 4) Índices")
for r in by['indice']: L.append(r['sql'])

L.append("""
-- 5) Permisos de RR.HH. según ⚙ → Acceso de Gestión
-- Quién puede usar el panel de RR.HH.: usuario activo cuyo perfil tiene
-- "Panel RR.HH." en Ver/Editar (o administra accesos y no tiene el permiso
-- definido). es_admin() (la que usaban las políticas de Fichajes) pasa a ser
-- "RR.HH. en Editar".
create or replace function public.gestion_permiso_rrhh() returns text
language sql security definer stable set search_path = public as $$
  select coalesce((
    select coalesce(r -> 'permisos' ->> 'rrhh',
                    case when coalesce((r ->> 'manageAccess')::boolean, false) then 'editar' else 'oculta' end)
    from usuarios u
    join app_config c on c.id = 'auth'
    cross join lateral jsonb_array_elements(coalesce(c.roles, '[]'::jsonb)) r
    where u.email = lower(coalesce(auth.jwt() ->> 'email', '')) and u.activo and r ->> 'id' = u.perfil
    limit 1), 'oculta');
$$;
create or replace function public.gestion_puede_rrhh() returns boolean
language sql security definer stable set search_path = public as $$
  select public.gestion_permiso_rrhh() in ('ver', 'editar');
$$;
create or replace function public.es_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select public.gestion_permiso_rrhh() = 'editar';
$$;
""")
L.append("-- 6) Funciones de Fichajes (login de empleados, fichar, solicitudes...)")
for r in by['funcion']:
    if r['objeto'] == 'es_admin':
        L.append("-- es_admin(): reemplazada arriba por la versión basada en los perfiles de Gestión"); continue
    sql = r['sql']
    if r['objeto'] == 'set_pin_admin':
        # En la base vieja cualquiera con la clave pública podía cambiar el PIN de cualquier empleado.
        sql = re.sub(r"\$function\$\s*begin", "$function$\nbegin\n  if not public.es_admin() then\n    return json_build_object('ok', false, 'motivo', 'sin_permiso');\n  end if;", sql, count=1)
        assert 'sin_permiso' in sql, 'no pude proteger set_pin_admin'
        L.append("-- set_pin_admin: protegida, solo RR.HH. en Editar puede cambiar PINs")
        L.append(sql)
        L.append("revoke execute on function public.set_pin_admin(integer, text) from public, anon;")
        L.append("grant execute on function public.set_pin_admin(integer, text) to authenticated;")
        continue
    L.append(sql)
L.append("\n-- 7) Seguridad por filas")
for r in by['rls']: L.append(r['sql'])
L.append("""
-- 8) Políticas. Las de "admin" de Fichajes dejaban hacer todo a cualquier
-- usuario logueado (using true); en la base compartida se limitan a quienes
-- tienen permiso de RR.HH. Las de lectura pública (las que usa el fichaje de
-- los empleados) quedan igual.""")
for r in by['politica']:
    s = r['sql']
    m = re.match(r'create policy (".*?"|\S+) on (public\.\S+) ', s)
    name, tabla = m.group(1), m.group(2)
    to_auth = re.search(r' to authenticated\b', s) is not None
    # admin con using true → permiso RR.HH.
    if to_auth:
        s = s.replace(' using (true)', ' using (public.gestion_puede_rrhh())').replace(' with check (true)', ' with check (public.gestion_puede_rrhh())')
    # chequeos contra la tabla profiles de la base vieja → es_admin()
    s = re.sub(r'\(EXISTS \( SELECT 1\s+FROM profiles\s+WHERE \(\(profiles\.id = auth\.uid\(\)\) AND \(profiles\.role = \'admin\'::text\)\)\)\)', '(public.es_admin())', s, flags=re.S)
    L.append("drop policy if exists %s on %s;" % (name, tabla))
    L.append(s)

L.append("""
-- 8b) Archivos de legajos (bucket privado; en la base vieja estaba vacío)
insert into storage.buckets (id, name, public) values ('legajos', 'legajos', false) on conflict (id) do nothing;
drop policy if exists "rrhh legajos" on storage.objects;
create policy "rrhh legajos" on storage.objects for all to authenticated
  using (bucket_id = 'legajos' and public.gestion_puede_rrhh())
  with check (bucket_id = 'legajos' and public.gestion_puede_rrhh());""")

# orden de datos según las claves foráneas
tablas = [r['objeto'] for r in by['tabla']]
deps = {t: set() for t in tablas}
for r in fks:
    t = r['objeto'].split('.')[0]
    m = re.search(r'REFERENCES\s+(?:public\.)?("?)(\w+)\1', r['sql'])
    if m and m.group(2) in deps and m.group(2) != t: deps[t].add(m.group(2))
orden, vis = [], set()
def visit(t):
    if t in vis: return
    vis.add(t)
    for d in sorted(deps[t]): visit(d)
    orden.append(t)
for t in sorted(tablas): visit(t)
datos = {r['objeto']: r['sql'] for r in by['datos']}
L.append("\n-- 9) Datos (en orden, respetando las claves foráneas)")
resumen = []
for t in orden:
    if t not in datos: continue
    filas = json.loads(datos[t])
    resumen.append((t, len(filas)))
    if t == 'profiles':
        L.append("-- profiles: no se copia (eran los usuarios de la base vieja; ahora manda ⚙ → Acceso → Usuarios). Filas: %d" % len(filas)); continue
    if not filas: continue
    for i in range(0, len(filas), 500):
        chunk = json.dumps(filas[i:i+500], ensure_ascii=False)
        tag = '$d$'
        while tag in chunk: tag = tag[:-1] + 'x$'
        L.append("insert into public.%s select * from json_populate_recordset(null::public.%s, %s%s%s) on conflict do nothing;" % (t, t, tag, chunk, tag))
L.append("\n-- 10) Secuencias al día (para que los próximos ids no choquen)")
for r in by['tabla']:
    for m in re.finditer(r"(\w+|\"[^\"]+\") \w[\w ]*? default nextval\('([^']+)'::regclass\)", r['sql']):
        col, seq = m.group(1), m.group(2)
        L.append("select setval('public.%s', greatest((select coalesce(max(%s), 0) from public.%s), 1));" % (seq.replace('public.',''), col, r['objeto']))
for t, col, sq in seq_cols:
    L.append("select setval('public.%s', greatest((select coalesce(max(%s), 0) from public.%s), 1));" % (sq, col, t))
L.append("\n-- Control: filas por tabla después de la mudanza")
L.append("select * from (values %s) as esperado(tabla, filas_en_la_base_vieja);" % ', '.join("('%s', %d)" % x for x in resumen))
open(out, 'w', encoding='utf-8').write('\n'.join(L) + '\n')
print('tablas:', len(tablas), '| orden datos:', orden, '| filas:', resumen)
