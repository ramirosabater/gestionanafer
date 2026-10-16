/* =====================================================================
   Gestión Anafer — Módulo DASHBOARDS
   ---------------------------------------------------------------------
   Un resumen de toda la empresa + el tablero de cada módulo (Logística,
   Administración, Calidad, Comercial, RR.HH.), con el estilo del Tablero
   Comercial. En cada uno, Sifoncito "lee" los indicadores contra TODA la
   historia cargada (promedios, año anterior, tendencias, récords, alertas)
   y dice lo que ve. Además se le puede pedir una opinión escrita con IA
   (función del servidor "sifoncito-opina"): solo se le mandan números
   agregados, nunca datos personales.
   ===================================================================== */
(function () {
  'use strict';
  var G = window.GestionAnafer;
  if (!G) return;
  var $ = function (id) { return document.getElementById(id); };
  var esc = G.esc;

  var OK = '#16a34a', MAL = '#e1251b', AMBAR = '#d48f00', AZUL = '#3456a8', NAVY = '#223c7e', CELESTE = '#2ba9e0', VIOLETA = '#8b5cf6', GRIS = '#94a1ab';
  var MES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var MODULOS = [
    { id: 'resumen', label: 'Resumen', icono: '🏠', traje: 'inicio', tabs: null },
    { id: 'logistica', label: 'Logística', icono: '🚛', traje: 'logistica', tabs: ['grid', 'branches', 'company', 'occasional', 'day', 'dashboard'] },
    { id: 'administracion', label: 'Administración', icono: '🧾', traje: 'administracion', tabs: ['compras', 'pagos', 'tesoreria'] },
    { id: 'calidad', label: 'Calidad', icono: '🔬', traje: 'calidad', tabs: ['reclamos', 'ncpac', 'calidash'] },
    { id: 'comercial', label: 'Comercial', icono: '📊', traje: 'comercial', tabs: ['comercial'] },
    { id: 'rrhh', label: 'RR.HH.', icono: '👥', traje: 'rrhh', tabs: ['rrhh'] },
  ];
  function visible(m) { return !m.tabs || m.tabs.some(function (t) { return G.tabPermiso(t) !== 'oculta'; }); }
  function modulosVisibles() { return MODULOS.filter(function (m) { return m.id !== 'resumen' && visible(m); }); }

  var S = { actual: 'resumen', cache: {}, cargando: {}, opiniones: {} };

  // ---------------- Números ----------------
  function n(v) { return Number(v) || 0; }
  function fmtN(v) { return Math.round(v).toLocaleString('es-AR'); }
  function fmtPct(v, dec) { return (v * 100).toFixed(dec || 0).replace('.', ',') + '%'; }
  function fmtPlata(v) {
    var a = Math.abs(v), s = v < 0 ? '−' : '';
    if (a >= 1e9) return s + '$' + (a / 1e9).toFixed(1).replace('.', ',') + ' mil M';
    if (a >= 1e6) return s + '$' + (a / 1e6).toFixed(1).replace('.', ',') + ' M';
    if (a >= 1e3) return s + '$' + Math.round(a / 1e3).toLocaleString('es-AR') + ' mil';
    return s + '$' + Math.round(a).toLocaleString('es-AR');
  }
  function ym(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
  function ymDe(f) { return String(f || '').slice(0, 7); }
  function ymLabel(k) { return MES[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(2, 4); }
  function ymLargo(k) { return MES_LARGO[Number(k.slice(5, 7)) - 1] + ' ' + k.slice(0, 4); }
  function mesesHasta(ultimoYm, cuantos) {
    var y = Number(ultimoYm.slice(0, 4)), m = Number(ultimoYm.slice(5, 7)) - 1, out = [];
    for (var i = cuantos - 1; i >= 0; i--) { var d = new Date(y, m - i, 1); out.push(ym(d)); }
    return out;
  }
  function hoyYm() { return ym(new Date()); }
  // Serie mensual: suma de valFn por mes, de los últimos `cuantos` meses (hasta el actual).
  function serie(items, fechaFn, valFn, cuantos, hasta) {
    var meses = mesesHasta(hasta || hoyYm(), cuantos || 24), idx = {};
    meses.forEach(function (k, i) { idx[k] = i; });
    var v = meses.map(function () { return 0; });
    items.forEach(function (x) { var k = ymDe(fechaFn(x)); if (idx[k] != null) v[idx[k]] += valFn ? n(valFn(x)) : 1; });
    return meses.map(function (k, i) { return { ym: k, v: v[i] }; });
  }
  function agrupar(list, keyFn, valFn) {
    var o = {};
    list.forEach(function (x) { var k = keyFn(x); if (k == null || k === '') return; o[k] = (o[k] || 0) + (valFn ? n(valFn(x)) : 1); });
    return Object.keys(o).map(function (k) { return { label: k, v: o[k] }; }).sort(function (a, b) { return b.v - a.v; });
  }
  function promedio(xs) { var v = xs.filter(function (x) { return x > 0; }); return v.length ? v.reduce(function (a, b) { return a + b; }, 0) / v.length : 0; }
  function diasDesde(f) { return Math.floor((Date.now() - new Date(String(f).slice(0, 10) + 'T12:00:00').getTime()) / 86400000); }

  // =====================================================================
  // Lecturas de Sifoncito (reglas sobre la historia)
  // =====================================================================
  // Cada lectura: {tono:'bien'|'mal'|'info', texto, peso}. "subirEsBueno":
  // true (más es mejor: ventas), false (más es peor: gastos, reclamos), null (neutro).
  function leerSerie(cfg) {
    var s = cfg.serie, fmt = cfg.fmt || fmtN, out = [], nombre = cfg.nombre;
    var conMesEnCurso = cfg.mesEnCurso !== false;
    var iAct = conMesEnCurso ? s.length - 2 : s.length - 1;
    if (iAct < 1) return out;
    var act = s[iAct].v, mesTxt = ymLargo(s[iAct].ym);
    var prev6 = s.slice(Math.max(0, iAct - 6), iAct).map(function (x) { return x.v; });
    var base = promedio(prev6);
    var tono = function (subio) { return cfg.subirEsBueno == null ? 'info' : (subio === cfg.subirEsBueno ? 'bien' : 'mal'); };
    if (base > 0) {
      var d = act / base - 1;
      if (Math.abs(d) >= 0.12) out.push({ tono: tono(d > 0), peso: Math.min(Math.abs(d), 2),
        texto: nombre + ' de ' + mesTxt + ': <b>' + fmt(act) + '</b>, un <b>' + fmtPct(Math.abs(d)) + (d > 0 ? ' más' : ' menos') + '</b> que el promedio de los 6 meses anteriores (' + fmt(base) + ').' });
      else out.push({ tono: 'info', peso: 0.05, texto: nombre + ' de ' + mesTxt + ': <b>' + fmt(act) + '</b>, en línea con su promedio (' + fmt(base) + ').' });
    } else if (act > 0 && prev6.every(function (x) { return !x; })) {
      out.push({ tono: 'info', peso: 0.02, texto: nombre + ': hay datos desde hace poco; con más meses voy a poder comparar mejor.' });
    }
    // Contra el mismo mes del año anterior
    var iYoy = iAct - 12;
    if (iYoy >= 0 && s[iYoy].v > 0) {
      var d2 = act / s[iYoy].v - 1;
      if (Math.abs(d2) >= 0.15) out.push({ tono: tono(d2 > 0), peso: Math.min(Math.abs(d2), 2) * 0.8,
        texto: 'Contra ' + ymLargo(s[iYoy].ym) + ', ' + nombre.toLowerCase() + ' ' + (d2 > 0 ? 'subió' : 'bajó') + ' un <b>' + fmtPct(Math.abs(d2)) + '</b> (' + fmt(s[iYoy].v) + ' → ' + fmt(act) + ').' });
    }
    // Tendencia: 3 meses seguidos en la misma dirección
    if (iAct >= 3) {
      var a = s[iAct - 3].v, b = s[iAct - 2].v, c = s[iAct - 1].v, e = act;
      if (a > 0 && b > a && c > b && e > c) out.push({ tono: tono(true), peso: 0.6, texto: nombre + ' viene <b>subiendo hace 3 meses seguidos</b> (' + [a, b, c, e].map(fmt).join(' → ') + ').' });
      if (e > 0 && b < a && c < b && e < c) out.push({ tono: tono(false), peso: 0.6, texto: nombre + ' viene <b>bajando hace 3 meses seguidos</b> (' + [a, b, c, e].map(fmt).join(' → ') + ').' });
    }
    // Récords de toda la historia
    var hist = s.slice(0, iAct + 1).filter(function (x) { return x.v > 0; });
    if (hist.length >= 10 && act > 0) {
      var max = Math.max.apply(null, hist.map(function (x) { return x.v; })), min = Math.min.apply(null, hist.map(function (x) { return x.v; }));
      if (act === max) out.push({ tono: tono(true), peso: 0.9, texto: mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1) + ' fue el <b>mes más alto</b> de ' + nombre.toLowerCase() + ' en ' + hist.length + ' meses con datos.' });
      if (act === min) out.push({ tono: tono(false), peso: 0.9, texto: mesTxt.charAt(0).toUpperCase() + mesTxt.slice(1) + ' fue el <b>mes más bajo</b> de ' + nombre.toLowerCase() + ' en ' + hist.length + ' meses con datos.' });
    }
    // Mes en curso proyectado
    if (conMesEnCurso && base > 0) {
      var hoy = new Date(), dia = hoy.getDate(), diasMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
      var parcial = s[s.length - 1].v;
      if (dia >= 7 && parcial > 0) {
        var proy = parcial / dia * diasMes, d3 = proy / base - 1;
        if (Math.abs(d3) >= 0.2) out.push({ tono: tono(d3 > 0), peso: Math.min(Math.abs(d3), 2) * 0.7,
          texto: 'Este mes, si sigue al ritmo actual, ' + nombre.toLowerCase() + ' cerraría en unos <b>' + fmt(proy) + '</b> (' + (d3 > 0 ? '+' : '−') + fmtPct(Math.abs(d3)) + ' vs el promedio).' });
      }
    }
    return out;
  }
  function concentracion(nombre, ranking, umbral, tonoAlto, que) {
    var tot = ranking.reduce(function (t, x) { return t + x.v; }, 0);
    if (!tot || !ranking.length) return [];
    var share = ranking[0].v / tot;
    if (share < umbral) return [];
    return [{ tono: tonoAlto, peso: share, texto: '<b>' + esc(ranking[0].label) + '</b> concentra el <b>' + fmtPct(share) + '</b> ' + que + '.' }];
  }
  function ordenarLecturas(ls) {
    var pr = { mal: 0, bien: 1, info: 2 };
    return ls.slice().sort(function (a, b) { return (pr[a.tono] - pr[b.tono]) || (b.peso - a.peso); });
  }
  function estadoGeneral(ls) {
    var mal = ls.filter(function (x) { return x.tono === 'mal'; }).length, bien = ls.filter(function (x) { return x.tono === 'bien'; }).length;
    if (!ls.length) return { tono: 'info', txt: 'Todavía no tengo datos suficientes para opinar.' };
    if (mal >= 3 && mal > bien) return { tono: 'mal', txt: 'Hay varias cosas que conviene mirar ya.' };
    if (mal > 0) return { tono: 'aviso', txt: 'En general bien, pero hay ' + mal + ' punto' + (mal > 1 ? 's' : '') + ' para mirar.' };
    if (bien > 0) return { tono: 'bien', txt: 'Viene todo bien: no veo alertas.' };
    return { tono: 'info', txt: 'Todo dentro de lo normal.' };
  }

  // =====================================================================
  // Datos por módulo (se cargan cuando hacen falta y quedan en memoria)
  // =====================================================================
  function todasLasFilas(tabla, armar) {
    var sb = G.sb(), out = [], PAGE = 1000;
    function pag(desde) {
      var q = armar(sb.from(tabla)).range(desde, desde + PAGE - 1);
      return Promise.resolve(q).then(function (r) {
        if (r.error) throw r.error;
        out = out.concat(r.data || []);
        return (r.data || []).length === PAGE ? pag(desde + PAGE) : out;
      });
    }
    return pag(0);
  }
  function cargar(id) {
    if (S.cache[id]) return Promise.resolve(S.cache[id]);
    if (S.cargando[id]) return S.cargando[id];
    var f = { logistica: datosLogistica, administracion: datosAdministracion, calidad: datosCalidad, comercial: datosComercial, rrhh: datosRrhh }[id];
    S.cargando[id] = f().then(function (d) { S.cache[id] = d; delete S.cargando[id]; return d; }, function (e) {
      delete S.cargando[id];
      var d = { error: (e && e.message) || String(e) }; S.cache[id] = d; return d;
    });
    return S.cargando[id];
  }

  // ---------- Logística ----------
  function datosLogistica() {
    return Promise.all([G.fetchAllRows('trips'), G.fetchAllRows('visits')]).then(function (rs) {
      if (rs[0].error) throw rs[0].error;
      var trips = (rs[0].data || []).filter(function (t) { return t.date && t.truck; });
      var visits = (rs[1].data || []).filter(function (v) { return v.date; });
      var hoy = G.todayStr(), hace90 = G.sumarDias(hoy, -90), hace30 = G.sumarDias(hoy, -30);
      var real = trips.filter(function (t) { return t.date <= hoy; }); // los viajes futuros son planificación
      var sv = serie(real, function (t) { return t.date; });
      var se = serie(visits.filter(function (v) { return v.date <= hoy; }), function (v) { return v.date; });
      var ult90 = real.filter(function (t) { return t.date >= hace90; });
      var porCamion = agrupar(ult90, function (t) { return t.truck; }).map(function (x) { return { label: 'Camión ' + x.label, v: x.v }; });
      var porRuta = agrupar(ult90, function (t) { return G.labelForRoute(t.route_id); });
      var porChofer = agrupar(ult90, function (t) { return t.driver; });
      var trucks = (G.datos().trucks || []).filter(function (t) { return t.active !== false; });
      var usados30 = {}; real.filter(function (t) { return t.date >= hace30; }).forEach(function (t) { usados30[t.truck] = true; });
      var quietos = trucks.filter(function (t) { return !usados30[t.id]; }).map(function (t) { return t.label || ('Camión ' + t.id); });
      var futuros = trips.filter(function (t) { return t.date > hoy; }).length;
      var L = [].concat(
        leerSerie({ nombre: 'Viajes de FlotaPesada', serie: sv, subirEsBueno: null }),
        leerSerie({ nombre: 'Envíos a sucursales', serie: se, subirEsBueno: null }).slice(0, 2),
        concentracion('camiones', porCamion, 0.35, 'info', 'de los viajes de los últimos 90 días: mucha carga para un solo camión'),
        quietos.length ? [{ tono: 'mal', peso: 0.8, texto: 'Sin viajes en los últimos 30 días: <b>' + esc(quietos.slice(0, 5).join(', ')) + (quietos.length > 5 ? ' y ' + (quietos.length - 5) + ' más' : '') + '</b>. ¿Están en el taller o se pueden usar?' }] : [],
        futuros ? [{ tono: 'bien', peso: 0.2, texto: 'Ya hay <b>' + fmtN(futuros) + ' viajes planificados</b> a futuro.' }] : [{ tono: 'info', peso: 0.3, texto: 'No hay viajes cargados a futuro: conviene planificar (✨ Planificar automáticamente).' }]
      );
      var iAct = sv.length - 2;
      return { serieViajes: sv, serieEnvios: se, porCamion: porCamion, porRuta: porRuta, porChofer: porChofer, quietos: quietos, futuros: futuros, lecturas: L,
        kpi: { viajesMes: sv[iAct].v, mes: sv[iAct].ym, enCurso: sv[sv.length - 1].v, prom6: promedio(sv.slice(iAct - 6, iAct).map(function (x) { return x.v; })), envios: se[iAct].v, camiones: trucks.length } };
    });
  }

  // ---------- Administración ----------
  function datosAdministracion() {
    return new Promise(function (ok) {
      var intentos = 0;
      (function esperar() { // las facturas las carga Gestión al entrar
        if (G.datos().facturasCargadas || intentos++ > 40) ok(); else setTimeout(esperar, 150);
      })();
    }).then(function () {
      var D = G.datos(), hoy = G.todayStr();
      var facts = (D.facturas || []).filter(function (f) { return !G.esAnulado(f) && f.fecha; });
      var sg = serie(facts, function (f) { return f.fecha; }, function (f) { return f.monto; });
      var hace90 = G.sumarDias(hoy, -90), hace180 = G.sumarDias(hoy, -180);
      var ult = facts.filter(function (f) { return f.fecha >= hace90; }), ant = facts.filter(function (f) { return f.fecha >= hace180 && f.fecha < hace90; });
      function porArea(list) {
        var o = {};
        list.forEach(function (f) { G.facturaLineas(f).forEach(function (l) { var r = G.ccRaiz(l.centroCostoId); var k = r ? r.descripcion : '(Sin centro de costo)'; o[k] = (o[k] || 0) + n(l.monto); }); });
        return o;
      }
      var areaU = porArea(ult), areaA = porArea(ant);
      var porAreaR = Object.keys(areaU).map(function (k) { return { label: k, v: areaU[k], antes: areaA[k] || 0 }; }).sort(function (a, b) { return b.v - a.v; });
      var porProv = agrupar(ult, function (f) { return G.proveedorNombre(f.proveedorId); }, function (f) { return f.monto; });
      var pend = facts.filter(function (f) { return f.estado === 'pendiente'; });
      var pendTot = pend.reduce(function (t, f) { return t + n(f.monto); }, 0);
      var viejas = pend.filter(function (f) { return diasDesde(f.fecha) > 60; });
      var ops = (D.ordenesPago || []).filter(function (p) { return !G.esAnulado(p); });
      var pagado = serie(ops.filter(function (p) { return p.estado === 'pagada'; }), function (p) { return p.fecha; }, function (p) { return p.monto; });
      var cuentas = (D.cuentas || []).filter(function (c) { return c.tipo !== 'cartera'; });
      var saldoHoy = cuentas.reduce(function (t, c) { return t + G.cuentaSaldoActual(c.id); }, 0);
      var saldoProy = cuentas.reduce(function (t, c) { return t + G.cuentaSaldoProyectado(c.id); }, 0);
      var subas = porAreaR.filter(function (x) { return x.antes > 0 && x.v / x.antes - 1 >= 0.3 && x.v > 0.05 * ult.reduce(function (t, f) { return t + n(f.monto); }, 0); });
      var L = [].concat(
        leerSerie({ nombre: 'El gasto (facturas de proveedores)', serie: sg, subirEsBueno: false, fmt: fmtPlata }),
        subas.slice(0, 2).map(function (x) { return { tono: 'mal', peso: Math.min(x.v / x.antes - 1, 2), texto: 'El gasto de <b>' + esc(x.label) + '</b> en los últimos 90 días subió un <b>' + fmtPct(x.v / x.antes - 1) + '</b> contra los 90 anteriores (' + fmtPlata(x.antes) + ' → ' + fmtPlata(x.v) + ').' }; }),
        concentracion('proveedores', porProv, 0.3, 'info', 'del gasto de los últimos 90 días'),
        viejas.length ? [{ tono: 'mal', peso: 0.9, texto: 'Hay <b>' + viejas.length + ' factura' + (viejas.length > 1 ? 's' : '') + ' pendiente' + (viejas.length > 1 ? 's' : '') + ' de más de 60 días</b> (' + fmtPlata(viejas.reduce(function (t, f) { return t + n(f.monto); }, 0)) + '). Revisá la Sugerencia de pagos.' }] : (pend.length ? [{ tono: 'bien', peso: 0.3, texto: 'Ninguna factura pendiente tiene más de 60 días.' }] : []),
        cuentas.length && saldoProy < 0 ? [{ tono: 'mal', peso: 1.2, texto: 'El <b>saldo proyectado</b> de cajas y bancos da negativo (' + fmtPlata(saldoProy) + ') cuando se debiten los cheques emitidos.' }] : []
      );
      var iAct = sg.length - 2;
      return { serieGasto: sg, seriePagado: pagado, porArea: porAreaR, porProv: porProv, pendientes: pend.length, pendTot: pendTot, viejas: viejas.length, saldoHoy: saldoHoy, saldoProy: saldoProy, hayCuentas: !!cuentas.length, lecturas: L,
        kpi: { gastoMes: sg[iAct].v, mes: sg[iAct].ym, prom6: promedio(sg.slice(iAct - 6, iAct).map(function (x) { return x.v; })) } };
    });
  }

  // ---------- Calidad ----------
  function datosCalidad() {
    return Promise.all([G.fetchAllRows('calidad_reclamos'), G.fetchAllRows('calidad_pac')]).then(function (rs) {
      if (rs[0].error) throw new Error('Falta crear las tablas de Calidad (calidad.sql).');
      var rec = (rs[0].data || []).filter(function (r) { return !r.anulado_en && r.fecha; });
      var pac = (rs[1].data || []).filter(function (p) { return !p.anulado_en; });
      var just = rec.filter(function (r) { return r.estado === 'Cerrado justificado'; });
      var sr = serie(rec, function (r) { return r.fecha; }), sj = serie(just, function (r) { return r.fecha; });
      var hoy = G.todayStr(), hace90 = G.sumarDias(hoy, -90), hace180 = G.sumarDias(hoy, -180);
      var j90 = just.filter(function (r) { return r.fecha >= hace90; });
      var cerr = function (l) { return l.filter(function (r) { return r.estado !== 'Abierto'; }); };
      var r90 = rec.filter(function (r) { return r.fecha >= hace90; }), r180 = rec.filter(function (r) { return r.fecha >= hace180 && r.fecha < hace90; });
      var pj = cerr(r90).length ? just.filter(function (r) { return r.fecha >= hace90; }).length / cerr(r90).length : null;
      var pjA = cerr(r180).length ? just.filter(function (r) { return r.fecha >= hace180 && r.fecha < hace90; }).length / cerr(r180).length : null;
      var porEnvase = agrupar(j90, function (r) { return r.envase; });
      var porDesvio = agrupar(j90, function (r) { return r.desvio_real; });
      var vencida = function (p) { return p.estado !== 'Cerrada' && ((p.fecha_accion && p.fecha_accion < hoy) || (p.fecha_correccion && p.fecha_correccion < hoy && !p.accion)); };
      var abiertas = pac.filter(function (p) { return p.estado !== 'Cerrada'; }), vencidas = abiertas.filter(vencida);
      var conEf = pac.filter(function (p) { return p.eficacia_resultado === 'Efectiva' || p.eficacia_resultado === 'No efectiva'; });
      var recAbiertos = rec.filter(function (r) { return r.estado === 'Abierto' && diasDesde(r.fecha) > 7; });
      var L = [].concat(
        leerSerie({ nombre: 'Los reclamos de producto', serie: sr, subirEsBueno: false }),
        pj != null && pjA != null && Math.abs(pj - pjA) >= 0.08 ? [{ tono: pj > pjA ? 'mal' : 'bien', peso: Math.abs(pj - pjA) * 3,
          texto: 'De los reclamos controlados en los últimos 90 días, el <b>' + fmtPct(pj) + '</b> resultó justificado (antes era ' + fmtPct(pjA) + ').' }] : [],
        concentracion('envase', porEnvase, 0.45, 'mal', 'de los reclamos justificados de los últimos 90 días (proveedor de envase)'),
        porDesvio.length ? [{ tono: 'info', peso: 0.3, texto: 'El desvío más confirmado en los últimos 90 días es <b>' + esc(porDesvio[0].label) + '</b> (' + porDesvio[0].v + ' casos).' }] : [],
        vencidas.length ? [{ tono: 'mal', peso: 1 + vencidas.length * 0.1, texto: '<b>' + vencidas.length + ' NC / PAC</b> tienen la acción vencida y siguen sin cerrar.' }] : (abiertas.length ? [{ tono: 'bien', peso: 0.3, texto: 'Las ' + abiertas.length + ' NC / PAC abiertas están dentro de sus plazos.' }] : []),
        recAbiertos.length ? [{ tono: 'mal', peso: 0.6, texto: '<b>' + recAbiertos.length + ' reclamos</b> siguen abiertos hace más de una semana.' }] : [],
        conEf.length >= 3 ? [{ tono: conEf.every(function (p) { return p.eficacia_resultado === 'Efectiva'; }) ? 'bien' : 'info', peso: 0.3,
          texto: 'De las acciones verificadas, el <b>' + fmtPct(conEf.filter(function (p) { return p.eficacia_resultado === 'Efectiva'; }).length / conEf.length) + '</b> fueron efectivas.' }] : []
      );
      var iAct = sr.length - 2;
      return { serieRec: sr, serieJust: sj, porEnvase: porEnvase, porDesvio: porDesvio, abiertas: abiertas.length, vencidas: vencidas.length, pj: pj, lecturas: L,
        kpi: { recMes: sr[iAct].v, mes: sr[iAct].ym, prom6: promedio(sr.slice(iAct - 6, iAct).map(function (x) { return x.v; })) } };
    });
  }

  // ---------- Comercial ----------
  function datosComercial() {
    var sb = G.sb();
    return Promise.all([
      todasLasFilas('comercial_mensual', function (q) { return q.select('anio,mes,unidad,presu_monto,real_monto,presu_qty,real_qty').order('anio').order('mes'); }),
      Promise.resolve(sb.from('comercial_altas_bajas').select('*')).then(function (r) { return r.error ? [] : (r.data || []); }),
    ]).then(function (rs) {
      var cia = rs[0].filter(function (r) { return r.unidad === 'Compañía'; });
      if (!cia.length) throw new Error('Todavía no hay datos comerciales cargados.');
      var conReal = cia.filter(function (r) { return n(r.real_monto) > 0; }).map(function (r) { return r.anio * 100 + r.mes; });
      var ultimo = Math.max.apply(null, conReal.length ? conReal : [0]);
      var uAnio = Math.floor(ultimo / 100), uMes = ultimo % 100;
      var hastaYm = uAnio + '-' + String(uMes).padStart(2, '0');
      var meses = mesesHasta(hastaYm, 24), idx = {};
      meses.forEach(function (k, i) { idx[k] = i; });
      var real = meses.map(function (k) { return { ym: k, v: 0 }; }), presu = meses.map(function (k) { return { ym: k, v: 0 }; });
      cia.forEach(function (r) { var k = r.anio + '-' + String(r.mes).padStart(2, '0'); if (idx[k] != null) { real[idx[k]].v = n(r.real_monto); presu[idx[k]].v = n(r.presu_monto); } });
      var anio = cia.filter(function (r) { return r.anio === uAnio && r.mes <= uMes; });
      var realAc = anio.reduce(function (t, r) { return t + n(r.real_monto); }, 0), presuAc = anio.reduce(function (t, r) { return t + n(r.presu_monto); }, 0);
      var prevAc = cia.filter(function (r) { return r.anio === uAnio - 1 && r.mes <= uMes; }).reduce(function (t, r) { return t + n(r.real_monto); }, 0);
      var cumpl = presuAc ? realAc / presuAc : null, crec = prevAc ? realAc / prevAc - 1 : null;
      var ultR = real[real.length - 1].v, ultP = presu[presu.length - 1].v;
      var unidades = {};
      rs[0].filter(function (r) { return r.unidad !== 'Compañía' && r.anio === uAnio && r.mes <= uMes; }).forEach(function (r) {
        var e = unidades[r.unidad] = unidades[r.unidad] || { real: 0, presu: 0 }; e.real += n(r.real_monto); e.presu += n(r.presu_monto);
      });
      var porUnidad = Object.keys(unidades).map(function (k) { return { label: k, v: unidades[k].real, presu: unidades[k].presu }; }).sort(function (a, b) { return b.v - a.v; });
      var ab = rs[1].filter(function (r) { return String(r.periodo || '') >= G.sumarDias(G.todayStr(), -95).slice(0, 7); });
      var altas = ab.reduce(function (t, r) { return t + n(r.altas); }, 0), bajas = ab.reduce(function (t, r) { return t + n(r.bajas); }, 0);
      var flojas = porUnidad.filter(function (u) { return u.presu > 0 && u.v / u.presu < 0.9; });
      var L = [].concat(
        cumpl != null ? [{ tono: cumpl >= 1 ? 'bien' : (cumpl >= 0.95 ? 'info' : 'mal'), peso: Math.abs(1 - cumpl) * 3 + 0.5,
          texto: 'En ' + uAnio + ' (enero a ' + MES_LARGO[uMes - 1] + ') se facturó <b>' + fmtPlata(realAc) + '</b>: el <b>' + fmtPct(cumpl, 1) + '</b> del presupuesto.' }] : [],
        crec != null ? [{ tono: crec >= 0 ? 'bien' : 'mal', peso: Math.abs(crec) * 2 + 0.3, texto: 'Contra el mismo período de ' + (uAnio - 1) + ', la facturación ' + (crec >= 0 ? 'creció' : 'cayó') + ' un <b>' + fmtPct(Math.abs(crec), 1) + '</b>. (Ojo: es en pesos, sin descontar inflación.)' }] : [],
        ultP ? [{ tono: ultR >= ultP ? 'bien' : 'mal', peso: Math.abs(ultR / ultP - 1) * 2, texto: 'En ' + MES_LARGO[uMes - 1] + ' se llegó al <b>' + fmtPct(ultR / ultP) + '</b> del objetivo del mes.' }] : [],
        leerSerie({ nombre: 'La facturación', serie: real, subirEsBueno: true, fmt: fmtPlata, mesEnCurso: false }).filter(function (x) { return !/promedio/.test(x.texto) || x.tono !== 'info'; }),
        flojas.slice(0, 2).map(function (u) { return { tono: 'mal', peso: (1 - u.v / u.presu) * 2, texto: '<b>' + esc(u.label) + '</b> va al ' + fmtPct(u.v / u.presu) + ' de su presupuesto del año.' }; }),
        ab.length ? [{ tono: altas - bajas >= 0 ? 'bien' : 'mal', peso: 0.5, texto: 'Clientes en los últimos 3 meses: <b>' + altas + ' altas y ' + bajas + ' bajas</b> (neto ' + (altas - bajas >= 0 ? '+' : '') + (altas - bajas) + ').' }] : []
      );
      return { serieReal: real, seriePresu: presu, porUnidad: porUnidad, cumpl: cumpl, crec: crec, realAc: realAc, presuAc: presuAc, ultimoYm: hastaYm, altas: altas, bajas: bajas, hayAB: !!ab.length, lecturas: L };
    });
  }

  // ---------- RR.HH. ----------
  function datosRrhh() {
    var desde = new Date(); desde.setMonth(desde.getMonth() - 13); desde.setDate(1);
    var sb = G.sb();
    return Promise.all([
      todasLasFilas('fichajes', function (q) { return q.select('id,legajo,tipo,estado,minutos_tarde,autorizado,timestamp').gte('timestamp', desde.toISOString()).order('timestamp').order('id'); }),
      Promise.resolve(sb.from('empleados').select('legajo,sector,activo')).then(function (r) { if (r.error) throw r.error; return r.data || []; }),
    ]).then(function (rs) {
      var emp = rs[1], act = {}; emp.forEach(function (e) { if (e.activo !== false) act[String(e.legajo)] = e; });
      var fs = rs[0].filter(function (f) { return act[String(f.legajo)]; });
      var ent = fs.filter(function (f) { return String(f.tipo).toLowerCase() === 'entrada'; });
      var tarde = ent.filter(function (f) { return f.estado === 'tarde' && !f.autorizado; });
      var fecha = function (f) { var d = new Date(f.timestamp); return ym(d) + '-01'; };
      var sEnt = serie(ent, fecha, null, 13), sTar = serie(tarde, fecha, null, 13), sMin = serie(tarde, fecha, function (f) { return f.minutos_tarde; }, 13);
      var sPct = sEnt.map(function (x, i) { return { ym: x.ym, v: x.v ? sTar[i].v / x.v * 100 : 0 }; });
      var hace30 = Date.now() - 30 * 86400000;
      var t30 = tarde.filter(function (f) { return new Date(f.timestamp).getTime() >= hace30; });
      var porSector = agrupar(t30, function (f) { return (act[String(f.legajo)] || {}).sector || 'Sin sector'; });
      var e30 = ent.filter(function (f) { return new Date(f.timestamp).getTime() >= hace30; });
      var entSector = {}; e30.forEach(function (f) { var s = (act[String(f.legajo)] || {}).sector || 'Sin sector'; entSector[s] = (entSector[s] || 0) + 1; });
      var sectorPct = Object.keys(entSector).map(function (s) { var t = (porSector.find(function (x) { return x.label === s; }) || { v: 0 }).v; return { label: s, v: t, total: entSector[s], pct: t / entSector[s] }; }).sort(function (a, b) { return b.pct - a.pct; });
      // salidas sin fichar en los últimos 7 días
      var porLeg = {}; fs.forEach(function (f) { (porLeg[f.legajo] = porLeg[f.legajo] || []).push(f); });
      var sinSalida = 0, lim = Date.now() - 16 * 3600000, corte = Date.now() - 7 * 86400000;
      Object.keys(porLeg).forEach(function (k) {
        var l = porLeg[k];
        l.forEach(function (f, i) {
          if (String(f.tipo).toLowerCase() !== 'entrada') return;
          var t = new Date(f.timestamp).getTime(); if (t < corte || t > lim) return;
          var sig = l[i + 1]; if (!(sig && String(sig.tipo).toLowerCase() === 'salida' && new Date(sig.timestamp).getTime() - t <= 16 * 3600000)) sinSalida++;
        });
      });
      var fmtP = function (v) { return v.toFixed(1).replace('.', ',') + '%'; };
      var L = [].concat(
        leerSerie({ nombre: 'Las llegadas tarde (% de las entradas)', serie: sPct, subirEsBueno: false, fmt: fmtP }).filter(function (x) { return !/cerraría/.test(x.texto); }),
        leerSerie({ nombre: 'Las entradas fichadas', serie: sEnt, subirEsBueno: null }).slice(0, 1),
        sectorPct.length && sectorPct[0].pct >= 0.15 && sectorPct[0].total >= 10 ? [{ tono: 'mal', peso: sectorPct[0].pct * 2, texto: 'En los últimos 30 días, <b>' + esc(sectorPct[0].label) + '</b> llegó tarde en el <b>' + fmtPct(sectorPct[0].pct) + '</b> de sus entradas.' }] : [],
        sinSalida ? [{ tono: 'mal', peso: 0.6, texto: '<b>' + sinSalida + ' turnos</b> de la última semana quedaron sin fichar la salida.' }] : [{ tono: 'bien', peso: 0.2, texto: 'La última semana no quedaron turnos sin fichar la salida.' }]
      );
      var iAct = sPct.length - 2;
      return { serieEnt: sEnt, serieTarde: sTar, seriePct: sPct, serieMin: sMin, porSector: sectorPct, activos: Object.keys(act).length, sinSalida: sinSalida, lecturas: L,
        kpi: { pctMes: sPct[iAct].v, mes: sPct[iAct].ym, tardes: sTar[iAct].v, minutos: sMin[iAct].v } };
    });
  }

  // =====================================================================
  // Dibujo (mismo lenguaje visual que el Tablero Comercial)
  // =====================================================================
  function kpiCard(o) {
    return '<div class="cq-card cq-kpi' + (o.ir ? ' tb-ir' : '') + '" style="--c:' + o.c + '"' + (o.ir ? ' data-ir="' + o.ir + '" title="Ver el tablero de ' + esc(o.irLabel || '') + '"' : '') + '><div class="top"><div class="ico">' + o.ico + '</div><div class="lab">' + o.lab + '</div></div>' +
      '<div class="val"' + (o.vc ? ' style="color:' + o.vc + '"' : '') + '>' + o.val + '</div>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + '</div>';
  }
  function variacion(act, base, subirEsBueno) {
    if (!base) return { txt: 'sin historia para comparar', c: GRIS };
    var d = act / base - 1, bien = subirEsBueno == null ? null : ((d >= 0) === subirEsBueno);
    return { txt: (d >= 0 ? '▲ ' : '▼ ') + fmtPct(Math.abs(d)) + ' vs promedio 6 meses', c: bien == null ? AZUL : (bien ? OK : MAL) };
  }
  // Barras verticales por mes; opcional: objetivo (línea punteada) y mes en curso marcado.
  function barrasMes(s, opts) {
    opts = opts || {};
    var fmt = opts.fmt || fmtN, H = 190, obj = opts.objetivo;
    // Los meses vacíos del principio (antes de que hubiera datos) no se dibujan; quedan al menos 6.
    var desde = 0;
    while (desde < s.length - 6 && !s[desde].v && !(obj && obj[desde].v)) desde++;
    if (desde) { s = s.slice(desde); if (obj) obj = obj.slice(desde); opts = Object.assign({}, opts, { offset: desde }); }
    var max = Math.max.apply(null, s.map(function (x, i) { return Math.max(x.v, obj ? obj[i].v : 0); }).concat([1])) * 1.22;
    var h = '<div class="cq-vchart" style="min-width:' + (s.length * 38) + 'px">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) { h += '<div class="cq-vgrid" style="bottom:' + (f * H + 30) + 'px"></div>'; });
    h += '<div class="cq-vcols">';
    s.forEach(function (x, i) {
      var enCurso = opts.mesEnCurso !== false && i === s.length - 1;
      var bh = x.v / max * H, oh = obj ? obj[i].v / max * H : 0;
      var col = opts.colorFn ? opts.colorFn(x, i + (opts.offset || 0)) : (opts.color || AZUL);
      h += '<div class="cq-vcol" data-i="' + (i + (opts.offset || 0)) + '" title="' + esc(ymLargo(x.ym) + ': ' + fmt(x.v) + (obj && obj[i].v ? '\nObjetivo: ' + fmt(obj[i].v) : '') + (enCurso ? '\n(mes en curso)' : '')) + '"><div class="cq-vplot" style="height:' + H + 'px">' +
        (x.v && opts.etiquetas !== false ? '<div class="cq-vlab" style="bottom:' + (Math.max(bh, oh) + 5) + 'px">' + (opts.etiq ? opts.etiq(x, i + (opts.offset || 0)) : fmt(x.v)) + '</div>' : '') +
        (oh ? '<div class="tb-vobj" style="bottom:' + oh + 'px"></div>' : '') +
        '<div class="tb-vbar" style="height:' + Math.max(bh, x.v ? 3 : 0) + 'px;background:' + col + (enCurso ? ';opacity:.45' : '') + '"></div></div>' +
        '<div class="cq-vx">' + ymLabel(x.ym).replace(' ', '<br>') + '</div></div>';
    });
    return h + '</div></div>';
  }
  function ranking(filas, color, opts) {
    opts = opts || {};
    if (!filas.length) return '<div class="cq-empty">Sin datos.</div>';
    var max = Math.max.apply(null, filas.map(function (x) { return Math.max(x.v, x.ref || 0); })) || 1;
    return filas.slice(0, opts.max || 8).map(function (x) {
      return '<div class="cq-hrow"><div class="hl" title="' + esc(x.label) + '">' + esc(x.label) + '</div><div class="cq-htrack">' +
        (x.ref != null ? '<div class="b" style="width:' + (x.ref / max * 100) + '%;background:#cfd6dd"></div>' : '') +
        '<div class="b" style="width:' + Math.max(x.v / max * 100, x.v ? 1.5 : 0) + '%;background:' + (x.color || color) + '"></div></div>' +
        '<div class="hv" style="color:' + (x.color || color) + '">' + (opts.fmt ? opts.fmt(x) : fmtN(x.v)) + '</div>' + (x.sub ? '<div class="cq-hsub">' + esc(x.sub) + '</div>' : '') + '</div>';
    }).join('');
  }
  function panel(titulo, sub, acento, cuerpo, extra) {
    return '<section class="cq-card cq-panel' + (extra && extra.full ? ' cq-full' : '') + '"><div class="cq-ph"><div><h2 style="--a:' + acento + '">' + titulo + '</h2>' + (sub ? '<p>' + sub + '</p>' : '') + '</div>' + (extra && extra.legend ? '<div class="cq-legend">' + extra.legend + '</div>' : '') + '</div>' +
      (extra && extra.scroll ? '<div class="cq-scrollx">' + cuerpo + '</div>' : cuerpo) + '</section>';
  }
  function hero(titulo, sub) {
    return '<header class="cq-hero tb-hero"><div class="cq-hero-top"><div class="cq-hero-title"><h1>' + titulo + '</h1><p>' + sub + '</p></div>' +
      '<button type="button" class="cq-chip" data-acc="recargar" title="Volver a leer los datos">↻ Actualizar</button></div></header>';
  }

  // ---------- Sifoncito en cada tablero ----------
  function textoPlano(html) { var d = document.createElement('div'); d.innerHTML = html; return d.textContent || ''; }
  function sifPanel(modulo, lecturas, opts) {
    opts = opts || {};
    var L = ordenarLecturas(lecturas), est = estadoGeneral(L);
    var icono = { bien: '✅', mal: '⚠️', info: 'ℹ️' };
    var traje = (MODULOS.find(function (m) { return m.id === modulo; }) || {}).traje || 'inicio';
    var avatar = window.AyudaAnafer && window.AyudaAnafer.sifon ? window.AyudaAnafer.sifon(traje, 92) : '';
    var lista = L.slice(0, opts.max || 7);
    S.leer = S.leer || {};
    S.leer[modulo] = est.txt + '. ' + lista.map(function (x) { return textoPlano(x.texto); }).join(' ');
    var op = S.opiniones[modulo];
    return '<section class="cq-card tb-sif tb-sif-' + est.tono + '" data-modulo="' + modulo + '">' +
      '<div class="tb-sif-av">' + avatar + '</div>' +
      '<div class="tb-sif-cuerpo">' +
        '<div class="tb-sif-head"><div><div class="tb-sif-tit">La lectura de Sifoncito</div><div class="tb-sif-estado">' + esc(est.txt) + '</div></div>' +
          '<div class="tb-sif-btns"><button type="button" class="tb-btn" data-acc="escuchar" data-modulo="' + modulo + '">🔊 Escuchar</button>' +
          '<button type="button" class="tb-btn tb-btn-ia" data-acc="ia" data-modulo="' + modulo + '">✨ Pedile una opinión con IA</button></div></div>' +
        (lista.length ? '<ul class="tb-lect">' + lista.map(function (x) { return '<li class="' + x.tono + '"><span>' + icono[x.tono] + '</span><div>' + x.texto + '</div></li>'; }).join('') + '</ul>'
          : '<div class="cq-empty">Todavía no hay datos suficientes para leer.</div>') +
        '<div class="tb-ia" id="tb-ia-' + modulo + '">' + (op ? opinionHtml(op) : '') + '</div>' +
        '<div class="tb-sif-nota">Comparo cada indicador con toda la historia cargada: el promedio de los 6 meses anteriores, el mismo mes del año pasado, las tendencias y los récords.' + (opts.nota ? ' ' + opts.nota : '') + '</div>' +
      '</div></section>';
  }
  function mdHtml(t) {
    var lines = String(t || '').split('\n'), out = '', enLista = false;
    lines.forEach(function (l) {
      var x = esc(l.trim()).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
      if (/^[-•*]\s+/.test(l.trim())) { if (!enLista) { out += '<ul>'; enLista = true; } out += '<li>' + x.replace(/^[-•*]\s+/, '') + '</li>'; return; }
      if (enLista) { out += '</ul>'; enLista = false; }
      if (!x) return;
      if (/^#{1,4}\s/.test(l.trim())) out += '<h4>' + x.replace(/^#{1,4}\s+/, '') + '</h4>';
      else if (/^<b>.*<\/b>:?$/.test(x)) out += '<h4>' + x.replace(/<\/?b>/g, '') + '</h4>';
      else out += '<p>' + x + '</p>';
    });
    if (enLista) out += '</ul>';
    return out;
  }
  function opinionHtml(op) {
    var f = new Date(op.creado);
    return '<div class="tb-ia-box"><div class="tb-ia-tit">✨ Opinión de Sifoncito con IA <span>' + (isNaN(f) ? '' : f.toLocaleDateString('es-AR') + ' ' + f.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })) + (op.usuario ? ' · pedida por ' + esc(op.usuario) : '') + '</span></div>' + mdHtml(op.texto) + '</div>';
  }
  function leerUltimaOpinion(modulo) {
    if (!G.sb() || S.opiniones[modulo] !== undefined) return Promise.resolve();
    return Promise.resolve(G.sb().from('tableros_opiniones').select('*').eq('modulo', modulo).order('creado', { ascending: false }).limit(1)).then(function (r) {
      var fila = !r.error && r.data && r.data.filter(function (x) { return x.modulo === modulo; }).sort(function (a, b) { return String(b.creado).localeCompare(String(a.creado)); })[0];
      S.opiniones[modulo] = fila || null;
      var box = $('tb-ia-' + modulo);
      if (box && fila) box.innerHTML = opinionHtml(fila);
    }, function () { S.opiniones[modulo] = null; });
  }
  // Lo que se le manda a la IA: solo números agregados y las lecturas.
  function resumenParaIA(modulo) {
    var ids = modulo === 'resumen' ? modulosVisibles().map(function (m) { return m.id; }) : [modulo];
    var out = { fecha: G.todayStr(), nota: 'El último mes de cada serie es el mes en curso (incompleto), salvo en comercial.' };
    ids.forEach(function (id) {
      var d = S.cache[id];
      if (!d || d.error) return;
      var s = function (sr) { return (sr || []).map(function (x) { return x.ym + ': ' + Math.round(x.v * 100) / 100; }); };
      var r = function (rk) { return (rk || []).slice(0, 6).map(function (x) { return x.label + ': ' + Math.round(x.v) + (x.ref != null ? ' (ref ' + Math.round(x.ref) + ')' : ''); }); };
      var lect = (d.lecturas || []).map(function (x) { return '[' + x.tono + '] ' + textoPlano(x.texto); });
      if (id === 'logistica') out.logistica = { viajes_por_mes: s(d.serieViajes), envios_sucursales_por_mes: s(d.serieEnvios), camiones_90_dias: r(d.porCamion), rutas_90_dias: r(d.porRuta), camiones_sin_viajes_30_dias: d.quietos.length, viajes_planificados_a_futuro: d.futuros, lecturas: lect };
      if (id === 'administracion') out.administracion = { gasto_por_mes: s(d.serieGasto), pagado_por_mes: s(d.seriePagado), gasto_por_area_90_dias: d.porArea.slice(0, 6).map(function (x) { return x.label + ': ' + Math.round(x.v) + ' (90 días anteriores: ' + Math.round(x.antes) + ')'; }),
        proveedores_90_dias: r(d.porProv), facturas_pendientes: d.pendientes, monto_pendiente: Math.round(d.pendTot), pendientes_mas_de_60_dias: d.viejas, saldo_hoy: Math.round(d.saldoHoy), saldo_proyectado: Math.round(d.saldoProy), lecturas: lect };
      if (id === 'calidad') out.calidad = { reclamos_por_mes: s(d.serieRec), justificados_por_mes: s(d.serieJust), envase_justificados_90_dias: r(d.porEnvase), desvio_90_dias: r(d.porDesvio), nc_abiertas: d.abiertas, nc_vencidas: d.vencidas, lecturas: lect };
      if (id === 'comercial') out.comercial = { facturacion_real_por_mes: s(d.serieReal), presupuesto_por_mes: s(d.seriePresu), cumplimiento_acumulado_anio: d.cumpl, crecimiento_vs_anio_anterior: d.crec, unidades_negocio_anio: (d.porUnidad || []).map(function (u) { return u.label + ': real ' + Math.round(u.v) + ' / presupuesto ' + Math.round(u.presu); }), altas_3_meses: d.altas, bajas_3_meses: d.bajas, lecturas: lect };
      if (id === 'rrhh') out.rrhh = { empleados_activos: d.activos, entradas_por_mes: s(d.serieEnt), llegadas_tarde_por_mes: s(d.serieTarde), porcentaje_tarde_por_mes: s(d.seriePct), sectores_30_dias: (d.porSector || []).slice(0, 6).map(function (x) { return x.label + ': ' + x.v + ' tardes de ' + x.total + ' entradas'; }), turnos_sin_salida_7_dias: d.sinSalida, lecturas: lect };
    });
    return out;
  }
  function pedirIA(modulo, btn) {
    var sb = G.sb();
    if (!sb || !sb.functions) { G.showToast('La IA necesita conexión con la base.'); return; }
    var box = $('tb-ia-' + modulo);
    btn.disabled = true; var txt = btn.textContent; btn.textContent = '✨ Pensando…';
    if (box) box.innerHTML = '<div class="tb-ia-box tb-ia-pensando">Sifoncito está leyendo toda la historia y armando su opinión…</div>';
    var datos = resumenParaIA(modulo);
    Promise.resolve(sb.functions.invoke('sifoncito-opina', { body: { modulo: modulo, datos: datos } })).then(function (res) {
      if (res.error) {
        var p = Promise.resolve('');
        try { if (res.error.context && res.error.context.json) p = res.error.context.json().then(function (j) { return (j && j.error) || ''; }, function () { return ''; }); } catch (e) { /* sigue */ }
        return p.then(function (msg) {
          var st = res.error.context && res.error.context.status;
          var aviso = st === 404 || /not found|failed to send/i.test(res.error.message || '') ? 'La opinión con IA todavía no está instalada en Supabase (falta la función sifoncito-opina).' : 'No se pudo pedir la opinión: ' + (msg || res.error.message || 'error');
          if (box) box.innerHTML = S.opiniones[modulo] ? opinionHtml(S.opiniones[modulo]) : '';
          G.showToast(aviso, 8000);
        });
      }
      var op = { id: 'op_' + Date.now().toString(36), creado: new Date().toISOString(), usuario: G.usuario(), modulo: modulo, texto: (res.data && res.data.texto) || '', datos: datos };
      S.opiniones[modulo] = op;
      if (box) box.innerHTML = opinionHtml(op);
      Promise.resolve(sb.from('tableros_opiniones').insert(op)).then(function () {}, function () {});
    }).catch(function () { if (box) box.innerHTML = ''; G.showToast('No se pudo pedir la opinión con IA.'); })
      .then(function () { btn.disabled = false; btn.textContent = txt; });
  }

  // =====================================================================
  // Pantallas
  // =====================================================================
  function errorBox(m, d) { return hero('Tablero de ' + m.label, '') + '<div class="cq-card cq-panel"><div class="cq-empty">No se pudieron leer los datos de ' + esc(m.label) + ': ' + esc(d.error) + '</div></div>'; }
  var RENDER = {
    logistica: function (d) {
      var k = d.kpi, v = variacion(k.viajesMes, k.prom6, null);
      return hero('Tablero de Logística', 'Viajes de FlotaPesada y envíos · toda la historia cargada') +
        '<div class="cq-kpis">' +
          kpiCard({ c: NAVY, ico: '🚛', lab: 'Viajes de ' + ymLargo(k.mes), val: fmtN(k.viajesMes), sub: '<span style="color:' + v.c + '">' + v.txt + '</span>' }) +
          kpiCard({ c: CELESTE, ico: '📅', lab: 'Viajes en el mes en curso', val: fmtN(k.enCurso), sub: 'hasta hoy' }) +
          kpiCard({ c: VIOLETA, ico: '🏪', lab: 'Envíos a sucursales (' + ymLabel(k.mes) + ')', val: fmtN(k.envios) }) +
          kpiCard({ c: d.quietos.length ? MAL : OK, ico: d.quietos.length ? '⏸️' : '✅', lab: 'Camiones sin viajes (30 días)', val: d.quietos.length, vc: d.quietos.length ? MAL : OK, sub: 'de ' + k.camiones + ' activos' }) +
        '</div>' + sifPanel('logistica', d.lecturas) +
        panel('Viajes por mes', 'Últimos 24 meses · el mes en curso, más claro', NAVY, barrasMes(d.serieViajes, { color: NAVY }), { scroll: true, full: true }) +
        '<div class="cq-grid cq-g11">' + panel('Viajes por camión', 'Últimos 90 días', AZUL, ranking(d.porCamion, AZUL)) + panel('Viajes por ruta', 'Últimos 90 días', CELESTE, ranking(d.porRuta, CELESTE)) + '</div>' +
        '<div class="cq-grid cq-g11">' + panel('Envíos a sucursales por mes', 'Últimos 24 meses', VIOLETA, barrasMes(d.serieEnvios, { color: VIOLETA }), { scroll: true }) + panel('Viajes por chofer', 'Últimos 90 días', AMBAR, ranking(d.porChofer, AMBAR)) + '</div>';
    },
    administracion: function (d) {
      var k = d.kpi, v = variacion(k.gastoMes, k.prom6, false);
      return hero('Tablero de Administración', 'Gastos, pagos y caja · toda la historia cargada') +
        '<div class="cq-kpis">' +
          kpiCard({ c: NAVY, ico: '🧾', lab: 'Gasto de ' + ymLargo(k.mes), val: fmtPlata(k.gastoMes), sub: '<span style="color:' + v.c + '">' + v.txt + '</span>' }) +
          kpiCard({ c: AMBAR, ico: '⏳', lab: 'Facturas pendientes', val: fmtPlata(d.pendTot), sub: d.pendientes + ' facturas' + (d.viejas ? ' · <span style="color:' + MAL + '">' + d.viejas + ' de más de 60 días</span>' : '') }) +
          kpiCard({ c: CELESTE, ico: '🏦', lab: 'Saldo de cajas y bancos', val: d.hayCuentas ? fmtPlata(d.saldoHoy) : '—', sub: d.hayCuentas ? 'proyectado: ' + fmtPlata(d.saldoProy) : 'sin cuentas cargadas' }) +
          kpiCard({ c: VIOLETA, ico: '🏷️', lab: 'Área con más gasto (90 días)', val: d.porArea[0] ? esc(d.porArea[0].label) : '—', sub: d.porArea[0] ? fmtPlata(d.porArea[0].v) : '' }) +
        '</div>' + sifPanel('administracion', d.lecturas) +
        panel('Gasto por mes', 'Facturas de proveedores por fecha de factura · últimos 24 meses', NAVY, barrasMes(d.serieGasto, { color: NAVY, fmt: fmtPlata }), { scroll: true, full: true }) +
        '<div class="cq-grid cq-g11">' +
          panel('Gasto por área', 'Últimos 90 días · en gris, los 90 días anteriores', VIOLETA, ranking(d.porArea.map(function (x) { return { label: x.label, v: x.v, ref: x.antes, color: x.antes && x.v / x.antes > 1.3 ? MAL : VIOLETA }; }), VIOLETA, { fmt: function (x) { return fmtPlata(x.v); } }), { legend: '<span><i style="background:#cfd6dd"></i>90 días anteriores</span><span><i style="background:' + VIOLETA + '"></i>Últimos 90</span>' }) +
          panel('Principales proveedores', 'Últimos 90 días', AZUL, ranking(d.porProv, AZUL, { fmt: function (x) { return fmtPlata(x.v); } })) +
        '</div>' +
        panel('Pagado por mes', 'Órdenes de pago pagadas · últimos 24 meses', OK, barrasMes(d.seriePagado, { color: OK, fmt: fmtPlata }), { scroll: true, full: true });
    },
    calidad: function (d) {
      var k = d.kpi, v = variacion(k.recMes, k.prom6, false);
      return hero('Tablero de Calidad', 'Reclamos de producto y NC / PAC · toda la historia cargada') +
        '<div class="cq-kpis">' +
          kpiCard({ c: NAVY, ico: '📦', lab: 'Reclamos de ' + ymLargo(k.mes), val: fmtN(k.recMes), sub: '<span style="color:' + v.c + '">' + v.txt + '</span>' }) +
          kpiCard({ c: MAL, ico: '🔎', lab: 'Justificados (90 días)', val: d.pj != null ? fmtPct(d.pj) : '—', vc: d.pj != null ? MAL : GRIS, sub: 'de los reclamos ya controlados' }) +
          kpiCard({ c: AMBAR, ico: '📋', lab: 'NC / PAC abiertas', val: d.abiertas, sub: 'sin cerrar' }) +
          kpiCard({ c: d.vencidas ? MAL : OK, ico: d.vencidas ? '⚠️' : '✅', lab: 'Con acción vencida', val: d.vencidas, vc: d.vencidas ? MAL : OK }) +
        '</div>' + sifPanel('calidad', d.lecturas) +
        panel('Reclamos por mes', 'En rojo, la parte que resultó justificada · últimos 24 meses', NAVY, barrasMes(d.serieRec, { color: '#cfd6dd',
          etiq: function (x, i) { return x.v + (d.serieJust[i].v ? '<span style="color:' + MAL + '"> · ' + d.serieJust[i].v + '</span>' : ''); } }), { scroll: true, full: true, legend: '<span><i style="background:#cfd6dd"></i>Reclamos</span><span><i style="background:' + MAL + '"></i>Justificados</span>' }) +
        '<div class="cq-grid cq-g11">' + panel('Justificados por proveedor de envase', 'Últimos 90 días', VIOLETA, ranking(d.porEnvase, VIOLETA)) + panel('Desvío confirmado', 'Últimos 90 días', MAL, ranking(d.porDesvio, MAL)) + '</div>';
    },
    comercial: function (d) {
      return hero('Tablero Comercial', 'Facturación contra presupuesto · real cargado hasta ' + ymLargo(d.ultimoYm)) +
        '<div class="cq-kpis">' +
          kpiCard({ c: AZUL, ico: '💰', lab: 'Facturación ' + d.ultimoYm.slice(0, 4) + ' (acum.)', val: fmtPlata(d.realAc), sub: 'presupuesto: ' + fmtPlata(d.presuAc) }) +
          kpiCard({ c: d.cumpl >= 1 ? OK : MAL, ico: d.cumpl >= 1 ? '✅' : '🎯', lab: 'Cumplimiento', val: d.cumpl != null ? fmtPct(d.cumpl, 1) : '—', vc: d.cumpl == null ? GRIS : (d.cumpl >= 1 ? OK : MAL) }) +
          kpiCard({ c: CELESTE, ico: '📈', lab: 'Crecimiento vs ' + (Number(d.ultimoYm.slice(0, 4)) - 1), val: d.crec != null ? (d.crec >= 0 ? '+' : '−') + fmtPct(Math.abs(d.crec), 1) : '—', vc: d.crec == null ? GRIS : (d.crec >= 0 ? OK : MAL), sub: 'en pesos, sin inflación' }) +
          kpiCard({ c: OK, ico: '👥', lab: 'Altas / bajas (3 meses)', val: d.hayAB ? '<span style="color:' + OK + '">' + d.altas + '</span> <span style="color:#cfd6dd">/</span> <span style="color:' + MAL + '">' + d.bajas + '</span>' : '—', sub: d.hayAB ? 'neto ' + (d.altas - d.bajas >= 0 ? '+' : '') + (d.altas - d.bajas) : 'sin datos' }) +
        '</div>' + sifPanel('comercial', d.lecturas, { nota: 'La facturación está en pesos: para comparar años conviene tener en cuenta la inflación.' }) +
        panel('Facturación por mes', 'Real contra objetivo (línea punteada) · últimos 24 meses', AZUL, barrasMes(d.serieReal, { fmt: fmtPlata, objetivo: d.seriePresu, mesEnCurso: false, etiquetas: false,
          colorFn: function (x, i) { var p = d.seriePresu[i].v; return !p ? AZUL : (x.v >= p ? OK : MAL); } }), { scroll: true, full: true, legend: '<span><i style="background:' + OK + '"></i>Cumple</span><span><i style="background:' + MAL + '"></i>No cumple</span><span><i style="background:' + AZUL + '"></i>Sin objetivo</span>' }) +
        panel('Unidades de negocio en el año', 'Real acumulado contra presupuesto (gris)', CELESTE, ranking(d.porUnidad.map(function (u) { return { label: u.label, v: u.v, ref: u.presu, color: !u.presu ? AZUL : (u.v >= u.presu ? OK : MAL), sub: u.presu ? fmtPct(u.v / u.presu) + ' del presupuesto' : '' }; }), AZUL, { fmt: function (x) { return fmtPlata(x.v); }, max: 10 }), { full: true }) +
        '<div class="tb-link"><a class="cq-chip tb-chip-claro" href="comercial-dashboard.html">Abrir el tablero comercial completo →</a></div>';
    },
    rrhh: function (d) {
      var k = d.kpi, v = variacion(k.pctMes, promedio(d.seriePct.slice(-8, -2).map(function (x) { return x.v; })), false);
      var fmtP = function (x) { return x.toFixed(1).replace('.', ',') + '%'; };
      return hero('Tablero de RR.HH.', 'Asistencia y puntualidad · últimos 13 meses') +
        '<div class="cq-kpis">' +
          kpiCard({ c: NAVY, ico: '👥', lab: 'Empleados activos', val: d.activos }) +
          kpiCard({ c: AMBAR, ico: '⏰', lab: 'Llegadas tarde en ' + ymLargo(k.mes), val: fmtP(k.pctMes), sub: '<span style="color:' + v.c + '">' + v.txt + '</span>' }) +
          kpiCard({ c: MAL, ico: '⌛', lab: 'Minutos de tardanza (' + ymLabel(k.mes) + ')', val: fmtN(k.minutos), sub: k.tardes + ' llegadas tarde sin autorizar' }) +
          kpiCard({ c: d.sinSalida ? MAL : OK, ico: d.sinSalida ? '🚪' : '✅', lab: 'Turnos sin salida (7 días)', val: d.sinSalida, vc: d.sinSalida ? MAL : OK }) +
        '</div>' + sifPanel('rrhh', d.lecturas) +
        panel('Llegadas tarde por mes', '% de las entradas · el mes en curso, más claro', AMBAR, barrasMes(d.seriePct, { color: AMBAR, fmt: fmtP }), { scroll: true, full: true }) +
        '<div class="cq-grid cq-g11">' + panel('Entradas fichadas por mes', 'Últimos 13 meses', NAVY, barrasMes(d.serieEnt, { color: NAVY }), { scroll: true }) +
          panel('Puntualidad por sector', 'Últimos 30 días · llegadas tarde sobre el total de entradas', MAL, ranking(d.porSector.map(function (x) { return { label: x.label, v: x.v, ref: x.total, sub: fmtPct(x.pct) + ' de ' + x.total + ' entradas' }; }), MAL)) + '</div>' +
        '<div class="tb-link"><a class="cq-chip tb-chip-claro" href="fichaje/admin.html">Abrir el panel de RR.HH. →</a></div>';
    },
  };
  function renderResumen() {
    var mods = modulosVisibles();
    var cont = $('tb-contenido');
    cont.innerHTML = hero('Tablero general', 'Todos los módulos juntos · ' + mods.map(function (m) { return m.label; }).join(' · ')) + '<div class="cq-empty">Leyendo los datos de todos los módulos…</div>';
    return Promise.all(mods.map(function (m) { return cargar(m.id); })).then(function () {
      if (S.actual !== 'resumen') return;
      var tarjetas = '', todas = [];
      mods.forEach(function (m) {
        var d = S.cache[m.id];
        if (!d || d.error) { tarjetas += kpiCard({ c: GRIS, ico: m.icono, lab: m.label, val: '—', sub: d && d.error ? esc(d.error) : 'sin datos', ir: m.id, irLabel: m.label }); return; }
        (d.lecturas || []).forEach(function (x) { todas.push({ tono: x.tono, peso: x.peso, texto: '<span class="tb-mod">' + m.icono + ' ' + m.label + '</span> ' + x.texto }); });
        var mal = (d.lecturas || []).filter(function (x) { return x.tono === 'mal'; }).length;
        var sem = mal >= 2 ? MAL : (mal ? AMBAR : OK);
        var val, sub;
        if (m.id === 'logistica') { val = fmtN(d.kpi.viajesMes) + ' viajes'; sub = ymLargo(d.kpi.mes) + ' · ' + variacion(d.kpi.viajesMes, d.kpi.prom6, null).txt; }
        if (m.id === 'administracion') { val = fmtPlata(d.kpi.gastoMes); sub = 'gasto de ' + ymLargo(d.kpi.mes) + ' · ' + variacion(d.kpi.gastoMes, d.kpi.prom6, false).txt; }
        if (m.id === 'calidad') { val = fmtN(d.kpi.recMes) + ' reclamos'; sub = ymLargo(d.kpi.mes) + ' · ' + d.vencidas + ' NC vencidas'; }
        if (m.id === 'comercial') { val = d.cumpl != null ? fmtPct(d.cumpl, 1) : '—'; sub = 'del presupuesto ' + d.ultimoYm.slice(0, 4) + ' · ' + fmtPlata(d.realAc); }
        if (m.id === 'rrhh') { val = d.kpi.pctMes.toFixed(1).replace('.', ',') + '% tarde'; sub = d.activos + ' empleados · ' + ymLargo(d.kpi.mes); }
        tarjetas += kpiCard({ c: sem, ico: m.icono, lab: m.label + (mal ? ' · ' + mal + ' alerta' + (mal > 1 ? 's' : '') : ' · sin alertas'), val: val, sub: sub, ir: m.id, irLabel: m.label });
      });
      // Para el resumen: lo más importante de cada módulo, no todo
      var top = [];
      mods.forEach(function (m) { top = top.concat(ordenarLecturas(todas.filter(function (x) { return x.texto.indexOf(m.label + '</span>') !== -1; })).slice(0, 2)); });
      cont.innerHTML = hero('Tablero general', 'Todos los módulos juntos · tocá una tarjeta para ver el tablero de ese módulo') +
        '<div class="cq-kpis tb-kpis-resumen">' + tarjetas + '</div>' +
        sifPanel('resumen', top, { max: 12, nota: 'Acá ves lo más importante de cada módulo; el detalle está en la pestaña de cada uno.' });
      leerUltimaOpinion('resumen');
    });
  }
  function renderModulo(id) {
    var m = MODULOS.find(function (x) { return x.id === id; });
    var cont = $('tb-contenido');
    cont.innerHTML = hero('Tablero de ' + m.label, 'Leyendo toda la historia…') + '<div class="cq-empty">Cargando…</div>';
    return cargar(id).then(function (d) {
      if (S.actual !== id) return;
      cont.innerHTML = d.error ? errorBox(m, d) : RENDER[id](d);
      if (id === 'calidad' && !d.error) superponerJustificados(d);
      leerUltimaOpinion(id);
    });
  }
  function superponerJustificados(d) {
    // En el gráfico de reclamos, cada barra gris lleva adentro la parte justificada en rojo.
    var cols = document.querySelectorAll('#tb-contenido .cq-full .cq-vcol');
    var max = Math.max.apply(null, d.serieRec.map(function (x) { return x.v; }).concat([1])) * 1.22;
    Array.prototype.forEach.call(cols, function (c) {
      var i = Number(c.dataset.i);
      var j = d.serieJust[i] ? d.serieJust[i].v : 0; if (!j) return;
      var plot = c.querySelector('.cq-vplot'), barra = c.querySelector('.tb-vbar');
      if (!plot || !barra) return;
      var r = document.createElement('div'); r.className = 'tb-vbar tb-vbar-sobre';
      r.style.height = (j / max * 190) + 'px'; r.style.background = MAL; if (i === d.serieRec.length - 1) r.style.opacity = '.45';
      plot.appendChild(r);
    });
  }

  // ---------------- Navegación ----------------
  function armarSubmenu() {
    var bar = $('subtabs-tableros');
    bar.innerHTML = MODULOS.filter(visible).map(function (m) {
      return '<button type="button" class="stabbtn' + (m.id === S.actual ? ' active' : '') + '" data-tb="' + m.id + '">' + m.icono + ' ' + m.label + '</button>';
    }).join('');
  }
  function ir(id) {
    if (!MODULOS.some(function (m) { return m.id === id && visible(m); })) id = 'resumen';
    S.actual = id;
    armarSubmenu();
    return id === 'resumen' ? renderResumen() : renderModulo(id);
  }
  $('subtabs-tableros').addEventListener('click', function (e) { var b = e.target.closest('[data-tb]'); if (b) ir(b.dataset.tb); });
  $('tb-contenido').addEventListener('click', function (e) {
    var t = e.target.closest('[data-ir]'); if (t) { ir(t.dataset.ir); return; }
    var b = e.target.closest('[data-acc]'); if (!b) return;
    if (b.dataset.acc === 'recargar') { S.cache = {}; S.opiniones = {}; ir(S.actual); }
    if (b.dataset.acc === 'escuchar') { var txt = (S.leer || {})[b.dataset.modulo]; if (txt && window.AyudaAnafer && window.AyudaAnafer.hablar) window.AyudaAnafer.hablar(txt); else G.showToast('Este navegador no puede hablar.'); }
    if (b.dataset.acc === 'ia') pedirIA(b.dataset.modulo, b);
  });

  function mostrar() { ir(S.actual); }
  window.Tableros = { mostrar: mostrar, ir: ir, _leerSerie: leerSerie, _serie: serie };
})();
