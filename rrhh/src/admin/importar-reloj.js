// Lectura de los archivos de fichadas. Se aceptan dos formatos:
//  1) Reporte del reloj ZKTeco ("Sumario.xls", hoja "Registros"): fila "Periodo: dd/mm/aaaa ~ dd/mm/aaaa",
//     encabezado "No | Nombre | Depto | 1 | 2 | …" y una fila por empleado con las marcas de cada día
//     separadas por salto de línea ("07:52\n12:18\n").
//  2) "PLANILLA DE E-S" (reloj de camioneros / sopladora): encabezado "LEG | NOMBRE | … | FECHA | HORA 1 …
//     HORA 6" y una fila por empleado y día, con las horas como hh.mm (8.17 = 08:17, 13.1 = 13:10).
// Un empleado puede fichar en los dos relojes (entra en uno y sale en el otro): unirLecturas() junta las
// marcas por legajo antes de deducir entrada/salida.
// Ningún reloj dice si cada marca es entrada o salida: se deduce con asignarTipos().

const OFFSET_AR = "-03:00"; // Argentina no tiene horario de verano

const pad = (n) => String(n).padStart(2, "0");
const isoDia = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;

function parseFechaDMY(s) {
  const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}

// rows: matriz (array de arrays) de la hoja Registros
export function parsearRegistros(rows) {
  let desde = null, hasta = null;
  for (const r of rows.slice(0, 6)) {
    const txt = r.map((c) => (c == null ? "" : String(c))).join(" ");
    const m = txt.match(/(\d{1,2}\/\d{1,2}\/\d{4})\s*~\s*(\d{1,2}\/\d{1,2}\/\d{4})/);
    if (m) { desde = parseFechaDMY(m[1]); hasta = parseFechaDMY(m[2]); break; }
  }
  if (!desde || !hasta) throw new Error("No encontré el período (\"Periodo: dd/mm/aaaa ~ dd/mm/aaaa\"). ¿Es la hoja Registros del reloj?");

  const hIdx = rows.findIndex((r) => String(r[0] ?? "").trim().toLowerCase() === "no" && String(r[1] ?? "").trim().toLowerCase() === "nombre");
  if (hIdx < 0) throw new Error("No encontré el encabezado \"No / Nombre\" en la hoja.");
  const header = rows[hIdx];

  // Columnas de días: en orden, a partir de la fecha "desde". Se verifica con el número de día.
  const columnas = [];
  let cursor = new Date(desde);
  for (let c = 3; c < header.length; c++) {
    const n = parseInt(header[c], 10);
    if (!n) continue;
    // avanzar el cursor hasta que coincida el número de día (por si hay columnas salteadas)
    let guard = 0;
    while (cursor.getUTCDate() !== n && cursor <= hasta && guard++ < 40) cursor = new Date(cursor.getTime() + 864e5);
    if (cursor > hasta) break;
    columnas.push({ col: c, fecha: isoDia(cursor) });
    cursor = new Date(cursor.getTime() + 864e5);
  }
  if (!columnas.length) throw new Error("No encontré las columnas de los días.");

  const empleados = [];
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const legajo = parseInt(r[0], 10);
    if (!legajo) continue;
    const marcas = [];
    for (const { col, fecha } of columnas) {
      const cel = r[col];
      if (cel == null || cel === "") continue;
      for (const h of String(cel).split(/[\r\n\s]+/)) {
        const m = h.match(/^(\d{1,2}):(\d{2})$/);
        if (!m) continue;
        const hhmm = `${pad(+m[1])}:${m[2]}`;
        marcas.push({ fecha, hora: hhmm, ts: new Date(`${fecha}T${hhmm}:00${OFFSET_AR}`) });
      }
    }
    if (!marcas.length) continue; // sin fichadas → se desestima
    marcas.sort((a, b) => a.ts - b.ts);
    empleados.push({ legajo, nombreReloj: String(r[1] ?? "").trim(), marcas });
  }
  return { formato: "Reloj ZKTeco (hoja Registros)", desde: isoDia(desde), hasta: isoDia(hasta), empleados };
}

// ---------------------------------------------------------------------------------------------
// Formato 2: "PLANILLA DE E-S". rows: matriz leída con valores crudos (números sin formatear).
const norm = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();

// Fecha de la fila: número de serie de Excel, "dd/mm/aaaa", "aaaa-mm-dd" o Date
function fechaCelda(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate()));
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 864e5);
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) return new Date(Date.UTC(m[3].length === 2 ? 2000 + +m[3] : +m[3], +m[2] - 1, +m[1]));
  return null;
}

// Hora de una celda → minutos del día. Acepta 8.17 / "8.17" / "08:17" (hh.mm u hh:mm), una fracción
// de día de Excel (0.3451…) o un Date. Devuelve null si no es una hora válida.
export function minutosHora(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.getHours() * 60 + v.getMinutes();
  if (typeof v === "number") {
    if (v < 0 || v >= 24) return null;
    const cent = v * 100;
    if (v < 1 && Math.abs(cent - Math.round(cent)) > 1e-6) return Math.round(v * 1440) % 1440; // fracción de día
    const h = Math.floor(v + 1e-9), mm = Math.round((v - h) * 100);
    return mm < 60 ? h * 60 + mm : null;
  }
  const m = String(v).trim().match(/^(\d{1,2})(?:[:.,](\d{1,2}))?$/);
  if (!m) return null;
  const h = +m[1];
  // "8.2" es 08:20 (como el número 8.2), "8:05" es 08:05
  const mm = m[2] == null ? 0 : m[2].length === 1 ? +m[2] * 10 : +m[2];
  return h < 24 && mm < 60 ? h * 60 + mm : null;
}

export function parsearPlanillaES(rows) {
  const hIdx = rows.findIndex((r) => {
    const cs = r.map(norm);
    return cs.some((c) => c === "LEG" || c === "LEGAJO") && cs.includes("FECHA") && cs.some((c) => /^HORA\s*\d+$/.test(c));
  });
  if (hIdx < 0) throw new Error("No encontré el encabezado \"LEG / FECHA / HORA 1\" de la planilla de E-S.");
  const h = rows[hIdx].map(norm);
  const cLeg = h.findIndex((c) => c === "LEG" || c === "LEGAJO");
  const cNom = h.indexOf("NOMBRE");
  const cFecha = h.indexOf("FECHA");
  const cHoras = h.map((c, i) => (/^HORA\s*\d+$/.test(c) ? i : -1)).filter((i) => i >= 0);

  const porLegajo = new Map();
  let desde = null, hasta = null;
  for (let i = hIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const legajo = parseInt(r[cLeg], 10);
    const dia = fechaCelda(r[cFecha]);
    if (!legajo || !dia) continue;
    if (!desde || dia < desde) desde = dia;
    if (!hasta || dia > hasta) hasta = dia;
    let e = porLegajo.get(legajo);
    if (!e) porLegajo.set(legajo, (e = { legajo, nombreReloj: String(r[cNom] ?? "").trim(), marcas: [] }));
    // Las horas van en orden: si una es menor que la anterior, pasó la medianoche (turno nocturno)
    let extra = 0, anterior = -1;
    for (const c of cHoras) {
      const min = minutosHora(r[c]);
      if (min == null) continue;
      if (min < anterior) extra += 1;
      anterior = min;
      const d = new Date(dia.getTime() + extra * 864e5);
      const fecha = isoDia(d), hora = `${pad(Math.floor(min / 60))}:${pad(min % 60)}`;
      e.marcas.push({ fecha, hora, ts: new Date(`${fecha}T${hora}:00${OFFSET_AR}`) });
    }
  }
  if (!desde) throw new Error("La planilla de E-S no tiene filas con legajo y fecha.");
  const empleados = [...porLegajo.values()].filter((e) => e.marcas.length);
  empleados.forEach((e) => e.marcas.sort((a, b) => a.ts - b.ts));
  return { formato: "Planilla de E-S", desde: isoDia(desde), hasta: isoDia(hasta), empleados };
}

// Junta varios archivos: une las marcas de cada legajo (sin repetir la misma hora) y guarda en cada
// marca de qué archivo vino (origen = índice en `lecturas`). El período es el más amplio.
export function unirLecturas(lecturas) {
  const porLegajo = new Map();
  let desde = null, hasta = null;
  lecturas.forEach((l, origen) => {
    if (!desde || l.desde < desde) desde = l.desde;
    if (!hasta || l.hasta > hasta) hasta = l.hasta;
    for (const e of l.empleados) {
      let u = porLegajo.get(e.legajo);
      if (!u) porLegajo.set(e.legajo, (u = { legajo: e.legajo, nombreReloj: e.nombreReloj, nombres: [], marcas: [], vistos: new Set() }));
      if (e.nombreReloj && !u.nombres.includes(e.nombreReloj)) u.nombres.push(e.nombreReloj);
      for (const m of e.marcas) {
        const t = m.ts.getTime();
        if (u.vistos.has(t)) continue;
        u.vistos.add(t);
        u.marcas.push({ ...m, origen });
      }
    }
  });
  const empleados = [...porLegajo.values()].map(({ vistos, nombres, ...u }) => ({
    ...u, nombreReloj: nombres.join(" / "), marcas: u.marcas.sort((a, b) => a.ts - b.ts),
  })).sort((a, b) => a.legajo - b.legajo);
  return { desde, hasta, empleados };
}

// Deduce entrada/salida en orden cronológico:
// - marcas a menos de `dupMin` minutos de la anterior se toman como error de fichada (repetida)
// - `ignorar`: timestamps (ms) que el usuario descartó a mano → no cuentan para el emparejamiento
// - `incluir`: timestamps (ms) que el usuario rescató aunque parezcan repetidas
// - si no hay una entrada abierta → entrada
// - si hay una entrada abierta hace menos de `maxTurnoHs` horas → salida (cubre turnos nocturnos)
// - si pasaron más horas → la entrada anterior quedó sin salida y esta es una entrada nueva
export function asignarTipos(marcas, { dupMin = 10, maxTurnoHs = 14, ignorar = new Set(), incluir = new Set() } = {}) {
  const out = [];
  let abierta = null, ultima = null;
  for (const m of marcas) {
    const t = m.ts.getTime();
    if (ignorar.has(t)) { out.push({ ...m, tipo: null, descartada: "manual" }); continue; }
    if (ultima && !incluir.has(t) && (t - ultima.ts.getTime()) / 60000 < dupMin) {
      out.push({ ...m, tipo: null, descartada: "repetida" }); continue;
    }
    let tipo;
    if (abierta && (t - abierta.ts.getTime()) / 3600000 <= maxTurnoHs) { tipo = "salida"; abierta = null; }
    else { tipo = "entrada"; abierta = m; }
    ultima = m;
    out.push({ ...m, tipo, descartada: null });
  }
  return out;
}

// Lee un archivo y detecta el formato: hoja "Registros" del ZKTeco, o una hoja con el encabezado
// LEG / FECHA / HORA 1 (planilla de E-S).
export async function leerArchivoReloj(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const nombre = wb.SheetNames.find((n) => n.trim().toLowerCase() === "registros");
  if (nombre) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: null, blankrows: true });
    return parsearRegistros(rows);
  }
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null, blankrows: false });
    const esPlanilla = rows.slice(0, 15).some((r) => {
      const cs = r.map(norm);
      return cs.some((c) => c === "LEG" || c === "LEGAJO") && cs.includes("FECHA") && cs.some((c) => /^HORA\s*\d+$/.test(c));
    });
    if (esPlanilla) return parsearPlanillaES(rows);
  }
  throw new Error(`No reconozco el formato. Tiene que ser el reporte del reloj (hoja "Registros") o la planilla de E-S (columnas LEG, FECHA, HORA 1…). Hojas del archivo: ${wb.SheetNames.join(", ")}`);
}
