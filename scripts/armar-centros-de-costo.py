# Genera base-de-datos/centros-de-costo.sql desde el árbol del Excel CENTRO_DE_COSTOS.xlsx
# (escrito a mano para respetar acentos y códigos; ver Excel original).
import re, unicodedata, sys
def slug(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(c for c in s if unicodedata.category(c)!='Mn')
    return re.sub(r'[^a-z0-9]+','_',s).strip('_')
IS = ['Insumos','Servicios']
LINEAS = [('LINEA 1','Línea 1','Agua retornable'),('LINEA 2','Línea 2','Agua descartable'),('LINEA 3','Línea 3','Soda descartable'),
          ('LINEA 4','Línea 4','Soda retornable'),('TA','TA','Tratamiento de agua'),('SO','SO','Sopladora')]
def lineas(): return [(n, {'codigo':c, 'desc':d}) for c,n,d in LINEAS]
# Camiones (Excel v2, 15/10): cada móvil es su propio centro, ligado al camión de Logística.
MOVILES = ['13','20','32','41','17']
def moviles(): return [('Móvil '+m, {'ref':'movil:'+m}) for m in MOVILES]
# Sucursales (Excel v2): cada una es su propio centro, ligado a la sucursal de Logística.
SUCS = [('Sucursal Caleta','caleta_1'),('Sucursal KM12','km12'),('Sucursal KM5','km5'),('Sucursal KM8','km8'),
        ('Sucursal Rivadavia','rivadavia'),('Sucursal Kennedy','kennedy'),('Sucursal Polonia','polonia'),
        ('Sucursal Rada Tilly','rada_tilly'),('Sucursal Canadá','canada'),('Sucursal EEUU','eeuu')]
def suc(): return [(n,{'ref':'suc:'+i}) for n,i in SUCS] + [('Base',{}),('Sopladora',{}),('Taller',{})]
TREE = [
 ('Administración', [(x,{}) for x in IS]),
 ('Calidad', [(x,{}) for x in IS]),
 ('Control documentario', [(x,{}) for x in IS]),
 ('Impuestos', [('Imp. municipales',{}),('Imp. provinciales',{}),('Imp. nacionales',{})]),
 ('Logística', [('Depósito',{}),('Móviles',moviles()),('Impuestos',moviles())]),
 ('Mantenimiento', [
    ('Instalaciones', [('Insumos', suc()), ('Servicios', suc())]),
    ('Máquinas y equipos', [('Insumos', lineas()), ('Servicios', lineas())]),
    ('Dispenser', [(x,{}) for x in IS]),
    ('Flota', [('Insumos', moviles()), ('Servicios', moviles())]),   # un centro por móvil: costo de mantenimiento de cada camión
 ]),
 ('Producción y sopladora', [
    ('Insumos', lineas()),
    ('Materia prima', [('20',{'codigo':'20','desc':'Bidón 20 azul'}),('20V',{'codigo':'20V','desc':'Bidón 20 bajo sodio'}),
                       ('12',{'codigo':'12','desc':'Bidón 12'}),('12V',{'codigo':'12V','desc':'Bidón 12 bajo sodio'}),
                       ('8',{'codigo':'8','desc':'Bidón 8'}),('8V',{'codigo':'8V','desc':'Bidón 8 bajo sodio'}),
                       ('SR',{'codigo':'SR','desc':'Soda retornable'}),('SD',{'codigo':'SD','desc':'Soda descartable'})]),
 ]),
 ('Sucursales', [(x,{}) for x in IS]),
 ('Sueldos y cargas sociales', [('Sueldos',{}),('Servicios',{}),('Cargas sociales',{})]),
 ('Ventas', [('Bienes de cambio',{}),('Insumos',{}),('Servicios',{})]),
]
rows=[]
def walk(items, parent, path):
    for i,(name, sub) in enumerate(items):
        nid = 'cc_'+slug('_'.join(path+[name]))
        if isinstance(sub, dict):
            desc = sub.get('desc') and (name if name==sub.get('codigo') and False else None)
            codigo = sub.get('codigo','')
            d = sub['desc'] if 'desc' in sub else name
            if codigo and codigo not in ('20','20V','12','12V','8','8V','SR','SD'): d = name+' · '+sub['desc']; codigo=''
            rows.append((nid, codigo, d, parent, sub.get('req',''), i+1, sub.get('ref','')))
        else:
            rows.append((nid, '', name, parent, '', i+1, ''))
            walk(sub, nid, path+[name])
walk(TREE, None, [])
def q(v): return 'null' if v is None else "'"+str(v).replace("'","''")+"'"
ids=[r[0] for r in rows]; assert len(ids)==len(set(ids))
v1=[l.strip() for l in open(sys.argv[2])] if len(sys.argv)>2 else []
obs=sorted(set(v1)-set(ids))
OBSOLETOS = ('-- Centros de la versión anterior del árbol que ya no están (reemplazados por\n-- un centro por móvil y por sucursal): quedan inactivos, sin perder facturas.\n'
  + ("update centros_costo set activo = false where id in (" + ", ".join(q(x) for x in obs) + ");\n" if obs else ""))
out=["""-- =====================================================================
-- Centros de costo de ANAFER SA (árbol del Excel CENTRO_DE_COSTOS.xlsx)
-- =====================================================================
-- Correr DESPUÉS de schema.sql. Se puede correr más de una vez.
-- - Carga el árbol nuevo (ids "cc_..."). Solo se imputa a las hojas (las
--   ramas sin hijos); "requiere" = movil | sucursal pide además el camión o la
--   sucursal al cargar la factura.
-- - Los centros de costo anteriores (los que vinieron del sistema viejo)
--   quedan INACTIVOS: no aparecen para cargar, pero las facturas y los
--   proveedores que ya los tienen los conservan.
-- - "ref_fijo" liga un centro a un camión ("movil:13") o a una sucursal
--   ("suc:km12"): así los gastos se suman por móvil y por sucursal.
-- =====================================================================
alter table centros_costo add column if not exists ref_fijo text not null default '';

insert into centros_costo (id, codigo, descripcion, parent_id, requiere, orden, ref_fijo, activo) values"""]
out.append(',\n'.join('  (%s, %s, %s, %s, %s, %d, %s, true)'%(q(a),q(b),q(c),q(d),q(e),f,q(g)) for a,b,c,d,e,f,g in rows))
out.append("""on conflict (id) do update set codigo = excluded.codigo, descripcion = excluded.descripcion,
  parent_id = excluded.parent_id, requiere = excluded.requiere, orden = excluded.orden,
  ref_fijo = excluded.ref_fijo;

-- Los anteriores (no "cc_") quedan inactivos
update centros_costo set activo = false where id not like 'cc\\_%';
""" + OBSOLETOS + """

-- Control: activos del árbol nuevo / inactivos anteriores
select count(*) filter (where activo) as activos, count(*) filter (where not activo) as inactivos from centros_costo;
""")
open(sys.argv[1],'w').write('\n'.join(out))
print(len(rows),'nodos')
