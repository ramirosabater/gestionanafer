// Avisos del ayudante en RR.HH.: quién dejó turnos sin fichar la salida.
// Una "entrada" sin "salida" después (o seguida de otra entrada) que ya tiene
// más de 16 horas es una salida que falta fichar o corregir.
import { sbGet, sbGetAll, sbFuncion } from "./supabase-admin.js";

const HORAS_TURNO_MAX = 16;

export async function salidasSinFichar(dias = 7) {
  const desde = new Date(Date.now() - (dias + 1) * 86400000);
  const [fichajes, emps] = await Promise.all([
    sbGetAll(`fichajes?select=id,legajo,tipo,timestamp&timestamp=gte.${encodeURIComponent(desde.toISOString())}&order=timestamp.asc,id.asc`),
    sbGet("empleados?select=legajo,nombre,apellido,sector,activo"),
  ]);
  const mapEmp = {};
  emps.forEach((e) => (mapEmp[String(e.legajo)] = e));
  const porLegajo = {};
  fichajes.forEach((f) => { (porLegajo[String(f.legajo)] = porLegajo[String(f.legajo)] || []).push(f); });
  const limite = Date.now() - HORAS_TURNO_MAX * 3600000;
  const corte = Date.now() - dias * 86400000;
  const out = [];
  Object.keys(porLegajo).forEach((leg) => {
    const e = mapEmp[leg];
    if (e && e.activo === false) return;
    const fs = porLegajo[leg];
    const faltan = [];
    fs.forEach((f, i) => {
      if (String(f.tipo || "").toLowerCase() !== "entrada") return;
      const t = new Date(f.timestamp).getTime();
      if (t < corte || t > limite) return; // fuera de la ventana, o turno todavía en curso
      const sig = fs[i + 1];
      const cierra = sig && String(sig.tipo || "").toLowerCase() === "salida" && new Date(sig.timestamp).getTime() - t <= HORAS_TURNO_MAX * 3600000;
      if (!cierra) faltan.push(new Date(f.timestamp));
    });
    if (faltan.length) out.push({ legajo: leg, nombre: e ? `${e.apellido}, ${e.nombre}` : `Legajo ${leg}`, sector: (e && e.sector) || "", dias: faltan });
  });
  return out.sort((a, b) => b.dias.length - a.dias.length || a.nombre.localeCompare(b.nombre));
}

export function fechaCorta(d) {
  return d.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "numeric" });
}

// Sifoncito avisa una vez por día (o nunca más, si se lo piden) al entrar al panel.
const diaLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function avisarConSifoncito(irA) {
  const hoy = diaLocal(new Date());
  let mem = {};
  try { mem = JSON.parse(localStorage.getItem("rrhh_ayudante") || "{}") || {}; } catch { /* sin storage */ }
  if (mem.salidas === "nunca" || (mem.salidas && mem.salidas > hoy)) return;
  const A = window.AyudaAnafer;
  if (!A || !A.sugerir) return;
  let lista;
  try { lista = await salidasSinFichar(7); } catch { return; }
  if (!lista.length) return;
  const guardar = (v) => { mem.salidas = v; try { localStorage.setItem("rrhh_ayudante", JSON.stringify(mem)); } catch { /* sin storage */ } };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const items = lista.slice(0, 8).map((x) =>
    `<li><span><b>${esc(x.nombre)}</b><small>${x.dias.length} ${x.dias.length === 1 ? "día" : "días"} sin salida: ${x.dias.map(fechaCorta).join(", ")}</small></span></li>`).join("");
  const mas = lista.length > 8 ? `<div class="sug-nota">…y ${lista.length - 8} más.</div>` : "";
  const total = lista.reduce((t, x) => t + x.dias.length, 0);
  const manana = diaLocal(new Date(Date.now() + 86400000));
  A.sugerir({
    id: "rrhh-salidas",
    titulo: "Sifoncito: salidas sin fichar",
    texto: `En los últimos 7 días quedaron <b>${total} turno${total === 1 ? "" : "s"}</b> sin fichar la salida (${lista.length} persona${lista.length === 1 ? "" : "s"}). Conviene corregirlos para que las horas den bien:`,
    cuerpo: `<ul class="sug-lista">${items}</ul>${mas}`,
    textoAhoraNo: "Mañana me recordás",
    ahoraNo: () => guardar(manana),
    nunca: () => guardar("nunca"),
    textoNunca: "No me avises más de esto",
    botones: [{ texto: "Ir a corregir fichadas", pri: true, accion: () => { guardar(manana); irA("fichadas"); } }],
  });
}

// La voz de Sifoncito (mujer, español de Argentina del interior) la arma el
// servidor (Edge Function sifoncito-voz). Si no está, usa la del navegador.
export function registrarVozSifoncito() {
  const A = window.AyudaAnafer;
  if (A && A.usarVozServidor) A.usarVozServidor((texto) => sbFuncion("sifoncito-voz", { texto }));
}

// Computadoras que esperan aprobación para fichar (empleados que fichan desde su PC).
export async function avisarEquiposPendientes(irA) {
  const A = window.AyudaAnafer;
  if (!A || !A.sugerir) return;
  let l;
  try { l = await sbGet("equipos_fichaje?select=legajo&estado=eq.pendiente"); } catch { return; }
  if (!l || !l.length) return;
  A.sugerir({
    id: "rrhh-equipos",
    titulo: "Sifoncito: computadoras para aprobar",
    texto: `Hay <b>${l.length} computadora${l.length === 1 ? "" : "s"}</b> esperando que la apruebes para fichar.`,
    botones: [{ texto: "Revisarlas", pri: true, accion: () => irA("dispositivos") }],
  });
}
