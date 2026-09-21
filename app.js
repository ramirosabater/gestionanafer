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
    {id:'dashboard',  label:'Dashboard'}
  ];
  function defaultPermisos(nivel){
    var p = {};
    TAB_DEFS.forEach(function(t){ p[t.id] = nivel; });
    return p;
  }
  function currentRole(){
    return (state.auth.roles||[]).find(function(r){ return r.id===state.roleId; }) || null;
  }
  function isLoggedIn(){ return !!currentRole(); }
  function tabPermiso(tabId){
    var r = currentRole();
    if(!r) return 'oculta';
    return (r.permisos && r.permisos[tabId]) || 'oculta';
  }
  function canEdit(tabId){ return tabPermiso(tabId)==='editar'; }
  function canEditAnything(){ return TAB_DEFS.some(function(t){ return canEdit(t.id); }); }
  function canManageAccess(){ var r = currentRole(); return !!(r && r.manageAccess); }
  function canOpenSettings(){
    return canManageAccess() || canEdit('grid') || canEdit('branches') || canEdit('company') || canEdit('occasional') || canEdit('compras');
  }
  function firstAccessibleTab(){
    for(var i=0;i<TAB_DEFS.length;i++){ if(tabPermiso(TAB_DEFS[i].id)!=='oculta') return TAB_DEFS[i].id; }
    return null;
  }
  function refreshTabVisibility(){
    var accessibleCount = 0;
    TAB_DEFS.forEach(function(t){
      var btn = document.getElementById('tab-'+t.id);
      var oculta = tabPermiso(t.id)==='oculta';
      if(btn) btn.hidden = oculta;
      if(!oculta) accessibleCount++;
    });
    var viewtabs = document.getElementById('viewtabs');
    if(viewtabs) viewtabs.hidden = accessibleCount<=1;
    var settingsBtn = document.getElementById('settings-btn');
    if(settingsBtn) settingsBtn.hidden = !canOpenSettings();
  }
  var SETTINGS_TAB_PERMISOS = {
    routes:'grid', trucks:'grid', drivers:'grid', helpers:'grid', cargo:'grid',
    branches:'branches', companies:'company', occasionals:'occasional',
    'centros-costo':'compras', conceptos:'compras'
  };
  function settingsTabVisible(t){
    if(t==='auth') return canManageAccess();
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
    {id:'compras',     label:'Compras',                   tabs:['centros-costo','conceptos']},
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
    var order = ['routes','trucks','drivers','helpers','cargo','branches','companies','occasionals','centros-costo','conceptos','auth'];
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
    // Acceso: cada persona entra con su email y contraseña (Supabase Auth). La
    // tabla usuarios dice qué perfil tiene cada email, y la tabla perfiles guarda
    // los permisos por pestaña (ver TAB_DEFS más arriba). Se gestionan desde
    // ⚙ → Acceso. Los permisos también los hace cumplir la base de datos (RLS).
    auth: {roles: [], usuarios: []},
    userEmail: '',         // email de quien inició sesión
    authChecked: false,    // ya se sabe si hay sesión o no (evita mostrar el login de golpe)
    started: false,        // ya se cargaron los datos y se abrieron las conexiones en vivo
    accessLoading: false,
    loggingOut: false,
    deniedEmail: '',       // email al que se le negó el acceso (evita repetir la verificación por eventos atrasados)
    pwRecovery: false,
    roleId: null,          // null (sin loguear) o id de un perfil en state.auth.roles
    // Compras: proveedores y órdenes de compra (primer módulo de
    // Compras/Órdenes de pago/Tesorería — por ahora solo proveedores y
    // órdenes de compra; sin vínculo a sucursales/empresas/eventuales/
    // camiones, y sin desglose de ítems: descripción libre + monto total).
    proveedores: [],
    ordenesCompra: [],
    editingProveedorId: null,
    editingProveedorArchivos: [], // adjuntos del proveedor que se está editando (Google Drive)
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
    // Tesorería: cuentas de caja/banco y sus movimientos. Por ahora solo
    // egresos (pagos a proveedores, incluido el egreso automático que se
    // genera al marcar una orden de pago como Pagada, y egresos manuales
    // como sueldos o impuestos). El saldo de cada cuenta se calcula como
    // saldo inicial menos la suma de sus movimientos.
    cuentas: [],
    movimientos: [],
    editingCuentaId: null,
    editingMovimientoId: null,
    movFilterCuenta: ''
  };

  try {
    var savedWho = localStorage.getItem('hdr_who');
    if(savedWho) document.getElementById('who-input').value = savedWho;
  } catch(e){}
  document.getElementById('who-input').addEventListener('change', function(){
    try{ localStorage.setItem('hdr_who', this.value.slice(0,30)); }catch(e){}
  });

  try{ localStorage.removeItem('hdr_role'); }catch(e){} // resto del login viejo

  // Quién carga cada cosa: sale del email con el que se inició sesión (ya no se tipea).
  function whoName(){
    return state.userEmail || 'Sin nombre';
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

  function showToast(msg){
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(t._timer);
    t._timer = setTimeout(function(){ t.classList.remove('show'); }, 2600);
  }

  // ---------- View switching ----------
  function setView(v){
    if(!v || tabPermiso(v)==='oculta') v = firstAccessibleTab() || 'day'; // no navega a pestañas sin permiso
    state.view = v;
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
    document.getElementById('toolbar-grid').hidden = (v!=='grid');
    document.getElementById('toolbar-day').hidden = (v!=='day');
    document.getElementById('toolbar-dashboard').hidden = (v!=='dashboard');
    document.getElementById('toolbar-branches').hidden = (v!=='branches');
    document.getElementById('toolbar-company').hidden = (v!=='company');
    document.getElementById('toolbar-occasional').hidden = (v!=='occasional');
    document.getElementById('toolbar-compras').hidden = (v!=='compras');
    document.getElementById('toolbar-pagos').hidden = (v!=='pagos');
    document.getElementById('toolbar-tesoreria').hidden = (v!=='tesoreria');
    if(v==='day') fetchDay(state.day);
    if(v==='dashboard') fetchDashboard();
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
        '<span class="truck-no">'+trip.truck+'</span>'+
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
              '<span class="truck-no">'+sugg+'</span>'+
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
      chip.innerHTML = '<span class="swatch" style="background:'+truckColorVar(t.id)+';"></span><span class="n">'+n+'</span><span class="lbl">'+t.label+'</span>';
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
  document.getElementById('cell-overlay').addEventListener('click', function(e){ if(e.target===this) closeCellModal(); });

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
    fillSelect(truckSel, activeTrucks(), 'id', 'label', 'Sin camión');
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
    document.getElementById(kind.overlayId).addEventListener('click', function(e){ if(e.target===this) closeExtraVisitModal(kind); });
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
    fillSelect(vmTruckSel, activeTrucks(), 'id', 'label', 'Sin camión');
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
  document.getElementById('visit-overlay').addEventListener('click', function(e){ if(e.target===this) closeVisitModal(); });

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
      return f.fecha && f.fecha>=gastoRange.start && f.fecha<=gastoRange.end;
    });
    var gastoTotal = facturasPeriodo.reduce(function(s,f){ return s+Number(f.monto||0); }, 0);
    document.getElementById('kpi-gastos-total').textContent = fmtMoney(gastoTotal);
    document.getElementById('kpi-gastos-facturas').textContent = facturasPeriodo.length;

    var porCentro = sumBy(facturasPeriodo, function(f){return f.centroCostoId;}, centroCostoLabel, function(f){return f.monto||0;}, '(Sin centro de costo)');
    var porConcepto = sumBy(facturasPeriodo, function(f){return f.conceptoId;}, conceptoLabel, function(f){return f.monto||0;}, '(Sin concepto)');
    var porProveedorGasto = sumBy(facturasPeriodo, function(f){return f.proveedorId;}, proveedorNombre, function(f){return f.monto||0;}, '(Sin proveedor)');

    document.getElementById('kpi-gastos-centro').textContent = porCentro[0] ? porCentro[0].label+' ('+fmtMoney(porCentro[0].count)+')' : '—';
    document.getElementById('kpi-gastos-concepto').textContent = porConcepto[0] ? porConcepto[0].label+' ('+fmtMoney(porConcepto[0].count)+')' : '—';

    renderMoneyBarList('bar-gastos-centro', porCentro);
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
  var SETTINGS_ALL_TABS = ['routes','trucks','drivers','helpers','cargo','branches','companies','occasionals','centros-costo','conceptos','auth'];
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
      truckScopeSel.innerHTML = '<option value="both">Ambos</option><option value="flota">Solo FlotaPesada</option><option value="sucursales">Solo Sucursales</option>';
      truckScopeSel.value = t.scope || 'both';
      truckScopeSel.addEventListener('change', function(){ t.scope = this.value; writeTruck(t); renderGrid(); renderBranchGrid(); });
      top.appendChild(truckScopeSel);

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

      card.appendChild(top); card.appendChild(sub);
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
    top.appendChild(nombreInp);
    card.appendChild(top);

    var manageRow = document.createElement('label');
    manageRow.className = 'role-manage-row';
    var manageChk = document.createElement('input');
    manageChk.type = 'checkbox'; manageChk.className = 'role-manage-access';
    manageChk.checked = !!role.manageAccess;
    manageRow.appendChild(manageChk);
    manageRow.appendChild(document.createTextNode('Puede administrar perfiles y personas (⚙ Acceso)'));
    card.appendChild(manageRow);

    var grid = document.createElement('div');
    grid.className = 'role-permisos-grid';
    TAB_DEFS.forEach(function(t){
      var lbl = document.createElement('div');
      lbl.className = 'role-permiso-row';
      lbl.textContent = t.label;
      var sel = document.createElement('select');
      sel.className = 'role-permiso-select';
      sel.dataset.tab = t.id;
      sel.innerHTML = '<option value="oculta">Oculta</option><option value="ver">Ver</option><option value="editar">Editar</option>';
      sel.value = (role.permisos && role.permisos[t.id]) || 'oculta';
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
    renderUsuariosSettings();
  }

  // Personas con acceso: email + perfil. Para que alguien pueda entrar hacen falta
  // dos cosas: su cuenta en Supabase (Authentication > Users) y estar en esta lista.
  function perfilNombre(id){
    var r = (state.auth.roles||[]).find(function(x){ return x.id===id; });
    return r ? r.nombre : id;
  }
  function writeUsuario(u){
    if(!state.sb) return;
    state.sb.from('usuarios').upsert({email:u.email, perfil_id:u.perfil_id, activo:u.activo!==false}).then(function(res){
      if(res.error) showToast('No se pudo guardar la persona: '+res.error.message);
    });
  }
  function buildUsuarioRow(u){
    var esYo = (u.email||'').toLowerCase()===state.userEmail;
    var row = document.createElement('div');
    row.className = 'setting-row usuario-row';
    var toggle = document.createElement('button');
    toggle.className = 'toggle'+(u.activo!==false?' on':'');
    toggle.innerHTML = '<span class="knob"></span>';
    toggle.title = esYo ? 'No podés quitarte el acceso a vos mismo' : (u.activo!==false ? 'Con acceso — clic para suspender' : 'Suspendido — clic para reactivar');
    toggle.addEventListener('click', function(){
      if(esYo){ showToast('No podés quitarte el acceso a vos mismo.'); return; }
      u.activo = u.activo===false ? true : false;
      writeUsuario(u);
      renderUsuariosSettings();
    });
    var mail = document.createElement('span');
    mail.className = 'usuario-email';
    mail.textContent = u.email;
    var sel = document.createElement('select');
    sel.className = 'scope-select';
    (state.auth.roles||[]).forEach(function(r){
      var o = document.createElement('option'); o.value = r.id; o.textContent = r.nombre; sel.appendChild(o);
    });
    sel.value = u.perfil_id;
    sel.addEventListener('change', function(){
      if(esYo && !confirm('Estás cambiando tu propio perfil. Si el nuevo no puede administrar accesos, vas a perder este acceso. ¿Seguir?')){ this.value = u.perfil_id; return; }
      u.perfil_id = this.value;
      writeUsuario(u);
    });
    var del = document.createElement('button');
    del.className = 'btn ghost';
    del.textContent = '✕';
    del.title = 'Quitar a esta persona de la lista';
    del.addEventListener('click', function(){
      if(esYo){ showToast('No podés quitarte el acceso a vos mismo.'); return; }
      if(!confirm('¿Quitar a '+u.email+' de la lista? Ya no va a poder entrar.')) return;
      state.sb.from('usuarios').delete().eq('email', u.email).then(function(res){
        if(res.error){ showToast('No se pudo quitar: '+res.error.message); return; }
        state.auth.usuarios = state.auth.usuarios.filter(function(x){ return x.email!==u.email; });
        renderUsuariosSettings();
      });
    });
    row.appendChild(toggle); row.appendChild(mail); row.appendChild(sel); row.appendChild(del);
    return row;
  }
  function renderUsuariosSettings(){
    var list = document.getElementById('usuarios-list');
    if(!list) return;
    list.innerHTML = '';
    (state.auth.usuarios||[]).forEach(function(u){ list.appendChild(buildUsuarioRow(u)); });
    var sel = document.getElementById('new-usuario-perfil');
    if(sel){
      var prev = sel.value;
      sel.innerHTML = '';
      (state.auth.roles||[]).forEach(function(r){
        var o = document.createElement('option'); o.value = r.id; o.textContent = r.nombre; sel.appendChild(o);
      });
      if(prev) sel.value = prev;
    }
  }
  function loadUsuarios(){
    if(!state.sb || !canManageAccess()) return;
    state.sb.from('usuarios').select('*').order('email').then(function(res){
      if(res.error){ showToast('No se pudo cargar la lista de personas: '+res.error.message); return; }
      state.auth.usuarios = res.data || [];
      if(state.settingsTab==='auth') renderUsuariosSettings();
    });
  }

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
  function writeAuthRoles(roles, removedIds){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return Promise.resolve(false); }
    var rows = roles.map(function(r){
      return {id:r.id, nombre:r.nombre, permisos:r.permisos, gestiona_acceso:!!r.manageAccess};
    });
    return state.sb.from('perfiles').upsert(rows).then(function(res){
      if(res.error){ showToast('No se pudieron guardar los perfiles: '+res.error.message); return false; }
      if(!removedIds || !removedIds.length) return true;
      return state.sb.from('perfiles').delete().in('id', removedIds).then(function(r2){
        if(r2.error){ showToast('No se pudo eliminar un perfil (¿hay personas asignadas?): '+r2.error.message); return false; }
        return true;
      });
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

  function uploadAdjunto(file, nombreProveedor){
    if(!driveReady()) return Promise.reject(new Error('Google Drive no está configurado (falta GOOGLE_DRIVE_CLIENT_ID en config.js)'));
    return driveEnsureProveedorFolder(nombreProveedor).then(function(folderId){
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
      if(containerId==='fm-archivos-list') syncFacturaPreview();
      return;
    }
    arr.forEach(function(a, idx){
      var row = document.createElement('div');
      row.className = 'attach-item';
      if(a.pending){
        var span = document.createElement('span');
        span.textContent = (a.name || 'archivo') + ' (se sube a Drive al guardar)';
        span.style.flex = '1'; span.style.minWidth = '0';
        row.appendChild(span);
        if(containerId==='fm-archivos-list' && isPreviewableFile(a.file)){
          var verBtn = document.createElement('button');
          verBtn.type = 'button'; verBtn.className = 'attach-view'; verBtn.textContent = '👁 Ver';
          verBtn.title = 'Mostrar este archivo al costado del formulario';
          verBtn.addEventListener('click', function(){ fmPreview.dismissed = false; showFacturaPreview(a.file); });
          row.appendChild(verBtn);
        }
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
    if(containerId==='fm-archivos-list') syncFacturaPreview();
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

  function refreshFacturaReadAvailability(){
    // La lectura la hace el servidor (función leer-factura); acá solo se decide si se muestra el botón.
    var row = document.getElementById('fm-read-row');
    if(row) row.hidden = !(state.sb && state.started && (canEdit('compras') || canEdit('pagos')));
    if(typeof setReadStatus==='function') setReadStatus(null);
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
      }else{
        showToast('Proveedor leído: "'+nombreLeido+'" — no está en la lista, elegilo a mano.');
      }
    }
    if(data.numero) document.getElementById('fm-numero').value = data.numero;
    if(data.fecha && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)) document.getElementById('fm-fecha').value = data.fecha;
    if(data.monto!=null && !isNaN(parseFloat(data.monto))) document.getElementById('fm-monto').value = String(data.monto).replace('.',',');
    if(data.notas) document.getElementById('fm-notas').value = data.notas;
  }

  // Prepara la imagen para mandarla al servidor: si es muy grande la achica y la pasa a JPG.
  function normalizeInvoiceImage(blob){
    var ok = ['image/png','image/jpeg','image/webp','image/gif'];
    var passthrough = function(){
      if(ok.indexOf(blob.type)===-1) return Promise.reject(new Error('formato'));
      return blobToBase64(blob).then(function(b64){ return {base64:b64, mediaType:blob.type}; });
    };
    if(typeof createImageBitmap!=='function') return passthrough();
    return createImageBitmap(blob).then(function(bmp){
      var maxDim = 2200;
      var scale = Math.min(1, maxDim/Math.max(bmp.width, bmp.height));
      if(scale===1 && blob.size<=3500000 && ok.indexOf(blob.type)!==-1){ if(bmp.close) bmp.close(); return passthrough(); }
      var cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(bmp.width*scale)); cv.height = Math.max(1, Math.round(bmp.height*scale));
      var ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cv.width, cv.height);
      ctx.drawImage(bmp, 0, 0, cv.width, cv.height);
      if(bmp.close) bmp.close();
      return new Promise(function(resolve, reject){
        cv.toBlob(function(b){
          if(!b){ reject(new Error('convertir')); return; }
          blobToBase64(b).then(function(b64){ resolve({base64:b64, mediaType:'image/jpeg'}); }, reject);
        }, 'image/jpeg', 0.88);
      });
    }, function(){ return passthrough(); });
  }

  // Estado de la lectura, visible DENTRO del modal (el aviso de abajo dura pocos segundos y es fácil de perder)
  function setReadStatus(kind, msg){
    var el = document.getElementById('fm-read-status');
    var inp = document.getElementById('fm-read-input');
    var lbl = document.getElementById('fm-read-label');
    if(inp) inp.disabled = (kind==='busy');
    if(lbl) lbl.classList.toggle('disabled', kind==='busy');
    if(!el) return;
    if(!kind){ el.hidden = true; el.textContent = ''; el.className = 'factura-read-status'; return; }
    el.hidden = false;
    el.className = 'factura-read-status ' + kind;
    el.textContent = (kind==='busy' ? '⏳ ' : kind==='ok' ? '✅ ' : '⚠ ') + msg;
  }
  function readFail(msg){ setReadStatus('error', msg); showToast(msg); }

  async function facturaReadErrorMessage(error){
    var status = error && error.context && error.context.status;
    var detail = '';
    try{ var j = await error.context.json(); detail = (j && j.error) || ''; }catch(e){}
    console.error('leer-factura falló', status, detail, error);
    if(status===404) return 'La lectura automática todavía no está activada en el servidor (falta desplegar la función leer-factura).';
    if(status===401 || status===403) return detail || 'No tenés permiso para leer facturas automáticamente.';
    if(status===429) return 'Demasiados pedidos por ahora — probá de nuevo en un momento.';
    return 'No se pudo leer la factura automáticamente' + (detail ? ': '+detail : '') + ' — completá los datos a mano.';
  }

  async function readFacturaFromFile(file){
    if(!state.sb){ readFail('Sin conexión con el servidor.'); return; }
    setReadStatus('busy', 'Leyendo la factura…');
    try{
      var isPdf = (file.type === 'application/pdf');
      if(!isPdf && !/^image\//.test(file.type)){
        readFail('Elegí un PDF o una imagen de la factura.');
        return;
      }
      // el archivo original queda como adjunto pendiente; se sube a Drive
      // recién al Guardar, porque ahí ya sabemos a qué proveedor pertenece.
      // Al agregarlo se muestra al costado del formulario para poder controlarlo.
      state.editingFacturaArchivos.push({ pending:true, file:file, name:file.name, contentType:file.type||'', sizeBytes:file.size||0 });
      renderAttachList('fm-archivos-list', function(){ return state.editingFacturaArchivos; });

      var imageBlob = file;
      if(isPdf){
        imageBlob = await pdfFirstPageToImageBlob(file);
      }

      var img;
      try{ img = await normalizeInvoiceImage(imageBlob); }
      catch(e){ readFail('No se pudo leer esa imagen — probá con un PDF, JPG o PNG, o completá los datos a mano.'); return; }

      // La lectura la hace el servidor: la clave de Anthropic nunca pasa por el navegador.
      var proveedorNombres = state.proveedores.map(function(p){ return p.nombre; });
      var res = await state.sb.functions.invoke('leer-factura', {
        body: { imagen: img.base64, mediaType: img.mediaType, proveedores: proveedorNombres }
      });
      if(res.error){ readFail(await facturaReadErrorMessage(res.error)); return; }
      var data = res.data && res.data.data;
      if(!data){ readFail('No se pudo interpretar la respuesta — completá los datos a mano.'); return; }
      applyFacturaReadResult(data);
      setReadStatus('ok', 'Factura leída — revisá los datos antes de guardar.');
      showToast('Factura leída — revisá los datos antes de guardar.');
    }catch(e){
      console.error('lectura de factura', e);
      readFail('No se pudo leer la factura automáticamente — completá los datos a mano.');
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
    return e==='aprobada' ? 'Aprobada' : e==='recibida' ? 'Recibida' : 'Pendiente';
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
    return p ? p.nombre : '(proveedor eliminado)';
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
  function centroCostoLabel(id){
    var c = centroCostoById(id);
    return c ? (c.codigo+' — '+c.descripcion) : '';
  }
  function generateCentroCostoId(codigo){
    var base = slug(codigo) || 'cc';
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

  function renderCentrosCostoList(){
    var body = document.getElementById('centros-costo-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.centrosCosto.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="2">Todavía no hay centros de costo cargados.</td></tr>';
      return;
    }
    state.centrosCosto.slice().sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||'', undefined, {numeric:true}); }).forEach(function(c){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      tr.innerHTML = '<td class="day-route num">'+esc(c.codigo)+'</td>'
        +'<td>'+esc(c.descripcion)+'</td>';
      tr.addEventListener('click', function(){ openCentroCostoModal(c.id); });
      body.appendChild(tr);
    });
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
    state.sb.from('centros_costo').upsert({
      id:c.id, codigo:c.codigo||'', descripcion:c.descripcion||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar el centro de costo: '+res.error.message);
    });
  }

  function openCentroCostoModal(id){
    state.editingCentroCostoId = id || null;
    var c = id ? centroCostoById(id) : null;
    document.getElementById('ccm-title').textContent = c ? 'Editar centro de costo' : 'Nuevo centro de costo';
    document.getElementById('ccm-codigo').value = c ? c.codigo : '';
    document.getElementById('ccm-descripcion').value = c ? c.descripcion : '';
    document.getElementById('ccm-delete').style.display = c ? '' : 'none';
    document.getElementById('centro-costo-overlay').classList.add('show');
  }
  function closeCentroCostoModal(){
    document.getElementById('centro-costo-overlay').classList.remove('show');
  }

  document.getElementById('new-centro-costo-btn').addEventListener('click', function(){ openCentroCostoModal(null); });
  document.getElementById('ccm-cancel').addEventListener('click', closeCentroCostoModal);
  document.getElementById('centro-costo-overlay').addEventListener('click', function(e){ if(e.target===this) closeCentroCostoModal(); });
  document.getElementById('ccm-save').addEventListener('click', function(){
    var codigo = document.getElementById('ccm-codigo').value.trim();
    if(!codigo){ showToast('Ingresá el código del centro de costo.'); return; }
    var descripcion = document.getElementById('ccm-descripcion').value.trim();
    if(!descripcion){ showToast('Ingresá la descripción del centro de costo.'); return; }
    var id = state.editingCentroCostoId;
    var isNew = !id;
    if(isNew) id = generateCentroCostoId(codigo);
    var c = { id:id, codigo:codigo, descripcion:descripcion };
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
    var used = state.facturas.some(function(f){ return f.centroCostoId===id; });
    if(used){ showToast('No se puede eliminar: hay facturas con este centro de costo.'); return; }
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
  document.getElementById('concepto-overlay').addEventListener('click', function(e){ if(e.target===this) closeConceptoModal(); });
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
    var used = state.facturas.some(function(f){ return f.conceptoId===id; });
    if(used){ showToast('No se puede eliminar: hay facturas con este concepto.'); return; }
    state.conceptos = state.conceptos.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('conceptos').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeConceptoModal();
    renderConceptosList();
    showToast('Concepto eliminado.');
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
        return (p.nombre||'').toLowerCase().indexOf(q)!==-1 || (p.cuit||'').toLowerCase().indexOf(q)!==-1;
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
    renderOCList();
  }

  function renderProveedoresList(){
    var body = document.getElementById('proveedores-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.proveedores.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="5">Todavía no hay proveedores cargados.</td></tr>';
      return;
    }
    state.proveedores.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }).forEach(function(p){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      tr.innerHTML = '<td class="day-route">'+esc(p.nombre)+'</td>'
        +'<td>'+esc(p.rubro||'—')+'</td>'
        +'<td>'+esc(p.contacto||'—')+'</td>'
        +'<td class="num">'+esc(p.telefono||'—')+'</td>'
        +'<td></td>';
      tr.addEventListener('click', function(){ openProveedorModal(p.id); });
      body.appendChild(tr);
    });
  }

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
      tr.addEventListener('click', function(){ openOCModal(o.id); });
      body.appendChild(tr);
    });
  }

  function writeProveedor(p){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('proveedores').upsert({
      id:p.id, nombre:p.nombre, cuit:p.cuit||'', rubro:p.rubro||'', contacto:p.contacto||'',
      telefono:p.telefono||'', email:p.email||'', direccion:p.direccion||'',
      banco:p.banco||'', cbu:p.cbu||'', notas:p.notas||'', archivos:p.archivos||[]
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar el proveedor: '+res.error.message);
    });
  }

  function openProveedorModal(id){
    state.editingProveedorId = id || null;
    var p = id ? state.proveedores.find(function(x){ return x.id===id; }) : null;
    document.getElementById('pm-title').textContent = p ? 'Editar proveedor' : 'Nuevo proveedor';
    document.getElementById('pm-nombre').value = p ? p.nombre : '';
    document.getElementById('pm-cuit').value = p ? (p.cuit||'') : '';
    document.getElementById('pm-rubro').value = p ? (p.rubro||'') : '';
    document.getElementById('pm-contacto').value = p ? (p.contacto||'') : '';
    document.getElementById('pm-telefono').value = p ? (p.telefono||'') : '';
    document.getElementById('pm-email').value = p ? (p.email||'') : '';
    document.getElementById('pm-direccion').value = p ? (p.direccion||'') : '';
    document.getElementById('pm-banco').value = p ? (p.banco||'') : '';
    document.getElementById('pm-cbu').value = p ? (p.cbu||'') : '';
    document.getElementById('pm-notas').value = p ? (p.notas||'') : '';
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
  document.getElementById('proveedor-overlay').addEventListener('click', function(e){ if(e.target===this) closeProveedorModal(); });
  document.getElementById('pm-save').addEventListener('click', function(){
    var nombre = document.getElementById('pm-nombre').value.trim();
    if(!nombre){ showToast('Ingresá el nombre del proveedor.'); return; }
    var id = state.editingProveedorId;
    var isNew = !id;
    if(isNew) id = generateProveedorId(nombre);
    var baseData = {
      id:id, nombre:nombre,
      cuit: document.getElementById('pm-cuit').value.trim(),
      rubro: document.getElementById('pm-rubro').value.trim(),
      contacto: document.getElementById('pm-contacto').value.trim(),
      telefono: document.getElementById('pm-telefono').value.trim(),
      email: document.getElementById('pm-email').value.trim(),
      direccion: document.getElementById('pm-direccion').value.trim(),
      banco: document.getElementById('pm-banco').value.trim(),
      cbu: document.getElementById('pm-cbu').value.trim(),
      notas: document.getElementById('pm-notas').value.trim()
    };
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
    state.sb.from('ordenes_compra').upsert({
      id:o.id, numero:o.numero, proveedor_id:o.proveedorId||'', fecha:o.fecha||'',
      descripcion:o.descripcion||'', monto:o.monto||0, estado:o.estado||'pendiente',
      notas:o.notas||'', who:o.who||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar la orden de compra: '+res.error.message);
    });
  }

  function openOCModal(id){
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
    document.getElementById('oc-overlay').classList.add('show');
  }
  function closeOCModal(){
    document.getElementById('oc-overlay').classList.remove('show');
  }

  document.getElementById('new-oc-btn').addEventListener('click', function(){ openOCModal(null); });
  document.getElementById('ocm-cancel').addEventListener('click', closeOCModal);
  document.getElementById('oc-overlay').addEventListener('click', function(e){ if(e.target===this) closeOCModal(); });
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
    if(!id) return;
    state.ordenesCompra = state.ordenesCompra.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('ordenes_compra').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeOCModal();
    renderCompras();
    showToast('Orden de compra eliminada.');
  });

  function mapProveedorRow(row){
    return {
      id:row.id, nombre:row.nombre||row.id, cuit:row.cuit||'', rubro:row.rubro||'',
      contacto:row.contacto||'', telefono:row.telefono||'', email:row.email||'',
      direccion:row.direccion||'', banco:row.banco||'', cbu:row.cbu||'', notas:row.notas||'',
      archivos: Array.isArray(row.archivos) ? row.archivos : []
    };
  }
  function mapOCRow(row){
    return {
      id:row.id, numero:row.numero||0, proveedorId:row.proveedor_id||'', fecha:row.fecha||'',
      descripcion:row.descripcion||'', monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0,
      estado:row.estado||'pendiente', notas:row.notas||'', who:row.who||''
    };
  }
  function mapCentroCostoRow(row){
    return { id:row.id, codigo:row.codigo||'', descripcion:row.descripcion||'' };
  }
  function mapConceptoRow(row){
    return { id:row.id, nombre:row.nombre||'' };
  }
  function fetchCompras(){
    if(!state.sb) return;
    state.sb.from('proveedores').select('*').then(function(res){
      if(res.error){ showToast('Error cargando proveedores: '+res.error.message); return; }
      state.proveedores = (res.data||[]).map(mapProveedorRow);
      renderCompras();
    });
    state.sb.from('ordenes_compra').select('*').then(function(res){
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
  }

  // ---------- Pagos: facturas y órdenes de pago ----------
  function facturaEstadoLabel(e){ return e==='pagada' ? 'Pagada' : 'Pendiente'; }
  function pagoEstadoLabel(e){ return e==='pagada' ? 'Pagada' : 'Pendiente'; }
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
    renderFacturasList();
    renderPagosList();
  }

  function renderFacturasList(){
    var body = document.getElementById('facturas-body');
    if(!body) return;
    closeFileMenu();
    body.innerHTML = '';
    var list = state.facturas.slice();
    if(state.facturaFilterEstado) list = list.filter(function(f){ return f.estado===state.facturaFilterEstado; });
    list.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="7">No hay facturas'+(state.facturaFilterEstado?' con ese estado':' cargadas')+'.</td></tr>';
      return;
    }
    list.forEach(function(f){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var montoStr = Number(f.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var oc = f.ocId ? state.ordenesCompra.find(function(o){ return o.id===f.ocId; }) : null;
      tr.innerHTML = '<td class="day-route">'+esc(proveedorNombre(f.proveedorId))+'</td>'
        +'<td class="num">'+esc(f.numero||'—')+'</td>'
        +'<td class="num">'+esc(f.fecha||'—')+'</td>'
        +'<td>'+(oc ? esc(ocNumeroLabel(oc.numero)) : '—')+'</td>'
        +'<td class="num">$'+montoStr+'</td>'
        +'<td><span class="oc-badge '+esc(f.estado||'pendiente')+'">'+facturaEstadoLabel(f.estado)+'</span></td>';
      var tdArchivo = document.createElement('td');
      tdArchivo.className = 'file-cell';
      tdArchivo.appendChild(buildFileLinks((f.archivos||[]).filter(function(x){ return !x.pending && archivoUrl(x); })));
      tr.appendChild(tdArchivo);
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
      tr.innerHTML = '<td class="day-route num">'+pagoNumeroLabel(p.numero)+'</td>'
        +'<td>'+esc(proveedorNombre(p.proveedorId))+'</td>'
        +'<td class="num">'+esc(p.fecha||'—')+'</td>'
        +'<td class="day-note">'+esc(facturasLabel)+'</td>'
        +'<td class="num">$'+montoStr+'</td>'
        +'<td><span class="oc-badge '+esc(p.estado||'pendiente')+'">'+pagoEstadoLabel(p.estado)+'</span></td>';
      tr.addEventListener('click', function(){ openPagoModal(p.id); });
      body.appendChild(tr);
    });
  }

  function writeFactura(f){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('facturas').upsert({
      id:f.id, proveedor_id:f.proveedorId||'', oc_id:f.ocId||null,
      centro_costo_id:f.centroCostoId||null, concepto_id:f.conceptoId||null, numero:f.numero||'',
      fecha:f.fecha||'', monto:f.monto||0, estado:f.estado||'pendiente', notas:f.notas||'', archivos:f.archivos||[]
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar la factura: '+res.error.message);
    });
  }

  function fillFacturaOCSelect(proveedorId){
    var sel = document.getElementById('fm-oc');
    var ocs = state.ordenesCompra.filter(function(o){ return o.proveedorId===proveedorId; })
      .sort(function(a,b){ return (b.numero||0)-(a.numero||0); });
    sel.innerHTML = '<option value="">Sin orden de compra</option>';
    ocs.forEach(function(o){
      var opt = document.createElement('option');
      opt.value = o.id;
      opt.textContent = ocNumeroLabel(o.numero)+' — '+(o.descripcion||'(sin descripción)');
      sel.appendChild(opt);
    });
  }
  document.getElementById('fm-proveedor').addEventListener('change', function(){ fillFacturaOCSelect(this.value); });

  function fillFacturaCentroCostoSelect(){
    var sel = document.getElementById('fm-centro-costo');
    var current = sel.value;
    fillSelect(sel, state.centrosCosto.slice().sort(function(a,b){ return (a.codigo||'').localeCompare(b.codigo||'', undefined, {numeric:true}); }).map(function(c){ return {id:c.id, label:c.codigo+' — '+c.descripcion}; }), 'id', 'label', 'Elegir centro de costo');
    sel.value = current;
  }
  function fillFacturaConceptoSelect(){
    var sel = document.getElementById('fm-concepto');
    var current = sel.value;
    fillSelect(sel, state.conceptos.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }), 'id', 'nombre', 'Elegir concepto');
    sel.value = current;
  }

  // ---------- Archivos de Drive: acceso directo desde la lista de facturas ----------
  function archivoUrl(x){
    if(!x) return '';
    if(x.url) return x.url;
    return x.id ? 'https://drive.google.com/file/d/'+x.id+'/view' : '';
  }
  var fileMenuEl = null;
  function closeFileMenu(){ if(fileMenuEl){ fileMenuEl.remove(); fileMenuEl = null; } }
  function toggleFileMenu(btn, files){
    var same = fileMenuEl && fileMenuEl._btn===btn;
    closeFileMenu();
    if(same) return;
    var m = document.createElement('div');
    m.className = 'file-menu';
    m._btn = btn;
    files.forEach(function(f){
      var lk = document.createElement('a');
      lk.href = archivoUrl(f); lk.target = '_blank'; lk.rel = 'noopener';
      lk.textContent = f.name || 'archivo'; lk.title = f.name || 'archivo';
      lk.addEventListener('click', function(e){ e.stopPropagation(); setTimeout(closeFileMenu, 0); });
      m.appendChild(lk);
    });
    document.body.appendChild(m);
    var r = btn.getBoundingClientRect();
    m.style.top = (r.bottom + 4) + 'px';
    m.style.left = Math.max(8, r.right - m.offsetWidth) + 'px';
    fileMenuEl = m;
  }
  document.addEventListener('click', closeFileMenu);
  window.addEventListener('resize', closeFileMenu);
  window.addEventListener('scroll', closeFileMenu, true);

  // Celda "Archivo": sin adjuntos un guion; con uno, enlace directo; con varios, un menú
  function buildFileLinks(files){
    var wrap = document.createElement('span');
    if(!files.length){ wrap.className = 'file-none'; wrap.textContent = '—'; return wrap; }
    if(files.length===1){
      var lk = document.createElement('a');
      lk.className = 'file-link'; lk.href = archivoUrl(files[0]); lk.target = '_blank'; lk.rel = 'noopener';
      lk.title = files[0].name || 'Abrir archivo en Drive'; lk.textContent = '📎 Ver';
      lk.addEventListener('click', function(e){ e.stopPropagation(); });
      wrap.appendChild(lk);
      return wrap;
    }
    var btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'file-link'; btn.title = 'Ver los '+files.length+' archivos';
    btn.textContent = '📎 '+files.length;
    btn.addEventListener('click', function(e){ e.stopPropagation(); toggleFileMenu(btn, files); });
    wrap.appendChild(btn);
    return wrap;
  }

  // ---------- Vista previa del archivo al costado del formulario de factura ----------
  var fmPreview = { url:null, file:null, dismissed:false, lastCount:0 };
  function isPreviewableFile(file){
    if(!file) return false;
    var t = file.type || '';
    var n = (file.name || '').toLowerCase();
    return t==='application/pdf' || t.indexOf('image/')===0 || n.slice(-4)==='.pdf';
  }
  function fmPreviewRelease(){
    if(fmPreview.url){ try{ URL.revokeObjectURL(fmPreview.url); }catch(e){} }
    fmPreview.url = null; fmPreview.file = null;
  }
  function hideFacturaPreview(){
    fmPreviewRelease();
    var panel = document.getElementById('fm-preview');
    var body = document.getElementById('fm-preview-body');
    var modal = document.getElementById('factura-modal');
    if(body) body.innerHTML = '';
    if(panel) panel.hidden = true;
    if(modal) modal.classList.remove('has-preview');
  }
  function resetFacturaPreview(){
    fmPreview.dismissed = false; fmPreview.lastCount = 0;
    hideFacturaPreview();
  }
  function showFacturaPreview(file){
    var panel = document.getElementById('fm-preview');
    var body = document.getElementById('fm-preview-body');
    var modal = document.getElementById('factura-modal');
    var title = document.getElementById('fm-preview-name');
    if(!panel || !body || !modal || !isPreviewableFile(file)) return;
    if(typeof URL==='undefined' || !URL.createObjectURL) return;
    fmPreviewRelease();
    body.innerHTML = '';
    var url = URL.createObjectURL(file);
    fmPreview.url = url; fmPreview.file = file;
    var isPdf = (file.type==='application/pdf') || (file.name||'').toLowerCase().slice(-4)==='.pdf';
    title.textContent = file.name || 'Archivo';
    if(isPdf){
      var fr = document.createElement('iframe');
      fr.className = 'fm-preview-frame'; fr.title = 'Vista previa de la factura'; fr.src = url + '#view=FitH';
      body.appendChild(fr);
    } else {
      var img = document.createElement('img');
      img.className = 'fm-preview-img'; img.alt = 'Vista previa de la factura'; img.src = url;
      img.title = 'Clic para acercar o alejar';
      img.addEventListener('click', function(){ img.classList.toggle('zoom'); });
      img.addEventListener('error', function(){
        body.innerHTML = '<div class="fm-preview-fallback">No se puede mostrar esta imagen acá. Usá «Abrir» para verla en otra pestaña.</div>';
      });
      body.appendChild(img);
    }
    panel.hidden = false;
    modal.classList.add('has-preview');
  }
  // Decide qué archivo pendiente mostrar cada vez que cambia la lista de adjuntos:
  // el último que se agregó; si se quitan todos, se cierra el panel.
  function syncFacturaPreview(){
    var pend = (state.editingFacturaArchivos || []).filter(function(x){ return x.pending && isPreviewableFile(x.file); });
    var count = pend.length;
    var increased = count > (fmPreview.lastCount || 0);
    fmPreview.lastCount = count;
    if(increased) fmPreview.dismissed = false;
    if(!count){ hideFacturaPreview(); return; }
    if(fmPreview.dismissed) return;
    var want = increased ? pend[pend.length-1] : (pend.filter(function(x){ return x.file===fmPreview.file; })[0] || pend[pend.length-1]);
    if(want.file !== fmPreview.file) showFacturaPreview(want.file);
  }
  document.getElementById('fm-preview-close').addEventListener('click', function(){
    fmPreview.dismissed = true;
    hideFacturaPreview();
  });
  document.getElementById('fm-preview-open').addEventListener('click', function(){
    if(fmPreview.url) window.open(fmPreview.url, '_blank');
  });

  function openFacturaModal(id){
    state.editingFacturaId = id || null;
    resetFacturaPreview();
    var f = id ? facturaById(id) : null;
    document.getElementById('fm-title').textContent = f ? 'Editar factura' : 'Nueva factura';
    setProveedorComboValue('fm-proveedor', f ? f.proveedorId : '');
    fillFacturaOCSelect(f ? f.proveedorId : '');
    document.getElementById('fm-oc').value = f ? (f.ocId||'') : '';
    fillFacturaCentroCostoSelect();
    document.getElementById('fm-centro-costo').value = f ? (f.centroCostoId||'') : '';
    fillFacturaConceptoSelect();
    document.getElementById('fm-concepto').value = f ? (f.conceptoId||'') : '';
    document.getElementById('fm-numero').value = f ? (f.numero||'') : '';
    document.getElementById('fm-fecha').value = f ? (f.fecha||todayStr()) : todayStr();
    document.getElementById('fm-monto').value = f ? String(f.monto||0).replace('.',',') : '';
    document.getElementById('fm-notas').value = f ? (f.notas||'') : '';
    document.getElementById('fm-delete').style.display = f ? '' : 'none';
    state.editingFacturaArchivos = f ? (f.archivos||[]).slice() : [];
    renderAttachList('fm-archivos-list', function(){ return state.editingFacturaArchivos; });
    refreshFacturaReadAvailability();
    document.getElementById('factura-overlay').classList.add('show');
  }
  function closeFacturaModal(){
    document.getElementById('factura-overlay').classList.remove('show');
    resetFacturaPreview();
  }

  document.getElementById('new-factura-btn').addEventListener('click', function(){ openFacturaModal(null); });
  document.getElementById('fm-cancel').addEventListener('click', closeFacturaModal);
  document.getElementById('factura-overlay').addEventListener('click', function(e){ if(e.target===this) closeFacturaModal(); });
  document.getElementById('factura-filter-estado').addEventListener('change', function(){
    state.facturaFilterEstado = this.value;
    renderFacturasList();
  });
  document.getElementById('fm-save').addEventListener('click', function(){
    var proveedorId = document.getElementById('fm-proveedor').value;
    if(!proveedorId){ showToast('Elegí un proveedor (buscalo por nombre en el campo Proveedor).'); return; }
    var centroCostoId = document.getElementById('fm-centro-costo').value;
    if(!centroCostoId){ showToast('Elegí un centro de costo.'); return; }
    var conceptoId = document.getElementById('fm-concepto').value;
    if(!conceptoId){ showToast('Elegí un concepto.'); return; }
    var numero = document.getElementById('fm-numero').value.trim();
    if(!numero){ showToast('Ingresá el número de factura.'); return; }
    var montoRaw = document.getElementById('fm-monto').value.replace(',','.').trim();
    var monto = parseFloat(montoRaw);
    if(isNaN(monto) || monto<0) monto = 0;
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
      closeFacturaModal();
      renderPagos();
      showToast('Factura guardada.');
    }).catch(function(err){
      showToast('No se pudieron subir uno o más adjuntos a Drive: '+((err&&err.message)||'error')+'. Probá guardar de nuevo.');
    }).finally(function(){ saveBtn.disabled = false; });
  });
  document.getElementById('fm-delete').addEventListener('click', function(){
    var id = state.editingFacturaId;
    if(!id) return;
    var used = state.ordenesPago.some(function(p){ return (p.facturaIds||[]).indexOf(id)!==-1; });
    if(used){ showToast('No se puede eliminar: está incluida en una orden de pago.'); return; }
    state.editingFacturaArchivos.forEach(function(a){ if(!a.pending && a.id) deleteAdjunto(a.id); });
    state.facturas = state.facturas.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('facturas').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closeFacturaModal();
    renderPagos();
    showToast('Factura eliminada.');
  });

  function writePago(p){
    if(!state.sb){ showToast('No se pudo guardar: sin conexión.'); return; }
    state.sb.from('ordenes_pago').upsert({
      id:p.id, numero:p.numero, proveedor_id:p.proveedorId||'', factura_ids:p.facturaIds||[],
      fecha:p.fecha||'', monto:p.monto||0, medio_pago:p.medioPago||'transferencia',
      estado:p.estado||'pendiente', cuenta_id:p.cuentaId||null, notas:p.notas||'', who:p.who||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar la orden de pago: '+res.error.message);
    });
  }

  function selectedPagoFacturaIds(){
    return Array.prototype.slice.call(document.querySelectorAll('#pom-facturas-list input[type=checkbox]:checked')).map(function(c){ return c.value; });
  }
  function updatePagoMontoTotal(){
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
  document.getElementById('pom-proveedor').addEventListener('change', function(){ renderPagoFacturasChecklist(this.value, []); });

  function updatePomCuentaVisibility(){
    var show = document.getElementById('pom-estado').value === 'pagada';
    document.getElementById('pom-cuenta-field').style.display = show ? '' : 'none';
  }
  document.getElementById('pom-estado').addEventListener('change', updatePomCuentaVisibility);

  function openPagoModal(id){
    fillMovimientoCuentaSelect(document.getElementById('pom-cuenta'));
    state.editingPagoId = id || null;
    var p = id ? state.ordenesPago.find(function(x){ return x.id===id; }) : null;
    document.getElementById('pom-title').textContent = p ? 'Editar orden de pago' : 'Nueva orden de pago';
    document.getElementById('pom-sub').textContent = p ? pagoNumeroLabel(p.numero) : 'Se le asigna un número al guardar';
    setProveedorComboValue('pom-proveedor', p ? p.proveedorId : '');
    renderPagoFacturasChecklist(p ? p.proveedorId : '', p ? (p.facturaIds||[]) : []);
    document.getElementById('pom-fecha').value = p ? (p.fecha||todayStr()) : todayStr();
    document.getElementById('pom-medio').value = p ? (p.medioPago||'transferencia') : 'transferencia';
    document.getElementById('pom-estado').value = p ? (p.estado||'pendiente') : 'pendiente';
    document.getElementById('pom-cuenta').value = p ? (p.cuentaId||'') : '';
    updatePomCuentaVisibility();
    document.getElementById('pom-notas').value = p ? (p.notas||'') : '';
    document.getElementById('pom-delete').style.display = p ? '' : 'none';
    document.getElementById('pago-overlay').classList.add('show');
  }
  function closePagoModal(){
    document.getElementById('pago-overlay').classList.remove('show');
  }

  document.getElementById('new-pago-btn').addEventListener('click', function(){ openPagoModal(null); });
  document.getElementById('pom-cancel').addEventListener('click', closePagoModal);
  document.getElementById('pago-overlay').addEventListener('click', function(e){ if(e.target===this) closePagoModal(); });
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
    var cuentaId = document.getElementById('pom-cuenta').value || '';
    if(estado==='pagada' && !cuentaId){ showToast('Elegí de qué cuenta sale el pago.'); return; }
    var monto = facturaIds.reduce(function(s,id){ var f=facturaById(id); return s+(f?Number(f.monto||0):0); },0);
    var id = state.editingPagoId;
    var isNew = !id;
    var existing = id ? state.ordenesPago.find(function(x){ return x.id===id; }) : null;
    var numero = isNew ? nextPagoNumero() : (existing ? existing.numero : nextPagoNumero());
    if(isNew) id = 'op_'+numero;
    var p = {
      id:id, numero:numero, proveedorId:proveedorId, facturaIds:facturaIds,
      fecha: document.getElementById('pom-fecha').value || todayStr(),
      monto: monto,
      medioPago: document.getElementById('pom-medio').value || 'transferencia',
      estado: estado,
      cuentaId: estado==='pagada' ? cuentaId : '',
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
    showToast('Orden de pago guardada.');
  });
  document.getElementById('pom-delete').addEventListener('click', function(){
    var id = state.editingPagoId;
    if(!id) return;
    var p = state.ordenesPago.find(function(x){ return x.id===id; });
    if(p) (p.facturaIds||[]).forEach(function(fid){ setFacturaEstado(fid, 'pendiente'); });
    if(movimientoById(movimientoIdForPago(id))) deleteMovimiento(movimientoIdForPago(id));
    state.ordenesPago = state.ordenesPago.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('ordenes_pago').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar: '+res.error.message);
    });
    closePagoModal();
    renderPagos();
    renderTesoreria();
    showToast('Orden de pago eliminada.');
  });

  function mapFacturaRow(row){
    return {
      id:row.id, proveedorId:row.proveedor_id||'', ocId:row.oc_id||'',
      centroCostoId:row.centro_costo_id||'', conceptoId:row.concepto_id||'', numero:row.numero||'',
      fecha:row.fecha||'', monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0,
      estado:row.estado||'pendiente', notas:row.notas||'',
      archivos: Array.isArray(row.archivos) ? row.archivos : []
    };
  }
  function mapPagoRow(row){
    return {
      id:row.id, numero:row.numero||0, proveedorId:row.proveedor_id||'', facturaIds:row.factura_ids||[],
      fecha:row.fecha||'', monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0,
      medioPago:row.medio_pago||'transferencia', estado:row.estado||'pendiente', cuentaId:row.cuenta_id||'',
      notas:row.notas||'', who:row.who||''
    };
  }
  function fetchFacturasYPagos(){
    if(!state.sb) return;
    state.sb.from('facturas').select('*').then(function(res){
      if(res.error){ showToast('Error cargando facturas: '+res.error.message); return; }
      state.facturas = (res.data||[]).map(mapFacturaRow);
      renderPagos();
      if(state.view==='dashboard') renderDashboard();
    });
    state.sb.from('ordenes_pago').select('*').then(function(res){
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
  function cuentaSaldoActual(cuentaId){
    var c = cuentaById(cuentaId);
    if(!c) return 0;
    var egresos = state.movimientos.filter(function(m){ return m.cuentaId===cuentaId; })
      .reduce(function(s,m){ return s+Number(m.monto||0); }, 0);
    return Number(c.saldoInicial||0) - egresos;
  }

  function renderTesoreria(){
    renderCuentasList();
    fillMovFilterCuentaSelect();
    renderMovimientosList();
  }

  function renderCuentasList(){
    var body = document.getElementById('cuentas-body');
    if(!body) return;
    body.innerHTML = '';
    if(state.cuentas.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="5">Todavía no hay cuentas cargadas.</td></tr>';
      return;
    }
    state.cuentas.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }).forEach(function(c){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var inicialStr = Number(c.saldoInicial||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var actual = cuentaSaldoActual(c.id);
      var actualStr = actual.toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      tr.innerHTML = '<td class="day-route">'+esc(c.nombre)+'</td>'
        +'<td>'+cuentaTipoLabel(c.tipo)+'</td>'
        +'<td class="num">$'+inicialStr+'</td>'
        +'<td class="num'+(actual<0?' cuenta-saldo-neg':'')+'">$'+actualStr+'</td>'
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

  function renderMovimientosList(){
    var body = document.getElementById('movimientos-body');
    if(!body) return;
    body.innerHTML = '';
    var list = state.movimientos.slice();
    if(state.movFilterCuenta) list = list.filter(function(m){ return m.cuentaId===state.movFilterCuenta; });
    list.sort(function(a,b){ return (b.fecha||'').localeCompare(a.fecha||''); });
    if(list.length===0){
      body.innerHTML = '<tr class="day-row empty"><td colspan="5">No hay movimientos'+(state.movFilterCuenta?' en esta cuenta':' cargados')+'.</td></tr>';
      return;
    }
    list.forEach(function(m){
      var tr = document.createElement('tr');
      tr.className = 'day-row';
      var montoStr = Number(m.monto||0).toLocaleString('es-AR', {minimumFractionDigits:2, maximumFractionDigits:2});
      var isAuto = !!m.pagoId;
      tr.innerHTML = '<td class="num">'+esc(m.fecha||'—')+'</td>'
        +'<td>'+esc(cuentaNombre(m.cuentaId))+'</td>'
        +'<td class="day-note">'+esc(m.concepto||'—')+'</td>'
        +'<td><span class="mov-origen-badge'+(isAuto?' auto':'')+'">'+(isAuto?'Orden de pago':'Manual')+'</span></td>'
        +'<td class="num">$'+montoStr+'</td>';
      if(!isAuto) tr.addEventListener('click', function(){ openMovimientoModal(m.id); });
      body.appendChild(tr);
    });
  }

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
  document.getElementById('cuenta-overlay').addEventListener('click', function(e){ if(e.target===this) closeCuentaModal(); });
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
    state.sb.from('movimientos').upsert({
      id:m.id, cuenta_id:m.cuentaId||'', fecha:m.fecha||'', concepto:m.concepto||'', monto:m.monto||0,
      pago_id:m.pagoId||null, notas:m.notas||''
    }).then(function(res){
      if(res.error) showToast('No se pudo guardar el movimiento: '+res.error.message);
    });
  }
  function deleteMovimiento(id){
    state.movimientos = state.movimientos.filter(function(x){ return x.id!==id; });
    if(state.sb) state.sb.from('movimientos').delete().eq('id', id).then(function(res){
      if(res.error) showToast('No se pudo eliminar el movimiento: '+res.error.message);
    });
  }
  // Mantiene sincronizado el egreso automático de una orden de pago: lo
  // crea/actualiza si la OP queda Pagada (con una cuenta elegida) y lo
  // elimina si deja de estar pagada o se borra la OP.
  function syncPagoMovimiento(pago){
    var movId = movimientoIdForPago(pago.id);
    if(pago.estado==='pagada' && pago.cuentaId){
      var m = {
        id:movId, cuentaId:pago.cuentaId, fecha:pago.fecha||todayStr(),
        concepto:'Pago '+pagoNumeroLabel(pago.numero)+' — '+proveedorNombre(pago.proveedorId),
        monto:pago.monto||0, pagoId:pago.id, notas:''
      };
      var idx = state.movimientos.findIndex(function(x){ return x.id===movId; });
      if(idx>=0) state.movimientos[idx]=m; else state.movimientos.push(m);
      writeMovimiento(m);
    } else {
      if(movimientoById(movId)) deleteMovimiento(movId);
    }
  }

  function fillMovimientoCuentaSelect(sel){
    fillSelect(sel, state.cuentas.slice().sort(function(a,b){ return (a.nombre||'').localeCompare(b.nombre||''); }), 'id', 'nombre', 'Elegir cuenta');
  }

  function openMovimientoModal(id){
    fillMovimientoCuentaSelect(document.getElementById('movm-cuenta'));
    state.editingMovimientoId = id || null;
    var m = id ? movimientoById(id) : null;
    document.getElementById('movm-title').textContent = m ? 'Editar movimiento' : 'Nuevo movimiento';
    document.getElementById('movm-cuenta').value = m ? m.cuentaId : '';
    document.getElementById('movm-fecha').value = m ? (m.fecha||todayStr()) : todayStr();
    document.getElementById('movm-monto').value = m ? String(m.monto||0).replace('.',',') : '';
    document.getElementById('movm-concepto').value = m ? (m.concepto||'') : '';
    document.getElementById('movm-notas').value = m ? (m.notas||'') : '';
    document.getElementById('movm-delete').style.display = m ? '' : 'none';
    document.getElementById('movimiento-overlay').classList.add('show');
  }
  function closeMovimientoModal(){
    document.getElementById('movimiento-overlay').classList.remove('show');
  }

  document.getElementById('new-movimiento-btn').addEventListener('click', function(){ openMovimientoModal(null); });
  document.getElementById('movm-cancel').addEventListener('click', closeMovimientoModal);
  document.getElementById('movimiento-overlay').addEventListener('click', function(e){ if(e.target===this) closeMovimientoModal(); });
  document.getElementById('movm-save').addEventListener('click', function(){
    var cuentaId = document.getElementById('movm-cuenta').value;
    if(!cuentaId){ showToast('Elegí una cuenta.'); return; }
    var montoRaw = document.getElementById('movm-monto').value.replace(',','.').trim();
    var monto = parseFloat(montoRaw);
    if(isNaN(monto) || monto<=0){ showToast('Ingresá un monto válido.'); return; }
    var concepto = document.getElementById('movm-concepto').value.trim();
    if(!concepto){ showToast('Ingresá un concepto.'); return; }
    var id = state.editingMovimientoId;
    var isNew = !id;
    var existing = id ? movimientoById(id) : null;
    if(existing && existing.pagoId){ showToast('Este movimiento viene de una orden de pago y no se puede editar acá.'); return; }
    if(isNew) id = 'mov_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,6);
    var m = {
      id:id, cuentaId:cuentaId,
      fecha: document.getElementById('movm-fecha').value || todayStr(),
      concepto: concepto,
      monto: monto,
      pagoId: '',
      notas: document.getElementById('movm-notas').value.trim()
    };
    if(isNew) state.movimientos.push(m);
    else { var idx = state.movimientos.findIndex(function(x){ return x.id===id; }); if(idx>=0) state.movimientos[idx]=m; }
    writeMovimiento(m);
    closeMovimientoModal();
    renderTesoreria();
    showToast('Movimiento guardado.');
  });
  document.getElementById('movm-delete').addEventListener('click', function(){
    var id = state.editingMovimientoId;
    if(!id) return;
    var existing = movimientoById(id);
    if(existing && existing.pagoId){ showToast('Este movimiento viene de una orden de pago y no se puede borrar acá.'); return; }
    deleteMovimiento(id);
    closeMovimientoModal();
    renderTesoreria();
    showToast('Movimiento eliminado.');
  });

  function mapCuentaRow(row){
    return {
      id:row.id, nombre:row.nombre||row.id, tipo:row.tipo||'caja',
      saldoInicial:typeof row.saldo_inicial==='number'?row.saldo_inicial:parseFloat(row.saldo_inicial)||0,
      notas:row.notas||''
    };
  }
  function mapMovimientoRow(row){
    return {
      id:row.id, cuentaId:row.cuenta_id||'', fecha:row.fecha||'', concepto:row.concepto||'',
      monto:typeof row.monto==='number'?row.monto:parseFloat(row.monto)||0, pagoId:row.pago_id||'', notas:row.notas||''
    };
  }
  function fetchTesoreria(){
    if(!state.sb) return;
    state.sb.from('cuentas').select('*').then(function(res){
      if(res.error){ showToast('Error cargando cuentas: '+res.error.message); return; }
      state.cuentas = (res.data||[]).map(mapCuentaRow);
      renderTesoreria();
    });
    state.sb.from('movimientos').select('*').then(function(res){
      if(res.error){ showToast('Error cargando movimientos: '+res.error.message); return; }
      state.movimientos = (res.data||[]).map(mapMovimientoRow);
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
  document.getElementById('settings-overlay').addEventListener('click', function(e){ if(e.target===this) this.classList.remove('show'); });

  document.getElementById('add-role-btn').addEventListener('click', function(){
    var list = document.getElementById('roles-list');
    list.appendChild(buildRoleCard({id:'perfil_'+Date.now().toString(36), nombre:'', manageAccess:false, permisos:defaultPermisos('oculta')}));
  });

  document.getElementById('auth-save-btn').addEventListener('click', function(){
    var cards = document.querySelectorAll('#roles-list .role-card');
    if(cards.length===0){ showToast('Tiene que haber al menos un perfil.'); return; }
    var roles = [];
    var anyManage = false;
    for(var i=0;i<cards.length;i++){
      var card = cards[i];
      var nombre = card.querySelector('.role-nombre').value.trim();
      if(!nombre){ showToast('Completá el nombre de todos los perfiles.'); return; }
      var manageAccess = card.querySelector('.role-manage-access').checked;
      if(manageAccess) anyManage = true;
      var permisos = {};
      card.querySelectorAll('.role-permiso-select').forEach(function(sel){ permisos[sel.dataset.tab] = sel.value; });
      roles.push({id: card.dataset.roleId, nombre: nombre, manageAccess: manageAccess, permisos: permisos});
    }
    if(!anyManage){ showToast('Al menos un perfil tiene que poder administrar el acceso.'); return; }
    var me = roles.find(function(r){ return r.id===state.roleId; });
    if(!me){ showToast('No podés eliminar tu propio perfil.'); return; }
    if(!me.manageAccess){ showToast('Tu propio perfil tiene que poder administrar el acceso.'); return; }
    var newIds = roles.map(function(r){ return r.id; });
    var removedIds = (state.auth.roles||[]).map(function(r){ return r.id; }).filter(function(id){ return newIds.indexOf(id)===-1; });
    writeAuthRoles(roles, removedIds).then(function(ok){
      if(!ok) return;
      state.auth.roles = roles;
      refreshTabVisibility();
      refreshSettingsTabsVisibility();
      renderUsuariosSettings();
      showToast('Perfiles guardados.');
    });
  });

  document.getElementById('add-usuario-btn').addEventListener('click', function(){
    var inp = document.getElementById('new-usuario-email');
    var email = inp.value.trim().toLowerCase();
    var perfilId = document.getElementById('new-usuario-perfil').value;
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){ showToast('Escribí un email válido.'); return; }
    if(!perfilId){ showToast('Elegí un perfil.'); return; }
    if((state.auth.usuarios||[]).some(function(u){ return u.email===email; })){ showToast('Esa persona ya está en la lista.'); return; }
    var u = {email:email, perfil_id:perfilId, activo:true};
    state.sb.from('usuarios').upsert(u).then(function(res){
      if(res.error){ showToast('No se pudo agregar: '+res.error.message); return; }
      state.auth.usuarios.push(u);
      state.auth.usuarios.sort(function(x,y){ return x.email.localeCompare(y.email); });
      inp.value = '';
      renderUsuariosSettings();
      showToast('Persona agregada. Recordá crearle la cuenta en Supabase (Authentication > Users).');
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
  function mapTruckRow(row){ return {id:row.id, label:row.label||('Camión '+row.id), active:row.active!==false, driver:row.driver||'', helper:row.helper||'', scope:row.scope||'both'}; }
  function mapPersonRow(row){ return {id:row.id, name:row.name||row.id, active:row.active!==false, scope:row.scope||'both'}; }
  function mapCargoTypeRow(row){ return {id:row.id, name:row.name||row.id, active:row.active!==false, order:row.sort_order||99}; }
  function mapBranchRow(row){ return {id:row.id, label:row.label||row.id, order:row.sort_order||99, active:row.active!==false}; }
  function mapExtraItemRow(row){ return {id:row.id, label:row.label||row.id, order:row.sort_order||99, active:row.active!==false}; }

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
  }

  // Carga de datos y conexiones en vivo. Solo se llama DESPUES de iniciar sesión
  // (la base de datos ya no responde a nadie sin login).
  function startData(){
    if(state.started || !state.sb) return;
    state.started = true;
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
    state.sb.channel('proveedores-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'proveedores'}, function(){ fetchCompras(); })
      .subscribe();
    state.sb.channel('ordenes-compra-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'ordenes_compra'}, function(){ fetchCompras(); })
      .subscribe();
    state.sb.channel('centros-costo-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'centros_costo'}, function(){ fetchCompras(); })
      .subscribe();
    state.sb.channel('conceptos-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'conceptos'}, function(){ fetchCompras(); })
      .subscribe();
    state.sb.channel('facturas-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'facturas'}, function(){ fetchFacturasYPagos(); })
      .subscribe();
    state.sb.channel('ordenes-pago-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'ordenes_pago'}, function(){ fetchFacturasYPagos(); })
      .subscribe();
    state.sb.channel('cuentas-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'cuentas'}, function(){ fetchTesoreria(); })
      .subscribe();
    state.sb.channel('movimientos-changes')
      .on('postgres_changes', {event:'*', schema:'public', table:'movimientos'}, function(){ fetchTesoreria(); })
      .subscribe();
  }

  function initSupabase(){
    if(!window.supabase || !window.SUPABASE_URL || window.SUPABASE_URL.indexOf('TU-PROYECTO')!==-1){
      document.getElementById('conn-banner').classList.add('show');
      state.authChecked = true; updateAuthVisibility();
      return;
    }
    try{
      state.sb = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
    }catch(e){
      document.getElementById('conn-banner').classList.add('show');
      state.authChecked = true; updateAuthVisibility();
      return;
    }
    // Ojo: dentro de este callback no se llama a Supabase directamente (puede trabarse); por eso el setTimeout.
    state.sb.auth.onAuthStateChange(function(event, session){
      if(event==='PASSWORD_RECOVERY'){ setTimeout(function(){ openPasswordModal(true); }, 0); return; }
      if(event==='SIGNED_OUT'){
        if(state.loggingOut) return;
        if(state.started){ window.location.reload(); return; }
        state.authChecked = true; updateAuthVisibility();
        return;
      }
      if(session && (event==='SIGNED_IN' || event==='INITIAL_SESSION' || event==='TOKEN_REFRESHED')){
        setTimeout(function(){ handleSession(session); }, 0);
      }
    });
    state.sb.auth.getSession().then(function(res){
      var s = res && res.data && res.data.session;
      if(s){ handleSession(s); }
      else if(!state.accessLoading){ state.authChecked = true; updateAuthVisibility(); }
    }, function(){ state.authChecked = true; updateAuthVisibility(); });
  }

  // ---------- Login con usuarios reales (Supabase Auth) ----------
  function mapPerfilRow(row){
    return {id:row.id, nombre:row.nombre||row.id, manageAccess:!!row.gestiona_acceso, permisos:row.permisos||{}};
  }

  function updateAuthVisibility(){
    var loggedIn = isLoggedIn();
    document.getElementById('login-overlay').classList.toggle('show', state.authChecked && !loggedIn);
    document.querySelector('.shell').hidden = !loggedIn;
  }

  function showLoginError(msg){
    var el = document.getElementById('login-error');
    el.textContent = msg; el.style.display = '';
    document.getElementById('login-info').style.display = 'none';
  }
  function showLoginInfo(msg){
    var el = document.getElementById('login-info');
    el.textContent = msg; el.style.display = '';
    document.getElementById('login-error').style.display = 'none';
  }
  function setLoginBusy(busy){
    var btn = document.getElementById('login-btn');
    btn.disabled = busy;
    btn.textContent = busy ? 'Ingresando…' : 'Ingresar';
  }

  // Busca qué perfil tiene este email y carga los perfiles. Resultado: 'ok' | 'sin_acceso' | 'error'
  function loadAccess(){
    return state.sb.from('usuarios').select('email,perfil_id,activo').eq('email', state.userEmail).then(function(res){
      if(res.error) return 'error';
      var row = (res.data||[])[0];
      if(!row || row.activo===false) return 'sin_acceso';
      return state.sb.from('perfiles').select('*').then(function(r2){
        if(r2.error) return 'error';
        state.auth.roles = (r2.data||[]).map(mapPerfilRow);
        state.roleId = row.perfil_id;
        return currentRole() ? 'ok' : 'sin_acceso';
      });
    }, function(){ return 'error'; });
  }

  function handleSession(session){
    if(!session || !session.user) return;
    if(state.started || state.accessLoading) return;
    var em = (session.user.email||'').toLowerCase();
    if(state.deniedEmail && state.deniedEmail===em) return; // evento atrasado de una cuenta ya rechazada
    state.accessLoading = true;
    state.userEmail = em;
    loadAccess().then(function(result){
      state.accessLoading = false;
      state.authChecked = true;
      setLoginBusy(false);
      if(result==='ok'){
        document.getElementById('login-password').value = '';
        hideLoginMessages();
        startData();
        enterApp();
        loadUsuarios();
        return;
      }
      var msg = result==='sin_acceso'
        ? 'Tu cuenta todavía no tiene acceso a esta aplicación. Pedile acceso al administrador.'
        : 'No se pudo verificar tu acceso. Probá de nuevo en un momento.';
      state.deniedEmail = state.userEmail;
      state.userEmail = ''; state.roleId = null;
      state.loggingOut = true;
      var done = function(){ state.loggingOut = false; updateAuthVisibility(); showLoginError(msg); };
      state.sb.auth.signOut({scope:'local'}).then(done, done);
    });
  }

  function hideLoginMessages(){
    document.getElementById('login-error').style.display = 'none';
    document.getElementById('login-info').style.display = 'none';
  }

  function enterApp(){
    document.getElementById('who-fields').style.display = 'none';
    var em = document.getElementById('user-email');
    if(em){ em.textContent = state.userEmail; em.title = state.userEmail + ' — ' + (currentRole() ? currentRole().nombre : ''); }
    refreshTabVisibility();
    updateAuthVisibility();
    setView(firstAccessibleTab() || 'day');
  }

  function logout(){
    if(!state.sb){ window.location.reload(); return; }
    state.loggingOut = true;
    var done = function(){ window.location.reload(); };
    // scope local: cierra la sesión solo en este navegador (no en los demás dispositivos)
    state.sb.auth.signOut({scope:'local'}).then(done, done);
  }

  function tryLogin(){
    if(!state.sb) return;
    var email = document.getElementById('login-email').value.trim().toLowerCase();
    var pw = document.getElementById('login-password').value;
    if(!email || !pw){ showLoginError('Ingresá tu email y tu contraseña.'); return; }
    hideLoginMessages();
    setLoginBusy(true);
    state.deniedEmail = '';
    state.sb.auth.signInWithPassword({email:email, password:pw}).then(function(res){
      if(res.error || !res.data || !res.data.session){
        setLoginBusy(false);
        showLoginError('Email o contraseña incorrectos.');
        return;
      }
      handleSession(res.data.session);
    }, function(){
      setLoginBusy(false);
      showLoginError('No se pudo conectar. Revisá tu conexión e intentá de nuevo.');
    });
  }

  function forgotPassword(){
    if(!state.sb) return;
    var email = document.getElementById('login-email').value.trim().toLowerCase();
    if(!email){ showLoginError('Escribí tu email arriba y volvé a tocar "Olvidé mi contraseña".'); return; }
    state.sb.auth.resetPasswordForEmail(email, {redirectTo: window.location.origin + window.location.pathname}).then(function(res){
      if(res.error){ showLoginError('No se pudo enviar el correo: '+res.error.message); return; }
      showLoginInfo('Si ese email tiene una cuenta, le llegó un link para elegir una contraseña nueva.');
    });
  }

  // Cambiar contraseña (desde el header) o elegir una nueva (desde el link del correo)
  function openPasswordModal(recovery){
    state.pwRecovery = !!recovery;
    document.getElementById('password-title').textContent = recovery ? 'Elegí tu contraseña nueva' : 'Cambiar mi contraseña';
    document.getElementById('password-new').value = '';
    document.getElementById('password-new2').value = '';
    document.getElementById('password-error').style.display = 'none';
    document.getElementById('password-overlay').classList.add('show');
    document.getElementById('password-new').focus();
  }
  function closePasswordModal(){
    document.getElementById('password-overlay').classList.remove('show');
  }
  function savePassword(){
    var p1 = document.getElementById('password-new').value;
    var p2 = document.getElementById('password-new2').value;
    var err = document.getElementById('password-error');
    function fail(m){ err.textContent = m; err.style.display = ''; }
    if(p1.length < 8){ fail('La contraseña tiene que tener al menos 8 caracteres.'); return; }
    if(p1 !== p2){ fail('Las dos contraseñas no coinciden.'); return; }
    state.sb.auth.updateUser({password:p1}).then(function(res){
      if(res.error){ fail('No se pudo cambiar: '+res.error.message); return; }
      closePasswordModal();
      if(state.pwRecovery){ try{ window.history.replaceState(null, '', window.location.pathname + window.location.search); }catch(e){} }
      showToast('Contraseña actualizada.');
    });
  }

  document.getElementById('login-btn').addEventListener('click', tryLogin);
  document.getElementById('login-password').addEventListener('keydown', function(e){ if(e.key==='Enter') tryLogin(); });
  document.getElementById('login-email').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('login-password').focus(); });
  document.getElementById('login-forgot').addEventListener('click', forgotPassword);
  document.getElementById('logout-btn').addEventListener('click', logout);
  document.getElementById('pwd-btn').addEventListener('click', function(){ openPasswordModal(false); });
  document.getElementById('password-save').addEventListener('click', savePassword);
  document.getElementById('password-cancel').addEventListener('click', closePasswordModal);
  document.getElementById('password-new2').addEventListener('keydown', function(e){ if(e.key==='Enter') savePassword(); });

  // ---------- Init ----------
  renderAll();
  updateAuthVisibility();
  initSupabase();
})();
