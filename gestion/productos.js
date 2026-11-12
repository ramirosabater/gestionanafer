// Nomenclatura de productos de Anafer (listado de noviembre 2026).
// [código, descripción, abreviatura nueva]. Las que no tienen abreviatura se
// muestran con su descripción. Para cambiar un producto, editar esta lista.
//
// En todo el sistema se muestra la abreviatura nueva y, al pasar el mouse por
// arriba, la descripción (para que la gente se acostumbre a la nomenclatura).
(function () {
  var LISTA = [["03", "SODA 1.500 CC.", "S1500"],
    ["04", "SIF.2.000 CC.", "S2000"],
    ["05", "SIF.1.750 CC MENOS SODIO", "S1750"],
    ["07", "AGUA MINERAL 1.500 CC.", "A1500"],
    ["08", "AGUA DE MESA 2.250 CC.", "A2250"],
    ["09", "ALQUILER RACK PORTABIDONES", "ALQR"],
    ["10", "AGUA 500 CC.", "A500"],
    ["102", "SEPARADORES DE MADERA", "SP"],
    ["103", "BUZO IVESS ANAFER", ""],
    ["104", "REMERA IVESS ANAFER", ""],
    ["105", "CAMPERA IVESS ANAFER", ""],
    ["106", "CAMISA IVESS ANAFER", ""],
    ["11", "AGUA GASIFICADA 500 CC", "A500CG"],
    ["114", "PROMO BIENV.REVENTA X12V", "BIENV X12"],
    ["115", "PROMO BIENV REVENTA X 20V", "BIENV X20V"],
    ["116", "PROMO 3X2 PACK AGUA 500", "PR AGUA500"],
    ["117", "PROMO 3X2 PACK AGUA 1500", "PR AG15000"],
    ["118", "PROMO 3X2PACK AGUA 2250", "PR AG2250"],
    ["12", "BIDON 8 L.", "B8A"],
    ["13", "BIDON 20 L.", "B20A"],
    ["14", "BIDON 12 L.", "B12A"],
    ["15", "SABORIZADA 1.500 CC.", "SB1500"],
    ["16", "SABORIZADA 500 CC", "SB500"],
    ["17", "AGUA SPORT 750cc", "AS750"],
    ["18", "PROMO AGUA SPORT 3+2", "PRAG750"],
    ["19", "VASOS X 100 U", "VA"],
    ["20", "DISPENSER", "DAN"],
    ["201", "2X12A + ENV + DISP", "PR1"],
    ["202", "2X12V + ENV + DISP", "PR2"],
    ["203", "2X20A + ENV + DISP", "PR3"],
    ["204", "2X20V + ENV + DISP", "PR4"],
    ["205", "1X12A ENV+CONTENIDO", "PR5"],
    ["206", "PROMO X VENCIMIENTO SAB1500", "PRSAB1500"],
    ["207", "PROMO SAB X1500 2X1", "PRSAB2X1"],
    ["208", "1X12V ENV+CONTENIDO", "PR6"],
    ["209", "1X20A ENV + CONTENIDO", "PR7"],
    ["21", "DISPENSER FC", "DFC"],
    ["210", "1X20V ENV + CONTENIDO", "PR8"],
    ["22", "PROMO SODA 2 LTS 6x5", "PRSO2LT"],
    ["23", "KIT SANEO", ""],
    ["24", "ALQUILER DISP F/c POR DIA", ""],
    ["26", "CAJONES", "C1500"],
    ["27", "ENVASE BIDON X 12 LITROS", "E12A"],
    ["28", "ENVASE BIDON X 20 LITROS", "E20A"],
    ["30", "NO ESTA", ""],
    ["300", "PRESTA ENVX20A", "P20A"],
    ["301", "PRESTA ENVX20V", "P20V"],
    ["302", "PRESTA ENVX12A", "P12A"],
    ["303", "PRESTA ENVX12V", "P12V"],
    ["304", "PRESTA ENV SIFONX1500", "PES1500"],
    ["305", "PRESTA DISP A/N", "PDAN"],
    ["306", "PRESTA CAJON", "PC1500"],
    ["307", "PRESTA RACK X 8LTS", "PRA8"],
    ["308", "PRESTA RACK X 20 LTS", "PRA20"],
    ["309", "PRESTA MODULO PLASTICO", "PMP"],
    ["31", "FLETE PALLET LAS HERAS", "FLHP"],
    ["310", "PRESTA EXHIBIDOR X 8LTS", "PE8"],
    ["311", "PRESTA RECARGA SIFON X1500", "PS1500"],
    ["312", "PRESTA DISP F/C", "PDFC"],
    ["313", "PRESTA ENVASE SIFON 650cc", "PES650"],
    ["314", "PRESTA CAJON SIFON 650cc", "PC650"],
    ["32", "VENTA MAQUINA FRIO CALOR", "VDFC"],
    ["33", "ENVASES SIFONES", "ES1500"],
    ["34", "FLETE LOS ANTIGUOS CHASIS", "FANCH"],
    ["35", "FLETE LOS ANTIGUOS CHASIS Y ACOPLADO", "FANC"],
    ["36", "CANILLAS DE DISPENSER", "CDISP"],
    ["37", "SERVICIO TECNICO / SANEO DE DISPENSER", ""],
    ["38", "SIFON 650 cc", "S650"],
    ["39", "ENVASE SIFON 650cc", "ES650"],
    ["40", "CAJON SIFON 650cc", "CS650"],
    ["41", "RACK PORTABIDONES X 12 U.", "R12"],
    ["42", "RACK PORTABIDONES X 20 U", "R20"],
    ["47", "BIDON DE 8 LTS VERDE", "B8V"],
    ["48", "BIDON DE 12 LTS VERDE", "B12V"],
    ["49", "ENVASE VERDE 12 LITROS", "E12V"],
    ["62", "FLETE BAREILLE X RACK", "FBAR"],
    ["63", "REPUESTOS MAQ F C", "REPMFC"],
    ["70", "ROLLO DE RECINETE", "RR"],
    ["71", "FLETE INCRO MANANTIALES / DIADEMA", "FMAN"],
    ["74", "intereses por mora", "IM"],
    ["75", "BIDON DE 20 LTS VERDE", "B20V"],
    ["76", "ENVASE DE 20 VERDE", "E20V"],
    ["81", "FLETE RACK BILBAO", "FBILR"],
    ["84", "CHEQUE RECHAZADO", "CHR"],
    ["85", "FLETE LAS HERAS COMPLETO", "FLHC"],
    ["88", "FLETE MINERA DON NICOLAS", "FMIN"],
    ["95", "FLETE SARMIENTO CHASIS", "FSARMCH"],
    ["96", "FLETE SARMIENTO CHASIS Y ACOPLADO", "FLSARMC"],
    ["98", "PALLET POR UNIDAD", "PLL"],
    ["99", "PORTA VASOS", "PV"],
    ["AIV", "AJUSTE PERCEPCION IVA", "API"],
    ["CA", "VENTA CAMION", "VC"],
    ["DIF", "BONIFICACION", "BF"],
    ["RCOM", "COMPRA REVENTA", "CR"],
    ["VTA", "VTA FABRICA", "VF"]];

  function norm(t) { return String(t == null ? '' : t).toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  var porAbrev = {}, porDesc = {}, porCodigo = {};
  LISTA.forEach(function (p) {
    var o = { codigo: p[0], descripcion: p[1], abreviatura: p[2] };
    if (o.abreviatura) porAbrev[norm(o.abreviatura)] = o;
    porDesc[norm(o.descripcion)] = o;
    porCodigo[norm(o.codigo)] = o;
  });

  // Abreviatura a partir de la descripción vieja (Comercial) o del código.
  function abreviatura(nombreOcodigo) {
    var k = norm(nombreOcodigo);
    var o = porAbrev[k] || porDesc[k] || porCodigo[k];
    return o && o.abreviatura ? o.abreviatura : '';
  }
  // Lo que se muestra: la abreviatura nueva o, si no tiene, el nombre tal cual.
  function mostrar(nombre) { return abreviatura(nombre) || String(nombre == null ? '' : nombre); }
  // Descripción para el cartelito (de una abreviatura nueva o de una descripción vieja).
  function descripcion(nombre) {
    var k = norm(nombre), o = porAbrev[k] || porDesc[k];
    return o ? o.descripcion : '';
  }
  function tip(nombre) {
    var k = norm(nombre), o = porAbrev[k] || porDesc[k];
    return o ? o.descripcion + ' (cód. ' + o.codigo + ')' : '';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  // HTML del nombre con el cartelito de la descripción.
  function html(nombre) {
    var m = mostrar(nombre), t = tip(nombre);
    return t ? '<span class="prod-tip" title="' + esc(t) + '">' + esc(m) + '</span>' : esc(m);
  }

  // Cartelito automático: al pasar el mouse por cualquier texto que sea una
  // abreviatura de producto (ej. un chip "B20A × 12", una celda, una barra) se
  // muestra la descripción. En las listas desplegables, en cada opción.
  function candidato(texto) {
    var t = norm(texto);
    if (!t || t.length > 40) return null;
    if (porAbrev[t]) return t;
    var m = t.match(/^(.+?)\s*(?:[×X:]\s*[\d.,]+.*|\(\d+\))$/);
    if (m && porAbrev[m[1].trim()]) return m[1].trim();
    return null;
  }
  function marcar(el) {
    if (!el || el.nodeType !== 1 || el.dataset.prodTip) return false;
    if (/^(BODY|HTML|INPUT|TEXTAREA|SELECT|OPTION|SCRIPT|STYLE)$/.test(el.tagName)) return false;
    var k = candidato(el.textContent);
    if (!k) return false;
    var corto = k.length < 3;
    if (corto && !(el.closest && el.closest('.prod-tip,.day-cargo-chip,[data-producto]'))) return false;
    var t = tip(k);
    el.dataset.prodTip = '1';
    if (!el.title) el.title = t;
    else if (el.title.indexOf(t) === -1) el.title = t + '\n' + el.title;
    if (!el.classList.contains('prod-tip')) el.classList.add('prod-tip-auto');
    return true;
  }
  function opciones(sel) {
    if (!sel || sel.dataset.prodTips === String(sel.options.length)) return;
    Array.prototype.forEach.call(sel.options, function (o) { var t = tip(o.textContent.trim()); if (t && !o.title) o.title = t; });
    sel.dataset.prodTips = String(sel.options.length);
  }
  function alPasar(e) {
    var el = e.target;
    if (el && el.tagName === 'SELECT') { opciones(el); return; }
    for (var i = 0; el && i < 3; i++, el = el.parentElement) { if (marcar(el)) return; }
  }
  document.addEventListener('mouseover', alPasar, true);
  document.addEventListener('focusin', function (e) { if (e.target && e.target.tagName === 'SELECT') opciones(e.target); }, true);
  var css = document.createElement('style');
  css.textContent = '.prod-tip,.prod-tip-auto{cursor:help;text-decoration:underline dotted rgba(127,127,127,.6);text-underline-offset:2px;}';
  (document.head || document.documentElement).appendChild(css);

  window.ProductosAnafer = { lista: LISTA, abreviatura: abreviatura, mostrar: mostrar, descripcion: descripcion, tip: tip, html: html };
})();
