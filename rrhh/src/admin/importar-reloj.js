// Lectura del reporte del reloj ZKTeco ("Sumario.xls", hoja "Registros").
// Formato: fila "Periodo: dd/mm/aaaa ~ dd/mm/aaaa", fila de encabezado "No | Nombre | Depto | 1 | 2 | …",
// y una fila por empleado con las marcas de cada día separadas por salto de línea ("07:52\n12:18\n").
// El reloj NO dice si cada marca es entrada o salida: se deduce con asignarTipos().

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
  return { desde: isoDia(desde), hasta: isoDia(hasta), empleados };
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

export async function leerArchivoReloj(file) {
  const XLSX = await import("xlsx");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const nombre = wb.SheetNames.find((n) => n.trim().toLowerCase() === "registros");
  if (!nombre) throw new Error(`El archivo no tiene una hoja "Registros". Hojas: ${wb.SheetNames.join(", ")}`);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[nombre], { header: 1, raw: false, defval: null, blankrows: true });
  return parsearRegistros(rows);
}
