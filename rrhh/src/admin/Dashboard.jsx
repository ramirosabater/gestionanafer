import { useState, useEffect, useMemo } from "react";
import { sbGet, sbGetAll } from "./supabase-admin.js";
import { calcularPeriodo, etiquetaPeriodo } from "../lib/fichaje.js";
import { C, ESTADO, Banda, Panel, Kpi, Dona, Anillo, BarrasV, BarrasH, Linea, Leyenda, Vacio } from "./charts.jsx";

const fmtH = (min) => `${Math.floor(Math.round(min) / 60).toLocaleString("es-AR")}h ${String(Math.round(min) % 60).padStart(2, "0")}m`;
const fmtHc = (min) => `${Math.round(min / 60).toLocaleString("es-AR")} h`;
const DIAS_SEM = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const edadDe = (iso, ref) => { const n = new Date(iso + "T12:00:00"); let e = ref.getFullYear() - n.getFullYear(); const m = ref.getMonth() - n.getMonth(); if (m < 0 || (m === 0 && ref.getDate() < n.getDate())) e--; return e; };
const tramo = (v, cortes) => cortes.find((c) => v >= c.min && v <= c.max)?.label;

function origenDe(f) {
  const ua = f.user_agent || "";
  if (ua.startsWith("Reloj")) return "reloj";
  if (ua.startsWith("Corrección")) return "manual";
  return f.local_id ? "app" : "remota";
}

function calcular(fichajes, empleados, desde, hasta) {
  const activos = {}; empleados.forEach((e) => { if (e.activo !== false) activos[e.legajo] = e; });
  const fs = fichajes.filter((f) => activos[f.legajo]).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const sector = (lg) => activos[lg]?.sector || "Sin sector";

  const est = { a_horario: 0, tarde: 0, sin_turno: 0 };
  const origen = { app: 0, remota: 0, reloj: 0, manual: 0 };
  let salidasAnt = 0, minTarde = 0, minRetiro = 0, trabMin = 0;
  const porSector = {}; // sector -> {aHorario, tarde, trabMin, personas:Set}
  const porDia = {};    // yyyy-mm-dd -> Set legajos
  const horaEntrada = {}; // slot -> n
  const tardesSem = [0, 0, 0, 0, 0, 0, 0];
  const porEmp = {};
  const pend = {};
  const S = (s) => (porSector[s] ||= { aHorario: 0, tarde: 0, trabMin: 0, conFichadas: new Set() });

  for (const f of fs) {
    const d = new Date(f.timestamp), sec = sector(f.legajo), e = (porEmp[f.legajo] ||= { legajo: f.legajo, tarde: 0, minTarde: 0, entradas: 0, aHorario: 0, salAnt: 0 });
    origen[origenDe(f)]++;
    S(sec).conFichadas.add(f.legajo);
    if (f.tipo === "entrada") {
      e.entradas++;
      if (est[f.estado] != null) est[f.estado]++;
      if (f.estado === "tarde") { S(sec).tarde++; e.tarde++; tardesSem[d.getDay()]++; if (!f.autorizado) { minTarde += Number(f.minutos_tarde) || 0; e.minTarde += Number(f.minutos_tarde) || 0; } }
      if (f.estado === "a_horario") { S(sec).aHorario++; e.aHorario++; }
      const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      (porDia[k] ||= new Set()).add(f.legajo);
      const min = d.getHours() * 60 + d.getMinutes();
      const slot = Math.max(4 * 60, Math.min(13 * 60, Math.floor(min / 30) * 30));
      horaEntrada[slot] = (horaEntrada[slot] || 0) + 1;
      pend[f.legajo] = d;
    } else if (f.tipo === "salida") {
      if (f.estado === "salida_anticipada") { salidasAnt++; e.salAnt++; if (!f.autorizado) minRetiro += Number(f.minutos_tarde) || 0; }
      if (pend[f.legajo]) {
        const m = (d - pend[f.legajo]) / 60000;
        if (m > 0 && m < 20 * 60) { trabMin += m; S(sec).trabMin += m; }
        pend[f.legajo] = null;
      }
    }
  }

  // Serie diaria del mes
  const dias = [];
  const hoy = new Date();
  for (let d = new Date(desde); d <= hasta && d <= hoy; d.setDate(d.getDate() + 1)) {
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    dias.push({ label: String(d.getDate()), titulo: `${DIAS_SEM[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`, valor: porDia[k]?.size || 0 });
  }

  // Personal por sector (activos) y estructura
  const personal = {};
  Object.values(activos).forEach((e) => { personal[e.sector || "Sin sector"] = (personal[e.sector || "Sin sector"] || 0) + 1; });
  const ref = new Date();
  const conNac = Object.values(activos).filter((e) => e.fecha_nacimiento);
  const conIng = Object.values(activos).filter((e) => e.fecha_ingreso);
  const EDADES = [{ label: "18-25", min: 0, max: 25 }, { label: "26-35", min: 26, max: 35 }, { label: "36-45", min: 36, max: 45 }, { label: "46-55", min: 46, max: 55 }, { label: "56+", min: 56, max: 200 }];
  const ANTIG = [{ label: "< 1 año", min: 0, max: 0 }, { label: "1-2", min: 1, max: 2 }, { label: "3-5", min: 3, max: 5 }, { label: "6-10", min: 6, max: 10 }, { label: "+10", min: 11, max: 200 }];
  const edades = Object.fromEntries(EDADES.map((t) => [t.label, 0]));
  conNac.forEach((e) => { const t = tramo(edadDe(e.fecha_nacimiento, ref), EDADES); if (t) edades[t]++; });
  const antig = Object.fromEntries(ANTIG.map((t) => [t.label, 0]));
  conIng.forEach((e) => { const t = tramo(Math.max(0, edadDe(e.fecha_ingreso, ref)), ANTIG); if (t) antig[t]++; });

  const lista = Object.values(porEmp).map((x) => ({ ...x, e: activos[x.legajo] }));
  const entradasConTurno = est.a_horario + est.tarde;
  return {
    activos: Object.keys(activos).length,
    conFichadas: Object.keys(porEmp).length,
    totalFichadas: fs.length,
    trabMin, minTarde, minRetiro, salidasAnt, est, origen,
    puntualidad: entradasConTurno ? (est.a_horario / entradasConTurno) * 100 : null,
    sectores: Object.entries(porSector).map(([s, v]) => ({ s, ...v, conFichadas: v.conFichadas.size })).sort((a, b) => b.trabMin - a.trabMin),
    personal: Object.entries(personal).sort((a, b) => b[1] - a[1]),
    dias, horaEntrada, tardesSem,
    edades, antig, conNac: conNac.length, conIng: conIng.length,
    masTarde: lista.filter((x) => x.tarde > 0).sort((a, b) => b.tarde - a.tarde || b.minTarde - a.minTarde).slice(0, 8),
    puntuales: lista.filter((x) => x.entradas >= 3 && x.aHorario + x.tarde > 0)
      .map((x) => ({ ...x, p: (x.aHorario / (x.aHorario + x.tarde)) * 100 }))
      .sort((a, b) => b.p - a.p || b.entradas - a.entradas).slice(0, 8),
  };
}

export default function Dashboard() {
  const [refMes, setRefMes] = useState(new Date());
  const [sector, setSector] = useState("");
  const [fichajes, setFichajes] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const { desde, hasta } = calcularPeriodo(refMes);

  useEffect(() => {
    const base = "empleados?select=legajo,nombre,apellido,sector,activo";
    sbGet(`${base},fecha_nacimiento,fecha_ingreso`).catch(() => sbGet(base)).then(setEmpleados).catch(() => setError("No se pudieron cargar los empleados."));
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargando(true); setError(null);
      try {
        const q = `fichajes?select=id,legajo,tipo,timestamp,estado,minutos_tarde,local_id,user_agent,autorizado&timestamp=gte.${desde.toISOString()}&timestamp=lte.${hasta.toISOString()}&order=timestamp.asc,id.asc`;
        let fs; try { fs = await sbGetAll(q); } catch { fs = await sbGetAll(q.replace(",autorizado", "")); }
        if (!cancel) setFichajes(fs);
      } catch { if (!cancel) setError("No se pudieron cargar las estadísticas."); }
      finally { if (!cancel) setCargando(false); }
    })();
    return () => { cancel = true; };
  }, [refMes]); // eslint-disable-line

  const sectores = useMemo(() => [...new Set(empleados.map((e) => e.sector).filter(Boolean))].sort(), [empleados]);
  const d = useMemo(() => {
    if (!fichajes || !empleados.length) return null;
    const emps = sector ? empleados.filter((e) => e.sector === sector) : empleados;
    return calcular(fichajes, emps, desde, hasta);
  }, [fichajes, empleados, sector]); // eslint-disable-line

  const mesBtn = "w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white text-lg leading-none";

  return (
    <div className="space-y-4">
      <Banda titulo="Dashboard de RR.HH." subtitulo={`Asistencia y puntualidad · ${etiquetaPeriodo(desde, hasta)}${sector ? ` · ${sector}` : ""}`}>
        <select value={sector} onChange={(e) => setSector(e.target.value)}
          className="bg-white/15 text-white border border-white/25 rounded-lg px-3 py-1.5 text-sm outline-none [&>option]:text-[#1f2d38]">
          <option value="">Todos los sectores</option>
          {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => setRefMes((x) => new Date(x.getFullYear(), x.getMonth() - 1, 1))} className={mesBtn}>‹</button>
          <span className="text-sm font-bold min-w-[120px] text-center">{(() => { const t = etiquetaPeriodo(desde, hasta); return t.charAt(0).toUpperCase() + t.slice(1); })()}</span>
          <button onClick={() => setRefMes((x) => new Date(x.getFullYear(), x.getMonth() + 1, 1))} className={mesBtn}>›</button>
        </div>
      </Banda>

      {error && <p className="text-[#e5484d] text-center py-6">{error}</p>}
      {(cargando || !d) && !error && <p className="text-[#5c6b78] text-center py-16">Calculando estadísticas…</p>}

      {d && !cargando && (
        <>
          {/* Fila de KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
            <Kpi label="Personal activo" valor={d.activos.toLocaleString("es-AR")} sub={`${d.conFichadas} con fichadas en el mes`} color={C.navy} icono="👥" />
            <Kpi label="Horas trabajadas" valor={fmtHc(d.trabMin)} sub={d.conFichadas ? `${fmtH(d.trabMin / d.conFichadas)} por persona` : "—"} color={C.azul} icono="⏱️" />
            <Kpi label="Puntualidad" valor={d.puntualidad == null ? "—" : `${d.puntualidad.toFixed(0)}%`} sub={`${d.est.a_horario} entradas a horario`} color={C.verde} icono="✅" />
            <Kpi label="Llegadas tarde" valor={d.est.tarde} sub={`${fmtH(d.minTarde)} acumuladas`} color={C.rojo} icono="⏰" />
            <Kpi label="Salidas anticipadas" valor={d.salidasAnt} sub={`${fmtH(d.minRetiro)} acumuladas`} color={C.ambar} icono="🚪" />
            <Kpi label="Fichadas del mes" valor={d.totalFichadas.toLocaleString("es-AR")} sub={`${d.origen.reloj} del reloj · ${d.origen.manual} manuales`} color={C.celeste} icono="📍" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Panel titulo="Entradas por estado" sub="Cómo llegó la gente este mes" acento={C.verde} className="lg:col-span-4">
              <Dona centro={d.puntualidad == null ? "—" : `${d.puntualidad.toFixed(0)}%`} centroSub="puntualidad"
                datos={[
                  { label: "A horario", valor: d.est.a_horario, color: ESTADO.a_horario },
                  { label: "Tarde", valor: d.est.tarde, color: ESTADO.tarde },
                  { label: "Sin turno asignado", valor: d.est.sin_turno, color: ESTADO.sin_turno },
                ]} />
            </Panel>
            <Panel titulo="Origen de las fichadas" sub="Desde dónde se registró cada marca" acento={C.celeste} className="lg:col-span-4">
              <Dona centro={d.totalFichadas.toLocaleString("es-AR")} centroSub="fichadas"
                datos={[
                  { label: "App en la ubicación", valor: d.origen.app, color: C.azul },
                  { label: "Reloj importado", valor: d.origen.reloj, color: C.celeste },
                  { label: "App fuera de ubicación", valor: d.origen.remota, color: C.ambar },
                  { label: "Corrección manual", valor: d.origen.manual, color: C.gris },
                ]} />
            </Panel>
            <Panel titulo="Personal por sector" sub="Empleados activos" acento={C.navy} className="lg:col-span-4">
              {d.personal.length ? <BarrasH filas={d.personal.slice(0, 8).map(([s, n]) => ({ label: s, valor: n }))} color={C.navy} /> : <Vacio />}
            </Panel>

            <Panel titulo="Entradas por sector: a horario vs. tarde" acento={C.rojo} className="lg:col-span-7"
              derecha={<Leyenda items={[{ label: "A horario", color: ESTADO.a_horario }, { label: "Tarde", color: ESTADO.tarde }]} />}>
              {d.sectores.length ? (
                <BarrasV categorias={d.sectores.map((s) => s.s)}
                  ancho={620} series={[{ nombre: "A horario", color: ESTADO.a_horario, valores: d.sectores.map((s) => s.aHorario) },
                    { nombre: "Tarde", color: ESTADO.tarde, valores: d.sectores.map((s) => s.tarde) }]} />
              ) : <Vacio />}
            </Panel>
            <Panel titulo="Horas trabajadas por sector" acento={C.azul} className="lg:col-span-5">
              {d.sectores.length ? <BarrasH filas={d.sectores.slice(0, 8).map((s) => ({ label: s.s, valor: s.trabMin }))} fmt={fmtHc} color={C.azul} /> : <Vacio />}
            </Panel>

            <Panel titulo="Personas que ficharon por día" sub="Cantidad de empleados distintos con al menos una entrada" acento={C.azul} className="lg:col-span-12">
              {d.dias.length ? <Linea puntos={d.dias} color={C.azul} alto={230} ancho={1080} /> : <Vacio />}
            </Panel>

            <Panel titulo="Hora de entrada" sub="Entradas cada media hora" acento={C.celeste} className="lg:col-span-5">
              {Object.keys(d.horaEntrada).length ? (() => {
                const slots = []; for (let m = 5 * 60; m <= 12 * 60; m += 30) slots.push(m);
                const lab = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                return <BarrasV categorias={slots.map(lab)} series={[{ nombre: "Entradas", color: C.celeste, valores: slots.map((m) => d.horaEntrada[m] || 0) }]} alto={210} ancho={440} />;
              })() : <Vacio />}
            </Panel>
            <Panel titulo="Llegadas tarde por día de la semana" acento={C.rojo} className="lg:col-span-4">
              <BarrasV categorias={["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]}
                series={[{ nombre: "Llegadas tarde", color: C.rojo, valores: [1, 2, 3, 4, 5, 6, 0].map((i) => d.tardesSem[i]) }]} alto={210} ancho={350} />
            </Panel>
            <Panel titulo="Trabajado vs. tiempo perdido" acento={C.verde} className="lg:col-span-3">
              <div className="flex flex-col items-center gap-2 pt-2">
                <Anillo pct={d.trabMin + d.minTarde + d.minRetiro ? (d.trabMin / (d.trabMin + d.minTarde + d.minRetiro)) * 100 : null} color={C.verde} size={120} grosor={14} label="aprovechado" />
                <p className="text-[11px] text-[#5c6b78] text-center">{fmtHc(d.trabMin)} trabajadas<br /><span className="text-[#e1251b] font-semibold">{fmtH(d.minTarde + d.minRetiro)}</span> perdidas por tardanzas y salidas</p>
              </div>
            </Panel>

            <Panel titulo="Personal por rango de edad" acento={C.ambar} className="lg:col-span-6"
              sub={`${d.conNac} de ${d.activos} con fecha de nacimiento cargada en la ficha`}>
              {d.conNac ? <BarrasV categorias={Object.keys(d.edades)} series={[{ nombre: "Empleados", color: C.ambar, valores: Object.values(d.edades) }]} alto={200} ancho={520} />
                : <Vacio texto="Cargá la fecha de nacimiento en Personal → Empleados → Ficha para ver este gráfico." />}
            </Panel>
            <Panel titulo="Personal por antigüedad" acento={C.verde} className="lg:col-span-6"
              sub={`${d.conIng} de ${d.activos} con fecha de ingreso cargada en la ficha`}>
              {d.conIng ? <BarrasV categorias={Object.keys(d.antig)} series={[{ nombre: "Empleados", color: C.verde, valores: Object.values(d.antig) }]} alto={200} ancho={520} />
                : <Vacio texto="Cargá la fecha de ingreso en Personal → Empleados → Ficha para ver este gráfico." />}
            </Panel>

            <Panel titulo="Más llegadas tarde" sub="Cantidad en el mes (minutos al lado del nombre)" acento={C.rojo} className="lg:col-span-6">
              {d.masTarde.length ? <BarrasH alAncho={150} color={C.rojo}
                filas={d.masTarde.map((x) => ({ label: `${x.e?.apellido || x.legajo} (${x.minTarde}′)`, title: `${x.e?.apellido}, ${x.e?.nombre}`, valor: x.tarde }))} />
                : <Vacio texto="No hubo llegadas tarde este mes. 🎉" />}
            </Panel>
            <Panel titulo="Más puntuales" sub="% de entradas a horario (mínimo 3 entradas)" acento={C.verde} className="lg:col-span-6">
              {d.puntuales.length ? <BarrasH alAncho={150} color={C.verde} max={100} fmt={(v) => `${Math.round(v)}%`}
                filas={d.puntuales.map((x) => ({ label: `${x.e?.apellido || x.legajo}`, title: `${x.e?.apellido}, ${x.e?.nombre} · ${x.entradas} entradas`, valor: x.p }))} />
                : <Vacio texto="Todavía no hay empleados con turno y 3 entradas en el mes." />}
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
