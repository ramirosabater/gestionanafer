/* =====================================================================
   Gestión Anafer — Módulo CALIDAD
   ---------------------------------------------------------------------
   Pasa a sistema dos hojas de la "TABLA DE CONTROLES DE CALIDAD":
     6 - Reclamos de PT  (RG-0802 Control de producto reclamado)
     9 - NC - PAC        (RG-0801 Seguimiento de no conformidades y PAC)
   y suma Indicadores. Tablas: calidad_reclamos, calidad_pac, calidad_listas
   (ver base-de-datos/calidad.sql).

   Usa lo que expone app.js en window.GestionAnafer (conexión, permisos,
   avisos, memoria del ayudante y Sifoncito). Los registros no se borran:
   se anulan con motivo, igual que los comprobantes.
   ===================================================================== */
(function () {
  'use strict';
  var G = window.GestionAnafer;
  if (!G) return;

  // ---------------- Listas (⚙ → Calidad) ----------------
  // Las opciones salen de la planilla. Los nombres de personas (responsables
  // y controladores) no van en el código: se cargan en ⚙ o con la importación.
  var LISTAS = [
    { id: 'productos', nombre: 'Productos', para: 'Reclamos', def: ['Bx8Azul', 'Bx12Azul', 'Bx20Azul', 'Bx8Verde', 'Bx12Verde', 'Bx20Verde', 'Soda Descartable', 'Soda Retornable', 'Otro'] },
    { id: 'desvios', nombre: 'Desvío informado', para: 'Reclamos', def: ['Mal gusto', 'Otros', 'Pinchado', 'No pasó repartidor'] },
    { id: 'reclamos_cliente', nombre: 'Reclamo del cliente', para: 'Reclamos', def: ['MG: plastico', 'MG: cloro', 'MG: otro', 'EE: insecto', 'EE: precinto/tapa', 'EE: otro', 'Pierde por tapa', 'Pinchado'] },
    { id: 'desvios_reales', nombre: 'Desvío real', para: 'Reclamos', def: ['SIN GUSTO', 'MG: plastico', 'MG: cloro', 'MG: otro', 'EE: insecto', 'EE: precinto/tapa', 'EE: otro', 'Pierde por tapa', 'Pinchado'] },
    { id: 'envases', nombre: 'Proveedores de envase', para: 'Reclamos', def: ['Pedernera', 'Camillo', 'Poliformas', 'Anciplast'] },
    { id: 'tapas', nombre: 'Proveedores de tapa', para: 'Reclamos', def: ['PRIVA', 'SP Plasticos', 'Mastertap', 'Pedernera', 'sin dato/sin tapa'] },
    { id: 'destinos', nombre: 'Destino del envase', para: 'Reclamos', def: ['A la linea', 'Lavado manual', 'Para devolucion', 'Tirar', 'No aplica'] },
    { id: 'controladores', nombre: 'Controló', para: 'Reclamos', def: [] },
    { id: 'origenes', nombre: 'Origen', para: 'NC/PAC', def: ['AUDITORIA INTERNA', 'AUDITORIA EXTERNA/INSPECCIÓN', 'PROCESO (SGC)', 'RECLAMO DE CLIENTE', 'PROVEEDOR', 'PNC'] },
    { id: 'clasificaciones', nombre: 'Clasificación', para: 'NC/PAC', def: ['OPORTUNIDAD DE MEJORA', 'OBSERVACIÓN', 'NC MENOR', 'NC MAYOR'] },
    { id: 'procesos', nombre: 'Procesos', para: 'NC/PAC', def: ['DIRECCIÓN', 'CALIDAD', 'PRODUCCIÓN', 'SOPLADORA', 'MANTENIMIENTO', 'LOGISTICA/DEPOSITO', 'COMPRAS', 'ADMINISTRACIÓN', 'VENTAS/SUCURSALES', 'RRHH'] },
    { id: 'riesgos', nombre: 'Riesgo', para: 'NC/PAC', def: ['ALTO', 'MEDIO', 'BAJO'] },
    { id: 'opciones_riesgo', nombre: 'Opciones para abordar riesgos', para: 'NC/PAC', def: ['Cambiar la probabilidad o consecuencia', 'Eliminar el riesgo', 'Evitar el riesgo', 'Compartir o mantener el riesgo mediante decisiones informadas', 'Asumir el riesgo para perseguir una oportunidad'] },
    { id: 'responsables', nombre: 'Responsables', para: 'NC/PAC', def: [] },
  ];
  var ESTADOS_RECLAMO = ['Abierto', 'Cerrado justificado', 'Cerrado No justificado'];
  var ESTADOS_PAC = ['Abierta', 'En gestión', 'Cerrada'];
  var RESULTADOS_EFICACIA = ['', 'Efectiva', 'No efectiva', 'No aplica'];
  var MESES = G.MESES || ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var S = { reclamos: [], pacs: [], listas: {}, cargado: false, cargando: null, ultimaCarga: 0, sinTablas: false,
    editRec: null, editPac: null, pacDesdeReclamos: null, revisado: {} };

  var esc = G.esc, hoy = G.todayStr;
  function $(id) { return document.getElementById(id); }
  function sb() { return G.sb(); }
  function toast(m, ms) { G.showToast(m, ms); }
  function lista(id) {
    var l = S.listas[id];
    if (l && l.length) return l;
    var d = LISTAS.find(function (x) { return x.id === id; });
    return d ? d.def : [];
  }
  function anulado(x) { return !!(x && x.anulado_en); }
  function fmtFecha(d) { return d ? String(d).slice(0, 10).split('-').reverse().join('/') : '—'; }
  function codigoPac(p) { return (p.numero || 0) + '-' + String(p.anio || '').slice(-2); }
  function nuevoId(pref) { return pref + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function anioDe(f) { return f ? Number(String(f).slice(0, 4)) : new Date().getFullYear(); }
  function justificado(r) { return r.estado === 'Cerrado justificado'; }
  // En la planilla, el lote que no se lee figura como "BORROSO": no es un lote.
  function loteValido(l) { return !!l && !/borros|ilegible|^s\/?d$|sin dato|^-+$/i.test(String(l).trim()); }

  // ---------------- Datos ----------------
  function cargar(forzar) {
    if (!sb()) return Promise.resolve();
    if (S.cargando) return S.cargando;
    if (S.cargado && !forzar && Date.now() - S.ultimaCarga < 30000) return Promise.resolve();
    S.cargando = Promise.all([
      G.fetchAllRows('calidad_reclamos'),
      G.fetchAllRows('calidad_pac'),
      Promise.resolve(sb().from('calidad_listas').select('*')),
    ]).then(function (rs) {
      S.sinTablas = !!(rs[0].error || rs[1].error);
      if (!rs[0].error) S.reclamos = rs[0].data || [];
      if (!rs[1].error) S.pacs = (rs[1].data || []).map(function (p) { if (!Array.isArray(p.reclamo_ids)) p.reclamo_ids = []; return p; });
      if (!rs[2].error) { S.listas = {}; (rs[2].data || []).forEach(function (r) { if (Array.isArray(r.valores)) S.listas[r.id] = r.valores; }); }
      S.cargado = true; S.ultimaCarga = Date.now();
    }).catch(function (e) { console.error('Calidad: error cargando', e); }).then(function () { S.cargando = null; });
    return S.cargando;
  }
  var COLS_REC = ['id', 'numero', 'anio', 'fecha', 'hora', 'producto', 'lote', 'vencimiento', 'vencimiento_ilegible', 'desvio', 'reclamo_cliente', 'desvio_real', 'observaciones', 'envase', 'lote_envase', 'tapa', 'cantidad', 'destino_envase', 'estado', 'controlo', 'pac_id', 'creado_por', 'actualizado', 'anulado_en', 'anulado_por', 'motivo_anulacion'];
  var COLS_PAC = ['id', 'numero', 'anio', 'fecha', 'origen', 'clasificacion', 'proceso', 'hallazgo', 'riesgo', 'opcion_riesgo', 'causa', 'correccion', 'resp_correccion', 'fecha_correccion', 'accion', 'resp_accion', 'fecha_accion', 'resp_seguimiento', 'fecha_seguimiento', 'comentarios', 'eficacia_criterio', 'eficacia_resultado', 'resp_eficacia', 'fecha_eficacia', 'eficacia_detalle', 'estado', 'reclamo_ids', 'creado_por', 'actualizado', 'anulado_en', 'anulado_por', 'motivo_anulacion'];
  function soloCols(o, cols) { var r = {}; cols.forEach(function (c) { if (o[c] !== undefined) r[c] = (o[c] === '' && /^(fecha|vencimiento|anulado_en)/.test(c)) ? null : o[c]; }); return r; }
  function guardar(tabla, obj, cols, coleccion) {
    obj.actualizado = new Date().toISOString();
    var i = coleccion.findIndex(function (x) { return x.id === obj.id; });
    if (i >= 0) coleccion[i] = obj; else coleccion.push(obj);
    if (!sb()) { toast('Sin conexión: no se pudo guardar.'); return Promise.resolve(false); }
    return Promise.resolve(sb().from(tabla).upsert(soloCols(obj, cols))).then(function (res) {
      if (res && res.error) { toast('No se pudo guardar: ' + res.error.message + (/does not exist|relation/.test(res.error.message) ? ' (¿corriste calidad.sql?)' : ''), 7000); return false; }
      return true;
    });
  }
  function siguienteNumero(col, anio) {
    return col.reduce(function (m, x) { return Number(x.anio) === anio && Number(x.numero) > m ? Number(x.numero) : m; }, 0) + 1;
  }

  // ---------------- Helpers de formulario ----------------
  function llenarSelect(sel, opciones, valor, vacio) {
    var el = typeof sel === 'string' ? $(sel) : sel;
    var ops = opciones.slice();
    if (valor && ops.indexOf(valor) === -1) ops.push(valor); // un valor viejo que ya no está en la lista no se pierde
    el.innerHTML = (vacio != null ? '<option value="">' + esc(vacio) + '</option>' : '') +
      ops.map(function (o) { return '<option value="' + esc(o) + '">' + esc(o === '' ? '—' : o) + '</option>'; }).join('');
    el.value = valor || '';
  }
  function soloLectura(modalId, saveId, anularId, x, puede) {
    var modal = $(modalId);
    var ro = anulado(x) || !puede;
    Array.prototype.forEach.call(modal.querySelectorAll('input, select, textarea'), function (el) { el.disabled = ro; });
    $(saveId).style.display = ro ? 'none' : '';
    $(anularId).style.display = (x && !anulado(x) && puede) ? '' : 'none';
    var b = modal.querySelector('.anulado-banner');
    if (anulado(x)) {
      if (!b) { b = document.createElement('div'); b.className = 'anulado-banner'; modal.querySelector('.sub').insertAdjacentElement('afterend', b); }
      b.textContent = G.anulacionTexto({ anuladoEn: x.anulado_en, anuladoPor: x.anulado_por, motivoAnulacion: x.motivo_anulacion, __genero: modalId === 'reclamo-modal' ? 'o' : 'a' });
    } else if (b) b.remove();
  }
  function descargarCSV(nombre, encabezados, filas) {
    var q = function (t) { return '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"'; };
    var txt = [encabezados.map(q).join(';')].concat(filas.map(function (f) { return f.map(q).join(';'); })).join('\r\n');
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv;charset=utf-8' }));
    a.download = nombre; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function aniosDe(col) {
    var a = {}; a[new Date().getFullYear()] = true;
    col.forEach(function (x) { if (x.anio) a[x.anio] = true; });
    return Object.keys(a).map(Number).sort(function (x, y) { return y - x; });
  }
  function mensajeSinTablas(tbody, cols) {
    tbody.innerHTML = '<tr class="day-row empty"><td colspan="' + cols + '">' + (S.sinTablas ? 'Falta crear las tablas de Calidad: corré base-de-datos/calidad.sql en Supabase.' : 'Cargando…') + '</td></tr>';
  }

  // =====================================================================
  // RECLAMOS DE PRODUCTO TERMINADO
  // =====================================================================
  var F = { anio: null, mes: '', producto: '', desvio: '', estado: '', buscar: '' };
  function armarFiltrosReclamos() {
    var anios = aniosDe(S.reclamos);
    if (F.anio == null) F.anio = anios[0];
    llenarSelect('rq-f-anio', anios.map(String), String(F.anio));
    var m = $('rq-f-mes'); m.innerHTML = '<option value="">Todos los meses</option>' + MESES.map(function (x, i) { return '<option value="' + (i + 1) + '">' + x + '</option>'; }).join(''); m.value = F.mes;
    llenarSelect('rq-f-producto', lista('productos'), F.producto, 'Todos los productos');
    llenarSelect('rq-f-desvio', lista('desvios_reales'), F.desvio, 'Todo desvío real');
    var e = $('rq-f-estado'); e.innerHTML = '<option value="">Todos los estados</option>' + ESTADOS_RECLAMO.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '<option value="__anulados">Anulados</option>'; e.value = F.estado;
  }
  function reclamosFiltrados() {
    var b = F.buscar.trim().toLowerCase();
    return S.reclamos.filter(function (r) {
      if (Number(r.anio || anioDe(r.fecha)) !== Number(F.anio)) return false;
      if (F.estado === '__anulados') { if (!anulado(r)) return false; }
      else { if (anulado(r)) return false; if (F.estado && r.estado !== F.estado) return false; }
      if (F.mes && Number(String(r.fecha || '').slice(5, 7)) !== Number(F.mes)) return false;
      if (F.producto && r.producto !== F.producto) return false;
      if (F.desvio && r.desvio_real !== F.desvio) return false;
      if (b && [r.lote, r.lote_envase, r.envase, r.tapa, r.observaciones, r.reclamo_cliente, r.controlo, String(r.numero)].join(' ').toLowerCase().indexOf(b) === -1) return false;
      return true;
    }).sort(function (a, c) { return String(c.fecha || '').localeCompare(String(a.fecha || '')) || (c.numero || 0) - (a.numero || 0); });
  }
  function badgeReclamo(r) {
    if (anulado(r)) return '<span class="cal-badge anulado">Anulado</span>';
    var cls = r.estado === 'Cerrado justificado' ? 'just' : r.estado === 'Cerrado No justificado' ? 'nojust' : 'abierto';
    return '<span class="cal-badge ' + cls + '">' + esc(r.estado || 'Abierto') + '</span>';
  }
  function renderReclamos() {
    setTimeout(G.marcarFiltros, 0);
    var tb = $('rq-body');
    if (!S.cargado || S.sinTablas) { mensajeSinTablas(tb, 12); return; }
    var l = reclamosFiltrados();
    $('rq-count').textContent = '(' + l.length + ')';
    if (!l.length) { tb.innerHTML = '<tr class="day-row empty"><td colspan="12">No hay reclamos con esos filtros.</td></tr>'; return; }
    var MAX = 400;
    tb.innerHTML = l.slice(0, MAX).map(function (r) {
      return '<tr class="day-row' + (anulado(r) ? ' anulado' : '') + '" data-id="' + esc(r.id) + '">' +
        '<td class="num">' + esc(r.numero) + '</td><td class="num">' + fmtFecha(r.fecha) + '</td><td>' + esc(r.producto) + '</td><td class="num">' + esc(r.lote) + '</td>' +
        '<td class="num">' + (r.vencimiento_ilegible ? '<span class="fm-hint">borroso</span>' : fmtFecha(r.vencimiento)) + '</td>' +
        '<td>' + esc(r.reclamo_cliente) + '</td><td><b>' + esc(r.desvio_real) + '</b></td><td>' + esc(r.envase) + (r.lote_envase ? ' <span class="fm-hint">' + esc(r.lote_envase) + '</span>' : '') + '</td>' +
        '<td>' + esc(r.tapa) + '</td><td>' + esc(r.destino_envase) + '</td><td>' + badgeReclamo(r) + '</td><td>' + esc(r.controlo) + '</td></tr>';
    }).join('') + (l.length > MAX ? '<tr class="day-row empty"><td colspan="12">Se muestran los ' + MAX + ' más recientes de ' + l.length + '. Usá los filtros o el CSV para ver todo.</td></tr>' : '');
  }
  function abrirReclamo(id) {
    var r = id ? S.reclamos.find(function (x) { return x.id === id; }) : null;
    S.editRec = r ? r.id : null;
    $('rq-title').textContent = r ? 'Reclamo Nº ' + r.numero + ' / ' + r.anio : 'Nuevo reclamo';
    $('rq-sub').textContent = r ? ('Cargado por ' + (r.creado_por || '—')) : 'Control de producto reclamado (devolución) · se numera al guardar';
    var d = r || { fecha: hoy(), cantidad: 1, estado: 'Abierto' };
    $('rq-fecha').value = d.fecha || ''; $('rq-hora').value = d.hora || '';
    llenarSelect('rq-producto', lista('productos'), d.producto || '', 'Elegir producto');
    $('rq-lote').value = d.lote || ''; $('rq-venc').value = d.vencimiento || ''; $('rq-venc-ilegible').checked = !!d.vencimiento_ilegible;
    $('rq-cantidad').value = d.cantidad != null ? d.cantidad : 1;
    llenarSelect('rq-desvio', lista('desvios'), d.desvio || '', '—');
    llenarSelect('rq-cliente', lista('reclamos_cliente'), d.reclamo_cliente || '', '—');
    llenarSelect('rq-real', lista('desvios_reales'), d.desvio_real || '', 'Todavía no se controló');
    llenarSelect('rq-envase', lista('envases'), d.envase || '', '—');
    $('rq-lote-envase').value = d.lote_envase || '';
    llenarSelect('rq-tapa', lista('tapas'), d.tapa || '', '—');
    llenarSelect('rq-destino', lista('destinos'), d.destino_envase || '', '—');
    llenarSelect('rq-estado', ESTADOS_RECLAMO, d.estado || 'Abierto');
    llenarSelect('rq-controlo', lista('controladores'), d.controlo || '', '—');
    $('rq-obs').value = d.observaciones || '';
    var pac = r && r.pac_id ? S.pacs.find(function (p) { return p.id === r.pac_id; }) : null;
    $('rq-pac-link').innerHTML = pac ? 'Este reclamo está en la <a href="#" id="rq-ir-pac">NC/PAC ' + esc(codigoPac(pac)) + '</a>.' : '';
    if (pac) $('rq-ir-pac').addEventListener('click', function (e) { e.preventDefault(); cerrarReclamo(); G.irA('ncpac'); abrirPac(pac.id); });
    $('rq-venc').disabled = $('rq-venc-ilegible').checked;
    soloLectura('reclamo-modal', 'rq-save', 'rq-anular', r, G.canEdit('reclamos'));
    if (!anulado(r) && G.canEdit('reclamos')) $('rq-venc').disabled = $('rq-venc-ilegible').checked;
    $('reclamo-overlay').classList.add('show');
  }
  function cerrarReclamo() { $('reclamo-overlay').classList.remove('show'); S.editRec = null; G.cerrarSugerenciaSi('cal-rq'); }
  $('rq-venc-ilegible').addEventListener('change', function () { $('rq-venc').disabled = this.checked; if (this.checked) $('rq-venc').value = ''; });
  $('rq-cancel').addEventListener('click', cerrarReclamo);
  $('rq-nuevo').addEventListener('click', function () { abrirReclamo(null); });
  $('rq-body').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) abrirReclamo(tr.dataset.id); });
  $('rq-save').addEventListener('click', function () {
    var previo = S.editRec ? S.reclamos.find(function (x) { return x.id === S.editRec; }) : null;
    var fecha = $('rq-fecha').value, producto = $('rq-producto').value;
    if (!fecha) { toast('Poné la fecha del reclamo.'); return; }
    if (!producto) { toast('Elegí el producto.'); return; }
    var anio = anioDe(fecha);
    var r = Object.assign({}, previo || { id: nuevoId('rec'), creado_por: G.usuario(), anio: anio, numero: siguienteNumero(S.reclamos, anio) }, {
      fecha: fecha, hora: $('rq-hora').value, producto: producto, lote: $('rq-lote').value.trim(),
      vencimiento: $('rq-venc-ilegible').checked ? '' : $('rq-venc').value, vencimiento_ilegible: $('rq-venc-ilegible').checked,
      cantidad: Number($('rq-cantidad').value) || 1, desvio: $('rq-desvio').value, reclamo_cliente: $('rq-cliente').value,
      desvio_real: $('rq-real').value, envase: $('rq-envase').value, lote_envase: $('rq-lote-envase').value.trim(), tapa: $('rq-tapa').value,
      destino_envase: $('rq-destino').value, estado: $('rq-estado').value || 'Abierto', controlo: $('rq-controlo').value, observaciones: $('rq-obs').value.trim(),
    });
    if (previo && Number(previo.anio) !== anio) { r.anio = anio; r.numero = siguienteNumero(S.reclamos, anio); }
    if (r.estado !== 'Abierto' && !r.desvio_real) { toast('Para cerrar el reclamo cargá el desvío real que se comprobó.'); return; }
    guardar('calidad_reclamos', r, COLS_REC, S.reclamos).then(function (ok) {
      if (!ok) return;
      cerrarReclamo();
      if (F.anio !== anio) F.anio = anio;
      armarFiltrosReclamos(); renderReclamos();
      toast(previo ? 'Reclamo guardado.' : 'Reclamo Nº ' + r.numero + ' cargado.');
      if (!previo) revisarLoteRepetido(r);
    });
  });
  $('rq-anular').addEventListener('click', function () {
    var r = S.reclamos.find(function (x) { return x.id === S.editRec; });
    if (!r) return;
    G.pedirMotivo('Anular reclamo Nº ' + r.numero, r.producto + ' · lote ' + (r.lote || '—') + '. Queda registrado como anulado y no cuenta en los indicadores.', function (motivo) {
      var a = Object.assign({}, r, { anulado_en: new Date().toISOString(), anulado_por: G.usuario(), motivo_anulacion: motivo });
      guardar('calidad_reclamos', a, COLS_REC, S.reclamos).then(function (ok) { if (ok) { cerrarReclamo(); renderReclamos(); toast('Reclamo anulado.'); } });
    });
  });
  ['rq-f-anio', 'rq-f-mes', 'rq-f-producto', 'rq-f-desvio', 'rq-f-estado'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var k = { 'rq-f-anio': 'anio', 'rq-f-mes': 'mes', 'rq-f-producto': 'producto', 'rq-f-desvio': 'desvio', 'rq-f-estado': 'estado' }[id];
      F[k] = k === 'anio' ? Number(this.value) : this.value; renderReclamos();
    });
  });
  $('rq-f-buscar').addEventListener('input', function () { F.buscar = this.value; renderReclamos(); });
  $('rq-csv').addEventListener('click', function () {
    var l = reclamosFiltrados();
    descargarCSV('reclamos-PT-' + F.anio + '.csv', ['Nº', 'Mes', 'Fecha', 'Producto', 'Lote', 'Hora', 'Vto', 'Desvío', 'Reclamo de cliente', 'Desvío real', 'Observaciones', 'Envase', 'Lote de envase', 'Tapa', 'Cantidad', 'Destino de envase', 'Estado', 'Controló'],
      l.slice().reverse().map(function (r) {
        return [r.numero, r.fecha ? MESES[Number(r.fecha.slice(5, 7)) - 1] : '', fmtFecha(r.fecha), r.producto, r.lote, r.hora, r.vencimiento_ilegible ? 'BORROSO' : fmtFecha(r.vencimiento), r.desvio, r.reclamo_cliente,
          r.desvio_real, r.observaciones, r.envase, r.lote_envase, r.tapa, r.cantidad, r.destino_envase, anulado(r) ? 'ANULADO' : r.estado, r.controlo];
      }));
  });

  // =====================================================================
  // NC / PAC
  // =====================================================================
  var FP = { anio: null, estado: '__pendientes', clasif: '', proceso: '', origen: '', buscar: '' };
  function pacVencida(p) {
    if (anulado(p) || p.estado === 'Cerrada') return false;
    var h = hoy();
    return !!((p.fecha_accion && p.fecha_accion < h) || (p.fecha_correccion && p.fecha_correccion < h && !p.accion));
  }
  function eficaciaPendiente(p) {
    return !anulado(p) && p.estado !== 'Cerrada' && !p.eficacia_resultado && p.fecha_eficacia && p.fecha_eficacia <= hoy();
  }
  function armarFiltrosPac() {
    var anios = aniosDe(S.pacs);
    if (FP.anio == null) FP.anio = 0;
    var a = $('pq-f-anio'); a.innerHTML = '<option value="0">Todos los años</option>' + anios.map(function (x) { return '<option value="' + x + '">' + x + '</option>'; }).join(''); a.value = String(FP.anio);
    var e = $('pq-f-estado');
    e.innerHTML = '<option value="__pendientes">Pendientes (abiertas y en gestión)</option><option value="__vencidas">Con acción vencida</option><option value="">Todas</option>' +
      ESTADOS_PAC.map(function (x) { return '<option>' + esc(x) + '</option>'; }).join('') + '<option value="__anuladas">Anuladas</option>';
    e.value = FP.estado;
    llenarSelect('pq-f-clasif', lista('clasificaciones'), FP.clasif, 'Toda clasificación');
    llenarSelect('pq-f-proceso', lista('procesos'), FP.proceso, 'Todo proceso');
    llenarSelect('pq-f-origen', lista('origenes'), FP.origen, 'Todo origen');
  }
  function pacsFiltradas() {
    var b = FP.buscar.trim().toLowerCase();
    return S.pacs.filter(function (p) {
      if (FP.anio && Number(p.anio) !== Number(FP.anio)) return false;
      if (FP.estado === '__anuladas') { if (!anulado(p)) return false; }
      else {
        if (anulado(p)) return false;
        if (FP.estado === '__pendientes' && p.estado === 'Cerrada') return false;
        if (FP.estado === '__vencidas' && !pacVencida(p)) return false;
        if (FP.estado && FP.estado.indexOf('__') !== 0 && p.estado !== FP.estado) return false;
      }
      if (FP.clasif && p.clasificacion !== FP.clasif) return false;
      if (FP.proceso && p.proceso !== FP.proceso) return false;
      if (FP.origen && p.origen !== FP.origen) return false;
      if (b && [p.hallazgo, p.causa, p.correccion, p.accion, p.comentarios, codigoPac(p), p.resp_accion].join(' ').toLowerCase().indexOf(b) === -1) return false;
      return true;
    }).sort(function (a, c) { return (Number(c.anio) - Number(a.anio)) || (Number(c.numero) - Number(a.numero)); });
  }
  function badgePac(p) {
    if (anulado(p)) return '<span class="cal-badge anulado">Anulada</span>';
    var cls = p.estado === 'Cerrada' ? 'cerrada' : p.estado === 'En gestión' ? 'gestion' : 'abierto';
    return '<span class="cal-badge ' + cls + '">' + esc(p.estado || 'Abierta') + '</span>';
  }
  function renderPacs() {
    setTimeout(G.marcarFiltros, 0);
    var tb = $('pq-body');
    if (!S.cargado || S.sinTablas) { mensajeSinTablas(tb, 11); return; }
    var l = pacsFiltradas();
    $('pq-count').textContent = '(' + l.length + ')';
    if (!l.length) { tb.innerHTML = '<tr class="day-row empty"><td colspan="11">No hay NC/PAC con esos filtros.</td></tr>'; return; }
    tb.innerHTML = l.map(function (p) {
      var venc = pacVencida(p);
      var ef = p.eficacia_resultado ? esc(p.eficacia_resultado) : (eficaciaPendiente(p) ? '<span class="cal-vencida">Pendiente</span>' : '<span class="fm-hint">—</span>');
      return '<tr class="day-row' + (anulado(p) ? ' anulado' : '') + '" data-id="' + esc(p.id) + '">' +
        '<td class="num"><b>' + esc(codigoPac(p)) + '</b></td><td class="num">' + fmtFecha(p.fecha) + '</td><td>' + esc(p.origen) + '</td><td>' + esc(p.clasificacion) + '</td><td>' + esc(p.proceso) + '</td>' +
        '<td class="hallazgo" title="' + esc(p.hallazgo) + '">' + esc(p.hallazgo) + '</td>' +
        '<td>' + (p.riesgo ? '<span class="cal-badge ' + esc(String(p.riesgo).toLowerCase()) + '">' + esc(p.riesgo) + '</span>' : '') + '</td>' +
        '<td>' + esc(p.resp_accion) + '</td><td class="num' + (venc ? ' cal-vencida' : '') + '">' + fmtFecha(p.fecha_accion) + (venc ? ' ⚠' : '') + '</td>' +
        '<td>' + ef + '</td><td>' + badgePac(p) + '</td></tr>';
    }).join('');
  }
  var CAMPOS_PAC = { 'pq-fecha': 'fecha', 'pq-hallazgo': 'hallazgo', 'pq-causa': 'causa', 'pq-correccion': 'correccion', 'pq-fecha-c': 'fecha_correccion', 'pq-accion': 'accion',
    'pq-fecha-ac': 'fecha_accion', 'pq-fecha-seg': 'fecha_seguimiento', 'pq-comentarios': 'comentarios', 'pq-ef-criterio': 'eficacia_criterio', 'pq-fecha-ef': 'fecha_eficacia', 'pq-ef-detalle': 'eficacia_detalle' };
  var SELECTS_PAC = { 'pq-origen': ['origen', 'origenes'], 'pq-clasif': ['clasificacion', 'clasificaciones'], 'pq-proceso': ['proceso', 'procesos'], 'pq-riesgo': ['riesgo', 'riesgos'],
    'pq-opcion': ['opcion_riesgo', 'opciones_riesgo'], 'pq-resp-c': ['resp_correccion', 'responsables'], 'pq-resp-ac': ['resp_accion', 'responsables'],
    'pq-resp-seg': ['resp_seguimiento', 'responsables'], 'pq-resp-ef': ['resp_eficacia', 'responsables'] };
  function abrirPac(id, precarga) {
    var p = id ? S.pacs.find(function (x) { return x.id === id; }) : null;
    S.editPac = p ? p.id : null;
    if (!p) S.pacDesdeReclamos = precarga && precarga.reclamo_ids ? precarga.reclamo_ids.slice() : null;
    var d = p || Object.assign({ fecha: hoy(), estado: 'Abierta' }, precarga || {});
    $('pq-title').textContent = p ? 'NC / PAC ' + codigoPac(p) : 'Nueva NC / PAC';
    $('pq-sub').textContent = p ? ('RG-0801 · cargada por ' + (p.creado_por || '—')) : 'RG-0801 · se le asigna un número al guardar';
    Object.keys(CAMPOS_PAC).forEach(function (k) { $(k).value = d[CAMPOS_PAC[k]] || ''; });
    Object.keys(SELECTS_PAC).forEach(function (k) { llenarSelect(k, lista(SELECTS_PAC[k][1]), d[SELECTS_PAC[k][0]] || '', '—'); });
    llenarSelect('pq-ef-resultado', RESULTADOS_EFICACIA.slice(1), d.eficacia_resultado || '', 'Pendiente');
    llenarSelect('pq-estado', ESTADOS_PAC, d.estado || 'Abierta');
    var ids = (p ? p.reclamo_ids : S.pacDesdeReclamos) || [];
    $('pq-reclamos').textContent = ids.length ? 'Reclamos vinculados: ' + ids.map(function (rid) { var r = S.reclamos.find(function (x) { return x.id === rid; }); return r ? 'Nº ' + r.numero : ''; }).filter(Boolean).join(', ') : '';
    soloLectura('pac-modal', 'pq-save', 'pq-anular', p, G.canEdit('ncpac'));
    $('pq-imprimir').style.display = p ? '' : 'none';
    $('pac-overlay').classList.add('show');
  }
  function cerrarPac() { $('pac-overlay').classList.remove('show'); S.editPac = null; S.pacDesdeReclamos = null; }
  $('pq-cancel').addEventListener('click', cerrarPac);
  $('pq-nuevo').addEventListener('click', function () { abrirPac(null); });
  $('pq-body').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) abrirPac(tr.dataset.id); });
  $('pq-save').addEventListener('click', function () {
    var previo = S.editPac ? S.pacs.find(function (x) { return x.id === S.editPac; }) : null;
    var fecha = $('pq-fecha').value;
    if (!fecha) { toast('Poné la fecha.'); return; }
    if (!$('pq-hallazgo').value.trim()) { toast('Describí el hallazgo.'); return; }
    var anio = anioDe(fecha);
    var p = Object.assign({}, previo || { id: nuevoId('pac'), creado_por: G.usuario(), anio: anio, numero: siguienteNumero(S.pacs, anio), reclamo_ids: S.pacDesdeReclamos || [] });
    Object.keys(CAMPOS_PAC).forEach(function (k) { p[CAMPOS_PAC[k]] = $(k).value.trim(); });
    Object.keys(SELECTS_PAC).forEach(function (k) { p[SELECTS_PAC[k][0]] = $(k).value; });
    p.eficacia_resultado = $('pq-ef-resultado').value; p.estado = $('pq-estado').value || 'Abierta';
    if (previo && Number(previo.anio) !== anio) { p.anio = anio; p.numero = siguienteNumero(S.pacs, anio); }
    if (p.estado === 'Cerrada' && !p.eficacia_resultado) { toast('Antes de cerrarla, cargá el resultado de la verificación de eficacia (o "No aplica").', 6000); return; }
    var vinculados = previo ? [] : (S.pacDesdeReclamos || []);
    guardar('calidad_pac', p, COLS_PAC, S.pacs).then(function (ok) {
      if (!ok) return;
      vinculados.forEach(function (rid) {
        var r = S.reclamos.find(function (x) { return x.id === rid; });
        if (r) guardar('calidad_reclamos', Object.assign({}, r, { pac_id: p.id }), COLS_REC, S.reclamos);
      });
      cerrarPac(); armarFiltrosPac(); renderPacs();
      toast(previo ? 'NC / PAC guardada.' : 'NC / PAC ' + codigoPac(p) + ' creada.');
    });
  });
  $('pq-anular').addEventListener('click', function () {
    var p = S.pacs.find(function (x) { return x.id === S.editPac; });
    if (!p) return;
    G.pedirMotivo('Anular NC / PAC ' + codigoPac(p), 'Queda registrada como anulada y su número no se vuelve a usar.', function (motivo) {
      var a = Object.assign({}, p, { anulado_en: new Date().toISOString(), anulado_por: G.usuario(), motivo_anulacion: motivo });
      guardar('calidad_pac', a, COLS_PAC, S.pacs).then(function (ok) { if (ok) { cerrarPac(); renderPacs(); toast('NC / PAC anulada.'); } });
    });
  });
  $('pq-imprimir').addEventListener('click', function () {
    var p = S.pacs.find(function (x) { return x.id === S.editPac; });
    if (p) imprimirPac(p);
  });
  ['pq-f-anio', 'pq-f-estado', 'pq-f-clasif', 'pq-f-proceso', 'pq-f-origen'].forEach(function (id) {
    $(id).addEventListener('change', function () {
      var k = { 'pq-f-anio': 'anio', 'pq-f-estado': 'estado', 'pq-f-clasif': 'clasif', 'pq-f-proceso': 'proceso', 'pq-f-origen': 'origen' }[id];
      FP[k] = k === 'anio' ? Number(this.value) : this.value; renderPacs();
    });
  });
  $('pq-f-buscar').addEventListener('input', function () { FP.buscar = this.value; renderPacs(); });
  $('pq-csv').addEventListener('click', function () {
    var l = pacsFiltradas();
    descargarCSV('nc-pac.csv', ['nº', 'Fecha', 'Año', 'Mes', 'Origen', 'Clasificación', 'Proceso', 'Hallazgo', 'Riesgo', 'Opciones para abordar riesgos', 'Causa', 'Corrección', 'Responsable C', 'Fecha límite C',
      'Acción correctiva / de mejora', 'Responsable AC', 'Fecha límite AC', 'Responsable seguimiento', 'Fecha seguimiento AC', 'Comentarios', 'Criterio de eficacia', 'Verificación de eficacia', 'Responsable eficacia', 'Fecha eficacia', 'Detalles eficacia', 'Estado'],
      l.slice().reverse().map(function (p) {
        return [codigoPac(p), fmtFecha(p.fecha), p.anio, p.fecha ? MESES[Number(p.fecha.slice(5, 7)) - 1] : '', p.origen, p.clasificacion, p.proceso, p.hallazgo, p.riesgo, p.opcion_riesgo, p.causa, p.correccion, p.resp_correccion,
          fmtFecha(p.fecha_correccion), p.accion, p.resp_accion, fmtFecha(p.fecha_accion), p.resp_seguimiento, fmtFecha(p.fecha_seguimiento), p.comentarios, p.eficacia_criterio, p.eficacia_resultado || 'Pendiente', p.resp_eficacia,
          fmtFecha(p.fecha_eficacia), p.eficacia_detalle, anulado(p) ? 'ANULADA' : p.estado];
      }));
  });
  function imprimirPac(p) {
    var anul = anulado(p);
    var col = p.estado === 'Cerrada' ? '#16a34a' : p.estado === 'En gestión' ? '#2ba9e0' : '#d48f00';
    var texto = function (t) { return '<div class="texto">' + esc(t || '—') + '</div>'; };
    var vinc = (p.reclamo_ids || []).map(function (rid) { return S.reclamos.find(function (x) { return x.id === rid; }); }).filter(Boolean);
    G.imprimirDocumento({
      tipo: 'Seguimiento de NC / PAC', numero: codigoPac(p), fecha: p.fecha, codigo: 'RG-0801',
      estado: { texto: anul ? 'Anulada' : (p.estado || 'Abierta'), color: anul ? '#e1251b' : col },
      anulado: anul ? G.anulacionTexto({ anuladoEn: p.anulado_en, anuladoPor: p.anulado_por, motivoAnulacion: p.motivo_anulacion }) : null,
      bloques: [
        { titulo: '1 · Hallazgo', html: '<div class="cols">' + G.impKV([['Origen', p.origen], ['Clasificación', p.clasificacion]]) + G.impKV([['Proceso', p.proceso], ['Riesgo', p.riesgo]]) + '</div>' + texto(p.hallazgo) },
        { titulo: '2 · Riesgo y causa', html: G.impKV([['Opción para abordar el riesgo', p.opcion_riesgo], ['Causa', p.causa || '—']]) },
        { titulo: '3 · Corrección', html: texto(p.correccion) + G.impKV([['Responsable', p.resp_correccion], ['Fecha límite', G.impFecha(p.fecha_correccion)]]) },
        { titulo: '4 · Acción correctiva / de mejora', html: texto(p.accion) + G.impKV([['Responsable', p.resp_accion], ['Fecha límite de implementación', G.impFecha(p.fecha_accion)]]) },
        { titulo: '5 · Seguimiento', html: G.impKV([['Responsable', p.resp_seguimiento], ['Fecha', G.impFecha(p.fecha_seguimiento)], ['Comentarios', p.comentarios || '—']]) },
        { titulo: '6 · Verificación de eficacia', html: G.impKV([['Criterio', p.eficacia_criterio || '—'], ['Resultado', p.eficacia_resultado || 'Pendiente'], ['Responsable', p.resp_eficacia], ['Fecha', G.impFecha(p.fecha_eficacia)], ['Detalles', p.eficacia_detalle || '—']]) },
        vinc.length ? { titulo: 'Reclamos vinculados', html: G.impTabla([{ t: 'Nº' }, { t: 'Fecha' }, { t: 'Producto' }, { t: 'Lote' }, { t: 'Desvío real' }],
          vinc.map(function (r) { return [String(r.numero), G.impFecha(r.fecha), esc(r.producto), esc(r.lote), esc(r.desvio_real)]; })) } : null,
      ],
      firmas: ['Responsable de la acción', 'Responsable del SGC', 'Verificó la eficacia'],
    });
  }

  // =====================================================================
  // INDICADORES — mismo estilo que los tableros de Comercial y RR.HH.
  // =====================================================================
  var OK = '#16a34a', MAL = '#e1251b', AMBAR = '#d48f00', GRIS = '#94a1ab';
  var PALETA = ['#223c7e', '#2ba9e0', '#e1251b', '#16a34a', '#d48f00', '#8b5cf6', '#3456a8', '#db2777', '#0d9488', '#94a1ab'];
  var MES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  var FD = { anio: null, desde: 1, hasta: 12, producto: '' };
  function armarFiltrosDash() {
    var anios = aniosDe(S.reclamos.concat(S.pacs));
    if (FD.anio == null) {
      FD.anio = anios[0];
      if (FD.anio === new Date().getFullYear()) FD.hasta = new Date().getMonth() + 1; // año en curso: hasta el mes actual
    }
    llenarSelect('cd-anio', anios.map(String), String(FD.anio));
    ['cd-desde', 'cd-hasta'].forEach(function (id) {
      var el = $(id);
      el.innerHTML = MESES.map(function (m, i) { return '<option value="' + (i + 1) + '">' + m.charAt(0).toUpperCase() + m.slice(1) + '</option>'; }).join('');
      el.value = String(id === 'cd-desde' ? FD.desde : FD.hasta);
    });
    llenarSelect('cd-producto', lista('productos'), FD.producto, 'Todos');
  }
  function enPeriodo(x) {
    if (anulado(x) || !x.fecha) return false;
    var m = Number(String(x.fecha).slice(5, 7));
    return Number(String(x.fecha).slice(0, 4)) === Number(FD.anio) && m >= FD.desde && m <= FD.hasta;
  }
  function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }
  function kpiCard(o) {
    return '<div class="cq-card cq-kpi" style="--c:' + o.c + '"><div class="top"><div class="ico">' + o.ico + '</div><div class="lab">' + o.lab + '</div></div>' +
      '<div class="val"' + (o.vc ? ' style="color:' + o.vc + '"' : '') + '>' + o.val + '</div>' + (o.sub ? '<div class="sub">' + o.sub + '</div>' : '') + (o.extra || '') + '</div>';
  }
  function tag(t, bien) {
    return '<span class="tag" style="background:' + (bien ? 'rgba(22,163,74,.12)' : 'rgba(225,37,27,.12)') + ';color:' + (bien ? OK : MAL) + '">' + t + '</span>';
  }
  function donutSVG(items, size, grosor) {
    var r = (size - grosor) / 2, C = 2 * Math.PI * r, tot = items.reduce(function (s, x) { return s + x.v; }, 0) || 1;
    var gap = items.filter(function (x) { return x.v > 0; }).length > 1 ? 2 : 0, off = 0, segs = '';
    items.forEach(function (x) {
      if (!(x.v > 0)) return;
      var len = x.v / tot * C, vis = Math.max(len - gap, 0.5);
      segs += '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + x.c + '" stroke-width="' + grosor + '" stroke-dasharray="' + vis + ' ' + (C - vis) + '" stroke-dashoffset="' + (-off) + '"><title>' + esc(x.t || '') + '</title></circle>';
      off += len;
    });
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="#eef1f4" stroke-width="' + grosor + '"/>' + segs + '</svg>';
  }
  // Dona con el total al centro y leyenda con cantidad y %. colores: {etiqueta: color} opcional.
  function dona(id, filas, centro, colores, max) {
    var el = $(id);
    var tot = filas.reduce(function (s, x) { return s + x.count; }, 0);
    if (!tot) { el.innerHTML = '<div class="cq-empty">Sin datos para el período.</div>'; return; }
    max = max || 7;
    var vis = filas.slice(0, max);
    if (filas.length > max) vis.push({ label: 'Otros', count: filas.slice(max).reduce(function (s, x) { return s + x.count; }, 0) });
    vis.forEach(function (x, i) { x.c = (colores && colores[x.label]) || (x.label === 'Otros' ? GRIS : PALETA[i % PALETA.length]); });
    el.innerHTML = '<div class="cq-donut-wrap"><div class="cq-donut">' +
      donutSVG(vis.map(function (x) { return { v: x.count, c: x.c, t: x.label + ': ' + x.count + ' (' + (x.count / tot * 100).toFixed(1) + '%)' }; }), 180, 28) +
      '<div class="center"><b>' + tot.toLocaleString('es-AR') + '</b><span>' + esc(centro) + '</span></div></div>' +
      '<div class="cq-dleg">' + vis.map(function (x) {
        return '<div class="r"><i style="background:' + x.c + '"></i><span style="color:var(--cq-ink)">' + esc(x.label) + '</span><b>' + x.count.toLocaleString('es-AR') + '</b><span>' + (x.count / tot * 100).toFixed(1) + '%</span></div>';
      }).join('') + '</div></div>';
  }
  // Ranking horizontal: cada fila {label, total, parte, sub}. Barra gris = total, de color = parte.
  function ranking(id, filas, color, valFn) {
    var el = $(id);
    if (!filas.length) { el.innerHTML = '<div class="cq-empty">Sin datos para el período.</div>'; return; }
    var max = Math.max.apply(null, filas.map(function (x) { return Math.max(x.total || 0, x.parte || 0); })) || 1;
    el.innerHTML = filas.map(function (x) {
      return '<div class="cq-hrow" title="' + esc(x.label + (x.sub ? '\n' + x.sub : '')) + '"><div class="hl">' + esc(x.label) + '</div>' +
        '<div class="cq-htrack">' + (x.total != null ? '<div class="b" style="width:' + (x.total / max * 100) + '%;background:#cfd6dd"></div>' : '') +
        '<div class="b" style="width:' + Math.max((x.parte || 0) / max * 100, x.parte ? 1.5 : 0) + '%;background:' + color + '"></div></div>' +
        '<div class="hv" style="color:' + color + '">' + (valFn ? valFn(x) : x.parte) + '</div>' + (x.sub ? '<div class="cq-hsub">' + esc(x.sub) + '</div>' : '') + '</div>';
    }).join('');
  }
  function agrupar(list, keyFn) {
    var o = {};
    list.forEach(function (x) { var k = keyFn(x); if (k == null || k === '') return; (o[k] = o[k] || []).push(x); });
    return o;
  }
  function renderDash() {
    if (!S.cargado) return;
    if (S.sinTablas) { $('cd-kpis').innerHTML = '<div class="cq-empty">Falta crear las tablas de Calidad: corré base-de-datos/calidad.sql en Supabase.</div>'; return; }
    var periodoTxt = (FD.desde === FD.hasta ? MESES[FD.desde - 1] : MESES[FD.desde - 1] + ' a ' + MESES[FD.hasta - 1]) + ' ' + FD.anio;
    $('cd-sub').textContent = (FD.producto || 'Todos los productos') + ' · ' + periodoTxt + ' · Reclamos de PT (RG-0802) y NC / PAC (RG-0801)';
    var rec = S.reclamos.filter(function (r) { return enPeriodo(r) && (!FD.producto || r.producto === FD.producto); });
    var just = rec.filter(justificado), nojust = rec.filter(function (r) { return r.estado === 'Cerrado No justificado'; }), abiertos = rec.filter(function (r) { return r.estado === 'Abierto'; });
    var cerrados = just.length + nojust.length;
    var unid = rec.reduce(function (t, r) { return t + (Number(r.cantidad) || 0); }, 0);

    // Variación del último mes con datos contra el anterior
    var porMes = [];
    for (var m = 1; m <= 12; m++) porMes.push(S.reclamos.filter(function (r) { return !anulado(r) && r.fecha && Number(r.fecha.slice(0, 4)) === Number(FD.anio) && Number(r.fecha.slice(5, 7)) === m && (!FD.producto || r.producto === FD.producto); }));
    var ult = -1; for (var i = FD.hasta - 1; i >= FD.desde - 1; i--) { if (porMes[i].length) { ult = i; break; } }
    var variacion = null, varTxt = 'Sin datos';
    if (ult > 0 && porMes[ult - 1].length) { variacion = (porMes[ult].length / porMes[ult - 1].length - 1) * 100; varTxt = MES_CORTO[ult] + ' vs ' + MES_CORTO[ult - 1]; }
    else if (ult >= 0) varTxt = 'Sin datos del mes anterior';
    var meses = ult >= 0 ? (ult - (FD.desde - 1) + 1) : 0;
    var desvioTop = G.tally(just, function (r) { return r.desvio_real; })[0];
    var lotesRep = Object.values(agrupar(just.filter(function (r) { return loteValido(r.lote); }), function (r) { return r.producto + '|' + r.lote; })).filter(function (g) { return g.length >= 2; }).length;

    $('cd-kpis').innerHTML = [
      kpiCard({ c: '#3456a8', ico: '📦', lab: 'Reclamos del período', val: rec.length.toLocaleString('es-AR'), sub: meses ? 'Promedio ' + Math.round(rec.length / meses) + ' por mes' : '' }),
      kpiCard({ c: MAL, ico: '🔎', lab: 'Justificados', val: cerrados ? pct(just.length, cerrados) + '%' : '—', vc: cerrados ? MAL : GRIS, sub: just.length + ' de ' + cerrados + ' cerrados' }),
      kpiCard({ c: OK, ico: '✅', lab: 'No justificados', val: cerrados ? pct(nojust.length, cerrados) + '%' : '—', vc: cerrados ? OK : GRIS, sub: 'El control no encontró el desvío' }),
      kpiCard({ c: AMBAR, ico: '⏳', lab: 'Abiertos', val: abiertos.length, vc: abiertos.length ? AMBAR : OK, sub: abiertos.length ? 'Sin cerrar todavía' : 'Todo cerrado', extra: abiertos.length ? '' : tag('Al día', true) }),
      kpiCard({ c: '#2ba9e0', ico: '🔁', lab: 'Variación vs mes anterior', val: variacion == null ? '—' : (variacion >= 0 ? '+' : '') + variacion.toFixed(0) + '%', vc: variacion == null ? GRIS : (variacion <= 0 ? OK : MAL), sub: varTxt }),
      kpiCard({ c: '#223c7e', ico: '🧴', lab: 'Unidades devueltas', val: unid.toLocaleString('es-AR'), sub: 'Envases reclamados' }),
      kpiCard({ c: '#8b5cf6', ico: '🧪', lab: 'Desvío más frecuente', val: desvioTop ? esc(desvioTop.label) : '—', sub: desvioTop ? desvioTop.count + ' justificados (' + pct(desvioTop.count, just.length) + '%)' : '' }),
      kpiCard({ c: '#db2777', ico: '🏷️', lab: 'Lotes con 2+ justificados', val: lotesRep, vc: lotesRep ? MAL : OK, sub: 'Ver el detalle más abajo' }),
    ].join('');
    $('cd-kpis').querySelector('.cq-kpi:nth-child(7) .val').style.fontSize = '20px';

    // Evolución mensual: barras apiladas justificado / no justificado / abierto
    var Hpx = 200, visM = [];
    for (var k = FD.desde - 1; k <= FD.hasta - 1; k++) visM.push(k);
    var maxV = Math.max.apply(null, visM.map(function (k) { return porMes[k].length; }).concat([1])) * 1.12;
    var ev = '<div class="cq-vchart" style="min-width:' + (visM.length * 42) + 'px">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) { ev += '<div class="cq-vgrid" style="bottom:' + (f * Hpx + 30) + 'px"></div>'; });
    ev += '<div class="cq-vcols">';
    visM.forEach(function (k) {
      var l = porMes[k], j = l.filter(justificado).length, n = l.filter(function (r) { return r.estado === 'Cerrado No justificado'; }).length, a = l.length - j - n;
      var h = l.length / maxV * Hpx;
      var seg = function (v, c) { return v ? '<div style="height:' + (v / l.length * h) + 'px;background:' + c + '"></div>' : ''; };
      ev += '<div class="cq-vcol" title="' + esc(MESES[k] + ' ' + FD.anio + '\nReclamos: ' + l.length + '\nJustificados: ' + j + '\nNo justificados: ' + n + '\nAbiertos: ' + a) + '"><div class="cq-vplot" style="height:' + Hpx + 'px">' +
        (l.length ? '<div class="cq-vlab" style="bottom:' + (h + 6) + 'px">' + l.length + '</div>' : '') +
        '<div class="cq-vstack" style="height:' + h + 'px">' + seg(j, MAL) + seg(n, OK) + seg(a, AMBAR) + '</div></div><div class="cq-vx">' + MES_CORTO[k] + '</div></div>';
    });
    ev += '</div></div>';
    $('cd-evol').innerHTML = rec.length ? ev : '<div class="cq-empty">Sin reclamos en el período.</div>';

    var colDesvio = { 'SIN GUSTO': OK, 'MG: plastico': MAL, 'MG: cloro': '#2ba9e0', 'MG: otro': AMBAR, 'EE: insecto': '#8b5cf6', 'EE: precinto/tapa': '#223c7e', 'EE: otro': '#3456a8' };
    dona('cd-dona-desvio', G.tally(rec.filter(function (r) { return r.desvio_real; }), function (r) { return r.desvio_real; }), 'reclamos controlados', colDesvio);
    dona('cd-dona-producto', G.tally(rec, function (r) { return r.producto; }), 'reclamos');

    // Reclamado vs confirmado
    var porCliente = agrupar(rec, function (r) { return r.reclamo_cliente; });
    ranking('cd-cliente', Object.keys(porCliente).map(function (kk) {
      var l = porCliente[kk], c = l.filter(justificado).length;
      return { label: kk, total: l.length, parte: c, sub: l.length + ' reclamados · ' + c + ' confirmados (' + pct(c, l.length) + '%)' };
    }).sort(function (a, b) { return b.total - a.total; }), MAL, function (x) { return pct(x.parte, x.total) + '%'; });

    function porProveedor(campo) {
      var g = agrupar(rec, function (r) { return r[campo]; });
      return Object.keys(g).map(function (kk) {
        var l = g[kk], j = l.filter(justificado).length;
        return { label: kk, total: l.length, parte: j, sub: j + ' justificados de ' + l.length + ' reclamos (' + pct(j, l.length) + '%)' };
      }).filter(function (x) { return x.total; }).sort(function (a, b) { return b.parte - a.parte || b.total - a.total; });
    }
    ranking('cd-envase', porProveedor('envase'), '#8b5cf6', function (x) { return x.parte; });
    ranking('cd-tapa', porProveedor('tapa'), AMBAR, function (x) { return x.parte; });

    // Lotes repetidos
    var gl = agrupar(just.filter(function (r) { return loteValido(r.lote); }), function (r) { return r.producto + '|' + r.lote; });
    var lotes = Object.keys(gl).map(function (kk) { return gl[kk]; }).filter(function (g) { return g.length >= 2; }).sort(function (a, b) { return b.length - a.length; }).slice(0, 15);
    var maxL = lotes.length ? lotes[0].length : 1;
    $('cd-lotes').innerHTML = lotes.length ? '<thead><tr><th>Producto</th><th>Lote</th><th class="num">Justificados</th><th>Desvío principal</th><th>Envases</th><th>Último</th><th>NC / PAC</th></tr></thead><tbody>' +
      lotes.map(function (g) {
        var d = G.tally(g, function (r) { return r.desvio_real; })[0], env = G.tally(g, function (r) { return r.envase; }).map(function (x) { return x.label; }).join(', ');
        var ultimo = g.reduce(function (m, r) { return r.fecha > m ? r.fecha : m; }, '');
        var pac = g.map(function (r) { return r.pac_id; }).filter(Boolean)[0];
        var p = pac && S.pacs.find(function (x) { return x.id === pac; });
        return '<tr><td><b>' + esc(g[0].producto) + '</b></td><td class="num">' + esc(g[0].lote) + '</td>' +
          '<td class="num"><div style="display:flex;align-items:center;gap:8px;justify-content:flex-end"><div style="width:70px;height:6px;border-radius:3px;background:var(--cq-track);overflow:hidden"><div style="height:100%;width:' + (g.length / maxL * 100) + '%;background:' + MAL + '"></div></div><b style="min-width:22px;color:' + MAL + '">' + g.length + '</b></div></td>' +
          '<td>' + esc(d ? d.label : '') + '</td><td>' + esc(env) + '</td><td class="num">' + fmtFecha(ultimo) + '</td>' +
          '<td>' + (p ? '<span class="cal-badge gestion">' + esc(codigoPac(p)) + '</span>' : '<span style="color:var(--cq-muted)">—</span>') + '</td></tr>';
      }).join('') + '</tbody>' : '<tbody><tr><td class="cq-empty">No hay lotes con 2 o más reclamos justificados en el período.</td></tr></tbody>';

    // ---- NC / PAC ----
    var pac = S.pacs.filter(enPeriodo);
    var pendTodas = S.pacs.filter(function (p) { return !anulado(p) && p.estado !== 'Cerrada'; });
    var vencidas = pendTodas.filter(pacVencida);
    var conEf = pac.filter(function (p) { return p.eficacia_resultado === 'Efectiva' || p.eficacia_resultado === 'No efectiva'; });
    var efectivas = conEf.filter(function (p) { return p.eficacia_resultado === 'Efectiva'; }).length;
    var cerradasP = pac.filter(function (p) { return p.estado === 'Cerrada'; }).length;
    $('cd-kpis-pac').innerHTML = [
      kpiCard({ c: '#3456a8', ico: '📋', lab: 'NC / PAC del período', val: pac.length, sub: pac.filter(function (p) { return /^NC/.test(p.clasificacion || ''); }).length + ' no conformidades' }),
      kpiCard({ c: OK, ico: '✔️', lab: 'Cerradas', val: pac.length ? pct(cerradasP, pac.length) + '%' : '—', vc: pac.length ? OK : GRIS, sub: cerradasP + ' de ' + pac.length }),
      kpiCard({ c: vencidas.length ? MAL : OK, ico: vencidas.length ? '⚠️' : '📅', lab: 'Con acción vencida', val: vencidas.length, vc: vencidas.length ? MAL : OK, sub: pendTodas.length + ' pendientes en total', extra: vencidas.length ? tag('Requiere seguimiento', false) : tag('Al día', true) }),
      kpiCard({ c: '#8b5cf6', ico: '🎯', lab: 'Eficacia verificada', val: conEf.length ? pct(efectivas, conEf.length) + '%' : '—', vc: conEf.length ? (efectivas === conEf.length ? OK : AMBAR) : GRIS, sub: conEf.length ? efectivas + ' efectivas de ' + conEf.length + ' verificadas' : 'Ninguna verificada en el período' }),
    ].join('');
    dona('cd-dona-estado', G.tally(pac, function (p) { return p.estado; }), 'NC / PAC', { 'Cerrada': OK, 'En gestión': '#2ba9e0', 'Abierta': AMBAR });
    ranking('cd-clasif', G.tally(pac, function (p) { return p.clasificacion; }).map(function (x) { return { label: x.label, parte: x.count }; }), MAL);
    ranking('cd-origen', G.tally(pac, function (p) { return p.origen; }).map(function (x) { return { label: x.label, parte: x.count }; }), '#2ba9e0');
    var gp = agrupar(pac, function (p) { return p.proceso; });
    ranking('cd-proceso', Object.keys(gp).map(function (kk) {
      var l = gp[kk], pe = l.filter(function (p) { return p.estado !== 'Cerrada'; }).length;
      return { label: kk, total: l.length, parte: pe, sub: l.length + ' en total · ' + pe + ' pendientes' };
    }).sort(function (a, b) { return b.total - a.total; }), AMBAR, function (x) { return x.parte + ' / ' + x.total; });
    var hoyS = hoy();
    $('cd-vencidas').innerHTML = vencidas.length ? '<thead><tr><th>Nº</th><th>Hallazgo</th><th>Responsable</th><th class="num">Venció</th><th class="num">Atraso</th></tr></thead><tbody>' +
      vencidas.sort(function (a, b) { return String(a.fecha_accion || a.fecha_correccion).localeCompare(String(b.fecha_accion || b.fecha_correccion)); }).map(function (p) {
        var f = p.fecha_accion || p.fecha_correccion;
        return '<tr class="link" data-pac="' + esc(p.id) + '"><td><b>' + esc(codigoPac(p)) + '</b></td><td style="max-width:190px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="' + esc(p.hallazgo) + '">' + esc(p.hallazgo) + '</td>' +
          '<td>' + esc(p.resp_accion || p.resp_correccion || '—') + '</td><td class="num">' + fmtFecha(f) + '</td><td class="num" style="color:' + MAL + ';font-weight:800">' + G.difDias(f, hoyS) + ' días</td></tr>';
      }).join('') + '</tbody>' : '<tbody><tr><td class="cq-empty">No hay acciones vencidas. 👌</td></tr></tbody>';
  }
  $('cd-vencidas').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-pac]'); if (tr) abrirPac(tr.dataset.pac); });
  $('cd-anio').addEventListener('change', function () { FD.anio = Number(this.value); renderDash(); });
  $('cd-desde').addEventListener('change', function () { FD.desde = Number(this.value); if (FD.hasta < FD.desde) FD.hasta = FD.desde; armarFiltrosDash(); renderDash(); });
  $('cd-hasta').addEventListener('change', function () { FD.hasta = Number(this.value); if (FD.desde > FD.hasta) FD.desde = FD.hasta; armarFiltrosDash(); renderDash(); });
  $('cd-producto').addEventListener('change', function () { FD.producto = this.value; renderDash(); });
  $('cd-todo').addEventListener('click', function () { FD.desde = 1; FD.hasta = 12; armarFiltrosDash(); renderDash(); });

  // =====================================================================
  // ⚙ → Calidad → Listas
  // =====================================================================
  function renderListas() {
    var cont = $('cal-listas');
    cont.innerHTML = '<div class="fm-hint">Cargando…</div>';
    cargar().then(function () {
      if (S.sinTablas) { cont.innerHTML = '<div class="fm-hint">Falta crear las tablas de Calidad: corré base-de-datos/calidad.sql en Supabase.</div>'; return; }
      cont.innerHTML = '';
      LISTAS.forEach(function (L) {
        var box = document.createElement('div'); box.className = 'cal-lista'; box.dataset.lista = L.id;
        var valores = lista(L.id).slice();
        function pintar() {
          box.innerHTML = '<h4>' + esc(L.nombre) + ' <span style="font-weight:400;text-transform:none;">· ' + esc(L.para) + '</span></h4><div class="cal-chips">' +
            (valores.length ? valores.map(function (v, i) { return '<span class="cal-chip">' + esc(v) + '<button type="button" data-i="' + i + '" title="Sacar de la lista">✕</button></span>'; }).join('') : '<span class="fm-hint">Vacía</span>') +
            '</div><div class="addrow"><input type="text" maxlength="80" placeholder="Agregar…"><button class="btn" type="button">+</button></div>';
          box.querySelectorAll('.cal-chip button').forEach(function (b) { b.addEventListener('click', function () { valores.splice(Number(b.dataset.i), 1); guardarLista(L.id, valores); pintar(); }); });
          var inp = box.querySelector('input');
          function agregar() { var v = inp.value.trim(); if (!v) return; if (valores.indexOf(v) === -1) { valores.push(v); guardarLista(L.id, valores); } pintar(); box.querySelector('input').focus(); }
          box.querySelector('.addrow button').addEventListener('click', agregar);
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') agregar(); });
        }
        pintar();
        cont.appendChild(box);
      });
    });
  }
  function guardarLista(id, valores) {
    S.listas[id] = valores.slice();
    if (!sb()) return;
    Promise.resolve(sb().from('calidad_listas').upsert({ id: id, valores: valores })).then(function (res) { if (res && res.error) toast('No se pudo guardar la lista: ' + res.error.message); });
  }

  // =====================================================================
  // SIFONCITO: sugerencias de calidad
  // =====================================================================
  // a) Al cargar un reclamo: si el mismo lote (o el mismo lote de envase)
  //    ya junta 3 o más reclamos, propone abrir una NC/PAC con todo armado.
  function resumenDesvios(rs) {
    var t = G.tally(rs, function (r) { return r.desvio_real || r.reclamo_cliente || r.desvio; });
    return t.map(function (x) { return x.count + ' ' + x.label; }).join(', ');
  }
  function revisarLoteRepetido(r) {
    if (!G.canEdit('ncpac')) return;
    var vig = S.reclamos.filter(function (x) { return !anulado(x) && x.estado !== 'Cerrado No justificado'; });
    var grupos = [];
    if (loteValido(r.lote) && r.producto) grupos.push({ clave: 'cal-lote:' + r.producto + '|' + r.lote, que: 'el lote <b>' + esc(r.lote) + '</b> de <b>' + esc(r.producto) + '</b>',
      rs: vig.filter(function (x) { return x.producto === r.producto && x.lote === r.lote; }), origen: 'RECLAMO DE CLIENTE', proceso: 'PRODUCCIÓN',
      hall: 'Reclamos repetidos del lote ' + r.lote + ' de ' + r.producto });
    if (r.envase && loteValido(r.lote_envase)) grupos.push({ clave: 'cal-envase:' + r.envase + '|' + r.lote_envase, que: 'los envases de <b>' + esc(r.envase) + '</b> lote <b>' + esc(r.lote_envase) + '</b>',
      rs: vig.filter(function (x) { return x.envase === r.envase && x.lote_envase === r.lote_envase; }), origen: 'PROVEEDOR', proceso: 'COMPRAS',
      hall: 'Reclamos repetidos con envases de ' + r.envase + ' lote ' + r.lote_envase });
    G.memListo().then(function () {
      var g = grupos.find(function (x) { return x.rs.length >= 3 && !x.rs.some(function (y) { return y.pac_id; }) && G.memPuede(x.clave); });
      if (!g) return;
      var detalle = resumenDesvios(g.rs);
      G.sugerir(G.conMemoria({ id: 'cal-rq:' + g.clave, titulo: 'Sifoncito: esto se repite',
        texto: 'Ya van <b>' + g.rs.length + ' reclamos</b> con ' + g.que + ' (' + esc(detalle) + '). ¿Abrís una NC / PAC para investigarlo? Te la dejo armada.',
        textoNunca: 'No para este lote',
        botones: [{ texto: 'Abrir NC / PAC', pri: true, accion: function () {
          abrirPac(null, { origen: g.origen, clasificacion: 'NC MENOR', proceso: g.proceso, riesgo: 'MEDIO',
            hallazgo: g.hall + ': ' + g.rs.length + ' reclamos (Nº ' + g.rs.map(function (x) { return x.numero; }).join(', ') + '). Desvíos: ' + detalle + '.',
            reclamo_ids: g.rs.map(function (x) { return x.id; }) });
        } }] }, g.clave, 14));
    });
  }
  // b) Al entrar a NC/PAC: acciones vencidas y eficacia sin verificar.
  function revisarPacsPendientes() {
    if (S.revisado.pac) return;
    S.revisado.pac = true;
    G.memListo().then(function () {
      if (!G.memPuede('cal-pac-vencidas')) return;
      var vencidas = S.pacs.filter(pacVencida), efic = S.pacs.filter(function (p) { return eficaciaPendiente(p) && !pacVencida(p); });
      if (!vencidas.length && !efic.length) return;
      var ul = document.createElement('ul'); ul.className = 'sug-lista';
      vencidas.concat(efic).slice(0, 8).forEach(function (p) {
        var li = document.createElement('li');
        var v = pacVencida(p);
        li.innerHTML = '<span><b>' + esc(codigoPac(p)) + '</b> · ' + esc(String(p.hallazgo || '').slice(0, 70)) + '<small>' +
          (v ? 'Acción vencida el ' + fmtFecha(p.fecha_accion || p.fecha_correccion) + ' · ' + esc(p.resp_accion || p.resp_correccion || 'sin responsable') : 'Verificar eficacia (desde el ' + fmtFecha(p.fecha_eficacia) + ') · ' + esc(p.resp_eficacia || 'sin responsable')) +
          '</small></span><button type="button">Abrir</button>';
        li.querySelector('button').addEventListener('click', function () { window.AyudaAnafer.cerrarSugerencia(); abrirPac(p.id); });
        ul.appendChild(li);
      });
      var partes = [];
      if (vencidas.length) partes.push('<b>' + vencidas.length + '</b> con la acción vencida');
      if (efic.length) partes.push('<b>' + efic.length + '</b> esperando la verificación de eficacia');
      G.sugerir(G.conMemoria({ id: 'cal-pac-vencidas', titulo: 'Sifoncito: NC / PAC pendientes', texto: 'Hay ' + partes.join(' y ') + ':', cuerpo: ul,
        textoAhoraNo: 'Mañana me recordás', textoNunca: 'No me avises más de esto' }, 'cal-pac-vencidas', 1));
    });
  }
  // c) Al entrar a Reclamos: los que siguen abiertos hace más de una semana.
  function revisarReclamosAbiertos() {
    if (S.revisado.rec) return;
    S.revisado.rec = true;
    G.memListo().then(function () {
      if (!G.memPuede('cal-rq-abiertos')) return;
      var limite = G.sumarDias(hoy(), -7);
      var ab = S.reclamos.filter(function (r) { return !anulado(r) && r.estado === 'Abierto' && r.fecha && r.fecha <= limite; });
      if (!ab.length) return;
      G.sugerir(G.conMemoria({ id: 'cal-rq-abiertos', titulo: 'Sifoncito: reclamos sin cerrar',
        texto: 'Hay <b>' + ab.length + ' reclamo' + (ab.length > 1 ? 's' : '') + '</b> abierto' + (ab.length > 1 ? 's' : '') + ' hace más de una semana (el más viejo, Nº ' + ab.sort(function (a, b) { return a.fecha.localeCompare(b.fecha); })[0].numero + ' del ' + fmtFecha(ab[0].fecha) + '). ¿Los vemos?',
        textoAhoraNo: 'Mañana me recordás', textoNunca: 'No me avises más de esto',
        botones: [{ texto: 'Ver los abiertos', pri: true, accion: function () { F.estado = 'Abierto'; F.anio = Number(ab[0].anio || anioDe(ab[0].fecha)); F.mes = ''; armarFiltrosReclamos(); renderReclamos(); G.marcarFiltros(); } }] }, 'cal-rq-abiertos', 1));
    });
  }

  // ✕ Limpiar: vuelve a los filtros de entrada
  document.querySelectorAll('.fbar-limpiar[data-limpiar]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.limpiar === 'rq') { F = { anio: null, mes: '', producto: '', desvio: '', estado: '', buscar: '' }; $('rq-f-buscar').value = ''; armarFiltrosReclamos(); renderReclamos(); }
      if (b.dataset.limpiar === 'pq') { FP = { anio: null, estado: '__pendientes', clasif: '', proceso: '', origen: '', buscar: '' }; $('pq-f-buscar').value = ''; armarFiltrosPac(); renderPacs(); }
      G.marcarFiltros();
    });
  });

  // ---------------- Entrada a cada pestaña ----------------
  function mostrar(v) {
    if (v === 'reclamos') { if (!S.cargado) mensajeSinTablas($('rq-body'), 12); }
    if (v === 'ncpac') { if (!S.cargado) mensajeSinTablas($('pq-body'), 11); }
    cargar().then(function () {
      if (G.vista() !== v) return;
      if (v === 'reclamos') { armarFiltrosReclamos(); renderReclamos(); if (!S.sinTablas) revisarReclamosAbiertos(); }
      if (v === 'ncpac') { armarFiltrosPac(); renderPacs(); if (!S.sinTablas) revisarPacsPendientes(); }
      G.marcarFiltros();
      if (v === 'calidash') { armarFiltrosDash(); renderDash(); }
    });
  }

  window.Calidad = { mostrar: mostrar, renderListas: renderListas, abrirReclamo: abrirReclamo, abrirPac: abrirPac, recargar: function () { return cargar(true); } };
})();
