(function(){
  "use strict";

  // ---------- Static reference data ----------
  var DEFAULT_ROUTES = [
    {id:'80',   label:'80',     order:1},
    {id:'82',   label:'82',     order:2},
    {id:'81',   label:'81',     order:3},
    {id:'50',   label:'50',     order:4},
    {id:'52',   label:'52',     order:5},
    {id:'YAC',  label:'YAC',    order:6},
    {id:'51',   label:'51',     order:7},
    {id:'L12',  label:'L 1-2',  order:8},
    {id:'SARM', label:'SARM.',  order:9},
    {id:'ANTI', label:'ANTI.',  order:10},
    {id:'56',   label:'56',     order:11},
    {id:'MINE', label:'MINE.',  order:12},
    {id:'MAN',  label:'MAN',    order:13}
  ];
  var DEFAULT_TRUCKS = [
    {id:'13', label:'Camión 13', driver:'', helper:'', scope:'both'},
    {id:'20', label:'Camión 20', driver:'', helper:'', scope:'both'},
    {id:'32', label:'Camión 32', driver:'', helper:'', scope:'both'},
    {id:'41', label:'Camión 41', driver:'', helper:'', scope:'both'},
    {id:'17', label:'Camión 17', driver:'', helper:'', scope:'both'},
    {id:'4000', label:'Camión 4000', driver:'', helper:'', scope:'sucursales'}
  ];
  // Choferes y ayudantes: mismo pool de 11 personas para los dos roles — cada
  // una puede aparecer como chofer o como ayudante (ver personRow / scope).
  // 6 trabajan tanto FlotaPesada como Sucursales (scope 'both'); las otras 5
  // solo Sucursales.
  var FLOTA_Y_SUCURSALES_PEOPLE = ['Ancao','Scarttezzini','Haro','Lopez','Cornejo','Sardak'];
  var SOLO_SUCURSALES_PEOPLE = ['Molina Victor','Garcia Fernando','Peralta Franco','Martin Ivan','Rojas'];
  function buildPersonDefaults(){
    return FLOTA_Y_SUCURSALES_PEOPLE.map(function(n){ return {id:slug(n), name:n, active:true, scope:'both'}; })
      .concat(SOLO_SUCURSALES_PEOPLE.map(function(n){ return {id:slug(n), name:n, active:true, scope:'sucursales'}; }));
  }
  var DEFAULT_DRIVERS = buildPersonDefaults();
  var DEFAULT_HELPERS = buildPersonDefaults();
  var DEFAULT_CARGO_TYPES = [
    'S1500','S2000','S175 B/S','A1.5','A2.25','A500','A/G 500','X8','X20','X12',
    'SAB1.5','SAB500','CAJ','DISP','EX12','EX20','EVS1500','X8V','X12V','X20V',
    'EX12V','EX20V','PROMO MUNDIAL','M F/C','BBA','VASOS','CAN','R-8','R12/20','SPORT',
    'SIFON DESC','BMB AUT.','MATE'
  ].map(function(n,i){ return {id:slug(n), name:n, active:true, order:i+1}; });

  // Sucursales: mismo catálogo de tipos de carga que FlotaPesada (arriba),
  // pero una lista propia de puntos de entrega. Activas/inactivas según el
  // histórico real (Consolidado 2021-2026): las inactivas son sucursales que
  // dejaron de recibir envíos hace más de unos meses.
  var DEFAULT_BRANCHES = [
    {id:'rivadavia',   label:'Rivadavia',    order:1,  active:true},
    {id:'km5',         label:'KM5',          order:2,  active:true},
    {id:'km8',         label:'KM8',          order:3,  active:true},
    {id:'km12',        label:'KM12',         order:4,  active:true},
    {id:'kennedy',     label:'Kennedy',      order:5,  active:true},
    {id:'polonia',     label:'Polonia',      order:6,  active:true},
    {id:'rada_tilly',  label:'Rada Tilly',   order:7,  active:true},
    {id:'caleta_1',    label:'Caleta 1',     order:8,  active:true},
    {id:'canada',      label:'Canadá',       order:9,  active:true},
    {id:'eeuu',        label:'EEUU',         order:10, active:true},
    {id:'palazzo',     label:'Palazzo',      order:11, active:false},
    {id:'km3',         label:'KM3',          order:12, active:false},
    {id:'caleta_2',    label:'Caleta 2',     order:13, active:false},
    {id:'base_caleta', label:'Base Caleta',  order:14, active:false}
  ];

  // Historical pattern learned from el histórico completo cargado en Supabase
  // (viajes reales, oct 2019 - sept 2026), recalculado sobre los últimos 24
  // meses (sept 2024 - sept 2026) para reflejar la flota y operación actual.
  // Used only to compute suggestions client-side — never written to the database.
  var PATTERN = {
    "81":  {weekdayFreq:[0.171,0.152,0.086,0.076,0.087,0,0],   dominantTruck:"20"},
    "L12": {weekdayFreq:[0.381,0.314,0.276,0.343,0.375,0.192,0], dominantTruck:"41"},
    "SARM":{weekdayFreq:[0.067,0.086,0.067,0.086,0.077,0.019,0], dominantTruck:"32"},
    "80":  {weekdayFreq:[0.152,0.39,0.667,0.724,0.673,0.01,0], dominantTruck:"13"},
    "50":  {weekdayFreq:[0.238,0.448,0.419,0.333,0.279,0,0],   dominantTruck:"41"},
    "MAN": {weekdayFreq:[0.038,0.048,0.076,0.19,0.154,0,0],    dominantTruck:"36"},
    "YAC": {weekdayFreq:[0.114,0.095,0.038,0.057,0.067,0,0],   dominantTruck:"32"},
    "52":  {weekdayFreq:[0.143,0.152,0.086,0.086,0.173,0,0],   dominantTruck:"32"},
    "51":  {weekdayFreq:[0.2,0.143,0.067,0.095,0.144,0,0],     dominantTruck:"32"},
    "MINE":{weekdayFreq:[0.114,0.105,0.038,0.133,0.144,0.038,0], dominantTruck:"13"},
    "56":  {weekdayFreq:[0.067,0.076,0.152,0.057,0.077,0,0],   dominantTruck:"20"},
    "82":  {weekdayFreq:[0.01,0.038,0.086,0.124,0.038,0,0],    dominantTruck:"13"},
    "ANTI":{weekdayFreq:[0.01,0,0,0,0,0,0],                    dominantTruck:null}
  };

  // Sucursales: patrón real de visitas por día de semana, calculado a partir
  // de las hojas mensuales del Excel de sucursales (una fila por día real de
  // envío, no el resumen de Consolidado), sobre los últimos 24 meses
  // (sept 2024 - ago 2026) para reflejar la operación actual. weekdayFreq[i]
  // es la fracción de esos días de semana (0=lunes..6=domingo) en que hubo
  // una visita real; perWeek es la cantidad de visitas semanales típica de
  // esa sucursal, redondeada (visitas totales / semanas activas). Se usa
  // para elegir en qué días del mes sugerir una visita — los "perWeek" días
  // de semana con mayor frecuencia. Nunca se escribe en la base.
  var BRANCH_VISIT_PATTERN = {
    "rivadavia": {weekdayFreq:[0.476,0.442,0.462,0.433,0.423,0.346,0.0], perWeek:3},
    "km5": {weekdayFreq:[0.305,0.462,0.346,0.288,0.51,0.192,0.0], perWeek:2},
    "km8": {weekdayFreq:[0.286,0.394,0.385,0.231,0.49,0.26,0.0], perWeek:2},
    "km12": {weekdayFreq:[0.295,0.349,0.209,0.209,0.163,0.205,0.0], perWeek:1},
    "kennedy": {weekdayFreq:[0.41,0.423,0.452,0.365,0.365,0.413,0.01], perWeek:2},
    "polonia": {weekdayFreq:[0.333,0.337,0.452,0.346,0.279,0.288,0.01], perWeek:2},
    "rada_tilly": {weekdayFreq:[0.343,0.375,0.221,0.317,0.346,0.337,0.0], perWeek:2},
    "caleta_1": {weekdayFreq:[0.657,0.587,0.452,0.5,0.625,0.24,0.0], perWeek:3},
    "canada": {weekdayFreq:[0.2,0.5,0.25,0.0,0.5,0.4,0.0], perWeek:2},
    "eeuu": {weekdayFreq:[0.48,0.39,0.4,0.38,0.41,0.293,0.0], perWeek:2},
    "palazzo": {weekdayFreq:[0.262,0.295,0.295,0.393,0.361,0.133,0.0], perWeek:2}
  };

  // Cantidad promedio de cada producto POR VISITA (no por mes) para cada
  // sucursal, calculada sobre las mismas visitas reales y el mismo período
  // de 24 meses que BRANCH_VISIT_PATTERN. Solo se listan los productos con
  // promedio mayor a cero. km3, caleta_2 y base_caleta no tienen envíos en
  // ese período (dejaron de operar antes) y por eso no tienen patrón.
  var BRANCH_CARGO_PATTERN = {
    "rivadavia": [{type:"s1500",qty:25}, {type:"s2000",qty:6}, {type:"s175_b_s",qty:2}, {type:"a1_5",qty:5}, {type:"a2_25",qty:2}, {type:"a500",qty:5}, {type:"a_g_500",qty:1}, {type:"x8",qty:11}, {type:"x20",qty:165}, {type:"x12",qty:52}, {type:"sab1_5",qty:8}, {type:"sab500",qty:2}, {type:"disp",qty:3}, {type:"ex20",qty:3}, {type:"x12v",qty:31}, {type:"x20v",qty:51}, {type:"ex20v",qty:2}],
    "km5": [{type:"s1500",qty:25}, {type:"s2000",qty:7}, {type:"s175_b_s",qty:3}, {type:"a1_5",qty:1}, {type:"a2_25",qty:1}, {type:"a500",qty:2}, {type:"x8",qty:11}, {type:"x20",qty:68}, {type:"x12",qty:34}, {type:"sab1_5",qty:5}, {type:"sab500",qty:1}, {type:"disp",qty:2}, {type:"ex20",qty:2}, {type:"x12v",qty:23}, {type:"x20v",qty:23}, {type:"ex12v",qty:1}, {type:"ex20v",qty:1}],
    "km8": [{type:"s1500",qty:31}, {type:"s2000",qty:12}, {type:"s175_b_s",qty:5}, {type:"a1_5",qty:2}, {type:"a2_25",qty:1}, {type:"a500",qty:4}, {type:"a_g_500",qty:1}, {type:"x8",qty:11}, {type:"x20",qty:151}, {type:"x12",qty:42}, {type:"sab1_5",qty:9}, {type:"sab500",qty:2}, {type:"disp",qty:2}, {type:"ex20",qty:2}, {type:"x12v",qty:37}, {type:"x20v",qty:46}, {type:"ex12v",qty:2}, {type:"ex20v",qty:1}],
    "km12": [{type:"s1500",qty:40}, {type:"s2000",qty:23}, {type:"s175_b_s",qty:2}, {type:"a2_25",qty:3}, {type:"a500",qty:4}, {type:"x8",qty:20}, {type:"x20",qty:208}, {type:"x12",qty:60}, {type:"sab1_5",qty:7}, {type:"sab500",qty:2}, {type:"disp",qty:2}, {type:"ex12",qty:3}, {type:"ex20",qty:19}, {type:"evs1500",qty:1}, {type:"x12v",qty:38}, {type:"x20v",qty:70}, {type:"ex12v",qty:2}, {type:"ex20v",qty:4}],
    "kennedy": [{type:"s1500",qty:50}, {type:"s2000",qty:9}, {type:"s175_b_s",qty:3}, {type:"a1_5",qty:4}, {type:"a2_25",qty:3}, {type:"a500",qty:6}, {type:"a_g_500",qty:1}, {type:"x8",qty:17}, {type:"x20",qty:152}, {type:"x12",qty:59}, {type:"sab1_5",qty:12}, {type:"sab500",qty:3}, {type:"disp",qty:3}, {type:"ex12",qty:1}, {type:"ex20",qty:3}, {type:"x12v",qty:37}, {type:"x20v",qty:44}, {type:"ex20v",qty:1}],
    "polonia": [{type:"s1500",qty:14}, {type:"s2000",qty:6}, {type:"s175_b_s",qty:1}, {type:"a1_5",qty:1}, {type:"a2_25",qty:1}, {type:"a500",qty:2}, {type:"a_g_500",qty:1}, {type:"x8",qty:11}, {type:"x20",qty:130}, {type:"x12",qty:40}, {type:"sab1_5",qty:7}, {type:"sab500",qty:2}, {type:"disp",qty:2}, {type:"ex20",qty:2}, {type:"x8v",qty:7}, {type:"x12v",qty:29}, {type:"x20v",qty:26}, {type:"ex12v",qty:1}, {type:"ex20v",qty:1}],
    "rada_tilly": [{type:"s1500",qty:111}, {type:"s2000",qty:22}, {type:"s175_b_s",qty:10}, {type:"a1_5",qty:6}, {type:"a2_25",qty:5}, {type:"a500",qty:11}, {type:"a_g_500",qty:1}, {type:"x8",qty:19}, {type:"x20",qty:66}, {type:"x12",qty:61}, {type:"sab1_5",qty:12}, {type:"sab500",qty:2}, {type:"disp",qty:1}, {type:"ex20",qty:1}, {type:"evs1500",qty:1}, {type:"x12v",qty:64}, {type:"x20v",qty:41}, {type:"ex12v",qty:1}, {type:"ex20v",qty:1}],
    "caleta_1": [{type:"s1500",qty:63}, {type:"s2000",qty:9}, {type:"s175_b_s",qty:8}, {type:"a1_5",qty:10}, {type:"a2_25",qty:8}, {type:"a500",qty:60}, {type:"a_g_500",qty:2}, {type:"x8",qty:15}, {type:"x20",qty:275}, {type:"x12",qty:87}, {type:"sab1_5",qty:12}, {type:"sab500",qty:6}, {type:"disp",qty:4}, {type:"ex20",qty:3}, {type:"x12v",qty:76}, {type:"x20v",qty:108}, {type:"ex20v",qty:3}],
    "canada": [{type:"s1500",qty:37}, {type:"s2000",qty:8}, {type:"s175_b_s",qty:3}, {type:"a1_5",qty:4}, {type:"a2_25",qty:2}, {type:"a500",qty:12}, {type:"a_g_500",qty:3}, {type:"x8",qty:5}, {type:"x20",qty:74}, {type:"x12",qty:45}, {type:"disp",qty:1}, {type:"ex12",qty:3}, {type:"ex20",qty:8}, {type:"x12v",qty:33}, {type:"x20v",qty:31}, {type:"ex12v",qty:2}, {type:"ex20v",qty:5}],
    "eeuu": [{type:"s1500",qty:45}, {type:"s2000",qty:7}, {type:"s175_b_s",qty:2}, {type:"a1_5",qty:2}, {type:"a2_25",qty:1}, {type:"a500",qty:3}, {type:"a_g_500",qty:1}, {type:"x8",qty:11}, {type:"x20",qty:111}, {type:"x12",qty:52}, {type:"sab1_5",qty:7}, {type:"sab500",qty:1}, {type:"disp",qty:2}, {type:"ex20",qty:2}, {type:"x12v",qty:40}, {type:"x20v",qty:41}, {type:"ex20v",qty:1}],
    "palazzo": [{type:"s1500",qty:22}, {type:"s2000",qty:9}, {type:"s175_b_s",qty:2}, {type:"a1_5",qty:1}, {type:"a2_25",qty:2}, {type:"a500",qty:3}, {type:"x8",qty:13}, {type:"x20",qty:99}, {type:"x12",qty:43}, {type:"sab1_5",qty:8}, {type:"sab500",qty:1}, {type:"disp",qty:2}, {type:"ex12",qty:1}, {type:"ex20",qty:1}, {type:"x12v",qty:26}, {type:"x20v",qty:30}, {type:"ex20v",qty:1}],
    "km3": [],
    "caleta_2": [],
    "base_caleta": []
  };

  // Empresas y Eventuales: hojas nuevas, sin datos históricos todavía — las
  // listas de empresas/eventuales arrancan vacías y se cargan desde
  // ⚙ → Empresas / Eventuales (mismo mecanismo que Sucursales). Por eso
  // tampoco tienen botón "✨ Planificar automáticamente": esa función
  // depende de un patrón histórico que no existe para listas recién creadas.
  var DEFAULT_COMPANIES = [];
  var DEFAULT_OCCASIONALS = [];

  // Config genérica que describe cada "hoja extra" (Empresas, Eventuales):
  // mismos mecanismos que Sucursales (grilla mensual, modal de envío, vista
  // Día, Dashboard, alta en Settings) pero con sus propios ids de DOM, tabla
  // de Supabase y lista independiente — así el código no se duplica dos
  // veces y el arreglo del cierre (closure) de fecha/celda solo existe en un
  // lugar (ver el bug de fecha ya corregido en renderBranchGrid).
  var EXTRA_KINDS = [
    {
      key: 'company', label: 'Empresas', pluralLower: 'empresas', singularLower: 'la empresa',
      idField: 'company_id', collection: 'companies', visitCollection: 'company_visits',
      gridHeadId: 'company-grid-head', gridBodyId: 'company-grid-body',
      prevBtnId: 'prev-company-month', nextBtnId: 'next-company-month',
      todayBtnId: 'company-today-btn', monthLabelId: 'company-month-label',
      overlayId: 'companyvisit-overlay', modalPrefix: 'cvm',
      daySummaryId: 'day-company-summary', dayBodyId: 'day-company-body',
      kpiId: 'kpi-company-visits', barDestId: 'bar-company', barCargoId: 'bar-company-cargo',
      chartVar: 'var(--chart-company)',
      settingsListId: 'companies-list', newInputId: 'new-company-input', addBtnId: 'add-company-btn'
    },
    {
      key: 'occasional', label: 'Eventuales', pluralLower: 'eventuales', singularLower: 'el eventual',
      idField: 'occasional_id', collection: 'occasionals', visitCollection: 'occasional_visits',
      gridHeadId: 'occasional-grid-head', gridBodyId: 'occasional-grid-body',
      prevBtnId: 'prev-occasional-month', nextBtnId: 'next-occasional-month',
      todayBtnId: 'occasional-today-btn', monthLabelId: 'occasional-month-label',
      overlayId: 'occasionalvisit-overlay', modalPrefix: 'ovm',
      daySummaryId: 'day-occasional-summary', dayBodyId: 'day-occasional-body',
      kpiId: 'kpi-occasional-visits', barDestId: 'bar-occasional', barCargoId: 'bar-occasional-cargo',
      chartVar: 'var(--chart-occasional)',
      settingsListId: 'occasionals-list', newInputId: 'new-occasional-input', addBtnId: 'add-occasional-btn'
    }
  ];

  function topWeekdaysForBranch(branchId){
    var p = BRANCH_VISIT_PATTERN[branchId];
    if(!p) return [];
    var idxs = [0,1,2,3,4,5,6].filter(function(wd){ return p.weekdayFreq[wd] > 0; });
    idxs.sort(function(a,b){ return p.weekdayFreq[b]-p.weekdayFreq[a]; });
    return idxs.slice(0, p.perWeek);
  }

  var WD_LABELS = ['LUN','MAR','MIE','JUE','VIE','SAB','DOM'];
  var WD_LABELS_LONG = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
  var MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

  function slug(s){
    return (s||'').toString().normalize('NFD').replace(/[̀-ͯ]/g,'')
      .toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,40) || 'x';
  }

  // ---------- Permisos: perfiles de acceso por pestaña ----------
  var TAB_DEFS = [
    {id:'grid',       label:'FlotaPesada'},
    {id:'branches',   label:'Sucursales'},
    {id:'company',    label:'Empresas'},
    {id:'occasional', label:'Eventuales'},
    {id:'compras',    label:'Compras'},
    {id:'pagos',      label:'Pagos'},
    {id:'tesoreria',  label:'Tesorería'},
    {id:'day',        label:'Día'},
    {id:'dashboard',  label:'Dashboard'},
    {id:'reclamos',   label:'Reclamos de PT'},
    {id:'ncpac',      label:'Acciones de mejora'},
    {id:'calidash',   label:'Indicadores de calidad'},
    {id:'tableros',   label:'Dashboards (todos los módulos)'},
    {id:'comercial',  label:'Tablero comercial', noTab:true},
    {id:'rrhh',       label:'Panel RR.HH.', noTab:true}
  ];
  // Áreas de la empresa: cada una agrupa sus pestañas. El inicio muestra una
  // tarjeta por área a la que el perfil tenga acceso (alguna pestaña que no
  // esté "Oculta"). Comercial es otra página (comercial-dashboard.html) que
  // comparte el mismo ingreso con email (sesión de Supabase).
  var AREAS = [
    {id:'logistica', label:'Logística', icon:'🚛', color:'#223c7e', dash:'viajes',
     desc:'FlotaPesada, sucursales, empresas, eventuales, vista del día y dashboard de viajes.',
     tabs:['grid','branches','company','occasional','day','dashboard']},
    {id:'administracion', label:'Administración', icon:'🧾', color:'#16a34a', dash:'gastos',
     desc:'Proveedores, compras, facturas, órdenes de pago, tesorería y dashboard de gastos.',
     tabs:['compras','pagos','tesoreria','dashboard']},
    {id:'calidad', label:'Calidad', icon:'🔬', color:'#7c3aed',
     desc:'Reclamos de producto terminado (RG-0802), no conformidades y planes de acción (RG-0801) e indicadores.',
     tabs:['reclamos','ncpac','calidash']},
    {id:'tableros', label:'Dashboards', icon:'📈', color:'#0d9488',
     desc:'Los tableros de todos los módulos en un solo lugar, con la lectura de Sifoncito sobre lo que está pasando en la empresa.',
     tabs:['tableros']},
    {id:'comercial', label:'Comercial', icon:'📊', color:'#2ba9e0', href:'comercial-dashboard.html',
     desc:'Cumplimiento presupuestario, facturación por unidad de negocio, clientes y altas/bajas.',
     tabs:['comercial']},
    {id:'rrhh', label:'Recursos Humanos', icon:'👥', color:'#e1251b', href:'fichaje/admin.html',
     desc:'Asistencia, presentismo, fichadas, ausencias, legajos, indicadores y reportes.',
     tabs:['rrhh']}
  ];
  function areaById(id){ return AREAS.find(function(a){ return a.id===id; }) || null; }
  // El Dashboard está en Logística y en Administración: cuenta para mostrar
  // un área solo si el perfil no tiene ninguna otra pestaña (ej. un perfil
  // de gerencia que solo mira dashboards ve las dos).
  function tieneTabsPropias(a){ return a.tabs.some(function(t){ return t!=='dashboard' && tabPermiso(t)!=='oculta'; }); }
  function areaVisible(a){
    if(tieneTabsPropias(a)) return true;
    if(a.tabs.indexOf('dashboard')===-1 || tabPermiso('dashboard')==='oculta') return false;
    return !AREAS.some(function(x){ return x.tabs.indexOf('dashboard')!==-1 && tieneTabsPropias(x); });
  }
  function visibleAreas(){ return AREAS.filter(areaVisible); }
  function defaultPermisos(nivel){
    var p = {};
    TAB_DEFS.forEach(function(t){ p[t.id] = nivel; });
    return p;
  }
  function defaultAuthRoles(){
    var lecturaPermisos = defaultPermisos('oculta');
    lecturaPermisos.day = 'ver';
    return [
      {id:'admin', nombre:'Admin', password:'admin', manageAccess:true, permisos:defaultPermisos('editar')},
      {id:'lectura', nombre:'Lectura', password:'lectura', manageAccess:false, permisos:lecturaPermisos}
    ];
  }
  // Quien entra con email y no tiene perfil asignado (los usuarios que ya
  // usaban el tablero Comercial) ve solo Comercial, como hasta ahora.
  var ROLE_SOLO_COMERCIAL = {id:'__comercial__', nombre:'Solo Comercial', password:'', manageAccess:false, permisos:{comercial:'editar'}};
  function currentRole(){
    if(state.roleId==='__comercial__') return ROLE_SOLO_COMERCIAL;
    return (state.auth.roles||[]).find(function(r){ return r.id===state.roleId; }) || null;
  }
  function isLoggedIn(){ return !!currentRole(); }
  // Pestañas que se agregaron después de crear los perfiles: si el perfil no
  // dice nada, la ve (y edita) quien administra accesos; el resto, no.
  var PERMISOS_NUEVOS = ['comercial','rrhh','reclamos','ncpac','calidash','tableros'];
  function tabPermiso(tabId){
    var r = currentRole();
    if(!r) return 'oculta';
    // Perfiles creados antes de que existiera el permiso "comercial": los
    // que administran accesos lo ven, el resto no (se ajusta en ⚙ → Acceso).
    if(PERMISOS_NUEVOS.indexOf(tabId)!==-1 && !(r.permisos && r.permisos[tabId])) return r.manageAccess ? 'editar' : 'oculta';
    return (r.permisos && r.permisos[tabId]) || 'oculta';
  }
  function canEdit(tabId){ return tabPermiso(tabId)==='editar'; }
  function canEditAnything(){ return TAB_DEFS.some(function(t){ return canEdit(t.id); }); }
  function canManageAccess(){ var r = currentRole(); return !!(r && r.manageAccess); }
  function canOpenSettings(){
    return canManageAccess() || canEdit('grid') || canEdit('branches') || canEdit('company') || canEdit('occasional') || canEdit('compras') || canEdit('reclamos') || canEdit('ncpac');
  }
  function areaTabs(){
    var a = state.area ? areaById(state.area) : null;
    return a ? a.tabs : TAB_DEFS.map(function(t){ return t.id; });
  }
  function firstAccessibleTab(){
    var tabs = areaTabs();
    for(var i=0;i<TAB_DEFS.length;i++){
      var t = TAB_DEFS[i];
      if(t.noTab || tabs.indexOf(t.id)===-1) continue;
      if(tabPermiso(t.id)!=='oculta') return t.id;
    }
    return null;
  }
  function refreshTabVisibility(){
    var accessibleCount = 0;
    var tabs = areaTabs();
    TAB_DEFS.forEach(function(t){
      if(t.noTab) return;
      var btn = document.getElementById('tab-'+t.id);
      var oculta = tabPermiso(t.id)==='oculta' || tabs.indexOf(t.id)===-1;
      if(btn) btn.hidden = oculta;
      if(!oculta) accessibleCount++;
    });
    var viewtabs = document.getElementById('viewtabs');
    if(viewtabs) viewtabs.hidden = !state.area || accessibleCount<=1;
    var homeBtn = document.getElementById('home-btn');
    if(homeBtn) homeBtn.hidden = !state.area || visibleAreas().length<=1;
    var area = state.area ? areaById(state.area) : null;
    var tag = document.getElementById('brand-tag');
    if(tag) tag.textContent = area ? area.label : 'Logística, administración, calidad y comercial en un solo lugar';
    var settingsBtn = document.getElementById('settings-btn');
    if(settingsBtn) settingsBtn.hidden = !canOpenSettings();
    var mail = document.getElementById('who-email');
    if(mail){ mail.textContent = state.sessionEmail || ''; mail.title = state.sessionEmail || ''; mail.hidden = !state.sessionEmail; }
  }
  var SETTINGS_TAB_PERMISOS = {
    routes:'grid', trucks:'grid', drivers:'grid', helpers:'grid', cargo:'grid',
    branches:'branches', companies:'company', occasionals:'occasional',
    'centros-costo':'compras', conceptos:'compras', rubros:'compras',
    'medios-caja':'tesoreria', retenciones:'pagos', 'calidad-listas':'reclamos'
  };
  function settingsTabVisible(t){
    if(t==='auth') return canManageAccess();
    if(t==='calidad-listas') return canEdit('reclamos') || canEdit('ncpac');
    return canEdit(SETTINGS_TAB_PERMISOS[t]);
  }
  // Categorías del engranaje (⚙): agrupan las pestañas de siempre en 4
  // secciones con navegación a la izquierda, en vez de una fila plana de 9
  // botones. Agregar una pestaña nueva a futuro implica sumarla acá y a
  // SETTINGS_TAB_PERMISOS, más su <div id="stab-...."> y su botón
  // "stabbtn-...." dentro del grupo "settings-subtabs-<categoría>" en el HTML.
  var SETTINGS_CATEGORIES = [
    {id:'flota',       label:'Flota y viajes',            tabs:['routes','trucks','drivers','helpers','cargo']},
    {id:'sucursales',  label:'Sucursales y empresas',     tabs:['branches','companies','occasionals']},
    {id:'compras',     label:'Compras',                   tabs:['centros-costo','conceptos','rubros']},
    {id:'tesoreria',   label:'Tesorería',                 tabs:['medios-caja','retenciones']},
    {id:'calidad',     label:'Calidad',                   tabs:['calidad-listas']},
    {id:'acceso',      label:'Acceso',                     tabs:['auth']}
  ];
  function settingsCategoryVisible(catId){
    var cat = SETTINGS_CATEGORIES.find(function(c){ return c.id===catId; });
    return !!(cat && cat.tabs.some(function(t){ return settingsTabVisible(t); }));
  }
  function settingsCategoryForTab(tab){
    var cat = SETTINGS_CATEGORIES.find(function(c){ return c.tabs.indexOf(tab)>=0; });
    return cat ? cat.id : SETTINGS_CATEGORIES[0].id;
  }
  function firstVisibleSettingsTabInCategory(catId){
    var cat = SETTINGS_CATEGORIES.find(function(c){ return c.id===catId; });
    if(!cat) return null;
    for(var i=0;i<cat.tabs.length;i++){ if(settingsTabVisible(cat.tabs[i])) return cat.tabs[i]; }
    return null;
  }
  function firstVisibleSettingsCategory(){
    for(var i=0;i<SETTINGS_CATEGORIES.length;i++){ if(settingsCategoryVisible(SETTINGS_CATEGORIES[i].id)) return SETTINGS_CATEGORIES[i].id; }
    return SETTINGS_CATEGORIES[0].id;
  }
  function refreshSettingsTabsVisibility(){
    Object.keys(SETTINGS_TAB_PERMISOS).concat(['auth']).forEach(function(t){
      var btn = document.getElementById('stabbtn-'+t);
      if(btn) btn.hidden = !settingsTabVisible(t);
    });
    SETTINGS_CATEGORIES.forEach(function(cat){
      var btn = document.getElementById('scatbtn-'+cat.id);
      if(btn) btn.hidden = !settingsCategoryVisible(cat.id);
    });
  }
  function firstVisibleSettingsTab(){
    var order = ['routes','trucks','drivers','helpers','cargo','branches','companies','occasionals','centros-costo','conceptos','rubros','medios-caja','retenciones','calidad-listas','auth'];
    for(var i=0;i<order.length;i++){ if(settingsTabVisible(order[i])) return order[i]; }
    return 'auth';
  }

  function esc(s){ var d=document.createElement('div'); d.textContent=s==null?'':s; return d.innerHTML; }
  function pad2(n){ return n<10 ? '0'+n : ''+n; }
  function dateStr(y,m,d){ return y+'-'+pad2(m+1)+'-'+pad2(d); }
  function pyWeekday(jsDate){ return (jsDate.getDay()+6)%7; }
  function todayStr(){ var t=new Date(); return dateStr(t.getFullYear(),t.getMonth(),t.getDate()); }
  var TODAY = todayStr();

  function suggestedTruck(routeId, wd){
    var p = PATTERN[routeId];
    if(!p || !p.dominantTruck) return null;
    var max = Math.max.apply(null, p.weekdayFreq);
    if(max <= 0) return null;
    var thresh = Math.max(0.17, max*0.55);
    if(p.weekdayFreq[wd] >= thresh) return p.dominantTruck;
    return null;
  }

  // Sugerencia consciente de que un mismo camión no puede estar en dos rutas
  // el mismo día: dado un conjunto de rutas y los camiones ya comprometidos
  // ese día (viajes reales u otras sugerencias ya tomadas), devuelve solo
  // las sugerencias que no chocan entre sí, priorizando las más frecuentes.
  function suggestionsForDay(routes, wd, usedTrucks){
    var used = {};
    (usedTrucks||[]).forEach(function(t){ if(t) used[t]=true; });
    var cands = [];
    routes.forEach(function(r){
      var p = PATTERN[r.id];
      if(!p || !p.dominantTruck) return;
      var max = Math.max.apply(null, p.weekdayFreq);
      if(max<=0) return;
      var thresh = Math.max(0.17, max*0.55);
      var f = p.weekdayFreq[wd];
      if(f>=thresh) cands.push({routeId:r.id, truck:p.dominantTruck, freq:f});
    });
    cands.sort(function(a,b){ return b.freq-a.freq; });
    var out = {};
    cands.forEach(function(c){
      if(used[c.truck]) return;
      used[c.truck] = true;
      out[c.routeId] = c.truck;
    });
    return out;
  }

  // ---------- State ----------
  var state = {
    view: 'grid',        // 'grid' | 'day' | 'dashboard' | 'branches'
    year: new Date().getFullYear(),
    month: new Date().getMonth(), // 0-based
    routes: DEFAULT_ROUTES.slice(),
    trucks: DEFAULT_TRUCKS.slice(),
    drivers: DEFAULT_DRIVERS.slice(),
    helpers: DEFAULT_HELPERS.slice(),
    cargoTypes: DEFAULT_CARGO_TYPES.slice(),
    branches: DEFAULT_BRANCHES.slice(),
    trips: {},           // key "date_routeId" -> {date, route_id, truck, driver, helper, note, status, cargo:[{type,qty,unit}]}
    dashTrips: [],
    day: todayStr(),     // selected date for the "Día" view
    dayTrips: {},         // route_id -> trip, for state.day (fetched independently — may be outside the loaded grid month)
    editingCargo: {},    // {typeId: qty} being edited in the open cell modal (spreadsheet-style entry)
    visits: {},           // key "date_branchId" -> {date, branch_id, cargo:[{type,qty}], note, status, source}
    dashVisits: [],
    dayVisits: {},        // branch_id -> visit, for state.day (fetched independently — may be outside the loaded grid month)
    editingVisitCargo: {}, // {typeId: qty} being edited in the open visit modal
    settingsTab: 'routes',
    sb: null,
    editing: null,
    editingVisit: null,   // {dateStr, branchId, exists}
    // Empresas / Eventuales: mismo esquema que branches/visits arriba, pero
    // separado por "kind.key" (ver EXTRA_KINDS) — cada hoja extra tiene su
    // propia lista de items y sus propios envíos.
    extra: {
      company: {items: DEFAULT_COMPANIES.slice(), visits:{}, dayVisits:{}, dashVisits:[], editingVisit:null, editingVisitCargo:{}},
      occasional: {items: DEFAULT_OCCASIONALS.slice(), visits:{}, dayVisits:{}, dashVisits:[], editingVisit:null, editingVisitCargo:{}}
    },
    // Acceso: perfiles con contraseña propia y permisos por pestaña (ver
    // TAB_DEFS/defaultAuthRoles más arriba). Se guardan en la columna roles
    // (jsonb) de app_config y se gestionan desde ⚙ → Acceso. roleId queda
    // recordado en este navegador (localStorage) hasta que alguien toque
    // "Salir".
    auth: {roles: defaultAuthRoles()},
    roleId: null,          // null (sin loguear) o id de un perfil en state.auth.roles
    // Compras: proveedores y órdenes de compra (primer módulo de
    // Compras/Órdenes de pago/Tesorería — por ahora solo proveedores y
    // órdenes de compra; sin vínculo a sucursales/empresas/eventuales/
    // camiones, y sin desglose de ítems: descripción libre + monto total).
    proveedores: [],
    ordenesCompra: [],
    editingProveedorId: null,
    editingProveedorArchivos: [], // adjuntos del proveedor que se está editando (Google Drive)
    editingProveedorImput: [],    // imputaciones [{centroCostoId, conceptoId}] del proveedor que se está editando
    proveedoresSearch: '',        // texto del buscador de la lista de proveedores
    editingOCId: null,
    ocFilterEstado: '',
    dashSubTab: 'viajes', // sub-pestaña activa del Dashboard: 'viajes' | 'gastos'
    // Centros de costo y Conceptos: listas fijas (se administran desde
    // Compras) para clasificar cada factura y poder separar los gastos por
    // centro de costo/concepto en el dashboard.
    centrosCosto: [],
    conceptos: [],
    editingCentroCostoId: null,
    editingConceptoId: null,
    rubros: [],                 // [{id, nombre}] — lista administrable desde ⚙ → Compras → Rubros
    articulos: [],              // [{id, codigo, descripcion, unidad, categoria, activo, notas}] — Compras → Artículos
    tablaArticulos: false,      // existe la tabla articulos (se corrió articulos.sql)
    colArticulos: false,        // existe facturas.articulos
    colLlevaArticulos: false,   // existe proveedores.lleva_articulos
    editingFacturaArts: null,   // líneas de artículos de la factura en edición
    articulosFiltro: 'activos', articulosBusqueda: '',
    editingRubroId: null,
    editingFacturaItems: null,  // null = factura con una sola imputación; array = repartida en líneas
    // Facturas y Órdenes de pago: facturas de proveedor (con o sin orden de
    // compra asociada — la mayoría no tiene una) y órdenes de pago que
    // agrupan una o más facturas pendientes de un mismo proveedor.
    facturas: [],
    ordenesPago: [],
    editingFacturaId: null,
    editingFacturaArchivos: [], // adjuntos de la factura que se está editando (Google Drive)
    editingPagoId: null,
    facturaFilterEstado: '',
    pagoFilterEstado: '',
    sugMonto: null,        // monto a destinar escrito a mano (null = lo disponible)
    sugManual: {},         // facturaId -> true/false tildado/destildado a mano
    sugVerTodo: false,
    ganRegimenes: [],      // régimenes de retención de Ganancias (RG 830)
    ganEscalas: [],        // escalas 'general' y '119'
    agente: {},            // datos del agente de retención (parametros.agente_retencion)
    retMes: '',            // mes del listado de retenciones (YYYY-MM)
    // Tesorería: cuentas de caja/banco y sus movimientos. Por ahora solo
    // egresos (pagos a proveedores, incluido el egreso automático que se
    // genera al marcar una orden de pago como Pagada, y egresos manuales
    // como sueldos o impuestos). El saldo de cada cuenta se calcula como
    // saldo inicial menos la suma de sus movimientos.
    cuentas: [],
    movimientos: [],
    editingCuentaId: null,
    editingMovimientoId: null,
    movFilterCuenta: '',
    medios: [],               // conceptos de caja [{id, codigo, nombre, cuentaId, cheque:'no'|'cartera'|'datos', activo}]
    cheques: [],
    editingMedioId: null,
    editingMovTipo: 'egreso', // 'ingreso' (DEBE) | 'egreso' (HABER)
    editingMovCheques: [],    // cheques de cartera elegidos en una salida
    editingChequeId: null,
    chequeFilterEstado: 'cartera',
    editingFormas: []         // formas de pago de la orden que se está editando (pagos mixtos)
  };

  try {
    var savedWho = localStorage.getItem('hdr_who');
    if(savedWho) document.getElementById('who-input').value = savedWho;
  } catch(e){}
  document.getElementById('who-input').addEventListener('change', function(){
    try{ localStorage.setItem('hdr_who', this.value.slice(0,30)); }catch(e){}
  });

  // El ingreso por contraseña de perfil (sistema anterior) se sacó: solo se
  // entra con email. Se borra lo que haya quedado guardado de ese ingreso.
  try { localStorage.removeItem('hdr_role'); } catch(e){}

  function whoName(){
    var v = document.getElementById('who-input').value.trim();
    return v || 'Sin nombre';
  }

  function truckColorVar(id){
    var known = {'13':1,'20':1,'32':1,'41':1,'17':1,'4000':1};
    return known[id] ? 'var(--truck-'+id+')' : 'var(--truck-x)';
  }
  function truckInkVar(id){
    var known = {'13':1,'20':1,'32':1,'41':1,'17':1,'4000':1};
    return known[id] ? 'var(--truck-'+id+'-ink)' : 'var(--truck-x-ink)';
  }
  function truckById(id){
    for(var i=0;i<state.trucks.length;i++) if(state.trucks[i].id===id) return state.trucks[i];
    return null;
  }
  function truckTooltip(id){
    var t = truckById(id);
    if(!t) return 'Camión '+id;
    var lines = [t.label];
    if(t.patente) lines.push('Patente: '+t.patente);
    if(t.driver) lines.push('Chofer: '+t.driver);
    if(t.helper) lines.push('Ayudante: '+t.helper);
    return lines.join(' — ');
  }

  function activeRoutes(){
    return state.routes.filter(function(r){return r.active!==false;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
  }
  function activeTrucks(){
    return state.trucks.filter(function(t){return t.active!==false;});
  }
  // Camiones que se pueden asignar a un viaje: los de scope 'gastos'
  // (autoelevadores, utilitarios de administración, acoplado) existen solo
  // para imputarles gastos en las facturas, no salen a reparto.
  function tripTrucks(){
    return activeTrucks().filter(function(t){ return t.scope!=='gastos'; });
  }
  function activeDrivers(){
    return state.drivers.filter(function(d){return d.active!==false;}).sort(function(a,b){return a.name.localeCompare(b.name);});
  }
  function activeHelpers(){
    return state.helpers.filter(function(h){return h.active!==false;}).sort(function(a,b){return a.name.localeCompare(b.name);});
  }
  // Algunos choferes/ayudantes solo trabajan FlotaPesada, otros solo
  // Sucursales, y otros los dos — se elige por persona desde ⚙ → Choferes /
  // Ayudantes. scope: 'both' (default, compatibilidad con datos viejos) |
  // 'flota' | 'sucursales'.
  function driversForScope(scope){
    return activeDrivers().filter(function(d){ return !d.scope || d.scope==='both' || d.scope===scope; });
  }
  function helpersForScope(scope){
    return activeHelpers().filter(function(h){ return !h.scope || h.scope==='both' || h.scope===scope; });
  }
  // Mismo esquema de scope para camiones: la mayoría del acoplado son 'both'
  // (aparecen en FlotaPesada y en Sucursales), pero puede haber camiones
  // exclusivos de un lado (ej: un camión chico solo para Sucursales).
  function trucksForScope(scope){
    return activeTrucks().filter(function(t){ return !t.scope || t.scope==='both' || t.scope===scope; });
  }
  // Devuelve todos los viajes cargados para una fecha/ruta — puede haber más
  // de uno si dos camiones hacen la misma ruta el mismo día. Busca en los dos
  // cachés que mantiene la app: el mes cargado en la grilla, o el día suelto
  // que esté abierto en la vista "Día" (puede ser de otro mes).
  function tripsForCell(ds, routeId){
    var list = [];
    var seen = {};
    Object.keys(state.trips).forEach(function(id){
      var t = state.trips[id];
      if(t.date===ds && t.route_id===routeId){ list.push(t); seen[id]=true; }
    });
    if(ds===state.day){
      Object.keys(state.dayTrips).forEach(function(id){
        if(seen[id]) return;
        var t = state.dayTrips[id];
        if(t.route_id===routeId) list.push(t);
      });
    }
    list.sort(function(a,b){ return (a.id||'').localeCompare(b.id||''); });
    return list;
  }
  function tripById(id){
    if(!id) return null;
    if(state.trips[id]) return state.trips[id];
    if(state.dayTrips[id]) return state.dayTrips[id];
    return null;
  }
  // Todos los camiones ya comprometidos ese día (en cualquier ruta), para
  // que las sugerencias nunca propongan uno repetido.
  function trucksUsedOnDate(ds){
    var used = [];
    Object.keys(state.trips).forEach(function(id){
      var t = state.trips[id];
      if(t.date===ds && t.truck) used.push(t.truck);
    });
    if(ds===state.day){
      Object.keys(state.dayTrips).forEach(function(id){
        var t = state.dayTrips[id];
        if(t.truck) used.push(t.truck);
      });
    }
    return used;
  }
  // Genera un id nuevo y único para un viaje: mantiene el formato clásico
  // "fecha_ruta" para el primer viaje de esa ruta ese día (compatibilidad con
  // los datos ya guardados), y agrega un sufijo cuando ya hay uno o más
  // (dos camiones en la misma ruta el mismo día).
  function generateTripId(ds, routeId){
    var base = ds+'_'+routeId;
    var used = {};
    Object.keys(state.trips).forEach(function(id){ used[id]=true; });
    Object.keys(state.dayTrips).forEach(function(id){ used[id]=true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }
  function activeCargoTypes(){
    return state.cargoTypes.filter(function(c){return c.active!==false;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
  }
  function cargoTypeLabel(id){
    var c = state.cargoTypes.filter(function(x){return x.id===id;})[0];
    return c ? c.name : id;
  }
  function activeBranches(){
    return state.branches.filter(function(b){return b.active!==false;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
  }
  function branchLabel(id){
    var b = state.branches.filter(function(x){return x.id===id;})[0];
    return b ? b.label : id;
  }
  // Devuelve todos los envíos cargados para una fecha/sucursal — puede haber
  // más de uno si se cargan dos envíos distintos a la misma sucursal el
  // mismo día. Busca en los dos cachés que mantiene la app: el mes cargado
  // en la grilla, o el día suelto que esté abierto en la vista "Día".
  function visitsForCell(ds, branchId){
    var list = [];
    var seen = {};
    Object.keys(state.visits).forEach(function(id){
      var v = state.visits[id];
      if(v.date===ds && v.branch_id===branchId){ list.push(v); seen[id]=true; }
    });
    if(ds===state.day){
      Object.keys(state.dayVisits).forEach(function(id){
        if(seen[id]) return;
        var v = state.dayVisits[id];
        if(v.branch_id===branchId) list.push(v);
      });
    }
    list.sort(function(a,b){ return (a.id||'').localeCompare(b.id||''); });
    return list;
  }
  function visitById(id){
    if(!id) return null;
    if(state.visits[id]) return state.visits[id];
    if(state.dayVisits[id]) return state.dayVisits[id];
    return null;
  }
  // Genera un id nuevo y único para un envío: mantiene el formato clásico
  // "fecha_sucursal" para el primer envío de esa sucursal ese día
  // (compatibilidad con los datos ya guardados), y agrega un sufijo cuando ya
  // hay uno o más (dos envíos a la misma sucursal el mismo día).
  function generateVisitId(ds, branchId){
    var base = ds+'_'+branchId;
    var used = {};
    Object.keys(state.visits).forEach(function(id){ used[id]=true; });
    Object.keys(state.dayVisits).forEach(function(id){ used[id]=true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }

  // Paleta de colores por destino (hash del id -> uno de 12 colores fijos),
  // igual criterio que FlotaPesada pero para listas abiertas (sucursales,
  // empresas, eventuales) donde no hay un color fijo asignado a mano.
  function hashStr(s){
    var h = 0;
    s = String(s||'');
    for(var i=0;i<s.length;i++){ h = ((h<<5)-h+s.charCodeAt(i))|0; }
    return Math.abs(h);
  }
  function destColorVar(id){
    var n = (hashStr(id) % 12) + 1;
    return 'var(--dest-'+n+')';
  }
  function destInkVar(id){
    var n = (hashStr(id) % 12) + 1;
    return 'var(--dest-'+n+'-ink)';
  }

  // ---------- Empresas / Eventuales: helpers genéricos ----------
  // Mismas funciones que activeBranches/branchLabel/visitsForCell/visitById/
  // generateVisitId, pero parametrizadas por "kind" (ver EXTRA_KINDS) para no
  // duplicar la lógica una vez por hoja.
  function extraActiveItems(kind){
    return state.extra[kind.key].items.filter(function(x){return x.active!==false;}).sort(function(a,b){return (a.order||0)-(b.order||0);});
  }
  function extraItemLabel(kind, id){
    var it = state.extra[kind.key].items.filter(function(x){return x.id===id;})[0];
    return it ? it.label : id;
  }
  function extraVisitsForCell(kind, ds, itemId){
    var s = state.extra[kind.key];
    var list = [];
    var seen = {};
    Object.keys(s.visits).forEach(function(id){
      var v = s.visits[id];
      if(v.date===ds && v[kind.idField]===itemId){ list.push(v); seen[id]=true; }
    });
    if(ds===state.day){
      Object.keys(s.dayVisits).forEach(function(id){
        if(seen[id]) return;
        var v = s.dayVisits[id];
        if(v[kind.idField]===itemId) list.push(v);
      });
    }
    list.sort(function(a,b){ return (a.id||'').localeCompare(b.id||''); });
    return list;
  }
  function extraVisitById(kind, id){
    if(!id) return null;
    var s = state.extra[kind.key];
    if(s.visits[id]) return s.visits[id];
    if(s.dayVisits[id]) return s.dayVisits[id];
    return null;
  }
  function extraGenerateVisitId(kind, ds, itemId){
    var s = state.extra[kind.key];
    var base = ds+'_'+itemId;
    var used = {};
    Object.keys(s.visits).forEach(function(id){ used[id]=true; });
    Object.keys(s.dayVisits).forEach(function(id){ used[id]=true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }

  function showToast(msg, ms){
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, ms || 2600);
  }

  // ---------- View switching ----------
  function setView(v){
    if(!v || tabPermiso(v)==='oculta' || areaTabs().indexOf(v)===-1) v = firstAccessibleTab() || 'day'; // no navega a pestañas sin permiso
    state.view = v;
    if(v!=='tableros' && window.Tableros && window.Tableros.detener) window.Tableros.detener(); // Sifoncito deja de explicar
    document.getElementById('view-home').hidden = true;
    // Dashboard: cada área ve solo su parte (Logística → Viajes, Administración → Gastos).
    var areaD = state.area ? areaById(state.area) : null;
    document.getElementById('dash-subtabs').hidden = !!(areaD && areaD.dash);
    if(areaD && areaD.dash) switchDashSubTab(areaD.dash);
    document.body.classList.toggle('tab-readonly', tabPermiso(v)!=='editar');
    refreshTabVisibility();
    document.getElementById('view-grid').hidden = (v!=='grid');
    document.getElementById('view-day').hidden = (v!=='day');
    document.getElementById('view-dashboard').hidden = (v!=='dashboard');
    document.getElementById('view-branches').hidden = (v!=='branches');
    document.getElementById('view-company').hidden = (v!=='company');
    document.getElementById('view-occasional').hidden = (v!=='occasional');
    document.getElementById('view-compras').hidden = (v!=='compras');
    document.getElementById('view-pagos').hidden = (v!=='pagos');
    document.getElementById('view-tesoreria').hidden = (v!=='tesoreria');
    document.getElementById('tab-grid').classList.toggle('active', v==='grid');
    document.getElementById('tab-day').classList.toggle('active', v==='day');
    document.getElementById('tab-dashboard').classList.toggle('active', v==='dashboard');
    document.getElementById('tab-branches').classList.toggle('active', v==='branches');
    document.getElementById('tab-company').classList.toggle('active', v==='company');
    document.getElementById('tab-occasional').classList.toggle('active', v==='occasional');
    document.getElementById('tab-compras').classList.toggle('active', v==='compras');
    document.getElementById('tab-pagos').classList.toggle('active', v==='pagos');
    document.getElementById('tab-tesoreria').classList.toggle('active', v==='tesoreria');
    if(v==='pagos') setTimeout(revisarFacturasFaltantes, 600);
    document.getElementById('toolbar-grid').hidden = (v!=='grid');
    document.getElementById('toolbar-day').hidden = (v!=='day');
    document.getElementById('toolbar-dashboard').hidden = (v!=='dashboard');
    document.getElementById('toolbar-branches').hidden = (v!=='branches');
    document.getElementById('toolbar-company').hidden = (v!=='company');
    document.getElementById('toolbar-occasional').hidden = (v!=='occasional');
    document.getElementById('toolbar-compras').hidden = (v!=='compras');
    document.getElementById('toolbar-pagos').hidden = (v!=='pagos');
    document.getElementById('toolbar-tesoreria').hidden = (v!=='tesoreria');
    (VISTAS_CALIDAD||[]).forEach(function(c){
      document.getElementById('view-'+c).hidden = (v!==c);
      document.getElementById('tab-'+c).classList.toggle('active', v===c);
    });
    if(v==='tableros'){ if(window.Tableros) window.Tableros.mostrar(); }
    else if((VISTAS_CALIDAD||[]).indexOf(v)!==-1 && window.Calidad) window.Calidad.mostrar(v);
    if(v==='day') fetchDay(state.day);
    if(v==='dashboard') fetchDashboard();
    actualizarMenuSub(v);
    setTimeout(marcarFiltros, 0);
  }
  document.getElementById('tab-grid').addEventListener('click', function(){ setView('grid'); });
  document.getElementById('tab-day').addEventListener('click', function(){ setView('day'); });
  document.getElementById('tab-dashboard').addEventListener('click', function(){ setView('dashboard'); });
  document.getElementById('tab-branches').addEventListener('click', function(){ setView('branches'); });
  document.getElementById('tab-company').addEventListener('click', function(){ setView('company'); });
  document.getElementById('tab-occasional').addEventListener('click', function(){ setView('occasional'); });
  document.getElementById('tab-compras').addEventListener('click', function(){ setView('compras'); });
  document.getElementById('tab-pagos').addEventListener('click', function(){ setView('pagos'); });
  document.getElementById('tab-tesoreria').addEventListener('click', function(){ setView('tesoreria'); });
  var VISTAS_CALIDAD = ['reclamos','ncpac','calidash','tableros'];
  VISTAS_CALIDAD.forEach(function(c){ document.getElementById('tab-'+c).addEventListener('click', function(){ setView(c); }); });

  // ---------- Rendering: grid view ----------
  function monthLabel(){ return MONTH_NAMES[state.month] + ' de ' + state.year; }
  function renderHeader(){
    document.getElementById('month-label').textContent = monthLabel();
    document.getElementById('branch-month-label').textContent = monthLabel();
    EXTRA_KINDS.forEach(function(kind){ document.getElementById(kind.monthLabelId).textContent = monthLabel(); });
  }
  function daysInMonth(y,m){ return new Date(y, m+1, 0).getDate(); }

  // Arma el HTML de una pastilla individual (un camión) para una celda de la
  // grilla mensual. Puede haber más de una pastilla apiladas en una misma
  // celda cuando dos camiones hacen la misma ruta el mismo día.
  function buildTripPillHTML(trip){
    if(trip.truck){
      var crewLine = trip.driver ? esc(trip.driver+(trip.helper?' / '+trip.helper:'')) : '';
      var cargoLines = (trip.cargo||[]).filter(function(c){return c.type;});
      var tip = truckTooltip(trip.truck);
      if(trip.driver || trip.helper) tip += ' — Hoy: Chofer '+(trip.driver||'—')+', Ayudante '+(trip.helper||'—');
      if(cargoLines.length) tip += ' — Carga: '+cargoLines.map(function(c){ return cargoTypeLabel(c.type)+(c.qty?' x'+c.qty+(c.unit?' '+c.unit:''):''); }).join(', ');
      if(trip.note) tip += ' — Nota: '+trip.note;
      return '<span class="pill'+(cargoLines.length?' cargo':'')+'" data-trip-id="'+esc(trip.id)+'" title="'+esc(tip)+'" style="background:'+truckColorVar(trip.truck)+'; color:'+truckInkVar(trip.truck)+';">'+
        '<span class="truck-no">'+esc(trip.truck)+'</span>'+
        (crewLine ? '<span class="crew">'+crewLine+'</span>' : '')+
        (trip.note ? '<span class="note-badge" title="Nota: '+esc(trip.note)+'">📝</span>' : '')+
        '</span>';
    }
    return '<span class="pill" data-trip-id="'+esc(trip.id)+'" style="background:var(--surface-2); color:var(--ink-2);">·</span>';
  }

  function renderGrid(){
    var routes = activeRoutes();
    var head = document.getElementById('grid-head');
    head.innerHTML = '';
    var th0 = document.createElement('th');
    th0.className = 'corner';
    th0.textContent = 'Día';
    head.appendChild(th0);
    routes.forEach(function(r){
      var th = document.createElement('th');
      th.textContent = r.label;
      head.appendChild(th);
    });

    var body = document.getElementById('grid-body');
    body.innerHTML = '';
    var nd = daysInMonth(state.year, state.month);
    for(var d=1; d<=nd; d++){
      // Un error al dibujar un día puntual (por ejemplo un viaje con datos
      // raros) no debe borrar el resto del mes: se salta ese día y se loguea.
      try {
      var jsDate = new Date(state.year, state.month, d);
      var wd = pyWeekday(jsDate);
      var ds = dateStr(state.year, state.month, d);
      var tr = document.createElement('tr');
      if(ds===TODAY) tr.className='today';
      else if(wd>=5) tr.className='weekend';

      var tdDay = document.createElement('td');
      tdDay.className = 'daycell';
      tdDay.innerHTML = '<span class="daynum">'+pad2(d)+'</span><span class="dayname">'+WD_LABELS[wd]+'</span>';
      tr.appendChild(tdDay);

      // Camiones ya comprometidos ese día (en cualquier ruta), para que las
      // sugerencias de este mismo día nunca propongan un camión repetido.
      var usedToday = trucksUsedOnDate(ds);
      var daySuggestions = suggestionsForDay(routes, wd, usedToday);

      routes.forEach(function(r){
        var cellTrips = tripsForCell(ds, r.id);
        var td = document.createElement('td');
        td.className = 'cell';
        td.dataset.date = ds;
        td.dataset.route = r.id;
        if(cellTrips.length){
          td.classList.add('multi');
          td.innerHTML = '<div class="cell-pills">'+cellTrips.map(buildTripPillHTML).join('')+'</div>'+
            '<button type="button" class="cell-add-btn" title="Agregar otro camión a esta ruta este día">+ camión</button>';
          Array.prototype.forEach.call(td.querySelectorAll('.pill'), function(pillEl){
            pillEl.addEventListener('click', function(ev){
              ev.stopPropagation();
              openCellEditor(td.dataset.date, td.dataset.route, pillEl.dataset.tripId);
            });
          });
          td.querySelector('.cell-add-btn').addEventListener('click', function(ev){
            ev.stopPropagation();
            openCellEditor(td.dataset.date, td.dataset.route, null);
          });
        } else {
          var sugg = daySuggestions[r.id];
          if(sugg){
            var suggT = truckById(sugg);
            var suggCrew = suggT && suggT.driver ? esc(suggT.driver) : '';
            td.innerHTML = '<span class="pill ghost" title="Sugerido — '+truckTooltip(sugg)+'">'+
              '<span class="truck-no">'+esc(sugg)+'</span>'+
              (suggCrew ? '<span class="crew">'+suggCrew+'</span>' : '')+
              '</span>';
          } else {
            td.classList.add('empty');
          }
          td.addEventListener('click', onCellClick);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
      } catch(dayErr){
        console.error('Error al dibujar el día '+d+' de la grilla:', dayErr);
      }
    }
  }

  function renderStats(){
    var stripe = document.getElementById('stats-stripe');
    stripe.innerHTML = '';
    var prefix = state.year+'-'+pad2(state.month+1);
    var counts = {}; var total = 0;
    Object.keys(state.trips).forEach(function(k){
      var t = state.trips[k];
      if(t.date && t.date.indexOf(prefix)===0 && t.truck){
        counts[t.truck] = (counts[t.truck]||0)+1;
        total++;
      }
    });
    var totalChip = document.createElement('div');
    totalChip.className = 'chip-stat total';
    totalChip.innerHTML = '<span class="n">'+total+'</span><span class="lbl">viajes cargados este mes</span>';
    stripe.appendChild(totalChip);

    trucksForScope('flota').forEach(function(t){
      var n = counts[t.id]||0;
      var chip = document.createElement('div');
      chip.className = 'chip-stat';
      chip.innerHTML = '<span class="swatch" style="background:'+truckColorVar(t.id)+';"></span><span class="n">'+n+'</span><span class="lbl">'+esc(t.label)+'</span>';
      stripe.appendChild(chip);
    });
  }

  function renderAll(){ renderHeader(); renderGrid(); renderStats(); renderBranchGrid(); EXTRA_KINDS.forEach(renderExtraGrid); renderCompras(); renderPagos(); renderTesoreria(); }

  // ---------- Cell editing ----------
  function fillSelect(sel, items, valueField, labelField, placeholder){
    sel.innerHTML = '<option value="">'+placeholder+'</option>';
    items.forEach(function(it){
      var o = document.createElement('option');
      o.value = it[valueField]; o.textContent = it[labelField];
      sel.appendChild(o);
    });
  }

  function onCellClick(ev){
    var td = ev.currentTarget;
    openCellEditor(td.dataset.date, td.dataset.route, null);
  }

  function openCellEditor(ds, routeId, tripId){
    var trip = tripId ? tripById(tripId) : null;
    var cellTrips = tripsForCell(ds, routeId);
    var route = state.routes.filter(function(r){return r.id===routeId;})[0];
    var jsDate = new Date(ds+'T00:00:00');
    var wd = pyWeekday(jsDate);
    var suggested = null;
    if(!trip && cellTrips.length===0){
      var usedToday = trucksUsedOnDate(ds);
      suggested = suggestionsForDay(activeRoutes(), wd, usedToday)[routeId] || null;
    }

    state.editing = {dateStr: ds, routeId: routeId, tripId: trip ? tripId : null, exists: !!trip};

    document.getElementById('cm-title').textContent = 'Ruta ' + (route?route.label:routeId) + (!trip && cellTrips.length>0 ? ' — otro camión' : '');
    var niceDate = WD_LABELS[wd] + ' ' + parseInt(ds.slice(8,10),10) + ' de ' + MONTH_NAMES[parseInt(ds.slice(5,7),10)-1] + ' de ' + ds.slice(0,4);
    document.getElementById('cm-sub').textContent = niceDate;

    var sel = document.getElementById('cm-truck');
    fillSelect(sel, trucksForScope('flota'), 'id', 'label', 'Sin camión');
    sel.value = trip ? (trip.truck||'') : (suggested||'');

    var driverSel = document.getElementById('cm-driver');
    var helperSel = document.getElementById('cm-helper');
    fillSelect(driverSel, driversForScope('flota'), 'name', 'name', 'Sin asignar');
    fillSelect(helperSel, helpersForScope('flota'), 'name', 'name', 'Sin asignar');
    if(trip){
      driverSel.value = trip.driver||'';
      helperSel.value = trip.helper||'';
    } else {
      var deft = truckById(sel.value);
      driverSel.value = deft ? (deft.driver||'') : '';
      helperSel.value = deft ? (deft.helper||'') : '';
    }

    document.getElementById('cm-note').value = trip ? (trip.note||'') : '';
    document.getElementById('cm-suggest').style.display = (!trip && suggested) ? 'flex' : 'none';
    document.getElementById('cm-delete').style.display = trip ? 'inline-flex' : 'none';

    state.editingCargo = {};
    (trip && trip.cargo ? trip.cargo : []).forEach(function(c){
      if(c.type) state.editingCargo[c.type] = c.qty!=null ? c.qty : '';
    });
    document.getElementById('cm-cargo-unit').value = (trip && trip.cargo && trip.cargo.length) ? (trip.cargo[0].unit||'') : '';
    renderCargoRows();

    document.getElementById('cell-overlay').classList.add('show');
  }

  // ---------- Cargo table (spreadsheet-style: one row per product,
  // se completa la cantidad de lo que corresponda y se deja el resto vacío) ----------
  function renderCargoRows(){
    var body = document.getElementById('cm-cargo-body');
    body.innerHTML = '';
    var types = activeCargoTypes();
    if(types.length===0){
      body.innerHTML = '<tr><td colspan="2" class="cargo-empty">No hay tipos de carga cargados. Agregalos desde ⚙ → Cargas.</td></tr>';
      return;
    }
    types.forEach(function(ct){
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.textContent = ct.name;
      var tdQty = document.createElement('td');
      tdQty.className = 'cargo-qty-cell';
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = 'any'; inp.placeholder = '—';
      inp.value = state.editingCargo[ct.id]!=null ? state.editingCargo[ct.id] : '';
      inp.addEventListener('change', function(){
        var v = this.value;
        if(v==='') delete state.editingCargo[ct.id];
        else state.editingCargo[ct.id] = v;
      });
      tdQty.appendChild(inp);
      tr.appendChild(tdLabel); tr.appendChild(tdQty);
      body.appendChild(tr);
    });
  }

  // When the truck changes, offer that truck's usual crew — but only into
  // empty fields, so it never overwrites something already chosen.
  document.getElementById('cm-truck').addEventListener('change', function(){
    var t = truckById(this.value);
    var driverSel = document.getElementById('cm-driver');
    var helperSel = document.getElementById('cm-helper');
    if(t){
      if(!driverSel.value && t.driver) driverSel.value = t.driver;
      if(!helperSel.value && t.helper) helperSel.value = t.helper;
    }
  });

  // Las ventanas (nueva factura, orden de pago, configuración...) ya NO se
  // cierran con un clic afuera: solo con Cancelar / Listo / Guardar, para no
  // perder lo que se venía cargando por un clic de más.
  function closeCellModal(){
    document.getElementById('cell-overlay').classList.remove('show');
    state.editing = null;
    state.editingCargo = {};
  }

  function saveCell(){
    if(!state.editing) return;
    try {
      var truck = document.getElementById('cm-truck').value || null;
      var note = document.getElementById('cm-note').value.trim();
      var driver = document.getElementById('cm-driver').value;
      var helper = document.getElementById('cm-helper').value;
      var cargoUnit = document.getElementById('cm-cargo-unit').value.trim();
      var cargo = Object.keys(state.editingCargo).map(function(typeId){
        return {type:typeId, qty:parseFloat(state.editingCargo[typeId]), unit:cargoUnit};
      }).filter(function(c){ return !isNaN(c.qty) && c.qty!==0; });
      var esNuevo = !state.editing.tripId;
      var tripId = state.editing.tripId || generateTripId(state.editing.dateStr, state.editing.routeId);
      var payload = {
        id: tripId,
        date: state.editing.dateStr,
        route_id: state.editing.routeId,
        truck: truck,
        driver: driver,
        helper: helper,
        note: note,
        status: 'actual',
        updated_by: whoName(),
        updated_at: new Date().toISOString(),
        source: 'manual',
        cargo: cargo
      };
      writeTrip(payload);
      if(esNuevo && truck) revisarRepeticion({tabla:'trips', campo:'route_id', valor:payload.route_id, que:'viaje', nombre:labelForRoute(payload.route_id),
        fecha:payload.date, camion:truck, plantilla:{route_id:payload.route_id, truck:truck, driver:driver, helper:helper, cargo:cargo},
        idDe:function(ds){ return ds+'_'+payload.route_id; }, recargar:fetchMonth});
      closeCellModal();
    } catch(err){
      console.error('Error al guardar el viaje:', err);
      showToast('No se pudo guardar: '+(err && err.message ? err.message : err));
    }
  }

  function deleteCell(){
    if(!state.editing || !state.editing.tripId) return;
    var tripId = state.editing.tripId;
    delete state.trips[tripId];
    delete state.dayTrips[tripId];
    renderGrid(); renderStats();
    if(state.view==='day') renderDayView();
    if(!state.sb){ showToast('Sin conexión: no se pudo eliminar.'); closeCellModal(); return; }
    state.sb.from('trips').delete().eq('id', tripId).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeCellModal();
  }

  function writeTrip(payload){
    state.trips[payload.id] = payload;
    if(payload.date===state.day) state.dayTrips[payload.id] = payload;
    // El guardado se dispara ANTES de repintar la pantalla, para que un
    // error al dibujar la grilla nunca impida que el viaje se guarde.
    if(!state.sb){
      showToast('Sin conexión: el cambio no se guardó.');
    } else {
      state.sb.from('trips').upsert(payload).then(function(res){
        if(res.error){
          console.error('Error al guardar el viaje en la base:', res.error);
          showToast('No se pudo guardar: '+res.error.message);
        }
      }).catch(function(err){
        console.error('Error al guardar el viaje en la base:', err);
        showToast('No se pudo guardar: '+(err && err.message ? err.message : err));
      });
    }
    try {
      renderGrid(); renderStats();
      if(state.view==='day') renderDayView();
    } catch(err){
      console.error('Error al actualizar la pantalla después de guardar:', err);
      showToast('Se guardó, pero hubo un error al actualizar la pantalla. Recargá la página.');
    }
  }

  document.getElementById('cm-cancel').addEventListener('click', closeCellModal);
  document.getElementById('cm-save').addEventListener('click', saveCell);
  document.getElementById('cm-delete').addEventListener('click', deleteCell);

  // ---------- Auto-plan ----------
  function autoPlan(){
    var routes = activeRoutes();
    var nd = daysInMonth(state.year, state.month);
    var todo = [];
    for(var d=1; d<=nd; d++){
      var ds = dateStr(state.year, state.month, d);
      var wd = pyWeekday(new Date(state.year, state.month, d));
      // Un camión no puede estar en dos rutas el mismo día: primero vemos
      // qué camiones ya están comprometidos ese día por viajes reales, y
      // sugerimos el resto de las rutas sin repetir ninguno. No sugiere para
      // una ruta que ya tiene al menos un camión cargado ese día — agregar
      // un segundo camión a una ruta es una decisión manual.
      var usedToday = trucksUsedOnDate(ds);
      var daySugg = suggestionsForDay(routes, wd, usedToday);
      routes.forEach(function(r){
        if(tripsForCell(ds, r.id).length) return;
        var sugg = daySugg[r.id];
        if(sugg) todo.push({date:ds, routeId:r.id, truck:sugg});
      });
    }
    if(todo.length===0){ showToast('No hay sugerencias nuevas para este mes.'); return; }
    if(!state.sb){ showToast('Sin conexión: no se puede guardar la planificación.'); return; }
    var btn = document.getElementById('autoplan-btn');
    btn.disabled = true;
    var i = 0;
    function next(){
      if(i>=todo.length){
        btn.disabled = false;
        btn.textContent = '✨ Planificar automáticamente';
        showToast('Se confirmaron '+todo.length+' viajes sugeridos.');
        return;
      }
      var item = todo[i];
      btn.textContent = 'Guardando '+(i+1)+' / '+todo.length+'...';
      var suggT = truckById(item.truck);
      var tripId = generateTripId(item.date, item.routeId);
      var payload = {id:tripId, date:item.date, route_id:item.routeId, truck:item.truck, driver: suggT?(suggT.driver||''):'', helper: suggT?(suggT.helper||''):'', note:'', status:'actual', updated_by: whoName()+' (auto)', updated_at:new Date().toISOString(), source:'auto'};
      state.trips[payload.id] = payload;
      state.sb.from('trips').upsert(payload).then(function(){ i++; next(); });
    }
    renderGrid(); renderStats();
    next();
  }
  document.getElementById('autoplan-btn').addEventListener('click', autoPlan);

  // ---------- Month navigation ----------
  function goMonth(delta){
    var m = state.month + delta, y = state.year;
    while(m<0){ m+=12; y--; }
    while(m>11){ m-=12; y++; }
    state.month=m; state.year=y;
    fetchMonth();
    fetchVisitsMonth();
    EXTRA_KINDS.forEach(fetchExtraVisitsMonth);
    renderAll();
  }
  function goToday(){
    var t = new Date();
    state.month = t.getMonth(); state.year = t.getFullYear();
    fetchMonth();
    fetchVisitsMonth();
    EXTRA_KINDS.forEach(fetchExtraVisitsMonth);
    renderAll();
  }
  document.getElementById('prev-month').addEventListener('click', function(){ goMonth(-1); });
  document.getElementById('next-month').addEventListener('click', function(){ goMonth(1); });
  document.getElementById('today-btn').addEventListener('click', goToday);
  document.getElementById('prev-branch-month').addEventListener('click', function(){ goMonth(-1); });
  document.getElementById('next-branch-month').addEventListener('click', function(){ goMonth(1); });
  document.getElementById('branch-today-btn').addEventListener('click', goToday);
  EXTRA_KINDS.forEach(function(kind){
    document.getElementById(kind.prevBtnId).addEventListener('click', function(){ goMonth(-1); });
    document.getElementById(kind.nextBtnId).addEventListener('click', function(){ goMonth(1); });
    document.getElementById(kind.todayBtnId).addEventListener('click', goToday);
  });

  // ================================================================
  // Vista "Día": un día completo abierto — ruta, camión, chofer,
  // ayudante y carga de cada ruta, para verlo todo de un vistazo.
  // ================================================================
  function dayLabel(ds){
    var d = new Date(ds+'T00:00:00');
    var wd = pyWeekday(d);
    return WD_LABELS_LONG[wd] + ' ' + parseInt(ds.slice(8,10),10) + ' de ' + MONTH_NAMES[parseInt(ds.slice(5,7),10)-1] + ' de ' + ds.slice(0,4);
  }

  function renderDayView(){
    document.getElementById('day-label').textContent = dayLabel(state.day);
    var picker = document.getElementById('day-picker');
    if(picker.value !== state.day) picker.value = state.day;

    var routes = activeRoutes();
    var body = document.getElementById('day-body');
    body.innerHTML = '';
    var loaded = 0;
    var routesCovered = 0;
    routes.forEach(function(r){
      var trips = tripsForCell(state.day, r.id).filter(function(t){ return t.truck; });
      if(trips.length===0) return; // solo rutas con camión asignado ese día
      routesCovered++;
      trips.forEach(function(trip){
        loaded++;
        var tr = document.createElement('tr');
        tr.className = 'day-row';
        var tdRoute = document.createElement('td');
        tdRoute.className = 'day-route';
        tdRoute.textContent = r.label;
        var tdTruck = document.createElement('td');
        var tdDriver = document.createElement('td');
        var tdHelper = document.createElement('td');
        var tdCargo = document.createElement('td');
        var tdNote = document.createElement('td');
        tdNote.className = 'day-note';
        tdTruck.innerHTML = '<span class="day-truck-pill" style="background:'+truckColorVar(trip.truck)+'; color:'+truckInkVar(trip.truck)+';">'+esc(trip.truck)+'</span>';
        tdDriver.textContent = trip.driver || '—';
        tdHelper.textContent = trip.helper || '—';
        var cargoLines = (trip.cargo||[]).filter(function(c){return c.type;});
        tdCargo.innerHTML = cargoLines.length ? cargoLines.map(function(c){
          return '<span class="day-cargo-chip">'+esc(cargoTypeLabel(c.type))+(c.qty!=null&&c.qty!=='' ? ' × '+esc(c.qty)+(c.unit?' '+esc(c.unit):'') : '')+'</span>';
        }).join('') : '<span class="day-muted">—</span>';
        tdNote.textContent = trip.note || '';
        tr.appendChild(tdRoute); tr.appendChild(tdTruck); tr.appendChild(tdDriver); tr.appendChild(tdHelper); tr.appendChild(tdCargo); tr.appendChild(tdNote);
        tr.addEventListener('click', function(){ openCellEditor(state.day, r.id, trip.id); });
        tr.title = 'Clic para cargar o editar este viaje';
        body.appendChild(tr);
      });
    });
    if(loaded===0){
      body.innerHTML = '<tr><td colspan="6" class="day-empty">'+(routes.length===0 ? 'No hay rutas activas.' : 'Todavía no hay viajes cargados para este día.')+'</td></tr>';
    }
    document.getElementById('day-summary').textContent = routesCovered+' de '+routes.length+' rutas con camión asignado'+(loaded>routesCovered ? ' ('+loaded+' viajes)' : '');
  }

  // Sucursales del día: mismo criterio que renderDayView pero para envíos a
  // sucursales — se muestra cualquier sucursal con un envío cargado ese día,
  // tenga o no carga cargada todavía (igual que el punto "·" de la grilla).
  function renderDayBranches(){
    var branches = activeBranches();
    var body = document.getElementById('day-branch-body');
    body.innerHTML = '';
    var loaded = 0;
    var branchesCovered = 0;
    branches.forEach(function(b){
      var visits = visitsForCell(state.day, b.id);
      if(visits.length===0) return;
      branchesCovered++;
      visits.forEach(function(visit){
        loaded++;
        var tr = document.createElement('tr');
        tr.className = 'day-row';
        var tdBranch = document.createElement('td');
        tdBranch.className = 'day-route';
        tdBranch.textContent = b.label;
        var tdTruck = document.createElement('td');
        var tdDriver = document.createElement('td');
        var tdHelper = document.createElement('td');
        var tdCargo = document.createElement('td');
        var tdNote = document.createElement('td');
        tdNote.className = 'day-note';
        tdTruck.innerHTML = visit.truck ? '<span class="day-truck-pill" style="background:'+truckColorVar(visit.truck)+'; color:'+truckInkVar(visit.truck)+';">'+esc(visit.truck)+'</span>' : '—';
        tdDriver.textContent = visit.driver || '—';
        tdHelper.textContent = visit.helper ? (visit.helper+(visit.helper2 ? ' + '+visit.helper2 : '')) : '—';
        var cargoLines = (visit.cargo||[]).filter(function(c){return c.type;});
        tdCargo.innerHTML = cargoLines.length ? cargoLines.map(function(c){
          return '<span class="day-cargo-chip">'+esc(cargoTypeLabel(c.type))+(c.qty!=null&&c.qty!=='' ? ' × '+esc(c.qty) : '')+'</span>';
        }).join('') : '<span class="day-muted">—</span>';
        tdNote.textContent = visit.note || '';
        tr.appendChild(tdBranch); tr.appendChild(tdTruck); tr.appendChild(tdDriver); tr.appendChild(tdHelper); tr.appendChild(tdCargo); tr.appendChild(tdNote);
        tr.addEventListener('click', function(){ openVisitEditor(state.day, b.id, visit.id); });
        tr.title = 'Clic para cargar o editar este envío';
        body.appendChild(tr);
      });
    });
    if(loaded===0){
      body.innerHTML = '<tr><td colspan="6" class="day-empty">'+(branches.length===0 ? 'No hay sucursales activas.' : 'Todavía no hay envíos cargados para este día.')+'</td></tr>';
    }
    document.getElementById('day-branch-summary').textContent = branchesCovered+' de '+branches.length+' sucursales con envío cargado'+(loaded>branchesCovered ? ' ('+loaded+' envíos)' : '');
  }

  // Empresas/Eventuales del día: mismo criterio que renderDayBranches, para
  // cualquiera de las dos hojas extra (ver EXTRA_KINDS).
  function renderDayExtra(kind){
    var s = state.extra[kind.key];
    var items = extraActiveItems(kind);
    var body = document.getElementById(kind.dayBodyId);
    body.innerHTML = '';
    var loaded = 0;
    var covered = 0;
    items.forEach(function(it){
      var visits = extraVisitsForCell(kind, state.day, it.id);
      if(visits.length===0) return;
      covered++;
      visits.forEach(function(visit){
        loaded++;
        var tr = document.createElement('tr');
        tr.className = 'day-row';
        var tdItem = document.createElement('td');
        tdItem.className = 'day-route';
        tdItem.textContent = it.label;
        var tdTruck = document.createElement('td');
        var tdDriver = document.createElement('td');
        var tdHelper = document.createElement('td');
        var tdCargo = document.createElement('td');
        var tdNote = document.createElement('td');
        tdNote.className = 'day-note';
        tdTruck.innerHTML = visit.truck ? '<span class="day-truck-pill" style="background:'+truckColorVar(visit.truck)+'; color:'+truckInkVar(visit.truck)+';">'+esc(visit.truck)+'</span>' : '—';
        tdDriver.textContent = visit.driver || '—';
        tdHelper.textContent = visit.helper ? (visit.helper+(visit.helper2 ? ' + '+visit.helper2 : '')) : '—';
        var cargoLines = (visit.cargo||[]).filter(function(c){return c.type;});
        tdCargo.innerHTML = cargoLines.length ? cargoLines.map(function(c){
          return '<span class="day-cargo-chip">'+esc(cargoTypeLabel(c.type))+(c.qty!=null&&c.qty!=='' ? ' × '+esc(c.qty) : '')+'</span>';
        }).join('') : '<span class="day-muted">—</span>';
        tdNote.textContent = visit.note || '';
        tr.appendChild(tdItem); tr.appendChild(tdTruck); tr.appendChild(tdDriver); tr.appendChild(tdHelper); tr.appendChild(tdCargo); tr.appendChild(tdNote);
        tr.addEventListener('click', function(){ openExtraVisitEditor(kind, state.day, it.id, visit.id); });
        tr.title = 'Clic para cargar o editar este envío';
        body.appendChild(tr);
      });
    });
    if(loaded===0){
      body.innerHTML = '<tr><td colspan="6" class="day-empty">'+(items.length===0 ? ('No hay '+kind.pluralLower+' activas.') : 'Todavía no hay envíos cargados para este día.')+'</td></tr>';
    }
    document.getElementById(kind.daySummaryId).textContent = covered+' de '+items.length+' '+kind.pluralLower+' con envío cargado'+(loaded>covered ? ' ('+loaded+' envíos)' : '');
  }

  function fetchDay(ds){
    if(!state.sb){ renderDayView(); renderDayBranches(); EXTRA_KINDS.forEach(renderDayExtra); return; }
    document.getElementById('day-loading').hidden = false;
    state.sb.from('trips').select('*').eq('date', ds).then(function(res){
      document.getElementById('day-loading').hidden = true;
      if(res.error){ showToast('Error cargando el día: '+res.error.message); return; }
      var map = {};
      (res.data||[]).forEach(function(row){ map[row.id] = row; });
      state.dayTrips = map;
      renderDayView();
    });
    fetchDayVisits(ds);
    EXTRA_KINDS.forEach(function(kind){ fetchDayExtraVisits(kind, ds); });
  }

  function fetchDayVisits(ds){
    if(!state.sb) return;
    state.sb.from('visits').select('*').eq('date', ds).then(function(res){
      if(res.error){ showToast('Error cargando las sucursales del día: '+res.error.message); return; }
      var map = {};
      (res.data||[]).forEach(function(row){ map[row.id] = row; });
      state.dayVisits = map;
      renderDayBranches();
    });
  }

  function fetchDayExtraVisits(kind, ds){
    if(!state.sb) return;
    state.sb.from(kind.visitCollection).select('*').eq('date', ds).then(function(res){
      if(res.error){ showToast('Error cargando '+kind.pluralLower+' del día: '+res.error.message); return; }
      var map = {};
      (res.data||[]).forEach(function(row){ map[row.id] = row; });
      state.extra[kind.key].dayVisits = map;
      renderDayExtra(kind);
    });
  }

  function goDay(delta){
    var d = new Date(state.day+'T00:00:00');
    d.setDate(d.getDate()+delta);
    state.day = dateStr(d.getFullYear(), d.getMonth(), d.getDate());
    fetchDay(state.day);
  }
  document.getElementById('prev-day').addEventListener('click', function(){ goDay(-1); });
  document.getElementById('next-day').addEventListener('click', function(){ goDay(1); });
  document.getElementById('day-today-btn').addEventListener('click', function(){ state.day = todayStr(); fetchDay(state.day); });
  document.getElementById('day-picker').addEventListener('change', function(){
    if(this.value){ state.day = this.value; fetchDay(state.day); }
  });
  document.getElementById('day-picker').value = state.day;

  // ================================================================
  // Sucursales: envíos mensuales a sucursales (mismo tipo de carga que
  // FlotaPesada, y también puede llevar camión asignado — una o más
  // entregas por día y por sucursal). Comparte el mes con la grilla principal.
  // ================================================================
  // Arma el HTML de una pastilla individual (un envío) para una celda de la
  // grilla mensual de Sucursales. Puede haber más de una pastilla apiladas
  // en una misma celda cuando se cargan dos envíos a la misma sucursal el
  // mismo día.
  function buildVisitPillHTML(visit){
    var cargoLines = (visit.cargo||[]).filter(function(c){return c.type;});
    var helperLine = visit.helper ? (visit.helper+(visit.helper2 ? ' / '+visit.helper2 : '')) : '';
    var crewLine = visit.driver ? esc(visit.driver+(helperLine?' / '+helperLine:'')) : '';
    var bg = destColorVar(visit.branch_id), ink = destInkVar(visit.branch_id);
    if(cargoLines.length){
      var totalQty = cargoLines.reduce(function(s,c){ var q=parseFloat(c.qty); return s+(isNaN(q)?0:q); },0);
      var prodLine = cargoLines.length+' producto'+(cargoLines.length===1?'':'s');
      var tip = branchLabel(visit.branch_id);
      if(visit.truck) tip += ' — Camión '+(truckById(visit.truck) ? truckById(visit.truck).label : visit.truck);
      if(visit.driver || visit.helper) tip += ' — Chofer '+(visit.driver||'—')+', Ayudante '+(helperLine||'—');
      tip += ' — '+cargoLines.map(function(c){ return cargoTypeLabel(c.type)+(c.qty!=null&&c.qty!=='' ? ' x'+c.qty : ''); }).join(', ');
      if(visit.note) tip += ' — Nota: '+visit.note;
      return '<span class="pill cargo" data-visit-id="'+esc(visit.id)+'" title="'+esc(tip)+'" style="background:'+bg+'; color:'+ink+';">'+
        '<span class="truck-no">'+(Math.round(totalQty*100)/100)+'<span class="unit-tag">u.</span></span>'+
        '<span class="crew">'+(crewLine || prodLine)+'</span>'+
        (visit.note ? '<span class="note-badge" title="Nota: '+esc(visit.note)+'">📝</span>' : '')+
        '</span>';
    }
    var dotTip = branchLabel(visit.branch_id);
    if(visit.truck) dotTip += ' — Camión '+(truckById(visit.truck) ? truckById(visit.truck).label : visit.truck);
    if(visit.driver || visit.helper) dotTip += ' — Chofer '+(visit.driver||'—')+', Ayudante '+(helperLine||'—');
    if(visit.note) dotTip += ' — Nota: '+visit.note;
    return '<span class="pill" data-visit-id="'+esc(visit.id)+'" title="'+esc(dotTip)+'" style="background:color-mix(in srgb, '+bg+' 32%, var(--surface)); color:var(--ink-2);">'+
      '<span class="truck-no">·</span>'+
      (crewLine ? '<span class="crew">'+crewLine+'</span>' : '')+
      (visit.note ? '<span class="note-badge" title="Nota: '+esc(visit.note)+'">📝</span>' : '')+
      '</span>';
  }

  // Empresas/Eventuales: misma lógica de pastilla que Sucursales
  // (buildVisitPillHTML), parametrizada por "kind" — ver EXTRA_KINDS.
  function buildExtraVisitPillHTML(kind, visit){
    var itemId = visit[kind.idField];
    var cargoLines = (visit.cargo||[]).filter(function(c){return c.type;});
    var helperLine = visit.helper ? (visit.helper+(visit.helper2 ? ' / '+visit.helper2 : '')) : '';
    var crewLine = visit.driver ? esc(visit.driver+(helperLine?' / '+helperLine:'')) : '';
    var bg = destColorVar(itemId), ink = destInkVar(itemId);
    if(cargoLines.length){
      var totalQty = cargoLines.reduce(function(s,c){ var q=parseFloat(c.qty); return s+(isNaN(q)?0:q); },0);
      var prodLine = cargoLines.length+' producto'+(cargoLines.length===1?'':'s');
      var tip = extraItemLabel(kind, itemId);
      if(visit.truck) tip += ' — Camión '+(truckById(visit.truck) ? truckById(visit.truck).label : visit.truck);
      if(visit.driver || visit.helper) tip += ' — Chofer '+(visit.driver||'—')+', Ayudante '+(helperLine||'—');
      tip += ' — '+cargoLines.map(function(c){ return cargoTypeLabel(c.type)+(c.qty!=null&&c.qty!=='' ? ' x'+c.qty : ''); }).join(', ');
      if(visit.note) tip += ' — Nota: '+visit.note;
      return '<span class="pill cargo" data-visit-id="'+esc(visit.id)+'" title="'+esc(tip)+'" style="background:'+bg+'; color:'+ink+';">'+
        '<span class="truck-no">'+(Math.round(totalQty*100)/100)+'<span class="unit-tag">u.</span></span>'+
        '<span class="crew">'+(crewLine || prodLine)+'</span>'+
        (visit.note ? '<span class="note-badge" title="Nota: '+esc(visit.note)+'">📝</span>' : '')+
        '</span>';
    }
    var dotTip = extraItemLabel(kind, itemId);
    if(visit.truck) dotTip += ' — Camión '+(truckById(visit.truck) ? truckById(visit.truck).label : visit.truck);
    if(visit.driver || visit.helper) dotTip += ' — Chofer '+(visit.driver||'—')+', Ayudante '+(helperLine||'—');
    if(visit.note) dotTip += ' — Nota: '+visit.note;
    return '<span class="pill" data-visit-id="'+esc(visit.id)+'" title="'+esc(dotTip)+'" style="background:color-mix(in srgb, '+bg+' 32%, var(--surface)); color:var(--ink-2);">'+
      '<span class="truck-no">·</span>'+
      (crewLine ? '<span class="crew">'+crewLine+'</span>' : '')+
      (visit.note ? '<span class="note-badge" title="Nota: '+esc(visit.note)+'">📝</span>' : '')+
      '</span>';
  }

  function renderExtraGrid(kind){
    var items = extraActiveItems(kind);
    var head = document.getElementById(kind.gridHeadId);
    head.innerHTML = '';
    var th0 = document.createElement('th');
    th0.className = 'corner';
    th0.textContent = 'Día';
    head.appendChild(th0);
    items.forEach(function(it){
      var th = document.createElement('th');
      th.textContent = it.label;
      head.appendChild(th);
    });

    var body = document.getElementById(kind.gridBodyId);
    body.innerHTML = '';
    var nd = daysInMonth(state.year, state.month);
    for(var d=1; d<=nd; d++){
      var jsDate = new Date(state.year, state.month, d);
      var wd = pyWeekday(jsDate);
      var ds = dateStr(state.year, state.month, d);
      var tr = document.createElement('tr');
      if(ds===TODAY) tr.className='today';
      else if(wd>=5) tr.className='weekend';

      var tdDay = document.createElement('td');
      tdDay.className = 'daycell';
      tdDay.innerHTML = '<span class="daynum">'+pad2(d)+'</span><span class="dayname">'+WD_LABELS[wd]+'</span>';
      tr.appendChild(tdDay);

      items.forEach(function(it){
        var cellVisits = extraVisitsForCell(kind, ds, it.id);
        var td = document.createElement('td');
        td.className = 'cell';
        td.dataset.date = ds;
        td.dataset.item = it.id;
        if(cellVisits.length){
          td.classList.add('multi');
          td.innerHTML = '<div class="cell-pills">'+cellVisits.map(function(v){ return buildExtraVisitPillHTML(kind, v); }).join('')+'</div>'+
            '<button type="button" class="cell-add-btn" title="Agregar otro envío">+ envío</button>';
          // Importante: leer la fecha/item desde td.dataset (no desde las
          // variables ds/it del bucle) — mismo bug de cierre corregido en
          // renderBranchGrid: un "var" declarado directo en el cuerpo del
          // for(;;) queda compartido entre todas las iteraciones.
          Array.prototype.forEach.call(td.querySelectorAll('.pill'), function(pillEl){
            pillEl.addEventListener('click', function(ev){
              ev.stopPropagation();
              openExtraVisitEditor(kind, td.dataset.date, td.dataset.item, pillEl.dataset.visitId);
            });
          });
          td.querySelector('.cell-add-btn').addEventListener('click', function(ev){
            ev.stopPropagation();
            openExtraVisitEditor(kind, td.dataset.date, td.dataset.item, null);
          });
        } else {
          td.classList.add('empty');
          td.addEventListener('click', function(ev){
            var t = ev.currentTarget;
            openExtraVisitEditor(kind, t.dataset.date, t.dataset.item, null);
          });
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }
  }

  function openExtraVisitEditor(kind, ds, itemId, visitId){
    var s = state.extra[kind.key];
    var visit = visitId ? extraVisitById(kind, visitId) : null;
    var cellVisits = extraVisitsForCell(kind, ds, itemId);
    var item = s.items.filter(function(x){return x.id===itemId;})[0];
    var jsDate = new Date(ds+'T00:00:00');
    var wd = pyWeekday(jsDate);

    s.editingVisit = {dateStr: ds, itemId: itemId, visitId: visit ? visitId : null, exists: !!visit};

    document.getElementById(kind.modalPrefix+'-title').textContent = (item ? item.label : itemId) + (!visit && cellVisits.length>0 ? ' — otro envío' : '');
    var niceDate = WD_LABELS[wd] + ' ' + parseInt(ds.slice(8,10),10) + ' de ' + MONTH_NAMES[parseInt(ds.slice(5,7),10)-1] + ' de ' + ds.slice(0,4);
    document.getElementById(kind.modalPrefix+'-sub').textContent = niceDate;

    var truckSel = document.getElementById(kind.modalPrefix+'-truck');
    var driverSel = document.getElementById(kind.modalPrefix+'-driver');
    var helperSel = document.getElementById(kind.modalPrefix+'-helper');
    var helper2Sel = document.getElementById(kind.modalPrefix+'-helper2');
    fillSelect(truckSel, tripTrucks(), 'id', 'label', 'Sin camión');
    fillSelect(driverSel, driversForScope('sucursales'), 'name', 'name', 'Sin asignar');
    fillSelect(helperSel, helpersForScope('sucursales'), 'name', 'name', 'Sin asignar');
    fillSelect(helper2Sel, helpersForScope('sucursales'), 'name', 'name', 'Sin asignar');
    truckSel.value = visit ? (visit.truck||'') : '';
    driverSel.value = visit ? (visit.driver||'') : '';
    helperSel.value = visit ? (visit.helper||'') : '';
    helper2Sel.value = visit ? (visit.helper2||'') : '';

    document.getElementById(kind.modalPrefix+'-note').value = visit ? (visit.note||'') : '';
    document.getElementById(kind.modalPrefix+'-delete').style.display = visit ? 'inline-flex' : 'none';

    s.editingVisitCargo = {};
    (visit && visit.cargo ? visit.cargo : []).forEach(function(c){
      if(c.type) s.editingVisitCargo[c.type] = c.qty!=null ? c.qty : '';
    });
    renderExtraVisitCargoRows(kind);

    document.getElementById(kind.overlayId).classList.add('show');
  }

  function renderExtraVisitCargoRows(kind){
    var s = state.extra[kind.key];
    var body = document.getElementById(kind.modalPrefix+'-cargo-body');
    body.innerHTML = '';
    var types = activeCargoTypes();
    if(types.length===0){
      body.innerHTML = '<tr><td colspan="2" class="cargo-empty">No hay tipos de carga cargados. Agregalos desde ⚙ → Cargas.</td></tr>';
      return;
    }
    types.forEach(function(ct){
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.textContent = ct.name;
      var tdQty = document.createElement('td');
      tdQty.className = 'cargo-qty-cell';
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = 'any'; inp.placeholder = '—';
      inp.value = s.editingVisitCargo[ct.id]!=null ? s.editingVisitCargo[ct.id] : '';
      inp.addEventListener('change', function(){
        var v = this.value;
        if(v==='') delete s.editingVisitCargo[ct.id];
        else s.editingVisitCargo[ct.id] = v;
      });
      tdQty.appendChild(inp);
      tr.appendChild(tdLabel); tr.appendChild(tdQty);
      body.appendChild(tr);
    });
  }

  function closeExtraVisitModal(kind){
    document.getElementById(kind.overlayId).classList.remove('show');
    state.extra[kind.key].editingVisit = null;
    state.extra[kind.key].editingVisitCargo = {};
  }

  function saveExtraVisit(kind){
    var s = state.extra[kind.key];
    if(!s.editingVisit) return;
    try {
      var truck = document.getElementById(kind.modalPrefix+'-truck').value || null;
      var driver = document.getElementById(kind.modalPrefix+'-driver').value;
      var helper = document.getElementById(kind.modalPrefix+'-helper').value;
      var helper2 = document.getElementById(kind.modalPrefix+'-helper2').value;
      var note = document.getElementById(kind.modalPrefix+'-note').value.trim();
      var cargo = Object.keys(s.editingVisitCargo).map(function(typeId){
        return {type:typeId, qty:parseFloat(s.editingVisitCargo[typeId])};
      }).filter(function(c){ return !isNaN(c.qty) && c.qty!==0; });
      var esNuevo = !s.editingVisit.visitId;
      var visitId = s.editingVisit.visitId || extraGenerateVisitId(kind, s.editingVisit.dateStr, s.editingVisit.itemId);
      var payload = {
        id: visitId,
        date: s.editingVisit.dateStr,
        truck: truck,
        driver: driver,
        helper: helper,
        helper2: helper2,
        note: note,
        status: 'actual',
        updated_by: whoName(),
        updated_at: new Date().toISOString(),
        source: 'manual',
        cargo: cargo
      };
      payload[kind.idField] = s.editingVisit.itemId;
      writeExtraVisit(kind, payload);
      if(esNuevo){
        var plant = {truck:truck, driver:driver, helper:helper, helper2:helper2, cargo:cargo}; plant[kind.idField] = payload[kind.idField];
        revisarRepeticion({tabla:kind.visitCollection, campo:kind.idField, valor:payload[kind.idField], que:'envío', nombre:extraItemLabel(kind, payload[kind.idField]),
          fecha:payload.date, plantilla:plant, idDe:function(ds){ return ds+'_'+payload[kind.idField]; }, recargar:function(){ fetchExtraVisitsMonth(kind); }});
      }
      closeExtraVisitModal(kind);
    } catch(err){
      console.error('Error al guardar el envío:', err);
      showToast('No se pudo guardar: '+(err && err.message ? err.message : err));
    }
  }

  function deleteExtraVisit(kind){
    var s = state.extra[kind.key];
    if(!s.editingVisit || !s.editingVisit.visitId) return;
    var visitId = s.editingVisit.visitId;
    delete s.visits[visitId];
    delete s.dayVisits[visitId];
    renderExtraGrid(kind);
    if(state.view==='day') renderDayExtra(kind);
    if(!state.sb){ showToast('Sin conexión: no se pudo eliminar.'); closeExtraVisitModal(kind); return; }
    state.sb.from(kind.visitCollection).delete().eq('id', visitId).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeExtraVisitModal(kind);
  }

  function writeExtraVisit(kind, payload){
    var s = state.extra[kind.key];
    s.visits[payload.id] = payload;
    if(payload.date===state.day) s.dayVisits[payload.id] = payload;
    // Igual que en writeVisit/writeTrip: el guardado se dispara antes de
    // repintar, para que un error al dibujar la grilla nunca impida que el
    // envío se guarde.
    if(!state.sb){
      showToast('Sin conexión: el cambio no se guardó.');
    } else {
      state.sb.from(kind.visitCollection).upsert(payload).then(function(res){
        if(res.error){
          console.error('Error al guardar el envío en la base:', res.error);
          showToast('No se pudo guardar: '+res.error.message);
        }
      }).catch(function(err){
        console.error('Error al guardar el envío en la base:', err);
        showToast('No se pudo guardar: '+(err && err.message ? err.message : err));
      });
    }
    try {
      renderExtraGrid(kind);
      if(state.view==='day') renderDayExtra(kind);
    } catch(err){
      console.error('Error al actualizar la pantalla después de guardar:', err);
      showToast('Se guardó, pero hubo un error al actualizar la pantalla. Recargá la página.');
    }
  }

  function fetchExtraVisitsMonth(kind){
    if(!state.sb) return;
    var y=state.year, m=state.month;
    var start = dateStr(y,m,1);
    var end = dateStr(y,m,daysInMonth(y,m));
    state.sb.from(kind.visitCollection).select('*').gte('date', start).lte('date', end).then(function(res){
      if(res.error){ showToast('Error cargando '+kind.pluralLower+': '+res.error.message); return; }
      var visits = {};
      (res.data||[]).forEach(function(row){ visits[row.id] = row; });
      state.extra[kind.key].visits = visits;
      renderExtraGrid(kind);
    });
  }

  // Cuando cambia el camión, sugiere su chofer/ayudante habitual — igual que
  // en el modal de Sucursales.
  EXTRA_KINDS.forEach(function(kind){
    document.getElementById(kind.modalPrefix+'-truck').addEventListener('change', function(){
      var t = truckById(this.value);
      var driverSel = document.getElementById(kind.modalPrefix+'-driver');
      var helperSel = document.getElementById(kind.modalPrefix+'-helper');
      if(t){
        if(!driverSel.value && t.driver) driverSel.value = t.driver;
        if(!helperSel.value && t.helper) helperSel.value = t.helper;
      }
    });
    document.getElementById(kind.modalPrefix+'-cancel').addEventListener('click', function(){ closeExtraVisitModal(kind); });
    document.getElementById(kind.modalPrefix+'-save').addEventListener('click', function(){ saveExtraVisit(kind); });
    document.getElementById(kind.modalPrefix+'-delete').addEventListener('click', function(){ deleteExtraVisit(kind); });
  });

  function renderBranchGrid(){
    var branches = activeBranches();
    var head = document.getElementById('branch-grid-head');
    head.innerHTML = '';
    var th0 = document.createElement('th');
    th0.className = 'corner';
    th0.textContent = 'Día';
    head.appendChild(th0);
    branches.forEach(function(b){
      var th = document.createElement('th');
      th.textContent = b.label;
      head.appendChild(th);
    });

    var body = document.getElementById('branch-grid-body');
    body.innerHTML = '';
    var nd = daysInMonth(state.year, state.month);
    for(var d=1; d<=nd; d++){
      var jsDate = new Date(state.year, state.month, d);
      var wd = pyWeekday(jsDate);
      var ds = dateStr(state.year, state.month, d);
      var tr = document.createElement('tr');
      if(ds===TODAY) tr.className='today';
      else if(wd>=5) tr.className='weekend';

      var tdDay = document.createElement('td');
      tdDay.className = 'daycell';
      tdDay.innerHTML = '<span class="daynum">'+pad2(d)+'</span><span class="dayname">'+WD_LABELS[wd]+'</span>';
      tr.appendChild(tdDay);

      branches.forEach(function(b){
        var cellVisits = visitsForCell(ds, b.id);
        var td = document.createElement('td');
        td.className = 'cell';
        td.dataset.date = ds;
        td.dataset.branch = b.id;
        if(cellVisits.length){
          td.classList.add('multi');
          td.innerHTML = '<div class="cell-pills">'+cellVisits.map(buildVisitPillHTML).join('')+'</div>'+
            '<button type="button" class="cell-add-btn" title="Agregar otro envío a esta sucursal este día">+ envío</button>';
          Array.prototype.forEach.call(td.querySelectorAll('.pill'), function(pillEl){
            pillEl.addEventListener('click', function(ev){
              ev.stopPropagation();
              openVisitEditor(td.dataset.date, td.dataset.branch, pillEl.dataset.visitId);
            });
          });
          td.querySelector('.cell-add-btn').addEventListener('click', function(ev){
            ev.stopPropagation();
            openVisitEditor(td.dataset.date, td.dataset.branch, null);
          });
        } else {
          td.classList.add('empty');
          td.addEventListener('click', onBranchCellClick);
        }
        tr.appendChild(td);
      });
      body.appendChild(tr);
    }
  }

  function onBranchCellClick(ev){
    var td = ev.currentTarget;
    openVisitEditor(td.dataset.date, td.dataset.branch, null);
  }

  function openVisitEditor(ds, branchId, visitId){
    var visit = visitId ? visitById(visitId) : null;
    var cellVisits = visitsForCell(ds, branchId);
    var branch = state.branches.filter(function(b){return b.id===branchId;})[0];
    var jsDate = new Date(ds+'T00:00:00');
    var wd = pyWeekday(jsDate);

    state.editingVisit = {dateStr: ds, branchId: branchId, visitId: visit ? visitId : null, exists: !!visit};

    document.getElementById('vm-title').textContent = (branch ? branch.label : branchId) + (!visit && cellVisits.length>0 ? ' — otro envío' : '');
    var niceDate = WD_LABELS[wd] + ' ' + parseInt(ds.slice(8,10),10) + ' de ' + MONTH_NAMES[parseInt(ds.slice(5,7),10)-1] + ' de ' + ds.slice(0,4);
    document.getElementById('vm-sub').textContent = niceDate;

    var vmTruckSel = document.getElementById('vm-truck');
    var vmDriverSel = document.getElementById('vm-driver');
    var vmHelperSel = document.getElementById('vm-helper');
    var vmHelper2Sel = document.getElementById('vm-helper2');
    fillSelect(vmTruckSel, tripTrucks(), 'id', 'label', 'Sin camión');
    fillSelect(vmDriverSel, driversForScope('sucursales'), 'name', 'name', 'Sin asignar');
    fillSelect(vmHelperSel, helpersForScope('sucursales'), 'name', 'name', 'Sin asignar');
    fillSelect(vmHelper2Sel, helpersForScope('sucursales'), 'name', 'name', 'Sin asignar');
    vmTruckSel.value = visit ? (visit.truck||'') : '';
    vmDriverSel.value = visit ? (visit.driver||'') : '';
    vmHelperSel.value = visit ? (visit.helper||'') : '';
    vmHelper2Sel.value = visit ? (visit.helper2||'') : '';

    document.getElementById('vm-note').value = visit ? (visit.note||'') : '';
    document.getElementById('vm-delete').style.display = visit ? 'inline-flex' : 'none';

    state.editingVisitCargo = {};
    (visit && visit.cargo ? visit.cargo : []).forEach(function(c){
      if(c.type) state.editingVisitCargo[c.type] = c.qty!=null ? c.qty : '';
    });
    renderVisitCargoRows();

    document.getElementById('visit-overlay').classList.add('show');
  }

  function renderVisitCargoRows(){
    var body = document.getElementById('vm-cargo-body');
    body.innerHTML = '';
    var types = activeCargoTypes();
    if(types.length===0){
      body.innerHTML = '<tr><td colspan="2" class="cargo-empty">No hay tipos de carga cargados. Agregalos desde ⚙ → Cargas.</td></tr>';
      return;
    }
    types.forEach(function(ct){
      var tr = document.createElement('tr');
      var tdLabel = document.createElement('td');
      tdLabel.textContent = ct.name;
      var tdQty = document.createElement('td');
      tdQty.className = 'cargo-qty-cell';
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = 'any'; inp.placeholder = '—';
      inp.value = state.editingVisitCargo[ct.id]!=null ? state.editingVisitCargo[ct.id] : '';
      inp.addEventListener('change', function(){
        var v = this.value;
        if(v==='') delete state.editingVisitCargo[ct.id];
        else state.editingVisitCargo[ct.id] = v;
      });
      tdQty.appendChild(inp);
      tr.appendChild(tdLabel); tr.appendChild(tdQty);
      body.appendChild(tr);
    });
  }

  function closeVisitModal(){
    document.getElementById('visit-overlay').classList.remove('show');
    state.editingVisit = null;
    state.editingVisitCargo = {};
  }

  function saveVisit(){
    if(!state.editingVisit) return;
    try {
      var truck = document.getElementById('vm-truck').value || null;
      var driver = document.getElementById('vm-driver').value;
      var helper = document.getElementById('vm-helper').value;
      var helper2 = document.getElementById('vm-helper2').value;
      var note = document.getElementById('vm-note').value.trim();
      var cargo = Object.keys(state.editingVisitCargo).map(function(typeId){
        return {type:typeId, qty:parseFloat(state.editingVisitCargo[typeId])};
      }).filter(function(c){ return !isNaN(c.qty) && c.qty!==0; });
      var esNuevo = !state.editingVisit.visitId;
      var visitId = state.editingVisit.visitId || generateVisitId(state.editingVisit.dateStr, state.editingVisit.branchId);
      var payload = {
        id: visitId,
        date: state.editingVisit.dateStr,
        branch_id: state.editingVisit.branchId,
        truck: truck,
        driver: driver,
        helper: helper,
        helper2: helper2,
        note: note,
        status: 'actual',
        updated_by: whoName(),
        updated_at: new Date().toISOString(),
        source: 'manual',
        cargo: cargo
      };
      writeVisit(payload);
      if(esNuevo) revisarRepeticion({tabla:'visits', campo:'branch_id', valor:payload.branch_id, que:'envío', nombre:branchLabel(payload.branch_id),
        fecha:payload.date, plantilla:{branch_id:payload.branch_id, truck:truck, driver:driver, helper:helper, helper2:helper2, cargo:cargo},
        idDe:function(ds){ return ds+'_'+payload.branch_id; }, recargar:fetchVisitsMonth});
      closeVisitModal();
    } catch(err){
      console.error('Error al guardar el envío:', err);
      showToast('No se pudo guardar: '+(err && err.message ? err.message : err));
    }
  }

  function deleteVisit(){
    if(!state.editingVisit || !state.editingVisit.visitId) return;
    var visitId = state.editingVisit.visitId;
    delete state.visits[visitId];
    delete state.dayVisits[visitId];
    renderBranchGrid();
    if(state.view==='day') renderDayBranches();
    if(!state.sb){ showToast('Sin conexión: no se pudo eliminar.'); closeVisitModal(); return; }
    state.sb.from('visits').delete().eq('id', visitId).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeVisitModal();
  }

  function writeVisit(payload){
    state.visits[payload.id] = payload;
    if(payload.date===state.day) state.dayVisits[payload.id] = payload;
    // Igual que en writeTrip: el guardado se dispara antes de repintar, para
    // que un error al dibujar la grilla nunca impida que el envío se guarde.
    if(!state.sb){
      showToast('Sin conexión: el cambio no se guardó.');
    } else {
      state.sb.from('visits').upsert(payload).then(function(res){
        if(res.error){
          console.error('Error al guardar el envío en la base:', res.error);
          showToast('No se pudo guardar: '+res.error.message);
        }
      }).catch(function(err){
        console.error('Error al guardar el envío en la base:', err);
        showToast('No se pudo guardar: '+(err && err.message ? err.message : err));
      });
    }
    try {
      renderBranchGrid();
      if(state.view==='day') renderDayBranches();
    } catch(err){
      console.error('Error al actualizar la pantalla después de guardar:', err);
      showToast('Se guardó, pero hubo un error al actualizar la pantalla. Recargá la página.');
    }
  }

  // Cuando cambia el camión, sugiere su chofer/ayudante habitual — pero solo
  // en los campos vacíos, igual que en FlotaPesada.
  document.getElementById('vm-truck').addEventListener('change', function(){
    var t = truckById(this.value);
    var driverSel = document.getElementById('vm-driver');
    var helperSel = document.getElementById('vm-helper');
    if(t){
      if(!driverSel.value && t.driver) driverSel.value = t.driver;
      if(!helperSel.value && t.helper) helperSel.value = t.helper;
    }
  });
  document.getElementById('vm-cancel').addEventListener('click', closeVisitModal);
  document.getElementById('vm-save').addEventListener('click', saveVisit);
  document.getElementById('vm-delete').addEventListener('click', deleteVisit);

  function fetchVisitsMonth(){
    if(!state.sb) return;
    var y=state.year, m=state.month;
    var start = dateStr(y,m,1);
    var end = dateStr(y,m,daysInMonth(y,m));
    state.sb.from('visits').select('*').gte('date', start).lte('date', end).then(function(res){
      if(res.error){ showToast('Error cargando envíos a sucursales: '+res.error.message); return; }
      var visits = {};
      (res.data||[]).forEach(function(row){ visits[row.id] = row; });
      state.visits = visits;
      renderBranchGrid();
    });
  }

  // ---------- Auto-plan (Sucursales) ----------
  // Recorre día por día el mes visible (desde hoy si es el mes actual) y,
  // para cada sucursal activa, sugiere una visita en los días de semana que
  // históricamente le corresponden (topWeekdaysForBranch) — el mismo
  // principio que el autoplan de FlotaPesada, pero acá varias sucursales
  // pueden compartir el mismo día (no hay restricción de "un camión por
  // día"). No pisa visitas ya cargadas.
  function autoPlanVisits(){
    var branches = activeBranches();
    var nd = daysInMonth(state.year, state.month);
    var now = new Date();
    var isCurrentMonth = (state.year===now.getFullYear() && state.month===now.getMonth());
    var todo = [];
    for(var d=1; d<=nd; d++){
      if(isCurrentMonth && d<now.getDate()) continue;
      var ds = dateStr(state.year, state.month, d);
      var wd = pyWeekday(new Date(state.year, state.month, d));
      branches.forEach(function(b){
        if(visitsForCell(ds, b.id).length) return;
        if(topWeekdaysForBranch(b.id).indexOf(wd)===-1) return;
        var pattern = BRANCH_CARGO_PATTERN[b.id];
        if(!pattern || pattern.length===0) return;
        todo.push({date:ds, branchId:b.id, cargo: pattern.map(function(c){ return {type:c.type, qty:c.qty}; })});
      });
    }
    if(todo.length===0){ showToast('No hay sugerencias nuevas para este mes.'); return; }
    if(!state.sb){ showToast('Sin conexión: no se puede guardar la planificación.'); return; }

    var btn = document.getElementById('branch-autoplan-btn');
    btn.disabled = true;
    var i = 0;
    function next(){
      if(i>=todo.length){
        btn.disabled = false;
        btn.textContent = '✨ Planificar automáticamente';
        showToast('Se sugirieron '+todo.length+' visitas según el histórico de reposición.');
        return;
      }
      var item = todo[i];
      btn.textContent = 'Guardando '+(i+1)+' / '+todo.length+'...';
      var visitId = generateVisitId(item.date, item.branchId);
      var payload = {id:visitId, date:item.date, branch_id:item.branchId, note:'', status:'actual', source:'auto', updated_by: whoName()+' (auto)', updated_at:new Date().toISOString(), cargo:item.cargo};
      state.visits[payload.id] = payload;
      state.sb.from('visits').upsert(payload).then(function(){ i++; next(); });
    }
    renderBranchGrid();
    next();
  }
  document.getElementById('branch-autoplan-btn').addEventListener('click', autoPlanVisits);

  // ================================================================
  // Dashboard
  // ================================================================
  document.getElementById('dash-from').addEventListener('change', fetchDashboard);
  document.getElementById('dash-to').addEventListener('change', fetchDashboard);

  // Sub-pestañas del Dashboard: Viajes (todo lo que ya había) y Gastos
  // (Compras) por separado, para que cada una se pueda ver sin tener que
  // scrollear una sola pantalla larguísima con todo junto.
  function switchDashSubTab(tab){
    state.dashSubTab = tab;
    document.getElementById('dash-sub-viajes').hidden = (tab!=='viajes');
    document.getElementById('dash-sub-gastos').hidden = (tab!=='gastos');
    document.getElementById('dashsubbtn-viajes').classList.toggle('active', tab==='viajes');
    document.getElementById('dashsubbtn-gastos').classList.toggle('active', tab==='gastos');
  }
  document.getElementById('dashsubbtn-viajes').addEventListener('click', function(){ switchDashSubTab('viajes'); });
  document.getElementById('dashsubbtn-gastos').addEventListener('click', function(){ switchDashSubTab('gastos'); });

  (function initDashDefaults(){
    var today = new Date();
    var fEl = document.getElementById('dash-from'), tEl = document.getElementById('dash-to');
    if(!fEl.value) fEl.value = dateStr(today.getFullYear(), today.getMonth(), 1);
    if(!tEl.value) tEl.value = todayStr();
  })();

  function dashboardDates(){
    var fEl = document.getElementById('dash-from'), tEl = document.getElementById('dash-to');
    var today = new Date();
    var start = fEl.value || dateStr(today.getFullYear(), today.getMonth(), 1);
    var end = tEl.value || todayStr();
    if(start > end){ var tmp=start; start=end; end=tmp; }
    return {start:start, end:end};
  }

  function fetchDashboard(){
    if(!state.sb){ renderDashboard(); return; }
    var range = dashboardDates();
    document.getElementById('dashboard-loading').hidden = false;
    state.sb.from('trips').select('*').gte('date', range.start).lte('date', range.end).then(function(res){
      document.getElementById('dashboard-loading').hidden = true;
      if(res.error){ showToast('Error cargando el dashboard: '+res.error.message); return; }
      state.dashTrips = res.data || [];
      renderDashboard();
    });
    state.sb.from('visits').select('*').gte('date', range.start).lte('date', range.end).then(function(res){
      if(res.error){ showToast('Error cargando el dashboard de Sucursales: '+res.error.message); return; }
      state.dashVisits = res.data || [];
      renderDashboard();
    });
    EXTRA_KINDS.forEach(function(kind){
      state.sb.from(kind.visitCollection).select('*').gte('date', range.start).lte('date', range.end).then(function(res){
        if(res.error){ showToast('Error cargando el dashboard de '+kind.label+': '+res.error.message); return; }
        state.extra[kind.key].dashVisits = res.data || [];
        renderDashboard();
      });
    });
  }

  function labelForRoute(id){ var r = state.routes.filter(function(x){return x.id===id;})[0]; return r?r.label:id; }
  function labelForTruck(id){ var t = truckById(id); return t?t.label:('Camión '+id); }

  function tally(list, keyFn, labelFn){
    var counts = {}, labels = {};
    list.forEach(function(item){
      var k = keyFn(item);
      if(k===null || k===undefined || k==='') return;
      counts[k] = (counts[k]||0)+1;
      labels[k] = labelFn ? labelFn(k) : k;
    });
    return Object.keys(counts).map(function(k){ return {key:k, label:labels[k], count:counts[k]}; })
      .sort(function(a,b){ return b.count-a.count; });
  }

  // Suma cantidades de carga por tipo (no cuenta viajes: suma la columna
  // "cantidad" de cada línea de carga cargada en los viajes del período).
  function cargoQtyTotals(trips){
    var totals = {};
    trips.forEach(function(t){
      (t.cargo||[]).forEach(function(c){
        if(!c.type) return;
        var q = parseFloat(c.qty);
        if(isNaN(q)) q = 0;
        totals[c.type] = (totals[c.type]||0)+q;
      });
    });
    return Object.keys(totals).map(function(k){
      var v = totals[k];
      return {key:k, label:cargoTypeLabel(k), count: Math.round(v*100)/100};
    }).sort(function(a,b){ return b.count-a.count; });
  }

  function fmtMoney(n){
    return '$'+Number(n||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  }

  // Como tally(), pero suma un valor (valueFn) en vez de contar ocurrencias.
  // Los ítems sin key (p.ej. factura sin centro de costo cargado) se
  // agrupan bajo sinLabel, para que la suma de las barras coincida con el
  // total general en vez de "perder" ese gasto sin clasificar.
  function sumBy(list, keyFn, labelFn, valueFn, sinLabel){
    var sums = {}, labels = {};
    list.forEach(function(item){
      var k = keyFn(item);
      if(k===null || k===undefined || k==='') k = '__sin__';
      var v = valueFn(item);
      if(isNaN(v)) v = 0;
      sums[k] = (sums[k]||0)+v;
      labels[k] = k==='__sin__' ? (sinLabel||'(Sin clasificar)') : (labelFn ? labelFn(k) : k);
    });
    return Object.keys(sums).map(function(k){ return {key:k, label:labels[k], count: Math.round(sums[k]*100)/100}; })
      .sort(function(a,b){ return b.count-a.count; });
  }

  function renderMoneyBarList(containerId, rows, opts){
    opts = opts || {};
    var el = document.getElementById(containerId);
    el.innerHTML = '';
    if(rows.length===0){
      el.innerHTML = '<div class="bar-empty">Sin datos en este período</div>';
      return;
    }
    var max = rows[0].count;
    var top = opts.limit ? rows.slice(0, opts.limit) : rows;
    var restCount = rows.length - top.length;
    var restSum = rows.slice(top.length).reduce(function(s,r){return s+r.count;},0);
    top.forEach(function(r){
      var row = document.createElement('div');
      row.className = 'barrow money';
      var pct = max>0 ? Math.max(4, Math.round(r.count/max*100)) : 0;
      var fill = opts.fillFn ? opts.fillFn(r) : (opts.fill||'var(--chart-gastos)');
      row.innerHTML = '<div class="barname" title="'+esc(r.label)+'">'+esc(r.label)+'</div>'+
        '<div class="bartrack"><div class="barfill" style="width:'+pct+'%; background:'+fill+';"></div></div>'+
        '<div class="barcount">'+fmtMoney(r.count)+'</div>';
      el.appendChild(row);
    });
    if(restCount>0){
      var more = document.createElement('div');
      more.className = 'bar-more';
      more.textContent = '+ '+restCount+' más ('+fmtMoney(restSum)+')';
      el.appendChild(more);
    }
  }

  function renderBarList(containerId, rows, opts){
    opts = opts || {};
    var el = document.getElementById(containerId);
    el.innerHTML = '';
    if(rows.length===0){
      el.innerHTML = '<div class="bar-empty">Sin datos en este período</div>';
      return;
    }
    var max = rows[0].count;
    var top = opts.limit ? rows.slice(0, opts.limit) : rows;
    var restCount = rows.length - top.length;
    var restSum = rows.slice(top.length).reduce(function(s,r){return s+r.count;},0);
    top.forEach(function(r){
      var row = document.createElement('div');
      row.className = 'barrow';
      var pct = max>0 ? Math.max(4, Math.round(r.count/max*100)) : 0;
      var fill = opts.fillFn ? opts.fillFn(r) : (opts.fill||'var(--accent)');
      row.innerHTML = '<div class="barname" title="'+esc(r.label)+'">'+esc(r.label)+'</div>'+
        '<div class="bartrack"><div class="barfill" style="width:'+pct+'%; background:'+fill+';"></div></div>'+
        '<div class="barcount">'+r.count+'</div>';
      el.appendChild(row);
    });
    if(restCount>0){
      var more = document.createElement('div');
      more.className = 'bar-more';
      more.textContent = '+ '+restCount+' más ('+restSum+' viajes)';
      el.appendChild(more);
    }
  }

  function renderDashboard(){
    var trips = state.dashTrips;
    var validTrips = trips.filter(function(t){ return t.truck; });

    // KPI tiles
    document.getElementById('kpi-total').textContent = validTrips.length;
    var byTruckAll = tally(validTrips, function(t){return t.truck;}, labelForTruck);
    var byDriverAll = tally(validTrips, function(t){return t.driver;});
    var byRouteAll = tally(validTrips, function(t){return t.route_id;}, labelForRoute);
    document.getElementById('kpi-truck').textContent = byTruckAll[0] ? byTruckAll[0].label+' ('+byTruckAll[0].count+')' : '—';
    document.getElementById('kpi-driver').textContent = byDriverAll[0] ? byDriverAll[0].label+' ('+byDriverAll[0].count+')' : '—';
    document.getElementById('kpi-route').textContent = byRouteAll[0] ? byRouteAll[0].label+' ('+byRouteAll[0].count+')' : '—';

    renderBarList('bar-truck', byTruckAll, {fillFn:function(r){ return truckColorVar(r.key); }});
    renderBarList('bar-driver', byDriverAll, {limit:10, fill:'var(--chart-driver)'});
    renderBarList('bar-helper', tally(validTrips, function(t){return t.helper;}), {limit:10, fill:'var(--chart-helper)'});
    renderBarList('bar-route', byRouteAll, {limit:12, fill:'var(--chart-route)'});

    // Weekday distribution — fixed Mon..Sun order, not sorted by size
    var wdCounts = [0,0,0,0,0,0,0];
    validTrips.forEach(function(t){
      if(!t.date) return;
      var d = new Date(t.date+'T00:00:00');
      wdCounts[pyWeekday(d)]++;
    });
    var wdRows = WD_LABELS_LONG.map(function(lbl,i){ return {key:i, label:lbl, count:wdCounts[i]}; });
    renderBarList('bar-weekday', wdRows, {fill:'var(--chart-weekday)'});

    // Origen de la carga: manual vs automática vs importada
    var bySource = tally(validTrips, function(t){return t.source||'manual';}, function(k){
      return k==='auto' ? 'Planificación automática' : (k==='import' ? 'Importado del Excel' : 'Carga manual');
    });
    renderBarList('bar-source', bySource, {fill:'var(--chart-source)'});

    renderBarList('bar-cargo', cargoQtyTotals(validTrips), {limit:15, fill:'var(--chart-cargo)'});

    renderCrosstab(validTrips);

    // --- Sucursales ---
    var visits = state.dashVisits;
    document.getElementById('kpi-branch-visits').textContent = visits.length;
    renderBarList('bar-branch', tally(visits, function(v){return v.branch_id;}, branchLabel), {fillFn:function(r){ return destColorVar(r.key); }});
    renderBarList('bar-branch-cargo', cargoQtyTotals(visits), {limit:15, fill:'var(--chart-branch)'});

    // --- Empresas / Eventuales ---
    EXTRA_KINDS.forEach(function(kind){
      var s = state.extra[kind.key];
      var extraVisits = s.dashVisits;
      document.getElementById(kind.kpiId).textContent = extraVisits.length;
      renderBarList(kind.barDestId, tally(extraVisits, function(v){return v[kind.idField];}, function(id){ return extraItemLabel(kind, id); }), {fillFn:function(r){ return destColorVar(r.key); }});
      renderBarList(kind.barCargoId, cargoQtyTotals(extraVisits), {limit:15, fill:kind.chartVar});
    });

    // --- Gastos (Compras): facturas por fecha de factura dentro del
    // período del dashboard (pendientes + pagadas — el "gasto comprometido",
    // no solo lo ya pagado) ---
    var gastoRange = dashboardDates();
    var facturasPeriodo = state.facturas.filter(function(f){
      return noAnulado(f) && f.fecha && f.fecha>=gastoRange.start && f.fecha<=gastoRange.end;
    });
    var gastoTotal = facturasPeriodo.reduce(function(s,f){ return s+Number(f.monto||0); }, 0);
    document.getElementById('kpi-gastos-total').textContent = fmtMoney(gastoTotal);
    document.getElementById('kpi-gastos-facturas').textContent = facturasPeriodo.length;

    // Facturas repartidas: cada línea suma a su centro de costo/concepto.
    var lineasPeriodo = [];
    facturasPeriodo.forEach(function(f){ facturaLineas(f).forEach(function(l){ lineasPeriodo.push(l); }); });
    var porCentro = sumBy(lineasPeriodo, function(l){return l.centroCostoId;}, centroCostoLabel, function(l){return Number(l.monto||0);}, '(Sin centro de costo)');
    var porConcepto = sumBy(lineasPeriodo, function(l){return l.conceptoId;}, conceptoLabel, function(l){return Number(l.monto||0);}, '(Sin concepto)');
    var porProveedorGasto = sumBy(facturasPeriodo, function(f){return f.proveedorId;}, proveedorNombre, function(f){return f.monto||0;}, '(Sin proveedor)');

    document.getElementById('kpi-gastos-centro').textContent = porCentro[0] ? porCentro[0].label+' ('+fmtMoney(porCentro[0].count)+')' : '—';
    document.getElementById('kpi-gastos-concepto').textContent = porConcepto[0] ? porConcepto[0].label+' ('+fmtMoney(porConcepto[0].count)+')' : '—';

    renderMoneyBarList('bar-gastos-centro', porCentro, {limit:15});
    // Por área (raíz del árbol) y por móvil / sucursal (centros que lo piden).
    var porArea = sumBy(lineasPeriodo, function(l){ var r = ccRaiz(l.centroCostoId); return r ? r.id : ''; },
      function(id){ var c = centroCostoById(id); return c ? ccNombre(c) : ''; }, function(l){return Number(l.monto||0);}, '(Sin centro de costo)');
    renderMoneyBarList('bar-gastos-area', porArea);
    var porRef = function(pref){ return sumBy(lineasPeriodo.filter(function(l){ return ccRefEfectiva(l.centroCostoId, l.ccRef).indexOf(pref)===0; }),
      function(l){ return ccRefEfectiva(l.centroCostoId, l.ccRef); }, ccRefLabel, function(l){return Number(l.monto||0);}, ''); };
    renderMoneyBarList('bar-gastos-movil', porRef('movil:'), {limit:20});
    // Costo de mantenimiento de cada móvil: solo lo imputado bajo Mantenimiento › Flota.
    var lineasFlota = lineasPeriodo.filter(function(l){ return ccRuta(l.centroCostoId).some(function(n){ return n.id==='cc_mantenimiento_flota'; }); });
    renderMoneyBarList('bar-gastos-mant-movil', sumBy(lineasFlota.filter(function(l){ return ccRefEfectiva(l.centroCostoId, l.ccRef).indexOf('movil:')===0; }),
      function(l){ return ccRefEfectiva(l.centroCostoId, l.ccRef); }, ccRefLabel, function(l){return Number(l.monto||0);}, ''), {limit:20});
    renderMoneyBarList('bar-gastos-sucursal', porRef('suc:'), {limit:20});
    renderMoneyBarList('bar-gastos-concepto', porConcepto);
    renderMoneyBarList('bar-gastos-proveedor', porProveedorGasto, {limit:12});
  }

  function renderCrosstab(validTrips){
    var trips = validTrips.filter(function(t){ return t.driver; });
    var el = document.getElementById('crosstab');
    if(trips.length===0){
      el.innerHTML = '<div class="bar-empty">Sin datos en este período</div>';
      return;
    }
    var driverTotals = tally(trips, function(t){return t.driver;});
    var routeTotals = tally(trips, function(t){return t.route_id;}, labelForRoute);
    var matrix = {}, max = 0;
    trips.forEach(function(t){
      var k = t.driver+'|'+t.route_id;
      matrix[k] = (matrix[k]||0)+1;
      if(matrix[k]>max) max = matrix[k];
    });
    var html = '<div class="crosstab-wrap"><table class="crosstab"><thead><tr><th class="corner">Chofer</th>';
    routeTotals.forEach(function(r){ html += '<th>'+esc(r.label)+'</th>'; });
    html += '<th class="total">Total</th></tr></thead><tbody>';
    driverTotals.forEach(function(d){
      html += '<tr><td class="rowhead">'+esc(d.label)+'</td>';
      routeTotals.forEach(function(r){
        var c = matrix[d.key+'|'+r.key]||0;
        var style = c>0 ? ' style="background:color-mix(in srgb, var(--accent) '+Math.round(c/max*60)+'%, transparent);"' : '';
        html += '<td class="cnt"'+style+'>'+(c||'')+'</td>';
      });
      html += '<td class="total cnt">'+d.count+'</td></tr>';
    });
    html += '</tbody></table></div>';
    el.innerHTML = html;
  }

  // ---------- Settings (ABM: rutas, camiones, choferes, ayudantes, etc.) ----------
  var SETTINGS_ALL_TABS = ['routes','trucks','drivers','helpers','cargo','branches','companies','occasionals','centros-costo','conceptos','rubros','medios-caja','retenciones','calidad-listas','auth'];
  function switchSettingsTab(tab){
    refreshSettingsTabsVisibility();
    if(!settingsTabVisible(tab)) tab = firstVisibleSettingsTab();
    state.settingsTab = tab;
    SETTINGS_ALL_TABS.forEach(function(t){
      var panel = document.getElementById('stab-'+t);
      if(panel) panel.hidden = (t!==tab);
      var btn = document.getElementById('stabbtn-'+t);
      if(btn) btn.classList.toggle('active', t===tab);
    });
    // Sincroniza la categoría (nav de la izquierda) con la pestaña activa,
    // sin volver a llamar a switchSettingsCategory (evita recursión).
    var cat = settingsCategoryForTab(tab);
    state.settingsCategory = cat;
    SETTINGS_CATEGORIES.forEach(function(c){
      var navBtn = document.getElementById('scatbtn-'+c.id);
      if(navBtn) navBtn.classList.toggle('active', c.id===cat);
      var subtabsEl = document.getElementById('settings-subtabs-'+c.id);
      if(subtabsEl) subtabsEl.hidden = (c.id!==cat);
    });
    if(tab==='auth') renderAccesoSettings();
    if(tab==='retenciones') renderRetencionesSettings();
    if(tab==='calidad-listas' && window.Calidad) window.Calidad.renderListas();
  }
  function switchSettingsCategory(cat){
    refreshSettingsTabsVisibility();
    if(!settingsCategoryVisible(cat)) cat = firstVisibleSettingsCategory();
    var tab = firstVisibleSettingsTabInCategory(cat) || firstVisibleSettingsTab();
    switchSettingsTab(tab);
  }
  SETTINGS_ALL_TABS.forEach(function(t){
    var btn = document.getElementById('stabbtn-'+t);
    if(btn) btn.addEventListener('click', function(){ switchSettingsTab(t); });
  });
  SETTINGS_CATEGORIES.forEach(function(cat){
    var btn = document.getElementById('scatbtn-'+cat.id);
    if(btn) btn.addEventListener('click', function(){ switchSettingsCategory(cat.id); });
  });

  function renderSettings(){
    // --- Rutas ---
    var rl = document.getElementById('routes-list');
    rl.innerHTML = '';
    state.routes.slice().sort(function(a,b){return (a.order||0)-(b.order||0);}).forEach(function(r){
      var row = document.createElement('div');
      row.className = 'setting-row';
      var toggle = document.createElement('button');
      toggle.className = 'toggle'+(r.active!==false?' on':'');
      toggle.innerHTML = '<span class="knob"></span>';
      toggle.addEventListener('click', function(){
        r.active = r.active===false ? true : false;
        writeRoute(r);
        renderSettings(); renderGrid();
      });
      var inp = document.createElement('input');
      inp.type='text'; inp.value=r.label;
      inp.addEventListener('change', function(){ r.label=this.value.trim()||r.id; writeRoute(r); renderGrid(); });
      row.appendChild(toggle); row.appendChild(inp);
      rl.appendChild(row);
    });

    // --- Camiones ---
    var tl = document.getElementById('trucks-list');
    tl.innerHTML = '';
    state.trucks.forEach(function(t){
      var card = document.createElement('div');
      card.className = 'truck-card';

      var top = document.createElement('div');
      top.className = 'truck-card-top';
      var sw = document.createElement('span');
      sw.className='swatch'; sw.style.background=truckColorVar(t.id); sw.style.borderRadius='50%';
      var toggle = document.createElement('button');
      toggle.className = 'toggle'+(t.active!==false?' on':'');
      toggle.innerHTML = '<span class="knob"></span>';
      toggle.addEventListener('click', function(){
        t.active = t.active===false ? true : false;
        writeTruck(t);
        renderSettings(); renderGrid();
      });
      var inp = document.createElement('input');
      inp.type='text'; inp.value=t.label;
      inp.addEventListener('change', function(){ t.label=this.value.trim()||('Camión '+t.id); writeTruck(t); renderGrid(); renderStats(); });
      top.appendChild(sw); top.appendChild(toggle); top.appendChild(inp);

      var truckScopeSel = document.createElement('select');
      truckScopeSel.className = 'scope-select';
      truckScopeSel.title = 'Dónde puede aparecer para asignar';
      truckScopeSel.innerHTML = '<option value="both">Ambos</option><option value="flota">Solo FlotaPesada</option><option value="sucursales">Solo Sucursales</option><option value="gastos">Solo gastos (no hace viajes)</option>';
      truckScopeSel.value = t.scope || 'both';
      truckScopeSel.addEventListener('change', function(){ t.scope = this.value; writeTruck(t); renderGrid(); renderBranchGrid(); });
      top.appendChild(truckScopeSel);
      var ficha = null, datosT = [t.patente, t.modelo, t.anio, t.funcion, t.flota].filter(Boolean);
      if(datosT.length){
        ficha = document.createElement('div');
        ficha.className = 'truck-card-ficha muted small';
        ficha.textContent = datosT.join(' · ');
      }

      var sub = document.createElement('div');
      sub.className = 'truck-card-sub';
      var driverSel = document.createElement('select');
      fillSelect(driverSel, driversForScope('flota'), 'name', 'name', 'Chofer habitual');
      driverSel.value = t.driver||'';
      driverSel.addEventListener('change', function(){ t.driver=this.value; writeTruck(t); });
      var helperSel = document.createElement('select');
      fillSelect(helperSel, helpersForScope('flota'), 'name', 'name', 'Ayudante habitual');
      helperSel.value = t.helper||'';
      helperSel.addEventListener('change', function(){ t.helper=this.value; writeTruck(t); });
      sub.appendChild(driverSel); sub.appendChild(helperSel);

      card.appendChild(top); if(ficha) card.appendChild(ficha); card.appendChild(sub);
      tl.appendChild(card);
    });

    // --- Choferes ---
    var dl = document.getElementById('drivers-list');
    dl.innerHTML = '';
    activeDrivers().concat(state.drivers.filter(function(d){return d.active===false;})).forEach(function(d){
      dl.appendChild(personRow(d, writeDriver, true));
    });

    // --- Ayudantes ---
    var hl = document.getElementById('helpers-list');
    hl.innerHTML = '';
    activeHelpers().concat(state.helpers.filter(function(h){return h.active===false;})).forEach(function(h){
      hl.appendChild(personRow(h, writeHelper, true));
    });

    // --- Cargas ---
    var cl = document.getElementById('cargo-list');
    cl.innerHTML = '';
    activeCargoTypes().concat(state.cargoTypes.filter(function(c){return c.active===false;})).forEach(function(c){
      cl.appendChild(personRow(c, writeCargoType));
    });

    // --- Sucursales ---
    var bl = document.getElementById('branches-list');
    bl.innerHTML = '';
    state.branches.slice().sort(function(a,b){return (a.order||0)-(b.order||0);}).forEach(function(b){
      var row = document.createElement('div');
      row.className = 'setting-row';
      var toggle = document.createElement('button');
      toggle.className = 'toggle'+(b.active!==false?' on':'');
      toggle.innerHTML = '<span class="knob"></span>';
      toggle.addEventListener('click', function(){
        b.active = b.active===false ? true : false;
        writeBranch(b);
        renderSettings(); renderBranchGrid();
      });
      var inp = document.createElement('input');
      inp.type='text'; inp.value=b.label;
      inp.addEventListener('change', function(){ b.label=this.value.trim()||b.id; writeBranch(b); renderBranchGrid(); });
      row.appendChild(toggle); row.appendChild(inp);
      bl.appendChild(row);
    });

    // --- Empresas / Eventuales ---
    EXTRA_KINDS.forEach(function(kind){
      var s = state.extra[kind.key];
      var list = document.getElementById(kind.settingsListId);
      list.innerHTML = '';
      s.items.slice().sort(function(a,b){return (a.order||0)-(b.order||0);}).forEach(function(it){
        var row = document.createElement('div');
        row.className = 'setting-row';
        var toggle = document.createElement('button');
        toggle.className = 'toggle'+(it.active!==false?' on':'');
        toggle.innerHTML = '<span class="knob"></span>';
        toggle.addEventListener('click', function(){
          it.active = it.active===false ? true : false;
          writeExtraItem(kind, it);
          renderSettings(); renderExtraGrid(kind);
        });
        var inp = document.createElement('input');
        inp.type='text'; inp.value=it.label;
        inp.addEventListener('change', function(){ it.label=this.value.trim()||it.id; writeExtraItem(kind, it); renderExtraGrid(kind); });
        row.appendChild(toggle); row.appendChild(inp);
        list.appendChild(row);
      });
    });

    // --- Acceso ---
    if(canManageAccess()) renderAccesoSettings();
  }

  function buildRoleCard(role){
    var card = document.createElement('div');
    card.className = 'role-card';
    card.dataset.roleId = role.id;

    var top = document.createElement('div');
    top.className = 'role-card-top';
    var nombreInp = document.createElement('input');
    nombreInp.type = 'text'; nombreInp.className = 'role-nombre'; nombreInp.maxLength = 40;
    nombreInp.placeholder = 'Nombre del perfil'; nombreInp.value = role.nombre || '';
    var pwInp = document.createElement('input');
    pwInp.type = 'text'; pwInp.className = 'role-password'; pwInp.maxLength = 60;
    pwInp.placeholder = 'Contraseña (ingreso anterior, opcional)'; pwInp.value = role.password || '';
    pwInp.title = 'Solo para el ingreso anterior por contraseña de perfil. Con el ingreso por email no hace falta.';
    pwInp.style.display = 'none'; pwInp.value = '';   // ingreso por contraseña de perfil eliminado
    top.appendChild(nombreInp); top.appendChild(pwInp);
    card.appendChild(top);

    var manageRow = document.createElement('label');
    manageRow.className = 'role-manage-row';
    var manageChk = document.createElement('input');
    manageChk.type = 'checkbox'; manageChk.className = 'role-manage-access';
    manageChk.checked = !!role.manageAccess;
    manageRow.appendChild(manageChk);
    manageRow.appendChild(document.createTextNode('Puede administrar perfiles y contraseñas (⚙ Acceso)'));
    card.appendChild(manageRow);

    var grid = document.createElement('div');
    grid.className = 'role-permisos-grid';
    var tabArea = {};
    AREAS.forEach(function(a){ a.tabs.forEach(function(t){ if(!tabArea[t]) tabArea[t] = a; }); });
    var ordenTabs = [];
    AREAS.forEach(function(a){ a.tabs.forEach(function(t){ if(ordenTabs.indexOf(t)===-1 && tabArea[t]===a) ordenTabs.push(t); }); });
    var areaPrev = null;
    ordenTabs.map(function(id){ return TAB_DEFS.find(function(t){ return t.id===id; }); }).filter(Boolean).forEach(function(t){
      if(tabArea[t.id]!==areaPrev){
        areaPrev = tabArea[t.id];
        var h = document.createElement('div');
        h.className = 'role-area-head';
        h.textContent = areaPrev.label+(t.id==='dashboard' ? '' : '');
        grid.appendChild(h);
      }
      var lbl = document.createElement('div');
      lbl.className = 'role-permiso-row';
      lbl.textContent = t.id==='dashboard' ? 'Dashboard (Viajes en Logística, Gastos en Administración)' : t.label;
      var sel = document.createElement('select');
      sel.className = 'role-permiso-select';
      sel.dataset.tab = t.id;
      sel.innerHTML = '<option value="oculta">Oculta</option><option value="ver">Ver</option><option value="editar">Editar</option>';
      sel.value = (role.permisos && role.permisos[t.id]) || ((t.id==='comercial' || t.id==='rrhh') && role.manageAccess ? 'editar' : 'oculta');
      grid.appendChild(lbl); grid.appendChild(sel);
    });
    card.appendChild(grid);

    var delBtn = document.createElement('button');
    delBtn.className = 'btn ghost role-card-del';
    delBtn.textContent = 'Eliminar perfil';
    delBtn.addEventListener('click', function(){ card.remove(); });
    card.appendChild(delBtn);

    return card;
  }

  function renderAccesoSettings(){
    var list = document.getElementById('roles-list');
    if(!list) return;
    list.innerHTML = '';
    (state.auth.roles||[]).forEach(function(role){
      list.appendChild(buildRoleCard(role));
    });
    renderUsuarios();
  }

  // ---------- Usuarios (ingreso con email) ----------
  // La tabla usuarios dice quién puede entrar (activo) y con qué perfil. Las
  // cuentas (email + contraseña) son de Supabase Auth; acá se crean con
  // signUp desde un cliente aparte, para no cerrar la sesión de quien la crea.
  function perfilOptionsHtml(sel){
    var roles = state.auth.roles||[];
    // Perfil asignado que ya no está en la lista (borrado o nunca guardado):
    // se muestra marcado en vez de aparentar "Solo Comercial".
    var huerfano = sel && !roles.some(function(r){ return r.id===sel; })
      ? '<option value="'+esc(sel)+'" selected>⚠ Perfil inexistente — elegí otro</option>' : '';
    return huerfano+'<option value="">Solo Comercial</option>'+roles.map(function(r){
      return '<option value="'+esc(r.id)+'"'+(r.id===sel?' selected':'')+'>'+esc(r.nombre||r.id)+'</option>'; }).join('');
  }
  function renderUsuarios(){
    var box = document.getElementById('usuarios-list');
    var msg = document.getElementById('usuarios-msg');
    if(!box) return;
    document.getElementById('nu-perfil').innerHTML = perfilOptionsHtml('');
    var puede = !!(state.sb && state.sessionEmail);
    document.getElementById('usuario-add').hidden = !puede;
    if(!puede){
      box.innerHTML = '';
      msg.textContent = 'Para administrar usuarios tenés que haber ingresado con tu email (no con la contraseña de perfil).';
      return;
    }
    msg.textContent = 'Cargando usuarios…';
    state.sb.from('usuarios').select('*').order('email').then(function(res){
      if(res.error){ msg.textContent = 'No se pudieron leer los usuarios: '+res.error.message+' (¿corriste el schema.sql nuevo?)'; return; }
      msg.textContent = '';
      box.innerHTML = '';
      (res.data||[]).forEach(function(u){
        var row = document.createElement('div');
        row.className = 'usuario-row';
        row.innerHTML = '<div class="em" title="'+esc(u.email)+'">'+esc(u.email)+'</div>'+
          '<select>'+perfilOptionsHtml(u.perfil||'')+'</select>'+
          '<label><input type="checkbox"'+(u.activo!==false?' checked':'')+'> Activo</label>';
        var sel = row.querySelector('select'), chk = row.querySelector('input');
        function guardar(){
          if(u.email===state.sessionEmail && (!chk.checked || sel.value!==u.perfil) && !confirmarCambioPropio(sel.value, chk.checked)){ sel.value = u.perfil||''; chk.checked = u.activo!==false; return; }
          state.sb.from('usuarios').update({perfil: sel.value || null, activo: chk.checked}).eq('email', u.email).then(function(r){
            if(r.error){ showToast('No se pudo guardar: '+r.error.message); return; }
            u.perfil = sel.value || null; u.activo = chk.checked;
            showToast('Usuario actualizado.');
          });
        }
        sel.addEventListener('change', guardar);
        chk.addEventListener('change', guardar);
        box.appendChild(row);
      });
      if(!(res.data||[]).length) box.innerHTML = '<div class="sub">Todavía no hay usuarios.</div>';
    });
  }
  // Evita que el administrador se saque a sí mismo el acceso sin querer.
  function confirmarCambioPropio(perfil, activo){
    var r = (state.auth.roles||[]).find(function(x){ return x.id===perfil; });
    if(activo && r && r.manageAccess) return true;
    showToast('No podés quitarte a vos mismo el acceso de administrador. Pedíselo a otro administrador.');
    return false;
  }
  document.getElementById('nu-add').addEventListener('click', function(){
    var email = document.getElementById('nu-email').value.trim().toLowerCase();
    var pw = document.getElementById('nu-password').value;
    var perfil = document.getElementById('nu-perfil').value || null;
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ showToast('Ingresá un email válido.'); return; }
    if(pw.length<6){ showToast('La contraseña inicial tiene que tener al menos 6 caracteres.'); return; }
    var btn = this; btn.disabled = true;
    var aux = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY, {auth:{persistSession:false, autoRefreshToken:false, detectSessionInUrl:false, storageKey:'alta-usuario'}});
    // Si Supabase tiene cerrado el registro (signup_disabled, lo recomendable),
    // igual se anota el usuario con su perfil y la cuenta se crea a mano en
    // Supabase → Authentication → Users → Add user.
    var sinRegistro = false;
    aux.auth.signUp({email:email, password:pw}).then(function(r){
      if(r.error && /signup.*(disabled|not allowed)|signups not allowed/i.test((r.error.code||'')+' '+r.error.message)) sinRegistro = true;
      else if(r.error && !/already|registered|exist/i.test(r.error.message)) throw r.error;
      return state.sb.from('usuarios').upsert({email:email, activo:true, perfil:perfil}, {onConflict:'email'});
    }).then(function(r){
      if(r && r.error) throw r.error;
      document.getElementById('nu-email').value = ''; document.getElementById('nu-password').value = '';
      if(sinRegistro) showToast('Usuario anotado con su perfil. Falta crearle la cuenta: en Supabase → Authentication → Users → Add user → Create new user, con este email, la contraseña y "Auto Confirm User" tildado.', 12000);
      else showToast('Usuario agregado. Si ya tenía cuenta, entra con su contraseña de siempre; si Supabase pide confirmar el email, le llega un mail.');
      renderUsuarios();
    }).catch(function(e){ showToast('No se pudo agregar: '+((e&&e.message)||'error')); })
    .finally(function(){ btn.disabled = false; });
  });

  function personRow(p, writeFn, showScope){
    var row = document.createElement('div');
    row.className = 'setting-row';
    var toggle = document.createElement('button');
    toggle.className = 'toggle'+(p.active!==false?' on':'');
    toggle.innerHTML = '<span class="knob"></span>';
    toggle.title = p.active!==false ? 'Activo — clic para dar de baja' : 'De baja — clic para reactivar';
    toggle.addEventListener('click', function(){
      p.active = p.active===false ? true : false;
      writeFn(p);
      renderSettings(); renderGrid();
    });
    var inp = document.createElement('input');
    inp.type='text'; inp.value=p.name;
    inp.addEventListener('change', function(){ p.name=this.value.trim()||p.name; writeFn(p); renderGrid(); });
    row.appendChild(toggle); row.appendChild(inp);
    if(showScope){
      var scopeSel = document.createElement('select');
      scopeSel.className = 'scope-select';
      scopeSel.title = 'Dónde puede aparecer para asignar';
      scopeSel.innerHTML = '<option value="both">Ambos</option><option value="flota">Solo FlotaPesada</option><option value="sucursales">Solo Sucursales</option>';
      scopeSel.value = p.scope || 'both';
      scopeSel.addEventListener('change', function(){ p.scope = this.value; writeFn(p); renderGrid(); renderBranchGrid(); });
      row.appendChild(scopeSel);
    }
    return row;
  }

  function writeRoute(r){
    if(!state.sb) return;
    state.sb.from('routes').upsert({id:r.id, label:r.label, sort_order:r.order||99, active:r.active!==false}).then(function(res){
      if(res.error) showToast('No se pudo guardar la ruta: '+res.error.message);
    });
  }
  function writeTruck(t){
    if(!state.sb) return;
    state.sb.from('trucks').upsert({id:t.id, label:t.label, active:t.active!==false, driver:t.driver||'', helper:t.helper||'', scope:t.scope||'both'}).then(function(res){
      if(res.error) showToast('No se pudo guardar el camión: '+res.error.message);
    });
  }
  function writeDriver(d){
    if(!state.sb) return;
    state.sb.from('drivers').upsert({id:d.id, name:d.name, active:d.active!==false, scope:d.scope||'both'}).then(function(res){
      if(res.error) showToast('No se pudo guardar el chofer: '+res.error.message);
    });
  }
  function writeHelper(h){
    if(!state.sb) return;
    state.sb.from('helpers').upsert({id:h.id, name:h.name, active:h.active!==false, scope:h.scope||'both'}).then(function(res){
      if(res.error) showToast('No se pudo guardar el ayudante: '+res.error.message);
    });
  }
  function writeCargoType(c){
    if(!state.sb) return;
    state.sb.from('cargo_types').upsert({id:c.id, name:c.name, active:c.active!==false, sort_order:c.order||99}).then(function(res){
      if(res.error) showToast('No se pudo guardar el tipo de carga: '+res.error.message);
    });
  }
  function writeBranch(b){
    if(!state.sb) return;
    state.sb.from('branches').upsert({id:b.id, label:b.label, sort_order:b.order||99, active:b.active!==false}).then(function(res){
      if(res.error) showToast('No se pudo guardar la sucursal: '+res.error.message);
    });
  }
  function writeExtraItem(kind, item){
    if(!state.sb) return;
    state.sb.from(kind.collection).upsert({id:item.id, label:item.label, sort_order:item.order||99, active:item.active!==false}).then(function(res){
      if(res.error) showToast('No se pudo guardar '+kind.singularLower+': '+res.error.message);
    });
  }
  // Devuelve una promesa que se resuelve true solo si quedó guardado en la
  // base: así no se muestran (ni se asignan a usuarios) perfiles que no se
  // guardaron de verdad.
  function writeAuthRoles(roles){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return Promise.resolve(false); }
    return state.sb.from('app_config').upsert({id:'auth', roles: roles}).then(function(res){
      if(res.error){ showToast('No se pudieron guardar los perfiles: '+res.error.message, 8000); return false; }
      return true;
    });
  }

  // ---------- Adjuntos (Google Drive) y lectura automática de facturas (API de Anthropic) ----------
  var pdfjsReady = false;

  function fmtBytes(n){
    if(!n) return '';
    if(n<1024) return n+' B';
    if(n<1024*1024) return Math.round(n/1024)+' KB';
    return (n/1024/1024).toFixed(1)+' MB';
  }

  // ---------- Adjuntos: Google Drive ----------
  // Los adjuntos (proveedores y facturas) se guardan en Google Drive, en una
  // subcarpeta por nombre de proveedor. No pasan por Supabase ni por Netlify,
  // así no ocupan espacio ahí. Ver GOOGLE_DRIVE_CLIENT_ID en config.js.
  //
  // Carpeta raíz: si se completa GOOGLE_DRIVE_ROOT_FOLDER_ID en config.js, las
  // subcarpetas de proveedor se crean DENTRO de esa carpeta ya existente (se
  // recomienda que sea una Unidad Compartida, para que el equipo entero vea
  // los mismos archivos en vez de que cada uno vea solo lo que subió con su
  // propia cuenta). Si se deja vacío, se mantiene el comportamiento anterior:
  // se crea sola una carpeta "Gestión Anafer - Adjuntos" en el Drive personal
  // de quien tenga la app abierta.
  //
  // Por eso el scope pedido es el de Drive completo (no "drive.file"): con
  // "drive.file" la app solo puede escribir en carpetas que ella misma creó,
  // y no podría escribir dentro de una carpeta/Unidad Compartida ya existente
  // como la de GOOGLE_DRIVE_ROOT_FOLDER_ID. Al ser una app en modo "Testing"
  // con Test users nombrados (equipo interno), esto no requiere verificación
  // de Google.
  var DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
  var DRIVE_ROOT_FOLDER_NAME = 'Gestión Anafer - Adjuntos';
  var DRIVE_EXTRA_PARAMS = 'supportsAllDrives=true&includeItemsFromAllDrives=true';
  var driveTokenClient = null;
  var driveAccessToken = null;
  var driveTokenExpiry = 0;
  var driveRootFolderId = null;
  var driveFolderCache = {};

  function driveReady(){ return !!window.GOOGLE_DRIVE_CLIENT_ID; }

  function ensureGisLoaded(){
    return new Promise(function(resolve, reject){
      if(window.google && google.accounts && google.accounts.oauth2) return resolve();
      var tries = 0;
      var check = setInterval(function(){
        tries++;
        if(window.google && google.accounts && google.accounts.oauth2){ clearInterval(check); resolve(); }
        else if(tries>80){ clearInterval(check); reject(new Error('No se pudo cargar Google Identity Services')); }
      }, 100);
    });
  }

  function getDriveAccessToken(){
    return ensureGisLoaded().then(function(){
      return new Promise(function(resolve, reject){
        var now = Date.now();
        if(driveAccessToken && now < driveTokenExpiry - 30000){ return resolve(driveAccessToken); }
        if(!driveTokenClient){
          driveTokenClient = google.accounts.oauth2.initTokenClient({
            client_id: window.GOOGLE_DRIVE_CLIENT_ID,
            scope: DRIVE_SCOPE,
            callback: function(){}
          });
        }
        driveTokenClient.callback = function(resp){
          if(resp && resp.access_token){
            driveAccessToken = resp.access_token;
            driveTokenExpiry = Date.now() + ((resp.expires_in||3300) * 1000);
            resolve(driveAccessToken);
          } else {
            reject(new Error('No se pudo autorizar el acceso a Google Drive'));
          }
        };
        driveTokenClient.error_callback = function(err){
          reject(new Error((err && err.message) || 'Autorización de Google Drive cancelada'));
        };
        driveTokenClient.requestAccessToken({ prompt: driveAccessToken ? '' : 'consent' });
      });
    });
  }

  function driveApiFetch(url, opts){
    return getDriveAccessToken().then(function(token){
      opts = opts || {};
      opts.headers = Object.assign({}, opts.headers||{}, {Authorization: 'Bearer '+token});
      return fetch(url, opts);
    });
  }

  function driveFindFolder(name, parentId){
    var safeName = name.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    var q = "name='"+safeName+"' and mimeType='application/vnd.google-apps.folder' and trashed=false and '"+(parentId||'root')+"' in parents";
    var url = 'https://www.googleapis.com/drive/v3/files?q='+encodeURIComponent(q)+'&fields=files(id,name)&spaces=drive&'+DRIVE_EXTRA_PARAMS;
    return driveApiFetch(url).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(data){
      return (data.files && data.files[0]) ? data.files[0].id : null;
    });
  }

  function driveCreateFolder(name, parentId){
    var metadata = { name: name, mimeType: 'application/vnd.google-apps.folder' };
    if(parentId) metadata.parents = [parentId];
    return driveApiFetch('https://www.googleapis.com/drive/v3/files?fields=id&'+DRIVE_EXTRA_PARAMS, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(metadata)
    }).then(function(r){
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r.json();
    }).then(function(data){ return data.id; });
  }

  function driveEnsureFolder(name, parentId){
    return driveFindFolder(name, parentId).then(function(id){
      return id || driveCreateFolder(name, parentId);
    });
  }

  function driveEnsureRootFolder(){
    if(driveRootFolderId) return Promise.resolve(driveRootFolderId);
    var fixedId = (window.GOOGLE_DRIVE_ROOT_FOLDER_ID||'').trim();
    if(fixedId){ driveRootFolderId = fixedId; return Promise.resolve(fixedId); }
    return driveEnsureFolder(DRIVE_ROOT_FOLDER_NAME, null).then(function(id){ driveRootFolderId = id; return id; });
  }

  function driveEnsureProveedorFolder(nombreProveedor){
    var key = (nombreProveedor||'').trim() || 'Sin proveedor';
    if(driveFolderCache[key]) return Promise.resolve(driveFolderCache[key]);
    return driveEnsureRootFolder().then(function(rootId){
      return driveEnsureFolder(key, rootId);
    }).then(function(id){ driveFolderCache[key] = id; return id; });
  }

  // Carpeta anidada dentro de la raíz (ej. ["Calidad", "Reclamos 2026", "Reclamo Nº 12"]).
  function driveEnsurePath(nombres){
    return driveEnsureRootFolder().then(function(root){
      return nombres.reduce(function(p, n){
        return p.then(function(parent){
          var k = parent+'/'+n;
          if(driveFolderCache[k]) return driveFolderCache[k];
          return driveEnsureFolder(n, parent).then(function(id){ driveFolderCache[k] = id; return id; });
        });
      }, Promise.resolve(root));
    });
  }
  function uploadAdjunto(file, nombreProveedor, carpetas){
    if(!driveReady()) return Promise.reject(new Error('Google Drive no está configurado (falta GOOGLE_DRIVE_CLIENT_ID en config.js)'));
    return (carpetas ? driveEnsurePath(carpetas) : driveEnsureProveedorFolder(nombreProveedor)).then(function(folderId){
      return file.arrayBuffer().then(function(buf){
        var bytes = new Uint8Array(buf);
        var binary = '';
        for(var i=0;i<bytes.length;i++) binary += String.fromCharCode(bytes[i]);
        var base64Data = btoa(binary);
        var boundary = 'hdr_adjunto_' + Date.now().toString(36);
        var metadata = { name: file.name, parents: [folderId] };
        var body = '--'+boundary+'\r\n'
          + 'Content-Type: application/json; charset=UTF-8\r\n\r\n'
          + JSON.stringify(metadata) + '\r\n'
          + '--'+boundary+'\r\n'
          + 'Content-Type: '+(file.type||'application/octet-stream')+'\r\n'
          + 'Content-Transfer-Encoding: base64\r\n\r\n'
          + base64Data + '\r\n'
          + '--'+boundary+'--';
        return driveApiFetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size,mimeType&'+DRIVE_EXTRA_PARAMS, {
          method: 'POST',
          headers: {'Content-Type': 'multipart/related; boundary="'+boundary+'"'},
          body: body
        });
      });
    }).then(function(r){
      if(!r.ok) return r.json().catch(function(){ return null; }).then(function(errBody){
        throw new Error((errBody && errBody.error && errBody.error.message) || ('HTTP '+r.status));
      });
      return r.json();
    }).then(function(data){
      if(!data || !data.id) throw new Error('Drive no devolvió el archivo subido');
      return {
        id: data.id,
        url: data.webViewLink || ('https://drive.google.com/file/d/'+data.id+'/view'),
        name: data.name || file.name,
        contentType: data.mimeType || file.type || '',
        sizeBytes: Number(data.size) || file.size || 0
      };
    });
  }

  function deleteAdjunto(fileId){
    if(!driveReady() || !fileId) return;
    driveApiFetch('https://www.googleapis.com/drive/v3/files/'+fileId+'?supportsAllDrives=true', { method: 'DELETE' }).catch(function(){});
  }

  // Sube los adjuntos que todavía están pendientes (recién elegidos, sin subir
  // a Drive) a la carpeta del proveedor indicado, y devuelve el array final
  // con los ya subidos sin tocar y los pendientes reemplazados por su
  // resultado de Drive. Se llama recién al Guardar, cuando ya sabemos el
  // nombre del proveedor (necesario para elegir la carpeta).
  function subirAdjuntosPendientes(arr, nombreProveedor){
    return Promise.all((arr||[]).map(function(a){
      if(!a.pending) return a;
      return uploadAdjunto(a.file, nombreProveedor);
    }));
  }

  function renderAttachList(containerId, getArr){
    var el = document.getElementById(containerId);
    if(!el) return;
    var arr = getArr() || [];
    el.innerHTML = '';
    if(!arr.length){
      el.innerHTML = '<div class="attach-empty">Sin archivos adjuntos.</div>';
      return;
    }
    arr.forEach(function(a, idx){
      var row = document.createElement('div');
      row.className = 'attach-item';
      if(a.pending){
        var span = document.createElement('span');
        span.textContent = (a.name || 'archivo') + ' (se sube a Drive al guardar)';
        row.appendChild(span);
      } else {
        var link = document.createElement('a');
        link.href = a.url; link.target = '_blank'; link.rel = 'noopener';
        link.textContent = a.name || 'archivo';
        row.appendChild(link);
      }
      var size = document.createElement('span');
      size.className = 'attach-size';
      size.textContent = fmtBytes(a.sizeBytes);
      row.appendChild(size);
      var del = document.createElement('button');
      del.type = 'button'; del.className = 'attach-del'; del.title = 'Quitar adjunto'; del.textContent = '✕';
      del.addEventListener('click', function(){
        var current = getArr();
        var removed = current.splice(idx,1)[0];
        if(removed && !removed.pending && removed.id) deleteAdjunto(removed.id);
        renderAttachList(containerId, getArr);
      });
      row.appendChild(del);
      el.appendChild(row);
    });
  }

  function wireAttachInput(inputId, containerId, getArr){
    var inp = document.getElementById(inputId);
    if(!inp) return;
    inp.addEventListener('change', function(){
      var files = Array.prototype.slice.call(inp.files||[]);
      inp.value = '';
      if(!files.length) return;
      if(!driveReady()){ showToast('Los adjuntos no están configurados (falta GOOGLE_DRIVE_CLIENT_ID en config.js).'); return; }
      files.forEach(function(file){
        getArr().push({ pending:true, file:file, name:file.name, contentType:file.type||'', sizeBytes:file.size||0 });
      });
      renderAttachList(containerId, getArr);
    });
  }

  // Lectura automática de facturas: la hace la función del servidor
  // "leer-factura" (Supabase Edge Function), que es la única que tiene la
  // clave de Anthropic. El navegador nunca ve la clave: config.js NO la lleva.
  // Se muestra a quien entró con email (la función igual verifica permisos).
  function refreshFacturaReadAvailability(){
    var row = document.getElementById('fm-read-row');
    if(row) row.hidden = !(state.sb && state.sb.functions && state.sessionEmail) || window.LEER_FACTURAS===false;
  }

  wireAttachInput('pm-archivo-input', 'pm-archivos-list', function(){ return state.editingProveedorArchivos; });
  wireAttachInput('fm-archivo-input', 'fm-archivos-list', function(){ return state.editingFacturaArchivos; });

  function ensurePdfjs(){
    if(pdfjsReady) return true;
    if(typeof pdfjsLib === 'undefined') return false;
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    pdfjsReady = true;
    return true;
  }

  function pdfFirstPageToImageBlob(file){
    return new Promise(function(resolve, reject){
      if(!ensurePdfjs()){ reject(new Error('pdf.js no disponible')); return; }
      var reader = new FileReader();
      reader.onload = function(){
        pdfjsLib.getDocument({data:new Uint8Array(reader.result)}).promise.then(function(pdf){
          return pdf.getPage(1);
        }).then(function(page){
          var viewport = page.getViewport({scale:2});
          var canvas = document.createElement('canvas');
          canvas.width = viewport.width; canvas.height = viewport.height;
          var ctx = canvas.getContext('2d');
          return page.render({canvasContext:ctx, viewport:viewport}).promise.then(function(){
            canvas.toBlob(function(blob){
              if(blob) resolve(blob); else reject(new Error('No se pudo convertir el PDF a imagen'));
            }, 'image/png');
          });
        }).catch(reject);
      };
      reader.onerror = function(){ reject(new Error('No se pudo leer el archivo')); };
      reader.readAsArrayBuffer(file);
    });
  }

  function blobToBase64(blob){
    return new Promise(function(resolve, reject){
      var reader = new FileReader();
      reader.onload = function(){
        var result = reader.result; // "data:<mime>;base64,<data>"
        var comma = result.indexOf(',');
        resolve(comma>=0 ? result.slice(comma+1) : result);
      };
      reader.onerror = function(){ reject(new Error('No se pudo leer el archivo')); };
      reader.readAsDataURL(blob);
    });
  }

  function extractJsonFromText(text){
    if(!text) return null;
    try{ return JSON.parse(text); }catch(e){}
    var fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if(fence){ try{ return JSON.parse(fence[1]); }catch(e){} }
    var start = text.search(/[\{\[]/);
    var end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'));
    if(start>=0 && end>start){
      try{ return JSON.parse(text.slice(start, end+1)); }catch(e){}
    }
    return null;
  }

  function applyFacturaReadResult(data){
    if(!data) return;
    if(data.proveedor_nombre){
      var nombreLeido = String(data.proveedor_nombre);
      var match = state.proveedores.find(function(p){ return (p.nombre||'').toLowerCase()===nombreLeido.toLowerCase(); });
      if(match){
        setProveedorComboValue('fm-proveedor', match.id);
        fillFacturaOCSelect(match.id);
        aplicarImputacionDefault(match.id);
        renderFacturaImputChips();
      }else{
        showToast('Proveedor leído: "'+nombreLeido+'" — no está en la lista, elegilo a mano.');
      }
    }
    if(data.numero) document.getElementById('fm-numero').value = data.numero;
    if(data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) document.getElementById('fm-fecha').value = data.fecha;
    if(data.monto!=null && !isNaN(parseFloat(data.monto))) document.getElementById('fm-monto').value = String(data.monto).replace('.',',');
    if(data.notas) document.getElementById('fm-notas').value = data.notas;
    updateSplitTotal();
  }

  var LECTURA_TIPOS = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
  async function readFacturaFromFile(file){
    if(!(state.sb && state.sb.functions)){ showToast('La lectura automática necesita conexión con la base.'); return; }
    var label = document.getElementById('fm-read-label');
    try{
      var imageBlob = file;
      if(file.type === 'application/pdf'){
        imageBlob = await pdfFirstPageToImageBlob(file);
      }else if(LECTURA_TIPOS.indexOf(file.type)===-1){
        showToast(/^image\//.test(file.type) ? 'Ese formato de imagen no se puede leer: usá PDF, JPG o PNG.' : 'Elegí un PDF o una imagen de la factura.');
        return;
      }
      showToast('Leyendo factura...', 15000);
      if(label) label.classList.add('leyendo');
      // el archivo original queda como adjunto pendiente; se sube a Drive
      // recién al Guardar, porque ahí ya sabemos a qué proveedor pertenece
      state.editingFacturaArchivos.push({ pending:true, file:file, name:file.name, contentType:file.type||'', sizeBytes:file.size||0 });
      renderAttachList('fm-archivos-list', function(){ return state.editingFacturaArchivos; });

      var base64 = await blobToBase64(imageBlob);
      var res = await state.sb.functions.invoke('leer-factura', { body: {
        imagen: base64,
        mediaType: imageBlob.type && LECTURA_TIPOS.indexOf(imageBlob.type)!==-1 ? imageBlob.type : 'image/png',
        proveedores: state.proveedores.map(function(p){ return p.nombre; })
      }});
      if(res.error){
        var msg = '', status = 0;
        try{ var ctx = res.error.context; if(ctx){ status = ctx.status||0; var j = await ctx.json(); msg = (j && j.error) || ''; } }catch(e2){}
        if(status===404 || /not found|failed to send/i.test(res.error.message||'')) showToast('La lectura automática todavía no está instalada en Supabase (falta la función leer-factura).', 8000);
        else showToast('No se pudo leer la factura automáticamente: '+(msg || res.error.message || 'error')+' — completá los datos a mano.', 8000);
        return;
      }
      var data = res.data && res.data.data;
      if(!data){ showToast('No se pudo interpretar la respuesta — completá los datos a mano.'); return; }
      applyFacturaReadResult(data);
      showToast('Factura leída — revisá los datos antes de guardar.');
    }catch(e){
      showToast('No se pudo leer la factura automáticamente — completá los datos a mano.');
    }finally{
      if(label) label.classList.remove('leyendo');
    }
  }

  document.getElementById('fm-read-input').addEventListener('change', function(){
    var file = (this.files||[])[0];
    this.value = '';
    if(file) readFacturaFromFile(file);
  });
  refreshFacturaReadAvailability();

  // ---------- Compras: proveedores y órdenes de compra ----------
  function ocEstadoLabel(e){
    return e==='aprobada' ? 'Aprobada' : e==='recibida' ? 'Recibida' : e==='anulada' ? 'Anulada' : 'Pendiente';
  }
  function ocNumeroLabel(n){
    return 'OC-'+String(n||0).padStart(4,'0');
  }
  function nextOCNumero(){
    var max = 0;
    state.ordenesCompra.forEach(function(o){ if((o.numero||0)>max) max = o.numero; });
    return max+1;
  }
  function proveedorNombre(id){
    var p = state.proveedores.find(function(x){ return x.id===id; });
    if(p) return p.nombre;
    return state.proveedoresCargados ? '(proveedor eliminado)' : 'Cargando…';
  }
  function generateProveedorId(nombre){
    var base = slug(nombre);
    var used = {};
    state.proveedores.forEach(function(p){ used[p.id] = true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }

  // ---------- Centros de costo y Conceptos ----------
  function centroCostoById(id){
    return state.centrosCosto.find(function(x){ return x.id===id; }) || null;
  }
  // ---- Árbol de centros de costo ----
  // Cada centro puede tener padre (parentId). Se imputa solo a las hojas
  // (sin hijos). requiere 'movil'|'sucursal' pide además el camión o la
  // sucursal (factura.ccRef = "movil:<id>" | "suc:<id>").
  function ccNombre(c){ return c.codigo ? (c.codigo+(c.parentId ? ' · ' : ' — ')+c.descripcion) : c.descripcion; }
  function ccHijos(id){ return state.centrosCosto.filter(function(x){ return (x.parentId||'')===(id||''); }).sort(function(a,b){ return (a.orden||0)-(b.orden||0) || (a.descripcion||'').localeCompare(b.descripcion||''); }); }
  function ccEsHoja(c){ return !state.centrosCosto.some(function(x){ return x.parentId===c.id; }); }
  function ccRuta(id){
    var out = [], c = centroCostoById(id), guard = 0;
    while(c && guard++<10){ out.unshift(c); c = c.parentId ? centroCostoById(c.parentId) : null; }
    return out;
  }
  function centroCostoLabel(id){
    var c = centroCostoById(id);
    if(!c) return '';
    var txt = ccRuta(id).map(ccNombre).join(' › ');
    return txt + (c.activo===false ? ' (anterior)' : '');
  }
  // Raíz (área) de un centro: para agrupar gastos por área.
  function ccRaiz(id){ var r = ccRuta(id); return r.length ? r[0] : null; }
  // <option>s agrupadas por área, solo hojas activas (+ la elegida aunque esté inactiva).
  function ccOptionsHtml(sel, placeholder){
    var html = '<option value="">'+esc(placeholder||'Centro de costo')+'</option>';
    var raices = ccHijos('').filter(function(r){ return r.activo!==false || r.id===sel || state.centrosCosto.some(function(x){ return x.id===sel && ccRaiz(x.id)===r; }); });
    var sueltas = [];
    raices.forEach(function(r){
      if(ccEsHoja(r)){ if(r.activo!==false || r.id===sel) sueltas.push(r); return; }
      var hojas = [];
      (function rec(n, pref){
        ccHijos(n.id).forEach(function(h){
          var lab = pref ? pref+' › '+ccNombre(h) : ccNombre(h);
          if(ccEsHoja(h)){ if(h.activo!==false || h.id===sel) hojas.push({id:h.id, label:lab+(h.activo===false?' (anterior)':'')}); }
          else if(h.activo!==false) rec(h, lab);
        });
      })(r, '');
      if(!hojas.length) return;
      html += '<optgroup label="'+esc(ccNombre(r))+'">'+hojas.map(function(o){ return '<option value="'+esc(o.id)+'"'+(o.id===sel?' selected':'')+'>'+esc(o.label)+'</option>'; }).join('')+'</optgroup>';
    });
    if(sueltas.length){
      html += '<optgroup label="Otros">'+sueltas.map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(ccNombre(c)+(c.activo===false?' (anterior)':''))+'</option>'; }).join('')+'</optgroup>';
    }
    return html;
  }
  function fillCentroSelect(sel, placeholder, valor){
    var v = valor!==undefined ? valor : sel.value;
    sel.innerHTML = ccOptionsHtml(v, placeholder);
    sel.value = v || '';
  }
  function ccRequiere(id){ var c = centroCostoById(id); return c ? (c.requiere||'') : ''; }
  // Camión/sucursal de una línea: el elegido o, si el centro está ligado a uno
  // (ej. "Logística › Móviles › Móvil 13"), el de ese centro.
  function ccRefEfectiva(ccId, ref){ if(ref) return ref; var c = centroCostoById(ccId); return c ? (c.refFijo||'') : ''; }
  // Opciones del segundo desplegable (camión o sucursal) según el centro.
  function ccRefOptionsHtml(req, sel){
    if(req==='movil') return '<option value="">Elegir móvil</option>'+state.trucks.filter(function(t){ return t.active!==false || ('movil:'+t.id)===sel; })
      .map(function(t){ var v='movil:'+t.id; return '<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(t.label)+'</option>'; }).join('');
    if(req==='sucursal') return '<option value="">Elegir sucursal</option>'+state.branches.filter(function(b){ return b.active!==false || ('suc:'+b.id)===sel; })
      .slice().sort(function(a,b){ return (a.order||0)-(b.order||0); })
      .map(function(b){ var v='suc:'+b.id; return '<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(b.label)+'</option>'; }).join('');
    return '';
  }
  function ccRefLabel(ref){
    if(!ref) return '';
    var i = ref.indexOf(':'), k = ref.slice(0,i), id = ref.slice(i+1);
    if(k==='movil'){ var t = state.trucks.find(function(x){ return x.id===id; }); return t ? t.label : 'Móvil '+id; }
    if(k==='suc'){ var b = state.branches.find(function(x){ return x.id===id; }); return b ? b.label : id; }
    return ref;
  }
  function generateCentroCostoId(codigo){
    var base = 'cc_'+(slug(codigo) || 'centro');
    var used = {};
    state.centrosCosto.forEach(function(c){ used[c.id] = true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }
  function conceptoById(id){
    return state.conceptos.find(function(x){ return x.id===id; }) || null;
  }
  function conceptoLabel(id){
    var c = conceptoById(id);
    return c ? c.nombre : '';
  }
  function generateConceptoId(nombre){
    var base = slug(nombre) || 'concepto';
    var used = {};
    state.conceptos.forEach(function(c){ used[c.id] = true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }

  // Líneas de imputación de una factura: si está repartida (2+ líneas en
  // f.items) son esas; si no, una sola línea con la imputación y el monto
  // de la factura. Todo lo que reparte gasto por centro/concepto (Dashboard,
  // usos por proveedor, chequeos antes de borrar) pasa por acá.
  function facturaLineas(f){
    if(f.items && f.items.length>=2) return f.items;
    return [{centroCostoId:f.centroCostoId, conceptoId:f.conceptoId, ccRef:f.ccRef||'', monto:Number(f.monto||0), detalle:''}];
  }
  // Monto escrito a mano: acepta "1234,56", "1.234,56", "1.200.000" y "1234.56".
  function parseMontoInput(str){
    var t = String(str||'').trim().replace(/\s|\$/g,'');
    if(t.indexOf(',')!==-1) t = t.replace(/\./g,'').replace(',','.');
    else if(/^-?\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g,'');   // "1.200.000" = miles
    var n = parseFloat(t);
    return isNaN(n) ? NaN : n;
  }
  function fmtMontoMiles(n){ return Number(n||0).toLocaleString('es-AR', {maximumFractionDigits:2}); }
  function fmtMontoInput(n){ return (Math.round((n||0)*100)/100).toString().replace('.',','); }

  // ---------- Imputaciones contables por proveedor ----------
  // Un proveedor puede tener varias combinaciones Centro de costo + Concepto
  // (p.imputaciones = [{centroCostoId, conceptoId}, ...]). La "por defecto"
  // es la que más se usó en sus facturas; si empatan o no tiene facturas,
  // manda el orden de la lista (la primera = principal, marcada con ★).
  function imputKey(ccId, coId){ return (ccId||'')+'|'+(coId||''); }
  function imputLabel(im){
    var cc = centroCostoById(im.centroCostoId), co = conceptoById(im.conceptoId);
    return (cc ? cc.descripcion : '(centro eliminado)')+' · '+(co ? co.nombre : '(concepto eliminado)');
  }
  function imputUsos(proveedorId){
    var usos = {};
    state.facturas.forEach(function(f){
      if(f.proveedorId!==proveedorId || esAnulado(f)) return;
      var vistos = {};
      facturaLineas(f).forEach(function(l){
        if(!l.centroCostoId || !l.conceptoId) return;
        var k = imputKey(l.centroCostoId, l.conceptoId);
        if(vistos[k]) return; vistos[k] = true;
        usos[k] = (usos[k]||0)+1;
      });
    });
    return usos;
  }
  // Lista de imputaciones del proveedor + las que aparezcan en sus facturas
  // aunque no estén en la lista, cada una con {usos}, ordenada de más a
  // menos usada (empate: orden de la lista del proveedor).
  function imputacionesOrdenadas(proveedorId, listaOverride){
    var p = state.proveedores.find(function(x){ return x.id===proveedorId; });
    var lista = listaOverride || (p ? (p.imputaciones||[]) : []);
    var usos = imputUsos(proveedorId);
    var out = [], seen = {};
    lista.forEach(function(im, i){
      var k = imputKey(im.centroCostoId, im.conceptoId);
      if(seen[k]) return; seen[k] = true;
      out.push({centroCostoId:im.centroCostoId, conceptoId:im.conceptoId, usos:usos[k]||0, orden:i, enLista:true});
    });
    Object.keys(usos).forEach(function(k){
      if(seen[k]) return; seen[k] = true;
      var parts = k.split('|');
      out.push({centroCostoId:parts[0], conceptoId:parts[1], usos:usos[k], orden:9999, enLista:false});
    });
    out.sort(function(a,b){ return (b.usos-a.usos) || (a.orden-b.orden); });
    return out;
  }
  function imputacionDefault(proveedorId){
    var list = imputacionesOrdenadas(proveedorId);
    return list.length ? list[0] : null;
  }

  function renderCentrosCostoList(){
    var body = document.getElementById('centros-costo-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.centrosCosto.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="3">Todavía no hay centros de costo cargados.</td></tr>';
      return;
    }
    var vistos = {};
    function fila(c, nivel){
      vistos[c.id] = true;
      var hoja = ccEsHoja(c);
      var tr = document.createElement('tr');
      tr.className = 'day-row'+(c.activo===false ? ' inactivo' : '');
      tr.innerHTML = '<td class="ind"><span style="display:inline-block; width:'+(nivel*18)+'px;"></span>'
        +'<span class="'+(hoja?'':'rama')+'">'+esc(ccNombre(c))+'</span></td>'
        +'<td>'+(c.requiere==='movil' ? 'Elegir móvil' : (c.requiere==='sucursal' ? 'Elegir sucursal' : (c.refFijo ? '→ '+esc(ccRefLabel(c.refFijo)) : '')))+'</td>'
        +'<td>'+(c.activo===false ? 'Inactivo' : (hoja ? 'Se imputa' : ''))+'</td>';
      tr.addEventListener('click', function(){ openCentroCostoModal(c.id); });
      body.appendChild(tr);
      ccHijos(c.id).forEach(function(h){ fila(h, nivel+1); });
    }
    // Primero el árbol activo; los anteriores (inactivos sin padre) al final.
    var raices = ccHijos('');
    raices.filter(function(r){ return r.activo!==false; }).forEach(function(r){ fila(r, 0); });
    raices.filter(function(r){ return r.activo===false; }).forEach(function(r){ fila(r, 0); });
    state.centrosCosto.filter(function(c){ return !vistos[c.id]; }).forEach(function(c){ fila(c, 0); });
  }

  function renderConceptosList(){
    var body = document.getElementById('conceptos-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.conceptos.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="1">Todavía no hay conceptos cargados.</td></tr>';
      return;
    }
    state.conceptos.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }).forEach(function(c){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      tr.innerHTML = '<td class="day-route">'+esc(c.nombre)+'</td>';
      tr.addEventListener('click', function(){ openConceptoModal(c.id); });
      body.appendChild(tr);
    });
  }

  function writeCentroCosto(c){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('centros_costo').upsert(Object.assign({
      id:c.id, codigo:c.codigo||'', descripcion:c.descripcion||''
    }, state.schemaV3 ? {parent_id:c.parentId||null, activo:c.activo!==false, requiere:c.requiere||'', orden:c.orden||0} : {},
       state.colRefFijo ? {ref_fijo:c.refFijo||''} : {})).then(function(res){
      if(res.error) showToast('No se pudo guardar el centro de costo: '+res.error.message);
    });
  }

  function openCentroCostoModal(id){
    state.editingCentroCostoId = id || null;
    var c = id ? centroCostoById(id) : null;
    document.getElementById('ccm-title').textContent = c ? 'Editar centro de costo' : 'Nuevo centro de costo';
    document.getElementById('ccm-codigo').value = c ? c.codigo : '';
    document.getElementById('ccm-descripcion').value = c ? c.descripcion : '';
    // "Depende de": cualquier centro que no sea él mismo ni uno de sus descendientes.
    var excl = {};
    if(c) (function m(id){ excl[id] = true; ccHijos(id).forEach(function(h){ m(h.id); }); })(c.id);
    var opts = '<option value="">— Ninguno (área principal) —</option>';
    (function rec(pid, nivel){
      ccHijos(pid).forEach(function(n){
        if(excl[n.id]) return;
        opts += '<option value="'+esc(n.id)+'">'+'\u00a0\u00a0'.repeat(nivel)+esc(ccNombre(n))+(n.activo===false?' (inactivo)':'')+'</option>';
        rec(n.id, nivel+1);
      });
    })('', 0);
    var ps = document.getElementById('ccm-parent');
    ps.innerHTML = opts;
    ps.value = c ? (c.parentId||'') : '';
    document.getElementById('ccm-requiere').value = c ? (c.requiere||'') : '';
    var rs = document.getElementById('ccm-ref');
    var refAct = c ? (c.refFijo||'') : '';
    rs.innerHTML = '<option value="">— Ninguno —</option>'
      + '<optgroup label="Camión">'+state.trucks.map(function(t){ var v='movil:'+t.id; return '<option value="'+esc(v)+'">'+esc(t.label)+'</option>'; }).join('')+'</optgroup>'
      + '<optgroup label="Sucursal">'+state.branches.map(function(b){ var v='suc:'+b.id; return '<option value="'+esc(v)+'">'+esc(b.label)+'</option>'; }).join('')+'</optgroup>';
    if(refAct && !rs.querySelector('option[value="'+refAct.replace(/"/g,'')+'"]')) rs.insertAdjacentHTML('beforeend', '<option value="'+esc(refAct)+'">'+esc(ccRefLabel(refAct))+'</option>');
    rs.value = refAct;
    document.getElementById('ccm-ref-field').hidden = !state.colRefFijo;
    document.getElementById('ccm-activo').checked = c ? c.activo!==false : true;
    document.getElementById('ccm-delete').style.display = c ? '' : 'none';
    document.getElementById('centro-costo-overlay').classList.add('show');
  }
  function closeCentroCostoModal(){
    document.getElementById('centro-costo-overlay').classList.remove('show');
  }

  document.getElementById('new-centro-costo-btn').addEventListener('click', function(){ openCentroCostoModal(null); });
  document.getElementById('ccm-cancel').addEventListener('click', closeCentroCostoModal);
  document.getElementById('ccm-save').addEventListener('click', function(){
    var codigo = document.getElementById('ccm-codigo').value.trim();
    var descripcion = document.getElementById('ccm-descripcion').value.trim();
    if(!descripcion){ showToast('Ingresá el nombre del centro de costo.'); return; }
    var parentId = document.getElementById('ccm-parent').value || '';
    if(!state.schemaV3 && parentId){ showToast('Para armar el árbol falta correr el schema.sql nuevo en Supabase.', 6000); return; }
    var id = state.editingCentroCostoId;
    var isNew = !id;
    var prev = id ? centroCostoById(id) : null;
    if(isNew) id = generateCentroCostoId(ccRuta(parentId).map(function(x){ return x.descripcion; }).concat([codigo||descripcion]).join('_'));
    var hermanos = ccHijos(parentId).filter(function(x){ return x.id!==id; });
    var c = { id:id, codigo:codigo, descripcion:descripcion, parentId:parentId,
      requiere: document.getElementById('ccm-requiere').value || '',
      refFijo: document.getElementById('ccm-ref').value || '',
      activo: document.getElementById('ccm-activo').checked,
      orden: prev && prev.parentId===parentId ? (prev.orden||0) : (hermanos.reduce(function(m,x){ return Math.max(m, x.orden||0); }, 0)+1) };
    if(isNew) state.centrosCosto.push(c);
    else { var idx = state.centrosCosto.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.centrosCosto[idx]=c; }
    writeCentroCosto(c);
    closeCentroCostoModal();
    renderCentrosCostoList();
    showToast('Centro de costo guardado.');
  });
  document.getElementById('ccm-delete').addEventListener('click', function(){
    var id = state.editingCentroCostoId;
    if(!id) return;
    var used = state.facturas.some(function(f){ return facturaLineas(f).some(function(l){ return l.centroCostoId===id; }); });
    if(used){ showToast('No se puede eliminar: hay facturas con este centro de costo. Podés desactivarlo.'); return; }
    if(ccHijos(id).length){ showToast('No se puede eliminar: tiene subdivisiones. Eliminá o mové primero las de adentro.'); return; }
    state.centrosCosto = state.centrosCosto.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('centros_costo').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeCentroCostoModal();
    renderCentrosCostoList();
    showToast('Centro de costo eliminado.');
  });

  function writeConcepto(c){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('conceptos').upsert({
      id:c.id, nombre:c.nombre||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar el concepto: '+res.error.message);
    });
  }

  function openConceptoModal(id){
    state.editingConceptoId = id || null;
    var c = id ? conceptoById(id) : null;
    document.getElementById('cpm-title').textContent = c ? 'Editar concepto' : 'Nuevo concepto';
    document.getElementById('cpm-nombre').value = c ? c.nombre : '';
    document.getElementById('cpm-delete').style.display = c ? '' : 'none';
    document.getElementById('concepto-overlay').classList.add('show');
  }
  function closeConceptoModal(){
    document.getElementById('concepto-overlay').classList.remove('show');
  }

  document.getElementById('new-concepto-btn').addEventListener('click', function(){ openConceptoModal(null); });
  document.getElementById('cpm-cancel').addEventListener('click', closeConceptoModal);
  document.getElementById('cpm-save').addEventListener('click', function(){
    var nombre = document.getElementById('cpm-nombre').value.trim();
    if(!nombre){ showToast('Ingresá el nombre del concepto.'); return; }
    var id = state.editingConceptoId;
    var isNew = !id;
    if(isNew) id = generateConceptoId(nombre);
    var c = { id:id, nombre:nombre };
    if(isNew) state.conceptos.push(c);
    else { var idx = state.conceptos.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.conceptos[idx]=c; }
    writeConcepto(c);
    closeConceptoModal();
    renderConceptosList();
    showToast('Concepto guardado.');
  });
  document.getElementById('cpm-delete').addEventListener('click', function(){
    var id = state.editingConceptoId;
    if(!id) return;
    var used = state.facturas.some(function(f){ return facturaLineas(f).some(function(l){ return l.conceptoId===id; }); });
    if(used){ showToast('No se puede eliminar: hay facturas con este concepto.'); return; }
    state.conceptos = state.conceptos.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('conceptos').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeConceptoModal();
    renderConceptosList();
    showToast('Concepto eliminado.');
  });

  // ---------- Rubros (ABM) ----------
  function rubroById(id){ return state.rubros.find(function(x){ return x.id===id; }) || null; }
  function generateRubroId(nombre){
    var base = slug(nombre) || 'rubro';
    var used = {};
    state.rubros.forEach(function(r){ used[r.id] = true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }
  function proveedoresConRubro(nombre){
    var k = (nombre||'').trim().toLowerCase();
    return state.proveedores.filter(function(p){ return (p.rubro||'').trim().toLowerCase()===k; });
  }
  function writeRubro(r){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('rubros').upsert({ id:r.id, nombre:r.nombre||'' }).then(function(res){
      if(res.error) showToast('No se pudo guardar el rubro: '+res.error.message);
    });
  }
  // Si el rubro elegido para un proveedor todavía no está en la lista, lo
  // da de alta (caso "Otro (crear nuevo)...").
  function asegurarRubro(nombre){
    nombre = (nombre||'').trim();
    if(!nombre) return;
    if(state.rubros.some(function(r){ return (r.nombre||'').trim().toLowerCase()===nombre.toLowerCase(); })) return;
    var r = {id:generateRubroId(nombre), nombre:nombre};
    state.rubros.push(r);
    writeRubro(r);
    renderRubrosList();
  }
  function renderRubrosList(){
    var body = document.getElementById('rubros-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.rubros.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="2">Todavía no hay rubros cargados.</td></tr>';
      return;
    }
    state.rubros.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }).forEach(function(r){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      tr.innerHTML = '<td class="day-route">'+esc(r.nombre)+'</td><td class="num">'+proveedoresConRubro(r.nombre).length+'</td>';
      tr.addEventListener('click', function(){ openRubroModal(r.id); });
      body.appendChild(tr);
    });
  }
  function openRubroModal(id){
    state.editingRubroId = id || null;
    var r = id ? rubroById(id) : null;
    document.getElementById('rbm-title').textContent = r ? 'Editar rubro' : 'Nuevo rubro';
    document.getElementById('rbm-nombre').value = r ? r.nombre : '';
    document.getElementById('rbm-delete').style.display = r ? '' : 'none';
    document.getElementById('rubro-overlay').classList.add('show');
  }
  function closeRubroModal(){ document.getElementById('rubro-overlay').classList.remove('show'); }
  document.getElementById('new-rubro-btn').addEventListener('click', function(){ openRubroModal(null); });
  document.getElementById('rbm-cancel').addEventListener('click', closeRubroModal);
  document.getElementById('rbm-save').addEventListener('click', function(){
    var nombre = document.getElementById('rbm-nombre').value.trim();
    if(!nombre){ showToast('Ingresá el nombre del rubro.'); return; }
    var id = state.editingRubroId;
    var dup = state.rubros.some(function(r){ return r.id!==id && (r.nombre||'').trim().toLowerCase()===nombre.toLowerCase(); });
    if(dup){ showToast('Ya existe un rubro con ese nombre.'); return; }
    var isNew = !id;
    var anterior = isNew ? null : (rubroById(id)||{}).nombre;
    if(isNew) id = generateRubroId(nombre);
    var r = {id:id, nombre:nombre};
    if(isNew) state.rubros.push(r);
    else { var idx = state.rubros.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.rubros[idx]=r; }
    writeRubro(r);
    // Renombrar: se actualiza el rubro en todos los proveedores que lo tenían.
    if(anterior && anterior!==nombre){
      var afectados = proveedoresConRubro(anterior);
      afectados.forEach(function(p){ p.rubro = nombre; });
      if(afectados.length && state.sb){
        state.sb.from('proveedores').update({rubro:nombre}).in('id', afectados.map(function(p){ return p.id; })).then(function(res){
          if(res.error) showToast('No se pudo actualizar el rubro en los proveedores: '+res.error.message);
        });
      }
      if(afectados.length) showToast('Rubro renombrado en '+afectados.length+' proveedor'+(afectados.length===1?'':'es')+'.');
      else showToast('Rubro guardado.');
    } else showToast('Rubro guardado.');
    closeRubroModal();
    renderRubrosList();
    renderProveedoresList();
  });
  document.getElementById('rbm-delete').addEventListener('click', function(){
    var id = state.editingRubroId;
    var r = id ? rubroById(id) : null;
    if(!r) return;
    var n = proveedoresConRubro(r.nombre).length;
    if(n){ showToast('No se puede eliminar: hay '+n+' proveedor'+(n===1?'':'es')+' con este rubro. Cambiales el rubro primero, o renombralo.'); return; }
    state.rubros = state.rubros.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('rubros').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeRubroModal();
    renderRubrosList();
    showToast('Rubro eliminado.');
  });

  // ---------- Buscador de proveedor (combo), reemplaza los <select> nativos
  // que se vuelven inusables con muchos proveedores cargados ----------
  function setProveedorComboValue(hiddenId, proveedorId){
    var hidden = document.getElementById(hiddenId);
    var input = document.getElementById(hiddenId+'-input');
    if(!hidden || !input) return;
    hidden.value = proveedorId || '';
    var p = proveedorId ? state.proveedores.find(function(x){ return x.id===proveedorId; }) : null;
    input.value = p ? p.nombre : '';
  }
  function wireProveedorCombo(hiddenId){
    var input = document.getElementById(hiddenId+'-input');
    var hidden = document.getElementById(hiddenId);
    var menu = document.getElementById(hiddenId+'-menu');
    if(!input || !hidden || !menu) return;
    function closeMenu(){ menu.hidden = true; menu.innerHTML = ''; }
    function openMenuWith(list){
      menu.innerHTML = '';
      if(!list.length){
        menu.innerHTML = '<div class="combo-empty">Sin resultados</div>';
      } else {
        list.slice(0,50).forEach(function(p){
          var item = document.createElement('div');
          item.className = 'combo-item';
          item.textContent = p.nombre;
          item.addEventListener('mousedown', function(e){
            e.preventDefault();
            hidden.value = p.id;
            input.value = p.nombre;
            closeMenu();
            hidden.dispatchEvent(new Event('change', {bubbles:true}));
          });
          menu.appendChild(item);
        });
      }
      menu.hidden = false;
    }
    function search(){
      var q = input.value.trim().toLowerCase();
      if(!q){ closeMenu(); return; }
      var list = state.proveedores.filter(function(p){
        return proveedorMatches(p, q) || (p.cuit||'').toLowerCase().indexOf(q)!==-1;
      }).sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });
      openMenuWith(list);
    }
    input.addEventListener('input', function(){
      if(hidden.value){ hidden.value=''; hidden.dispatchEvent(new Event('change', {bubbles:true})); }
      search();
    });
    input.addEventListener('focus', function(){ if(input.value.trim()) search(); });
    input.addEventListener('blur', function(){ setTimeout(closeMenu, 120); });
    input.addEventListener('keydown', function(e){
      if(e.key==='Escape'){ closeMenu(); input.blur(); }
    });
  }
  wireProveedorCombo('ocm-proveedor');
  wireProveedorCombo('fm-proveedor');
  wireProveedorCombo('pom-proveedor');

  function renderCompras(){
    renderProveedoresList();
    renderCentrosCostoList();
    renderConceptosList();
    renderRubrosList();
    renderOCList();
    renderArticulosList();
    actualizarSubtabs();
  }

  function proveedorMatches(p, q){
    if(!q) return true;
    var qDigits = q.replace(/\D/g,'');
    return (p.nombre||'').toLowerCase().indexOf(q)!==-1
      || (p.nombreFantasia||'').toLowerCase().indexOf(q)!==-1
      || (p.codigo||'').toLowerCase()===q
      || (qDigits.length>=4 && (p.cuit||'').replace(/\D/g,'').indexOf(qDigits)!==-1);
  }
  var PROVEEDORES_MAX_FILAS = 200;
  function renderProveedoresList(){
    var body = document.getElementById('proveedores-body');
    if(!body) return;
    body.innerHTML = '';
    var countEl = document.getElementById('proveedores-count');
    if(countEl) countEl.textContent = state.proveedores.length ? '('+state.proveedores.length+')' : '';
    if(state.proveedores.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">Todavía no hay proveedores cargados.</td></tr>';
      return;
    }
    var q = (state.proveedoresSearch||'').trim().toLowerCase();
    var list = state.proveedores.filter(function(p){ return proveedorMatches(p, q); })
      .sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">Ningún proveedor coincide con la búsqueda.</td></tr>';
      return;
    }
    var frag = document.createDocumentFragment();
    list.slice(0, PROVEEDORES_MAX_FILAS).forEach(function(p){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var def = imputacionDefault(p.id);
      var extra = (p.imputaciones||[]).length>1 ? ' <span style="color:var(--muted);">(+'+((p.imputaciones||[]).length-1)+')</span>' : '';
      tr.innerHTML = '<td class="num">'+esc(p.codigo||'—')+'</td>'
        +'<td class="day-route">'+esc(p.nombre)+(p.llevaArticulos ? ' <span title="Carga artículos en sus facturas">📦</span>' : '')+(p.nombreFantasia ? ' <span style="color:var(--muted); font-weight:400;">· '+esc(p.nombreFantasia)+'</span>' : '')+'</td>'
        +'<td class="num">'+esc(p.cuit||'—')+'</td>'
        +'<td>'+esc(p.rubro||'—')+'</td>'
        +'<td>'+(def ? esc(imputLabel(def))+extra : '—')+'</td>'
        +'<td class="num">'+esc(p.telefono||'—')+'</td>';
      tr.addEventListener('click', function(){ openProveedorModal(p.id); });
      frag.appendChild(tr);
    });
    body.appendChild(frag);
    if(list.length>PROVEEDORES_MAX_FILAS){
      var more = document.createElement('tr');
      more.innerHTML = '<td colspan="6" class="prov-more">Mostrando '+PROVEEDORES_MAX_FILAS+' de '+list.length+'. Usá el buscador para encontrar el resto.</td>';
      body.appendChild(more);
    }
  }
  document.getElementById('proveedores-search').addEventListener('input', function(){
    state.proveedoresSearch = this.value;
    renderProveedoresList();
  });

  function renderOCList(){
    var body = document.getElementById('oc-body');
    if(!body) return;
    body.innerHTML = '';
    var list = state.ordenesCompra.slice();
    if(state.ocFilterEstado) list = list.filter(function(o){ return o.estado===state.ocFilterEstado; });
    list.sort(function(a,b){ return (b.numero||0)-(a.numero||0); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">No hay órdenes de compra'+(state.ocFilterEstado?' con ese estado':'')+'.</td></tr>';
      return;
    }
    list.forEach(function(o){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var montoStr = Number(o.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      tr.innerHTML = '<td class="day-route num">'+ocNumeroLabel(o.numero)+'</td>'
        +'<td>'+esc(proveedorNombre(o.proveedorId))+'</td>'
        +'<td class="num">'+esc(o.fecha||'—')+'</td>'
        +'<td class="day-note">'+esc(o.descripcion||'—')+'</td>'
        +'<td class="num">$'+montoStr+'</td>'
        +'<td><span class="oc-badge '+esc(o.estado||'pendiente')+'">'+ocEstadoLabel(o.estado)+'</span></td>';
      if(esAnulado(o)){ tr.className += ' anulado'; tr.title = anulacionTexto(o); }
      tr.addEventListener('click', function(){ openOCModal(o.id); });
      body.appendChild(tr);
    });
  }

  function writeProveedor(p){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    // "prioritario" solo se manda si la columna existe (schema.sql nuevo).
    state.sb.from('proveedores').upsert(Object.assign({
      id:p.id, nombre:p.nombre, cuit:p.cuit||'', rubro:p.rubro||'', contacto:p.contacto||'',
      telefono:p.telefono||'', email:p.email||'', direccion:p.direccion||'',
      banco:p.banco||'', cbu:p.cbu||'', notas:p.notas||'', archivos:p.archivos||[],
      codigo:p.codigo||'', nombre_fantasia:p.nombreFantasia||'', localidad:p.localidad||'',
      provincia:p.provincia||'', condicion_iva:p.condicionIva||'', condicion_pago:p.condicionPago||'',
      imputaciones:(p.imputaciones||[]).map(function(im){ return {centro_costo_id:im.centroCostoId, concepto_id:im.conceptoId}; })
    }, state.colPrioritario ? {prioritario: !!p.prioritario} : {},
       state.colLlevaArticulos ? {lleva_articulos: !!p.llevaArticulos} : {},
       state.schemaV3 ? {gan_condicion: p.ganCondicion||'', gan_regimen: p.ganRegimen||null} : {})).then(function(res){
      if(res.error) showToast('No se pudo guardar el proveedor: '+res.error.message);
    });
  }

  // Si el valor guardado no está entre las opciones del <select> (ej. vino
  // escrito distinto de otro sistema), se agrega como opción para no perderlo.
  function setSelectValueLoose(selId, value){
    var sel = document.getElementById(selId);
    value = value || '';
    if(value && !Array.prototype.some.call(sel.options, function(o){ return o.value===value; })){
      var o = document.createElement('option'); o.value = value; o.textContent = value; sel.appendChild(o);
    }
    sel.value = value;
  }
  function fillImputAddSelects(){
    fillCentroSelect(document.getElementById('pm-imput-cc'), 'Centro de costo', '');
    fillSelect(document.getElementById('pm-imput-concepto'),
      state.conceptos.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }),
      'id', 'nombre', 'Concepto');
  }
  function renderProveedorImputList(){
    var box = document.getElementById('pm-imputaciones-list');
    box.innerHTML = '';
    var lista = state.editingProveedorImput;
    if(!lista.length){
      box.innerHTML = '<div class="imput-empty">Sin imputaciones cargadas. Se agregan solas al guardar facturas, o desde acá abajo.</div>';
      return;
    }
    var usos = state.editingProveedorId ? imputUsos(state.editingProveedorId) : {};
    var def = state.editingProveedorId ? imputacionesOrdenadas(state.editingProveedorId, lista)[0] : lista[0];
    var defKey = def ? imputKey(def.centroCostoId, def.conceptoId) : '';
    lista.forEach(function(im, i){
      var k = imputKey(im.centroCostoId, im.conceptoId);
      var n = usos[k]||0;
      var row = document.createElement('div');
      row.className = 'imput-row';
      row.innerHTML = '<button type="button" class="star'+(i===0?' on':'')+'" title="'+(i===0?'Principal':'Marcar como principal')+'">'+(i===0?'★':'☆')+'</button>'
        +'<span class="txt">'+esc(imputLabel(im))+(k===defKey ? ' <strong style="font-size:11px; color:var(--ink-2);">· por defecto</strong>' : '')+'</span>'
        +'<span class="n">'+n+' factura'+(n===1?'':'s')+'</span>'
        +'<button type="button" class="del edit-action" title="Quitar">✕</button>';
      row.querySelector('.star').addEventListener('click', function(){
        if(i===0) return;
        var it = lista.splice(i,1)[0]; lista.unshift(it);
        renderProveedorImputList();
      });
      row.querySelector('.del').addEventListener('click', function(){
        lista.splice(i,1);
        renderProveedorImputList();
      });
      box.appendChild(row);
    });
  }
  document.getElementById('pm-imput-add').addEventListener('click', function(){
    var cc = document.getElementById('pm-imput-cc').value;
    var co = document.getElementById('pm-imput-concepto').value;
    if(!cc || !co){ showToast('Elegí centro de costo y concepto.'); return; }
    var k = imputKey(cc, co);
    if(state.editingProveedorImput.some(function(im){ return imputKey(im.centroCostoId, im.conceptoId)===k; })){
      showToast('Esa imputación ya está en la lista.'); return;
    }
    state.editingProveedorImput.push({centroCostoId:cc, conceptoId:co});
    document.getElementById('pm-imput-cc').value = '';
    document.getElementById('pm-imput-concepto').value = '';
    renderProveedorImputList();
  });

  // Rubro: lista para elegir, administrable desde ⚙ → Compras → Rubros
  // (tabla rubros). El proveedor guarda el nombre. "Otro..." deja escribir
  // uno nuevo, que se da de alta en la lista al guardar el proveedor.
  function rubrosDisponibles(){
    return state.rubros.map(function(r){ return r.nombre; }).filter(Boolean)
      .sort(function(a,b){ return a.localeCompare(b); });
  }
  function fillRubroSelect(valor){
    var sel = document.getElementById('pm-rubro');
    sel.innerHTML = '<option value="">— Sin rubro —</option>';
    var lista = rubrosDisponibles();
    var match = lista.find(function(r){ return r.toLowerCase()===(valor||'').trim().toLowerCase(); });
    if(valor && !match){ lista = lista.concat([valor.trim()]); match = valor.trim(); }
    lista.forEach(function(r){
      var o = document.createElement('option'); o.value = r; o.textContent = r; sel.appendChild(o);
    });
    var otro = document.createElement('option'); otro.value = '__otro__'; otro.textContent = 'Otro (crear nuevo)...'; sel.appendChild(otro);
    sel.value = match || '';
    document.getElementById('pm-rubro-otro').value = '';
    document.getElementById('pm-rubro-otro').hidden = true;
  }
  function rubroElegido(){
    var v = document.getElementById('pm-rubro').value;
    if(v==='__otro__') return document.getElementById('pm-rubro-otro').value.trim();
    return v;
  }
  document.getElementById('pm-rubro').addEventListener('change', function(){
    var otro = document.getElementById('pm-rubro-otro');
    otro.hidden = this.value!=='__otro__';
    if(!otro.hidden) otro.focus();
  });

  function openProveedorModal(id){
    state.editingProveedorId = id || null;
    var p = id ? state.proveedores.find(function(x){ return x.id===id; }) : null;
    document.getElementById('pm-title').textContent = p ? 'Editar proveedor' : 'Nuevo proveedor';
    document.getElementById('pm-nombre').value = p ? p.nombre : '';
    document.getElementById('pm-cuit').value = p ? (p.cuit||'') : '';
    fillRubroSelect(p ? (p.rubro||'') : '');
    document.getElementById('pm-contacto').value = p ? (p.contacto||'') : '';
    document.getElementById('pm-telefono').value = p ? (p.telefono||'') : '';
    document.getElementById('pm-email').value = p ? (p.email||'') : '';
    document.getElementById('pm-direccion').value = p ? (p.direccion||'') : '';
    document.getElementById('pm-banco').value = p ? (p.banco||'') : '';
    document.getElementById('pm-cbu').value = p ? (p.cbu||'') : '';
    document.getElementById('pm-notas').value = p ? (p.notas||'') : '';
    document.getElementById('pm-codigo').value = p ? (p.codigo||'') : '';
    document.getElementById('pm-fantasia').value = p ? (p.nombreFantasia||'') : '';
    document.getElementById('pm-localidad').value = p ? (p.localidad||'') : '';
    document.getElementById('pm-provincia').value = p ? (p.provincia||'') : '';
    setSelectValueLoose('pm-condicion-iva', p ? p.condicionIva : '');
    setSelectValueLoose('pm-condicion-pago', p ? p.condicionPago : '');
    document.getElementById('pm-prioritario').checked = !!(p && p.prioritario);
    document.getElementById('pm-lleva-articulos').checked = !!(p && p.llevaArticulos);
    document.getElementById('pm-gan-condicion').value = p ? (p.ganCondicion||'') : '';
    fillRegimenSelect(document.getElementById('pm-gan-regimen'), p && p.ganRegimen ? String(p.ganRegimen) : '', 'Según rubro');
    actualizarPmGanHint();
    state.editingProveedorImput = p ? (p.imputaciones||[]).map(function(im){ return {centroCostoId:im.centroCostoId, conceptoId:im.conceptoId}; }) : [];
    fillImputAddSelects();
    renderProveedorImputList();
    document.getElementById('pm-delete').style.display = p ? '' : 'none';
    state.editingProveedorArchivos = p ? (p.archivos||[]).slice() : [];
    renderAttachList('pm-archivos-list', function(){ return state.editingProveedorArchivos; });
    document.getElementById('proveedor-overlay').classList.add('show');
  }
  function closeProveedorModal(){
    document.getElementById('proveedor-overlay').classList.remove('show');
  }

  document.getElementById('new-proveedor-btn').addEventListener('click', function(){ openProveedorModal(null); });
  document.getElementById('pm-cancel').addEventListener('click', closeProveedorModal);
  document.getElementById('pm-save').addEventListener('click', function(){
    var nombre = document.getElementById('pm-nombre').value.trim();
    if(!nombre){ showToast('Ingresá el nombre del proveedor.'); return; }
    var id = state.editingProveedorId;
    var isNew = !id;
    if(isNew) id = generateProveedorId(nombre);
    var baseData = {
      id:id, nombre:nombre,
      cuit: document.getElementById('pm-cuit').value.trim(),
      rubro: rubroElegido(),
      contacto: document.getElementById('pm-contacto').value.trim(),
      telefono: document.getElementById('pm-telefono').value.trim(),
      email: document.getElementById('pm-email').value.trim(),
      direccion: document.getElementById('pm-direccion').value.trim(),
      banco: document.getElementById('pm-banco').value.trim(),
      cbu: document.getElementById('pm-cbu').value.trim(),
      notas: document.getElementById('pm-notas').value.trim(),
      codigo: document.getElementById('pm-codigo').value.trim(),
      nombreFantasia: document.getElementById('pm-fantasia').value.trim(),
      localidad: document.getElementById('pm-localidad').value.trim(),
      provincia: document.getElementById('pm-provincia').value.trim(),
      condicionIva: document.getElementById('pm-condicion-iva').value,
      condicionPago: document.getElementById('pm-condicion-pago').value,
      prioritario: document.getElementById('pm-prioritario').checked,
      llevaArticulos: document.getElementById('pm-lleva-articulos').checked,
      ganCondicion: document.getElementById('pm-gan-condicion').value || '',
      ganRegimen: document.getElementById('pm-gan-regimen').value ? Number(document.getElementById('pm-gan-regimen').value) : null,
      imputaciones: state.editingProveedorImput.slice()
    };
    if(baseData.llevaArticulos && !state.colLlevaArticulos) showToast('Para guardar "Carga artículos" falta correr base-de-datos/articulos.sql en Supabase.', 7000);
    if(baseData.prioritario && !state.colPrioritario) showToast('Para guardar "pago prioritario" falta correr el schema.sql nuevo en Supabase.', 6000);
    asegurarRubro(baseData.rubro);
    var saveBtn = this;
    var tienePendientes = state.editingProveedorArchivos.some(function(a){ return a.pending; });
    if(tienePendientes){ saveBtn.disabled = true; showToast('Subiendo adjuntos a Google Drive...'); }
    subirAdjuntosPendientes(state.editingProveedorArchivos, nombre).then(function(archivosFinales){
      var p = Object.assign({}, baseData, { archivos: archivosFinales });
      if(isNew) state.proveedores.push(p);
      else { var idx = state.proveedores.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.proveedores[idx]=p; }
      writeProveedor(p);
      closeProveedorModal();
      renderCompras();
      showToast('Proveedor guardado.');
    }).catch(function(err){
      showToast('No se pudieron subir uno o más adjuntos a Drive: '+((err&&err.message)||'error')+'. Probá guardar de nuevo.');
    }).finally(function(){ saveBtn.disabled = false; });
  });
  document.getElementById('pm-delete').addEventListener('click', function(){
    var id = state.editingProveedorId;
    if(!id) return;
    state.editingProveedorArchivos.forEach(function(a){ if(!a.pending && a.id) deleteAdjunto(a.id); });
    state.proveedores = state.proveedores.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('proveedores').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeProveedorModal();
    renderCompras();
    showToast('Proveedor eliminado.');
  });

  function writeOC(o){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('ordenes_compra').upsert(Object.assign({
      id:o.id, numero:o.numero, proveedor_id:o.proveedorId||'', fecha:o.fecha||'',
      descripcion:o.descripcion||'', monto:o.monto||0, estado:o.estado||'pendiente',
      notas:o.notas||'', who:o.who||''
    }, camposAnulacion(o))).then(function(res){
      if(res.error) showToast('No se pudo guardar la orden de compra: '+res.error.message);
    });
  }

  function openOCModal(id){
    marcarModalAnulado('ocm-save', 'ocm-delete', null);
    state.editingOCId = id || null;
    var o = id ? state.ordenesCompra.find(function(x){ return x.id===id; }) : null;
    document.getElementById('ocm-title').textContent = o ? ('Editar orden de compra') : 'Nueva orden de compra';
    document.getElementById('ocm-sub').textContent = o ? ocNumeroLabel(o.numero) : 'Se le asigna un número al guardar';
    setProveedorComboValue('ocm-proveedor', o ? o.proveedorId : '');
    document.getElementById('ocm-fecha').value = o ? (o.fecha||todayStr()) : todayStr();
    document.getElementById('ocm-monto').value = o ? String(o.monto||0).replace('.',',') : '';
    document.getElementById('ocm-descripcion').value = o ? (o.descripcion||'') : '';
    document.getElementById('ocm-estado').value = o ? (o.estado||'pendiente') : 'pendiente';
    document.getElementById('ocm-notas').value = o ? (o.notas||'') : '';
    document.getElementById('ocm-delete').style.display = o ? '' : 'none';
    document.getElementById('ocm-imprimir').style.display = o ? '' : 'none';
    marcarModalAnulado('ocm-save', 'ocm-delete', o, 'a');
    document.getElementById('oc-overlay').classList.add('show');
  }
  function closeOCModal(){
    document.getElementById('oc-overlay').classList.remove('show');
  }

  document.getElementById('new-oc-btn').addEventListener('click', function(){ openOCModal(null); });
  document.getElementById('ocm-cancel').addEventListener('click', closeOCModal);
  document.getElementById('oc-filter-estado').addEventListener('change', function(){
    state.ocFilterEstado = this.value;
    renderOCList();
  });
  document.getElementById('ocm-save').addEventListener('click', function(){
    var proveedorId = document.getElementById('ocm-proveedor').value;
    if(!proveedorId){ showToast('Elegí un proveedor.'); return; }
    var montoRaw = document.getElementById('ocm-monto').value.replace(',','.').trim();
    var monto = parseFloat(montoRaw);
    if(isNaN(monto) || monto<0) monto = 0;
    var id = state.editingOCId;
    var isNew = !id;
    var existing = id ? state.ordenesCompra.find(function(x){ return x.id===id; }) : null;
    var numero = isNew ? nextOCNumero() : (existing ? existing.numero : nextOCNumero());
    if(isNew) id = 'oc_'+numero;
    var o = {
      id:id, numero:numero, proveedorId:proveedorId,
      fecha: document.getElementById('ocm-fecha').value || todayStr(),
      descripcion: document.getElementById('ocm-descripcion').value.trim(),
      monto: monto,
      estado: document.getElementById('ocm-estado').value || 'pendiente',
      notas: document.getElementById('ocm-notas').value.trim(),
      who: whoName()
    };
    if(isNew) state.ordenesCompra.push(o);
    else { var idx = state.ordenesCompra.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.ordenesCompra[idx]=o; }
    writeOC(o);
    closeOCModal();
    renderCompras();
    showToast('Orden de compra guardada.');
  });
  document.getElementById('ocm-delete').addEventListener('click', function(){
    var id = state.editingOCId;
    var o = id ? state.ordenesCompra.find(function(x){ return x.id===id; }) : null;
    if(!o || esAnulado(o)) return;
    pedirAnulacion('Anular '+ocNumeroLabel(o.numero), proveedorNombre(o.proveedorId)+' — '+fmtMoney(o.monto)+'. La orden queda registrada como anulada y su número no se vuelve a usar.', function(motivo){
      sellarAnulacion(o, motivo);
      o.estado = 'anulada';
      writeOC(o);
      closeOCModal();
      renderCompras();
      showToast('Orden de compra anulada.');
    });
  });

  function mapProveedorRow(row){
    if(row && Object.prototype.hasOwnProperty.call(row, 'prioritario')) state.colPrioritario = true;
    if(row && Object.prototype.hasOwnProperty.call(row, 'lleva_articulos')) state.colLlevaArticulos = true;
    return {
      id:row.id, nombre:row.nombre||row.id, cuit:row.cuit||'', rubro:row.rubro||'',
      contacto:row.contacto||'', telefono:row.telefono||'', email:row.email||'',
      direccion:row.direccion||'', banco:row.banco||'', cbu:row.cbu||'', notas:row.notas||'',
      archivos: Array.isArray(row.archivos) ? row.archivos : [],
      codigo:row.codigo||'', nombreFantasia:row.nombre_fantasia||'', localidad:row.localidad||'',
      provincia:row.provincia||'', condicionIva:row.condicion_iva||'', condicionPago:row.condicion_pago||'',
      prioritario: row.prioritario===true,
      llevaArticulos: row.lleva_articulos===true,
      ganCondicion: row.gan_condicion||'', ganRegimen: row.gan_regimen==null ? null : Number(row.gan_regimen),
      imputaciones: (Array.isArray(row.imputaciones) ? row.imputaciones : []).filter(function(im){ return im && im.centro_costo_id && im.concepto_id; })
        .map(function(im){ return {centroCostoId:im.centro_costo_id, conceptoId:im.concepto_id}; })
    };
  }
  function mapOCRow(row){
    return leerAnulacion(row, {
      id:row.id, numero:row.numero||0, proveedorId:row.proveedor_id||'', fecha:row.fecha||'',
      descripcion:row.descripcion||'', monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0,
      estado:row.estado||'pendiente', notas:row.notas||'', who:row.who||''
    });
  }
  function mapCentroCostoRow(row){
    if(row && Object.prototype.hasOwnProperty.call(row, 'parent_id')) state.schemaV3 = true;
    if(row && Object.prototype.hasOwnProperty.call(row, 'ref_fijo')) state.colRefFijo = true;
    return { id:row.id, codigo:row.codigo||'', descripcion:row.descripcion||'',
      parentId:row.parent_id||'', activo:row.activo!==false, requiere:row.requiere||'', orden:row.orden||0, refFijo:row.ref_fijo||'' };
  }
  function mapConceptoRow(row){
    return { id:row.id, nombre:row.nombre||'' };
  }
  // Supabase devuelve como máximo 1000 filas por consulta: con 1000+
  // proveedores (o facturas, movimientos...) hay que pedir de a páginas.
  // Devuelve una promesa con la misma forma {data, error} que .select().
  function fetchAllRows(table){
    var PAGE = 1000, all = [];
    function page(from){
      return state.sb.from(table).select('*').order('id').range(from, from+PAGE-1).then(function(res){
        if(res.error) return {data:null, error:res.error};
        all = all.concat(res.data||[]);
        if((res.data||[]).length<PAGE) return {data:all, error:null};
        return page(from+PAGE);
      });
    }
    return page(0);
  }
  // Para las suscripciones en tiempo real: si llegan muchos cambios juntos
  // (ej. al importar 1000+ proveedores de una), se vuelve a leer la tabla
  // una sola vez en vez de una vez por fila.
  var _debounceTimers = {};
  function debounced(key, fn){
    clearTimeout(_debounceTimers[key]);
    _debounceTimers[key] = setTimeout(fn, 700);
  }
  function fetchCompras(){
    if(!state.sb) return;
    fetchAllRows('proveedores').then(function(res){
      if(res.error){ showToast('Error cargando proveedores: '+res.error.message); return; }
      state.proveedores = (res.data||[]).map(mapProveedorRow);
      state.proveedoresCargados = true;
      renderCompras();
      // Facturas y órdenes de pago muestran el nombre del proveedor: con
      // 1000+ proveedores esta lista llega después que las facturas, así que
      // hay que volver a dibujarlas (si no, quedaban como "proveedor eliminado").
      renderPagos();
      if(state.view==='dashboard') renderDashboard();
    });
    fetchAllRows('ordenes_compra').then(function(res){
      if(res.error){ showToast('Error cargando órdenes de compra: '+res.error.message); return; }
      state.ordenesCompra = (res.data||[]).map(mapOCRow);
      renderCompras();
    });
    state.sb.from('centros_costo').select('*').then(function(res){
      if(res.error){ showToast('Error cargando centros de costo: '+res.error.message); return; }
      state.centrosCosto = (res.data||[]).map(mapCentroCostoRow);
      renderCompras();
    });
    state.sb.from('conceptos').select('*').then(function(res){
      if(res.error){ showToast('Error cargando conceptos: '+res.error.message); return; }
      state.conceptos = (res.data||[]).map(mapConceptoRow);
      renderCompras();
    });
    cargarParametrosRetencion();
    fetchAllRows('articulos').then(function(res){
      if(res.error){ state.tablaArticulos = false; return; }   // sin articulos.sql todavía
      state.tablaArticulos = true;
      state.articulos = (res.data||[]).map(mapArticuloRow);
      renderCompras();
      if(document.getElementById('factura-overlay').classList.contains('show')) renderFacturaArts();
    });
    state.sb.from('rubros').select('*').then(function(res){
      if(res.error){ showToast('Error cargando rubros (¿corriste el schema.sql nuevo?): '+res.error.message); return; }
      state.rubros = (res.data||[]).map(function(row){ return {id:row.id, nombre:row.nombre||''}; });
      renderCompras();
    });
  }

  // ---------- Pagos: facturas y órdenes de pago ----------
  function facturaEstadoLabel(e){ return e==='pagada' ? 'Pagada' : e==='anulada' ? 'Anulada' : 'Pendiente'; }
  function pagoEstadoLabel(e){ return e==='pagada' ? 'Pagada' : e==='anulada' ? 'Anulada' : 'Pendiente'; }

  // ---------- Anulación de comprobantes ----------
  // Facturas, órdenes de pago, órdenes de compra y movimientos de caja no se
  // borran: se anulan. Quedan guardados con quién, cuándo y por qué, no
  // cuentan en saldos, pendientes ni tableros, y su número no se reutiliza.
  function esAnulado(x){ return !!x && (x.estado==='anulada' || !!x.anuladoEn); }
  function noAnulado(x){ return !esAnulado(x); }
  function leerAnulacion(row, o){
    if(row && Object.prototype.hasOwnProperty.call(row, 'anulado_en')) state.colAnulacion = true;
    o.anuladoEn = (row && row.anulado_en) || '';
    o.anuladoPor = (row && row.anulado_por) || '';
    o.motivoAnulacion = (row && row.motivo_anulacion) || '';
    return o;
  }
  function camposAnulacion(x){
    return state.colAnulacion ? {anulado_en:x.anuladoEn||null, anulado_por:x.anuladoPor||'', motivo_anulacion:x.motivoAnulacion||''} : {};
  }
  function quienAnula(){ return state.sessionEmail || whoName(); }
  function fmtFechaHoraAnul(iso){
    var d = new Date(iso);
    if(isNaN(d.getTime())) return String(iso||'');
    var z = function(n){ return String(n).padStart(2,'0'); };
    return z(d.getDate())+'/'+z(d.getMonth()+1)+'/'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes());
  }
  function anulacionTexto(x){
    return 'Anulad'+(x.__genero==='o' ? 'o' : 'a')+(x.anuladoEn ? ' el '+fmtFechaHoraAnul(x.anuladoEn) : '')+(x.anuladoPor ? ' por '+x.anuladoPor : '')
      +(x.motivoAnulacion ? '. Motivo: '+x.motivoAnulacion : '');
  }
  // Pide el motivo en un cuadro propio (no window.prompt) y llama a cb(motivo).
  function pedirAnulacion(titulo, detalle, cb, sinChequeo){
    if(!sinChequeo && !state.colAnulacion){ showToast('Para anular comprobantes falta correr base-de-datos/anulacion-comprobantes.sql en Supabase.', 7000); return; }
    var ov = document.getElementById('anular-overlay');
    document.getElementById('anul-title').textContent = titulo;
    document.getElementById('anul-detalle').textContent = detalle || '';
    var ta = document.getElementById('anul-motivo');
    ta.value = '';
    ov.classList.add('show');
    setTimeout(function(){ try{ ta.focus(); }catch(e){} }, 30);
    state.anulCallback = cb;
  }
  function cerrarAnulacion(){ document.getElementById('anular-overlay').classList.remove('show'); state.anulCallback = null; }
  document.getElementById('anul-cancel').addEventListener('click', cerrarAnulacion);
  document.getElementById('anul-ok').addEventListener('click', function(){
    var motivo = document.getElementById('anul-motivo').value.trim();
    if(!motivo){ showToast('Escribí el motivo de la anulación.'); return; }
    var cb = state.anulCallback;
    cerrarAnulacion();
    if(cb) cb(motivo);
  });
  function sellarAnulacion(x, motivo){
    x.anuladoEn = new Date().toISOString();
    x.anuladoPor = quienAnula();
    x.motivoAnulacion = motivo;
    return x;
  }
  // Modal de un comprobante anulado: solo lectura, con la leyenda arriba.
  // Lo que deshabilita lo marca, así al abrir otro comprobante se rehabilita.
  function marcarModalAnulado(saveBtnId, anularBtnId, x, genero){
    var save = document.getElementById(saveBtnId);
    var modal = save.closest('.modal');
    var banner = modal.querySelector('.anulado-banner');
    Array.prototype.forEach.call(modal.querySelectorAll('[data-anul-dis]'), function(el){ el.disabled = false; el.removeAttribute('data-anul-dis'); });
    if(!esAnulado(x)){
      if(banner) banner.remove();
      save.style.display = '';
      return;
    }
    if(!banner){
      banner = document.createElement('div');
      banner.className = 'anulado-banner';
      var sub = modal.querySelector('.sub');
      if(sub) sub.insertAdjacentElement('afterend', banner); else modal.insertBefore(banner, modal.firstChild);
    }
    banner.textContent = anulacionTexto(Object.assign({__genero:genero}, x));
    save.style.display = 'none';
    document.getElementById(anularBtnId).style.display = 'none';
    Array.prototype.forEach.call(modal.querySelectorAll('input, select, textarea, button:not([id$="-cancel"]):not([id$="-imprimir"])'), function(el){
      if(!el.disabled){ el.disabled = true; el.setAttribute('data-anul-dis', '1'); }
    });
  }
  function pagoNumeroLabel(n){ return 'OP-'+String(n||0).padStart(4,'0'); }
  function nextPagoNumero(){
    var max = 0;
    state.ordenesPago.forEach(function(p){ if((p.numero||0)>max) max = p.numero; });
    return max+1;
  }
  function facturaById(id){
    return state.facturas.find(function(x){ return x.id===id; }) || null;
  }
  function generateFacturaId(proveedorId, numero){
    var base = slug(proveedorId+'_'+numero);
    var used = {};
    state.facturas.forEach(function(f){ used[f.id] = true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }
  function setFacturaEstado(facturaId, estado){
    var f = facturaById(facturaId);
    if(!f || f.estado===estado) return;
    f.estado = estado;
    writeFactura(f);
  }

  function renderPagos(){
    renderSugerenciaPagos();
    renderFacturasList();
    renderPagosList();
    renderRetencionesList();
    actualizarSubtabs();
  }

  function renderFacturasList(){
    var body = document.getElementById('facturas-body');
    if(!body) return;
    body.innerHTML = '';
    var list = state.facturas.slice();
    if(state.facturaFilterEstado) list = list.filter(function(f){ return f.estado===state.facturaFilterEstado; });
    list.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">No hay facturas'+(state.facturaFilterEstado?' con ese estado':' cargadas')+'.</td></tr>';
      return;
    }
    list.forEach(function(f){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var montoStr = Number(f.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var oc = f.ocId ? state.ordenesCompra.find(function(o){ return o.id===f.ocId; }) : null;
      if(esAnulado(f)){ tr.className += ' anulado'; tr.title = anulacionTexto(f); }
      tr.innerHTML = '<td class="day-route">'+esc(proveedorNombre(f.proveedorId))+'</td>'
        +'<td class="num">'+esc(f.numero||'—')+'</td>'
        +'<td class="num">'+esc(f.fecha||'—')+'</td>'
        +'<td>'+(oc ? esc(ocNumeroLabel(oc.numero)) : '—')+'</td>'
        +'<td class="num">$'+montoStr+'</td>'
        +'<td><span class="oc-badge '+esc(f.estado||'pendiente')+'">'+facturaEstadoLabel(f.estado)+'</span></td>';
      tr.addEventListener('click', function(){ openFacturaModal(f.id); });
      body.appendChild(tr);
    });
  }

  function renderPagosList(){
    var body = document.getElementById('pagos-body');
    if(!body) return;
    body.innerHTML = '';
    var list = state.ordenesPago.slice();
    if(state.pagoFilterEstado) list = list.filter(function(p){ return p.estado===state.pagoFilterEstado; });
    list.sort(function(a,b){ return (b.numero||0)-(a.numero||0); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">No hay órdenes de pago'+(state.pagoFilterEstado?' con ese estado':'')+'.</td></tr>';
      return;
    }
    list.forEach(function(p){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var montoStr = Number(p.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var facturasLabel = (p.facturaIds||[]).map(function(fid){ var f=facturaById(fid); return f ? f.numero : '(eliminada)'; }).join(', ') || '—';
      if(esAnulado(p)){ tr.className += ' anulado'; tr.title = anulacionTexto(p); }
      tr.innerHTML = '<td class="day-route num">'+pagoNumeroLabel(p.numero)+'</td>'
        +'<td>'+esc(proveedorNombre(p.proveedorId))+'</td>'
        +'<td class="num">'+esc(p.fecha||'—')+'</td>'
        +'<td class="day-note">'+esc(facturasLabel)+'</td>'
        +'<td class="num">$'+montoStr+(p.retenido ? '<div class="fm-hint">ret. '+fmtMoney(p.retenido)+'</div>' : '')+'</td>'
        +'<td><span class="oc-badge '+esc(p.estado||'pendiente')+'">'+pagoEstadoLabel(p.estado)+'</span></td>';
      tr.addEventListener('click', function(){ openPagoModal(p.id); });
      body.appendChild(tr);
    });
  }




  // ---------- Retención de Ganancias (RG 830 / RG 5423) ----------
  // Parámetros editables en ⚙ → Tesorería → Retenciones. El cálculo sigue el
  // Anexo VIII: inscriptos, acumulado de pagos del mes por proveedor y
  // régimen − monto no sujeto, × alícuota (o escala), − lo ya retenido en el
  // mes; si da menos que el mínimo no se retiene. No inscriptos: alícuota
  // sobre el pago, sin monto no sujeto (salvo 112/113).
  var RUBRO_REGIMEN = {'bienes':78, 'locacion de servicios':94, 'honorarios':119, 'alquileres':31, 'transporte de carga':95};
  function normTxt(t){ return String(t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').trim(); }
  function cargarParametrosRetencion(){
    if(!state.sb) return;
    // ¿Existe la columna ordenes_pago.formas (pagos mixtos)?
    state.sb.from('ordenes_pago').select('formas').limit(1).then(function(res){ if(!res.error) state.colFormas = true; });
    // ¿Existen las columnas de anulación (anulacion-comprobantes.sql)?
    state.sb.from('movimientos').select('anulado_en').limit(1).then(function(res){ if(!res.error) state.colAnulacion = true; });
    state.sb.from('gan_regimenes').select('*').then(function(res){
      if(res.error) return; // schema viejo: sin retenciones
      state.schemaV3 = true;
      state.ganRegimenes = (res.data||[]).map(function(r){ return {
        codigo:Number(r.codigo), descripcion:r.descripcion||'', alicInsc:r.alic_insc==null?null:Number(r.alic_insc), escala:r.escala||'',
        alicNoInsc:r.alic_no_insc==null?null:Number(r.alic_no_insc), alicNoInscPH:r.alic_no_insc_ph==null?null:Number(r.alic_no_insc_ph),
        mnsr:Number(r.mnsr||0), mnsrNoInsc:!!r.mnsr_no_insc, minInsc:Number(r.min_insc||0), minNoInsc:Number(r.min_no_insc||0),
        ivaPct:r.iva_pct==null?0:Number(r.iva_pct),
        activo:r.activo!==false, orden:r.orden||0 }; }).sort(function(a,b){ return (a.orden||0)-(b.orden||0) || a.codigo-b.codigo; });
      if(state.settingsTab==='retenciones') renderRetencionesSettings();
      renderPagos();
    });
    state.sb.from('gan_escalas').select('*').then(function(res){
      if(res.error) return;
      state.ganEscalas = (res.data||[]).map(function(r){ return {escala:r.escala, desde:Number(r.desde), hasta:r.hasta==null?null:Number(r.hasta), fijo:Number(r.fijo||0), pct:Number(r.pct||0)}; })
        .sort(function(a,b){ return a.escala.localeCompare(b.escala) || a.desde-b.desde; });
    });
    state.sb.from('parametros').select('*').eq('id','agente_retencion').then(function(res){
      if(res.error || !res.data || !res.data[0]) return;
      state.agente = res.data[0].valor || {};
    });
  }
  function regimenByCodigo(c){ c = Number(c); return state.ganRegimenes.find(function(r){ return r.codigo===c; }) || null; }
  function regimenLabel(c){ var r = regimenByCodigo(c); return r ? (r.codigo+' — '+r.descripcion) : (c ? 'Régimen '+c : ''); }
  function fillRegimenSelect(sel, valor, placeholder){
    sel.innerHTML = '<option value="">'+esc(placeholder||'Elegir régimen')+'</option>'+state.ganRegimenes.filter(function(r){ return r.activo || String(r.codigo)===String(valor); })
      .map(function(r){ return '<option value="'+r.codigo+'">'+esc(r.codigo+' — '+r.descripcion)+'</option>'; }).join('')
      +'<option value="0">No retener en esta factura</option>';
    sel.value = valor==null ? '' : String(valor);
  }
  function esPersonaHumana(cuit){ var d = String(cuit||'').replace(/\D/g,''); return /^(20|23|24|27)/.test(d); }
  // Condición en Ganancias: la elegida en el proveedor o, si no, según IVA.
  function provGanCondicionAuto(p){
    var iva = normTxt(p && p.condicionIva);
    if(iva.indexOf('monotrib')!==-1) return 'monotributo';
    // "Exento en IVA": la factura no lleva IVA (neto = total) pero en Ganancias se le retiene como inscripto.
    if(iva.indexOf('exento en iva')!==-1) return 'inscripto';
    if(iva.indexOf('exento')!==-1) return 'exento';
    if(iva.indexOf('consumidor')!==-1) return 'no_retener';   // consumidor final: no se le retiene
    if(iva.indexOf('inscripto')!==-1) return 'inscripto';
    return 'no_inscripto';
  }
  function provGanCondicion(p){ return (p && p.ganCondicion) || provGanCondicionAuto(p); }
  function provGanRegimen(p){
    if(p && p.ganRegimen) return p.ganRegimen;
    return RUBRO_REGIMEN[normTxt(p && p.rubro)] || null;
  }
  var GAN_COND_LABEL = {inscripto:'Inscripto', no_inscripto:'No inscripto', exento:'Exento', monotributo:'Monotributo', no_retener:'No retener'};
  function actualizarPmGanHint(){
    var p = {condicionIva: document.getElementById('pm-condicion-iva').value, rubro: (typeof rubroElegido==='function' ? rubroElegido() : ''),
             cuit: document.getElementById('pm-cuit').value};
    document.getElementById('pm-gan-hint').textContent = document.getElementById('pm-gan-condicion').value ? '' : '→ '+GAN_COND_LABEL[provGanCondicionAuto(p)];
    var r = RUBRO_REGIMEN[normTxt(p.rubro)];
    document.getElementById('pm-gan-reg-hint').textContent = document.getElementById('pm-gan-regimen').value ? '' : (r ? '→ '+r+' (por el rubro)' : '→ sin régimen: no retiene');
  }
  ['pm-gan-condicion','pm-gan-regimen','pm-condicion-iva','pm-cuit','pm-rubro'].forEach(function(id){
    var el = document.getElementById(id);
    if(el) el.addEventListener(el.tagName==='SELECT' ? 'change' : 'input', actualizarPmGanHint);
  });
  // Neto gravado: el cargado o, si está vacío, total/1,21 para Responsables
  // Inscriptos (factura A) y el total para el resto.
  function facturaNetoAuto(f){
    var p = state.proveedores.find(function(x){ return x.id===f.proveedorId; });
    var ri = normTxt(p && p.condicionIva).indexOf('inscripto')!==-1 && normTxt(p && p.condicionIva).indexOf('monotrib')===-1;
    return Math.round((ri ? Number(f.monto||0)/1.21 : Number(f.monto||0))*100)/100;
  }
  function facturaNeto(f){ return f.neto!=null && !isNaN(f.neto) ? Number(f.neto) : facturaNetoAuto(f); }
  // Factura M: el régimen que además retiene IVA (iva_pct), si está activo.
  function regimenFacturaM(){ var r = state.ganRegimenes.find(function(x){ return x.activo && x.ivaPct>0; }); return r ? r.codigo : null; }
  function esFacturaM(f){ return /^\s*M\s*[-\s]?\s*\d{4,5}\s*-\s*\d+/i.test(String(f && f.numero || '')); }  // "M-0001-00001234"
  function facturaRegimen(f){
    if(f.regimenGan===0) return 0;
    if(f.regimenGan) return f.regimenGan;
    if(esFacturaM(f) && regimenFacturaM()) return regimenFacturaM();   // número "M-0001-…": Factura M
    var p = state.proveedores.find(function(x){ return x.id===f.proveedorId; });
    return provGanRegimen(p) || 0;
  }
  function escalaCalc(nombre, monto){
    var tramos = state.ganEscalas.filter(function(t){ return t.escala===nombre; });
    for(var i=0;i<tramos.length;i++){
      var t = tramos[i];
      if(monto>t.desde && (t.hasta==null || monto<=t.hasta)) return t.fijo + (monto-t.desde)*t.pct/100;
    }
    return 0;
  }
  // Redondeo a 2 decimales "hacia arriba" en el medio (2332,075 → 2332,08), sin el error de coma flotante.
  function r2(n){ n = Number(n)||0; return Math.round(Number((n*100).toFixed(6)))/100; }
  function mesDe(fecha){ return String(fecha||'').slice(0,7); }
  // Retenciones de una orden de pago (sin guardar). Devuelve una línea por
  // régimen: {regimen, base, acum_prev, ret_prev, importe, condicion, detalle}.
  function calcularRetenciones(proveedorId, facturaIds, fecha, opId){
    var p = state.proveedores.find(function(x){ return x.id===proveedorId; });
    if(!p || !state.ganRegimenes.length) return [];
    var cond = provGanCondicion(p);
    var porReg = {};
    facturaIds.forEach(function(fid){
      var f = facturaById(fid); if(!f) return;
      var reg = facturaRegimen(f); if(!reg) return;
      porReg[reg] = (porReg[reg]||0) + facturaNeto(f);
    });
    var mes = mesDe(fecha);
    var ph = esPersonaHumana(p.cuit);
    return Object.keys(porReg).map(function(k){
      var reg = regimenByCodigo(k), base = r2(porReg[k]);
      var out = {regimen:Number(k), base:base, acum_prev:0, ret_prev:0, importe:0, condicion:cond, detalle:''};
      if(!reg){ out.detalle = 'Régimen '+k+' no está en la tabla'; return out; }
      if(!reg.activo){ out.detalle = 'Régimen '+k+' desactivado: no retiene (cambiá el régimen del proveedor o de la factura)'; return out; }
      if(cond==='exento' || cond==='monotributo' || cond==='no_retener'){ out.detalle = GAN_COND_LABEL[cond]+': no se retiene'; return out; }
      // Lo pagado y retenido en el mes al mismo proveedor por el mismo régimen.
      state.ordenesPago.forEach(function(o){
        if(o.id===opId || o.proveedorId!==proveedorId || o.estado!=='pagada' || mesDe(o.fecha)!==mes) return;
        (o.retenciones||[]).forEach(function(e){ if(Number(e.regimen)===reg.codigo && e.impuesto!=='iva'){ out.acum_prev += Number(e.base||0); out.ret_prev += Number(e.importe||0); } });
      });
      out.acum_prev = r2(out.acum_prev); out.ret_prev = r2(out.ret_prev);
      var total, minimo;
      if(cond==='inscripto'){
        var sujeto = Math.max(0, out.acum_prev + base - reg.mnsr);
        total = r2(reg.alicInsc!=null ? sujeto*reg.alicInsc/100 : escalaCalc(reg.escala||'general', sujeto));
        minimo = reg.minInsc;
        out.detalle = 'Acumulado del mes '+fmtMoney(out.acum_prev+base)+' − no sujeto '+fmtMoney(reg.mnsr)+' = '+fmtMoney(sujeto)
          +(reg.alicInsc!=null ? ' × '+String(reg.alicInsc).replace('.',',')+'%' : ' por escala')+(out.ret_prev ? ' − ya retenido '+fmtMoney(out.ret_prev) : '');
      } else {
        var alic = (ph && reg.alicNoInscPH!=null) ? reg.alicNoInscPH : (reg.alicNoInsc!=null ? reg.alicNoInsc : 0);
        if(reg.mnsrNoInsc){ total = r2(Math.max(0, out.acum_prev + base - reg.mnsr)*alic/100); }
        else { total = r2((out.acum_prev + base)*alic/100); }
        minimo = reg.minNoInsc;
        out.detalle = 'No inscripto: '+String(alic).replace('.',',')+'% sobre '+fmtMoney(out.acum_prev+base)+(out.ret_prev ? ' − ya retenido '+fmtMoney(out.ret_prev) : '');
      }
      var imp = r2(total - out.ret_prev);
      if(imp < minimo){ if(imp>0) out.detalle += ' → '+fmtMoney(imp)+' no llega al mínimo de '+fmtMoney(minimo); imp = 0; }
      out.importe = Math.max(0, imp);
      return out;
    }).reduce(function(lista, out){
      lista.push(out);
      // Factura M: además se retiene el IVA (por defecto el 21% del neto).
      var reg = regimenByCodigo(out.regimen);
      if(reg && reg.ivaPct>0) lista.push({impuesto:'iva', regimen:reg.codigo, base:out.base, acum_prev:0, ret_prev:0,
        importe:r2(out.base*reg.ivaPct/100), condicion:out.condicion, detalle:'IVA '+String(reg.ivaPct).replace('.',',')+'% sobre el neto '+fmtMoney(out.base)});
      return lista;
    }, []);
  }
  function impuestoLabel(e){ return e && e.impuesto==='iva' ? 'IVA' : 'Ganancias'; }
  function proximoCertificado(){
    var max = 0;
    state.ordenesPago.forEach(function(o){ (o.retenciones||[]).forEach(function(e){ if(Number(e.certificado)>max) max = Number(e.certificado); }); });
    return max+1;
  }
  function certNumeroLabel(n){ return String(n||0).padStart(6,'0'); }
  // ======================================================================
  // Impresiones: un solo formato para todos los comprobantes
  // ======================================================================
  // Hoja A4 con el logo y los datos de la empresa (los del agente de
  // retención, ⚙ → Tesorería → Retenciones), la franja de colores Anafer,
  // el tipo y número de comprobante, secciones, totales, firmas y pie con
  // quién y cuándo lo imprimió. Si el comprobante está anulado, sale con
  // una marca de agua "ANULADO".
  function impLogo(){ var l = document.querySelector('.brand-logo'); return l ? l.src : ''; }
  function impFecha(f){ return f ? String(f).slice(0,10).split('-').reverse().join('/') : '—'; }
  function impKV(pares){
    return '<table class="kv">'+pares.filter(function(p){ return p && p[1]!=null && p[1]!==''; }).map(function(p){
      return '<tr><th>'+esc(p[0])+'</th><td>'+(p[2] ? p[1] : esc(p[1]).replace(/\n/g,'<br>'))+'</td></tr>'; }).join('')+'</table>';
  }
  function impTabla(cols, filas, pie){
    return '<table class="grid"><thead><tr>'+cols.map(function(c){ return '<th'+(c.num?' class="n"':'')+'>'+esc(c.t)+'</th>'; }).join('')+'</tr></thead><tbody>'+
      (filas.length ? filas.map(function(f){ return '<tr>'+f.map(function(v,i){ return '<td'+(cols[i].num?' class="n"':'')+'>'+v+'</td>'; }).join('')+'</tr>'; }).join('')
        : '<tr><td colspan="'+cols.length+'" class="vacio">—</td></tr>')+'</tbody>'+
      (pie ? '<tfoot><tr>'+pie.map(function(v,i){ return '<td'+(cols[i].num?' class="n"':'')+'>'+v+'</td>'; }).join('')+'</tr></tfoot>' : '')+'</table>';
  }
  function impTotales(filas){
    return '<table class="totales">'+filas.map(function(f){ return '<tr class="'+(f[2]||'')+'"><th>'+esc(f[0])+'</th><td>'+f[1]+'</td></tr>'; }).join('')+'</table>';
  }
  function imprimirDocumento(o){
    var w = window.open('', '_blank');
    if(!w){ showToast('El navegador bloqueó la ventana de impresión: permití las ventanas emergentes para este sitio.', 6000); return null; }
    var ag = state.agente || {};
    var emp = [ag.cuit ? 'CUIT '+ag.cuit : '', [ag.domicilio, ag.localidad, ag.provincia].filter(Boolean).join(', ')].filter(Boolean).join(' · ');
    var ahora = new Date();
    var quien = state.sessionEmail || whoName();
    var css = '@page{size:A4;margin:14mm 13mm 16mm}*{box-sizing:border-box}'+
      'body{margin:0;font-family:"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#1f2d38;font-size:12.5px;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#eef1f4}'+
      '.hoja{position:relative;background:#fff;max-width:200mm;margin:16px auto;padding:22px 26px 18px;box-shadow:0 8px 28px rgba(31,45,56,.15);border-radius:6px;overflow:hidden}'+
      '.franja{height:6px;margin:-22px -26px 18px;background:linear-gradient(90deg,#223c7e 0%,#223c7e 42%,#2ba9e0 42%,#2ba9e0 68%,#e1251b 68%,#e1251b 100%)}'+
      '.cab{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;padding-bottom:14px;border-bottom:2px solid #223c7e}'+
      '.emp{display:flex;gap:14px;align-items:center}.emp img{height:54px}.emp b{display:block;font-size:15px;color:#223c7e}.emp span{display:block;font-size:11px;color:#5c6b78;margin-top:2px}'+
      '.doc{text-align:right;min-width:200px}.doc .tipo{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#5c6b78}'+
      '.doc .num{font-size:24px;font-weight:800;color:#223c7e;line-height:1.15;margin-top:2px}.doc .fecha{font-size:12px;color:#5c6b78;margin-top:2px}'+
      '.doc .codigo{display:inline-block;font-size:10.5px;color:#5c6b78;border:1px solid #cfd6dd;border-radius:6px;padding:1px 7px;margin-top:6px}'+
      '.estado{display:inline-block;margin-top:6px;font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;padding:3px 10px;border-radius:999px;color:#fff}'+
      'h2{font-size:11.5px;font-weight:800;letter-spacing:.09em;text-transform:uppercase;color:#223c7e;margin:18px 0 7px;padding-left:9px;border-left:4px solid #2ba9e0}'+
      '.cols{display:grid;grid-template-columns:1fr 1fr;gap:0 22px}'+
      'table{width:100%;border-collapse:collapse}'+
      '.kv th{text-align:left;width:38%;font-weight:600;color:#5c6b78;padding:3px 8px 3px 0;vertical-align:top;font-size:12px}.kv td{padding:3px 0;vertical-align:top}'+
      '.grid th{background:#f1f4f7;color:#5c6b78;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;text-align:left;padding:7px 8px;border-bottom:1px solid #cfd6dd}'+
      '.grid td{padding:7px 8px;border-bottom:1px solid #e9edf1}.grid tfoot td{font-weight:800;border-top:2px solid #223c7e;border-bottom:none}'+
      '.n,.grid th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}.vacio{color:#94a1ab;text-align:center}'+
      '.totales{width:auto;min-width:300px;margin:12px 0 0 auto}.totales th{text-align:left;font-weight:600;color:#5c6b78;padding:4px 14px 4px 0}.totales td{text-align:right;font-variant-numeric:tabular-nums;padding:4px 0}'+
      '.totales tr.menos td{color:#e1251b}.totales tr.total th,.totales tr.total td{font-size:15px;font-weight:800;color:#223c7e;border-top:2px solid #223c7e;padding-top:7px}'+
      '.texto{white-space:pre-wrap;line-height:1.45}.nota{font-size:11.5px;color:#5c6b78;margin-top:8px}'+
      '.firmas{display:grid;grid-template-columns:repeat(var(--nf,3),1fr);gap:28px;margin-top:56px}.firmas div{border-top:1px solid #1f2d38;text-align:center;padding-top:5px;font-size:11px;color:#5c6b78}'+
      '.pie{margin-top:26px;padding-top:8px;border-top:1px solid #e3e8ed;display:flex;justify-content:space-between;font-size:10px;color:#94a1ab}'+
      '.anulado{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none}'+
      '.anulado span{transform:rotate(-28deg);font-size:110px;font-weight:900;letter-spacing:.08em;color:rgba(225,37,27,.13);border:10px solid rgba(225,37,27,.13);padding:4px 34px;border-radius:18px}'+
      '.anul-motivo{margin-top:12px;border:1px solid #f3b3ae;background:#fff1f0;color:#b42318;border-radius:8px;padding:8px 12px;font-size:12px}'+
      '.barra{position:sticky;top:0;z-index:5;display:flex;gap:8px;justify-content:center;padding:10px;background:#1f2d38}'+
      '.barra button{font:600 13px "Segoe UI",sans-serif;border:none;border-radius:8px;padding:8px 16px;cursor:pointer}.barra .imp{background:#2ba9e0;color:#fff}.barra .cer{background:#fff;color:#1f2d38}'+
      '@media print{body{background:#fff}.barra{display:none}.hoja{box-shadow:none;margin:0;max-width:none;padding:0;border-radius:0}.franja{margin:0 0 14px}h2{break-after:avoid}tr{break-inside:avoid}.firmas{break-inside:avoid}}';
    var firmas = o.firmas || [];
    var html = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>'+esc(o.tipo+' '+(o.numero||''))+'</title><style>'+css+'</style></head><body>'+
      '<div class="barra"><button class="imp" onclick="window.print()">🖨 Imprimir / guardar PDF</button><button class="cer" onclick="window.close()">Cerrar</button></div>'+
      '<div class="hoja">'+(o.anulado ? '<div class="anulado"><span>ANULADO</span></div>' : '')+'<div class="franja"></div>'+
      '<div class="cab"><div class="emp">'+(impLogo() ? '<img src="'+impLogo()+'" alt="Anafer">' : '')+'<div><b>'+esc(ag.razon_social || 'ANAFER S.A.')+'</b>'+(emp ? '<span>'+esc(emp)+'</span>' : '')+'</div></div>'+
      '<div class="doc"><div class="tipo">'+esc(o.tipo)+'</div><div class="num">'+esc(o.numero||'')+'</div>'+(o.fecha ? '<div class="fecha">Fecha: '+impFecha(o.fecha)+'</div>' : '')+
      (o.estado ? '<div class="estado" style="background:'+(o.estado.color||'#223c7e')+'">'+esc(o.estado.texto)+'</div>' : '')+(o.codigo ? '<div><span class="codigo">'+esc(o.codigo)+'</span></div>' : '')+'</div></div>'+
      (o.anulado ? '<div class="anul-motivo">'+esc(o.anulado)+'</div>' : '')+
      (o.bloques||[]).map(function(b){ return b ? ((b.titulo ? '<h2>'+esc(b.titulo)+'</h2>' : '')+b.html) : ''; }).join('')+
      (firmas.length ? '<div class="firmas" style="--nf:'+firmas.length+'">'+firmas.map(function(f){ return '<div>'+esc(f)+'</div>'; }).join('')+'</div>' : '')+
      '<div class="pie"><span>Gestión Anafer · '+esc(o.tipo)+' '+esc(o.numero||'')+'</span><span>Impreso el '+ahora.toLocaleDateString('es-AR')+' '+ahora.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+' por '+esc(quien)+'</span></div>'+
      '</div></body></html>';
    w.document.open(); w.document.write(html); w.document.close();
    if(o.autoImprimir !== false) setTimeout(function(){ try{ w.focus(); w.print(); }catch(err){} }, 400);
    return w;
  }

  // ---------- Orden de pago ----------
  function imprimirOrdenPago(op){
    var p = state.proveedores.find(function(x){ return x.id===op.proveedorId; }) || {};
    var facts = (op.facturaIds||[]).map(facturaById).filter(Boolean);
    var totalFact = r2(facts.reduce(function(t,f){ return t+Number(f.monto||0); }, 0));
    var rets = (op.retenciones||[]).filter(function(e){ return e.importe>0; });
    var retenido = r2(rets.reduce(function(t,e){ return t+Number(e.importe||0); }, 0));
    var formas = formasDePago(op).filter(function(f){ return f.medioId || f.importe; });
    var anul = esAnulado(op);
    var estadoTxt = anul ? 'Anulada' : (op.estado==='pagada' ? 'Pagada' : 'Pendiente de pago');
    imprimirDocumento({
      tipo:'Orden de pago', numero:pagoNumeroLabel(op.numero), fecha:op.fecha,
      estado:{ texto:estadoTxt, color: anul ? '#e1251b' : (op.estado==='pagada' ? '#16a34a' : '#d48f00') },
      anulado: anul ? anulacionTexto(op) : null,
      bloques:[
        { titulo:'Beneficiario', html:'<div class="cols">'+impKV([['Proveedor', p.nombre||proveedorNombre(op.proveedorId)], ['CUIT', p.cuit], ['Condición IVA', p.condicionIva]])+
          impKV([['Domicilio', [p.direccion, p.localidad, p.provincia].filter(Boolean).join(', ')], ['Banco', p.banco], ['CBU / alias', p.cbu]])+'</div>' },
        { titulo:'Comprobantes que se cancelan', html: impTabla([{t:'Comprobante'},{t:'Fecha'},{t:'Imputación'},{t:'Importe',num:true}],
            facts.map(function(f){ var l = facturaLineas(f)[0] || {}; return [esc(f.numero||''), impFecha(f.fecha), esc(l.centroCostoId ? centroCostoLabel(l.centroCostoId) : '—'), fmtMoney(f.monto)]; }),
            ['<b>Total comprobantes</b>','','',fmtMoney(totalFact)]) },
        rets.length ? { titulo:'Retenciones practicadas', html: impTabla([{t:'Impuesto'},{t:'Régimen'},{t:'Certificado'},{t:'Base',num:true},{t:'Retenido',num:true}],
            rets.map(function(e){ return [impuestoLabel(e), esc(regimenLabel(e.regimen)), e.certificado ? certNumeroLabel(e.certificado) : '—', fmtMoney(e.base), fmtMoney(e.importe)]; })) } : null,
        { titulo:'Forma de pago', html: formas.length ? impTabla([{t:'Concepto'},{t:'Cuenta'},{t:'Cheque / echeq'},{t:'Fecha de cobro'},{t:'Importe',num:true}],
            formas.map(function(f){
              var chq = formaModo(f)==='cartera' ? (f.chequeIds||[]).map(chequeById).filter(Boolean).map(function(c){ return esc(chequeResumen(c)); }).join('<br>') : esc(f.chequeNumero||'');
              var cobro = formaModo(f)==='cartera' ? (f.chequeIds||[]).map(chequeById).filter(Boolean).map(function(c){ return impFecha(c.fechaCobro); }).join('<br>') : (f.chequeFecha ? impFecha(f.chequeFecha) : '');
              return [esc(medioLabel(f.medioId)||'—'), esc(f.cuentaId ? cuentaNombre(f.cuentaId) : '—'), chq||'—', cobro||'—', fmtMoney(f.importe)];
            })) : '<div class="nota">Todavía no se cargó cómo se paga (la orden está pendiente).</div>' },
        { html: impTotales([['Total comprobantes', fmtMoney(totalFact)]].concat(retenido ? [['Retenciones', '− '+fmtMoney(retenido), 'menos']] : []).concat([['Neto a pagar', fmtMoney(r2(totalFact-retenido)), 'total']])) },
        op.notas ? { titulo:'Observaciones', html:'<div class="texto">'+esc(op.notas)+'</div>' } : null
      ],
      firmas:['Confeccionó', 'Autorizó', 'Recibí conforme · firma y aclaración']
    });
  }
  // ---------- Orden de compra ----------
  function imprimirOrdenCompra(o){
    var p = state.proveedores.find(function(x){ return x.id===o.proveedorId; }) || {};
    var anul = esAnulado(o);
    imprimirDocumento({
      tipo:'Orden de compra', numero:ocNumeroLabel(o.numero), fecha:o.fecha,
      estado:{ texto: anul ? 'Anulada' : ocEstadoLabel(o.estado), color: anul ? '#e1251b' : (o.estado==='recibida' ? '#16a34a' : o.estado==='aprobada' ? '#2ba9e0' : '#d48f00') },
      anulado: anul ? anulacionTexto(o) : null,
      bloques:[
        { titulo:'Proveedor', html:'<div class="cols">'+impKV([['Proveedor', p.nombre||proveedorNombre(o.proveedorId)], ['CUIT', p.cuit], ['Contacto', p.contacto]])+
          impKV([['Teléfono', p.telefono], ['Email', p.email], ['Domicilio', [p.direccion, p.localidad, p.provincia].filter(Boolean).join(', ')]])+'</div>' },
        { titulo:'Detalle del pedido', html:'<div class="texto">'+esc(o.descripcion||'—')+'</div>' },
        { html: impTotales([['Importe estimado', fmtMoney(o.monto), 'total']]) },
        o.notas ? { titulo:'Observaciones', html:'<div class="texto">'+esc(o.notas)+'</div>' } : null
      ],
      firmas:['Solicitó', 'Autorizó', 'Recibió el proveedor']
    });
  }

  function imprimirCertificado(op, e){
    var p = state.proveedores.find(function(x){ return x.id===op.proveedorId; }) || {};
    var ag = state.agente || {};
    var facts = (op.facturaIds||[]).map(function(fid){ var f = facturaById(fid); return f && facturaRegimen(f)===Number(e.regimen) ? f : null; }).filter(Boolean);
    var reg = regimenByCodigo(e.regimen);
    var anul = esAnulado(op);
    imprimirDocumento({
      tipo:'Certificado de retención', numero:'N° '+certNumeroLabel(e.certificado), fecha:op.fecha,
      codigo: e.impuesto==='iva' ? 'Impuesto al Valor Agregado · Factura M · RG (AFIP) 1575' : 'Impuesto a las Ganancias · RG (ARCA) 830',
      estado: anul ? {texto:'Anulado', color:'#e1251b'} : null,
      anulado: anul ? 'Este certificado corresponde a la '+pagoNumeroLabel(op.numero)+', que fue anulada. '+anulacionTexto(op) : null,
      bloques:[
        { titulo:'Agente de retención', html: impKV([['Razón social', ag.razon_social||''], ['CUIT', ag.cuit||''], ['Domicilio', [ag.domicilio, ag.localidad, ag.provincia].filter(Boolean).join(', ')]]) },
        { titulo:'Sujeto retenido', html: impKV([['Nombre / razón social', p.nombre||''], ['CUIT', p.cuit||''], ['Domicilio', [p.direccion, p.localidad, p.provincia].filter(Boolean).join(', ')], ['Condición', GAN_COND_LABEL[e.condicion]||e.condicion||'']]) },
        { titulo:'Retención', html: impKV([['Régimen', reg ? reg.codigo+' — '+reg.descripcion : String(e.regimen)], ['Orden de pago', pagoNumeroLabel(op.numero)],
            ['Comprobantes', facts.map(function(f){ return (f.numero||'')+' ('+impFecha(f.fecha)+')'; }).join(', ')]]) +
          impTotales(e.impuesto==='iva'
            ? [['Neto gravado de los comprobantes', fmtMoney(e.base)], ['IVA retenido', fmtMoney(e.importe), 'total']]
            : [['Importe neto de este pago', fmtMoney(e.base)], ['Pagos anteriores del mes', fmtMoney(e.acum_prev)], ['Retenido anteriormente en el mes', fmtMoney(e.ret_prev)], ['Importe retenido', fmtMoney(e.importe), 'total']]) }
      ],
      firmas:['Firma y aclaración · Agente de retención']
    });
  }


  // ---------- Listado de retenciones practicadas (Pagos → Retenciones) ----------
  function retencionesDelMes(mes, conAnuladas){
    var out = [];
    state.ordenesPago.forEach(function(o){
      if(!(o.estado==='pagada' || (conAnuladas && esAnulado(o))) || mesDe(o.fecha)!==mes) return;
      (o.retenciones||[]).forEach(function(e){ if(e.importe>0) out.push({op:o, e:e}); });
    });
    return out.sort(function(a,b){ return Number(a.e.certificado||0)-Number(b.e.certificado||0); });
  }
  function renderRetencionesList(){
    var body = document.getElementById('ret-body');
    if(!body) return;
    var mi = document.getElementById('ret-mes');
    if(!state.retMes) state.retMes = todayStr().slice(0,7);
    if(mi.value!==state.retMes) mi.value = state.retMes;
    var lista = retencionesDelMes(state.retMes, true);
    body.innerHTML = '';
    if(!state.ganRegimenes.length){ body.innerHTML = '<tr class="day-row empty"><td colspan="9">Para usar retenciones falta correr el schema.sql nuevo en Supabase.</td></tr>'; return; }
    if(!lista.length){ body.innerHTML = '<tr class="day-row empty"><td colspan="9">No hay retenciones en ese mes.</td></tr>'; }
    var total = 0;
    var vigentes = 0;
    lista.forEach(function(x){
      var prov = state.proveedores.find(function(p){ return p.id===x.op.proveedorId; }) || {};
      var anul = esAnulado(x.op);
      if(!anul){ total += Number(x.e.importe||0); vigentes++; }
      var tr = document.createElement('tr');
      tr.className = 'day-row'+(anul ? ' anulado' : '');
      if(anul) tr.title = 'Certificado anulado — '+anulacionTexto(x.op);
      tr.innerHTML = '<td class="num">'+esc(x.op.fecha||'')+'</td><td class="num">'+certNumeroLabel(x.e.certificado)+'</td><td class="num">'+esc(pagoNumeroLabel(x.op.numero))+'</td>'
        +'<td>'+esc(prov.nombre||'')+'</td><td class="num">'+esc(prov.cuit||'')+'</td><td class="num">'+(x.e.impuesto==='iva' ? 'IVA · ' : '')+esc(String(x.e.regimen))+'</td>'
        +'<td class="num">'+fmtMoney(x.e.base)+'</td><td class="num"><b>'+fmtMoney(x.e.importe)+'</b></td>'
        +(anul ? '<td><span class="oc-badge anulada">Anulado</span></td>' : '<td><button type="button" class="btn">🖨</button></td>');
      if(!anul) tr.querySelector('button').addEventListener('click', function(ev){ ev.stopPropagation(); imprimirCertificado(x.op, x.e); });
      tr.addEventListener('click', function(){ openPagoModal(x.op.id); });
      body.appendChild(tr);
    });
    document.getElementById('ret-resumen').textContent = vigentes ? vigentes+' · '+fmtMoney(total) : '';
  }
  document.getElementById('ret-mes').addEventListener('change', function(){ state.retMes = this.value || todayStr().slice(0,7); renderRetencionesList(); });
  document.getElementById('ret-csv').addEventListener('click', function(){
    var lista = retencionesDelMes(state.retMes);
    if(!lista.length){ showToast('No hay retenciones en ese mes.'); return; }
    var num = function(n){ return (Math.round(Number(n||0)*100)/100).toFixed(2).replace('.',','); };
    var q = function(t){ return '"'+String(t==null?'':t).replace(/"/g,'""')+'"'; };
    var rows = [['Fecha','Certificado','Orden de pago','Proveedor','CUIT','Condición','Impuesto','Régimen','Descripción régimen','Importe neto pagado','Pagos anteriores del mes','Retenido anteriormente','Importe retenido'].map(q).join(';')];
    lista.forEach(function(x){
      var prov = state.proveedores.find(function(p){ return p.id===x.op.proveedorId; }) || {};
      var reg = regimenByCodigo(x.e.regimen);
      rows.push([x.op.fecha, certNumeroLabel(x.e.certificado), pagoNumeroLabel(x.op.numero), prov.nombre, prov.cuit, GAN_COND_LABEL[x.e.condicion]||x.e.condicion,
        impuestoLabel(x.e), x.e.regimen, reg ? reg.descripcion : ''].map(q).concat([num(x.e.base), num(x.e.acum_prev), num(x.e.ret_prev), num(x.e.importe)]).join(';'));
    });
    var blob = new Blob(['﻿'+rows.join('\r\n')], {type:'text/csv;charset=utf-8'});
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'retenciones-'+state.retMes+'.csv';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); }, 500);
  });

  // ---------- ⚙ → Tesorería → Retenciones ----------
  function renderRetencionesSettings(){
    var ag = state.agente || {};
    document.getElementById('ag-razon').value = ag.razon_social||'';
    document.getElementById('ag-cuit').value = ag.cuit||'';
    document.getElementById('ag-domicilio').value = ag.domicilio||'';
    document.getElementById('ag-localidad').value = [ag.localidad, ag.provincia].filter(Boolean).join(', ');
    var body = document.getElementById('gan-reg-body');
    body.innerHTML = '';
    if(!state.ganRegimenes.length){ body.innerHTML = '<tr class="day-row empty"><td colspan="9">Falta correr el schema.sql nuevo en Supabase.</td></tr>'; }
    var inp = function(cls, v){ return '<input type="text" inputmode="decimal" class="'+cls+'" value="'+(v==null?'':String(v).replace('.',','))+'">'; };
    state.ganRegimenes.forEach(function(r){
      var tr = document.createElement('tr');
      tr.dataset.codigo = r.codigo;
      tr.innerHTML = '<td class="num">'+r.codigo+'</td><td class="desc">'+esc(r.descripcion)+(r.escala ? ' <span class="fm-hint">(escala '+esc(r.escala)+')</span>' : '')+(r.ivaPct ? ' <span class="fm-hint">(+ retención de IVA '+String(r.ivaPct).replace('.',',')+'%)</span>' : '')+'</td>'
        +'<td>'+inp('ai', r.alicInsc)+'</td><td>'+inp('an', r.alicNoInsc)+'</td><td>'+inp('aph', r.alicNoInscPH)+'</td>'
        +'<td>'+inp('mn', r.mnsr)+'</td><td>'+inp('mi', r.minInsc)+'</td><td>'+inp('mni', r.minNoInsc)+'</td>'
        +'<td><input type="checkbox" class="act"'+(r.activo?' checked':'')+'></td>';
      body.appendChild(tr);
    });
    var box = document.getElementById('gan-escalas');
    box.innerHTML = '';
    ['general','119'].forEach(function(nombre){
      var tramos = state.ganEscalas.filter(function(t){ return t.escala===nombre; });
      if(!tramos.length) return;
      var html = '<div><div class="fm-hint" style="margin-bottom:4px; font-size:12.5px;">'+(nombre==='general' ? 'Escala general (códigos 25, 110, 116, 124)' : 'Escala del código 119')+'</div>'
        +'<table class="day-table" data-escala="'+nombre+'"><thead><tr><th>Más de $</th><th>Hasta $</th><th>Fijo $</th><th>Más el %</th></tr></thead><tbody>';
      tramos.forEach(function(t){
        html += '<tr data-desde="'+t.desde+'"><td class="num">'+fmtMontoInput(t.desde)+'</td><td class="num">'+(t.hasta==null ? 'en adelante' : fmtMontoInput(t.hasta))+'</td>'
          +'<td><input type="text" inputmode="decimal" class="fj" value="'+fmtMontoInput(t.fijo)+'"></td><td><input type="text" inputmode="decimal" class="pc" value="'+fmtMontoInput(t.pct)+'"></td></tr>';
      });
      box.insertAdjacentHTML('beforeend', html+'</tbody></table></div>');
    });
  }
  document.getElementById('ag-save').addEventListener('click', function(){
    if(!state.schemaV3){ showToast('Falta correr el schema.sql nuevo en Supabase.'); return; }
    var loc = document.getElementById('ag-localidad').value.split(',');
    var v = {razon_social:document.getElementById('ag-razon').value.trim(), cuit:document.getElementById('ag-cuit').value.trim(),
      domicilio:document.getElementById('ag-domicilio').value.trim(), localidad:(loc[0]||'').trim(), provincia:loc.slice(1).join(',').trim()};
    state.sb.from('parametros').upsert({id:'agente_retencion', valor:v}).then(function(res){
      if(res.error){ showToast('No se pudo guardar: '+res.error.message); return; }
      state.agente = v; showToast('Datos del agente guardados.');
    });
  });
  document.getElementById('gan-save').addEventListener('click', function(){
    if(!state.schemaV3){ showToast('Falta correr el schema.sql nuevo en Supabase.'); return; }
    var num = function(el){ var t = el.value.trim(); if(t==='') return null; var n = parseMontoInput(t); return isNaN(n) ? null : n; };
    var filas = [];
    document.querySelectorAll('#gan-reg-body tr[data-codigo]').forEach(function(tr){
      var r = regimenByCodigo(tr.dataset.codigo); if(!r) return;
      var n = {alicInsc:num(tr.querySelector('.ai')), alicNoInsc:num(tr.querySelector('.an')), alicNoInscPH:num(tr.querySelector('.aph')),
        mnsr:num(tr.querySelector('.mn'))||0, minInsc:num(tr.querySelector('.mi'))||0, minNoInsc:num(tr.querySelector('.mni'))||0, activo:tr.querySelector('.act').checked};
      if(n.alicInsc==null && !r.escala) n.alicInsc = 0;
      Object.assign(r, n);
      filas.push({codigo:r.codigo, descripcion:r.descripcion, escala:r.escala||null, alic_insc:r.escala && n.alicInsc==null ? null : n.alicInsc,
        alic_no_insc:n.alicNoInsc, alic_no_insc_ph:n.alicNoInscPH, mnsr:n.mnsr, mnsr_no_insc:r.mnsrNoInsc, min_insc:n.minInsc, min_no_insc:n.minNoInsc, activo:n.activo, orden:r.orden||0});
    });
    var esc2 = [];
    document.querySelectorAll('#gan-escalas table').forEach(function(tb){
      tb.querySelectorAll('tbody tr').forEach(function(tr){
        var t = state.ganEscalas.find(function(x){ return x.escala===tb.dataset.escala && x.desde===Number(tr.dataset.desde); }); if(!t) return;
        t.fijo = num(tr.querySelector('.fj'))||0; t.pct = num(tr.querySelector('.pc'))||0;
        esc2.push({escala:t.escala, desde:t.desde, hasta:t.hasta, fijo:t.fijo, pct:t.pct});
      });
    });
    Promise.all([state.sb.from('gan_regimenes').upsert(filas), esc2.length ? state.sb.from('gan_escalas').upsert(esc2) : Promise.resolve({})]).then(function(rs){
      var err = rs.find(function(r){ return r && r.error; });
      if(err){ showToast('No se pudo guardar: '+err.error.message); return; }
      showToast('Regímenes y escalas guardados.');
    });
  });

  // ---------- Submenús de Compras / Pagos / Tesorería ----------
  // Cada vista tiene sus secciones en <section class="subsec" data-sub>; se
  // muestra una a la vez y se recuerda la última elegida en el navegador.
  function subtabActual(view){
    var secs = document.querySelectorAll('#view-'+view+' .subsec');
    var guardada = null;
    try{ guardada = localStorage.getItem('subtab_'+view); }catch(e){}
    var ids = Array.prototype.map.call(secs, function(x){ return x.dataset.sub; });
    return ids.indexOf(guardada)!==-1 ? guardada : ids[0];
  }
  function mostrarSubtab(view, sub){
    try{ localStorage.setItem('subtab_'+view, sub); }catch(e){}
    document.querySelectorAll('#view-'+view+' .subsec').forEach(function(x){ x.hidden = x.dataset.sub!==sub; });
    document.querySelectorAll('#subtabs-'+view+' .stabbtn').forEach(function(b){ b.classList.toggle('active', b.dataset.sub===sub); });
  }
  function armarSubtabs(view){
    var bar = document.getElementById('subtabs-'+view);
    if(!bar) return;
    bar.innerHTML = '';
    document.querySelectorAll('#view-'+view+' .subsec').forEach(function(sec){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'stabbtn'; b.dataset.sub = sec.dataset.sub;
      b.innerHTML = esc(sec.dataset.label)+'<span class="cnt"></span>';
      b.addEventListener('click', function(){ mostrarSubtab(view, sec.dataset.sub); });
      bar.appendChild(b);
    });
    mostrarSubtab(view, subtabActual(view));
  }
  // El submenú de cada pestaña vive en la segunda fila del menú (estilo RR.HH.).
  ['compras','pagos','tesoreria','tableros'].forEach(function(v){
    var bar = document.getElementById('subtabs-'+v);
    if(bar){ bar.hidden = true; document.getElementById('menu-sub').appendChild(bar); }
  });
  function actualizarMenuSub(v){
    var algun = false;
    ['compras','pagos','tesoreria','tableros'].forEach(function(x){
      var bar = document.getElementById('subtabs-'+x);
      if(!bar) return;
      bar.hidden = (x!==v) || !bar.children.length;
      if(!bar.hidden) algun = true;
    });
    document.getElementById('menu-sub').hidden = !algun;
  }
  ['compras','pagos','tesoreria'].forEach(armarSubtabs);
  // Contadores al lado de cada submenú (lo pendiente de cada cosa).
  function actualizarSubtabs(){
    function cnt(view, sub, n){
      var el = document.querySelector('#subtabs-'+view+' .stabbtn[data-sub="'+sub+'"] .cnt');
      if(el) el.textContent = n ? '('+n+')' : '';
    }
    cnt('compras', 'proveedores', state.proveedores.length);
    cnt('compras', 'ocs', state.ordenesCompra.filter(function(o){ return o.estado==='pendiente'; }).length);
    cnt('compras', 'articulos', state.articulos.filter(function(a){ return a.activo; }).length);
    var enOP = {};
    state.ordenesPago.forEach(function(p){ if(noAnulado(p)) (p.facturaIds||[]).forEach(function(fid){ enOP[fid] = true; }); });
    cnt('pagos', 'sugerencia', state.facturas.filter(function(f){ return f.estado==='pendiente' && !enOP[f.id] && Number(f.monto||0)!==0; }).length);
    cnt('pagos', 'facturas', state.facturas.filter(function(f){ return f.estado==='pendiente'; }).length);
    cnt('pagos', 'ordenes', state.ordenesPago.filter(function(p){ return p.estado==='pendiente'; }).length);
    cnt('pagos', 'retenciones', 0);
    cnt('tesoreria', 'cuentas', 0);
    cnt('tesoreria', 'cheques', chequesEnCartera().length);
  }

  // ---------- Sugerencia de pagos ----------
  // Propone qué facturas pagar con la plata disponible: primero las de
  // proveedores prioritarios (★ en la ficha), después las más viejas. Solo
  // toma facturas pendientes que no estén ya en una orden de pago.
  function sugLeerLS(k, def){ try{ var v = localStorage.getItem(k); return v==null ? def : JSON.parse(v); }catch(e){ return def; } }
  function sugGuardarLS(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function sugFondos(){
    var excl = sugLeerLS('sug_excl', {});
    var fondos = state.cuentas.filter(function(c){ return c.tipo!=='cartera'; })
      .sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); })
      .map(function(c){ return {id:c.id, nombre:c.nombre, saldo:cuentaSaldoProyectado(c.id), on:!excl[c.id]}; }); // descuenta cheques propios a debitar
    var cartera = chequesEnCartera().reduce(function(t,c){ return t+Number(c.importe||0); }, 0);
    if(cartera>0 || state.cheques.length) fondos.push({id:'__cheques__', nombre:'Cheques en cartera', saldo:cartera, on:!excl.__cheques__});
    // Lo ya comprometido en órdenes de pago pendientes (todavía no salió de
    // ninguna cuenta) se resta.
    var comprometido = state.ordenesPago.filter(function(p){ return p.estado==='pendiente'; }).reduce(function(t,p){ return t+Number(p.monto||0); }, 0);
    if(comprometido>0) fondos.push({id:'__ops__', nombre:'− Órdenes de pago pendientes', saldo:-comprometido, on:!excl.__ops__});
    return fondos;
  }
  function sugCandidatas(){
    var enOP = {};
    state.ordenesPago.forEach(function(p){ if(noAnulado(p)) (p.facturaIds||[]).forEach(function(fid){ enOP[fid] = true; }); });
    var prio = {};
    state.proveedores.forEach(function(p){ if(p.prioritario) prio[p.id] = true; });
    return state.facturas.filter(function(f){ return f.estado==='pendiente' && !enOP[f.id] && Number(f.monto||0)!==0; })
      .map(function(f){ return {f:f, prio:!!prio[f.proveedorId]}; })
      .sort(function(a,b){
        if(a.prio!==b.prio) return a.prio ? -1 : 1;
        var fa = a.f.fecha||'9999', fb = b.f.fecha||'9999';
        if(fa!==fb) return fa.localeCompare(fb);
        return Number(a.f.monto||0)-Number(b.f.monto||0);
      });
  }
  function sugDias(fecha){
    if(!fecha) return null;
    var d = new Date(fecha+'T00:00:00'), h = new Date(todayStr()+'T00:00:00');
    return Math.round((h-d)/86400000);
  }
  function renderSugerenciaPagos(){
    var box = document.getElementById('sug-box');
    if(!box) return;
    box.classList.toggle('cerrado', !!sugLeerLS('sug_cerrado', false));
    var fondos = sugFondos();
    var disponible = Math.max(0, fondos.reduce(function(t,x){ return t+(x.on ? x.saldo : 0); }, 0));
    var monto = state.sugMonto!=null ? state.sugMonto : disponible;

    var fw = document.getElementById('sug-fondos');
    fw.innerHTML = '';
    if(!fondos.length) fw.innerHTML = '<span class="sug-sub" style="margin:0;">No hay cuentas cargadas en Tesorería: escribí el monto a destinar.</span>';
    fondos.forEach(function(x){
      var lab = document.createElement('label');
      lab.className = 'sug-fondo'+(x.saldo<0?' neg':'');
      if(x.id==='__ops__') lab.title = 'Órdenes de pago creadas y todavía no pagadas: esa plata ya está comprometida.';
      lab.innerHTML = '<input type="checkbox"'+(x.on?' checked':'')+'> '+esc(x.nombre)+' <b>'+fmtMoney(x.id==='__ops__' ? -x.saldo : x.saldo)+'</b>';
      lab.querySelector('input').addEventListener('change', function(){
        var excl = sugLeerLS('sug_excl', {});
        if(this.checked) delete excl[x.id]; else excl[x.id] = true;
        sugGuardarLS('sug_excl', excl);
        state.sugMonto = null; state.sugManual = {};
        renderSugerenciaPagos();
      });
      fw.appendChild(lab);
    });
    var mi = document.getElementById('sug-monto');
    if(document.activeElement!==mi) mi.value = Number(monto||0).toLocaleString('es-AR', {maximumFractionDigits:2});

    // Selección automática: en orden, cada factura que entra en lo que queda.
    var cands = sugCandidatas();
    var resto = monto;
    cands.forEach(function(c){
      var m = Number(c.f.monto||0);
      c.auto = m<=resto+0.004;
      if(c.auto) resto -= m;
      c.sel = state.sugManual.hasOwnProperty(c.f.id) ? state.sugManual[c.f.id] : c.auto;
    });
    var totalSel = cands.reduce(function(t,c){ return t+(c.sel ? Number(c.f.monto||0) : 0); }, 0);
    var nSel = cands.filter(function(c){ return c.sel; }).length;
    var totalPend = cands.reduce(function(t,c){ return t+Number(c.f.monto||0); }, 0);

    // Agrupado por proveedor, en el orden en que aparece cada uno.
    var grupos = [], porProv = {};
    cands.forEach(function(c){
      var g = porProv[c.f.proveedorId];
      if(!g){ g = porProv[c.f.proveedorId] = {id:c.f.proveedorId, prio:c.prio, items:[]}; grupos.push(g); }
      g.items.push(c);
    });
    var conSel = grupos.filter(function(g){ return g.items.some(function(c){ return c.sel; }); });
    var sinSel = grupos.filter(function(g){ return !g.items.some(function(c){ return c.sel; }); });
    var mostrar = state.sugVerTodo ? conSel.concat(sinSel) : conSel.concat(sinSel.slice(0, 8));

    var tb = document.getElementById('sug-tbody');
    tb.innerHTML = '';
    if(!cands.length) tb.innerHTML = '<tr class="day-row empty"><td colspan="6">No hay facturas pendientes fuera de una orden de pago.</td></tr>';
    mostrar.forEach(function(g){
      var sub = g.items.reduce(function(t,c){ return t+(c.sel ? Number(c.f.monto||0) : 0); }, 0);
      var trh = document.createElement('tr');
      trh.className = 'sug-prov';
      trh.innerHTML = '<td></td><td colspan="4">'+(g.prio?'<span class="sug-star">★</span> ':'')+esc(proveedorNombre(g.id))+'</td><td class="num">'+(sub ? fmtMoney(sub) : '')+'</td>';
      tb.appendChild(trh);
      g.items.forEach(function(c){
        var f = c.f, dias = sugDias(f.fecha);
        var tr = document.createElement('tr');
        tr.className = 'day-row'+(c.sel ? '' : ' sug-nocabe');
        tr.innerHTML = '<td><input type="checkbox"'+(c.sel?' checked':'')+'></td>'
          +'<td></td>'
          +'<td class="num">'+esc(f.numero||'—')+'</td>'
          +'<td class="num">'+esc(f.fecha||'—')+'</td>'
          +'<td class="num">'+(dias==null ? '—' : dias+' días')+'</td>'
          +'<td class="num">'+fmtMoney(f.monto)+(!c.auto && !c.sel ? '<span class="sug-tag">no alcanza</span>' : '')+'</td>';
        tr.querySelector('input').addEventListener('change', function(){
          if(!canEdit('pagos')){ this.checked = !this.checked; return; }
          state.sugManual[f.id] = this.checked;
          renderSugerenciaPagos();
        });
        tr.children[2].style.cursor = 'pointer';
        tr.children[2].addEventListener('click', function(){ openFacturaModal(f.id); });
        tb.appendChild(tr);
      });
    });
    if(!state.sugVerTodo && sinSel.length>8){
      var trm = document.createElement('tr');
      trm.className = 'day-row';
      trm.innerHTML = '<td colspan="6" style="text-align:center;"><button type="button" class="btn">Mostrar todas las pendientes ('+(sinSel.length-8)+' proveedores más)</button></td>';
      trm.querySelector('button').addEventListener('click', function(){ state.sugVerTodo = true; renderSugerenciaPagos(); });
      tb.appendChild(trm);
    }

    var queda = monto - totalSel;
    document.getElementById('sug-total').innerHTML = 'Seleccionado: <b>'+fmtMoney(totalSel)+'</b> en '+nSel+' factura'+(nSel===1?'':'s')
      +' · Queda: <b class="'+(queda<0?'neg':'')+'">'+fmtMoney(queda)+'</b>';
    document.getElementById('sug-resumen').textContent = cands.length
      ? 'Pendiente sin orden de pago: '+fmtMoney(totalPend)+' · Alcanza para '+nSel+' de '+cands.length+' facturas'
      : '';
    var proveedoresSel = conSel.length;
    var btn = document.getElementById('sug-crear');
    btn.disabled = !nSel;
    btn.textContent = nSel ? 'Crear '+proveedoresSel+(proveedoresSel===1?' orden':' órdenes')+' de pago' : 'Crear órdenes de pago';
    state.sugGrupos = conSel;
  }
  document.getElementById('sug-toggle').addEventListener('click', function(){
    sugGuardarLS('sug_cerrado', !sugLeerLS('sug_cerrado', false));
    renderSugerenciaPagos();
  });
  function sugAplicarMonto(){
    var v = parseMontoInput(document.getElementById('sug-monto').value);
    state.sugMonto = isNaN(v) ? null : Math.max(0, v);
    state.sugManual = {};
    renderSugerenciaPagos();
  }
  document.getElementById('sug-recalc').addEventListener('click', sugAplicarMonto);
  document.getElementById('sug-monto').addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); this.blur(); sugAplicarMonto(); } });
  // Una orden de pago pendiente por proveedor con sus facturas tildadas. El
  // concepto de pago y la cuenta se eligen después, al marcarla como pagada.
  document.getElementById('sug-crear').addEventListener('click', function(){
    if(!canEdit('pagos')) return;
    var grupos = (state.sugGrupos||[]).map(function(g){
      return {proveedorId:g.id, facturas:g.items.filter(function(c){ return c.sel; }).map(function(c){ return c.f; })};
    }).filter(function(g){ return g.facturas.length; });
    if(!grupos.length) return;
    var total = grupos.reduce(function(t,g){ return t+g.facturas.reduce(function(s,f){ return s+Number(f.monto||0); },0); }, 0);
    if(!window.confirm('Se van a crear '+grupos.length+' órdenes de pago pendientes por '+fmtMoney(total)+'. ¿Seguimos?')) return;
    var hoy = todayStr(), quien = whoName();
    grupos.forEach(function(g){
      var numero = nextPagoNumero();
      var p = {
        id:'op_'+numero, numero:numero, proveedorId:g.proveedorId,
        facturaIds:g.facturas.map(function(f){ return f.id; }),
        fecha:hoy, monto:g.facturas.reduce(function(s,f){ return s+Number(f.monto||0); },0),
        medioPago:'transferencia', medioId:'', chequeIds:[], estado:'pendiente', cuentaId:'',
        notas:'Creada desde la sugerencia de pagos', who:quien
      };
      state.ordenesPago.push(p);
      writePago(p);
    });
    state.sugManual = {}; state.sugMonto = null;
    renderPagos();
    mostrarSubtab('pagos', 'ordenes');
    showToast(grupos.length+' órdenes de pago creadas como pendientes. Para pagarlas, abrilas y marcalas como pagadas.', 6000);
  });

  // ---------- Artículos (base para Stock) ----------
  function mapArticuloRow(row){
    return {id:row.id, codigo:row.codigo||'', descripcion:row.descripcion||'', unidad:row.unidad||'Unidad',
            categoria:row.categoria||'', activo:row.activo!==false, notas:row.notas||''};
  }
  function articuloById(id){ return state.articulos.find(function(a){ return a.id===id; }) || null; }
  function articuloLabel(a){ return a ? ((a.codigo ? a.codigo+' · ' : '')+a.descripcion) : ''; }
  function proveedorLlevaArticulos(provId){ var p = state.proveedores.find(function(x){ return x.id===provId; }); return !!(p && p.llevaArticulos); }
  function nextArticuloCodigo(){
    var max = 0;
    state.articulos.forEach(function(a){ if(/^\d+$/.test(a.codigo||'')) max = Math.max(max, Number(a.codigo)); });
    return String(max+1).padStart(5, '0');
  }
  // Compras de un artículo en facturas no anuladas: cantidad total y último precio.
  function articuloCompras(id, proveedorId){
    var tot = 0, ult = null;
    state.facturas.forEach(function(f){
      if(esAnulado(f)) return;
      (f.articulos||[]).forEach(function(l){
        if(l.articuloId!==id) return;
        tot += Number(l.cantidad)||0;
        var prio = proveedorId && f.proveedorId===proveedorId ? 1 : 0;
        if(!ult || prio>ult.prio || (prio===ult.prio && (f.fecha||'')>=(ult.fecha||''))) ult = {precio:l.precio, fecha:f.fecha, prio:prio, proveedorId:f.proveedorId};
      });
    });
    return {cantidad:tot, ultimo:ult};
  }
  function fmtCant(n){ return (Math.round((Number(n)||0)*1000)/1000).toLocaleString('es-AR', {maximumFractionDigits:3}); }
  function renderArticulosList(){
    var body = document.getElementById('articulos-body');
    if(!body) return;
    var q = normTxt(state.articulosBusqueda), f = state.articulosFiltro;
    var list = state.articulos.filter(function(a){
      if(f==='activos' && !a.activo) return false;
      if(f==='inactivos' && a.activo) return false;
      return !q || normTxt(a.codigo+' '+a.descripcion+' '+a.categoria).indexOf(q)!==-1;
    }).sort(function(a,b){ return (a.descripcion||'').localeCompare(b.descripcion||''); });
    document.getElementById('articulos-count').textContent = state.articulos.length ? '('+state.articulos.length+')' : '';
    body.innerHTML = '';
    if(!state.tablaArticulos){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">Para usar artículos falta correr <b>base-de-datos/articulos.sql</b> en Supabase.</td></tr>';
      return;
    }
    if(!list.length){
      body.innerHTML = '<tr class="day-row empty"><td colspan="6">'+(state.articulos.length ? 'Ningún artículo coincide con la búsqueda.' : 'Todavía no hay artículos. Cargalos con “+ Nuevo artículo” o desde la factura de un proveedor que carga artículos.')+'</td></tr>';
      return;
    }
    list.slice(0, 300).forEach(function(a){
      var c = articuloCompras(a.id);
      var tr = document.createElement('tr');
      tr.className = 'day-row'+(a.activo ? '' : ' art-inactivo');
      tr.innerHTML = '<td class="num">'+esc(a.codigo||'—')+'</td>'
        +'<td class="day-route">'+esc(a.descripcion)+(a.activo ? '' : ' <span class="fm-hint">(inactivo)</span>')+'</td>'
        +'<td>'+esc(a.unidad)+'</td>'
        +'<td>'+esc(a.categoria||'—')+'</td>'
        +'<td class="num">'+(c.cantidad ? fmtCant(c.cantidad)+' '+esc(a.unidad.toLowerCase()) : '—')+'</td>'
        +'<td class="num">'+(c.ultimo ? fmtMoney(c.ultimo.precio)+' <span class="fm-hint">'+esc(c.ultimo.fecha||'')+'</span>' : '—')+'</td>';
      tr.addEventListener('click', function(){ openArticuloModal(a.id); });
      body.appendChild(tr);
    });
  }
  document.getElementById('articulos-search').addEventListener('input', function(){ state.articulosBusqueda = this.value; renderArticulosList(); });
  document.getElementById('articulos-filter').addEventListener('change', function(){ state.articulosFiltro = this.value; renderArticulosList(); });

  function writeArticulo(a){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return Promise.resolve(false); }
    return state.sb.from('articulos').upsert({id:a.id, codigo:a.codigo||'', descripcion:a.descripcion, unidad:a.unidad||'Unidad',
      categoria:a.categoria||'', activo:a.activo!==false, notas:a.notas||''}).then(function(res){
      if(res.error){
        showToast(/duplicate|unique/i.test(res.error.message) ? 'Ya hay otro artículo con el código '+a.codigo+'.' : 'No se pudo guardar el artículo: '+res.error.message, 6000);
        return false;
      }
      return true;
    });
  }
  // desdeLinea: índice de la línea de la factura que espera el artículo nuevo
  function openArticuloModal(id, opts){
    if(!state.tablaArticulos){ showToast('Para usar artículos falta correr base-de-datos/articulos.sql en Supabase.', 6000); return; }
    opts = opts || {};
    state.editingArticuloId = id || null;
    state.artParaLinea = opts.desdeLinea==null ? null : opts.desdeLinea;
    var a = id ? articuloById(id) : null;
    document.getElementById('artm-title').textContent = a ? 'Editar artículo' : 'Nuevo artículo';
    document.getElementById('artm-codigo').value = a ? a.codigo : '';
    document.getElementById('artm-codigo').placeholder = 'Automático: '+nextArticuloCodigo();
    document.getElementById('artm-descripcion').value = a ? a.descripcion : (opts.descripcion||'');
    document.getElementById('artm-unidad').value = a ? a.unidad : 'Unidad';
    if(a && document.getElementById('artm-unidad').value!==a.unidad) setSelectValueLoose('artm-unidad', a.unidad);
    document.getElementById('artm-categoria').value = a ? a.categoria : '';
    document.getElementById('artm-notas').value = a ? a.notas : '';
    document.getElementById('artm-activo').checked = a ? a.activo : true;
    var cats = {}; state.articulos.forEach(function(x){ if(x.categoria) cats[x.categoria] = true; });
    document.getElementById('artm-categorias').innerHTML = Object.keys(cats).sort().map(function(c){ return '<option value="'+esc(c)+'">'; }).join('');
    var uso = a ? articuloCompras(a.id) : null;
    var nFact = a ? state.facturas.filter(function(f){ return (f.articulos||[]).some(function(l){ return l.articuloId===a.id; }); }).length : 0;
    document.getElementById('artm-uso').textContent = a ? (nFact ? 'Está en '+nFact+' factura'+(nFact===1?'':'s')+' · comprado: '+fmtCant(uso.cantidad)+' '+a.unidad.toLowerCase()+(uso.ultimo ? ' · último precio '+fmtMoney(uso.ultimo.precio) : '') : 'Todavía no está en ninguna factura.') : '';
    document.getElementById('artm-delete').style.display = a ? '' : 'none';
    document.getElementById('articulo-overlay').classList.add('show');
    setTimeout(function(){ try{ document.getElementById(a ? 'artm-descripcion' : (opts.descripcion ? 'artm-categoria' : 'artm-descripcion')).focus(); }catch(e){} }, 30);
  }
  function closeArticuloModal(){ document.getElementById('articulo-overlay').classList.remove('show'); state.artParaLinea = null; }
  document.getElementById('new-articulo-btn').addEventListener('click', function(){ openArticuloModal(null); });
  document.getElementById('artm-cancel').addEventListener('click', closeArticuloModal);
  document.getElementById('artm-save').addEventListener('click', function(){
    var desc = document.getElementById('artm-descripcion').value.trim();
    if(!desc){ showToast('Escribí la descripción del artículo.'); return; }
    var id = state.editingArticuloId;
    var codigo = document.getElementById('artm-codigo').value.trim() || (id ? (articuloById(id)||{}).codigo || '' : nextArticuloCodigo());
    var dup = state.articulos.find(function(x){ return x.id!==id && codigo && normTxt(x.codigo)===normTxt(codigo); });
    if(dup){ showToast('El código '+codigo+' ya es de "'+dup.descripcion+'".'); return; }
    var mismaDesc = state.articulos.find(function(x){ return x.id!==id && normTxt(x.descripcion)===normTxt(desc); });
    if(mismaDesc && !id && !confirm('Ya existe "'+articuloLabel(mismaDesc)+'". ¿Crear otro igual de todos modos?')) return;
    var a = {id: id || newId('art_'), codigo:codigo, descripcion:desc, unidad:document.getElementById('artm-unidad').value,
      categoria:document.getElementById('artm-categoria').value.trim(), notas:document.getElementById('artm-notas').value.trim(),
      activo:document.getElementById('artm-activo').checked};
    var linea = state.artParaLinea;
    var btn = this; btn.disabled = true;
    writeArticulo(a).then(function(ok){
      if(!ok) return;
      var i = state.articulos.findIndex(function(x){ return x.id===a.id; });
      if(i>=0) state.articulos[i] = a; else state.articulos.push(a);
      closeArticuloModal();
      renderArticulosList(); actualizarSubtabs();
      if(linea!=null && state.editingFacturaArts && state.editingFacturaArts[linea]){
        state.editingFacturaArts[linea].articuloId = a.id;
        state.editingFacturaArts[linea].texto = '';
      }
      if(document.getElementById('factura-overlay').classList.contains('show')) renderFacturaArts();
      showToast('Artículo '+(id ? 'guardado' : 'creado')+': '+articuloLabel(a));
    }).finally(function(){ btn.disabled = false; });
  });
  document.getElementById('artm-delete').addEventListener('click', function(){
    var a = articuloById(state.editingArticuloId);
    if(!a) return;
    var usado = state.facturas.some(function(f){ return (f.articulos||[]).some(function(l){ return l.articuloId===a.id; }); });
    if(usado){ showToast('No se puede eliminar: está en facturas. Destildá "Activo" para que no se ofrezca más.', 6000); return; }
    if(!confirm('¿Eliminar el artículo "'+articuloLabel(a)+'"?')) return;
    state.articulos = state.articulos.filter(function(x){ return x.id!==a.id; });
    if(state.sb) state.sb.from('articulos').delete().eq('id', a.id).then(function(res){ if(res.error) showToast('No se pudo eliminar: '+res.error.message); });
    closeArticuloModal(); renderArticulosList(); actualizarSubtabs();
    showToast('Artículo eliminado.');
  });

  // ---- Artículos dentro de la factura ----
  function facturaArtsVisible(){
    var prov = document.getElementById('fm-proveedor').value;
    return proveedorLlevaArticulos(prov) || (state.editingFacturaArts||[]).some(function(l){ return l.articuloId; });
  }
  function artBuscar(texto){
    var t = normTxt(texto);
    if(!t) return null;
    return state.articulos.find(function(a){ return normTxt(articuloLabel(a))===t; })
      || state.articulos.find(function(a){ return a.codigo && normTxt(a.codigo)===t; })
      || state.articulos.find(function(a){ return normTxt(a.descripcion)===t; }) || null;
  }
  function artImporte(l){ return r2((Number(l.cantidad)||0)*(Number(l.precio)||0)); }
  function renderFacturaArts(){
    var box = document.getElementById('fm-articulos');
    var ver = facturaArtsVisible();
    box.hidden = !ver;
    if(!ver) return;
    if(!state.editingFacturaArts || !state.editingFacturaArts.length) state.editingFacturaArts = [{articuloId:'', cantidad:0, precio:0, importe:0}];
    var prov = document.getElementById('fm-proveedor').value;
    document.getElementById('fm-art-datalist').innerHTML = state.articulos.filter(function(a){ return a.activo; })
      .sort(function(a,b){ return (a.descripcion||'').localeCompare(b.descripcion||''); })
      .map(function(a){ return '<option value="'+esc(articuloLabel(a))+'">'; }).join('');
    var cont = document.getElementById('fm-art-lines');
    cont.innerHTML = '<div class="art-head"><span>Artículo</span><span>Cantidad</span><span>Unidad</span><span>Precio unit.</span><span>Importe</span><span></span></div>';
    state.editingFacturaArts.forEach(function(l, i){
      var a = articuloById(l.articuloId);
      var row = document.createElement('div');
      row.className = 'art-line'+(l.texto && !a ? ' err' : '');
      row.innerHTML = '<input type="text" class="art" list="fm-art-datalist" placeholder="Buscar por código o descripción…">'
        +'<input type="text" class="cant" inputmode="decimal" placeholder="0">'
        +'<span class="uni">'+esc(a ? a.unidad : '')+'</span>'
        +'<input type="text" class="precio" inputmode="decimal" placeholder="0,00">'
        +'<span class="imp">'+(artImporte(l) ? fmtMoney(artImporte(l)) : '—')+'</span>'
        +'<button type="button" class="del" title="Quitar">✕</button>';
      var inArt = row.querySelector('.art');
      inArt.value = a ? articuloLabel(a) : (l.texto||'');
      row.querySelector('.cant').value = l.cantidad ? String(l.cantidad).replace('.',',') : '';
      row.querySelector('.precio').value = l.precio ? fmtMontoInput(l.precio) : '';
      inArt.addEventListener('change', function(){
        var enc = artBuscar(this.value);
        l.articuloId = enc ? enc.id : '';
        l.texto = enc ? '' : this.value.trim();
        if(enc && !l.precio){ var u = articuloCompras(enc.id, prov).ultimo; if(u) l.precio = u.precio; }
        renderFacturaArts();
        if(enc){ var c = document.querySelectorAll('#fm-art-lines .art-line')[i]; if(c) c.querySelector('.cant').focus(); }
      });
      row.querySelector('.cant').addEventListener('input', function(){ var n = parseMontoInput(this.value); l.cantidad = isNaN(n) ? 0 : n; actualizarArtLinea(row, l); });
      row.querySelector('.precio').addEventListener('input', function(){ var n = parseMontoInput(this.value); l.precio = isNaN(n) ? 0 : n; actualizarArtLinea(row, l); });
      row.querySelector('.del').addEventListener('click', function(){
        state.editingFacturaArts.splice(i, 1);
        renderFacturaArts();
      });
      cont.appendChild(row);
      if(l.texto && !a){
        var aviso = document.createElement('div');
        aviso.className = 'fm-hint';
        aviso.innerHTML = '“'+esc(l.texto)+'” no está en la base. <button type="button" class="link-btn">Crearlo como artículo nuevo</button>';
        aviso.querySelector('button').addEventListener('click', function(){ openArticuloModal(null, {desdeLinea:i, descripcion:l.texto}); });
        cont.appendChild(aviso);
      }
    });
    actualizarArtTotal();
  }
  function actualizarArtLinea(row, l){
    l.importe = artImporte(l);
    row.querySelector('.imp').textContent = l.importe ? fmtMoney(l.importe) : '—';
    actualizarArtTotal();
  }
  function actualizarArtTotal(){
    var el = document.getElementById('fm-art-total');
    if(!el || !state.editingFacturaArts) return;
    var tot = r2(state.editingFacturaArts.reduce(function(s,l){ return s+artImporte(l); }, 0));
    var prov = document.getElementById('fm-proveedor').value;
    var netoTxt = document.getElementById('fm-neto').value.trim();
    var neto = netoTxt ? parseMontoInput(netoTxt) : facturaNetoAuto({proveedorId:prov, monto:facturaMontoActual()});
    var dif = r2(tot - (neto||0));
    el.innerHTML = 'Total artículos <b>'+fmtMoney(tot)+'</b>'+(neto ? ' · neto de la factura '+fmtMoney(neto)
      +(Math.abs(dif)<0.01 ? ' <span style="color:var(--ok, #17a673);">✓</span>' : ' <span class="fm-hint">(diferencia '+(dif>0?'+':'−')+fmtMoney(Math.abs(dif))+': fletes, bonificaciones, percepciones…)</span>') : '');
  }
  document.getElementById('fm-art-add').addEventListener('click', function(){
    state.editingFacturaArts = state.editingFacturaArts || [];
    state.editingFacturaArts.push({articuloId:'', cantidad:0, precio:0, importe:0});
    renderFacturaArts();
    var ls = document.querySelectorAll('#fm-art-lines .art-line .art');
    if(ls.length) ls[ls.length-1].focus();
  });
  document.getElementById('fm-art-nuevo').addEventListener('click', function(){
    state.editingFacturaArts = state.editingFacturaArts || [];
    var i = state.editingFacturaArts.findIndex(function(l){ return !l.articuloId; });
    if(i<0){ state.editingFacturaArts.push({articuloId:'', cantidad:0, precio:0, importe:0}); i = state.editingFacturaArts.length-1; }
    openArticuloModal(null, {desdeLinea:i, descripcion:state.editingFacturaArts[i].texto||''});
  });
  ['fm-monto','fm-neto'].forEach(function(id){ document.getElementById(id).addEventListener('input', actualizarArtTotal); });
  // Devuelve las líneas a guardar, o false si falta algo (ya avisó).
  function facturaArtsParaGuardar(proveedorId){
    var lleva = proveedorLlevaArticulos(proveedorId);
    var lineas = (state.editingFacturaArts||[]).filter(function(l){ return l.articuloId || l.texto || l.cantidad || l.precio; });
    if(!lleva && !lineas.some(function(l){ return l.articuloId; })) return [];
    if(!state.tablaArticulos && !state.colArticulos){ showToast('Este proveedor carga artículos, pero falta correr base-de-datos/articulos.sql en Supabase.', 7000); return false; }
    for(var i=0;i<lineas.length;i++){
      var l = lineas[i];
      if(!l.articuloId){ showToast('Artículo '+(i+1)+': '+(l.texto ? '“'+l.texto+'” no está en la base; crealo con el link de abajo.' : 'elegí el artículo.'), 6000); return false; }
      if(!(l.cantidad>0)){ showToast('Artículo '+(i+1)+' ('+articuloLabel(articuloById(l.articuloId))+'): ingresá la cantidad.'); return false; }
      if(l.precio<0){ showToast('Artículo '+(i+1)+': el precio no puede ser negativo.'); return false; }
    }
    if(lleva && !lineas.length){ showToast('Este proveedor carga artículos: agregá al menos un artículo con su cantidad.', 6000); return false; }
    return lineas.map(function(l){ return {articuloId:l.articuloId, cantidad:Number(l.cantidad), precio:r2(l.precio), importe:artImporte(l)}; });
  }

  function writeFactura(f){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    // Las columnas nuevas (cc_ref, neto, regimen_gan) solo se mandan si ya se
    // corrió el schema.sql nuevo (state.schemaV3), para no romper el guardado.
    state.sb.from('facturas').upsert(Object.assign({
      id:f.id, proveedor_id:f.proveedorId||'', oc_id:f.ocId||null,
      centro_costo_id:f.centroCostoId||null, concepto_id:f.conceptoId||null, numero:f.numero||'',
      fecha:f.fecha||'', monto:f.monto||0, estado:f.estado||'pendiente', notas:f.notas||'', archivos:f.archivos||[],
      items:(f.items||[]).map(function(it){ return {centro_costo_id:it.centroCostoId, concepto_id:it.conceptoId, cc_ref:it.ccRef||'', monto:it.monto||0, detalle:it.detalle||''}; })
    }, state.schemaV3 ? {cc_ref:f.ccRef||'', neto:(f.neto==null ? null : f.neto), regimen_gan:(f.regimenGan||null)} : {},
       (state.colArticulos || state.tablaArticulos) ? {articulos:(f.articulos||[]).map(function(a){ return {articulo_id:a.articuloId, cantidad:a.cantidad, precio:a.precio, importe:a.importe}; })} : {},
       camposAnulacion(f))).then(function(res){
      if(res.error) showToast('No se pudo guardar la factura: '+res.error.message);
    });
  }

  function fillFacturaOCSelect(proveedorId){
    var sel = document.getElementById('fm-oc');
    var actual = (facturaById(state.editingFacturaId)||{}).ocId;
    var ocs = state.ordenesCompra.filter(function(o){ return o.proveedorId===proveedorId && (noAnulado(o) || o.id===actual); })
      .sort(function(a,b){ return (b.numero||0)-(a.numero||0); });
    sel.innerHTML = '<option value="">Sin orden de compra</option>';
    ocs.forEach(function(o){
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = ocNumeroLabel(o.numero)+' — '+(o.descripcion||'(sin descripción)');
      sel.appendChild(opt);
    });
  }
  document.getElementById('fm-proveedor').addEventListener('change', function(){
    fillFacturaOCSelect(this.value);
    if(this.value) aplicarImputacionDefault(this.value);
    renderFacturaImputChips();
    renderFacturaArts();
  });

  // Imputación de la factura: al elegir proveedor se completan solos el
  // centro de costo y el concepto con la combinación más usada de ese
  // proveedor; debajo se muestran sus otras imputaciones como botones para
  // cambiar con un clic (o se cambia a mano en los desplegables).
  function aplicarImputacionDefault(proveedorId){
    if(state.editingFacturaItems) return; // repartida: no se pisan las líneas
    var def = imputacionDefault(proveedorId);
    if(!def) return;
    var ccSel = document.getElementById('fm-centro-costo');
    var coSel = document.getElementById('fm-concepto');
    var ccDef = centroCostoById(def.centroCostoId);
    if(ccDef && ccDef.activo!==false){ ccSel.value = def.centroCostoId; actualizarFmRef(''); }
    if(conceptoById(def.conceptoId)) coSel.value = def.conceptoId;
  }
  function renderFacturaImputChips(){
    var box = document.getElementById('fm-imputaciones');
    var proveedorId = document.getElementById('fm-proveedor').value;
    box.innerHTML = '';
    var list = proveedorId ? imputacionesOrdenadas(proveedorId).filter(function(im){ var c = centroCostoById(im.centroCostoId); return c && c.activo!==false && conceptoById(im.conceptoId); }) : [];
    if(list.length<1){ box.hidden = true; return; }
    var curKey = state.editingFacturaItems ? '' : imputKey(document.getElementById('fm-centro-costo').value, document.getElementById('fm-concepto').value);
    var lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.textContent = state.editingFacturaItems ? 'Agregar línea con una imputación de este proveedor'
      : (list.length>1 ? 'Imputaciones de este proveedor' : 'Imputación de este proveedor');
    box.appendChild(lbl);
    list.forEach(function(im){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'imput-chip'+(imputKey(im.centroCostoId, im.conceptoId)===curKey ? ' on' : '');
      b.textContent = imputLabel(im)+(im.usos ? ' ('+im.usos+')' : '');
      b.addEventListener('click', function(){
        if(state.editingFacturaItems){
          agregarLineaSplit(im.centroCostoId, im.conceptoId);
          return;
        }
        document.getElementById('fm-centro-costo').value = im.centroCostoId;
        document.getElementById('fm-concepto').value = im.conceptoId;
        actualizarFmRef('');
        renderFacturaImputChips();
      });
      box.appendChild(b);
    });
    box.hidden = false;
  }
  function actualizarFmRef(valor){
    var req = ccRequiere(document.getElementById('fm-centro-costo').value);
    var field = document.getElementById('fm-ccref-field');
    field.hidden = !req;
    document.getElementById('fm-ccref-label').textContent = req==='movil' ? 'Móvil' : 'Sucursal';
    var sel = document.getElementById('fm-ccref');
    var v = valor!==undefined ? valor : sel.value;
    sel.innerHTML = ccRefOptionsHtml(req, v);
    if(!req) sel.value = '';
  }
  document.getElementById('fm-centro-costo').addEventListener('change', function(){ actualizarFmRef(''); renderFacturaImputChips(); });
  document.getElementById('fm-concepto').addEventListener('change', renderFacturaImputChips);
  // Si la factura se guarda con una combinación que el proveedor todavía no
  // tenía, se le agrega a su lista de imputaciones.
  // ---------- Factura repartida en varias imputaciones ----------
  function facturaMontoActual(){ var n = parseMontoInput(document.getElementById('fm-monto').value); return isNaN(n) ? 0 : n; }
  function splitAsignado(){ return (state.editingFacturaItems||[]).reduce(function(s,l){ return s+(Number(l.monto)||0); }, 0); }
  function setSplitMode(on){
    if(on){
      var cc = document.getElementById('fm-centro-costo').value;
      var co = document.getElementById('fm-concepto').value;
      var ref = document.getElementById('fm-ccref').value || '';
      state.editingFacturaItems = [{centroCostoId:cc, conceptoId:co, ccRef:ref, monto:facturaMontoActual(), detalle:''},
                                   {centroCostoId:'', conceptoId:'', ccRef:'', monto:0, detalle:''}];
    } else {
      var first = (state.editingFacturaItems||[]).slice().sort(function(a,b){ return (b.monto||0)-(a.monto||0); })[0];
      state.editingFacturaItems = null;
      if(first){
        document.getElementById('fm-centro-costo').value = first.centroCostoId||'';
        document.getElementById('fm-concepto').value = first.conceptoId||'';
        actualizarFmRef(first.ccRef||'');
      }
    }
    renderSplitUI();
  }
  function agregarLineaSplit(ccId, coId){
    var falta = Math.round((facturaMontoActual()-splitAsignado())*100)/100;
    // Si hay una línea vacía (sin imputación), se completa esa en vez de sumar otra.
    var vacia = state.editingFacturaItems.find(function(l){ return !l.centroCostoId && !l.conceptoId; });
    if(vacia){
      vacia.centroCostoId = ccId||''; vacia.conceptoId = coId||'';
      if(!vacia.monto && falta>0) vacia.monto = falta;
    } else {
      state.editingFacturaItems.push({centroCostoId:ccId||'', conceptoId:coId||'', monto: falta>0 ? falta : 0, detalle:''});
    }
    renderSplitUI();
  }
  function coOptionsHtml(sel){
    return '<option value="">Concepto</option>'+state.conceptos.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); })
      .map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('');
  }
  function updateSplitTotal(){
    var el = document.getElementById('fm-split-total');
    if(!state.editingFacturaItems){ el.textContent=''; return; }
    var total = facturaMontoActual(), asig = splitAsignado();
    var diff = Math.round((total-asig)*100)/100;
    var fmt = function(n){ return '$'+Number(n).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2}); };
    if(!total){ el.textContent = 'Repartido: '+fmt(asig)+' (el monto de la factura se completa con este total)'; el.className = 'split-total ok'; return; }
    if(Math.abs(diff)<0.005){ el.textContent = 'Repartido '+fmt(asig)+' de '+fmt(total)+' ✓'; el.className = 'split-total ok'; return; }
    el.textContent = (diff>0 ? 'Falta repartir ' : 'Te pasaste por ')+fmt(Math.abs(diff))+' (repartido '+fmt(asig)+' de '+fmt(total)+')';
    el.className = 'split-total bad';
  }
  function renderSplitUI(){
    var on = !!state.editingFacturaItems;
    document.getElementById('fm-imput-simple').hidden = on;
    document.getElementById('fm-split').hidden = !on;
    document.querySelector('.split-toggle-row').hidden = on;
    var box = document.getElementById('fm-split-lines');
    box.innerHTML = '';
    if(on){
      state.editingFacturaItems.forEach(function(l, i){
        var row = document.createElement('div');
        row.className = 'split-line';
        var reqL = ccRequiere(l.centroCostoId);
        row.innerHTML = '<select class="cc">'+ccOptionsHtml(l.centroCostoId)+'</select>'
          +(reqL ? '<select class="ref">'+ccRefOptionsHtml(reqL, l.ccRef||'')+'</select>' : '')
          +'<select class="co">'+coOptionsHtml(l.conceptoId)+'</select>'
          +'<input type="text" class="detalle" maxlength="80" placeholder="Detalle (opcional)">'
          +'<input type="text" class="monto" inputmode="decimal" placeholder="0,00">'
          +'<button type="button" class="del" title="Quitar línea">✕</button>';
        row.querySelector('.detalle').value = l.detalle||'';
        row.querySelector('.monto').value = l.monto ? fmtMontoInput(l.monto) : '';
        row.querySelector('.cc').addEventListener('change', function(){ l.centroCostoId = this.value; if(!ccRequiere(this.value)) l.ccRef = ''; renderSplitUI(); });
        if(row.querySelector('.ref')) row.querySelector('.ref').addEventListener('change', function(){ l.ccRef = this.value; });
        row.querySelector('.co').addEventListener('change', function(){ l.conceptoId = this.value; });
        row.querySelector('.detalle').addEventListener('input', function(){ l.detalle = this.value; });
        row.querySelector('.monto').addEventListener('input', function(){ var n = parseMontoInput(this.value); l.monto = isNaN(n) ? 0 : n; updateSplitTotal(); });
        row.querySelector('.del').addEventListener('click', function(){
          state.editingFacturaItems.splice(i,1);
          if(state.editingFacturaItems.length===0) state.editingFacturaItems.push({centroCostoId:'', conceptoId:'', monto:0, detalle:''});
          renderSplitUI();
        });
        box.appendChild(row);
      });
    }
    updateSplitTotal();
    renderFacturaImputChips();
  }
  document.getElementById('fm-split-on').addEventListener('click', function(){ setSplitMode(true); });
  document.getElementById('fm-split-off').addEventListener('click', function(){ setSplitMode(false); });
  document.getElementById('fm-split-add').addEventListener('click', function(){
    state.editingFacturaItems.push({centroCostoId:'', conceptoId:'', monto:Math.max(0, Math.round((facturaMontoActual()-splitAsignado())*100)/100), detalle:''});
    renderSplitUI();
  });
  document.getElementById('fm-monto').addEventListener('input', updateSplitTotal);
  // Pistas de neto y régimen según el proveedor elegido.
  function actualizarFmNetoHint(){
    var provId = document.getElementById('fm-proveedor').value;
    var f = {proveedorId:provId, monto:facturaMontoActual()};
    document.getElementById('fm-neto').placeholder = provId ? 'Automático: '+fmtMontoInput(facturaNetoAuto(f)) : 'Automático';
    var p = state.proveedores.find(function(x){ return x.id===provId; });
    var hint = document.getElementById('fm-neto-hint');
    if(!state.ganRegimenes.length){ hint.textContent = ''; return; }
    var reg = p ? provGanRegimen(p) : null, cond = p ? provGanCondicion(p) : '';
    var opt = document.querySelector('#fm-regimen option[value=""]');
    if(opt) opt.textContent = p ? ('Según el proveedor'+(reg ? ' ('+reg+')' : ': no retiene')) : 'Según el proveedor';
    hint.textContent = p ? '· '+(GAN_COND_LABEL[cond]||'')+' en Ganancias' : '';
  }
  document.getElementById('fm-monto').addEventListener('input', actualizarFmNetoHint);
  document.getElementById('fm-proveedor').addEventListener('change', actualizarFmNetoHint);

  function sumarImputacionAProveedor(proveedorId, ccId, coId){
    var p = state.proveedores.find(function(x){ return x.id===proveedorId; });
    if(!p || !ccId || !coId) return;
    var k = imputKey(ccId, coId);
    p.imputaciones = p.imputaciones || [];
    if(p.imputaciones.some(function(im){ return imputKey(im.centroCostoId, im.conceptoId)===k; })) return;
    p.imputaciones.push({centroCostoId:ccId, conceptoId:coId});
    writeProveedor(p);
  }

  function fillFacturaCentroCostoSelect(){
    fillCentroSelect(document.getElementById('fm-centro-costo'), 'Elegir centro de costo');
  }
  function fillFacturaConceptoSelect(){
    var sel = document.getElementById('fm-concepto');
    var current = sel.value;
    fillSelect(sel, state.conceptos.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }), 'id', 'nombre', 'Elegir concepto');
    sel.value = current;
  }

  function openFacturaModal(id){
    marcarModalAnulado('fm-save', 'fm-delete', null);
    state.editingFacturaId = id || null;
    var f = id ? facturaById(id) : null;
    document.getElementById('fm-title').textContent = f ? 'Editar factura' : 'Nueva factura';
    setProveedorComboValue('fm-proveedor', f ? f.proveedorId : '');
    fillFacturaOCSelect(f ? f.proveedorId : '');
    document.getElementById('fm-oc').value = f ? (f.ocId||'') : '';
    fillFacturaCentroCostoSelect();
    fillCentroSelect(document.getElementById('fm-centro-costo'), 'Elegir centro de costo', f ? (f.centroCostoId||'') : '');
    actualizarFmRef(f ? (f.ccRef||'') : '');
    fillFacturaConceptoSelect();
    document.getElementById('fm-concepto').value = f ? (f.conceptoId||'') : '';
    state.editingFacturaItems = (f && f.items && f.items.length>=2) ? f.items.map(function(l){ return Object.assign({}, l); }) : null;
    state.editingFacturaArts = (f && (f.articulos||[]).length) ? f.articulos.map(function(a){ return Object.assign({}, a); }) : null;
    document.getElementById('fm-numero').value = f ? (f.numero||'') : '';
    document.getElementById('fm-fecha').value = f ? (f.fecha||todayStr()) : todayStr();
    document.getElementById('fm-monto').value = f ? String(f.monto||0).replace('.',',') : '';
    document.getElementById('fm-neto').value = (f && f.neto!=null) ? fmtMontoInput(f.neto) : '';
    fillRegimenSelect(document.getElementById('fm-regimen'), f && f.regimenGan!=null ? f.regimenGan : '', 'Según el proveedor');
    actualizarFmNetoHint();
    document.getElementById('fm-notas').value = f ? (f.notas||'') : '';
    document.getElementById('fm-delete').style.display = f ? '' : 'none';
    state.editingFacturaArchivos = f ? (f.archivos||[]).slice() : [];
    renderAttachList('fm-archivos-list', function(){ return state.editingFacturaArchivos; });
    refreshFacturaReadAvailability();
    renderSplitUI();
    renderFacturaArts();
    marcarModalAnulado('fm-save', 'fm-delete', f, 'a');
    document.getElementById('factura-overlay').classList.add('show');
  }
  function closeFacturaModal(){
    document.getElementById('factura-overlay').classList.remove('show');
  }

  document.getElementById('new-factura-btn').addEventListener('click', function(){ openFacturaModal(null); });
  document.getElementById('fm-cancel').addEventListener('click', closeFacturaModal);
  document.getElementById('factura-filter-estado').addEventListener('change', function(){
    state.facturaFilterEstado = this.value;
    renderFacturasList();
  });
  document.getElementById('fm-save').addEventListener('click', function(){
    var proveedorId = document.getElementById('fm-proveedor').value;
    if(!proveedorId){ showToast('Elegí un proveedor (buscalo por nombre en el campo Proveedor).'); return; }
    var numero = document.getElementById('fm-numero').value.trim();
    if(!numero){ showToast('Ingresá el número de factura.'); return; }
    var monto = parseMontoInput(document.getElementById('fm-monto').value);
    if(isNaN(monto) || monto<0) monto = 0;
    var centroCostoId, conceptoId, ccRef = '', items = [];
    if(state.editingFacturaItems){
      // Repartida: se descartan líneas totalmente vacías; cada línea que
      // quede necesita centro, concepto y monto, y la suma tiene que dar el
      // total (si el total está vacío, se toma la suma).
      var lineas = state.editingFacturaItems.filter(function(l){ return l.centroCostoId || l.conceptoId || l.monto || (l.detalle||'').trim(); });
      for(var i=0;i<lineas.length;i++){
        if(!lineas[i].centroCostoId || !lineas[i].conceptoId){ showToast('Línea '+(i+1)+': elegí centro de costo y concepto.'); return; }
        var reqI = ccRequiere(lineas[i].centroCostoId);
        if(reqI && !lineas[i].ccRef){ showToast('Línea '+(i+1)+': elegí '+(reqI==='movil'?'el móvil':'la sucursal')+'.'); return; }
        if(!reqI) lineas[i].ccRef = ccRefEfectiva(lineas[i].centroCostoId, '');
        if(!(lineas[i].monto>0)){ showToast('Línea '+(i+1)+': ingresá el monto.'); return; }
      }
      if(lineas.length===0){ showToast('Cargá al menos una línea de imputación.'); return; }
      var suma = Math.round(lineas.reduce(function(s,l){ return s+l.monto; },0)*100)/100;
      if(!monto) monto = suma;
      if(Math.abs(suma-monto)>=0.005){ showToast('La suma de las líneas ($'+suma.toLocaleString('es-AR',{minimumFractionDigits:2})+') no coincide con el monto de la factura.'); return; }
      var mayor = lineas.slice().sort(function(a,b){ return b.monto-a.monto; })[0];
      centroCostoId = mayor.centroCostoId; conceptoId = mayor.conceptoId; ccRef = mayor.ccRef||'';
      items = lineas.length>=2 ? lineas.map(function(l){ return {centroCostoId:l.centroCostoId, conceptoId:l.conceptoId, ccRef:l.ccRef||'', monto:Math.round(l.monto*100)/100, detalle:(l.detalle||'').trim()}; }) : [];
    } else {
      centroCostoId = document.getElementById('fm-centro-costo').value;
      if(!centroCostoId){ showToast('Elegí un centro de costo.'); return; }
      conceptoId = document.getElementById('fm-concepto').value;
      if(!conceptoId){ showToast('Elegí un concepto.'); return; }
      var reqS = ccRequiere(centroCostoId);
      ccRef = reqS ? (document.getElementById('fm-ccref').value||'') : ccRefEfectiva(centroCostoId, '');
      if(reqS && !ccRef){ showToast('Elegí '+(reqS==='movil'?'el móvil':'la sucursal')+' del centro de costo.'); return; }
    }
    // Artículos (proveedores que cargan artículos)
    var arts = facturaArtsParaGuardar(proveedorId);
    if(arts===false) return;
    var id = state.editingFacturaId;
    var isNew = !id;
    var existing = id ? facturaById(id) : null;
    if(isNew) id = generateFacturaId(proveedorId, numero);
    var proveedorObj = state.proveedores.find(function(x){ return x.id===proveedorId; });
    var nombreProveedor = proveedorObj ? proveedorObj.nombre : 'Sin proveedor';
    var baseData = {
      id:id, proveedorId:proveedorId,
      ocId: document.getElementById('fm-oc').value || '',
      centroCostoId: centroCostoId,
      conceptoId: conceptoId,
      ccRef: ccRef,
      neto: (function(){ var t = document.getElementById('fm-neto').value.trim(); if(!t) return null; var n = parseMontoInput(t); return isNaN(n) ? null : r2(n); })(),
      regimenGan: document.getElementById('fm-regimen').value==='' ? null : Number(document.getElementById('fm-regimen').value),
      items: items,
      articulos: arts,
      numero:numero,
      fecha: document.getElementById('fm-fecha').value || todayStr(),
      monto: monto,
      estado: existing ? (existing.estado||'pendiente') : 'pendiente',
      notas: document.getElementById('fm-notas').value.trim()
    };
    var saveBtn = this;
    var tienePendientes = state.editingFacturaArchivos.some(function(a){ return a.pending; });
    if(tienePendientes){ saveBtn.disabled = true; showToast('Subiendo adjuntos a Google Drive...'); }
    subirAdjuntosPendientes(state.editingFacturaArchivos, nombreProveedor).then(function(archivosFinales){
      var f = Object.assign({}, baseData, { archivos: archivosFinales });
      if(isNew) state.facturas.push(f);
      else { var idx = state.facturas.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.facturas[idx]=f; }
      writeFactura(f);
      // El asistente mira el historial ANTES de sumar la imputación al proveedor.
      if(isNew) revisarFacturaNueva(f);
      facturaLineas(f).forEach(function(l){ sumarImputacionAProveedor(f.proveedorId, l.centroCostoId, l.conceptoId); });
      closeFacturaModal();
      renderPagos();
      renderProveedoresList();
      showToast('Factura guardada.');
    }).catch(function(err){
      showToast('No se pudieron subir uno o más adjuntos a Drive: '+((err&&err.message)||'error')+'. Probá guardar de nuevo.');
    }).finally(function(){ saveBtn.disabled = false; });
  });
  document.getElementById('fm-delete').addEventListener('click', function(){
    var id = state.editingFacturaId;
    var f = id ? facturaById(id) : null;
    if(!f || esAnulado(f)) return;
    var op = state.ordenesPago.find(function(p){ return noAnulado(p) && (p.facturaIds||[]).indexOf(id)!==-1; });
    if(op){ showToast('No se puede anular: está incluida en la '+pagoNumeroLabel(op.numero)+'. Anulá primero esa orden de pago (o sacala de ahí).', 6000); return; }
    pedirAnulacion('Anular factura '+(f.numero||''), proveedorNombre(f.proveedorId)+' — '+fmtMoney(f.monto)+'. Queda registrada como anulada (con sus adjuntos) y deja de contar como pendiente y como gasto.', function(motivo){
      sellarAnulacion(f, motivo);
      f.estado = 'anulada';
      writeFactura(f);
      closeFacturaModal();
      renderPagos();
      renderProveedoresList();
      showToast('Factura anulada.');
    });
  });

  function writePago(p){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('ordenes_pago').upsert(Object.assign({
      id:p.id, numero:p.numero, proveedor_id:p.proveedorId||'', factura_ids:p.facturaIds||[],
      fecha:p.fecha||'', monto:p.monto||0, medio_pago:p.medioPago||'transferencia',
      medio_id:p.medioId||null, cheque_ids:p.chequeIds||[],
      estado:p.estado||'pendiente', cuenta_id:p.cuentaId||null, notas:p.notas||'', who:p.who||''
    }, state.schemaV3 ? {retenciones:p.retenciones||[], retenido:p.retenido||0} : {},
       state.colFormas ? {formas:(p.formas||[]).map(function(f){ return {medio_id:f.medioId, cuenta_id:f.cuentaId, importe:f.importe, cheque_ids:f.chequeIds||[], cheque_numero:f.chequeNumero||'', cheque_fecha:f.chequeFecha||''}; })} : {},
       camposAnulacion(p))).then(function(res){
      if(res.error) showToast('No se pudo guardar la orden de pago: '+res.error.message);
    });
  }

  function selectedPagoFacturaIds(){
    return Array.prototype.slice.call(document.querySelectorAll('#pom-facturas-list input[type=checkbox]:checked')).map(function(c){ return c.value; });
  }
  // Retenciones de la OP que se está editando (cálculo en vivo).
  function pomRetencionesActuales(){
    var provId = document.getElementById('pom-proveedor').value;
    if(!provId) return [];
    return calcularRetenciones(provId, selectedPagoFacturaIds(), document.getElementById('pom-fecha').value || todayStr(), state.editingPagoId);
  }
  function pomNetoPagar(){
    var ret = pomRetencionesActuales().reduce(function(t,e){ return t+e.importe; }, 0);
    return r2(pomTotalFacturas() - ret);
  }
  function renderPomRetenciones(){
    var box = document.getElementById('pom-ret-box');
    if(!box) return;
    var rets = pomRetencionesActuales();
    if(!state.ganRegimenes.length || !rets.length){ box.hidden = true; return; }
    box.hidden = false;
    var pagada = document.getElementById('pom-estado').value==='pagada';
    document.getElementById('pom-ret-hint').textContent = pagada ? '' : '(estimada: se practica al marcarla Pagada)';
    var lines = document.getElementById('pom-ret-lines');
    lines.innerHTML = '';
    rets.forEach(function(e){
      var d = document.createElement('div');
      d.className = 'ret-line';
      d.innerHTML = '<div><div>'+(e.impuesto==='iva' ? '<b>IVA</b> · ' : '')+esc(regimenLabel(e.regimen))+'</div><div class="det">Neto de este pago '+fmtMoney(e.base)+(e.detalle ? ' · '+esc(e.detalle) : '')+'</div></div><b>'+fmtMoney(e.importe)+'</b>';
      lines.appendChild(d);
    });
    document.getElementById('pom-neto').textContent = fmtMoney(pomTotalFacturas() - rets.reduce(function(t,e){ return t+e.importe; }, 0));
    var certs = document.getElementById('pom-ret-certs');
    certs.innerHTML = '';
    var op = state.editingPagoId ? state.ordenesPago.find(function(x){ return x.id===state.editingPagoId; }) : null;
    if(op && op.estado==='pagada') (op.retenciones||[]).filter(function(e){ return e.importe>0 && e.certificado; }).forEach(function(e){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'btn';
      b.textContent = '🖨 Certificado '+impuestoLabel(e)+' N° '+certNumeroLabel(e.certificado);
      b.addEventListener('click', function(){ imprimirCertificado(op, e); });
      certs.appendChild(b);
    });
  }
  function updatePagoMontoTotal(){
    renderPomRetenciones();
    // Con una sola forma de pago (que no sea de cheques de cartera) y sin
    // importe escrito a mano, el importe sigue al neto a pagar.
    var fs = state.editingFormas || [];
    if(fs.length===1 && formaModo(fs[0])!=='cartera' && !fs[0].importeManual){
      fs[0].importe = pomNetoPagar();
      var inp = document.querySelector('#pom-formas .f-importe');
      if(inp) inp.value = fs[0].importe ? fmtMontoMiles(fs[0].importe) : '';
    }
    actualizarEstadoFormas();
    var ids = selectedPagoFacturaIds();
    var total = ids.reduce(function(s,id){ var f=facturaById(id); return s+(f?Number(f.monto||0):0); },0);
    document.getElementById('pom-monto-total').textContent = '$'+total.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  function renderPagoFacturasChecklist(proveedorId, selectedIds){
    selectedIds = selectedIds || [];
    var wrap = document.getElementById('pom-facturas-list');
    wrap.innerHTML = '';
    if(!proveedorId){
      wrap.innerHTML = '<div class="cargo-empty">Elegí un proveedor para ver sus facturas pendientes.</div>';
      updatePagoMontoTotal();
      return;
    }
    var list = state.facturas.filter(function(f){
      return f.proveedorId===proveedorId && (f.estado==='pendiente' || selectedIds.indexOf(f.id)!==-1);
    }).sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
    if(list.length===0){
      wrap.innerHTML = '<div class="cargo-empty">Este proveedor no tiene facturas pendientes.</div>';
      updatePagoMontoTotal();
      return;
    }
    list.forEach(function(f){
      var row = document.createElement('label');
      row.className = 'setting-row';
      var chk = document.createElement('input');
      chk.type = 'checkbox'; chk.value = f.id;
      chk.checked = selectedIds.indexOf(f.id)!==-1;
      chk.addEventListener('change', updatePagoMontoTotal);
      var span = document.createElement('span');
      span.style.flex = '1';
      span.textContent = f.numero+' — '+(f.fecha||'—')+' — $'+Number(f.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      row.appendChild(chk); row.appendChild(span);
      wrap.appendChild(row);
    });
    updatePagoMontoTotal();
  }
  document.getElementById('pom-proveedor').addEventListener('change', function(){ renderPagoFacturasChecklist(this.value, []); sifCerrarSi('pago:'); sugerirFormaHabitual(); });

  // ---------- Formas de pago de la orden (pagos mixtos) ----------
  // Una orden se puede pagar con varias formas a la vez: cheques de cartera,
  // transferencia, echeq/cheque propio, efectivo... Cada forma tiene concepto
  // de caja, cuenta e importe; entre todas tienen que sumar el neto a pagar.
  // state.editingFormas = [{medioId, cuentaId, importe, chequeIds, chequeNumero, chequeFecha}]
  function formaModo(f){ var md = medioById(f.medioId); return md ? md.cheque : 'no'; }
  function formaVacia(importe){ return {medioId:'', cuentaId:'', importe:importe||0, chequeIds:[], chequeNumero:'', chequeFecha:''}; }
  function pomTotalFacturas(){
    return selectedPagoFacturaIds().reduce(function(s,id){ var f=facturaById(id); return s+(f?Number(f.monto||0):0); },0);
  }
  function formasAsignado(){ return r2((state.editingFormas||[]).reduce(function(t,f){ return t+Number(f.importe||0); },0)); }
  function actualizarEstadoFormas(){
    var el = document.getElementById('pom-formas-estado'); if(!el) return;
    var neto = pomNetoPagar(), asig = formasAsignado(), dif = r2(neto-asig);
    el.textContent = Math.abs(dif)<0.005 ? fmtMoney(asig)+' ✓' : (dif>0 ? 'Falta asignar '+fmtMoney(dif) : 'Te pasaste '+fmtMoney(-dif))+' (de '+fmtMoney(neto)+')';
    el.className = 'formas-estado'+(Math.abs(dif)<0.005 ? '' : ' bad');
  }
  // Cheques de cartera que puede usar la forma i: los que están en cartera (o
  // ya entregados en esta orden) y que no eligió otra forma.
  function chequesDisponiblesForma(i){
    var opId = state.editingPagoId, usados = {};
    (state.editingFormas||[]).forEach(function(f,j){ if(j!==i) (f.chequeIds||[]).forEach(function(c){ usados[c]=1; }); });
    return state.cheques.filter(function(c){ return !usados[c.id] && (c.estado==='cartera' || (opId && c.pagoId===opId && c.estado==='entregado')); })
      .sort(function(a,b){ return (a.fechaCobro||'').localeCompare(b.fechaCobro||''); });
  }
  function renderPomFormas(){
    var box = document.getElementById('pom-formas-box');
    var pagada = document.getElementById('pom-estado').value==='pagada';
    box.hidden = !pagada;
    if(!pagada) return;
    if(!state.editingFormas || !state.editingFormas.length) state.editingFormas = [formaVacia(pomNetoPagar())];
    var cont = document.getElementById('pom-formas');
    cont.innerHTML = '';
    var cuentasOpts = state.cuentas.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });
    state.editingFormas.forEach(function(f, i){
      var modo = formaModo(f);
      var d = document.createElement('div');
      d.className = 'forma';
      d.innerHTML = '<div class="forma-fila">'
        +'<select class="f-medio"><option value="">Concepto (TR1, CHE, ECS…)</option>'+mediosOrdenados(f.medioId).map(function(m){ return '<option value="'+esc(m.id)+'"'+(m.id===f.medioId?' selected':'')+'>'+esc(m.codigo+' — '+m.nombre)+'</option>'; }).join('')+'</select>'
        +'<select class="f-cuenta"><option value="">Cuenta</option>'+cuentasOpts.map(function(c){ return '<option value="'+esc(c.id)+'"'+(c.id===f.cuentaId?' selected':'')+'>'+esc(c.nombre)+'</option>'; }).join('')+'</select>'
        +'<input class="f-importe" type="text" inputmode="decimal" placeholder="Importe"'+(modo==='cartera'?' readonly title="Es la suma de los cheques elegidos"':'')+' value="'+(f.importe?fmtMontoMiles(f.importe):'')+'">'
        +(state.editingFormas.length>1 ? '<button type="button" class="quitar" title="Quitar esta forma de pago">✕</button>' : '<span></span>')
        +'</div>';
      if(modo==='datos'){
        d.insertAdjacentHTML('beforeend', '<div class="forma-chq"><input class="f-chqnum" type="text" maxlength="20" placeholder="N° cheque / echeq" value="'+esc(f.chequeNumero||'')+'">'
          +'<input class="f-chqfecha" type="date" title="Fecha de cobro (la plata sale del banco ese día)" value="'+esc(f.chequeFecha||'')+'"></div>');
      }
      if(modo==='cartera'){
        var lista = chequesDisponiblesForma(i);
        var html = '<div class="forma-cartera">'+(lista.length ? '' : '<div class="empty">No hay cheques en cartera.</div>');
        lista.forEach(function(c){
          html += '<label><input type="checkbox" value="'+esc(c.id)+'"'+((f.chequeIds||[]).indexOf(c.id)!==-1?' checked':'')+'> '
            +esc(chequeResumen(c))+' · '+esc(c.titular||'')+' · cobro '+esc(c.fechaCobro||'—')+'<span class="imp">'+fmtMoney(c.importe)+'</span></label>';
        });
        d.insertAdjacentHTML('beforeend', html+'</div>');
      }
      d.querySelector('.f-medio').addEventListener('change', function(){
        f.medioId = this.value;
        var md = medioById(f.medioId);
        if(md && md.cuentaId && cuentaById(md.cuentaId)) f.cuentaId = md.cuentaId;
        if(formaModo(f)!=='cartera') f.chequeIds = [];
        if(formaModo(f)==='cartera') f.importe = 0;
        renderPomFormas();
      });
      d.querySelector('.f-cuenta').addEventListener('change', function(){ f.cuentaId = this.value; });
      d.querySelector('.f-importe').addEventListener('input', function(){ var n = parseMontoInput(this.value); f.importe = isNaN(n) ? 0 : r2(n); f.importeManual = true; actualizarEstadoFormas(); });
      if(d.querySelector('.quitar')) d.querySelector('.quitar').addEventListener('click', function(){ state.editingFormas.splice(i,1); renderPomFormas(); });
      if(d.querySelector('.f-chqnum')) d.querySelector('.f-chqnum').addEventListener('input', function(){ f.chequeNumero = this.value.trim(); });
      if(d.querySelector('.f-chqfecha')) d.querySelector('.f-chqfecha').addEventListener('change', function(){ f.chequeFecha = this.value; });
      d.querySelectorAll('.forma-cartera input').forEach(function(chk){
        chk.addEventListener('change', function(){
          f.chequeIds = Array.prototype.map.call(d.querySelectorAll('.forma-cartera input:checked'), function(x){ return x.value; });
          f.importe = r2(f.chequeIds.reduce(function(t,cid){ var c = chequeById(cid); return t+(c?Number(c.importe||0):0); },0));
          d.querySelector('.f-importe').value = f.importe ? fmtMontoMiles(f.importe) : '';
          actualizarEstadoFormas();
        });
      });
      cont.appendChild(d);
    });
    actualizarEstadoFormas();
  }
  document.getElementById('pom-forma-add').addEventListener('click', function(){
    state.editingFormas.forEach(function(f){ f.importeManual = true; });
    var falta = r2(pomNetoPagar() - formasAsignado());
    state.editingFormas.push(Object.assign(formaVacia(falta>0 ? falta : 0), {importeManual:true}));
    renderPomFormas();
  });
  // Lo que antes era un solo concepto/cuenta/cheques sigue funcionando:
  // una orden vieja se lee como una sola forma de pago.
  function formasDePago(p){
    if(p.formas && p.formas.length) return p.formas.map(function(f){ return Object.assign(formaVacia(0), f, {chequeIds:(f.chequeIds||[]).slice()}); });
    if(!p.medioId && !p.cuentaId) return [];
    var chq = chequeById(chequeIdOP(p.id));
    return [{medioId:p.medioId||'', cuentaId:p.cuentaId||'', importe:r2((p.monto||0)-(p.retenido||0)), chequeIds:(p.chequeIds||[]).slice(),
      chequeNumero:p.chequeNumero || (chq ? chq.numero||'' : ''), chequeFecha:p.chequeFecha || (chq ? chq.fechaCobro||'' : '')}];
  }
  document.getElementById('pom-estado').addEventListener('change', function(){ renderPomRetenciones(); renderPomFormas(); sugerirFormaHabitual(); });
  document.getElementById('pom-fecha').addEventListener('change', updatePagoMontoTotal);

  function openPagoModal(id){
    marcarModalAnulado('pom-save', 'pom-delete', null);
    state.editingPagoId = id || null;
    var p = id ? state.ordenesPago.find(function(x){ return x.id===id; }) : null;
    document.getElementById('pom-title').textContent = p ? 'Editar orden de pago' : 'Nueva orden de pago';
    document.getElementById('pom-sub').textContent = p ? pagoNumeroLabel(p.numero) : 'Se le asigna un número al guardar';
    setProveedorComboValue('pom-proveedor', p ? p.proveedorId : '');
    renderPagoFacturasChecklist(p ? p.proveedorId : '', p ? (p.facturaIds||[]) : []);
    document.getElementById('pom-fecha').value = p ? (p.fecha||todayStr()) : todayStr();
    state.editingFormas = p ? formasDePago(p) : [];
    document.getElementById('pom-estado').value = p ? (p.estado||'pendiente') : 'pendiente';
    document.getElementById('pom-notas').value = p ? (p.notas||'') : '';
    document.getElementById('pom-delete').style.display = p ? '' : 'none';
    document.getElementById('pom-imprimir').style.display = p ? '' : 'none';
    updatePagoMontoTotal();
    renderPomFormas();
    marcarModalAnulado('pom-save', 'pom-delete', p, 'a');
    document.getElementById('pago-overlay').classList.add('show');
  }
  function closePagoModal(){
    document.getElementById('pago-overlay').classList.remove('show');
    sifCerrarSi('pago:');
  }

  document.getElementById('new-pago-btn').addEventListener('click', function(){ openPagoModal(null); });
  document.getElementById('pom-cancel').addEventListener('click', closePagoModal);
  document.getElementById('pago-filter-estado').addEventListener('change', function(){
    state.pagoFilterEstado = this.value;
    renderPagosList();
  });
  document.getElementById('pom-save').addEventListener('click', function(){
    var proveedorId = document.getElementById('pom-proveedor').value;
    if(!proveedorId){ showToast('Elegí un proveedor.'); return; }
    var facturaIds = selectedPagoFacturaIds();
    if(facturaIds.length===0){ showToast('Elegí al menos una factura.'); return; }
    var estado = document.getElementById('pom-estado').value || 'pendiente';
    var monto = facturaIds.reduce(function(s,id){ var f=facturaById(id); return s+(f?Number(f.monto||0):0); },0);
    // Formas de pago (solo si queda Pagada): cada una completa y entre todas = neto.
    var formas = [];
    if(estado==='pagada'){
      formas = (state.editingFormas||[]).filter(function(f){ return f.medioId || f.importe || (f.chequeIds||[]).length; });
      if(!formas.length){ showToast('Cargá al menos una forma de pago.'); return; }
      for(var fi=0; fi<formas.length; fi++){
        var f = formas[fi], n = fi+1, modoF = formaModo(f);
        if(!f.medioId){ showToast('Forma de pago '+n+': elegí el concepto (TR1, CHE, ECS…).'); return; }
        if(!f.cuentaId){ showToast('Forma de pago '+n+': elegí la cuenta.'); return; }
        if(modoF==='cartera' && !(f.chequeIds||[]).length){ showToast('Forma de pago '+n+': elegí los cheques de la cartera.'); return; }
        if(modoF==='datos' && !f.chequeNumero){ showToast('Forma de pago '+n+': ingresá el número de cheque / echeq.'); return; }
        if(!(f.importe>0)){ showToast('Forma de pago '+n+': ingresá el importe.'); return; }
      }
      if(formas.length>1 && !state.colFormas){ showToast('Para pagar con varias formas falta correr el schema.sql nuevo en Supabase.', 6000); return; }
      var netoP = pomNetoPagar(), asigP = r2(formas.reduce(function(t,f){ return t+Number(f.importe||0); },0));
      if(Math.abs(netoP-asigP)>=0.005){ showToast('Las formas de pago suman '+fmtMoney(asigP)+' y el neto a pagar es '+fmtMoney(netoP)+': tienen que coincidir.', 6000); return; }
    }
    var f0 = formas[0] || formaVacia(0);
    var medioSel = medioById(f0.medioId);
    var id = state.editingPagoId;
    var isNew = !id;
    var existing = id ? state.ordenesPago.find(function(x){ return x.id===id; }) : null;
    var numero = isNew ? nextPagoNumero() : (existing ? existing.numero : nextPagoNumero());
    if(isNew) id = 'op_'+numero;
    // Retenciones: solo se practican cuando la orden queda Pagada. Se conserva
    // el número de certificado si el régimen ya tenía uno en esta orden.
    var retenciones = [], retenido = 0;
    if(estado==='pagada' && state.schemaV3){
      var prevCert = {};
      (existing && existing.retenciones || []).forEach(function(e){ if(e.certificado) prevCert[(e.impuesto||'gan')+e.regimen] = e.certificado; });
      var proxCert = proximoCertificado();
      retenciones = calcularRetenciones(proveedorId, facturaIds, document.getElementById('pom-fecha').value || todayStr(), id)
        .map(function(e){
          var o = {regimen:e.regimen, base:e.base, acum_prev:e.acum_prev, ret_prev:e.ret_prev, importe:e.importe, condicion:e.condicion};
          if(e.impuesto) o.impuesto = e.impuesto;
          if(e.importe>0) o.certificado = prevCert[(e.impuesto||'gan')+e.regimen] || (proxCert++);
          return o;
        });
      retenido = r2(retenciones.reduce(function(t,e){ return t+e.importe; }, 0));
    }
    var p = {
      id:id, numero:numero, proveedorId:proveedorId, facturaIds:facturaIds,
      fecha: document.getElementById('pom-fecha').value || todayStr(),
      monto: monto,
      medioPago: formas.length ? formas.map(function(f){ return medioCodigo(f.medioId); }).join('+') : (existing ? existing.medioPago : 'transferencia'),
      medioId: f0.medioId || '',
      chequeIds: [].concat.apply([], formas.filter(function(f){ return formaModo(f)==='cartera'; }).map(function(f){ return f.chequeIds||[]; })),
      chequeNumero: f0.chequeNumero || '',
      chequeFecha: f0.chequeFecha || '',
      formas: formas.map(function(f){ return {medioId:f.medioId, cuentaId:f.cuentaId, importe:r2(f.importe), chequeIds:formaModo(f)==='cartera' ? (f.chequeIds||[]).slice() : [],
        chequeNumero: formaModo(f)==='datos' ? (f.chequeNumero||'') : '', chequeFecha: formaModo(f)==='datos' ? (f.chequeFecha||'') : ''}; }),
      estado: estado,
      retenciones: retenciones,
      retenido: retenido,
      cuentaId: estado==='pagada' ? (f0.cuentaId||'') : '',
      notas: document.getElementById('pom-notas').value.trim(),
      who: whoName()
    };
    if(isNew) state.ordenesPago.push(p);
    else { var idx = state.ordenesPago.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.ordenesPago[idx]=p; }
    writePago(p);
    syncPagoMovimiento(p);
    // Las facturas que ya no quedaron incluidas vuelven a pendiente; las que
    // quedan incluidas toman el estado de la orden de pago.
    var prevIds = existing ? (existing.facturaIds||[]) : [];
    prevIds.filter(function(fid){ return facturaIds.indexOf(fid)===-1; }).forEach(function(fid){ setFacturaEstado(fid, 'pendiente'); });
    facturaIds.forEach(function(fid){ setFacturaEstado(fid, estado==='pagada' ? 'pagada' : 'pendiente'); });
    closePagoModal();
    renderPagos();
    renderTesoreria();
    showToast(retenido>0 ? 'Orden de pago guardada. Se retuvieron '+fmtMoney(retenido)+' de Ganancias: el certificado se imprime desde la orden o desde Pagos → Retenciones.' : 'Orden de pago guardada.', retenido>0 ? 7000 : 2600);
  });
  // Anular una orden de pago: las facturas vuelven a pendiente, los cheques
  // de cartera vuelven a la cartera, los cheques/echeqs propios quedan
  // anulados y los egresos quedan anulados (no suman al saldo). Los
  // certificados de retención quedan con su número, marcados como anulados.
  function anularOrdenPago(p, motivo){
    sellarAnulacion(p, motivo);
    p.estado = 'anulada';
    var leyenda = 'Anulado ('+pagoNumeroLabel(p.numero)+')';
    (p.facturaIds||[]).forEach(function(fid){ setFacturaEstado(fid, 'pendiente'); });
    state.cheques.filter(function(c){ return c.pagoId===p.id; }).forEach(function(c){
      if(c.estado==='entregado') chequeVolverACartera(c);
      else if(c.estado==='emitido') writeCheque(Object.assign({}, c, {estado:'anulado', destino:leyenda+' — '+(c.destino||'')}));
    });
    state.movimientos.filter(function(m){ return m.pagoId===p.id && noAnulado(m); }).forEach(function(m){
      upsertMovimientoLocal(Object.assign({}, m, {anuladoEn:p.anuladoEn, anuladoPor:p.anuladoPor, motivoAnulacion:'Anulación de '+pagoNumeroLabel(p.numero)+': '+motivo}));
    });
    writePago(p);
  }
  document.getElementById('pom-imprimir').addEventListener('click', function(){
    var p = state.editingPagoId ? state.ordenesPago.find(function(x){ return x.id===state.editingPagoId; }) : null;
    if(p) imprimirOrdenPago(p);
  });
  document.getElementById('ocm-imprimir').addEventListener('click', function(){
    var o = state.editingOCId ? state.ordenesCompra.find(function(x){ return x.id===state.editingOCId; }) : null;
    if(o) imprimirOrdenCompra(o);
  });
  document.getElementById('pom-delete').addEventListener('click', function(){
    var id = state.editingPagoId;
    var p = id ? state.ordenesPago.find(function(x){ return x.id===id; }) : null;
    if(!p || esAnulado(p)) return;
    var conCert = (p.retenciones||[]).filter(function(e){ return e.importe>0 && e.certificado; }).length;
    pedirAnulacion('Anular '+pagoNumeroLabel(p.numero), proveedorNombre(p.proveedorId)+' — '+fmtMoney(p.monto)+'. '
      +(p.estado==='pagada' ? 'Los egresos quedan anulados, los cheques de cartera vuelven a la cartera y los propios quedan anulados. ' : '')
      +'Las facturas vuelven a pendiente.'+(conCert ? ' El certificado de retención queda anulado (su número no se reutiliza).' : ''), function(motivo){
      anularOrdenPago(p, motivo);
      closePagoModal();
      renderPagos();
      renderTesoreria();
      showToast('Orden de pago anulada.');
    });
  });

  function mapFacturaRow(row){
    return leerAnulacion(row, {
      id:row.id, proveedorId:row.proveedor_id||'', ocId:row.oc_id||'',
      centroCostoId:row.centro_costo_id||'', conceptoId:row.concepto_id||'', numero:row.numero||'',
      fecha:row.fecha||'', monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0,
      estado:row.estado||'pendiente', notas:row.notas||'',
      archivos: Array.isArray(row.archivos) ? row.archivos : [],
      ccRef: row.cc_ref||'',
      neto: (row.neto===null || row.neto===undefined || row.neto==='') ? null : Number(row.neto),
      regimenGan: row.regimen_gan==null ? null : Number(row.regimen_gan),
      articulos: (function(){
        if(row && Object.prototype.hasOwnProperty.call(row, 'articulos')) state.colArticulos = true;
        return (Array.isArray(row.articulos) ? row.articulos : []).map(function(a){
          return {articuloId:a.articulo_id||'', cantidad:Number(a.cantidad)||0, precio:Number(a.precio)||0, importe:Number(a.importe)||0};
        });
      })(),
      items: (Array.isArray(row.items) ? row.items : []).map(function(it){
        return {centroCostoId:it.centro_costo_id||'', conceptoId:it.concepto_id||'', ccRef:it.cc_ref||'',
                monto: typeof it.monto==='number' ? it.monto : parseFloat(it.monto)||0, detalle:it.detalle||''};
      })
    });
  }
  function mapPagoRow(row){
    if(row && Object.prototype.hasOwnProperty.call(row, 'formas')) state.colFormas = true;
    return leerAnulacion(row, {
      id:row.id, numero:row.numero||0, proveedorId:row.proveedor_id||'', facturaIds:row.factura_ids||[],
      fecha:row.fecha||'', monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0,
      medioPago:row.medio_pago||'transferencia', estado:row.estado||'pendiente', cuentaId:row.cuenta_id||'',
      medioId:row.medio_id||'', chequeIds:Array.isArray(row.cheque_ids)?row.cheque_ids:[],
      retenciones: Array.isArray(row.retenciones) ? row.retenciones : [], retenido: Number(row.retenido||0),
      formas: (Array.isArray(row.formas) ? row.formas : []).map(function(f){ return {medioId:f.medio_id||'', cuentaId:f.cuenta_id||'', importe:Number(f.importe||0),
        chequeIds:Array.isArray(f.cheque_ids)?f.cheque_ids:[], chequeNumero:f.cheque_numero||'', chequeFecha:f.cheque_fecha||''}; }),
      notas:row.notas||'', who:row.who||''
    });
  }
  function fetchFacturasYPagos(){
    if(!state.sb) return;
    fetchAllRows('facturas').then(function(res){
      if(res.error){ showToast('Error cargando facturas: '+res.error.message); return; }
      state.facturas = (res.data||[]).map(mapFacturaRow);
      renderArticulosList();   // "comprado" y "último precio" salen de las facturas
      state.facturasCargadas = true;
      renderPagos();
      setTimeout(revisarFacturasFaltantes, 600);
      renderProveedoresList(); // la imputación por defecto depende de las facturas
      if(state.view==='dashboard') renderDashboard();
    });
    fetchAllRows('ordenes_pago').then(function(res){
      if(res.error){ showToast('Error cargando órdenes de pago: '+res.error.message); return; }
      state.ordenesPago = (res.data||[]).map(mapPagoRow);
      renderPagos();
    });
  }

  // ---------- Tesorería: cuentas y movimientos ----------
  function cuentaTipoLabel(t){ return t==='banco' ? 'Banco' : 'Caja'; }
  function cuentaById(id){
    return state.cuentas.find(function(x){ return x.id===id; }) || null;
  }
  function cuentaNombre(id){
    var c = cuentaById(id);
    return c ? c.nombre : '(cuenta eliminada)';
  }
  function generateCuentaId(nombre){
    var base = slug(nombre);
    var used = {};
    state.cuentas.forEach(function(c){ used[c.id] = true; });
    if(!used[base]) return base;
    var n = 2;
    while(used[base+'_'+n]) n++;
    return base+'_'+n;
  }
  function movimientoById(id){
    return state.movimientos.find(function(x){ return x.id===id; }) || null;
  }
  // Los movimientos generados automáticamente al pagar una orden de pago
  // usan un id determinístico ligado a esa OP, así siempre se puede
  // encontrar/actualizar/borrar el movimiento correspondiente a una OP dada.
  function movimientoIdForPago(pagoId){ return 'mov_op_'+pagoId; }
  function cuentaTipoLabelFull(t){ return t==='banco' ? 'Banco' : (t==='cartera' ? 'Cartera de cheques' : 'Caja'); }
  // Saldo: saldo inicial + entradas − salidas.
  // Saldo HOY: saldo inicial + entradas − salidas con fecha hasta hoy. Los
  // movimientos con fecha futura (cheques/echeqs propios diferidos, que se
  // debitan cuando se cobran) solo cuentan en el saldo PROYECTADO.
  function cuentaSaldoActual(cuentaId, hasta){
    var c = cuentaById(cuentaId);
    if(!c) return 0;
    var tope = hasta || todayStr();
    var neto = state.movimientos.filter(function(m){ return m.cuentaId===cuentaId && (m.fecha||'')<=tope && noAnulado(m); })
      .reduce(function(s,m){ return s + (m.tipo==='ingreso' ? 1 : -1)*Number(m.monto||0); }, 0);
    return Number(c.saldoInicial||0) + neto;
  }
  function cuentaSaldoProyectado(cuentaId){ return cuentaSaldoActual(cuentaId, '9999-12-31'); }
  // Fecha en que el pago o cobro mueve la plata: la de la operación o, si el
  // cheque/echeq es diferido, la de cobro (la que sea posterior).
  function fechaImpacto(fechaOperacion, fechaCobro){
    var f = fechaOperacion || todayStr();
    return (fechaCobro && fechaCobro > f) ? fechaCobro : f;
  }

  // ---------- Conceptos de caja (CHE, TR1, EF2...) ----------
  function medioById(id){ return state.medios.find(function(x){ return x.id===id; }) || null; }
  function medioLabel(id){ var m = medioById(id); return m ? (m.codigo+' — '+m.nombre) : ''; }
  function medioCodigo(id){ var m = medioById(id); return m ? m.codigo : ''; }
  function mediosOrdenados(incluirId){
    return state.medios.filter(function(m){ return m.activo || m.id===incluirId; })
      .sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||''); });
  }
  function fillMedioSelect(sel, valor, placeholder){
    sel.innerHTML = '<option value="">'+(placeholder||'Elegir concepto')+'</option>';
    mediosOrdenados(valor).forEach(function(m){
      var o = document.createElement('option'); o.value = m.id; o.textContent = m.codigo+' — '+m.nombre; sel.appendChild(o);
    });
    sel.value = valor || '';
  }

  // ---------- Cheques ----------
  var CHEQUE_ESTADOS = {cartera:'En cartera', depositado:'Depositado', entregado:'Entregado', rechazado:'Rechazado', recibido:'Recibido', emitido:'Emitido', anulado:'Anulado'};
  function chequeById(id){ return state.cheques.find(function(x){ return x.id===id; }) || null; }
  function chequesEnCartera(){ return state.cheques.filter(function(c){ return c.estado==='cartera'; }); }
  function newId(prefix){ return prefix+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6); }
  function chequeResumen(c){ return (c.banco||'Cheque')+' N° '+(c.numero||'s/n'); }

  function renderTesoreria(){
    renderSugerenciaPagos();
    renderCuentasList();
    fillMovFilterCuentaSelect();
    renderChequesList();
    renderMovimientosList();
    renderMediosList();
    actualizarSubtabs();
  }

  function renderCuentasList(){
    var body = document.getElementById('cuentas-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.cuentas.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="7">Todavía no hay cuentas cargadas.</td></tr>';
      return;
    }
    state.cuentas.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }).forEach(function(c){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var inicialStr = Number(c.saldoInicial||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var actual = cuentaSaldoActual(c.id);
      var proy = cuentaSaldoProyectado(c.id);
      var futuro = proy - actual;
      tr.innerHTML = '<td class="day-route">'+esc(c.nombre)+'</td>'
        +'<td>'+cuentaTipoLabelFull(c.tipo)+'</td>'
        +'<td class="num">$'+inicialStr+'</td>'
        +'<td class="num'+(actual<0?' cuenta-saldo-neg':'')+'">'+fmtMoney(actual)+'</td>'
        +'<td class="num'+(futuro<0?' cuenta-saldo-neg':'')+'">'+(Math.abs(futuro)>=0.005 ? (futuro>0?'+':'−')+fmtMoney(Math.abs(futuro)) : '—')+'</td>'
        +'<td class="num'+(proy<0?' cuenta-saldo-neg':'')+'">'+fmtMoney(proy)+'</td>'
        +'<td class="day-note">'+esc(c.notas||'—')+'</td>';
      tr.addEventListener('click', function(){ openCuentaModal(c.id); });
      body.appendChild(tr);
    });
  }

  function fillMovFilterCuentaSelect(){
    var sel = document.getElementById('mov-filter-cuenta');
    if(!sel) return;
    var current = state.movFilterCuenta;
    sel.innerHTML = '<option value="">Todas las cuentas</option>';
    state.cuentas.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }).forEach(function(c){
      var opt = document.createElement('option');
      opt.value = c.id; opt.textContent = c.nombre;
      sel.appendChild(opt);
    });
    sel.value = current;
  }
  document.getElementById('mov-filter-cuenta').addEventListener('change', function(){
    state.movFilterCuenta = this.value;
    renderMovimientosList();
  });

  function movimientoOrigen(m){
    if(m.pagoId) return {label:'Orden de pago', auto:true};
    if(esTransferencia(m)) return {label:'Entre cuentas', auto:false, trf:true};
    if(m.id.indexOf('mov_chq_')===0) return {label:'Cheque', auto:true};
    return {label:'Manual', auto:false};
  }
  function renderMovimientosList(){
    var body = document.getElementById('movimientos-body');
    if(!body) return;
    body.innerHTML = '';
    var list = state.movimientos.slice();
    if(state.movFilterCuenta) list = list.filter(function(m){ return m.cuentaId===state.movFilterCuenta; });
    list.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||'') || (b.id||'').localeCompare(a.id||''); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="7">No hay movimientos'+(state.movFilterCuenta?' en esta cuenta':' cargados')+'.</td></tr>';
      return;
    }
    list.forEach(function(m){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var ing = m.tipo==='ingreso';
      var montoStr = Number(m.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var org = movimientoOrigen(m);
      var anul = esAnulado(m);
      var futuro = !anul && (m.fecha||'') > todayStr();
      if(futuro) tr.className += ' mov-futuro';
      if(anul){ tr.className += ' anulado'; tr.title = anulacionTexto(Object.assign({__genero:'o'}, m)); }
      tr.innerHTML = '<td class="num">'+esc(m.fecha||'—')+(futuro ? '<div class="mov-pend">'+(ing?'a acreditar':'a debitar')+'</div>' : '')+(anul ? '<div class="mov-pend">anulado</div>' : '')+'</td>'
        +'<td><span class="mov-tipo '+(ing?'ingreso':'egreso')+'">'+(ing?'Entrada':'Salida')+'</span></td>'
        +'<td class="num" title="'+esc(medioLabel(m.medioId))+'">'+esc(medioCodigo(m.medioId)||'—')+'</td>'
        +'<td>'+esc(cuentaNombre(m.cuentaId))+'</td>'
        +'<td class="day-note">'+esc(m.concepto||'—')+'</td>'
        +'<td><span class="mov-origen-badge'+(org.auto?' auto':'')+(org.trf?' trf':'')+'">'+org.label+'</span></td>'
        +'<td class="num'+(ing?' monto-ingreso':'')+'">'+(ing?'+':'−')+'$'+montoStr+'</td>';
      tr.addEventListener('click', function(){
        if(org.trf){ openTransferModal(transferBase(m.id)); return; }
        if(anul && !m.pagoId && !org.auto){ openMovimientoModal(m.id); return; }
        if(anul){ showToast(anulacionTexto(Object.assign({__genero:'o'}, m)), 6000); return; }
        if(m.pagoId){ showToast('Este movimiento viene de una orden de pago: se cambia desde Pagos.'); return; }
        if(org.auto){ if((m.chequeIds||[])[0]) openChequeModal(m.chequeIds[0]); return; }
        openMovimientoModal(m.id);
      });
      body.appendChild(tr);
    });
  }

  function renderChequesList(){
    var body = document.getElementById('cheques-body');
    if(!body) return;
    body.innerHTML = '';
    var cartera = chequesEnCartera();
    var totalCartera = cartera.reduce(function(s,c){ return s+Number(c.importe||0); }, 0);
    document.getElementById('cheques-resumen').textContent = cartera.length ? '('+cartera.length+' en cartera · '+fmtMoney(totalCartera)+')' : '';
    var f = state.chequeFilterEstado;
    var list = state.cheques.filter(function(c){ return !f || c.estado===f; });
    list.sort(function(a,b){ return (a.fechaCobro||'9999').localeCompare(b.fechaCobro||'9999'); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="7">'+(f==='cartera' ? 'No hay cheques en cartera.' : 'No hay cheques'+(f?' en ese estado':'')+'.')+'</td></tr>';
      return;
    }
    var hoy = todayStr();
    list.forEach(function(c){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var alCobro = c.estado==='cartera' && c.fechaCobro && c.fechaCobro<=hoy;
      tr.innerHTML = '<td class="num">'+esc(c.fechaCobro||'—')+(alCobro?'<span class="chq-alcobro">AL COBRO</span>':'')+'</td>'
        +'<td>'+esc(c.banco||'—')+'</td>'
        +'<td class="num">'+esc(c.numero||'—')+'</td>'
        +'<td>'+esc(c.titular||'—')+'</td>'
        +'<td class="num">'+fmtMoney(c.importe)+'</td>'
        +'<td><span class="chq-estado '+esc(c.estado)+'">'+(c.estado==='emitido' ? (c.fechaCobro && c.fechaCobro>hoy ? 'Emitido · a debitar' : 'Emitido · debitado') : (CHEQUE_ESTADOS[c.estado]||c.estado))+'</span></td>'
        +'<td class="day-note">'+esc(c.destino||'—')+'</td>';
      tr.addEventListener('click', function(){ openChequeModal(c.id); });
      body.appendChild(tr);
    });
  }
  document.getElementById('cheque-filter-estado').addEventListener('change', function(){
    state.chequeFilterEstado = this.value;
    renderChequesList();
  });

  function writeCuenta(c){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('cuentas').upsert({
      id:c.id, nombre:c.nombre||'', tipo:c.tipo||'caja', saldo_inicial:c.saldoInicial||0, notas:c.notas||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar la cuenta: '+res.error.message);
    });
  }

  function openCuentaModal(id){
    state.editingCuentaId = id || null;
    var c = id ? cuentaById(id) : null;
    document.getElementById('ctam-title').textContent = c ? 'Editar cuenta' : 'Nueva cuenta';
    document.getElementById('ctam-nombre').value = c ? c.nombre : '';
    document.getElementById('ctam-tipo').value = c ? (c.tipo||'caja') : 'caja';
    document.getElementById('ctam-saldo-inicial').value = c ? String(c.saldoInicial||0).replace('.',',') : '';
    document.getElementById('ctam-notas').value = c ? (c.notas||'') : '';
    document.getElementById('ctam-delete').style.display = c ? '' : 'none';
    document.getElementById('cuenta-overlay').classList.add('show');
  }
  function closeCuentaModal(){
    document.getElementById('cuenta-overlay').classList.remove('show');
  }

  document.getElementById('new-cuenta-btn').addEventListener('click', function(){ openCuentaModal(null); });
  document.getElementById('ctam-cancel').addEventListener('click', closeCuentaModal);
  document.getElementById('ctam-save').addEventListener('click', function(){
    var nombre = document.getElementById('ctam-nombre').value.trim();
    if(!nombre){ showToast('Ingresá el nombre de la cuenta.'); return; }
    var saldoRaw = document.getElementById('ctam-saldo-inicial').value.replace(',','.').trim();
    var saldoInicial = parseFloat(saldoRaw);
    if(isNaN(saldoInicial)) saldoInicial = 0;
    var id = state.editingCuentaId;
    var isNew = !id;
    if(isNew) id = generateCuentaId(nombre);
    var c = {
      id:id, nombre:nombre,
      tipo: document.getElementById('ctam-tipo').value || 'caja',
      saldoInicial: saldoInicial,
      notas: document.getElementById('ctam-notas').value.trim()
    };
    if(isNew) state.cuentas.push(c);
    else { var idx = state.cuentas.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.cuentas[idx]=c; }
    writeCuenta(c);
    closeCuentaModal();
    renderTesoreria();
    showToast('Cuenta guardada.');
  });
  document.getElementById('ctam-delete').addEventListener('click', function(){
    var id = state.editingCuentaId;
    if(!id) return;
    var used = state.movimientos.some(function(m){ return m.cuentaId===id; });
    if(used){ showToast('No se puede eliminar: tiene movimientos cargados.'); return; }
    state.cuentas = state.cuentas.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('cuentas').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeCuentaModal();
    renderTesoreria();
    showToast('Cuenta eliminada.');
  });

  function writeMovimiento(m){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('movimientos').upsert(Object.assign({
      id:m.id, cuenta_id:m.cuentaId||null, fecha:m.fecha||null, concepto:m.concepto||'', monto:m.monto||0,
      pago_id:m.pagoId||null, notas:m.notas||'', tipo:m.tipo||'egreso', medio_id:m.medioId||null, cheque_ids:m.chequeIds||[]
    }, camposAnulacion(m))).then(function(res){
      if(res.error) showToast('No se pudo guardar el movimiento: '+res.error.message);
    });
  }
  function upsertMovimientoLocal(m){
    var idx = state.movimientos.findIndex(function(x){ return x.id===m.id; });
    if(idx>=0) state.movimientos[idx]=m; else state.movimientos.push(m);
    writeMovimiento(m);
  }
  function deleteMovimiento(id){
    state.movimientos = state.movimientos.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('movimientos').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar el movimiento: '+res.error.message);
    });
  }
  function writeCheque(c){
    var idx = state.cheques.findIndex(function(x){ return x.id===c.id; });
    if(idx>=0) state.cheques[idx]=c; else state.cheques.push(c);
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('cheques').upsert({
      id:c.id, medio_id:c.medioId||null, banco:c.banco||'', sucursal:c.sucursal||'', localidad:c.localidad||'',
      numero:c.numero||'', nro_cuenta:c.nroCuenta||'', titular:c.titular||'', fecha_cobro:c.fechaCobro||null,
      importe:c.importe||0, estado:c.estado||'cartera', fecha_ingreso:c.fechaIngreso||null, cuenta_id:c.cuentaId||null,
      mov_ingreso_id:c.movIngresoId||null, fecha_salida:c.fechaSalida||null, destino:c.destino||'',
      pago_id:c.pagoId||null, proveedor_id:c.proveedorId||null, mov_salida_id:c.movSalidaId||null, notas:c.notas||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar el cheque: '+res.error.message);
    });
  }
  function deleteCheque(id){
    state.cheques = state.cheques.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('cheques').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar el cheque: '+res.error.message);
    });
  }
  // Un cheque de cartera vuelve a la cartera (se deshace una entrega).
  function chequeVolverACartera(c){
    var ing = c.movIngresoId ? movimientoById(c.movIngresoId) : null;
    writeCheque(Object.assign({}, c, {estado:'cartera', fechaSalida:'', destino:'', pagoId:'', proveedorId:'', movSalidaId:'',
      cuentaId: ing ? ing.cuentaId : (c.cuentaId||'')}));
  }

  // ---------- Orden de pago -> egreso automático + cheques ----------
  function chequeIdOP(pagoId){ return 'chq_op_'+pagoId; }
  // Movimientos y cheques de una orden de pago: un egreso por cada forma de
  // pago (mov_op_<id>, mov_op_<id>_2, ...). Cheques de cartera elegidos →
  // entregados; los que se sacaron vuelven a cartera. Cheque/echeq propio →
  // queda emitido y su egreso sale el día de cobro.
  function syncPagoMovimiento(pago){
    var pagada = pago.estado==='pagada';
    var formas = pagada ? formasDePago(pago).filter(function(f){ return f.cuentaId; }) : [];
    var quedan = [];
    formas.forEach(function(f){ if(formaModo(f)==='cartera') quedan = quedan.concat(f.chequeIds||[]); });
    state.cheques.filter(function(c){ return c.pagoId===pago.id && c.estado==='entregado' && quedan.indexOf(c.id)===-1; })
      .forEach(chequeVolverACartera);
    quedan.forEach(function(cid){
      var c = chequeById(cid);
      if(!c) return;
      writeCheque(Object.assign({}, c, {estado:'entregado', pagoId:pago.id, proveedorId:pago.proveedorId,
        fechaSalida:pago.fecha||todayStr(), destino:'Entregado a '+proveedorNombre(pago.proveedorId)+' ('+pagoNumeroLabel(pago.numero)+')'}));
    });
    var base = chequeIdOP(pago.id), propios = {}, movs = {};
    formas.forEach(function(f, i){
      var modo = formaModo(f), medio = medioById(f.medioId);
      var sufijo = i ? '_'+(i+1) : '';
      var chqId = null;
      if(modo==='datos'){
        chqId = base+sufijo; propios[chqId] = true;
        var prev = chequeById(chqId) || {};
        writeCheque(Object.assign({}, prev, {id:chqId, medioId:f.medioId, banco:medio ? medio.nombre : '', numero:f.chequeNumero||prev.numero||'',
          fechaCobro:f.chequeFecha||prev.fechaCobro||'', importe:r2(f.importe), estado:'emitido', titular:'Anafer',
          fechaSalida:pago.fecha||todayStr(), pagoId:pago.id, proveedorId:pago.proveedorId,
          destino:'Emitido a '+proveedorNombre(pago.proveedorId)+' ('+pagoNumeroLabel(pago.numero)+')', cuentaId:f.cuentaId}));
      }
      var movId = movimientoIdForPago(pago.id)+sufijo; movs[movId] = true;
      upsertMovimientoLocal({
        id:movId, cuentaId:f.cuentaId, tipo:'egreso', medioId:f.medioId||'',
        fecha: modo==='datos' ? fechaImpacto(pago.fecha, f.chequeFecha) : (pago.fecha||todayStr()),
        concepto:'Pago '+pagoNumeroLabel(pago.numero)+' — '+proveedorNombre(pago.proveedorId)+(formas.length>1 ? ' ('+(i+1)+'/'+formas.length+')' : ''),
        monto:r2(f.importe), pagoId:pago.id,
        notas:(i===0 && pago.retenido ? 'Retención Ganancias '+fmtMoney(pago.retenido) : ''),
        chequeIds: modo==='cartera' ? (f.chequeIds||[]).slice() : (chqId ? [chqId] : [])
      });
    });
    // Cheques propios y egresos de formas que ya no están
    state.cheques.filter(function(c){ return (c.id===base || c.id.indexOf(base+'_')===0) && c.estado==='emitido' && !propios[c.id]; }).forEach(function(c){ deleteCheque(c.id); });
    state.movimientos.filter(function(m){ return m.pagoId===pago.id && !movs[m.id]; }).forEach(function(m){ deleteMovimiento(m.id); });
  }

  function fillMovimientoCuentaSelect(sel){
    fillSelect(sel, state.cuentas.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }), 'id', 'nombre', 'Elegir cuenta');
  }

  // ---------- Movimiento manual: entrada (DEBE) / salida (HABER) ----------
  function movTipoActual(){ return state.editingMovTipo || 'egreso'; }
  function movMedioModo(){ var md = medioById(document.getElementById('movm-medio').value); return md ? md.cheque : 'no'; }
  function setMovTipo(tipo){
    state.editingMovTipo = tipo;
    Array.prototype.forEach.call(document.querySelectorAll('#movm-tipo-toggle button'), function(b){ b.classList.toggle('on', b.dataset.tipo===tipo); });
    refreshMovModalFields();
  }
  Array.prototype.forEach.call(document.querySelectorAll('#movm-tipo-toggle button'), function(b){
    b.addEventListener('click', function(){ if(!this.disabled) setMovTipo(this.dataset.tipo); });
  });
  function refreshMovModalFields(){
    var md = medioById(document.getElementById('movm-medio').value);
    document.getElementById('movm-medio-nombre').textContent = md ? md.nombre : '';
    var modo = md ? md.cheque : 'no';
    var tipo = movTipoActual();
    // Datos del cheque: entrada con cheque (cartera o datos) o salida con
    // cheque/echeq propio. Salida con cheques de cartera: se eligen de la lista.
    var conDatos = (modo==='cartera' && tipo==='ingreso') || modo==='datos';
    var deCartera = modo==='cartera' && tipo==='egreso';
    document.getElementById('movm-cheque-fields').hidden = !conDatos;
    document.getElementById('movm-cartera-field').hidden = !deCartera;
    var montoInp = document.getElementById('movm-monto');
    montoInp.readOnly = deCartera;
    if(deCartera) renderMovCarteraPick();
  }
  function renderMovCarteraPick(){
    var box = document.getElementById('movm-cartera-list');
    var movId = state.editingMovimientoId;
    var sel = state.editingMovCheques || [];
    var list = state.cheques.filter(function(c){ return c.estado==='cartera' || (movId && c.movSalidaId===movId); })
      .sort(function(a,b){ return (a.fechaCobro||'').localeCompare(b.fechaCobro||''); });
    box.innerHTML = '';
    if(!list.length){ box.innerHTML = '<div class="empty">No hay cheques en cartera.</div>'; }
    list.forEach(function(c){
      var lab = document.createElement('label');
      lab.innerHTML = '<input type="checkbox" value="'+esc(c.id)+'"'+(sel.indexOf(c.id)!==-1?' checked':'')+'> '
        +esc(chequeResumen(c))+' · '+esc(c.titular||'')+' · cobro '+esc(c.fechaCobro||'—')+'<span class="imp">'+fmtMoney(c.importe)+'</span>';
      lab.querySelector('input').addEventListener('change', function(){
        var ids = Array.prototype.map.call(box.querySelectorAll('input:checked'), function(i){ return i.value; });
        state.editingMovCheques = ids;
        var total = ids.reduce(function(s,id){ var ch = chequeById(id); return s+(ch?Number(ch.importe||0):0); }, 0);
        document.getElementById('movm-monto').value = total ? fmtMontoInput(total) : '';
      });
      box.appendChild(lab);
    });
  }
  document.getElementById('movm-medio').addEventListener('change', function(){
    var md = medioById(this.value);
    if(md && md.cuentaId && cuentaById(md.cuentaId)) document.getElementById('movm-cuenta').value = md.cuentaId;
    refreshMovModalFields();
  });
  var MOV_CHQ_FIELDS = {banco:'movm-chq-banco', numero:'movm-chq-numero', sucursal:'movm-chq-sucursal', localidad:'movm-chq-localidad', nroCuenta:'movm-chq-cuenta', fechaCobro:'movm-chq-fecha', titular:'movm-chq-titular'};
  function openMovimientoModal(id, tipoNuevo){
    marcarModalAnulado('movm-save', 'movm-delete', null);
    fillMovimientoCuentaSelect(document.getElementById('movm-cuenta'));
    state.editingMovimientoId = id || null;
    var m = id ? movimientoById(id) : null;
    var tipo = m ? (m.tipo||'egreso') : (tipoNuevo||'egreso');
    fillMedioSelect(document.getElementById('movm-medio'), m ? m.medioId : '');
    document.getElementById('movm-title').textContent = m ? 'Editar movimiento' : (tipo==='ingreso' ? 'Nueva entrada' : 'Nueva salida');
    document.getElementById('movm-sub').textContent = tipo==='ingreso' ? 'Entrada de caja (DEBE)' : 'Salida de caja (HABER)';
    document.getElementById('movm-cuenta').value = m ? m.cuentaId : '';
    document.getElementById('movm-fecha').value = m ? (m.fecha||todayStr()) : todayStr();
    document.getElementById('movm-monto').value = m ? fmtMontoInput(m.monto||0) : '';
    document.getElementById('movm-concepto').value = m ? (m.concepto||'') : '';
    document.getElementById('movm-notas').value = m ? (m.notas||'') : '';
    // Datos del cheque ligado (si hay uno solo con datos: entrada o propio)
    var chq = null;
    if(m && (m.chequeIds||[]).length){
      var c0 = chequeById(m.chequeIds[0]);
      if(c0 && (c0.movIngresoId===m.id || c0.estado==='emitido')) chq = c0;
    }
    Object.keys(MOV_CHQ_FIELDS).forEach(function(k){ document.getElementById(MOV_CHQ_FIELDS[k]).value = chq ? (chq[k]||'') : ''; });
    state.editingMovCheques = m ? (m.chequeIds||[]).slice() : [];
    // Un movimiento con cheques ya cargados no cambia de tipo ni de concepto
    // (se borra y se carga de nuevo); el resto de los datos sí se edita.
    var bloquear = !!(m && (m.chequeIds||[]).length);
    Array.prototype.forEach.call(document.querySelectorAll('#movm-tipo-toggle button'), function(b){ b.disabled = !!m; });
    document.getElementById('movm-medio').disabled = bloquear;
    // Si el cheque de una entrada ya salió de la cartera, sus datos e importe quedan fijos.
    var chqFijo = !!(chq && chq.movIngresoId===m.id && ['cartera','recibido'].indexOf(chq.estado)===-1);
    Object.keys(MOV_CHQ_FIELDS).forEach(function(k){ document.getElementById(MOV_CHQ_FIELDS[k]).disabled = chqFijo; });
    document.getElementById('movm-monto').disabled = chqFijo;
    document.getElementById('movm-delete').style.display = m ? '' : 'none';
    setMovTipo(tipo);
    marcarModalAnulado('movm-save', 'movm-delete', m, 'o');
    document.getElementById('movimiento-overlay').classList.add('show');
  }
  function closeMovimientoModal(){
    document.getElementById('movimiento-overlay').classList.remove('show');
  }

  document.getElementById('new-movimiento-btn').addEventListener('click', function(){ openMovimientoModal(null, 'egreso'); });
  document.getElementById('new-entrada-btn').addEventListener('click', function(){ openMovimientoModal(null, 'ingreso'); });
  document.getElementById('movm-cancel').addEventListener('click', closeMovimientoModal);
  document.getElementById('movm-save').addEventListener('click', function(){
    var tipo = movTipoActual();
    var medioId = document.getElementById('movm-medio').value;
    if(!medioId){ showToast('Elegí el concepto (CHE, TR1, EF2...).'); return; }
    var medio = medioById(medioId);
    var modo = medio ? medio.cheque : 'no';
    var cuentaId = document.getElementById('movm-cuenta').value;
    if(!cuentaId){ showToast('Elegí una cuenta.'); return; }
    var monto = parseMontoInput(document.getElementById('movm-monto').value);
    var id = state.editingMovimientoId;
    var isNew = !id;
    var existing = id ? movimientoById(id) : null;
    if(existing && existing.pagoId){ showToast('Este movimiento viene de una orden de pago y no se puede editar acá.'); return; }
    if(isNew) id = newId('mov_');
    var fecha = document.getElementById('movm-fecha').value || todayStr();
    var detalle = document.getElementById('movm-concepto').value.trim();
    var chequeIds = [];
    var conDatos = (modo==='cartera' && tipo==='ingreso') || modo==='datos';
    var deCartera = modo==='cartera' && tipo==='egreso';
    if(deCartera){
      chequeIds = (state.editingMovCheques||[]).filter(function(cid){ return !!chequeById(cid); });
      if(!chequeIds.length){ showToast('Elegí los cheques de la cartera que salen.'); return; }
      monto = chequeIds.reduce(function(s,cid){ return s+Number(chequeById(cid).importe||0); }, 0);
    }
    if(isNaN(monto) || monto<=0){ showToast('Ingresá un importe válido.'); return; }
    var datos = {};
    if(conDatos){
      Object.keys(MOV_CHQ_FIELDS).forEach(function(k){ datos[k] = document.getElementById(MOV_CHQ_FIELDS[k]).value.trim(); });
      if(!datos.numero){ showToast('Ingresá el número de cheque.'); return; }
      if(!datos.banco){ showToast('Ingresá el banco del cheque.'); return; }
    }
    // Cheque con datos (entrada a cartera / recibido / propio emitido)
    if(conDatos){
      var prevId = existing && (existing.chequeIds||[])[0];
      var prev = prevId ? chequeById(prevId) : null;
      var chqId = prev ? prev.id : newId('chq_');
      var fijo = prev && prev.movIngresoId===id && ['cartera','recibido'].indexOf(prev.estado)===-1;
      if(fijo){ monto = Number(prev.importe||0); }
      else {
        var c = Object.assign({}, prev||{}, datos, {id:chqId, medioId:medioId, importe:monto});
        if(tipo==='ingreso'){
          Object.assign(c, {estado: modo==='cartera' ? 'cartera' : 'recibido', fechaIngreso:fecha, cuentaId:cuentaId, movIngresoId:id,
            destino: modo==='cartera' ? '' : 'Acreditado en '+cuentaNombre(cuentaId)});
        } else {
          Object.assign(c, {estado:'emitido', fechaSalida:fecha, cuentaId:cuentaId, movSalidaId:id, destino: detalle ? 'Emitido: '+detalle : 'Emitido'});
          if(!c.titular) c.titular = 'Anafer';
        }
        writeCheque(c);
      }
      chequeIds = [chqId];
    }
    if(!detalle){
      detalle = conDatos ? (medio.nombre+' — '+(datos.banco||'')+' N° '+(datos.numero||'')) : (medio ? medio.nombre : '');
    }
    // Salida con cheques de cartera: los elegidos quedan entregados, los que se destildaron vuelven.
    if(deCartera){
      state.cheques.filter(function(c){ return c.movSalidaId===id && chequeIds.indexOf(c.id)===-1; }).forEach(chequeVolverACartera);
      chequeIds.forEach(function(cid){
        var c = chequeById(cid);
        writeCheque(Object.assign({}, c, {estado:'entregado', fechaSalida:fecha, movSalidaId:id, destino:'Salida: '+detalle}));
      });
    }
    // Cheque/echeq propio (o recibido que se acredita directo): impacta en la cuenta el día de cobro.
    if(modo==='datos' && datos.fechaCobro) fecha = fechaImpacto(fecha, datos.fechaCobro);
    var m = {
      id:id, cuentaId:cuentaId, fecha:fecha, concepto:detalle, monto:monto, pagoId:'',
      notas: document.getElementById('movm-notas').value.trim(), tipo:tipo, medioId:medioId, chequeIds:chequeIds
    };
    upsertMovimientoLocal(m);
    closeMovimientoModal();
    renderTesoreria();
    showToast(tipo==='ingreso' ? 'Entrada guardada.' : 'Salida guardada.');
  });
  document.getElementById('movm-delete').addEventListener('click', function(){
    var id = state.editingMovimientoId;
    if(!id) return;
    var m = movimientoById(id);
    if(!m || esAnulado(m)) return;
    if(m.pagoId){ showToast('Este movimiento viene de una orden de pago: se anula anulando la orden de pago.'); return; }
    var chqs = (m.chequeIds||[]).map(chequeById).filter(Boolean);
    // Entrada con cheque: solo si el cheque sigue en cartera (o era solo registro).
    var trabado = chqs.find(function(c){ return c.movIngresoId===id && ['cartera','recibido'].indexOf(c.estado)===-1; });
    if(trabado){ showToast('No se puede anular: el cheque ya está '+(CHEQUE_ESTADOS[trabado.estado]||trabado.estado).toLowerCase()+'. Deshacé eso primero.'); return; }
    pedirAnulacion('Anular '+(m.tipo==='ingreso' ? 'entrada' : 'salida')+' de caja', (m.concepto||'')+' — '+fmtMoney(m.monto)+'. Queda registrado como anulado y deja de sumar al saldo.', function(motivo){
      chqs.forEach(function(c){
        if(c.movIngresoId===id || c.estado==='emitido') writeCheque(Object.assign({}, c, {estado:'anulado', destino:'Anulado — '+(c.destino||'')}));
        else if(c.movSalidaId===id) chequeVolverACartera(c);
      });
      upsertMovimientoLocal(sellarAnulacion(Object.assign({}, m), motivo));
      closeMovimientoModal();
      renderTesoreria();
      showToast('Movimiento anulado.');
    });
  });

  // ---------- Movimiento entre cuentas (de una caja o banco a otro) ----------
  // Son dos movimientos ligados por el id: mov_trf_<x>_sal (salida de la
  // cuenta de origen) y mov_trf_<x>_ent (entrada en la de destino), con la
  // misma fecha e importe. Se editan y se anulan juntos. No cambian el total
  // de la empresa: solo dónde está la plata. La cartera de cheques no
  // participa (los cheques se mueven depositándolos).
  function esTransferencia(m){ return !!m && /^mov_trf_.+_(sal|ent)$/.test(m.id||''); }
  function transferBase(id){ return String(id||'').replace(/_(sal|ent)$/, ''); }
  function transferPar(base){ return {sal: movimientoById(base+'_sal'), ent: movimientoById(base+'_ent')}; }
  function cuentasParaTransferir(incluir){
    return state.cuentas.filter(function(c){ return c.tipo!=='cartera' || incluir.indexOf(c.id)>=0; })
      .sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); });
  }
  function fmtMoneySigno(n){ return (n<0 ? '−' : '')+fmtMoney(Math.abs(n)); }
  function transferSaldos(){
    var base = state.editingTransfer;
    var par = base ? transferPar(base) : {};
    var monto = parseMontoInput(document.getElementById('trf-monto').value) || 0;
    var d = document.getElementById('trf-desde').value, h = document.getElementById('trf-hacia').value;
    var aviso = [];
    [['desde', d, -1, par.sal], ['hacia', h, 1, par.ent]].forEach(function(x){
      var el = document.getElementById('trf-saldo-'+x[0]);
      if(!x[1]){ el.textContent = ''; el.classList.remove('neg'); return; }
      // saldo de hoy sin este mismo movimiento (si se está editando)
      var hoy = cuentaSaldoActual(x[1]);
      if(x[3] && noAnulado(x[3]) && x[3].cuentaId===x[1] && (x[3].fecha||'')<=todayStr()) hoy -= (x[3].tipo==='ingreso'?1:-1)*Number(x[3].monto||0);
      var despues = hoy + x[2]*monto;
      el.textContent = 'Saldo hoy '+fmtMoneySigno(hoy)+(monto>0 ? ' → queda '+fmtMoneySigno(despues) : '');
      el.classList.toggle('neg', monto>0 && despues<0);
      if(x[0]==='desde' && monto>0 && despues<0) aviso.push('La cuenta de origen queda en negativo ('+fmtMoneySigno(despues)+'). Se puede guardar igual.');
    });
    if(d && h && d===h) aviso.unshift('Elegí dos cuentas distintas.');
    var av = document.getElementById('trf-aviso');
    av.textContent = aviso.join(' '); av.hidden = !aviso.length;
  }
  function openTransferModal(base){
    var par = base ? transferPar(base) : {};
    var m = par.sal || par.ent || null;
    if(base && !m){ showToast('No se encontró el movimiento.'); return; }
    state.editingTransfer = base || null;
    var incl = [par.sal && par.sal.cuentaId, par.ent && par.ent.cuentaId].filter(Boolean);
    var lista = cuentasParaTransferir(incl);
    ['trf-desde','trf-hacia'].forEach(function(id){ fillSelect(document.getElementById(id), lista, 'id', 'nombre', 'Elegir cuenta'); });
    var sel = document.getElementById('trf-medio');
    sel.innerHTML = '<option value="">— Sin concepto —</option>';
    mediosOrdenados(m && m.medioId).filter(function(x){ return x.cheque==='no' || (m && x.id===m.medioId); }).forEach(function(x){
      var o = document.createElement('option'); o.value = x.id; o.textContent = x.codigo+' — '+x.nombre; sel.appendChild(o);
    });
    var detalle = '';
    if(m){
      var c = m.concepto||'';
      var i = c.indexOf(' — '); detalle = i>=0 ? c.slice(i+3) : '';
    }
    document.getElementById('trf-desde').value = par.sal ? par.sal.cuentaId : '';
    document.getElementById('trf-hacia').value = par.ent ? par.ent.cuentaId : '';
    document.getElementById('trf-fecha').value = m ? (m.fecha||todayStr()) : todayStr();
    document.getElementById('trf-monto').value = m ? fmtMontoInput(m.monto||0) : '';
    sel.value = m ? (m.medioId||'') : '';
    document.getElementById('trf-detalle').value = detalle;
    document.getElementById('trf-notas').value = m ? (m.notas||'') : '';
    document.getElementById('trf-title').textContent = m ? 'Movimiento entre cuentas' : 'Nuevo movimiento entre cuentas';
    document.getElementById('trf-anular').style.display = m ? '' : 'none';
    marcarModalAnulado('trf-save', 'trf-anular', m, 'o');
    transferSaldos();
    document.getElementById('transfer-overlay').classList.add('show');
  }
  function closeTransferModal(){ document.getElementById('transfer-overlay').classList.remove('show'); }
  document.getElementById('new-transfer-btn').addEventListener('click', function(){ openTransferModal(null); });
  document.getElementById('trf-cancel').addEventListener('click', closeTransferModal);
  ['trf-desde','trf-hacia','trf-monto'].forEach(function(id){
    document.getElementById(id).addEventListener(id==='trf-monto' ? 'input' : 'change', transferSaldos);
  });
  document.getElementById('trf-swap').addEventListener('click', function(){
    var d = document.getElementById('trf-desde'), h = document.getElementById('trf-hacia'), t = d.value;
    d.value = h.value; h.value = t; transferSaldos();
  });
  document.getElementById('trf-save').addEventListener('click', function(){
    var desde = document.getElementById('trf-desde').value, hacia = document.getElementById('trf-hacia').value;
    if(!desde || !hacia){ showToast('Elegí de qué cuenta sale y en cuál entra.'); return; }
    if(desde===hacia){ showToast('Elegí dos cuentas distintas.'); return; }
    var monto = parseMontoInput(document.getElementById('trf-monto').value);
    if(isNaN(monto) || monto<=0){ showToast('Ingresá un importe válido.'); return; }
    var base = state.editingTransfer || newId('mov_trf_');
    var prev = state.editingTransfer ? transferPar(base) : {};
    if((prev.sal && esAnulado(prev.sal)) || (prev.ent && esAnulado(prev.ent))){ showToast('Este movimiento está anulado.'); return; }
    var fecha = document.getElementById('trf-fecha').value || todayStr();
    var medioId = document.getElementById('trf-medio').value || null;
    var det = document.getElementById('trf-detalle').value.trim();
    var notas = document.getElementById('trf-notas').value.trim();
    var nd = cuentaNombre(desde), nh = cuentaNombre(hacia);
    var comun = {fecha:fecha, monto:r2(monto), pagoId:'', notas:notas, medioId:medioId, chequeIds:[]};
    upsertMovimientoLocal(Object.assign({}, prev.sal||{}, comun, {id:base+'_sal', cuentaId:desde, tipo:'egreso', concepto:'Transferencia a '+nh+(det ? ' — '+det : '')}));
    upsertMovimientoLocal(Object.assign({}, prev.ent||{}, comun, {id:base+'_ent', cuentaId:hacia, tipo:'ingreso', concepto:'Transferencia desde '+nd+(det ? ' — '+det : '')}));
    closeTransferModal();
    renderTesoreria();
    showToast(state.editingTransfer ? 'Movimiento entre cuentas actualizado.' : 'Listo: '+fmtMoney(monto)+' de '+nd+' a '+nh+'.');
  });
  document.getElementById('trf-anular').addEventListener('click', function(){
    var base = state.editingTransfer;
    if(!base) return;
    var par = transferPar(base);
    var m = par.sal || par.ent;
    if(!m || esAnulado(m)) return;
    pedirAnulacion('Anular movimiento entre cuentas', (par.sal ? cuentaNombre(par.sal.cuentaId) : '?')+' → '+(par.ent ? cuentaNombre(par.ent.cuentaId) : '?')+' — '+fmtMoney(m.monto)+'. Se anulan la salida y la entrada; dejan de sumar a los saldos.', function(motivo){
      var sello = sellarAnulacion({}, motivo);
      [par.sal, par.ent].filter(Boolean).forEach(function(x){ upsertMovimientoLocal(Object.assign({}, x, sello)); });
      closeTransferModal();
      renderTesoreria();
      showToast('Movimiento entre cuentas anulado.');
    });
  });

  // ---------- Detalle de cheque: depositar / rechazar / deshacer ----------
  function openChequeModal(id){
    var c = chequeById(id);
    if(!c) return;
    state.editingChequeId = id;
    document.getElementById('chq-title').textContent = chequeResumen(c);
    document.getElementById('chq-sub').innerHTML = '<span class="chq-estado '+esc(c.estado)+'">'+(CHEQUE_ESTADOS[c.estado]||c.estado)+'</span> '+esc(c.destino||'');
    var rows = [['Importe', fmtMoney(c.importe)], ['Fecha de cobro', c.fechaCobro||'—'], ['Titular', c.titular||'—'],
      ['Banco', c.banco||'—'], ['Sucursal', c.sucursal||'—'], ['Localidad', c.localidad||'—'], ['N° cuenta', c.nroCuenta||'—'],
      ['Concepto', medioLabel(c.medioId)||'—'], ['Ingresó', c.fechaIngreso||'—'], ['Está en', c.cuentaId ? cuentaNombre(c.cuentaId) : '—']];
    document.getElementById('chq-detail').innerHTML = rows.map(function(r){ return '<div class="k">'+r[0]+'</div><div>'+esc(r[1])+'</div>'; }).join('');
    document.getElementById('chq-deposito-box').hidden = true;
    var e = c.estado;
    document.getElementById('chq-btn-depositar').hidden = e!=='cartera';
    document.getElementById('chq-btn-rechazar').hidden = !(e==='cartera' || e==='depositado');
    document.getElementById('chq-btn-deshacer').hidden = !(e==='depositado' || e==='rechazado');
    document.getElementById('chq-btn-deshacer').textContent = e==='depositado' ? 'Deshacer depósito' : 'Deshacer rechazo';
    document.getElementById('cheque-overlay').classList.add('show');
  }
  function closeChequeModal(){ document.getElementById('cheque-overlay').classList.remove('show'); }
  document.getElementById('chq-cancel').addEventListener('click', closeChequeModal);
  document.getElementById('chq-btn-depositar').addEventListener('click', function(){
    var sel = document.getElementById('chq-dep-cuenta');
    fillSelect(sel, state.cuentas.filter(function(c){ return c.tipo==='banco'; }).sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }), 'id', 'nombre', 'Elegir banco');
    if(!sel.options.length || sel.options.length===1) fillMovimientoCuentaSelect(sel);
    document.getElementById('chq-dep-fecha').value = todayStr();
    document.getElementById('chq-deposito-box').hidden = false;
  });
  document.getElementById('chq-dep-confirm').addEventListener('click', function(){
    var c = chequeById(state.editingChequeId);
    if(!c || c.estado!=='cartera') return;
    var dest = document.getElementById('chq-dep-cuenta').value;
    if(!dest){ showToast('Elegí la cuenta donde se deposita.'); return; }
    var fecha = document.getElementById('chq-dep-fecha').value || todayStr();
    var desc = 'Depósito '+chequeResumen(c);
    upsertMovimientoLocal({id:'mov_chq_dep_out_'+c.id, cuentaId:c.cuentaId, fecha:fecha, tipo:'egreso', medioId:c.medioId, concepto:desc, monto:c.importe, pagoId:'', notas:'', chequeIds:[c.id]});
    upsertMovimientoLocal({id:'mov_chq_dep_in_'+c.id, cuentaId:dest, fecha:fecha, tipo:'ingreso', medioId:c.medioId, concepto:desc, monto:c.importe, pagoId:'', notas:'', chequeIds:[c.id]});
    writeCheque(Object.assign({}, c, {estado:'depositado', cuentaId:dest, fechaSalida:fecha, destino:'Depositado en '+cuentaNombre(dest)}));
    closeChequeModal(); renderTesoreria(); showToast('Cheque depositado.');
  });
  document.getElementById('chq-btn-rechazar').addEventListener('click', function(){
    var c = chequeById(state.editingChequeId);
    if(!c || (c.estado!=='cartera' && c.estado!=='depositado')) return;
    // El rechazo saca el importe de donde esté el cheque (la cartera o el banco donde se depositó).
    upsertMovimientoLocal({id:'mov_chq_rech_'+c.id, cuentaId:c.cuentaId, fecha:todayStr(), tipo:'egreso', medioId:c.medioId,
      concepto:'Cheque rechazado — '+chequeResumen(c), monto:c.importe, pagoId:'', notas:'', chequeIds:[c.id]});
    writeCheque(Object.assign({}, c, {estado:'rechazado', destino:'Rechazado'+(c.estado==='depositado' ? ' (estaba depositado en '+cuentaNombre(c.cuentaId)+')' : '')}));
    closeChequeModal(); renderTesoreria(); showToast('Cheque marcado como rechazado.');
  });
  document.getElementById('chq-btn-deshacer').addEventListener('click', function(){
    var c = chequeById(state.editingChequeId);
    if(!c) return;
    if(c.estado==='rechazado'){
      deleteMovimiento('mov_chq_rech_'+c.id);
      var depIn = movimientoById('mov_chq_dep_in_'+c.id);
      writeCheque(Object.assign({}, c, depIn ? {estado:'depositado', destino:'Depositado en '+cuentaNombre(depIn.cuentaId)} : {estado:'cartera', destino:''}));
      showToast('Rechazo deshecho.');
    } else if(c.estado==='depositado'){
      var out = movimientoById('mov_chq_dep_out_'+c.id);
      deleteMovimiento('mov_chq_dep_out_'+c.id);
      deleteMovimiento('mov_chq_dep_in_'+c.id);
      writeCheque(Object.assign({}, c, {estado:'cartera', cuentaId: out ? out.cuentaId : c.cuentaId, fechaSalida:'', destino:''}));
      showToast('Depósito deshecho: el cheque volvió a la cartera.');
    }
    closeChequeModal(); renderTesoreria();
  });

  // ---------- ABM conceptos de caja (⚙ → Tesorería) ----------
  function renderMediosList(){
    var body = document.getElementById('medios-caja-body');
    if(!body) return;
    body.innerHTML = '';
    if(!state.medios.length){
      body.innerHTML = '<tr class="day-row empty"><td colspan="4">Todavía no hay conceptos de caja (¿corriste el schema.sql nuevo?).</td></tr>';
      return;
    }
    var modoLbl = {no:'—', cartera:'Terceros → cartera', datos:'Pide datos'};
    state.medios.slice().sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||''); }).forEach(function(m){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      tr.style.opacity = m.activo ? '' : '0.5';
      tr.innerHTML = '<td class="day-route num">'+esc(m.codigo)+'</td><td>'+esc(m.nombre)+(m.activo?'':' (inactivo)')+'</td>'
        +'<td>'+(m.cuentaId ? esc(cuentaNombre(m.cuentaId)) : '<span style="color:var(--danger);">Sin cuenta</span>')+'</td>'
        +'<td>'+(modoLbl[m.cheque]||'—')+'</td>';
      tr.addEventListener('click', function(){ openMedioModal(m.id); });
      body.appendChild(tr);
    });
  }
  function writeMedio(m){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('medios_caja').upsert({id:m.id, codigo:m.codigo, nombre:m.nombre, cuenta_id:m.cuentaId||null, cheque:m.cheque||'no', activo:!!m.activo})
      .then(function(res){ if(res.error) showToast('No se pudo guardar el concepto de caja: '+res.error.message); });
  }
  function openMedioModal(id){
    state.editingMedioId = id || null;
    var m = id ? medioById(id) : null;
    document.getElementById('mcm-title').textContent = m ? 'Editar concepto de caja' : 'Nuevo concepto de caja';
    document.getElementById('mcm-codigo').value = m ? m.codigo : '';
    document.getElementById('mcm-nombre').value = m ? m.nombre : '';
    fillMovimientoCuentaSelect(document.getElementById('mcm-cuenta'));
    document.getElementById('mcm-cuenta').value = m ? (m.cuentaId||'') : '';
    document.getElementById('mcm-cheque').value = m ? (m.cheque||'no') : 'no';
    document.getElementById('mcm-activo').checked = m ? !!m.activo : true;
    document.getElementById('mcm-delete').style.display = m ? '' : 'none';
    document.getElementById('medio-overlay').classList.add('show');
  }
  function closeMedioModal(){ document.getElementById('medio-overlay').classList.remove('show'); }
  document.getElementById('new-medio-btn').addEventListener('click', function(){ openMedioModal(null); });
  document.getElementById('mcm-cancel').addEventListener('click', closeMedioModal);
  document.getElementById('mcm-save').addEventListener('click', function(){
    var codigo = document.getElementById('mcm-codigo').value.trim().toUpperCase();
    var nombre = document.getElementById('mcm-nombre').value.trim();
    if(!codigo || !nombre){ showToast('Completá código y concepto.'); return; }
    var id = state.editingMedioId;
    if(state.medios.some(function(x){ return x.id!==id && (x.codigo||'').toUpperCase()===codigo; })){ showToast('Ya existe un concepto con ese código.'); return; }
    if(!id){ id = slug(codigo); var n = 2; while(medioById(id)) id = slug(codigo)+'_'+(n++); }
    var m = {id:id, codigo:codigo, nombre:nombre, cuentaId:document.getElementById('mcm-cuenta').value, cheque:document.getElementById('mcm-cheque').value, activo:document.getElementById('mcm-activo').checked};
    var idx = state.medios.findIndex(function(x){ return x.id===id; });
    if(idx>=0) state.medios[idx]=m; else state.medios.push(m);
    writeMedio(m);
    closeMedioModal(); renderMediosList(); showToast('Concepto de caja guardado.');
  });
  document.getElementById('mcm-delete').addEventListener('click', function(){
    var id = state.editingMedioId;
    if(!id) return;
    var usado = state.movimientos.some(function(m){ return m.medioId===id; }) || state.ordenesPago.some(function(p){ return p.medioId===id; });
    if(usado){ showToast('No se puede eliminar: tiene movimientos u órdenes de pago. Podés desactivarlo.'); return; }
    state.medios = state.medios.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('medios_caja').delete().eq('id', id).then(function(res){ if(res.error) showToast('No se pudo eliminar: '+res.error.message); });
    closeMedioModal(); renderMediosList(); showToast('Concepto de caja eliminado.');
  });

  function mapCuentaRow(row){
    return {
      id:row.id, nombre:row.nombre||row.id, tipo:row.tipo||'caja',
      saldoInicial:typeof row.saldo_inicial==='number'?row.saldo_inicial:parseFloat(row.saldo_inicial)||0,
      notas:row.notas||''
    };
  }
  function mapMovimientoRow(row){
    return leerAnulacion(row, {
      id:row.id, cuentaId:row.cuenta_id||'', fecha:row.fecha||'', concepto:row.concepto||'',
      monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0, pagoId:row.pago_id||'', notas:row.notas||'',
      tipo:row.tipo||'egreso', medioId:row.medio_id||'', chequeIds:Array.isArray(row.cheque_ids)?row.cheque_ids:[]
    });
  }
  function mapChequeRow(r){
    return {
      id:r.id, medioId:r.medio_id||'', banco:r.banco||'', sucursal:r.sucursal||'', localidad:r.localidad||'', numero:r.numero||'',
      nroCuenta:r.nro_cuenta||'', titular:r.titular||'', fechaCobro:r.fecha_cobro||'',
      importe:typeof r.importe==='number'?r.importe:parseFloat(r.importe)||0, estado:r.estado||'cartera',
      fechaIngreso:r.fecha_ingreso||'', cuentaId:r.cuenta_id||'', movIngresoId:r.mov_ingreso_id||'', fechaSalida:r.fecha_salida||'',
      destino:r.destino||'', pagoId:r.pago_id||'', proveedorId:r.proveedor_id||'', movSalidaId:r.mov_salida_id||'', notas:r.notas||''
    };
  }
  function fetchTesoreria(){
    if(!state.sb) return;
    state.sb.from('cuentas').select('*').then(function(res){
      if(res.error){ showToast('Error cargando cuentas: '+res.error.message); return; }
      state.cuentas = (res.data||[]).map(mapCuentaRow);
      renderTesoreria(); renderMediosList();
    });
    fetchAllRows('movimientos').then(function(res){
      if(res.error){ showToast('Error cargando movimientos: '+res.error.message); return; }
      state.movimientos = (res.data||[]).map(mapMovimientoRow);
      renderTesoreria();
    });
    state.sb.from('medios_caja').select('*').then(function(res){
      if(res.error){ showToast('Error cargando conceptos de caja (¿corriste el schema.sql nuevo?): '+res.error.message); return; }
      state.medios = (res.data||[]).map(function(r){ return {id:r.id, codigo:r.codigo||'', nombre:r.nombre||'', cuentaId:r.cuenta_id||'', cheque:r.cheque||'no', activo:r.activo!==false}; });
      renderTesoreria(); renderMediosList();
    });
    fetchAllRows('cheques').then(function(res){
      if(res.error){ showToast('Error cargando cheques: '+res.error.message); return; }
      state.cheques = (res.data||[]).map(mapChequeRow);
      renderTesoreria();
    });
  }

  document.getElementById('settings-btn').addEventListener('click', function(){
    renderSettings();
    switchSettingsTab(state.settingsTab);
    document.getElementById('settings-overlay').classList.add('show');
  });
  document.getElementById('settings-close').addEventListener('click', function(){
    document.getElementById('settings-overlay').classList.remove('show');
  });

  document.getElementById('add-role-btn').addEventListener('click', function(){
    var list = document.getElementById('roles-list');
    var card = buildRoleCard({id:'perfil_'+Date.now().toString(36), nombre:'', password:'', manageAccess:false, permisos:defaultPermisos('oculta')});
    card.dataset.nuevo = '1';   // al guardar, el código sale del nombre (ej. "RR.HH." → rrhh)
    list.appendChild(card);
  });

  document.getElementById('auth-save-btn').addEventListener('click', function(){
    var cards = document.querySelectorAll('#roles-list .role-card');
    if(cards.length===0){ showToast('Tiene que haber al menos un perfil.'); return; }
    var roles = [];
    var pwSeen = {};
    var anyManage = false;
    for(var i=0;i<cards.length;i++){
      var card = cards[i];
      var nombre = card.querySelector('.role-nombre').value.trim();
      var password = card.querySelector('.role-password').value.trim();
      if(!nombre){ showToast('Completá el nombre de todos los perfiles.'); return; }
      if(password && pwSeen[password]){ showToast('Las contraseñas de los perfiles tienen que ser todas distintas.'); return; }
      if(password) pwSeen[password] = true;
      var manageAccess = card.querySelector('.role-manage-access').checked;
      if(manageAccess) anyManage = true;
      var permisos = {};
      card.querySelectorAll('.role-permiso-select').forEach(function(sel){ permisos[sel.dataset.tab] = sel.value; });
      if(card.dataset.nuevo){
        var base = nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'') || 'perfil';
        var cand = base, n = 2;
        var usados = Array.prototype.map.call(cards, function(c){ return c.dataset.nuevo ? null : c.dataset.roleId; }).concat(roles.map(function(x){ return x.id; }));
        while(usados.indexOf(cand)!==-1 || cand==='__comercial__'){ cand = base+'_'+(n++); }
        card.dataset.roleId = cand;
      }
      roles.push({id: card.dataset.roleId, nombre: nombre, password: password, manageAccess: manageAccess, permisos: permisos});
    }
    if(!anyManage){ showToast('Al menos un perfil tiene que poder administrar el acceso.'); return; }
    var btn = this; btn.disabled = true;
    writeAuthRoles(roles).then(function(ok){
      btn.disabled = false;
      if(!ok) return;
      document.querySelectorAll('#roles-list .role-card').forEach(function(c){ delete c.dataset.nuevo; });
      state.auth.roles = roles;
      refreshTabVisibility();
      refreshSettingsTabsVisibility();
      renderUsuarios();
      showToast('Perfiles guardados.');
    });
  });

  document.getElementById('add-route-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-route-input');
    var v = inp.value.trim();
    if(!v) return;
    var id = v.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,16);
    if(!id || state.routes.some(function(r){return r.id===id;})){ showToast('Nombre de ruta inválido o ya existe.'); return; }
    var maxOrder = state.routes.reduce(function(m,r){return Math.max(m,r.order||0);},0);
    var r = {id:id, label:v, order:maxOrder+1, active:true};
    state.routes.push(r);
    writeRoute(r);
    inp.value='';
    renderSettings(); renderGrid();
  });
  document.getElementById('add-truck-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-truck-input');
    var v = inp.value.trim();
    if(!v) return;
    var id = v.replace(/[^A-Za-z0-9]/g,'').slice(0,10);
    if(!id || state.trucks.some(function(t){return t.id===id;})){ showToast('Número de camión inválido o ya existe.'); return; }
    var t = {id:id, label:'Camión '+v, active:true, driver:'', helper:'', scope:'both'};
    state.trucks.push(t);
    writeTruck(t);
    inp.value='';
    renderSettings(); renderGrid();
  });
  document.getElementById('add-driver-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-driver-input');
    var v = inp.value.trim();
    if(!v) return;
    var id = slug(v);
    if(state.drivers.some(function(d){return d.id===id;})){ showToast('Ese chofer ya está en la lista.'); return; }
    var d = {id:id, name:v, active:true, scope:'both'};
    state.drivers.push(d);
    writeDriver(d);
    inp.value='';
    renderSettings();
  });
  document.getElementById('add-helper-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-helper-input');
    var v = inp.value.trim();
    if(!v) return;
    var id = slug(v);
    if(state.helpers.some(function(h){return h.id===id;})){ showToast('Ese ayudante ya está en la lista.'); return; }
    var h = {id:id, name:v, active:true, scope:'both'};
    state.helpers.push(h);
    writeHelper(h);
    inp.value='';
    renderSettings();
  });
  document.getElementById('add-cargo-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-cargo-input');
    var v = inp.value.trim();
    if(!v) return;
    var id = slug(v);
    if(state.cargoTypes.some(function(c){return c.id===id;})){ showToast('Ese tipo de carga ya está en la lista.'); return; }
    var maxOrder = state.cargoTypes.reduce(function(m,c){return Math.max(m,c.order||0);},0);
    var c = {id:id, name:v, active:true, order:maxOrder+1};
    state.cargoTypes.push(c);
    writeCargoType(c);
    inp.value='';
    renderSettings();
  });
  document.getElementById('add-branch-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-branch-input');
    var v = inp.value.trim();
    if(!v) return;
    var id = slug(v);
    if(!id || state.branches.some(function(b){return b.id===id;})){ showToast('Nombre de sucursal inválido o ya existe.'); return; }
    var maxOrder = state.branches.reduce(function(m,b){return Math.max(m,b.order||0);},0);
    var b = {id:id, label:v, order:maxOrder+1, active:true};
    state.branches.push(b);
    writeBranch(b);
    inp.value='';
    renderSettings(); renderBranchGrid();
  });
  EXTRA_KINDS.forEach(function(kind){
    document.getElementById(kind.addBtnId).addEventListener('click', function(){
      var inp = document.getElementById(kind.newInputId);
      var v = inp.value.trim();
      if(!v) return;
      var id = slug(v);
      var s = state.extra[kind.key];
      if(!id || s.items.some(function(x){return x.id===id;})){ showToast('Nombre inválido o ya existe.'); return; }
      var maxOrder = s.items.reduce(function(m,x){return Math.max(m,x.order||0);},0);
      var item = {id:id, label:v, order:maxOrder+1, active:true};
      s.items.push(item);
      writeExtraItem(kind, item);
      inp.value='';
      renderSettings(); renderExtraGrid(kind);
    });
  });

  // ---------- Supabase wiring ----------
  function mapRouteRow(row){ return {id:row.id, label:row.label||row.id, order:row.sort_order||99, active:row.active!==false}; }
  function mapTruckRow(row){ return {id:row.id, label:row.label||('Camión '+row.id), active:row.active!==false, driver:row.driver||'', helper:row.helper||'', scope:row.scope||'both',
    patente:row.patente||'', modelo:row.modelo||'', anio:row.anio||'', funcion:row.funcion||'', flota:row.flota||''}; }
  function mapPersonRow(row){ return {id:row.id, name:row.name||row.id, active:row.active!==false, scope:row.scope||'both'}; }
  function mapCargoTypeRow(row){ return {id:row.id, name:row.name||row.id, active:row.active!==false, order:row.sort_order||99}; }
  function mapBranchRow(row){ return {id:row.id, label:row.label||row.id, order:row.sort_order||99, active:row.active!==false}; }
  function mapExtraItemRow(row){ return {id:row.id, label:row.label||row.id, order:row.sort_order||99, active:row.active!==false}; }

  // ======================================================================
  // Asistente con memoria: "Sifoncito sugiere"
  // ======================================================================
  // Mira el historial que ya está en la base y, mientras se trabaja, propone:
  //  - viajes y envíos que se repiten → cargarlos para los próximos 6 meses;
  //  - facturas: posibles duplicadas, montos fuera de lo habitual, imputación
  //    distinta de la de siempre, y las mensuales que este mes no llegaron;
  //  - órdenes de pago: pagar como se le paga siempre a ese proveedor.
  // Lo que cada usuario contesta se recuerda en la tabla ayudante_memoria
  // (si no existe, en el navegador): "No me lo preguntes más" no vuelve a
  // aparecer; "Ahora no" espera un tiempo antes de volver a proponerlo.
  var MEM_LS = 'ayudante_memoria';
  state.memoria = {};
  function memUsuario(){ return state.sessionEmail || 'sin-sesion'; }
  function memLeerLS(){ try{ return JSON.parse(localStorage.getItem(MEM_LS+':'+memUsuario())||'{}') || {}; }catch(e){ return {}; } }
  function memListo(){
    var u = memUsuario();
    if(state.memPromesa && state.memDe===u) return state.memPromesa;
    state.memDe = u;
    state.memoria = memLeerLS();
    state.memTabla = false;
    state.memPromesa = !state.sb ? Promise.resolve() : Promise.resolve(state.sb.from('ayudante_memoria').select('*').eq('usuario', u)).then(function(res){
      if(!res || res.error) return; // sin la tabla: queda la memoria del navegador
      state.memTabla = true;
      (res.data||[]).forEach(function(r){ if(r.usuario===u) state.memoria[r.clave] = {decision:r.decision||'', hasta:r.hasta||''}; });
    }, function(){});
    return state.memPromesa;
  }
  function memPuede(clave){
    var m = state.memoria[clave];
    if(!m) return true;
    if(m.decision==='nunca') return false;
    return !(m.hasta && m.hasta > todayStr());
  }
  function memGuardar(clave, decision, hasta){
    state.memoria[clave] = {decision:decision, hasta:hasta||''};
    try{ localStorage.setItem(MEM_LS+':'+memUsuario(), JSON.stringify(state.memoria)); }catch(e){}
    if(state.sb && state.memTabla) state.sb.from('ayudante_memoria').upsert({
      id:memUsuario()+'|'+clave, usuario:memUsuario(), clave:clave, decision:decision, hasta:hasta||null, actualizado:new Date().toISOString()
    }).then(function(){}, function(){});
  }
  function sumarDias(ds, n){ var d = new Date(ds+'T12:00:00'); d.setDate(d.getDate()+n); return dateStr(d.getFullYear(), d.getMonth(), d.getDate()); }
  function difDias(a, b){ return Math.round((new Date(b+'T12:00:00') - new Date(a+'T12:00:00'))/86400000); }
  function wdDe(ds){ return pyWeekday(new Date(ds+'T12:00:00')); }
  function mediana(xs){ var v = xs.slice().sort(function(a,b){ return a-b; }); if(!v.length) return 0; var m = Math.floor(v.length/2); return v.length%2 ? v[m] : (v[m-1]+v[m])/2; }
  function sifSugerir(op){ return !!(window.AyudaAnafer && window.AyudaAnafer.sugerir && window.AyudaAnafer.sugerir(op)); }
  function sifCerrarSi(prefijo){
    var A = window.AyudaAnafer;
    if(A && A.sugerenciaActual && String(A.sugerenciaActual()||'').indexOf(prefijo)===0) A.cerrarSugerencia();
  }
  function conMemoria(op, clave, diasPosponer, conNunca){
    op.ahoraNo = function(){ memGuardar(clave, 'pospuesta', sumarDias(todayStr(), diasPosponer||30)); };
    if(conNunca!==false) op.nunca = function(){ memGuardar(clave, 'nunca'); };
    return op;
  }
  function listaNatural(xs){ return xs.length<=1 ? (xs[0]||'') : xs.slice(0,-1).join(', ')+' y '+xs[xs.length-1]; }

  // ---------- Filtros: marcar los que están en uso ----------
  // Un filtro "en uso" (un desplegable que no está en su primera opción, o
  // una búsqueda con texto) se tiñe con el color del área; en las barras de
  // filtros aparece "✕ Limpiar" solo si hay alguno en uso.
  var SEL_FILTROS = '.toolbar select.scope-select, .compras-section-head select.scope-select, .fbar select.scope-select, .prov-search';
  function filtroActivo(el){ return el.tagName==='SELECT' ? el.selectedIndex>0 : !!String(el.value||'').trim(); }
  function marcarFiltros(){
    Array.prototype.forEach.call(document.querySelectorAll(SEL_FILTROS), function(el){ el.classList.toggle('f-activo', filtroActivo(el)); });
    Array.prototype.forEach.call(document.querySelectorAll('.fbar-limpiar[data-fbar]'), function(b){
      var bar = document.getElementById(b.dataset.fbar);
      b.hidden = !bar || !Array.prototype.some.call(bar.querySelectorAll('select.scope-select, .prov-search'), filtroActivo);
    });
  }
  ['change','input'].forEach(function(ev){
    document.addEventListener(ev, function(e){ if(e.target && e.target.matches && e.target.matches(SEL_FILTROS)) marcarFiltros(); }, true);
  });

  // ---------- API para los módulos que viven en otro archivo (calidad.js) ----------
  window.GestionAnafer = {
    sb: function(){ return state.sb; },
    usuario: function(){ return state.sessionEmail || whoName(); },
    area: function(){ return state.area; },
    irA: function(v){ setView(v); },
    vista: function(){ return state.view; },
    canEdit: canEdit, tabPermiso: tabPermiso, showToast: showToast, esc: esc, todayStr: todayStr,
    fetchAllRows: fetchAllRows, renderBarList: renderBarList, tally: tally, MESES: MONTH_NAMES,
    pedirMotivo: function(titulo, detalle, cb){ pedirAnulacion(titulo, detalle, cb, true); },
    anulacionTexto: anulacionTexto,
    memListo: memListo, memPuede: memPuede, memGuardar: memGuardar, sumarDias: sumarDias, difDias: difDias,
    sugerir: sifSugerir, conMemoria: conMemoria, cerrarSugerenciaSi: sifCerrarSi, marcarFiltros: marcarFiltros,
    // Para los Dashboards: lo que Gestión ya tiene cargado y cómo leerlo
    datos: function(){ return { facturas: state.facturas, ordenesPago: state.ordenesPago, proveedores: state.proveedores, cuentas: state.cuentas,
      movimientos: state.movimientos, cheques: state.cheques, routes: state.routes, trucks: state.trucks, branches: state.branches, facturasCargadas: !!state.facturasCargadas }; },
    esAnulado: esAnulado, facturaLineas: facturaLineas, ccRaiz: ccRaiz, ccNombre: ccNombre, ccRuta: ccRuta, proveedorNombre: proveedorNombre,
    labelForRoute: labelForRoute, branchLabel: branchLabel, cuentaSaldoActual: cuentaSaldoActual, cuentaSaldoProyectado: cuentaSaldoProyectado,
    fmtMoney: fmtMoney, AREAS: AREAS,
    imprimirDocumento: imprimirDocumento, impKV: impKV, impTabla: impTabla, impTotales: impTotales, impFecha: impFecha,
    // Google Drive (adjuntos): carpetas = ["Calidad", "Reclamos 2026", …] dentro de la carpeta raíz
    driveListo: driveReady, driveSubir: function(file, carpetas){ return uploadAdjunto(file, null, carpetas); }, driveBorrar: deleteAdjunto, fmtBytes: fmtBytes
  };

  // ---------- 1) Viajes y envíos que se repiten ----------
  var DIAS_PLURAL = ['lunes','martes','miércoles','jueves','viernes','sábados','domingos'];
  var DIAS_CORTO = ['lun','mar','mié','jue','vie','sáb','dom'];
  var MESES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  var FERIADOS_FIJOS = {'01-01':'Año Nuevo','03-24':'Día de la Memoria','04-02':'Malvinas','05-01':'Día del Trabajador','05-25':'25 de Mayo',
    '06-20':'Día de la Bandera','07-09':'Independencia','12-08':'Inmaculada Concepción','12-25':'Navidad'};
  // cfg: {tabla, campo, valor, que ('viaje'|'envío'), nombre, fecha, camion,
  //       plantilla: objeto a copiar en cada fecha, idDe(fecha), recargar()}
  function revisarRepeticion(cfg){
    if(!state.sb || !cfg.valor || !cfg.fecha) return Promise.resolve();
    var clave = 'repetir:'+cfg.tabla+':'+cfg.valor;
    return memListo().then(function(){
      if(!memPuede(clave)) return;
      var desde = sumarDias(cfg.fecha, -182), hasta = sumarDias(cfg.fecha, 182);
      return Promise.resolve(state.sb.from(cfg.tabla).select('*').eq(cfg.campo, cfg.valor).gte('date', desde).lte('date', hasta)).then(function(res){
        if(!res || res.error) return;
        var filas = (res.data||[]).filter(function(r){ return r[cfg.campo]===cfg.valor && r.date && r.date>=desde && r.date<=hasta; });
        var pasadas = filas.filter(function(r){ return r.date < cfg.fecha; });
        if(!pasadas.length) return;
        // Semanas observadas: desde la primera vez (máximo 26). Un día de la
        // semana "se repite" si salió en el 60% o más de esas semanas.
        var primera = pasadas.reduce(function(m,r){ return r.date<m ? r.date : m; }, cfg.fecha);
        var semanas = Math.min(26, Math.floor(difDias(primera, cfg.fecha)/7)+1);
        if(semanas < 6) return;
        var porDia = [0,0,0,0,0,0,0], vistos = {};
        pasadas.forEach(function(r){ if(vistos[r.date]) return; vistos[r.date] = true; if(difDias(r.date, cfg.fecha) <= semanas*7) porDia[wdDe(r.date)]++; });
        var umbral = Math.max(5, Math.ceil(semanas*0.6));
        var dias = []; porDia.forEach(function(n, w){ if(n>=umbral) dias.push(w); });
        if(dias.indexOf(wdDe(cfg.fecha))===-1) return;
        var ocupadas = {}; filas.forEach(function(r){ if(r.date>cfg.fecha) ocupadas[r.date] = true; });
        var cand = [];
        for(var i=1;i<=182;i++){ var ds = sumarDias(cfg.fecha, i); if(dias.indexOf(wdDe(ds))!==-1 && !ocupadas[ds]) cand.push(ds); }
        if(cand.length < 4) return;
        // El mismo camión ya comprometido en otra ruta ese día → se propone destildado.
        var pChoque = (cfg.tabla==='trips' && cfg.camion)
          ? Promise.resolve(state.sb.from('trips').select('*').eq('truck', cfg.camion).gte('date', cand[0]).lte('date', cand[cand.length-1]))
          : Promise.resolve({data:[]});
        return pChoque.then(function(r2){
          var choque = {};
          ((r2 && r2.data)||[]).forEach(function(t){ if(t.truck===cfg.camion && t.route_id!==cfg.valor && t.date>=cand[0]) choque[t.date] = true; });
          proponerRepeticion(cfg, clave, dias, porDia, semanas, cand, choque);
        });
      });
    }).catch(function(err){ console.warn('Asistente (repetición):', err); });
  }
  function proponerRepeticion(cfg, clave, dias, porDia, semanas, cand, choque){
    var cuerpo = document.createElement('div');
    var porMes = {};
    cand.forEach(function(ds){ (porMes[ds.slice(0,7)] = porMes[ds.slice(0,7)] || []).push(ds); });
    var html = '<div class="sug-fechas">';
    Object.keys(porMes).sort().forEach(function(m){
      html += '<div><div class="sug-mes">'+MONTH_NAMES[Number(m.slice(5,7))-1]+' '+m.slice(0,4)+'</div><div class="sug-dias">';
      porMes[m].forEach(function(ds){
        var fer = FERIADOS_FIJOS[ds.slice(5)], ch = choque[ds];
        var on = !fer && !ch;
        var tit = fer ? 'Feriado: '+fer : (ch ? 'El camión ya tiene otro viaje ese día' : '');
        html += '<label class="'+(on?'':'off')+(fer?' fer':'')+'" title="'+esc(tit)+'"><input type="checkbox" value="'+ds+'"'+(on?' checked':'')+'>'
          +DIAS_CORTO[wdDe(ds)]+' '+Number(ds.slice(8))+(fer?' 🎌':'')+(ch?' 🚚':'')+'</label>';
      });
      html += '</div></div>';
    });
    html += '</div>';
    var nf = cand.filter(function(ds){ return FERIADOS_FIJOS[ds.slice(5)]; }).length, nc = Object.keys(choque).filter(function(ds){ return cand.indexOf(ds)!==-1; }).length;
    if(nf || nc) html += '<div class="sug-nota">Destildé '+[nf ? nf+' feriado'+(nf>1?'s':'')+' 🎌' : '', nc ? nc+' día'+(nc>1?'s':'')+' en que el camión ya tiene otro viaje 🚚' : ''].filter(Boolean).join(' y ')+'. Tocá un día para sacarlo o agregarlo.</div>';
    else html += '<div class="sug-nota">Tocá un día para sacarlo (por ejemplo, un feriado puente).</div>';
    cuerpo.innerHTML = html;
    var plural = cfg.que==='viaje' ? 'viajes' : 'envíos';
    var veces = dias.map(function(w){ return porDia[w]; });
    var texto = (cfg.que==='viaje' ? 'La ruta <b>' : 'A <b>')+esc(cfg.nombre)+'</b> '+(cfg.que==='viaje' ? 'salió' : 'se mandó')+' los <b>'+listaNatural(dias.map(function(w){ return DIAS_PLURAL[w]; }))+'</b> casi todas las semanas'
      +' (en las últimas '+semanas+' semanas: '+listaNatural(dias.map(function(w,i){ return veces[i]+' '+DIAS_PLURAL[w]; }))+'). '
      +'¿Cargo '+(cfg.que==='viaje' ? 'el mismo viaje' : 'el mismo envío')+(cfg.camion ? ', con el camión '+esc(String(cfg.camion)) : '')+', para los próximos 6 meses?';
    var op = conMemoria({id:clave, titulo:'Sifoncito: esto se repite', texto:texto, cuerpo:cuerpo, textoAhoraNo:'Ahora no'}, clave, 30);
    var boton = {texto:'', pri:true, accion:function(card){
      var fechas = Array.prototype.map.call(card.querySelectorAll('.sug-dias input:checked'), function(x){ return x.value; });
      if(!fechas.length){ showToast('No quedó ningún día tildado.'); return false; }
      var btns = card.querySelectorAll('.ayuda-sug-btns button');
      Array.prototype.forEach.call(btns, function(b){ b.disabled = true; });
      var i = 0, ok = 0;
      (function sig(){
        if(i>=fechas.length){
          memGuardar(clave, 'aceptada', sumarDias(fechas[fechas.length-1], -30)); // vuelve a ofrecer cuando se esté terminando lo cargado
          showToast('Listo: se cargaron '+ok+' '+plural+' hasta el '+fechas[fechas.length-1].split('-').reverse().join('/')+'.', 5000);
          if(window.AyudaAnafer) window.AyudaAnafer.cerrarSugerencia();
          if(cfg.recargar) cfg.recargar();
          return;
        }
        var ds = fechas[i];
        var payload = Object.assign({}, cfg.plantilla, {id:cfg.idDe(ds), date:ds, note:'', status:'actual', source:'repetido',
          updated_by:whoName()+' (repetido)', updated_at:new Date().toISOString()});
        btns[btns.length-1].textContent = 'Cargando '+(i+1)+' / '+fechas.length+'…';
        Promise.resolve(state.sb.from(cfg.tabla).upsert(payload)).then(function(res){ if(res && !res.error) ok++; i++; sig(); }, function(){ i++; sig(); });
      })();
      return false;
    }};
    op.botones = [boton];
    function actualizarBoton(){
      var n = cuerpo.querySelectorAll('.sug-dias input:checked').length;
      boton.texto = 'Cargar '+n+' '+plural;
      var b = cuerpo.isConnected && document.querySelector('#ayuda-sug .ayuda-sug-btns button.pri'); if(b) b.textContent = boton.texto;
    }
    cuerpo.addEventListener('change', function(e){
      if(e.target && e.target.type==='checkbox'){ e.target.parentNode.classList.toggle('off', !e.target.checked); actualizarBoton(); }
    });
    actualizarBoton();
    sifSugerir(op);
  }

  // ---------- 2) Facturas ----------
  function numComparable(n){ return String(n||'').replace(/\D/g,'').replace(/^0+/,''); }
  function facturasVigentesProveedor(provId, excluirId){
    return state.facturas.filter(function(f){ return f.proveedorId===provId && f.id!==excluirId && noAnulado(f); });
  }
  function revisarFacturaNueva(f){
    return memListo().then(function(){
      var otras = facturasVigentesProveedor(f.proveedorId, f.id);
      var prov = proveedorNombre(f.proveedorId);
      // a) ¿Ya está cargada?
      var mismoNum = numComparable(f.numero) && otras.find(function(o){ return numComparable(o.numero)===numComparable(f.numero); });
      var mismoMonto = !mismoNum && Number(f.monto)>0 && otras.find(function(o){
        return Math.abs(Number(o.monto)-Number(f.monto)) <= Math.max(1, Number(f.monto)*0.005) && o.fecha && f.fecha && Math.abs(difDias(o.fecha, f.fecha))<=10;
      });
      var dup = mismoNum || mismoMonto;
      if(dup){
        sifSugerir({id:'dup:'+f.id, titulo:'Sifoncito: ¿está repetida?',
          texto: mismoNum
            ? 'Ya hay una factura <b>'+esc(dup.numero)+'</b> de <b>'+esc(prov)+'</b> cargada ('+esc(dup.fecha||'')+', '+fmtMoney(dup.monto)+'). ¿No será la misma?'
            : 'Hace pocos días se cargó otra factura de <b>'+esc(prov)+'</b> por el mismo importe ('+esc(dup.numero)+' del '+esc(dup.fecha||'')+', '+fmtMoney(dup.monto)+'). ¿No es la misma cargada dos veces?',
          textoAhoraNo:'Está bien, son distintas',
          botones:[
            {texto:'Ver la otra', accion:function(){ openFacturaModal(dup.id); }},
            {texto:'Anular esta', pri:true, accion:function(){ openFacturaModal(f.id); document.getElementById('fm-delete').click(); }}
          ]});
      }
      var previas = otras.filter(function(o){ return o.fecha && f.fecha && o.fecha<f.fecha && difDias(o.fecha, f.fecha)<=182 && Number(o.monto)>0; });
      // b) Monto fuera de lo habitual
      if(!dup && previas.length>=3 && Number(f.monto)>0 && memPuede('monto:'+f.proveedorId)){
        var med = mediana(previas.map(function(o){ return Number(o.monto); }));
        var r = med>0 ? Number(f.monto)/med : 1;
        if(r>=1.6 || r<=0.4){
          var pct = Math.round(Math.abs(r-1)*100);
          sifSugerir(conMemoria({id:'monto:'+f.id, titulo:'Sifoncito: ojo con el importe',
            texto:'Esta factura de <b>'+esc(prov)+'</b> es de <b>'+fmtMoney(f.monto)+'</b>, un '+pct+'% '+(r>1?'más alta':'más baja')+' que lo habitual: sus últimas '+previas.length+' facturas rondan los <b>'+fmtMoney(med)+'</b>. ¿Está bien el importe?',
            textoAhoraNo:'Está bien', textoNunca:'No me avises más con este proveedor',
            botones:[{texto:'Revisarla', pri:true, accion:function(){ openFacturaModal(f.id); }}]}, 'monto:'+f.proveedorId, 1));
        }
      }
      // c) Imputación distinta de la de siempre
      if(previas.length>=3 && f.centroCostoId && f.conceptoId && memPuede('imput:'+f.proveedorId)){
        var cuenta = {};
        previas.forEach(function(o){ var k = imputKey(o.centroCostoId, o.conceptoId); cuenta[k] = (cuenta[k]||0)+1; });
        var top = Object.keys(cuenta).sort(function(a,b){ return cuenta[b]-cuenta[a]; })[0];
        var kf = imputKey(f.centroCostoId, f.conceptoId);
        if(top && top!==kf && cuenta[top]>=Math.ceil(previas.length*0.8)){
          var pt = top.split('|');
          sifSugerir(conMemoria({id:'imput:'+f.id, titulo:'Sifoncito: ¿esa imputación?',
            texto:'Las últimas facturas de <b>'+esc(prov)+'</b> ('+cuenta[top]+' de '+previas.length+') fueron a <b>'+esc(centroCostoLabel(pt[0]))+' · '+esc(conceptoLabel(pt[1]))+'</b>, y esta la imputaste a <b>'+esc(centroCostoLabel(f.centroCostoId))+' · '+esc(conceptoLabel(f.conceptoId))+'</b>. ¿Está bien?',
            textoAhoraNo:'Sí, está bien', textoNunca:'No me avises más con este proveedor',
            botones:[{texto:'Revisarla', pri:true, accion:function(){ openFacturaModal(f.id); }}]}, 'imput:'+f.proveedorId, 1));
        }
      }
    }).catch(function(err){ console.warn('Asistente (factura):', err); });
  }
  // Proveedores que facturan todos los meses y este mes todavía no llegó.
  function facturasFaltantes(){
    var hoy = todayStr(), mesHoy = hoy.slice(0,7), diaHoy = Number(hoy.slice(8));
    var meses = []; for(var i=1;i<=6;i++){ var d = new Date(hoy+'T12:00:00'); d.setDate(1); d.setMonth(d.getMonth()-i); meses.push(dateStr(d.getFullYear(), d.getMonth(), 1).slice(0,7)); }
    var porProv = {};
    state.facturas.forEach(function(f){
      if(esAnulado(f) || !f.fecha) return;
      var p = porProv[f.proveedorId] = porProv[f.proveedorId] || {meses:{}, dias:[], montos:[], esteMes:false};
      var m = f.fecha.slice(0,7);
      if(m===mesHoy) p.esteMes = true;
      if(meses.indexOf(m)!==-1 && !p.meses[m]){ p.meses[m] = true; p.dias.push(Number(f.fecha.slice(8))); p.montos.push(Number(f.monto||0)); }
    });
    var out = [];
    Object.keys(porProv).forEach(function(id){
      var p = porProv[id];
      if(p.esteMes || Object.keys(p.meses).length<5 || !memPuede('falta:'+id)) return;
      var dia = Math.round(mediana(p.dias));
      if(diaHoy < dia+5) return;
      out.push({id:id, nombre:proveedorNombre(id), dia:dia, monto:mediana(p.montos), meses:Object.keys(p.meses).length});
    });
    return out.sort(function(a,b){ return a.dia-b.dia; });
  }
  function revisarFacturasFaltantes(){
    if(state.revisoFaltantes || !state.facturasCargadas || state.view!=='pagos') return;
    state.revisoFaltantes = true;
    memListo().then(function(){
      if(!memPuede('faltantes')) return;
      var lista = facturasFaltantes();
      if(!lista.length) return;
      var cuerpo = document.createElement('ul');
      cuerpo.className = 'sug-lista';
      lista.forEach(function(x){
        var li = document.createElement('li');
        li.innerHTML = '<span><b>'+esc(x.nombre)+'</b><small>Factura '+x.meses+' de los últimos 6 meses · suele llegar el día '+x.dia+' · ~'+fmtMoney(x.monto)+'</small></span>'
          +'<button type="button" class="cargar">Cargar</button><button type="button" class="x" title="No avisar más de este proveedor">✕</button>';
        li.querySelector('.cargar').addEventListener('click', function(){
          window.AyudaAnafer.cerrarSugerencia();
          openFacturaModal(null);
          setProveedorComboValue('fm-proveedor', x.id);
          document.getElementById('fm-proveedor').dispatchEvent(new Event('change'));
        });
        li.querySelector('.x').addEventListener('click', function(){
          memGuardar('falta:'+x.id, 'nunca');
          li.remove();
          if(!cuerpo.children.length) window.AyudaAnafer.cerrarSugerencia();
        });
        cuerpo.appendChild(li);
      });
      sifSugerir(conMemoria({id:'faltantes', titulo:'Sifoncito: facturas que faltan',
        texto: lista.length===1 ? 'Este proveedor te factura todos los meses y este mes todavía no cargaste su factura:' : 'Estos '+lista.length+' proveedores te facturan todos los meses y este mes todavía no cargaste su factura:',
        cuerpo:cuerpo, textoAhoraNo:'Mañana me recordás', textoNunca:'No me avises más de esto'}, 'faltantes', 1));
    });
  }

  // ---------- 3) Órdenes de pago: la forma de pago de siempre ----------
  function formaHabitual(provId, excluirId){
    var hoy = todayStr();
    var ops = state.ordenesPago.filter(function(p){ return p.proveedorId===provId && p.id!==excluirId && p.estado==='pagada' && p.fecha && difDias(p.fecha, hoy)<=182; })
      .sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); }).slice(0,6);
    if(ops.length<2) return null;
    var cuenta = {}, ej = {};
    ops.forEach(function(p){
      var fs = formasDePago(p).filter(function(f){ return f.medioId; });
      if(!fs.length) return;
      var f = fs.slice().sort(function(a,b){ return Number(b.importe||0)-Number(a.importe||0); })[0];
      cuenta[f.medioId] = (cuenta[f.medioId]||0)+1;
      (ej[f.medioId] = ej[f.medioId] || []).push({f:f, p:p});
    });
    var top = Object.keys(cuenta).sort(function(a,b){ return cuenta[b]-cuenta[a]; })[0];
    if(!top || cuenta[top]<2 || cuenta[top] < Math.ceil(ops.length*0.6)) return null;
    var md = medioById(top);
    if(!md || md.activo===false) return null;
    var cuentas = {}; ej[top].forEach(function(x){ if(x.f.cuentaId) cuentas[x.f.cuentaId] = (cuentas[x.f.cuentaId]||0)+1; });
    var cuentaId = Object.keys(cuentas).sort(function(a,b){ return cuentas[b]-cuentas[a]; })[0] || md.cuentaId || '';
    var dias = null;
    if(md.cheque==='datos'){
      var ds = ej[top].filter(function(x){ return x.f.chequeFecha && x.p.fecha; }).map(function(x){ return difDias(x.p.fecha, x.f.chequeFecha); });
      if(ds.length){ dias = Math.round(mediana(ds)); var r30 = Math.round(dias/30)*30; if(Math.abs(dias-r30)<=3) dias = r30; }
    }
    return {medioId:top, cuentaId:cuentaId, dias:dias, veces:cuenta[top], de:ops.length, modo:md.cheque};
  }
  function sugerirFormaHabitual(){
    var provId = document.getElementById('pom-proveedor').value;
    if(!provId || document.getElementById('pom-estado').value!=='pagada') return;
    var fs = state.editingFormas || [];
    if(fs.length!==1 || fs[0].medioId) return;
    var opId = state.editingPagoId;
    memListo().then(function(){
      if(!memPuede('pago:'+provId)) return;
      var h = formaHabitual(provId, opId);
      if(!h) return;
      var md = medioById(h.medioId);
      var como = '<b>'+esc(md.codigo+' — '+md.nombre)+'</b>'+(h.modo==='datos' && h.dias!=null ? (h.dias ? ' a <b>'+h.dias+' días</b>' : ' al día') : '')
        +(h.cuentaId ? ' desde <b>'+esc(cuentaNombre(h.cuentaId))+'</b>' : '');
      sifSugerir(conMemoria({id:'pago:'+provId, titulo:'Sifoncito: como siempre',
        texto:'A <b>'+esc(proveedorNombre(provId))+'</b> le pagaste '+h.veces+' de las últimas '+h.de+' veces con '+como+'. ¿Lo armo así?'
          +(h.modo==='cartera' ? ' (Después elegís qué cheques de la cartera.)' : ''),
        textoNunca:'No me lo propongas con este proveedor',
        botones:[{texto:'Sí, armalo así', pri:true, accion:function(){
          if(!document.getElementById('pago-overlay').classList.contains('show') || document.getElementById('pom-proveedor').value!==provId) return;
          var f = (state.editingFormas||[])[0]; if(!f) return;
          f.medioId = h.medioId; f.cuentaId = h.cuentaId;
          if(h.modo==='cartera'){ f.importe = 0; f.chequeIds = []; }
          if(h.modo==='datos' && h.dias!=null) f.chequeFecha = sumarDias(document.getElementById('pom-fecha').value || todayStr(), h.dias);
          renderPomFormas();
        }}]}, 'pago:'+provId, 7));
    });
  }

  function fetchMonth(){
    if(!state.sb) return;
    var y=state.year, m=state.month;
    var start = dateStr(y,m,1);
    var end = dateStr(y,m,daysInMonth(y,m));
    state.sb.from('trips').select('*').gte('date', start).lte('date', end).then(function(res){
      if(res.error){ showToast('Error cargando viajes: '+res.error.message); return; }
      var trips = {};
      (res.data||[]).forEach(function(row){ trips[row.id] = row; });
      state.trips = trips;
      renderGrid(); renderStats();
    });
  }

  function fetchConfig(){
    state.sb.from('routes').select('*').then(function(res){
      if(!res.error && res.data && res.data.length){
        state.routes = res.data.map(mapRouteRow);
        renderGrid(); renderStats();
      }
    });
    state.sb.from('trucks').select('*').then(function(res){
      if(!res.error && res.data && res.data.length){
        state.trucks = res.data.map(mapTruckRow);
        renderGrid(); renderStats(); renderBranchGrid();
      }
    });
    state.sb.from('drivers').select('*').then(function(res){
      if(!res.error && res.data && res.data.length){
        state.drivers = res.data.map(mapPersonRow);
      }
    });
    state.sb.from('helpers').select('*').then(function(res){
      if(!res.error && res.data && res.data.length){
        state.helpers = res.data.map(mapPersonRow);
      }
    });
    state.sb.from('cargo_types').select('*').then(function(res){
      if(!res.error && res.data && res.data.length){
        state.cargoTypes = res.data.map(mapCargoTypeRow);
      }
    });
    state.sb.from('branches').select('*').then(function(res){
      if(!res.error && res.data && res.data.length){
        state.branches = res.data.map(mapBranchRow);
        renderBranchGrid();
      }
    });
    EXTRA_KINDS.forEach(function(kind){
      state.sb.from(kind.collection).select('*').then(function(res){
        if(!res.error && res.data && res.data.length){
          state.extra[kind.key].items = res.data.map(mapExtraItemRow);
          renderExtraGrid(kind);
        }
      });
    });
    state.configPromise = cargarConfigAuth();
  }

  // Lee los perfiles (app_config 'auth'). Se llama al abrir la página y de
  // nuevo al iniciar sesión: antes de loguearse la lectura puede fallar
  // (rol anon sin permiso) y quedarían solo los perfiles por defecto.
  function cargarConfigAuth(){
    return state.sb.from('app_config').select('*').eq('id','auth').then(function(res){
      if(!res.error && res.data && res.data.length){
        var row = res.data[0];
        if(row.roles && Array.isArray(row.roles) && row.roles.length){
          state.auth.roles = row.roles;
        }else if(row.admin_password || row.viewer_password){
          // Migración automática del modelo anterior de 2 contraseñas fijas.
          var migrated = defaultAuthRoles();
          if(row.admin_password) migrated[0].password = row.admin_password;
          if(row.viewer_password) migrated[1].password = row.viewer_password;
          state.auth.roles = migrated;
          writeAuthRoles(migrated);
        }
        refreshTabVisibility();
        refreshSettingsTabsVisibility();
        if(state.settingsTab==='auth') renderSettings();
      }
    });
  }

  function initSupabase(){
    if(!window.supabase || !window.SUPABASE_URL || window.SUPABASE_URL.indexOf('TU-PROYECTO')!==-1){
      document.getElementById('conn-banner').classList.add('show');
      return;
    }
    try{
      state.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }catch(e){
      document.getElementById('conn-banner').classList.add('show');
      return;
    }
    fetchConfig();
    fetchMonth();
    fetchVisitsMonth();
    EXTRA_KINDS.forEach(fetchExtraVisitsMonth);
    fetchCompras();
    fetchFacturasYPagos();
    fetchTesoreria();

    // Realtime: any change on these tables re-fetches (small tables, simple & robust)
    state.sb.channel('trips-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'trips'}, function(){ fetchMonth(); if(state.view==='day') fetchDay(state.day); if(state.view==='dashboard') fetchDashboard(); })
      .subscribe();
    state.sb.channel('visits-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'visits'}, function(){ fetchVisitsMonth(); if(state.view==='day') fetchDayVisits(state.day); if(state.view==='dashboard') fetchDashboard(); })
      .subscribe();
    state.sb.channel('routes-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'routes'}, function(){ fetchConfig(); })
      .subscribe();
    state.sb.channel('trucks-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'trucks'}, function(){ fetchConfig(); })
      .subscribe();
    state.sb.channel('drivers-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'drivers'}, function(){ fetchConfig(); })
      .subscribe();
    state.sb.channel('helpers-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'helpers'}, function(){ fetchConfig(); })
      .subscribe();
    state.sb.channel('cargo-types-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'cargo_types'}, function(){ fetchConfig(); })
      .subscribe();
    state.sb.channel('branches-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'branches'}, function(){ fetchConfig(); })
      .subscribe();
    EXTRA_KINDS.forEach(function(kind){
      state.sb.channel(kind.collection+'-changes')
        .on('postgres_changes', {event:'*', schema:'public', table:kind.collection}, function(){ fetchConfig(); })
        .subscribe();
      state.sb.channel(kind.visitCollection+'-changes')
        .on('postgres_changes', {event:'*', schema:'public', table:kind.visitCollection}, function(){
          fetchExtraVisitsMonth(kind);
          if(state.view==='day') fetchDayExtraVisits(kind, state.day);
          if(state.view==='dashboard') fetchDashboard();
        })
        .subscribe();
    });
    state.sb.channel('app-config-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'app_config'}, function(){ fetchConfig(); })
      .subscribe();
    state.sb.channel('proveedores-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'proveedores'}, function(){ debounced('fetchCompras', fetchCompras); })
      .subscribe();
    state.sb.channel('ordenes-compra-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'ordenes_compra'}, function(){ debounced('fetchCompras', fetchCompras); })
      .subscribe();
    state.sb.channel('centros-costo-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'centros_costo'}, function(){ debounced('fetchCompras', fetchCompras); })
      .subscribe();
    state.sb.channel('articulos-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'articulos'}, function(){ debounced('fetchCompras', fetchCompras); })
      .subscribe();
    state.sb.channel('rubros-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'rubros'}, function(){ debounced('fetchCompras', fetchCompras); })
      .subscribe();
    state.sb.channel('conceptos-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'conceptos'}, function(){ debounced('fetchCompras', fetchCompras); })
      .subscribe();
    state.sb.channel('facturas-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'facturas'}, function(){ debounced('fetchFacturasYPagos', fetchFacturasYPagos); })
      .subscribe();
    state.sb.channel('ordenes-pago-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'ordenes_pago'}, function(){ debounced('fetchFacturasYPagos', fetchFacturasYPagos); })
      .subscribe();
    state.sb.channel('cuentas-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'cuentas'}, function(){ debounced('fetchTesoreria', fetchTesoreria); })
      .subscribe();
    state.sb.channel('medios-caja-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'medios_caja'}, function(){ debounced('fetchTesoreria', fetchTesoreria); })
      .subscribe();
    state.sb.channel('cheques-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'cheques'}, function(){ debounced('fetchTesoreria', fetchTesoreria); })
      .subscribe();
    state.sb.channel('movimientos-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'movimientos'}, function(){ debounced('fetchTesoreria', fetchTesoreria); })
      .subscribe();
  }

  // ---------- Login por perfiles (contraseña propia y permisos por pestaña) ----------
  function updateAuthVisibility(){
    var loggedIn = isLoggedIn();
    var arr = document.getElementById('arranque'); if(arr) arr.hidden = true;   // ya se sabe si hay sesión
    document.getElementById('login-overlay').classList.toggle('show', !loggedIn);
    document.querySelector('.shell').hidden = !loggedIn;
  }

  // ---------- Inicio por áreas ----------
  function renderHome(){
    var grid = document.getElementById('home-grid');
    grid.innerHTML = '';
    var r = currentRole();
    document.getElementById('home-hello').textContent = (state.sessionEmail ? 'Hola '+state.sessionEmail : (r ? 'Perfil '+r.nombre : ''))+' · elegí un área';
    if(!visibleAreas().length) grid.innerHTML = '<div class="sub">Tu perfil todavía no tiene ningún área habilitada. Pedile acceso al administrador.</div>';
    visibleAreas().forEach(function(a){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'area-card';
      b.style.setProperty('--ac', a.color);
      var sinSesion = a.href && !state.sessionEmail;
      b.innerHTML = '<div class="ai">'+a.icon+'</div><h3>'+esc(a.label)+'</h3><p>'+esc(a.desc)+'</p>'+
        '<div class="go">'+(sinSesion ? 'Para entrar a Comercial ingresá con tu email' : 'Entrar →')+'</div>';
      if(sinSesion) b.disabled = true;
      b.addEventListener('click', function(){ openArea(a.id); });
      grid.appendChild(b);
    });
  }
  function showHome(){
    state.area = null;
    if(window.Tableros && window.Tableros.detener) window.Tableros.detener();
    document.body.dataset.area = ''; // para la ayuda (ayuda.js)
    try{ localStorage.removeItem('hdr_area'); }catch(e){}
    ['grid','day','dashboard','branches','company','occasional','compras','pagos','tesoreria'].forEach(function(v){
      document.getElementById('view-'+v).hidden = true;
      document.getElementById('toolbar-'+v).hidden = true;
    });
    (VISTAS_CALIDAD||[]).forEach(function(v){ document.getElementById('view-'+v).hidden = true; });
    document.getElementById('menu-sub').hidden = true;
    refreshTabVisibility();
    renderHome();
    document.getElementById('view-home').hidden = false;
  }
  function openArea(id){
    var a = areaById(id);
    if(!a || !areaVisible(a)) return;
    if(a.href){ window.location.href = a.href; return; }
    state.area = id;
    document.body.dataset.area = id; // para la ayuda (ayuda.js)
    document.body.style.setProperty('--area-color', a.color || '#e1251b'); // color de la sección activa en el menú
    try{ localStorage.setItem('hdr_area', id); }catch(e){}
    var prev = state.view;
    setView(a.tabs.indexOf(prev)!==-1 ? prev : null);
  }
  document.getElementById('home-btn').addEventListener('click', showHome);

  // ---------- Ingreso: email (Supabase) o contraseña de perfil (anterior) ----------
  function updateAuthVisibility(){
    var loggedIn = isLoggedIn();
    var arr = document.getElementById('arranque'); if(arr) arr.hidden = true;   // ya se sabe si hay sesión
    document.getElementById('login-overlay').classList.toggle('show', !loggedIn);
    document.querySelector('.shell').hidden = !loggedIn;
  }

  function enterApp(){
    document.getElementById('who-fields').style.display = canEditAnything() ? 'contents' : 'none';
    var areas = visibleAreas();
    if(areas.length===1 && areas[0].href && state.sessionEmail){ state.redirigiendo = true; window.location.href = areas[0].href; return; } // sin mostrar nada antes de irse
    updateAuthVisibility();
    var saved = null;
    try{ saved = localStorage.getItem('hdr_area'); }catch(e){}
    var internas = areas.filter(function(a){ return !a.href; });
    if(areas.length===1 && !areas[0].href) openArea(areas[0].id);
    else if(saved && areaById(saved) && !areaById(saved).href && areaVisible(areaById(saved))) openArea(saved);
    else if(!areas.length || (internas.length===0 && !state.sessionEmail)){ state.area = null; showHome(); }
    else showHome();
    refreshTabVisibility();
  }

  // Salir: cierra la sesión (en el servidor y en este navegador) y vuelve a la
  // pantalla de ingreso del sitio (la raíz: anafergestion.netlify.app/).
  function borrarSesionesGuardadas(){
    try{
      ['hdr_role','hdr_area'].forEach(function(k){ localStorage.removeItem(k); });
      Object.keys(localStorage).forEach(function(k){ if(/^sb-.*-auth-token$/.test(k)) localStorage.removeItem(k); });
    }catch(e){}
  }
  function logout(){
    if(state.saliendo) return;
    state.saliendo = true;
    try{ if(window.Tableros && window.Tableros.detener) window.Tableros.detener(); }catch(e){}
    state.roleId = null;
    state.area = null;
    state.sessionEmail = null;
    var btn = document.getElementById('logout-btn');
    if(btn){ btn.disabled = true; btn.textContent = 'Saliendo…'; }
    var ir = function(){ borrarSesionesGuardadas(); window.location.replace('/'); };
    var p = (state.sb && state.sb.auth) ? state.sb.auth.signOut() : null;
    if(!p || !p.then){ ir(); return; }
    // si el servidor no contesta, igual se sale (la sesión local se borra)
    Promise.race([p.catch(function(){}), new Promise(function(r){ setTimeout(r, 2500); })]).then(ir, ir);
  }

  var loginModo = 'email';
  function setLoginModo(m){
    loginModo = m;
    document.getElementById('login-email-field').hidden = m!=='email';
    document.getElementById('login-sub').textContent = m==='email' ? 'Ingresá con tu email y tu contraseña' : 'Contraseña del perfil (ingreso anterior)';
    document.getElementById('login-error').style.display = 'none';
  }

  function loginError(msg){
    var el = document.getElementById('login-error');
    el.textContent = msg; el.style.display = '';
  }

  // Con la sesión de Supabase, busca a la persona en la tabla usuarios:
  // activo + perfil. Sin perfil = "Solo Comercial" (como hasta ahora).
  // opts.recargar: viene del formulario de ingreso. No se muestra nada de
  // la app: se valida y se recarga para entrar ya logueado al inicio.
  function resolverSesion(session, opts){
    var email = ((session && session.user && session.user.email) || '').toLowerCase();
    if(!email) return Promise.resolve(false);
    return (state.configPromise || Promise.resolve()).then(function(){
      return cargarConfigAuth();   // ya con la sesión: trae los perfiles reales
    }).then(function(){
      return state.sb.from('usuarios').select('*').eq('email', email);
    }).then(function(res){
      var row = (res.data||[])[0];
      if(res.error || !row || row.activo===false){
        state.sb.auth.signOut().catch(function(){});
        loginError('Tu cuenta todavía no tiene acceso. Pedile acceso al administrador.');
        return false;
      }
      if(row.perfil && !(state.auth.roles||[]).some(function(r){ return r.id===row.perfil; })){
        state.sb.auth.signOut().catch(function(){});
        loginError('Tu usuario tiene un perfil que ya no existe. Avisale al administrador.');
        return false;
      }
      state.sessionEmail = email;
      state.roleId = row.perfil || '__comercial__';
      try{ localStorage.removeItem('hdr_role'); }catch(e){}
      document.getElementById('login-password').value = '';
      document.getElementById('login-error').style.display = 'none';
      if(opts && opts.recargar){
        var areas = visibleAreas();
        if(areas.length===1 && areas[0].href){ state.redirigiendo = true; window.location.href = areas[0].href; return true; }
        try{ localStorage.removeItem('hdr_area'); }catch(e){}   // después de ingresar, siempre al inicio
        state.redirigiendo = true;
        window.location.reload();
        return true;
      }
      enterApp();
      return true;
    }, function(){ loginError('No se pudo verificar tu acceso. Probá de nuevo.'); return false; });
  }

  function tryLogin(){
    var pw = document.getElementById('login-password').value;
    if(loginModo==='email'){
      var email = document.getElementById('login-email').value.trim().toLowerCase();
      if(!email || !pw){ loginError('Ingresá tu email y tu contraseña.'); return; }
      if(!state.sb){ loginError('Sin conexión con la base.'); return; }
      var btn = document.getElementById('login-btn');
      btn.disabled = true; btn.textContent = 'Ingresando…';
      state.sb.auth.signInWithPassword({email:email, password:pw}).then(function(res){
        if(res.error || !res.data || !res.data.session){ loginError('Email o contraseña incorrectos.'); return; }
        // Los datos se cargaron al abrir la página, todavía sin sesión: se
        // recarga para traerlos ya como usuario logueado y entrar al inicio.
        return resolverSesion(res.data.session, {recargar:true});
      }, function(){ loginError('No se pudo conectar. Probá de nuevo.'); })
      .finally(function(){ if(!state.redirigiendo){ btn.disabled = false; btn.textContent = 'Ingresar'; } });
      return;
    }
  }

  document.getElementById('login-btn').addEventListener('click', tryLogin);
  document.getElementById('login-password').addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); });
  document.getElementById('login-email').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('login-password').focus(); });
  document.getElementById('logout-btn').addEventListener('click', logout);

  // La voz de Sifoncito (mujer, español de Argentina del interior) la arma el
  // servidor (Edge Function sifoncito-voz); si no está o falla, usa la del navegador.
  function registrarVozSifoncito(){
    if(!state.sb || !state.sb.functions) return;
    if(!(window.AyudaAnafer && window.AyudaAnafer.usarVozServidor)){ document.addEventListener('DOMContentLoaded', registrarVozSifoncito, {once:true}); return; }
    window.AyudaAnafer.usarVozServidor(function(texto){
      return state.sb.functions.invoke('sifoncito-voz', { body: { texto: texto } }).then(function(r){ if(r.error) throw r.error; return r.data; });
    });
  }

  // ---------- Init ----------
  renderAll();
  initSupabase();
  // Si hay una sesión de email abierta (de acá o del tablero Comercial) entra
  // directo; si no, el ingreso anterior por perfil guardado en el navegador.
  var sesionPromesa = (state.sb && state.sb.auth) ? state.sb.auth.getSession().then(function(r){ return r && r.data && r.data.session; }, function(){ return null; }) : Promise.resolve(null);
  sesionPromesa.then(function(session){
    if(session) registrarVozSifoncito();
    if(session) return resolverSesion(session).then(function(ok){ if(!ok){ state.roleId = null; updateAuthVisibility(); } });
    (state.configPromise || Promise.resolve()).then(function(){
      if(isLoggedIn()) enterApp(); else updateAuthVisibility();
    });
  });
  // No se muestra nada (ni el sistema ni el login) hasta saber si hay una sesión
  // abierta: así F5 no "flashea" el menú ni el login. Por las dudas, si la base
  // no contesta, a los 10 segundos se muestra el login igual.
  setTimeout(function(){ var arr = document.getElementById('arranque'); if(arr && !arr.hidden && !state.redirigiendo) updateAuthVisibility(); }, 10000);
})();
