/* =====================================================================
   Ayuda de Gestión Anafer: "Sifoncito", un sifón de soda que muestra los
   circuitos del sistema paso a paso, vestido según el área:
   logística (casco y chaleco), administración (anteojos y calculadora),
   comercial (corbata y maletín) y RR.HH. (credencial y planilla).

   Se usa con <script src="ayuda.js" defer></script>. El área se toma de
   document.body.dataset.area (Gestión la actualiza al cambiar de área) o del
   atributo data-area del <script> (Comercial, RR.HH.).
   Cada paso puede:  ir: "selector"  → hace clic ahí antes (solo pestañas),
                     foco: "selector" o {texto:"…"} → lo marca en pantalla.
   Nunca guarda, borra ni cambia datos.
   ===================================================================== */
(function () {
  if (window.__ayudaAnafer) return;
  window.__ayudaAnafer = true;
  var scriptTag = document.currentScript;

  // ---------------- Circuitos por área ----------------
  var CIRCUITOS = {
    inicio: [
      { titulo: "Cómo moverse en el sistema", pasos: [
        { t: "¡Hola! Soy Sifoncito 🫧. Te voy a mostrar cómo se usa el sistema. Tocá <b>Siguiente</b>." },
        { t: "Acá elegís el área: Logística, Administración, Comercial o Recursos Humanos. Solo ves las que tu perfil tiene habilitadas.", foco: "#home-grid" },
        { t: "Desde cualquier área, <b>⌂ Inicio</b> te trae de vuelta a esta pantalla.", foco: "#home-btn" },
        { t: "El <b>⚙</b> abre la configuración: listas, perfiles y usuarios (si tu perfil lo permite).", foco: "#settings-btn" },
        { t: "Y <b>Salir</b> cierra tu sesión. ¡Cuando entres a un área, tocame de nuevo y te muestro sus circuitos!", foco: "#logout-btn" },
      ] },
    ],
    logistica: [
      { titulo: "Planificar los viajes de FlotaPesada", pasos: [
        { t: "La grilla de <b>FlotaPesada</b> tiene los días del mes en filas y las rutas en columnas. Arriba ves cuántos viajes lleva cada camión en el mes.", ir: "#tab-grid", foco: "#view-grid" },
        { t: "Con las flechas cambiás de mes y <b>Hoy</b> te vuelve al mes actual.", foco: "#today-btn" },
        { t: "Tocá una celda para cargar el viaje: camión, chofer, ayudante y carga. Los números punteados son <b>sugerencias del historial</b>: tocalos para confirmarlos o cambiarlos." },
        { t: "<b>✨ Planificar automáticamente</b> confirma de una vez todas las sugerencias punteadas del mes y las guarda como viajes. No toca las rutas que ya tienen un camión cargado ese día, y nunca pone el mismo camión en dos rutas el mismo día.", foco: "#autoplan-btn" },
      ] },
      { titulo: "Visitas a sucursales, empresas y eventuales", pasos: [
        { t: "En <b>Sucursales</b> se planifican las visitas a cada sucursal, igual que la grilla de viajes.", ir: "#tab-branches", foco: "#view-branches" },
        { t: "También tiene <b>✨ Planificar automáticamente</b>, que confirma las visitas sugeridas del mes.", foco: "#branch-autoplan-btn" },
        { t: "<b>Empresas</b> y <b>Eventuales</b> funcionan igual, para los clientes empresa y los pedidos ocasionales.", foco: "#tab-company" },
      ] },
      { titulo: "Ver el día y el dashboard", pasos: [
        { t: "<b>Día</b> junta todo lo planificado para una fecha: viajes y visitas, con chofer y camión.", ir: "#tab-day", foco: "#view-day" },
        { t: "El <b>Dashboard</b> muestra cuántos viajes hizo cada camión, chofer y ruta en el período.", ir: "#tab-dashboard", foco: "#view-dashboard" },
      ] },
      { titulo: "Configurar la flota", pasos: [
        { t: "En <b>⚙ → Flota y viajes</b> se cargan rutas, camiones (con su chofer y ayudante habitual), choferes, ayudantes y tipos de carga.", foco: "#settings-btn" },
        { t: "Los camiones que cargues ahí son los mismos que después aparecen como <b>móvil</b> al imputar gastos de flota en Administración." },
      ] },
    ],
    administracion: [
      { titulo: "Cargar una factura de proveedor", pasos: [
        { t: "Las facturas se cargan en <b>Pagos → Facturas</b>.", ir: ["#tab-pagos", '#subtabs-pagos .stabbtn[data-sub="facturas"]'], foco: "#new-factura-btn" },
        { t: "Con <b>+ Nueva factura</b> buscás el proveedor por nombre. Si tiene una imputación habitual, el centro de costo y el concepto se completan solos." },
        { t: "El <b>centro de costo</b> está agrupado por área. Si elegís uno de flota o de sucursales, te pide además el <b>móvil</b> o la <b>sucursal</b>." },
        { t: "Si una factura va a varias imputaciones, usá <b>Repartir esta factura</b> y cargá una línea por cada una." },
        { t: "<b>Neto gravado</b>: si lo dejás vacío se calcula solo (total ÷ 1,21 para Responsables Inscriptos). Es la base de la retención de Ganancias." },
        { t: "También podés <b>📄 Leer desde archivo</b> el PDF o la foto: completa los datos y vos los revisás antes de guardar." },
      ] },
      { titulo: "Pagar a proveedores", pasos: [
        { t: "Empezá por la <b>Sugerencia de pagos</b>: te dice qué pagar con la plata disponible.", ir: ["#tab-pagos", '#subtabs-pagos .stabbtn[data-sub="sugerencia"]'], foco: "#sug-box" },
        { t: "Arriba ves los saldos de cada cuenta y los cheques en cartera; lo ya comprometido en órdenes pendientes se resta. Podés cambiar el <b>monto a destinar</b>.", foco: "#sug-fondos" },
        { t: "Propone primero los proveedores ★ prioritarios y después las facturas más viejas. Tildá o destildá lo que quieras.", foco: "#sug-tbody" },
        { t: "<b>Crear órdenes de pago</b> arma una orden pendiente por proveedor.", foco: "#sug-crear" },
        { t: "En <b>Órdenes de pago</b> abrís cada una, elegís <b>Pagada</b>, el concepto (TR1, CHE, ECS…) y la cuenta.", ir: '#subtabs-pagos .stabbtn[data-sub="ordenes"]', foco: "#pagos-table" },
        { t: "Al marcarla Pagada se calcula sola la <b>retención de Ganancias</b>: ves el detalle y el <b>neto a pagar</b>. En Tesorería sale el neto y queda el certificado para imprimir." },
      ] },
      { titulo: "Retenciones del mes", pasos: [
        { t: "En <b>Pagos → Retenciones</b> están todas las retenciones practicadas del mes.", ir: ["#tab-pagos", '#subtabs-pagos .stabbtn[data-sub="retenciones"]'], foco: "#ret-table" },
        { t: "Elegí el mes acá.", foco: "#ret-mes" },
        { t: "Con 🖨 reimprimís cualquier certificado, y <b>Descargar CSV</b> te da el listado para el contador o para presentar.", foco: "#ret-csv" },
        { t: "Alícuotas, mínimos y datos del agente se cambian en <b>⚙ → Tesorería → Retenciones</b>.", foco: "#settings-btn" },
      ] },
      { titulo: "Proveedores y órdenes de compra", pasos: [
        { t: "En <b>Compras → Proveedores</b> buscás por nombre, CUIT o código.", ir: ["#tab-compras", '#subtabs-compras .stabbtn[data-sub="proveedores"]'], foco: "#proveedores-search" },
        { t: "En la ficha del proveedor se define la <b>condición en Ganancias</b> y el <b>régimen</b> (si no, salen del IVA y del rubro), si es <b>★ prioritario</b> y sus imputaciones habituales.", foco: "#new-proveedor-btn" },
        { t: "En <b>Órdenes de compra</b> registrás lo que se pide; después la factura se puede asociar a la orden.", ir: '#subtabs-compras .stabbtn[data-sub="ocs"]', foco: "#new-oc-btn" },
      ] },
      { titulo: "Caja, bancos y cheques", pasos: [
        { t: "En <b>Tesorería → Cuentas</b> ves el saldo de cada caja y banco.", ir: ["#tab-tesoreria", '#subtabs-tesoreria .stabbtn[data-sub="cuentas"]'], foco: "#cuentas-table" },
        { t: "En <b>Movimientos</b> cargás entradas y salidas con su concepto de caja (CAN, TR1, CHE…).", ir: '#subtabs-tesoreria .stabbtn[data-sub="movimientos"]', foco: "#new-entrada-btn" },
        { t: "Los pagos de órdenes de pago generan su salida solos; esos se corrigen desde la orden, no desde acá." },
        { t: "En <b>Cartera de cheques</b> están los cheques de terceros: tocá uno para depositarlo o marcarlo rechazado. Los que están en fecha dicen AL COBRO.", ir: '#subtabs-tesoreria .stabbtn[data-sub="cheques"]', foco: "#cheques-table" },
      ] },
    ],
    comercial: [
      { titulo: "Leer el tablero comercial", pasos: [
        { t: "Arriba elegís qué mirar: <b>$ Facturación</b> o <b>Unidades</b>.", foco: "#medida" },
        { t: "Filtrás por <b>unidad de negocio</b>, <b>año</b> y rango de meses.", foco: "#unidad" },
        { t: "Los indicadores resumen el período y el cumplimiento contra el presupuesto.", foco: "#kpis" },
        { t: "Más abajo: evolución mensual, participación por unidad, cumplimiento, altas y bajas, top productos y principales clientes.", foco: "#evol" },
      ] },
      { titulo: "Cargar los datos del mes", pasos: [
        { t: "<b>📄 Cargar facturación del mes</b>: subís el archivo Facturación_&lt;Mes&gt;_&lt;Año&gt; del sistema.", foco: "#factImport" },
        { t: "<b>📊 Cargar presupuesto</b>: la planilla de cumplimiento con las filas PRESUPUESTADO del año.", foco: "#presuImport" },
        { t: "Las altas y bajas de clientes y la lista de clientes se importan desde el botón de su propio cuadro.", foco: "#abImport" },
      ] },
    ],
    rrhh: [
      { titulo: "Presentismo del día", pasos: [
        { t: "En <b>Inicio → En vivo</b> ves quién está fichado ahora, agrupado por sector, y desde qué hora.", foco: { texto: "En vivo" } },
        { t: "El <b>Dashboard</b> y los <b>Indicadores</b> resumen asistencia, llegadas tarde y horas.", foco: { texto: "Dashboard" } },
      ] },
      { titulo: "Corregir y aprobar fichadas", pasos: [
        { t: "En <b>Asistencia → Corrección de fichadas</b> buscás un empleado y corregís entradas o salidas.", foco: { texto: "Asistencia" } },
        { t: "En <b>Aprobaciones</b> autorizás fichadas fuera de zona u horario, y en <b>Ausencias</b> cargás licencias y faltas." },
        { t: "Si cambiaste un horario, usá <b>Recalcular estados</b> del mes para que se actualicen las llegadas tarde." },
      ] },
      { titulo: "Empleados y horarios", pasos: [
        { t: "En <b>Personal → Empleados</b> das de alta, editás datos, asignás horario, sector y ubicaciones, y reseteás el PIN.", foco: { texto: "Personal" } },
        { t: "Los horarios se arman en <b>Personal → Horarios</b>; las ubicaciones donde se puede fichar, en <b>Configuración → Ubicaciones</b>." },
      ] },
      { titulo: "Cómo fichan los empleados", pasos: [
        { t: "Los empleados fichan desde el celular en <b>anafergestion.netlify.app/fichaje/</b> con su legajo y PIN." },
        { t: "La primera vez conviene que agreguen la página a la pantalla de inicio. Si cambian de celular, aparece como dispositivo nuevo en <b>Reportes y control → Dispositivos</b>." },
      ] },
    ],
  };
  var NOMBRES = { inicio: "Inicio", logistica: "Logística", administracion: "Administración", comercial: "Comercial", rrhh: "Recursos Humanos" };

  // ---------------- El sifón ----------------
  var sifN = 0;
  function sifon(traje, tam) {
    var t = traje || "inicio";
    var u = "sif" + (++sifN); // ids únicos: un degradado dentro de algo oculto no se dibuja
    var accesorios = "";
    if (t === "logistica") accesorios =
      // chaleco reflectivo
      '<path d="M33 112 Q33 104 42 102 L50 102 L50 166 L36 166 Q33 166 33 160 Z" fill="#ff7a1a"/>' +
      '<path d="M87 112 Q87 104 78 102 L70 102 L70 166 L84 166 Q87 166 87 160 Z" fill="#ff7a1a"/>' +
      '<rect x="33" y="132" width="17" height="5" fill="#f4f7c4"/><rect x="70" y="132" width="17" height="5" fill="#f4f7c4"/>' +
      '<rect x="33" y="146" width="17" height="5" fill="#f4f7c4"/><rect x="70" y="146" width="17" height="5" fill="#f4f7c4"/>' +
      // casco
      '<path d="M38 22 Q60 -2 82 22 Z" fill="#ffc81e" stroke="#c99400" stroke-width="2"/><rect x="33" y="20" width="54" height="6" rx="3" fill="#ffc81e" stroke="#c99400" stroke-width="2"/><rect x="57" y="6" width="6" height="15" rx="2" fill="#e6b000"/>';
    if (t === "administracion") accesorios =
      // anteojos
      '<circle cx="50" cy="82" r="8" fill="none" stroke="#2b2b2b" stroke-width="2.5"/><circle cx="70" cy="82" r="8" fill="none" stroke="#2b2b2b" stroke-width="2.5"/><path d="M58 82 L62 82" stroke="#2b2b2b" stroke-width="2.5"/>' +
      // moño
      '<path d="M60 112 L49 106 L49 118 Z M60 112 L71 106 L71 118 Z" fill="#1472cc"/><circle cx="60" cy="112" r="3.2" fill="#0d4f91"/>' +
      // calculadora en la mano
      '<g transform="translate(92 120) rotate(8)"><rect x="0" y="0" width="20" height="26" rx="3" fill="#3a3f47"/><rect x="3" y="3" width="14" height="6" rx="1" fill="#b8e0b0"/>' +
      '<g fill="#d7dbe0"><rect x="3" y="12" width="4" height="3"/><rect x="8" y="12" width="4" height="3"/><rect x="13" y="12" width="4" height="3"/><rect x="3" y="17" width="4" height="3"/><rect x="8" y="17" width="4" height="3"/><rect x="13" y="17" width="4" height="3" fill="#e1251b"/></g></g>';
    if (t === "comercial") accesorios =
      // corbata
      '<path d="M55 106 L65 106 L63 114 L67 150 L60 159 L53 150 L57 114 Z" fill="#e1251b" stroke="#a5140c" stroke-width="1"/>' +
      '<path d="M48 103 L60 110 L72 103" fill="none" stroke="#fff" stroke-width="3.5" stroke-linejoin="round"/>' +
      // maletín
      '<g transform="translate(90 132)"><rect x="0" y="6" width="26" height="20" rx="3" fill="#7a4a24" stroke="#4e2f15" stroke-width="1.5"/><path d="M8 6 V2 H18 V6" fill="none" stroke="#4e2f15" stroke-width="2"/><rect x="11" y="13" width="4" height="4" fill="#e8c35a"/></g>';
    if (t === "rrhh") accesorios =
      // credencial
      '<path d="M44 102 L60 130 L76 102" fill="none" stroke="#e1251b" stroke-width="2.5"/><rect x="51" y="128" width="18" height="24" rx="3" fill="#fff" stroke="#9aa3ad" stroke-width="1.5"/>' +
      '<circle cx="60" cy="136" r="4" fill="#9aa3ad"/><rect x="54" y="143" width="12" height="2" fill="#9aa3ad"/><rect x="55" y="147" width="10" height="2" fill="#c9cfd5"/>' +
      // planilla
      '<g transform="translate(92 118) rotate(6)"><rect x="0" y="0" width="22" height="28" rx="2" fill="#f5e6c8" stroke="#a88b55" stroke-width="1.5"/><rect x="7" y="-3" width="8" height="5" rx="1" fill="#8d8f93"/>' +
      '<path d="M4 9 H18 M4 14 H18 M4 19 H14" stroke="#a88b55" stroke-width="1.5"/><path d="M4 23 l2 2 l4 -4" stroke="#16a34a" stroke-width="2" fill="none"/></g>';
    var saluda = !(t === "administracion" || t === "comercial" || t === "rrhh");
    return '<svg class="sif-svg" viewBox="0 0 120 190" width="' + (tam || 110) + '" height="' + Math.round((tam || 110) * 190 / 120) + '" aria-hidden="true">' +
      '<defs><linearGradient id="' + u + 'M" x1="0" x2="1"><stop offset="0" stop-color="#8e969e"/><stop offset=".45" stop-color="#eef1f4"/><stop offset="1" stop-color="#7d858d"/></linearGradient>' +
      '<linearGradient id="' + u + 'V" x1="0" x2="1"><stop offset="0" stop-color="#7fc3dc"/><stop offset=".35" stop-color="#cdeef8"/><stop offset="1" stop-color="#5fa9c6"/></linearGradient></defs>' +
      // brazo izquierdo
      '<path d="M32 118 Q16 128 18 146" fill="none" stroke="#7d858d" stroke-width="5" stroke-linecap="round"/><circle cx="18" cy="148" r="6" fill="#eef1f4" stroke="#7d858d" stroke-width="2"/>' +
      // brazo derecho (saluda o sostiene)
      (saluda
        ? '<g class="sif-saludo"><path d="M88 118 Q104 106 104 90" fill="none" stroke="#7d858d" stroke-width="5" stroke-linecap="round"/><circle cx="104" cy="87" r="6" fill="#eef1f4" stroke="#7d858d" stroke-width="2"/></g>'
        : '<path d="M88 118 Q100 124 98 134" fill="none" stroke="#7d858d" stroke-width="5" stroke-linecap="round"/>') +
      // botella
      '<rect x="30" y="56" width="60" height="122" rx="22" fill="url(#' + u + 'V)" stroke="#3f7f99" stroke-width="2.5"/>' +
      '<rect x="36" y="64" width="7" height="96" rx="3.5" fill="#fff" opacity=".45"/>' +
      '<g class="sif-burbujas" fill="#fff" opacity=".8"><circle cx="72" cy="160" r="2.5"/><circle cx="64" cy="168" r="1.8"/><circle cx="78" cy="150" r="1.6"/></g>' +
      // cabeza metálica, pico y palanca
      '<path d="M86 34 Q104 30 108 22 L112 26 Q106 40 86 44 Z" fill="url(#' + u + 'M)" stroke="#5f666d" stroke-width="1.5"/>' +
      '<path d="M40 26 L80 26 L84 58 L36 58 Z" fill="url(#' + u + 'M)" stroke="#5f666d" stroke-width="2"/>' +
      '<path d="M30 40 L12 46 L14 52 L36 46 Z" fill="url(#' + u + 'M)" stroke="#5f666d" stroke-width="1.5"/>' +
      '<rect x="44" y="20" width="32" height="8" rx="3" fill="url(#' + u + 'M)" stroke="#5f666d" stroke-width="1.5"/>' +
      // cara
      '<circle cx="50" cy="82" r="4.2" fill="#1f2a33"/><circle cx="70" cy="82" r="4.2" fill="#1f2a33"/>' +
      '<circle cx="51.4" cy="80.6" r="1.3" fill="#fff"/><circle cx="71.4" cy="80.6" r="1.3" fill="#fff"/>' +
      '<circle cx="43" cy="91" r="4" fill="#f59ab0" opacity=".55"/><circle cx="77" cy="91" r="4" fill="#f59ab0" opacity=".55"/>' +
      '<path class="sif-boca" d="M52 92 Q60 100 68 92" fill="none" stroke="#1f2a33" stroke-width="2.6" stroke-linecap="round"/>' +
      accesorios + "</svg>";
  }

  // ---------------- Estilos ----------------
  var css = "" +
    ".ayuda-btn{position:fixed;right:18px;bottom:18px;z-index:9000;border:none;background:#fff;border-radius:999px;box-shadow:0 8px 24px -8px rgba(0,0,0,.35);padding:6px 14px 6px 6px;display:flex;align-items:center;gap:6px;cursor:pointer;font:600 13px system-ui,-apple-system,Segoe UI,sans-serif;color:#18160f}" +
    ".ayuda-btn .sif-svg{height:46px;width:auto}" +
    ".ayuda-btn:hover{transform:translateY(-1px)}" +
    ".ayuda-btn[hidden],.ayuda-panel[hidden]{display:none}" +
    ".ayuda-panel{position:fixed;right:18px;bottom:18px;z-index:9001;width:360px;max-width:calc(100vw - 32px);max-height:calc(100vh - 36px);overflow:auto;background:#fff;color:#18160f;border-radius:16px;box-shadow:0 18px 48px -12px rgba(0,0,0,.4);font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif}" +
    ".ayuda-top{display:flex;gap:10px;align-items:flex-end;padding:14px 14px 0}" +
    ".ayuda-top .sif-svg{flex:none;animation:sifFlota 4.5s ease-in-out infinite}" +
    ".ayuda-globo{position:relative;background:#f0eee6;border-radius:12px;padding:10px 12px;margin-bottom:26px;flex:1}" +
    ".ayuda-globo:after{content:'';position:absolute;left:-8px;bottom:14px;border:8px solid transparent;border-right-color:#f0eee6;border-left:0}" +
    ".ayuda-area{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#8d8877;font-weight:700;margin-bottom:2px}" +
    ".ayuda-x{position:absolute;top:8px;right:10px;border:none;background:none;font-size:18px;cursor:pointer;color:#8d8877}" +
    ".ayuda-cuerpo{padding:4px 14px 14px}" +
    ".ayuda-lista{display:flex;flex-direction:column;gap:6px}" +
    ".ayuda-lista button{text-align:left;border:1px solid rgba(24,22,15,.12);background:#fff;border-radius:10px;padding:9px 12px;cursor:pointer;font:inherit;color:inherit}" +
    ".ayuda-lista button:hover{border-color:#1472cc;background:#f3f8fd}" +
    ".ayuda-lista small{display:block;color:#8d8877;font-size:12px}" +
    ".ayuda-nav{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:10px}" +
    ".ayuda-nav button{border:1px solid rgba(24,22,15,.15);background:#fff;border-radius:9px;padding:7px 12px;cursor:pointer;font:600 13px system-ui,sans-serif;color:#18160f}" +
    ".ayuda-nav button.pri{background:#1472cc;border-color:#1472cc;color:#fff}" +
    ".ayuda-nav button:disabled{opacity:.4;cursor:default}" +
    ".ayuda-puntos{display:flex;gap:4px}.ayuda-puntos i{width:7px;height:7px;border-radius:50%;background:#d8d4c8}.ayuda-puntos i.on{background:#1472cc}" +
    ".ayuda-foco{outline:3px solid #ff7a1a !important;outline-offset:3px;border-radius:6px;animation:ayudaPulso 1.2s ease-in-out infinite;position:relative;z-index:61}" +
    ".ayuda-nota{font-size:12px;color:#8d8877;margin-top:6px}" +
    ".sif-saludo{transform-origin:88px 118px;animation:sifSaludo 2.8s ease-in-out infinite}" +
    ".sif-burbujas circle{animation:sifBurbuja 3.6s linear infinite}.sif-burbujas circle:nth-child(2){animation-delay:1.2s}.sif-burbujas circle:nth-child(3){animation-delay:2.4s}" +
    ".ayuda-panel.hablando .ayuda-top .sif-boca{transform-box:fill-box;transform-origin:center top;animation:sifHabla .22s ease-in-out infinite alternate}" +
    ".ayuda-opc{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:10px;padding-top:8px;border-top:1px dashed rgba(24,22,15,.12)}" +
    ".ayuda-opc button{border:1px solid rgba(24,22,15,.15);background:transparent;border-radius:999px;padding:3px 10px;font:12px system-ui,sans-serif;cursor:pointer;color:inherit}" +
    ".ayuda-opc .ayuda-nota{margin:0}" +
    "@keyframes sifHabla{from{transform:scaleY(1)}to{transform:scaleY(2.2)}}" +
    "@keyframes sifFlota{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}" +
    "@keyframes sifSaludo{0%,100%{transform:rotate(0)}50%{transform:rotate(-14deg)}}" +
    "@keyframes sifBurbuja{0%{transform:translateY(0);opacity:0}15%{opacity:.85}100%{transform:translateY(-95px);opacity:0}}" +
    "@keyframes ayudaPulso{0%,100%{outline-color:#ff7a1a}50%{outline-color:rgba(255,122,26,.25)}}" +
    "@media (prefers-reduced-motion: reduce){.ayuda-top .sif-svg,.sif-saludo,.sif-burbujas circle,.ayuda-foco,.ayuda-panel.hablando .ayuda-top .sif-boca{animation:none}}" +
    "@media (max-width:520px){.ayuda-panel{right:8px;left:8px;bottom:8px;width:auto;max-width:none}.ayuda-btn{right:10px;bottom:10px}}" +
    "@media (prefers-color-scheme: dark){.ayuda-panel,.ayuda-btn{background:#23211c;color:#f2efe6}.ayuda-globo{background:#2f2c25}.ayuda-globo:after{border-right-color:#2f2c25}.ayuda-lista button,.ayuda-nav button{background:#23211c;color:#f2efe6;border-color:rgba(255,255,255,.15)}.ayuda-lista button:hover{background:#2b3440}}";

  // ---------------- Lógica ----------------
  var estado = { circuito: null, paso: 0 };
  var btn, panel, focoActual = null;

  function areaActual() {
    var a = (document.body && document.body.dataset.area) || (scriptTag && scriptTag.dataset.area) || "";
    return CIRCUITOS[a] ? a : "inicio";
  }
  function loginVisible() {
    var l = document.getElementById("login-overlay");
    return !!(l && l.classList.contains("show"));
  }
  function visible(el) { return !!(el && el.offsetParent !== null && getComputedStyle(el).visibility !== "hidden"); }
  function buscar(f) {
    if (!f) return null;
    if (typeof f === "string") return document.querySelector(f);
    if (f.texto) {
      var cands = document.querySelectorAll("button, a, [role=tab], h2, h3, label");
      for (var i = 0; i < cands.length; i++) {
        var tx = (cands[i].textContent || "").replace(/\s+/g, " ").trim();
        if ((tx === f.texto || tx.indexOf(f.texto) === 0) && visible(cands[i])) return cands[i];
      }
    }
    return null;
  }
  function quitarFoco() { if (focoActual) focoActual.classList.remove("ayuda-foco"); focoActual = null; }

  // ---------------- Voz y ritmo ----------------
  // Sifoncito lee cada paso en voz alta (voz del navegador, en español) y en
  // modo "Reproducir" pasa solo al siguiente cuando termina de hablar, con una
  // pausa para mirar la pantalla. Se puede pausar, silenciar o ir a mano.
  function ls(k, def) { try { var v = localStorage.getItem(k); return v == null ? def : v; } catch (e) { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  var vozOn = ls("ayuda_voz", "1") === "1";
  var lento = ls("ayuda_lento", "0") === "1";
  var vozElegida = null, timers = [], hablando = false;
  var hayVoz = typeof window.speechSynthesis !== "undefined" && typeof window.SpeechSynthesisUtterance !== "undefined";
  function elegirVoz() {
    if (!hayVoz) return null;
    var vs = window.speechSynthesis.getVoices() || [];
    var pref = ["es-AR", "es-419", "es-US", "es-MX", "es-ES", "es"];
    for (var i = 0; i < pref.length; i++) {
      var v = vs.filter(function (x) { return (x.lang || "").replace("_", "-").toLowerCase().indexOf(pref[i].toLowerCase()) === 0; });
      if (v.length) return v.sort(function (a, b) { return (b.localService ? 0 : 1) - (a.localService ? 0 : 1); })[0];
    }
    return null;
  }
  if (hayVoz) {
    vozElegida = elegirVoz();
    try { window.speechSynthesis.addEventListener("voiceschanged", function () { vozElegida = elegirVoz(); }); } catch (e) {}
  }
  function textoPlano(html) {
    var d = document.createElement("div"); d.innerHTML = html;
    return (d.textContent || "")
      .replace(/[✨💡📄📊🖨🫧★☰⌂⚙‹›→]/g, " ").replace(/÷/g, " dividido ")
      .replace(/_/g, " ").replace(/[<>]/g, " ").replace(/\s+/g, " ").trim();
  }
  function limpiarTimers() { timers.forEach(clearTimeout); timers = []; }
  function callar() {
    limpiarTimers();
    if (hayVoz) { try { window.speechSynthesis.cancel(); } catch (e) {} }
    hablando = false; if (panel) panel.classList.remove("hablando");
  }
  function esperar(ms, fn) { timers.push(setTimeout(fn, ms)); }
  function tiempoLectura(txt) { return Math.max(4500, txt.length * (lento ? 85 : 65)); }
  // Habla (si corresponde) y después llama a fn; si no hay voz, espera el tiempo de lectura.
  function decir(html, fn) {
    var txt = textoPlano(html);
    if (!vozOn || !hayVoz) { if (fn) esperar(tiempoLectura(txt), fn); return; }
    esperar(120, function () { // Chrome a veces no habla si se llama justo después de cancel()
      try {
        var u = new SpeechSynthesisUtterance(txt);
        if (vozElegida) u.voice = vozElegida;
        u.lang = vozElegida ? vozElegida.lang : "es-AR";
        u.rate = lento ? 0.82 : 0.95; u.pitch = 1.15;
        var listo = false;
        var fin = function () { if (listo) return; listo = true; hablando = false; panel.classList.remove("hablando"); if (fn) esperar(1400, fn); };
        u.onstart = function () { hablando = true; panel.classList.add("hablando"); };
        u.onend = fin; u.onerror = fin;
        window.speechSynthesis.speak(u);
        // Seguro: si el navegador no avisa que terminó, sigue igual.
        esperar(tiempoLectura(txt) + 6000, fin);
      } catch (e) { if (fn) esperar(tiempoLectura(txt), fn); }
    });
  }

  function aplicarPaso(p, alListo) {
    quitarFoco();
    var ir = p.ir ? (Array.isArray(p.ir) ? p.ir : [p.ir]) : [];
    var cambio = false;
    ir.forEach(function (sel) { var el = buscar(sel); if (el && visible(el)) { el.click(); cambio = true; } });
    // Si cambió de pantalla, se espera un momento antes de marcar, para que se vea el cambio.
    esperar(cambio ? 700 : 150, function () {
      var nota = "";
      if (p.foco) {
        var el = buscar(p.foco);
        if (el && visible(el)) {
          focoActual = el; el.classList.add("ayuda-foco");
          try { el.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) { el.scrollIntoView(); }
        } else nota = "No lo veo en tu pantalla: puede que tu perfil no tenga acceso a esta parte.";
      }
      var n = panel.querySelector(".ayuda-nota");
      if (n) { n.textContent = nota; n.hidden = !nota; }
      if (alListo) alListo();
    });
  }
  function controlesVoz() {
    return '<div class="ayuda-opc">' +
      '<button data-acc="voz" title="' + (vozOn ? "Silenciar" : "Activar la voz") + '">' + (vozOn ? "🔊 Voz" : "🔇 Sin voz") + "</button>" +
      '<button data-acc="lento" title="Hablar y avanzar más despacio">' + (lento ? "🐢 Despacio" : "🐇 Normal") + "</button>" +
      (vozOn && hayVoz && !vozElegida ? '<span class="ayuda-nota">Tu navegador no tiene una voz en español instalada.</span>' : "") +
      (vozOn && !hayVoz ? '<span class="ayuda-nota">Este navegador no puede hablar.</span>' : "") + "</div>";
  }
  function render() {
    callar();
    var area = areaActual();
    var lista = CIRCUITOS[area];
    var html = '<button class="ayuda-x" title="Cerrar" data-acc="cerrar">✕</button><div class="ayuda-top">' + sifon(area, 104) + '<div class="ayuda-globo"><div class="ayuda-area">' + NOMBRES[area] + "</div>";
    if (estado.circuito == null) {
      var saludo = area === "inicio" ? "¡Hola! Soy Sifoncito. ¿Qué querés aprender?" : "Estos son los circuitos de " + NOMBRES[area] + ". ¿Cuál te muestro?";
      html += saludo + "</div></div>";
      html += '<div class="ayuda-cuerpo"><div class="ayuda-lista">' + lista.map(function (c, i) {
        return '<button data-acc="abrir" data-i="' + i + '">' + c.titulo + "<small>" + c.pasos.length + " pasos</small></button>";
      }).join("") + "</div>" + controlesVoz() + "</div>";
      panel.innerHTML = html;
      if (estado.saludar) { estado.saludar = false; decir(saludo); }
      return;
    }
    var c = lista[estado.circuito], p = c.pasos[estado.paso];
    var ultimo = estado.paso >= c.pasos.length - 1;
    html += '<div class="ayuda-texto">' + p.t + '</div><div class="ayuda-nota" hidden></div></div></div>';
    html += '<div class="ayuda-cuerpo"><div style="font-weight:700;font-size:13px">' + c.titulo + "</div>" +
      '<div class="ayuda-nav"><button data-acc="volver" title="Volver a la lista">☰</button>' +
      '<div class="ayuda-puntos">' + c.pasos.map(function (_, i) { return "<i" + (i === estado.paso ? ' class="on"' : "") + "></i>"; }).join("") + "</div>" +
      '<span><button data-acc="ant"' + (estado.paso === 0 ? " disabled" : "") + ' title="Paso anterior">‹</button> ' +
      '<button data-acc="auto" title="' + (estado.auto ? "Pausar" : "Que siga solo") + '">' + (estado.auto ? "Pausa" : "▶ Seguir") + "</button> " +
      (!ultimo ? '<button class="pri" data-acc="sig">Siguiente</button>' : '<button class="pri" data-acc="fin">¡Listo!</button>') + "</span></div>" +
      controlesVoz() + "</div>";
    panel.innerHTML = html;
    aplicarPaso(p, function () {
      decir(p.t, function () {
        if (!estado.auto || panel.hidden) return;
        if (ultimo) { estado.auto = false; var b = panel.querySelector('[data-acc="auto"]'); if (b) b.textContent = "▶ Seguir"; return; }
        estado.paso++; render();
      });
    });
  }
  function abrir() { estado = { circuito: null, paso: 0, auto: false, saludar: true }; panel.hidden = false; btn.hidden = true; render(); }
  function cerrar() { callar(); quitarFoco(); panel.hidden = true; actualizarBoton(); }
  function actualizarBoton() {
    if (!btn) return;
    var area = areaActual();
    btn.innerHTML = sifon(area, 30) + "<span>Ayuda</span>";
    btn.title = "Ayuda de " + NOMBRES[area];
    btn.hidden = !panel.hidden || loginVisible();
    if (!panel.hidden && estado.circuito == null) render(); // cambió el área con el panel abierto
  }

  function iniciar() {
    var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
    btn = document.createElement("button"); btn.type = "button"; btn.className = "ayuda-btn"; btn.id = "ayuda-btn";
    panel = document.createElement("div"); panel.className = "ayuda-panel"; panel.id = "ayuda-panel"; panel.hidden = true;
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Ayuda");
    document.body.appendChild(btn); document.body.appendChild(panel);
    btn.addEventListener("click", abrir);
    panel.addEventListener("click", function (e) {
      var b = e.target.closest("[data-acc]"); if (!b) return;
      var acc = b.dataset.acc, area = areaActual();
      if (acc === "cerrar" || acc === "fin") return cerrar();
      if (acc === "voz") { vozOn = !vozOn; lsSet("ayuda_voz", vozOn ? "1" : "0"); if (!vozOn) callar(); }
      if (acc === "lento") { lento = !lento; lsSet("ayuda_lento", lento ? "1" : "0"); }
      if (acc === "abrir") { estado = { circuito: Number(b.dataset.i), paso: 0, auto: true }; } // arranca solo, a su ritmo
      if (acc === "volver") { quitarFoco(); estado = { circuito: null, paso: 0, auto: false }; }
      if (acc === "sig") { estado.auto = false; estado.paso = Math.min(estado.paso + 1, CIRCUITOS[area][estado.circuito].pasos.length - 1); }
      if (acc === "ant") { estado.auto = false; estado.paso = Math.max(estado.paso - 1, 0); }
      if (acc === "auto") estado.auto = !estado.auto;
      if ((acc === "voz" || acc === "lento") && estado.circuito != null) {
        // Cambiar voz o velocidad no reinicia el paso: solo actualiza los botones.
        var cv = panel.querySelector(".ayuda-opc"); if (cv) cv.outerHTML = controlesVoz();
        var pasos = CIRCUITOS[area][estado.circuito].pasos;
        callar();
        decir(pasos[estado.paso].t, function () {
          if (!estado.auto || panel.hidden) return;
          if (estado.paso >= pasos.length - 1) { estado.auto = false; var bb = panel.querySelector('[data-acc="auto"]'); if (bb) bb.textContent = "▶ Seguir"; return; }
          estado.paso++; render();
        });
        return;
      }
      if (acc === "auto" && !estado.auto) { callar(); var ba = panel.querySelector('[data-acc="auto"]'); if (ba) ba.textContent = "▶ Seguir"; return; }
      render();
    });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !panel.hidden) cerrar(); });
    // Cambios de área (Gestión) y de login: se actualiza el traje y la visibilidad.
    new MutationObserver(actualizarBoton).observe(document.body, { attributes: true, attributeFilter: ["data-area"] });
    var login = document.getElementById("login-overlay");
    if (login) new MutationObserver(actualizarBoton).observe(login, { attributes: true, attributeFilter: ["class"] });
    actualizarBoton();
  }
  window.AyudaAnafer = { sifon: sifon, circuitos: CIRCUITOS, abrir: function () { abrir(); } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar); else iniciar();
})();
