// =====================================================================
// Jornadas y horas extras "propias del horario" (ej. Camioneros).
//
// Un horario puede traer su propia regla de horas extras en `horario.extras`:
//   {
//     tramos: [ { dias: [1..5], hasta_50: "21:00", todo_100_si_pasa: true },
//               { dias: [6],    hasta_50: "13:00", todo_100_si_pasa: false } ],
//     descanso_horas: 12          // descanso mínimo entre jornadas (0 = no aplica)
//   }
// Con eso, cada jornada (entrada → salida, aunque termine pasada la medianoche):
//   - lo trabajado hasta el FIN del horario del día es hora normal;
//   - de ahí hasta `hasta_50` es extra al 50%;
//   - después de `hasta_50`, al 100%; y si el tramo dice `todo_100_si_pasa`,
//     cuando la jornada pasa de `hasta_50` TODAS las extras (desde el fin del
//     horario) se liquidan al 100%;
//   - domingos, días sin horario y feriados: todo al 100% (o el % del feriado).
// Descanso: si terminó tarde, la entrada siguiente se espera recién después de
// `descanso_horas` desde la salida, y llegar a esa hora NO es llegada tarde.
// La jornada pertenece al día en que entró.
// =====================================================================
import { bloquesDeHoy } from "./fichaje.js";

export const EXTRAS_CAMIONEROS = {
  tramos: [
    { dias: [1, 2, 3, 4, 5], hasta_50: "21:00", todo_100_si_pasa: true },
    { dias: [6], hasta_50: "13:00", todo_100_si_pasa: false },
  ],
  descanso_horas: 12,
};
export const BLOQUES_CAMIONEROS = [
  { dias: [1, 2, 3, 4, 5], inicio: "08:00", fin: "16:00" },
  { dias: [6], inicio: "08:00", fin: "12:00" },
];

const MIN = 60000;
const MAX_JORNADA_H = 20; // una entrada sin salida por más de esto se toma como "sin salida"

export function tieneExtrasPropias(horario) {
  return !!(horario && horario.tipo !== "libre" && horario.extras && Array.isArray(horario.extras.tramos) && horario.extras.tramos.length);
}
export function tramoDelDia(horario, d) {
  const iso = d.getDay() === 0 ? 7 : d.getDay();
  return ((horario && horario.extras && horario.extras.tramos) || []).find((t) => (t.dias || []).includes(iso)) || null;
}
export function descansoHoras(horario) {
  return horario && horario.extras ? Number(horario.extras.descanso_horas) || 0 : 0;
}
function hhmm(x) {
  if (!x) return null;
  if (x === "24:00") return 1440;
  const [h, m] = String(x).split(":").map(Number);
  return h * 60 + (m || 0);
}
function inicioDelDia(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function aLa(dia, minutos) { const d = inicioDelDia(dia); d.setMinutes(minutos); return d; }
function diaISO(d) { return d.getDay() === 0 ? 7 : d.getDay(); }
export function fechaKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// minutos (redondeados) del solapamiento entre [a,b) y [c,d)
function solape(a, b, c, d) {
  const ini = Math.max(a.getTime(), c.getTime()), fin = Math.min(b.getTime(), d.getTime());
  return fin > ini ? (fin - ini) / MIN : 0;
}

// Liquida una jornada. Devuelve minutos normales / 50 / 100 y una nota explicando.
export function liquidarJornada(entrada, salida, horario, feriados) {
  const total = Math.max(0, (salida - entrada) / MIN);
  const res = { total: Math.round(total), normal: 0, min50: 0, min100: 0, nota: "" };
  const fer = feriados && feriados[fechaKey(entrada)];
  if (fer != null) {
    if (Number(fer) >= 100) res.min100 = res.total; else if (Number(fer) >= 50) res.min50 = res.total; else res.normal = res.total;
    res.nota = "Feriado";
    return res;
  }
  const bloques = bloquesDeHoy(horario, entrada);
  const iso = diaISO(entrada);
  if (!bloques.length) { res.min100 = res.total; res.nota = iso === 7 ? "Domingo: todo al 100%" : "Día sin horario: todo al 100%"; return res; }
  const finNormal = aLa(entrada, hhmm(bloques[bloques.length - 1].fin));
  const tramo = ((horario.extras && horario.extras.tramos) || []).find((t) => (t.dias || []).includes(iso));
  const desde = new Date(Math.max(entrada.getTime(), finNormal.getTime()));
  const extra = salida > desde ? (salida - desde) / MIN : 0;
  let m50 = 0, m100 = 0;
  if (extra > 0) {
    const lim = tramo && tramo.hasta_50 ? aLa(entrada, hhmm(tramo.hasta_50)) : finNormal;
    if (salida > lim && tramo && tramo.todo_100_si_pasa) {
      m100 = extra;
      res.nota = `Pasó las ${tramo.hasta_50}: todas las extras desde las ${bloques[bloques.length - 1].fin} van al 100%`;
    } else {
      m50 = solape(desde, salida, desde, lim);
      m100 = extra - m50;
      if (m100 > 0 && tramo) res.nota = `Extras al 50% hasta las ${tramo.hasta_50} y al 100% después`;
    }
  }
  // Redondeo cuidando que la suma dé el total
  res.min50 = Math.round(m50); res.min100 = Math.round(m100);
  res.normal = Math.max(0, res.total - res.min50 - res.min100);
  return res;
}

// Hora a partir de la cual puede volver a entrar (salida + descanso), o null.
export function reingresoPermitido(ultimaSalida, horario) {
  const h = descansoHoras(horario);
  if (!h || !ultimaSalida) return null;
  return new Date(ultimaSalida.getTime() + h * 3600000);
}

// Contexto de una fichada a partir de las fichadas del mismo empleado
// (ordenadas por hora, sin incluir la que se evalúa): la entrada que sigue
// abierta (si la hay) y la última salida.
export function contextoFichada(fichadas, hora) {
  let ultimaSalida = null, entradaAbierta = null;
  for (const f of fichadas) {
    const t = f.ts || new Date(f.timestamp);
    if (t >= hora) break;
    if (f.tipo === "entrada") entradaAbierta = t;
    else if (f.tipo === "salida") { ultimaSalida = t; entradaAbierta = null; }
  }
  if (entradaAbierta && (hora - entradaAbierta) / 3600000 > MAX_JORNADA_H) entradaAbierta = null;
  return { ultimaSalida, entradaAbierta };
}

// Arma las jornadas (pares entrada → salida) de un empleado y las liquida.
// `config` = { recargos, feriados }; `liquidarGeneral(s, e)` se usa para los
// horarios sin regla propia (la regla general de recargos de la empresa).
export function jornadasDe(fichajes, horario, config, liquidarGeneral) {
  const orden = fichajes.slice().sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const out = [];
  let ent = null, ultimaSalida = null;
  const propias = tieneExtrasPropias(horario);
  const cerrar = (e, s) => {
    let l;
    // La regla propia se usa en los días con tramo de extras y en los días sin
    // horario (domingo: todo al 100%); los demás días con horario pero sin tramo
    // (ej. si solo el sábado tiene regla propia) van por la regla general.
    if (propias && (tramoDelDia(horario, e.t) || !bloquesDeHoy(horario, e.t).length)) l = liquidarJornada(e.t, s, horario, (config && config.feriados) || {});
    else {
      const total = Math.round((s - e.t) / MIN);
      const g = liquidarGeneral ? liquidarGeneral(e.t, s) : { min50: 0, min100: 0 };
      l = { total, min50: g.min50, min100: g.min100, normal: Math.max(0, total - g.min50 - g.min100), nota: "" };
    }
    const j = { fecha: fechaKey(e.t), entrada: e.t, salida: s, ...l, descansoPrevioMin: e.descanso, observaciones: [] };
    if (l.nota) j.observaciones.push(l.nota);
    if (fechaKey(s) !== fechaKey(e.t)) j.observaciones.push("Terminó al día siguiente");
    if (e.reingreso) j.observaciones.push(`Reingreso desde las ${e.reingreso}: no cuenta como llegada tarde`);
    if (e.descansoCorto) j.observaciones.push(`Descanso de ${Math.floor(e.descanso / 60)} h ${e.descanso % 60} min: menos de las ${descansoHoras(horario)} h`);
    out.push(j);
  };
  for (const f of orden) {
    const t = new Date(f.timestamp);
    if (f.tipo === "entrada") {
      if (ent) out.push({ fecha: fechaKey(ent.t), entrada: ent.t, salida: null, total: 0, normal: 0, min50: 0, min100: 0, observaciones: ["Sin salida fichada"] });
      const descanso = ultimaSalida ? Math.round((t - ultimaSalida) / MIN) : null;
      const permit = reingresoPermitido(ultimaSalida, horario);
      const bl = bloquesDeHoy(horario, t)[0];
      const inicioHorario = bl ? aLa(t, hhmm(bl.inicio)) : null;
      ent = {
        t, descanso,
        reingreso: permit && inicioHorario && permit > inicioHorario && fechaKey(permit) === fechaKey(t) ? permit.toTimeString().slice(0, 5) : null,
        descansoCorto: !!(permit && descanso != null && t < permit && descanso < 24 * 60),
      };
    } else if (f.tipo === "salida") {
      if (ent && (t - ent.t) / 3600000 <= MAX_JORNADA_H) cerrar(ent, t);
      ent = null; ultimaSalida = t;
    }
  }
  if (ent) out.push({ fecha: fechaKey(ent.t), entrada: ent.t, salida: null, total: 0, normal: 0, min50: 0, min100: 0, observaciones: ["Sin salida fichada (o todavía trabajando)"] });
  return out;
}
