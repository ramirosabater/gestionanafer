/* =====================================================================
   Gestión Anafer — SEGUIMIENTO DE COMPRAS (Administración → Solicitudes)
   ---------------------------------------------------------------------
   Reemplaza la planilla RG-0708 "Seguimiento de solicitud de compras":
     1. El jefe de sector carga la solicitud (qué, cuánto, para cuándo).
     2. Compras la toma (Cotizando), elige proveedor por ítem y genera la
        orden de compra (una por proveedor) desde la misma solicitud.
     3. Compras registra la recepción de cada orden (total o parcial, con
        remito y si vino conforme).
     4. La factura se asocia a la orden de compra (Pagos, como siempre).
   El estado de la solicitud se calcula con todo eso (no se tipea), y la
   pestaña "Seguimiento" cruza pedido / recibido / facturado.
   Tablas: solicitudes_compra, recepciones (base-de-datos/seguimiento-compras.sql)
   y ordenes_compra.items / entrega_prevista. No se borra nada: se anula
   con motivo, igual que los comprobantes.
   ===================================================================== */
(function () {
  'use strict';
  var G = window.GestionAnafer;
  if (!G) return;

  var SECTORES = ['Calidad', 'Comercial', 'Depósito', 'Gerencia', 'Logística', 'Mantenimiento', 'Producción', 'RR.HH.'];
  var UNIDADES = ['Unidad', 'Caja', 'Paquete', 'Kg', 'Litro', 'Metro', 'Rollo', 'Par', 'Juego', 'Servicio'];
  var ESTADOS = {
    pendiente: 'Pendiente', cotizando: 'Cotizando', en_compra: 'En compra', comprada: 'Comprada',
    parcial: 'Recibida parcial', entregada: 'Entregada', rechazada: 'Rechazada', anulada: 'Anulada'
  };
  var ABIERTAS = ['pendiente', 'cotizando', 'en_compra', 'comprada', 'parcial'];

  var S = { sol: [], rec: [], cargado: false, cargando: null, ultima: 0, sinTablas: false, suscripto: false,
    editSol: null, editRec: null, recArchivos: [],
    f: { estado: 'abiertas', sector: '', mias: null, q: '' } };

  var esc = G.esc, hoy = G.todayStr;
  function $(id) { return document.getElementById(id); }
  function sb() { return G.sb(); }
  function toast(m, ms) { G.showToast(m, ms); }
  function vigente(x) { return !!x && !x.anulado_en; }
  function nuevoId(pref) { return pref + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function num(v) { var n = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.')); return isNaN(n) ? 0 : n; }
  function numIn(v) { var s = String(v == null ? '' : v).trim(); if (/,/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); var n = parseFloat(s); return isNaN(n) ? 0 : n; }
  function fmtCant(n) { return Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 3 }); }
  function fmtFecha(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
  function fmtFechaCorta(d) { if (!d) return '—'; var p = String(d).slice(0, 10).split('-'); return p[2] + '/' + p[1] + '/' + p[0].slice(2); }
  function solLabel(s) { return 'SC-' + String(s.numero || 0).padStart(4, '0'); }
  function recLabel(r) { return 'REC-' + String(r.numero || 0).padStart(4, '0'); }
  function puedeCargar() { return G.canEdit('solicitudes') || G.canEdit('compras'); }
  function esCompras() { return G.canEdit('compras'); }
  function usuario() { return String(G.usuario() || '').toLowerCase(); }
  function quienCorto(e) { return String(e || '').split('@')[0] || '—'; }

  // ---------------- Datos ----------------
  function ocs() { return G.datos().ordenesCompra || []; }
  function ocById(id) { return id ? ocs().find(function (o) { return o.id === id; }) || null : null; }
  function ocVigente(o) { return !!o && !G.esAnulado(o) && o.estado !== 'anulada'; }
  function facturasDeOC(ocId) {
    return (G.datos().facturas || []).filter(function (f) { return f.ocId === ocId && !G.esAnulado(f) && f.estado !== 'anulada'; });
  }
  function proveedores() { return G.datos().proveedores || []; }
  function provPorNombre(nombre) {
    var n = String(nombre || '').trim().toLowerCase();
    if (!n) return null;
    return proveedores().find(function (p) { return String(p.nombre || '').trim().toLowerCase() === n; })
      || proveedores().find(function (p) { return String(p.nombreFantasia || '').trim().toLowerCase() === n; }) || null;
  }

  function cargar(force) {
    if (!sb()) return Promise.resolve();
    if (S.cargando) return S.cargando;
    if (!force && S.cargado && Date.now() - S.ultima < 30000) return Promise.resolve();
    S.cargando = Promise.all([G.fetchAllRows('solicitudes_compra'), G.fetchAllRows('recepciones')]).then(function (rs) {
      S.cargando = null;
      if (rs[0].error || rs[1].error) { S.sinTablas = true; S.cargado = true; render(); return; }
      S.sinTablas = false;
      S.sol = (rs[0].data || []).map(normSol);
      S.rec = (rs[1].data || []).map(normRec);
      S.cargado = true; S.ultima = Date.now();
      suscribir();
      render();
    }, function () { S.cargando = null; });
    return S.cargando;
  }
  function normSol(r) { r.items = Array.isArray(r.items) ? r.items : []; return r; }
  function normRec(r) { r.items = Array.isArray(r.items) ? r.items : []; r.archivos = Array.isArray(r.archivos) ? r.archivos : []; return r; }
  function suscribir() {
    if (S.suscripto || !sb() || !sb().channel) return;
    S.suscripto = true;
    var t = null;
    function luego() { clearTimeout(t); t = setTimeout(function () { cargar(true); }, 800); }
    ['solicitudes_compra', 'recepciones'].forEach(function (tabla) {
      try { sb().channel(tabla + '-seg').on('postgres_changes', { event: '*', schema: 'public', table: tabla }, luego).subscribe(); } catch (e) {}
    });
  }
  function guardarFila(tabla, fila) {
    return Promise.resolve(sb().from(tabla).upsert(fila)).then(function (res) {
      if (res && res.error) throw res.error;
      return res;
    });
  }

  // ---------------- Recepciones de una orden ----------------
  function recepcionesDeOC(ocId) { return S.rec.filter(function (r) { return vigente(r) && r.oc_id === ocId; }); }
  // Lo recibido de un ítem de la OC (por id del ítem, o por descripción en las órdenes viejas)
  function recibidoItem(ocId, it) {
    var tot = 0;
    recepcionesDeOC(ocId).forEach(function (r) {
      r.items.forEach(function (x) {
        var mismo = it.item_id ? x.item_id === it.item_id : (!x.item_id && String(x.descripcion || '').trim().toLowerCase() === String(it.descripcion || '').trim().toLowerCase());
        if (mismo) tot += Number(x.recibido) || 0;
      });
    });
    return tot;
  }
  function fechaRecItem(ocId, it) {
    var f = '';
    recepcionesDeOC(ocId).forEach(function (r) {
      var esta = r.cierra || r.items.some(function (x) { return (it.item_id ? x.item_id === it.item_id : x.descripcion === it.descripcion) && Number(x.recibido) > 0; });
      if (esta && r.fecha > f) f = r.fecha;
    });
    return f;
  }
  // {estado: 'sin'|'parcial'|'completa', fecha (de la última recepción), items:[{...it, recibido}]}
  function ocRecepcion(o) {
    var recs = o ? recepcionesDeOC(o.id) : [];
    var items = (o && o.items || []).map(function (it) { return Object.assign({}, it, { recibido: recibidoItem(o.id, it) }); });
    var fecha = recs.reduce(function (m, r) { return r.fecha > m ? r.fecha : m; }, '');
    var cierra = recs.some(function (r) { return r.cierra; });
    var estado = 'sin';
    if (recs.length) {
      if (cierra || (items.length && items.every(function (it) { return it.recibido >= (Number(it.cantidad) || 0) - 1e-9; }))) estado = 'completa';
      else estado = 'parcial';
    }
    return { estado: estado, fecha: fecha, items: items, recs: recs, difs: recs.some(function (r) { return r.con_diferencias; }) };
  }
  // Marca para la lista de órdenes de compra (Compras → Órdenes de compra)
  function ocHint(o) {
    if (!S.cargado && !S.cargando && sb()) cargar().then(function () { G.renderCompras(); });
    if (!S.cargado || S.sinTablas) return '';
    var rc = ocRecepcion(o);
    var t = '';
    if (rc.estado === 'parcial') t = '📦 recepción parcial';
    else if (rc.estado === 'completa' && o.estado !== 'recibida') t = '📦 recibida ' + fmtFechaCorta(rc.fecha);
    if (rc.difs) t += (t ? ' · ' : '') + '⚠ con diferencias';
    if (rc.estado !== 'completa' && o.entregaPrevista && o.entregaPrevista < hoy()) t += (t ? ' · ' : '') + '⏰ debía llegar ' + fmtFechaCorta(o.entregaPrevista);
    var sols = solicitudesDeOC(o.id);
    if (sols.length) t += (t ? ' · ' : '') + sols.map(solLabel).join(', ');
    return t ? '<div class="fm-hint">' + esc(t) + '</div>' : '';
  }
  function solicitudesDeOC(ocId) { return S.sol.filter(function (s) { return vigente(s) && s.items.some(function (it) { return it.oc_id === ocId; }); }); }

  // ---------------- Estado de la solicitud (se calcula) ----------------
  function itemInfo(it) {
    var o = ocById(it.oc_id);
    if (!ocVigente(o)) o = null;
    var rc = o ? ocRecepcion(o) : null;
    var recibido = o ? recibidoItem(o.id, { item_id: it.id, descripcion: it.descripcion }) : 0;
    var cant = Number(it.cantidad) || 0;
    var completo = !!o && (recibido >= cant - 1e-9 || (rc && rc.recs.some(function (r) { return r.cierra; })));
    return { oc: o, recibido: recibido, completo: completo, fecha: completo || recibido ? fechaRecItem(o.id, { item_id: it.id, descripcion: it.descripcion }) : '' };
  }
  function itemsVig(s) { return s.items.filter(function (it) { return !it.cancelado; }); }
  function estadoSol(s) {
    if (!vigente(s)) return 'anulada';
    if (s.estado === 'rechazada') return 'rechazada';
    var its = itemsVig(s);
    if (!its.length) return s.estado || 'pendiente';
    var inf = its.map(itemInfo);
    if (inf.every(function (x) { return x.completo; })) return 'entregada';
    if (inf.some(function (x) { return x.completo || x.recibido > 0; })) return 'parcial';
    if (inf.every(function (x) { return x.oc; })) return 'comprada';
    if (inf.some(function (x) { return x.oc; })) return 'en_compra';
    return s.estado === 'cotizando' ? 'cotizando' : 'pendiente';
  }
  function fechaEntrega(s) {
    return itemsVig(s).map(itemInfo).reduce(function (m, x) { return x.fecha > m ? x.fecha : m; }, '');
  }
  // Atraso: abierta y pasada de la fecha en que se necesitaba, o de la
  // entrega prevista de alguna de sus órdenes. null si está en fecha.
  function demora(s) {
    var e = estadoSol(s);
    if (ABIERTAS.indexOf(e) === -1) return null;
    var h = hoy(), lim = '';
    if (s.necesaria_para && s.necesaria_para < h) lim = s.necesaria_para;
    itemsVig(s).forEach(function (it) {
      var x = itemInfo(it);
      if (x.oc && !x.completo && x.oc.entregaPrevista && x.oc.entregaPrevista < h && (!lim || x.oc.entregaPrevista < lim)) lim = x.oc.entregaPrevista;
    });
    return lim ? { desde: lim, dias: G.difDias(lim, h) } : null;
  }
  function badgeEstado(s) {
    var e = estadoSol(s), d = demora(s);
    return '<span class="oc-badge ' + e + '">' + ESTADOS[e] + '</span>' + (d ? '<span class="oc-badge demorada" title="Atrasada desde el ' + fmtFecha(d.desde) + '">⏰ ' + d.dias + ' día' + (d.dias === 1 ? '' : 's') + '</span>' : '');
  }
  function resumenItems(s, max) {
    var its = itemsVig(s);
    max = max || 2;
    return its.slice(0, max).map(function (it) { return fmtCant(it.cantidad) + ' × ' + esc(it.descripcion) + (it.unidad && it.unidad !== 'Unidad' ? ' <span class="mas">(' + esc(it.unidad.toLowerCase()) + ')</span>' : ''); }).join('<br>')
      + (its.length > max ? '<br><span class="mas">+' + (its.length - max) + ' más</span>' : '');
  }
  function provsYOCs(s) {
    var provs = [], oclist = [];
    itemsVig(s).forEach(function (it) {
      var o = ocById(it.oc_id);
      var pid = (o && o.proveedorId) || it.proveedor_id;
      if (pid) { var n = G.proveedorNombre(pid); if (provs.indexOf(n) === -1) provs.push(n); }
      if (o && ocVigente(o)) { var l = G.ocNumeroLabel(o.numero); if (oclist.indexOf(l) === -1) oclist.push(l); }
    });
    return { provs: provs, ocs: oclist };
  }

  // ---------------- Lista de solicitudes ----------------
  function sectoresUsados() {
    var l = SECTORES.slice();
    S.sol.forEach(function (s) { if (s.sector && l.indexOf(s.sector) === -1) l.push(s.sector); });
    return l;
  }
  function llenarSectores(sel, valor, conTodos) {
    sel.innerHTML = (conTodos ? '<option value="">Todos</option>' : '<option value="">Elegí el sector…</option>') +
      sectoresUsados().map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('');
    sel.value = valor || '';
  }
  function filtradas() {
    var f = S.f, q = f.q.trim().toLowerCase(), yo = usuario();
    return S.sol.filter(function (s) {
      var e = estadoSol(s);
      if (f.estado === 'abiertas' && ABIERTAS.indexOf(e) === -1) return false;
      if (f.estado === 'demoradas' && !demora(s)) return false;
      if (f.estado && f.estado !== 'abiertas' && f.estado !== 'demoradas' && e !== f.estado) return false;
      if (f.sector && s.sector !== f.sector) return false;
      if (f.mias && String(s.solicitante || '').toLowerCase() !== yo) return false;
      if (q) {
        var po = provsYOCs(s);
        var txt = [solLabel(s), String(s.numero), s.sector, s.motivo, s.notas_compras, s.solicitante].concat(po.provs, po.ocs)
          .concat(s.items.map(function (it) { return it.descripcion; })).join(' ').toLowerCase();
        if (txt.indexOf(q) === -1) return false;
      }
      return true;
    }).sort(function (a, b) { return (b.numero || 0) - (a.numero || 0); });
  }
  function renderLista() {
    var body = $('sc-body');
    if (!body) return;
    $('sc-sin-tablas').hidden = !S.sinTablas;
    $('sc-nueva').style.display = puedeCargar() ? '' : 'none';
    var lista = filtradas();
    $('sc-count').textContent = S.sol.length ? '(' + lista.length + (lista.length !== S.sol.length ? ' de ' + S.sol.length : '') + ')' : '';
    if (!lista.length) {
      body.innerHTML = '<tr class="day-row empty"><td colspan="7">' + (!S.cargado ? 'Cargando…' : S.sol.length ? 'Ninguna solicitud con estos filtros.' : 'Todavía no hay solicitudes. Con <b>+ Nueva solicitud</b> el sector pide lo que necesita.') + '</td></tr>';
      return;
    }
    body.innerHTML = '';
    lista.forEach(function (s) {
      var po = provsYOCs(s);
      var tr = document.createElement('tr');
      tr.className = 'day-row' + (vigente(s) ? '' : ' anulado');
      tr.dataset.id = s.id;
      tr.innerHTML = '<td class="day-route num">' + solLabel(s) + '</td>'
        + '<td class="num">' + fmtFechaCorta(s.fecha) + '</td>'
        + '<td>' + esc(s.sector || '—') + '<span class="sc-sub">' + esc(quienCorto(s.solicitante)) + '</span></td>'
        + '<td class="sc-items-cell">' + resumenItems(s) + '</td>'
        + '<td class="num">' + fmtFechaCorta(s.necesaria_para) + (s.urgente ? '<span class="oc-badge urgente">🔥 urgente</span>' : '') + '</td>'
        + '<td>' + (po.provs.length ? esc(po.provs.join(', ')) : '—') + (po.ocs.length ? '<span class="sc-sub">' + esc(po.ocs.join(', ')) + '</span>' : '') + '</td>'
        + '<td>' + badgeEstado(s) + '</td>';
      tr.addEventListener('click', function () { abrirSol(s.id); });
      body.appendChild(tr);
    });
  }

  // ---------------- Solicitud: alta, gestión de Compras y orden de compra ----------------
  function sectorRecordado() { try { return localStorage.getItem('sc_sector_' + usuario()) || ''; } catch (e) { return ''; } }
  function recordarSector(v) { try { localStorage.setItem('sc_sector_' + usuario(), v); } catch (e) {} }
  function nuevoItem() { return { id: nuevoId('it'), descripcion: '', articulo_id: '', cantidad: 1, unidad: 'Unidad', proveedor_id: '', precio: 0, oc_id: '' }; }
  function puedeEditarItems(s) {
    if (!vigente(s) || estadoSol(s) === 'rechazada') return false;
    if (esCompras()) return true;
    var mia = !s.solicitante || String(s.solicitante).toLowerCase() === usuario();
    return puedeCargar() && mia && ['pendiente', 'cotizando'].indexOf(estadoSol(s)) !== -1;
  }
  function llenarDatalists() {
    var arts = (G.datos().articulos || []).filter(function (a) { return a.activo !== false; });
    $('sol-art-list').innerHTML = arts.slice(0, 2000).map(function (a) { return '<option value="' + esc(a.descripcion) + '">' + esc(a.codigo || '') + '</option>'; }).join('');
    $('sol-prov-list').innerHTML = esCompras() ? proveedores().slice().sort(function (a, b) { return (a.nombre || '').localeCompare(b.nombre || ''); })
      .map(function (p) { return '<option value="' + esc(p.nombre) + '">'; }).join('') : '';
  }
  function abrirSol(id) {
    if (S.sinTablas) { toast('Para cargar solicitudes falta correr base-de-datos/seguimiento-compras.sql en Supabase.', 7000); return; }
    var s = id ? S.sol.find(function (x) { return x.id === id; }) : null;
    if (!s && !puedeCargar()) return;
    S.editSol = s ? JSON.parse(JSON.stringify(s)) : { id: null, numero: 0, fecha: hoy(), sector: sectorRecordado(), solicitante: G.usuario() || '', necesaria_para: '', urgente: false,
      motivo: '', items: [nuevoItem()], estado: 'pendiente', notas_compras: '', gestiona: '' };
    var e = S.editSol, nueva = !s;
    llenarDatalists();
    $('sol-title').textContent = nueva ? 'Nueva solicitud de compra' : 'Solicitud ' + solLabel(e);
    $('sol-sub').textContent = nueva ? 'Lo que necesita el sector. Compras la toma, elige el proveedor y genera la orden de compra.'
      : 'Cargada el ' + fmtFecha(e.fecha) + ' por ' + (e.solicitante || '—') + (e.gestiona ? ' · la gestiona ' + quienCorto(e.gestiona) : '');
    llenarSectores($('sol-sector'), e.sector, false);
    $('sol-para').value = e.necesaria_para || '';
    $('sol-urgente').checked = !!e.urgente;
    $('sol-motivo').value = e.motivo || '';
    var compras = esCompras();
    $('sol-modal').classList.toggle('con-compras', compras || e.items.some(function (it) { return it.oc_id || it.proveedor_id; }));
    $('sol-compras').hidden = !compras || !vigente(e);
    $('sol-estado-sel').value = e.estado === 'cotizando' || e.estado === 'rechazada' ? e.estado : 'pendiente';
    $('sol-entrega').value = e.necesaria_para || '';
    $('sol-notas-compras').value = e.notas_compras || '';
    var est = $('sol-estado');
    if (nueva) est.hidden = true;
    else {
      est.hidden = false;
      var fe = fechaEntrega(e);
      est.innerHTML = '<span>Estado: ' + badgeEstado(e) + '</span>'
        + (estadoSol(e) === 'entregada' && fe ? '<span>Entregada el <b>' + fmtFecha(fe) + '</b> (' + G.difDias(e.fecha, fe) + ' días desde la solicitud)</span>' : '')
        + (!vigente(e) ? '<span style="color:var(--danger)">' + esc(G.anulacionTexto({ anuladoEn: e.anulado_en, anuladoPor: e.anulado_por, motivoAnulacion: e.motivo_anulacion })) + '</span>' : '');
    }
    var editable = nueva || puedeEditarItems(e);
    ['sol-sector', 'sol-para', 'sol-urgente', 'sol-motivo'].forEach(function (k) { $(k).disabled = !editable; });
    $('sol-add').style.display = editable ? '' : 'none';
    $('sol-save').style.display = (editable || (compras && vigente(e))) ? '' : 'none';
    $('sol-anular').style.display = !nueva && vigente(e) && (compras || editable) ? '' : 'none';
    $('sol-imprimir').style.display = nueva ? 'none' : '';
    renderItemsSol();
    $('sol-overlay').classList.add('show');
  }
  function cerrarSol() { $('sol-overlay').classList.remove('show'); S.editSol = null; }
  function renderItemsSol() {
    var e = S.editSol, tb = $('sol-items').querySelector('tbody');
    var editable = !e.id || puedeEditarItems(e);
    var compras = esCompras() && vigente(e);
    tb.innerHTML = '';
    e.items.forEach(function (it, i) {
      var inf = it.oc_id ? itemInfo(it) : null;
      var bloqueado = !editable || !!(inf && inf.oc);
      var tr = document.createElement('tr');
      if (it.cancelado) tr.className = 'cancelado';
      var p = it.proveedor_id ? proveedores().find(function (x) { return x.id === it.proveedor_id; }) : null;
      var rec = '—';
      if (inf && inf.oc) rec = inf.completo ? '✔ ' + fmtCant(inf.recibido) + (inf.fecha ? ' · ' + fmtFechaCorta(inf.fecha) : '') : inf.recibido ? fmtCant(inf.recibido) + ' de ' + fmtCant(it.cantidad) : 'no llegó';
      tr.innerHTML = '<td class="d"><input type="text" class="i-desc" list="sol-art-list" value="' + esc(it.descripcion || '') + '" placeholder="Qué se necesita" ' + (bloqueado ? 'disabled' : '') + '></td>'
        + '<td class="n"><input type="text" class="q i-cant" inputmode="decimal" value="' + esc(fmtCant(it.cantidad)) + '" ' + (bloqueado ? 'disabled' : '') + '></td>'
        + '<td><select class="u i-unidad" ' + (bloqueado ? 'disabled' : '') + '>' + UNIDADES.concat(UNIDADES.indexOf(it.unidad) === -1 && it.unidad ? [it.unidad] : []).map(function (u) { return '<option' + (u === it.unidad ? ' selected' : '') + '>' + esc(u) + '</option>'; }).join('') + '</select></td>'
        + '<td class="sol-c pv"><input type="text" class="i-prov" list="sol-prov-list" value="' + esc(p ? p.nombre : '') + '" placeholder="Proveedor" ' + (!compras || (inf && inf.oc) ? 'disabled' : '') + '></td>'
        + '<td class="sol-c n"><input type="text" class="pr i-precio" inputmode="decimal" value="' + (it.precio ? esc(fmtCant(it.precio)) : '') + '" placeholder="0" ' + (!compras || (inf && inf.oc) ? 'disabled' : '') + '></td>'
        + '<td class="sol-c">' + (inf && inf.oc ? '<span class="oc-link" data-oc="' + esc(inf.oc.id) + '">' + G.ocNumeroLabel(inf.oc.numero) + '</span>' : '—') + '</td>'
        + '<td class="rec">' + rec + '</td>'
        + '<td>' + (!bloqueado && e.items.length > 1 ? '<button type="button" class="quitar" title="Quitar">✕</button>' : '') + '</td>';
      function leer() {
        it.descripcion = tr.querySelector('.i-desc').value.trim();
        it.cantidad = numIn(tr.querySelector('.i-cant').value);
        it.unidad = tr.querySelector('.i-unidad').value;
        var art = (G.datos().articulos || []).find(function (a) { return String(a.descripcion || '').toLowerCase() === it.descripcion.toLowerCase(); });
        it.articulo_id = art ? art.id : '';
        if (art && art.unidad && tr.querySelector('.i-unidad').dataset.tocada !== '1' && UNIDADES.indexOf(art.unidad) !== -1) { it.unidad = art.unidad; tr.querySelector('.i-unidad').value = art.unidad; }
        it.__prov = tr.querySelector('.i-prov').value.trim();
        it.precio = numIn(tr.querySelector('.i-precio').value);
      }
      tr.querySelectorAll('input,select').forEach(function (el) { el.addEventListener('change', leer); });
      tr.querySelector('.i-unidad').addEventListener('change', function () { this.dataset.tocada = '1'; });
      var q = tr.querySelector('.quitar');
      if (q) q.addEventListener('click', function () { e.items.splice(i, 1); renderItemsSol(); });
      var l = tr.querySelector('.oc-link');
      if (l) l.addEventListener('click', function () { var id = l.dataset.oc; cerrarSol(); G.irA('compras'); G.mostrarSubtab('compras', 'ocs'); G.abrirOC(id); });
      it.__leer = leer;
      tb.appendChild(tr);
    });
  }
  // Pasa lo del formulario a S.editSol. Devuelve un texto de error o ''.
  function leerFormSol() {
    var e = S.editSol;
    e.items.forEach(function (it) { if (it.__leer) it.__leer(); });
    if (!e.id || puedeEditarItems(e)) {
      e.sector = $('sol-sector').value;
      e.necesaria_para = $('sol-para').value || null;
      e.urgente = $('sol-urgente').checked;
      e.motivo = $('sol-motivo').value.trim();
    }
    if (!e.sector) return 'Elegí el sector.';
    e.items = e.items.filter(function (it) { return it.oc_id || it.descripcion; });
    if (!e.items.length) { e.items.push(nuevoItem()); renderItemsSol(); return 'Cargá al menos un ítem: qué se necesita y cuánto.'; }
    var mal = e.items.find(function (it) { return !it.oc_id && !(it.cantidad > 0); });
    if (mal) return 'Falta la cantidad de "' + mal.descripcion + '".';
    if (esCompras() && vigente(e)) {
      for (var i = 0; i < e.items.length; i++) {
        var it = e.items[i];
        if (it.oc_id || it.__prov === undefined) continue;
        if (!it.__prov) { it.proveedor_id = ''; continue; }
        var p = provPorNombre(it.__prov);
        if (!p) return 'El proveedor "' + it.__prov + '" no está cargado. Elegilo de la lista (o dalo de alta en Compras → Proveedores).';
        it.proveedor_id = p.id;
      }
      var est = $('sol-estado-sel').value;
      if (est !== e.estado) e.gestiona = G.usuario() || e.gestiona;
      e.estado = est;
      e.notas_compras = $('sol-notas-compras').value.trim();
    }
    return '';
  }
  function filaSol(e) {
    var f = {
      id: e.id, numero: e.numero, fecha: e.fecha, sector: e.sector, solicitante: e.solicitante || '', necesaria_para: e.necesaria_para || null,
      urgente: !!e.urgente, motivo: e.motivo || '', estado: e.estado || 'pendiente', notas_compras: e.notas_compras || '', gestiona: e.gestiona || '',
      items: e.items.map(function (it) {
        return { id: it.id, descripcion: it.descripcion || '', articulo_id: it.articulo_id || '', cantidad: Number(it.cantidad) || 0, unidad: it.unidad || 'Unidad',
          proveedor_id: it.proveedor_id || '', precio: Number(it.precio) || 0, oc_id: it.oc_id || '', cancelado: !!it.cancelado };
      }),
      actualizado: new Date().toISOString(),
      anulado_en: e.anulado_en || null, anulado_por: e.anulado_por || '', motivo_anulacion: e.motivo_anulacion || ''
    };
    if (e.creado) f.creado = e.creado;
    return f;
  }
  function proximoNumero(lista) { return lista.reduce(function (m, x) { return Math.max(m, x.numero || 0); }, 0) + 1; }
  // Guarda la solicitud (con número nuevo si hace falta). Si otro tomó el
  // número al mismo tiempo, recarga y prueba con el siguiente.
  function persistirSol(e, intento) {
    var nueva = !e.id;
    if (nueva) { e.id = nuevoId('sol'); e.creado = new Date().toISOString(); }
    if (!e.numero) e.numero = proximoNumero(S.sol);
    var fila = filaSol(e);
    return guardarFila('solicitudes_compra', fila).then(function () {
      var i = S.sol.findIndex(function (x) { return x.id === fila.id; });
      if (i >= 0) S.sol[i] = normSol(fila); else S.sol.push(normSol(fila));
      return fila;
    }, function (err) {
      if (!intento && /duplicate|unique|23505/i.test((err && (err.message || err.code)) || '')) {
        return cargar(true).then(function () { e.numero = 0; return persistirSol(e, true); });
      }
      if (nueva) { e.id = null; e.numero = 0; }
      throw err;
    });
  }
  function guardarSol() {
    var err = leerFormSol();
    if (err) { toast(err); return; }
    var e = S.editSol, nueva = !e.id;
    $('sol-save').disabled = true;
    persistirSol(e).then(function (fila) {
      recordarSector(fila.sector);
      cerrarSol(); render();
      toast(nueva ? 'Solicitud ' + solLabel(fila) + ' cargada. Compras la ve en su lista.' : 'Solicitud guardada.');
    }, function (er) { toast('No se pudo guardar la solicitud: ' + ((er && er.message) || 'error')); })
      .then(function () { $('sol-save').disabled = false; });
  }
  // Una orden de compra por proveedor con los ítems que tienen proveedor y no tienen orden.
  function generarOC() {
    if (!G.colOCItems()) { toast('Para generar órdenes desde la solicitud falta correr base-de-datos/seguimiento-compras.sql en Supabase.', 7000); return; }
    var err = leerFormSol();
    if (err) { toast(err); return; }
    var e = S.editSol;
    var grupos = {}, orden = [];
    e.items.forEach(function (it) {
      if (it.cancelado || !it.proveedor_id) return;
      if (it.oc_id && ocVigente(ocById(it.oc_id))) return;
      if (!grupos[it.proveedor_id]) { grupos[it.proveedor_id] = []; orden.push(it.proveedor_id); }
      grupos[it.proveedor_id].push(it);
    });
    if (!orden.length) { toast('Elegí el proveedor de los ítems a comprar (los que ya tienen orden no se repiten).'); return; }
    var entrega = $('sol-entrega').value || '';
    var btn = $('sol-generar-oc'); btn.disabled = true;
    // La solicitud se guarda primero (para tener número) y después las órdenes.
    persistirSol(e).then(function () {
      var hechas = [];
      orden.forEach(function (pid) {
        var its = grupos[pid];
        var numero = G.nextOCNumero();
        var o = {
          id: 'oc_' + numero, numero: numero, proveedorId: pid, fecha: hoy(),
          descripcion: solLabel(e) + ' (' + e.sector + '): ' + its.map(function (it) { return fmtCant(it.cantidad) + ' ' + it.descripcion; }).join(', '),
          monto: Math.round(its.reduce(function (t, it) { return t + (Number(it.cantidad) || 0) * (Number(it.precio) || 0); }, 0) * 100) / 100,
          estado: 'aprobada', notas: e.notas_compras || '', who: G.quien(),
          items: its.map(function (it) { return { item_id: it.id, solicitud_id: e.id, descripcion: it.descripcion, cantidad: Number(it.cantidad) || 0, unidad: it.unidad || 'Unidad', precio: Number(it.precio) || 0 }; }),
          entregaPrevista: entrega, anuladoEn: '', anuladoPor: '', motivoAnulacion: ''
        };
        G.guardarOC(o);
        its.forEach(function (it) { it.oc_id = o.id; });
        hechas.push(G.ocNumeroLabel(numero) + ' (' + G.proveedorNombre(pid) + ')');
      });
      if (!e.gestiona) e.gestiona = G.usuario() || '';
      return persistirSol(e).then(function () {
        toast('Orden' + (hechas.length > 1 ? 'es' : '') + ' de compra generada' + (hechas.length > 1 ? 's' : '') + ': ' + hechas.join(', ') + '.', 6000);
        var id = e.id; render(); abrirSol(id);
      });
    }).catch(function (er) { toast('No se pudo generar la orden: ' + ((er && er.message) || 'error')); })
      .then(function () { btn.disabled = false; });
  }
  function anularSol() {
    var e = S.editSol;
    if (!e || !e.id) return;
    var conOC = e.items.some(function (it) { return it.oc_id && ocVigente(ocById(it.oc_id)); });
    if (conOC) { toast('Tiene órdenes de compra emitidas: anulalas primero desde Compras → Órdenes de compra (o marcala "Rechazada").', 7000); return; }
    var orig = S.sol.find(function (x) { return x.id === e.id; });
    G.pedirMotivo('Anular ' + solLabel(e), (e.sector || '') + ' — ' + itemsVig(e).map(function (it) { return it.descripcion; }).join(', ') + '. Queda registrada como anulada.', function (motivo) {
      var x = JSON.parse(JSON.stringify(orig || e));
      x.anulado_en = new Date().toISOString(); x.anulado_por = G.quien(); x.motivo_anulacion = motivo;
      persistirSol(x).then(function () { cerrarSol(); render(); toast('Solicitud anulada.'); }, function (er) { toast('No se pudo anular: ' + ((er && er.message) || 'error')); });
    });
  }
  function imprimirSol() {
    var e = S.editSol;
    if (!e || !e.id) return;
    var anul = !vigente(e);
    var est = estadoSol(e);
    var filas = e.items.map(function (it) {
      var inf = itemInfo(it);
      return [esc(it.descripcion), fmtCant(it.cantidad), esc(it.unidad || ''), esc(it.proveedor_id ? G.proveedorNombre(it.proveedor_id) : '—'),
        inf.oc ? G.ocNumeroLabel(inf.oc.numero) : '—', inf.oc ? fmtCant(inf.recibido) : '—'];
    });
    G.imprimirDocumento({
      tipo: 'Solicitud de compra', numero: solLabel(e), fecha: e.fecha, codigo: 'RG-0708',
      estado: { texto: anul ? 'Anulada' : ESTADOS[est], color: anul ? '#e1251b' : est === 'entregada' ? '#16a34a' : '#223c7e' },
      anulado: anul ? G.anulacionTexto({ anuladoEn: e.anulado_en, anuladoPor: e.anulado_por, motivoAnulacion: e.motivo_anulacion }) : null,
      bloques: [
        { titulo: 'Solicitud', html: G.impKV([['Sector', e.sector], ['Pidió', e.solicitante], ['Se necesita para', e.necesaria_para ? G.impFecha(e.necesaria_para) : '—'], ['Urgente', e.urgente ? 'Sí' : 'No'], ['Para qué', e.motivo || '—']]) },
        { titulo: 'Ítems', html: G.impTabla([{ t: 'Insumo' }, { t: 'Cantidad', num: true }, { t: 'Unidad' }, { t: 'Proveedor' }, { t: 'Orden de compra' }, { t: 'Recibido', num: true }], filas) },
        e.notas_compras ? { titulo: 'Compras', html: G.impKV([['Notas', e.notas_compras], ['Gestiona', e.gestiona || '—']]) } : null
      ].filter(Boolean)
    });
  }

  // ---------------- Recepciones ----------------
  function ocsParaRecibir(incluir) {
    return ocs().filter(function (o) { return ocVigente(o) && (o.id === incluir || ocRecepcion(o).estado !== 'completa'); })
      .sort(function (a, b) { return (b.numero || 0) - (a.numero || 0); });
  }
  function abrirRec(id, ocId) {
    if (S.sinTablas) { toast('Para registrar recepciones falta correr base-de-datos/seguimiento-compras.sql en Supabase.', 7000); return; }
    var r = id ? S.rec.find(function (x) { return x.id === id; }) : null;
    if (!r && !esCompras()) return;
    S.editRec = r ? JSON.parse(JSON.stringify(r)) : { id: null, numero: 0, fecha: hoy(), oc_id: ocId || '', remito: '', items: [], con_diferencias: false, cierra: false, observaciones: '', recibido_por: G.usuario() || '', archivos: [] };
    var e = S.editRec, nueva = !r;
    S.recArchivos = [];
    $('rec-title').textContent = nueva ? 'Registrar recepción' : 'Recepción ' + recLabel(e);
    $('rec-sub').textContent = nueva ? 'Lo que llegó de la orden de compra' : 'Registrada por ' + (e.recibido_por || '—') + (vigente(e) ? '' : ' · ' + G.anulacionTexto({ anuladoEn: e.anulado_en, anuladoPor: e.anulado_por, motivoAnulacion: e.motivo_anulacion }));
    var sel = $('rec-oc');
    var lista = nueva ? ocsParaRecibir(e.oc_id) : [ocById(e.oc_id)].filter(Boolean);
    sel.innerHTML = (nueva ? '<option value="">Elegí la orden de compra…</option>' : '') + lista.map(function (o) {
      return '<option value="' + esc(o.id) + '">' + G.ocNumeroLabel(o.numero) + ' · ' + esc(G.proveedorNombre(o.proveedorId)) + ' · ' + fmtFechaCorta(o.fecha) + '</option>';
    }).join('');
    sel.value = e.oc_id || '';
    $('rec-fecha').value = e.fecha || hoy();
    $('rec-remito').value = e.remito || '';
    $('rec-recibio').value = e.recibido_por || '';
    $('rec-difs').checked = !!e.con_diferencias;
    $('rec-obs').value = e.observaciones || '';
    $('rec-archivo').value = '';
    ['rec-oc', 'rec-fecha', 'rec-remito', 'rec-recibio', 'rec-difs', 'rec-cierra', 'rec-obs', 'rec-archivo'].forEach(function (k) { $(k).disabled = !nueva; });
    $('rec-save').style.display = nueva ? '' : 'none';
    $('rec-anular').style.display = !nueva && vigente(e) && esCompras() ? '' : 'none';
    renderArchivosRec();
    if (nueva) cargarItemsRec(); else renderItemsRecVer();
    $('rec-overlay').classList.add('show');
  }
  function cerrarRec() { $('rec-overlay').classList.remove('show'); S.editRec = null; }
  function renderArchivosRec() {
    var e = S.editRec, box = $('rec-archivos');
    box.innerHTML = (e.archivos || []).map(function (a, i) { return '<a href="#" data-i="' + i + '">📎 ' + esc(a.name || 'remito') + '</a>'; }).join(' · ');
    box.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function (ev) { ev.preventDefault(); G.driveAbrir(e.archivos[Number(a.dataset.i)], 'administracion'); });
    });
  }
  // Recepción nueva: los ítems de la orden con lo que falta recibir
  function cargarItemsRec() {
    var e = S.editRec, o = ocById($('rec-oc').value);
    e.oc_id = o ? o.id : '';
    var tb = $('rec-items').querySelector('tbody');
    tb.innerHTML = '';
    $('rec-add').hidden = true;
    if (!o) { tb.innerHTML = '<tr><td colspan="5" class="sg-vacio">Elegí la orden de compra.</td></tr>'; $('rec-resumen').textContent = ''; return; }
    var rc = ocRecepcion(o);
    var conItems = rc.items.length > 0;
    $('rec-cierra').checked = !conItems;
    var filas = conItems ? rc.items.map(function (it) {
      return { item_id: it.item_id || '', solicitud_id: it.solicitud_id || '', descripcion: it.descripcion, unidad: it.unidad || '', pedido: Number(it.cantidad) || 0, ya: it.recibido, fijo: true };
    }) : [{ item_id: '', solicitud_id: '', descripcion: o.descripcion || '', unidad: '', pedido: null, ya: 0, fijo: false }];
    S.recFilas = filas;
    function fila(x) {
      var tr = document.createElement('tr');
      var falta = x.pedido == null ? '' : Math.max(0, x.pedido - x.ya);
      tr.innerHTML = '<td class="d">' + (x.fijo ? esc(x.descripcion) + (x.unidad && x.unidad !== 'Unidad' ? ' <span class="sc-sub">' + esc(x.unidad) + '</span>' : '') : '<input type="text" class="r-desc" value="' + esc(x.descripcion) + '" placeholder="Qué llegó">') + '</td>'
        + '<td class="n">' + (x.pedido == null ? '—' : fmtCant(x.pedido)) + '</td>'
        + '<td class="n">' + (x.fijo ? fmtCant(x.ya) : '—') + '</td>'
        + '<td class="n"><input type="text" class="q r-cant" inputmode="decimal" value="' + (falta === '' ? '' : esc(fmtCant(falta))) + '"></td>'
        + '<td><input type="text" class="r-nota" placeholder="(opcional)"></td>';
      tr.querySelectorAll('input').forEach(function (el) { el.addEventListener('input', resumenRec); });
      x.tr = tr;
      tb.appendChild(tr);
    }
    filas.forEach(fila);
    if (!conItems) {
      $('rec-add').hidden = false;
      $('rec-add').onclick = function () { var x = { item_id: '', solicitud_id: '', descripcion: '', unidad: '', pedido: null, ya: 0, fijo: false }; filas.push(x); fila(x); };
    }
    resumenRec();
  }
  function leerFilasRec() {
    return (S.recFilas || []).map(function (x) {
      return { item_id: x.item_id, solicitud_id: x.solicitud_id, descripcion: x.fijo ? x.descripcion : (x.tr.querySelector('.r-desc').value.trim()), unidad: x.unidad,
        pedido: x.pedido, ya: x.ya, recibido: numIn(x.tr.querySelector('.r-cant').value), nota: x.tr.querySelector('.r-nota').value.trim() };
    });
  }
  function resumenRec() {
    var filas = leerFilasRec(), box = $('rec-resumen');
    if (!filas.length || filas[0].pedido == null) { box.textContent = $('rec-cierra').checked ? 'La orden queda recibida.' : 'La orden queda con recepción parcial.'; return; }
    var faltan = filas.filter(function (x) { return x.ya + x.recibido < x.pedido - 1e-9; });
    var demas = filas.filter(function (x) { return x.ya + x.recibido > x.pedido + 1e-9; });
    if (demas.length && !$('rec-difs').dataset.tocado) $('rec-difs').checked = true;
    box.innerHTML = $('rec-cierra').checked || !faltan.length ? '✔ Con esto la orden queda <b>recibida completa</b>.' + (faltan.length ? ' Lo que falta no va a llegar.' : '')
      : '📦 Queda <b>parcial</b>: falta ' + faltan.map(function (x) { return fmtCant(x.pedido - x.ya - x.recibido) + ' ' + esc(x.descripcion); }).join(', ') + '.';
    if (demas.length) box.innerHTML += ' <span style="color:var(--danger)">⚠ Llegó de más: ' + demas.map(function (x) { return esc(x.descripcion); }).join(', ') + '.</span>';
  }
  function renderItemsRecVer() {
    var e = S.editRec, tb = $('rec-items').querySelector('tbody');
    $('rec-add').hidden = true;
    $('rec-cierra').checked = !!e.cierra;
    tb.innerHTML = e.items.map(function (x) {
      return '<tr><td class="d">' + esc(x.descripcion) + '</td><td class="n">' + (x.pedido == null ? '—' : fmtCant(x.pedido)) + '</td><td class="n">—</td><td class="n"><b>' + fmtCant(x.recibido) + '</b></td><td>' + esc(x.nota || '') + '</td></tr>';
    }).join('');
    var facts = facturasDeOC(e.oc_id);
    $('rec-resumen').innerHTML = facts.length ? '🧾 Factura' + (facts.length > 1 ? 's' : '') + ': ' + facts.map(function (f) { return esc(f.numero) + ' (' + G.fmtMoney(f.monto) + ')'; }).join(', ') : '🧾 Todavía sin factura asociada a la orden.';
  }
  function guardarRec() {
    var e = S.editRec, o = ocById($('rec-oc').value);
    if (!o) { toast('Elegí la orden de compra.'); return; }
    var fecha = $('rec-fecha').value;
    if (!fecha) { toast('Poné la fecha en que llegó.'); return; }
    var filas = leerFilasRec().filter(function (x) { return x.descripcion || x.recibido; });
    var cierra = $('rec-cierra').checked;
    if (!filas.some(function (x) { return x.recibido > 0; }) && !cierra) { toast('Poné cuánto llegó de cada ítem.'); return; }
    var difs = $('rec-difs').checked, obs = $('rec-obs').value.trim();
    if (difs && !obs) { toast('Contá en Observaciones cuáles fueron las diferencias.'); return; }
    var btn = $('rec-save'); btn.disabled = true;
    var file = $('rec-archivo').files && $('rec-archivo').files[0];
    var subir = file ? Promise.resolve(G.driveSubir(file, ['Administración', 'Remitos', G.proveedorNombre(o.proveedorId)])) : Promise.resolve(null);
    subir.then(function (adj) {
      var fila = {
        id: nuevoId('rec'), numero: proximoNumero(S.rec), fecha: fecha, oc_id: o.id, proveedor_id: o.proveedorId || '',
        remito: $('rec-remito').value.trim(),
        items: filas.map(function (x) { return { item_id: x.item_id || '', solicitud_id: x.solicitud_id || '', descripcion: x.descripcion, unidad: x.unidad || '', pedido: x.pedido, recibido: x.recibido, nota: x.nota }; }),
        con_diferencias: difs, cierra: cierra, observaciones: obs, recibido_por: $('rec-recibio').value.trim() || G.usuario() || '',
        archivos: adj ? [adj] : [], creado: new Date().toISOString(), anulado_en: null, anulado_por: '', motivo_anulacion: ''
      };
      return guardarFila('recepciones', fila).catch(function (err) {
        if (/duplicate|unique|23505/i.test((err && (err.message || err.code)) || '')) return cargar(true).then(function () { fila.numero = proximoNumero(S.rec); return guardarFila('recepciones', fila); });
        throw err;
      }).then(function () {
        S.rec.push(normRec(fila));
        sincronizarOC(o);
        G.renderCompras();
        cerrarRec(); render();
        var rc = ocRecepcion(o);
        toast(recLabel(fila) + ' registrada. ' + G.ocNumeroLabel(o.numero) + (rc.estado === 'completa' ? ' quedó recibida.' : ' tiene recepción parcial.'), 5000);
      });
    }).catch(function (er) { toast('No se pudo guardar la recepción: ' + ((er && er.message) || 'error')); })
      .then(function () { btn.disabled = false; });
  }
  // La OC queda "Recibida" cuando llega todo (y vuelve a "Aprobada" si se anula la recepción)
  function sincronizarOC(o) {
    if (!ocVigente(o)) return;
    var rc = ocRecepcion(o);
    if (rc.estado === 'completa' && o.estado !== 'recibida') G.guardarOC(Object.assign({}, o, { estado: 'recibida' }));
    else if (rc.estado !== 'completa' && o.estado === 'recibida' && (o.items || []).length) G.guardarOC(Object.assign({}, o, { estado: 'aprobada' }));
  }
  function anularRec() {
    var e = S.editRec;
    if (!e || !e.id) return;
    G.pedirMotivo('Anular ' + recLabel(e), 'Remito ' + (e.remito || '—') + '. Lo recibido deja de contar y la orden vuelve a esperar esa mercadería.', function (motivo) {
      var x = JSON.parse(JSON.stringify(S.rec.find(function (r) { return r.id === e.id; }) || e));
      x.anulado_en = new Date().toISOString(); x.anulado_por = G.quien(); x.motivo_anulacion = motivo;
      guardarFila('recepciones', x).then(function () {
        var i = S.rec.findIndex(function (r) { return r.id === x.id; }); if (i >= 0) S.rec[i] = normRec(x);
        var o = ocById(x.oc_id); if (o) sincronizarOC(o);
        G.renderCompras();
        cerrarRec(); render(); toast('Recepción anulada.');
      }, function (er) { toast('No se pudo anular: ' + ((er && er.message) || 'error')); });
    });
  }
  function renderRecepciones() {
    var body = $('rc-body');
    if (!body) return;
    $('rc-nueva').style.display = esCompras() ? '' : 'none';
    var lista = S.rec.slice().sort(function (a, b) { return (b.numero || 0) - (a.numero || 0); });
    $('rc-count').textContent = lista.length ? '(' + lista.length + ')' : '';
    if (!lista.length) { body.innerHTML = '<tr class="day-row empty"><td colspan="8">' + (S.cargado ? 'Todavía no hay recepciones registradas.' : 'Cargando…') + '</td></tr>'; return; }
    body.innerHTML = '';
    lista.forEach(function (r) {
      var o = ocById(r.oc_id), facts = facturasDeOC(r.oc_id);
      var its = r.items.filter(function (x) { return Number(x.recibido) > 0; });
      var tr = document.createElement('tr');
      tr.className = 'day-row' + (vigente(r) ? '' : ' anulado');
      tr.innerHTML = '<td class="day-route num">' + recLabel(r) + '</td>'
        + '<td class="num">' + fmtFechaCorta(r.fecha) + '</td>'
        + '<td>' + esc(G.proveedorNombre(r.proveedor_id || (o && o.proveedorId))) + '</td>'
        + '<td class="num">' + (o ? G.ocNumeroLabel(o.numero) : '—') + '</td>'
        + '<td class="num">' + esc(r.remito || '—') + '</td>'
        + '<td class="sc-items-cell">' + its.slice(0, 2).map(function (x) { return fmtCant(x.recibido) + ' × ' + esc(x.descripcion); }).join('<br>') + (its.length > 2 ? '<br><span class="mas">+' + (its.length - 2) + ' más</span>' : '') + '</td>'
        + '<td>' + (!vigente(r) ? '<span class="oc-badge anulada">Anulada</span>' : r.con_diferencias ? '<span class="oc-badge difs">⚠ Con diferencias</span>' : '<span class="oc-badge ok">Conforme</span>') + (r.cierra ? '<span class="sc-sub">cierra la orden</span>' : '') + '</td>'
        + '<td>' + (facts.length ? esc(facts.map(function (f) { return f.numero; }).join(', ')) : '<span class="sc-sub">sin factura</span>') + '</td>';
      tr.addEventListener('click', function () { abrirRec(r.id); });
      body.appendChild(tr);
    });
  }

  // ---------------- En la orden de compra (modal de Compras) ----------------
  function renderEnOC(o, vigenteOC) {
    var box = $('ocm-recepciones'), btn = $('ocm-recibir');
    if (!box) return;
    if (!o || S.sinTablas) { box.hidden = true; btn.style.display = 'none'; return; }
    if (!S.cargado) cargar().then(function () { if (G.datos && $('oc-overlay').classList.contains('show')) renderEnOC(o, vigenteOC); });
    var rc = ocRecepcion(o), sols = solicitudesDeOC(o.id), facts = facturasDeOC(o.id);
    var facturado = facts.reduce(function (t, f) { return t + (Number(f.monto) || 0); }, 0);
    var h = '<div class="fila"><span>Recepción</span><span class="oc-badge ' + (rc.estado === 'completa' ? 'entregada' : rc.estado === 'parcial' ? 'parcial' : 'sin_pagar') + '">'
      + (rc.estado === 'completa' ? 'Recibida' : rc.estado === 'parcial' ? 'Parcial' : 'Sin recibir') + '</span></div>';
    if (sols.length) h += '<div class="fila"><span>Solicitud</span><span>' + sols.map(function (s) { return solLabel(s) + ' · ' + esc(s.sector); }).join(', ') + '</span></div>';
    rc.items.forEach(function (it) {
      h += '<div class="fila"><span>' + esc(it.descripcion) + '</span><span>' + fmtCant(it.recibido) + ' de ' + fmtCant(it.cantidad) + (it.recibido >= it.cantidad - 1e-9 ? ' ✔' : '') + '</span></div>';
    });
    rc.recs.forEach(function (r) {
      h += '<div class="fila"><span>' + recLabel(r) + ' · ' + fmtFechaCorta(r.fecha) + (r.remito ? ' · remito ' + esc(r.remito) : '') + '</span><span>' + (r.con_diferencias ? '⚠ con diferencias' : 'conforme') + '</span></div>';
    });
    h += '<div class="fila tot"><span>Facturado' + (facts.length ? ' (' + esc(facts.map(function (f) { return f.numero; }).join(', ')) + ')' : '') + '</span><span>' + G.fmtMoney(facturado) + '</span></div>';
    if (rc.recs.length && !facts.length) h += '<div class="fm-hint">📦 Llegó mercadería y todavía no hay factura asociada a esta orden.</div>';
    if (facts.length && !rc.recs.length && (o.items || []).length) h += '<div class="fm-hint">🧾 Tiene factura pero no hay recepción registrada.</div>';
    box.innerHTML = h;
    box.hidden = !(rc.recs.length || sols.length || (o.items || []).length || facts.length);
    btn.style.display = vigenteOC && esCompras() && rc.estado !== 'completa' ? '' : 'none';
  }

  // ---------------- Tablero de seguimiento ----------------
  function tabla(cols, filas, vacio) {
    if (!filas.length) return '<div class="sg-vacio">' + (vacio || 'Nada para mostrar.') + '</div>';
    return '<div class="day-wrap"><table class="day-table"><thead><tr>' + cols.map(function (c) { return '<th' + (c.n ? ' class="num"' : '') + '>' + esc(c.t) + '</th>'; }).join('') + '</tr></thead><tbody>'
      + filas.map(function (f) { return '<tr class="day-row"' + (f.attr || '') + '>' + f.c.map(function (v, i) { return '<td' + (cols[i].n ? ' class="num"' : '') + '>' + v + '</td>'; }).join('') + '</tr>'; }).join('')
      + '</tbody></table></div>';
  }
  function kpi(label, valor, sub, alerta) {
    return '<div class="kpi-tile' + (alerta ? ' alerta' : '') + '"><div class="kpi-label">' + esc(label) + '</div><div class="kpi-value">' + valor + '</div>' + (sub ? '<div class="kpi-sub">' + sub + '</div>' : '') + '</div>';
  }
  function prom(arr) { return arr.length ? Math.round(arr.reduce(function (t, x) { return t + x; }, 0) / arr.length * 10) / 10 : null; }
  function fmtDias(d) { return d == null ? '—' : String(d).replace('.', ',') + ' d'; }
  function calcular(periodo) {
    var h = hoy(), desde = periodo ? G.sumarDias(h, -periodo) : '0000-00-00';
    var vig = S.sol.filter(vigente);
    var enPer = vig.filter(function (s) { return s.fecha >= desde; });
    var est = {}; vig.forEach(function (s) { est[s.id] = estadoSol(s); });
    var abiertas = vig.filter(function (s) { return ABIERTAS.indexOf(est[s.id]) !== -1; });
    var demoradas = abiertas.map(function (s) { return { s: s, d: demora(s) }; }).filter(function (x) { return x.d; }).sort(function (a, b) { return b.d.dias - a.d.dias; });
    var entregadas = vig.filter(function (s) { return est[s.id] === 'entregada'; }).map(function (s) { return { s: s, f: fechaEntrega(s) }; }).filter(function (x) { return x.f && x.f >= desde; });
    var aTiempo = entregadas.filter(function (x) { return x.s.necesaria_para; });
    var okTiempo = aTiempo.filter(function (x) { return x.f <= x.s.necesaria_para; });
    // Órdenes del circuito (las que salieron de una solicitud o tienen recepción)
    var ocsCirc = ocs().filter(function (o) { return ocVigente(o) && ((o.items || []).length || recepcionesDeOC(o.id).length); });
    var ocsPer = ocsCirc.filter(function (o) { return (o.fecha || '') >= desde; });
    var diasOC = [];
    var porProv = {};
    ocsPer.forEach(function (o) {
      var rc = ocRecepcion(o), p = porProv[o.proveedorId] || (porProv[o.proveedorId] = { id: o.proveedorId, ocs: 0, completas: 0, aTiempo: 0, conFecha: 0, dias: [], difs: 0 });
      p.ocs++;
      if (rc.difs) p.difs++;
      if (rc.estado === 'completa' && rc.fecha) {
        p.completas++;
        var d = Math.max(0, G.difDias(o.fecha, rc.fecha)); p.dias.push(d); diasOC.push(d);
        if (o.entregaPrevista) { p.conFecha++; if (rc.fecha <= o.entregaPrevista) p.aTiempo++; }
      } else if (o.entregaPrevista && o.entregaPrevista < h) p.conFecha++;
    });
    var porSector = {};
    enPer.forEach(function (s) {
      var x = porSector[s.sector || '—'] || (porSector[s.sector || '—'] = { sector: s.sector || '—', total: 0, abiertas: 0, demoradas: 0, entregadas: 0, dias: [] });
      x.total++;
      if (ABIERTAS.indexOf(est[s.id]) !== -1) x.abiertas++;
      if (demora(s)) x.demoradas++;
      if (est[s.id] === 'entregada') { x.entregadas++; var f = fechaEntrega(s); if (f) x.dias.push(Math.max(0, G.difDias(s.fecha, f))); }
    });
    var recSinFact = ocsCirc.filter(function (o) { return recepcionesDeOC(o.id).length && !facturasDeOC(o.id).length; });
    var factSinRec = (G.datos().facturas || []).filter(function (f) {
      if (!f.ocId || G.esAnulado(f) || f.estado === 'anulada') return false;
      var o = ocById(f.ocId);
      return ocVigente(o) && (o.items || []).length && !recepcionesDeOC(o.id).length;
    });
    var difs = S.rec.filter(function (r) { return vigente(r) && r.con_diferencias && r.fecha >= desde; }).sort(function (a, b) { return a.fecha < b.fecha ? 1 : -1; });
    return { abiertas: abiertas, demoradas: demoradas, entregadas: entregadas, aTiempo: aTiempo, okTiempo: okTiempo, diasSol: prom(entregadas.map(function (x) { return Math.max(0, G.difDias(x.s.fecha, x.f)); })),
      diasOC: prom(diasOC), porProv: porProv, porSector: porSector, recSinFact: recSinFact, factSinRec: factSinRec, difs: difs, enPer: enPer,
      sinComprar: abiertas.filter(function (s) { return est[s.id] === 'pendiente' || est[s.id] === 'cotizando'; }).length };
  }
  function renderTablero() {
    if (!$('sg-kpis')) return;
    var periodo = Number($('sg-periodo').value) || 0;
    var c = calcular(periodo);
    var perTxt = periodo ? 'últimos ' + periodo + ' días' : 'desde el inicio';
    $('sg-kpis').innerHTML =
      kpi('Solicitudes abiertas', String(c.abiertas.length), c.sinComprar + ' sin orden de compra todavía') +
      kpi('Demoradas', String(c.demoradas.length), c.demoradas.length ? 'la más atrasada: ' + c.demoradas[0].d.dias + ' días' : 'todo en fecha', c.demoradas.length > 0) +
      kpi('Entregadas', String(c.entregadas.length), c.aTiempo.length ? Math.round(c.okTiempo.length / c.aTiempo.length * 100) + '% a tiempo · ' + perTxt : perTxt) +
      kpi('Solicitud → entrega', fmtDias(c.diasSol), 'promedio · pedido al proveedor → entrega: ' + fmtDias(c.diasOC)) +
      kpi('Solicitudes del período', String(c.enPer.length), perTxt) +
      kpi('Recepciones con diferencias', String(c.difs.length), perTxt, c.difs.length > 0) +
      kpi('Recibido sin factura', String(c.recSinFact.length), 'órdenes con mercadería y sin factura', c.recSinFact.length > 0) +
      kpi('Facturado sin recepción', String(c.factSinRec.length), 'facturas de órdenes sin recepción', c.factSinRec.length > 0);
    $('sg-dem-n').textContent = c.demoradas.length ? '(' + c.demoradas.length + ')' : '';
    $('sg-demoradas').innerHTML = tabla([{ t: 'N°' }, { t: 'Sector' }, { t: 'Pedido' }, { t: 'Para' }, { t: 'Atraso', n: true }, { t: 'Estado' }, { t: 'Proveedor / OC' }],
      c.demoradas.slice(0, 30).map(function (x) {
        var po = provsYOCs(x.s);
        return { attr: ' data-sol="' + esc(x.s.id) + '"', c: [solLabel(x.s), esc(x.s.sector), '<span class="sc-items-cell">' + resumenItems(x.s, 1) + '</span>', fmtFechaCorta(x.d.desde), x.d.dias + ' d',
          '<span class="oc-badge ' + estadoSol(x.s) + '">' + ESTADOS[estadoSol(x.s)] + '</span>', esc(po.provs.join(', ') || '—') + (po.ocs.length ? '<span class="sc-sub">' + esc(po.ocs.join(', ')) + '</span>' : '')] };
      }), '✔ No hay solicitudes demoradas.');
    var sect = Object.keys(c.porSector).map(function (k) { return c.porSector[k]; }).sort(function (a, b) { return b.total - a.total; });
    $('sg-sectores').innerHTML = tabla([{ t: 'Sector' }, { t: 'Solicitudes', n: true }, { t: 'Abiertas', n: true }, { t: 'Demoradas', n: true }, { t: 'Entregadas', n: true }, { t: 'Días', n: true }],
      sect.map(function (x) { return { c: [esc(x.sector), String(x.total), String(x.abiertas), x.demoradas ? '<b style="color:var(--danger)">' + x.demoradas + '</b>' : '0', String(x.entregadas), fmtDias(prom(x.dias))] }; }), 'Sin solicitudes en el período.');
    var provs = Object.keys(c.porProv).map(function (k) { return c.porProv[k]; }).sort(function (a, b) { return b.ocs - a.ocs; }).slice(0, 15);
    $('sg-proveedores').innerHTML = tabla([{ t: 'Proveedor' }, { t: 'Órdenes', n: true }, { t: 'Entregadas', n: true }, { t: 'A tiempo', n: true }, { t: 'Días', n: true }, { t: 'Con dif.', n: true }],
      provs.map(function (x) {
        return { c: [esc(G.proveedorNombre(x.id)), String(x.ocs), String(x.completas), x.conFecha ? Math.round(x.aTiempo / x.conFecha * 100) + '%' : '—', fmtDias(prom(x.dias)), x.difs ? '<b style="color:var(--danger)">' + x.difs + '</b>' : '0'] };
      }), 'Sin órdenes de compra del circuito en el período.');
    $('sg-sin-factura').innerHTML = tabla([{ t: 'OC' }, { t: 'Proveedor' }, { t: 'Recibido', n: true }, { t: 'Monto OC', n: true }],
      c.recSinFact.map(function (o) { var rc = ocRecepcion(o); return { attr: ' data-oc="' + esc(o.id) + '"', c: [G.ocNumeroLabel(o.numero), esc(G.proveedorNombre(o.proveedorId)), fmtFechaCorta(rc.fecha), G.fmtMoney(o.monto)] }; }), '✔ Todo lo recibido tiene factura.');
    $('sg-sin-recepcion').innerHTML = tabla([{ t: 'Factura' }, { t: 'Proveedor' }, { t: 'Fecha', n: true }, { t: 'Monto', n: true }, { t: 'OC' }],
      c.factSinRec.map(function (f) { var o = ocById(f.ocId); return { attr: ' data-oc="' + esc(o.id) + '"', c: [esc(f.numero), esc(G.proveedorNombre(f.proveedorId)), fmtFechaCorta(f.fecha), G.fmtMoney(f.monto), G.ocNumeroLabel(o.numero)] }; }), '✔ Todas las facturas con orden tienen su recepción.');
    $('sg-diferencias').innerHTML = tabla([{ t: 'N°' }, { t: 'Fecha' }, { t: 'Proveedor' }, { t: 'OC' }, { t: 'Remito' }, { t: 'Observaciones' }],
      c.difs.map(function (r) { var o = ocById(r.oc_id); return { attr: ' data-rec="' + esc(r.id) + '"', c: [recLabel(r), fmtFechaCorta(r.fecha), esc(G.proveedorNombre(r.proveedor_id)), o ? G.ocNumeroLabel(o.numero) : '—', esc(r.remito || '—'), esc(r.observaciones || '')] }; }), 'Sin diferencias en el período.');
    document.querySelectorAll('#view-solicitudes [data-sol]').forEach(function (tr) { tr.addEventListener('click', function () { abrirSol(tr.dataset.sol); }); });
    document.querySelectorAll('#view-solicitudes [data-oc]').forEach(function (tr) { tr.addEventListener('click', function () { G.irA('compras'); G.mostrarSubtab('compras', 'ocs'); G.abrirOC(tr.dataset.oc); }); });
    document.querySelectorAll('#view-solicitudes [data-rec]').forEach(function (tr) { tr.addEventListener('click', function () { abrirRec(tr.dataset.rec); }); });
  }

  // ---------------- Exportar en formato RG-0708 ----------------
  var RG_ESTADO = { pendiente: 'Pendiente', cotizando: 'Cotizando', rechazada: 'Rechazado' };
  function exportarRG() {
    var lista = filtradas().filter(vigente).sort(function (a, b) { return (a.numero || 0) - (b.numero || 0); });
    if (!lista.length) { toast('No hay solicitudes para exportar con estos filtros.'); return; }
    var cab = ['FECHA SOLICITUD', 'NRO SOLICITUD', 'SECTOR', 'INSUMO', 'CANTIDAD', 'PROVEEDOR', 'ESTADO', 'FECHA PEDIDO', 'FECHA ENTREGA', 'OBSERVACIONES', 'FACTURA ASOCIADA', 'MONTO FINAL'];
    var filas = [cab], ocVista = {};
    lista.forEach(function (s) {
      var dem = demora(s), est = estadoSol(s);
      itemsVig(s).forEach(function (it) {
        var inf = itemInfo(it), o = inf.oc;
        var e = est === 'rechazada' ? 'Rechazado' : inf.completo ? 'Entregado' : o ? (dem ? 'Demorado' : 'En Camino') : (dem ? 'Demorado' : RG_ESTADO[s.estado] || 'Pendiente');
        var facts = o ? facturasDeOC(o.id) : [];
        var monto = '';
        if (o && facts.length && !ocVista[o.id]) { ocVista[o.id] = true; monto = String(facts.reduce(function (t, f) { return t + (Number(f.monto) || 0); }, 0)).replace('.', ','); }
        filas.push([fmtFecha(s.fecha), String(s.numero), s.sector, it.descripcion, fmtCant(it.cantidad) + (it.unidad && it.unidad !== 'Unidad' ? ' ' + it.unidad : ''),
          G.proveedorNombre((o && o.proveedorId) || it.proveedor_id) === '—' ? '' : ((o && o.proveedorId) || it.proveedor_id ? G.proveedorNombre((o && o.proveedorId) || it.proveedor_id) : ''),
          e, o ? fmtFecha(o.fecha) : '', inf.fecha ? fmtFecha(inf.fecha) : '', [s.motivo, s.notas_compras].filter(Boolean).join(' · '),
          facts.map(function (f) { return f.numero; }).join(', '), monto]);
      });
    });
    var csv = '﻿' + filas.map(function (f) { return f.map(function (v) { v = String(v == null ? '' : v); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(';'); }).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = 'RG-0708 Seguimiento de compras ' + hoy() + '.csv';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  // ---------------- Render general ----------------
  function render() {
    if (S.f.mias === null && S.cargado) { S.f.mias = !esCompras(); $('sc-f-mias').checked = S.f.mias; }
    var sel = $('sc-f-sector');
    if (sel && sel.options.length !== sectoresUsados().length + 1) llenarSectores(sel, S.f.sector, true);
    renderLista();
    renderRecepciones();
    renderTablero();
    var cnt = function (sub, n) { var el = document.querySelector('#subtabs-solicitudes .stabbtn[data-sub="' + sub + '"] .cnt'); if (el) el.textContent = n ? '(' + n + ')' : ''; };
    cnt('solicitudes', S.sol.filter(function (s) { return ABIERTAS.indexOf(estadoSol(s)) !== -1; }).length);
    cnt('seguimiento', S.sol.filter(function (s) { return demora(s); }).length);
  }
  function mostrar() {
    render();
    cargar().then(render);
  }

  // ---------------- Eventos ----------------
  $('sc-nueva').addEventListener('click', function () { abrirSol(null); });
  $('sc-exportar').addEventListener('click', exportarRG);
  $('sc-buscar').addEventListener('input', function () { S.f.q = this.value; renderLista(); });
  $('sc-f-estado').addEventListener('change', function () { S.f.estado = this.value; renderLista(); });
  $('sc-f-sector').addEventListener('change', function () { S.f.sector = this.value; renderLista(); });
  $('sc-f-mias').addEventListener('change', function () { S.f.mias = this.checked; renderLista(); });
  $('sol-add').addEventListener('click', function () { S.editSol.items.forEach(function (it) { if (it.__leer) it.__leer(); }); S.editSol.items.push(nuevoItem()); renderItemsSol(); });
  $('sol-cancel').addEventListener('click', cerrarSol);
  $('sol-save').addEventListener('click', guardarSol);
  $('sol-generar-oc').addEventListener('click', generarOC);
  $('sol-anular').addEventListener('click', anularSol);
  $('sol-imprimir').addEventListener('click', imprimirSol);
  $('rc-nueva').addEventListener('click', function () { abrirRec(null); });
  $('rec-oc').addEventListener('change', cargarItemsRec);
  $('rec-cierra').addEventListener('change', resumenRec);
  $('rec-difs').addEventListener('change', function () { this.dataset.tocado = '1'; });
  $('rec-cancel').addEventListener('click', cerrarRec);
  $('rec-save').addEventListener('click', guardarRec);
  $('rec-anular').addEventListener('click', anularRec);
  $('sg-periodo').addEventListener('change', renderTablero);
  $('ocm-recibir').addEventListener('click', function () {
    var o = ocs().find(function (x) { return x.id === (($('ocm-recibir').dataset.oc) || ''); }) || null;
    if (!o) return;
    G.cerrarOC(); G.irA('solicitudes'); G.mostrarSubtab('solicitudes', 'recepciones');
    cargar().then(function () { abrirRec(null, o.id); });
  });

  // La vista se puede mostrar antes de que cargue este archivo (al entrar con
  // la sesión guardada): se dibuja apenas queda visible.
  var vista = $('view-solicitudes');
  if (window.MutationObserver) new MutationObserver(function () { if (!vista.hidden) mostrar(); }).observe(vista, { attributes: true, attributeFilter: ['hidden'] });
  if (!vista.hidden) setTimeout(mostrar, 0);

  window.SegCompras = {
    mostrar: mostrar, recargar: function () { return cargar(true); }, ocHint: ocHint,
    renderEnOC: function (o, vig) { $('ocm-recibir').dataset.oc = o ? o.id : ''; renderEnOC(o, vig); },
    abrirSolicitud: abrirSol, abrirRecepcion: abrirRec,
    // Para los Dashboards y Sifoncito
    resumen: function () { var c = calcular(90); return { abiertas: c.abiertas.length, demoradas: c.demoradas.length, entregadas90: c.entregadas.length, diasSolEntrega: c.diasSol, recSinFactura: c.recSinFact.length, factSinRecepcion: c.factSinRec.length, conDiferencias: c.difs.length }; }
  };
})();
