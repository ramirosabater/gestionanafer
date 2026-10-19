import { etiquetaPeriodo, esHorarioLibre, calcularEstado } from "./fichaje.js";
import { tieneExtrasPropias, jornadasDe, contextoFichada } from "./jornada.js";

// Reglas de recargo por defecto (si RRHH no configuró nada): finde al 100%.
export const RECARGOS_DEFAULT = [
  { dias: [6], hora_desde: "13:00", hora_hasta: "24:00", porcentaje: 100 }, // sábado desde 13
  { dias: [7], hora_desde: "00:00", hora_hasta: "24:00", porcentaje: 100 }, // domingo completo
];

function hhmm(x) {
  if (x === "24:00" || x === "24") return 1440;
  const [h, m] = String(x).split(":").map(Number);
  return h * 60 + (m || 0);
}
function fechaKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Tasa de recargo aplicable en un instante dado (100 gana sobre 50; feriado manda).
function tasaEn(t, feriados, recargos) {
  const fk = fechaKey(t);
  if (feriados && feriados[fk] != null) return feriados[fk];
  const iso = t.getDay() === 0 ? 7 : t.getDay();
  const minDia = t.getHours() * 60 + t.getMinutes();
  let best = 0;
  for (const r of recargos) {
    if (!(r.dias || []).includes(iso)) continue;
    if (minDia >= hhmm(r.hora_desde) && minDia < hhmm(r.hora_hasta)) best = Math.max(best, r.porcentaje);
  }
  return best;
}

// Minutos de un intervalo trabajado que caen al 50% y al 100%, según config.
export function minutosRecargo(s, e, config) {
  const recargos = (config && config.recargos && config.recargos.length) ? config.recargos : RECARGOS_DEFAULT;
  const feriados = (config && config.feriados) || {};
  let min50 = 0, min100 = 0;
  // paso de 1 minuto (los intervalos son de pocas horas)
  let t = new Date(s.getFullYear(), s.getMonth(), s.getDate(), s.getHours(), s.getMinutes());
  const end = e.getTime();
  let guard = 0;
  while (t.getTime() < end && guard++ < 100000) {
    const r = tasaEn(t, feriados, recargos);
    if (r >= 100) min100++;
    else if (r >= 50) min50++;
    t = new Date(t.getTime() + 60000);
  }
  return { min50, min100 };
}

export function minAHoras(min) {
  const t = Math.round(min);
  return `${Math.floor(t / 60)}h ${t % 60}m`;
}

// Carga los recargos y feriados desde la base (recibe la función sbGet a usar).
export async function cargarConfig(sbGetFn) {
  try {
    const [rec, fer] = await Promise.all([
      sbGetFn("recargos?select=*"),
      sbGetFn("feriados?select=fecha,porcentaje"),
    ]);
    const feriados = {};
    (fer || []).forEach((f) => { feriados[f.fecha] = f.porcentaje ?? 100; });
    return { recargos: rec || [], feriados };
  } catch {
    return { recargos: [], feriados: {} };
  }
}

// Cumplimiento de un empleado en el período. `config` = { recargos, feriados }.
export function computarCumplimiento(fichajes, horario, desde, hasta, config) {
  const libre = esHorarioLibre(horario);
  // Horario libre: horas a cumplir por día (los sábados pueden ser distintas; si no se cargan, 4 h)
  const horasDia = libre ? (Number(horario.horas_diarias) || 0) : 0;
  const horasSab = libre ? (horario.horas_sabado != null ? Number(horario.horas_sabado) : 4) : 0;
  const res = {
    libre,
    esperadoMin: 0, diferenciaMin: 0,
    sinTurno: !horario || !horario.bloques || horario.bloques.length === 0,
    diasEsperados: 0, diasTrabajados: 0, sinRegistro: 0, sinEntrada: 0, sinSalida: 0,
    minTarde: 0, minRetiro: 0, descuentoMin: 0, horas50Min: 0, horas100Min: 0, trabajadoMin: 0, normalMin: 0,
    extrasPropias: tieneExtrasPropias(horario), jornadas: [],
  };
  const ordenadas = fichajes.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  // Se pueden pasar fichadas de un poco antes/después del período (para ver el
  // descanso previo y las salidas pasada la medianoche): solo cuentan las del período.
  const enPeriodo = (t) => t >= desde && t <= hasta;
  ordenadas.forEach((f, i) => {
    if (f.autorizado) return; // justificado por el jefe → no descuenta
    if (!enPeriodo(new Date(f.timestamp))) return;
    let estado = f.estado, min = Number(f.minutos_tarde) || 0;
    // Horario con regla propia (ej. Camioneros): se recalcula con el descanso
    // entre jornadas y las jornadas que terminan pasada la medianoche.
    if (res.extrasPropias) {
      const t = new Date(f.timestamp);
      const e = calcularEstado(f.tipo, t, horario, contextoFichada(ordenadas.slice(0, i), t));
      estado = e.estado; min = e.minutosTarde || 0;
    }
    if (estado === "tarde") res.minTarde += min;
    else if (estado === "salida_anticipada") res.minRetiro += min;
  });
  res.descuentoMin = res.minTarde + res.minRetiro;

  if (libre) { res.sinTurno = false; res.minTarde = 0; res.minRetiro = 0; res.descuentoMin = 0; }

  if (res.extrasPropias) {
    res.jornadas = jornadasDe(fichajes, horario, config).filter((j) => enPeriodo(j.entrada));
    res.jornadas.forEach((j) => { res.horas50Min += j.min50; res.horas100Min += j.min100; res.trabajadoMin += j.total; res.normalMin += j.normal; });
  } else {
    let pend = null;
    ordenadas.forEach((f) => {
      if (f.tipo === "entrada") pend = enPeriodo(new Date(f.timestamp)) ? new Date(f.timestamp) : null;
      else if (f.tipo === "salida" && pend) {
        const { min50, min100 } = minutosRecargo(pend, new Date(f.timestamp), config);
        res.horas50Min += min50; res.horas100Min += min100;
        res.trabajadoMin += (new Date(f.timestamp) - pend) / 60000;
        pend = null;
      }
    });
    res.normalMin = Math.max(0, res.trabajadoMin - res.horas50Min - res.horas100Min);
  }

  if (!res.sinTurno) {
    const dias = new Set();
    horario.bloques.forEach((b) => (b.dias || []).forEach((d) => dias.add(d)));
    const porFecha = {};
    let entAbierta = null; // una salida pasada la medianoche cuenta para el día en que entró
    ordenadas.forEach((f) => {
      let d = new Date(f.timestamp);
      if (f.tipo === "salida" && entAbierta && (d - entAbierta) / 3600000 <= 20) d = entAbierta;
      entAbierta = f.tipo === "entrada" ? new Date(f.timestamp) : null;
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const reg = (porFecha[key] = porFecha[key] || { entrada: false, salida: false });
      if (f.tipo === "entrada") reg.entrada = true;
      if (f.tipo === "salida") reg.salida = true;
    });
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const cur = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
    const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
    while (cur <= fin) {
      if (cur <= hoy) {
        const iso = cur.getDay() === 0 ? 7 : cur.getDay();
        if (dias.has(iso)) {
          res.diasEsperados++;
          if (libre) res.esperadoMin += (iso === 6 ? horasSab : horasDia) * 60;
          const key = `${cur.getFullYear()}-${cur.getMonth()}-${cur.getDate()}`;
          const reg = porFecha[key];
          if (!reg) res.sinRegistro++;
          else {
            if (reg.entrada && reg.salida) res.diasTrabajados++;
            if (!reg.entrada) res.sinEntrada++;
            if (!reg.salida) res.sinSalida++;
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }
  if (libre) {
    // Meta de horas = suma de las horas de cada día laborable esperado (sábado con su propia cantidad)
    res.esperadoMin = Math.round(res.esperadoMin);
    res.diferenciaMin = Math.round(res.trabajadoMin - res.esperadoMin);
  }
  return res;
}

export function textoIncumplimientos(equipoCumpl, desde, hasta) {
  const lineas = [];
  equipoCumpl.forEach((m) => {
    const c = m.cumpl;
    const partes = [];
    if (c.sinRegistro > 0) partes.push(`${c.sinRegistro} día(s) sin registro`);
    if (c.sinEntrada > 0) partes.push(`${c.sinEntrada} sin entrada`);
    if (c.sinSalida > 0) partes.push(`${c.sinSalida} sin salida`);
    if (c.minTarde > 0) partes.push(`${c.minTarde} min tarde`);
    if (c.minRetiro > 0) partes.push(`${c.minRetiro} min retiro`);
    if (partes.length) lineas.push(`• ${m.apellido}, ${m.nombre}: ${partes.join(", ")} (descuento ${c.descuentoMin} min)`);
  });
  if (!lineas.length) return `Período ${etiquetaPeriodo(desde, hasta)} — sin incumplimientos detectados.`;
  return `Período ${etiquetaPeriodo(desde, hasta)} — incumplimientos:\n` + lineas.join("\n");
}
