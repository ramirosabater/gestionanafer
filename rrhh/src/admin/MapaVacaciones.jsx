import { useState, useEffect, useMemo } from "react";
import { sbGet } from "./supabase-admin.js";
import { Banda, Panel, Kpi, C } from "./charts.jsx";

// Mapa de vacaciones: a golpe de vista quién está de vacaciones, por sector,
// en el día elegido, y el calendario del mes de cada sector.
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const masDias = (s, n) => { const d = new Date(s + "T12:00:00"); d.setDate(d.getDate() + n); return iso(d); };
const corta = (s) => (s ? new Date(s + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" }) : "");
const AZUL = "#2ba9e0", AMBAR = "#eda100";
const iniciales = (e) => `${(e.nombre || "").trim()[0] || ""}${(e.apellido || "").trim()[0] || ""}`.toUpperCase();

export function estadoEnFecha(vacs, legajo, dia) {
  const l = vacs.filter((v) => v.legajo === legajo && v.fecha_desde <= dia && v.fecha_hasta >= dia);
  return l.find((v) => v.estado === "aprobada") || l.find((v) => v.estado === "pendiente") || null;
}

export default function MapaVacaciones() {
  const [dia, setDia] = useState(iso(new Date()));
  const [emps, setEmps] = useState([]);
  const [vacs, setVacs] = useState([]);
  const [sector, setSector] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const mes = dia.slice(0, 7);
  const ini = `${mes}-01`;
  const fin = iso(new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0));
  useEffect(() => {
    let cancel = false;
    (async () => {
      setCargando(true); setError(null);
      try {
        const desde = ini, hasta = masDias(fin, 31);
        const [e, v] = await Promise.all([
          sbGet("empleados?select=legajo,apellido,nombre,sector,activo&order=apellido.asc"),
          sbGet(`solicitudes?select=id,legajo,fecha_desde,fecha_hasta,estado,periodo&tipo=eq.vacaciones&estado=in.(aprobada,pendiente)&fecha_hasta=gte.${desde}&fecha_desde=lte.${hasta}&limit=5000`),
        ]);
        if (cancel) return;
        setEmps(e.filter((x) => x.activo !== false)); setVacs(v);
      } catch { if (!cancel) setError("No se pudieron cargar las vacaciones."); }
      finally { if (!cancel) setCargando(false); }
    })();
    return () => { cancel = true; };
  }, [mes]); // eslint-disable-line react-hooks/exhaustive-deps

  const sectores = useMemo(() => [...new Set(emps.map((e) => e.sector || "Sin sector"))].sort((a, b) => a.localeCompare(b)), [emps]);
  const datos = useMemo(() => {
    const prox7 = masDias(dia, 7);
    const porSector = {};
    let deVac = 0, pend = 0, salen = 0, vuelven = 0;
    emps.forEach((e) => {
      const sec = e.sector || "Sin sector";
      if (sector && sec !== sector) return;
      const v = estadoEnFecha(vacs, e.legajo, dia);
      const prox = vacs.filter((x) => x.legajo === e.legajo && x.estado === "aprobada" && x.fecha_desde > dia).sort((a, b) => a.fecha_desde.localeCompare(b.fecha_desde))[0];
      const est = v ? (v.estado === "aprobada" ? "vac" : "pend") : "trab";
      if (est === "vac") { deVac++; if (v.fecha_hasta < prox7) vuelven++; }
      if (est === "pend") pend++;
      if (prox && prox.fecha_desde <= prox7) salen++;
      (porSector[sec] = porSector[sec] || []).push({ ...e, est, v, prox });
    });
    return { porSector, deVac, pend, salen, vuelven, total: Object.values(porSector).reduce((t, l) => t + l.length, 0) };
  }, [emps, vacs, dia, sector]);

  const diasMes = useMemo(() => { const n = Number(fin.slice(8, 10)); return Array.from({ length: n }, (_, i) => `${mes}-${pad(i + 1)}`); }, [mes, fin]);
  const hoy = iso(new Date());
  const titDia = new Date(dia + "T12:00:00").toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
  const btn = "w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white text-lg leading-none";

  return (
    <div className="space-y-4">
      <Banda titulo="Mapa de vacaciones" subtitulo={`Quién está de vacaciones, por sector · ${titDia}`}>
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="bg-white/15 text-white border border-white/25 rounded-lg px-3 py-1.5 text-sm outline-none [&>option]:text-[#1f2d38]">
          <option value="">Todos los sectores</option>
          {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="flex items-center gap-2">
          <button onClick={() => setDia(masDias(dia, -1))} className={btn} title="Día anterior">‹</button>
          <input type="date" value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} className="bg-white/15 text-white border border-white/25 rounded-lg px-2 py-1 text-sm outline-none [color-scheme:dark]" data-dia />
          <button onClick={() => setDia(masDias(dia, 1))} className={btn} title="Día siguiente">›</button>
          {dia !== hoy && <button onClick={() => setDia(hoy)} className="px-3 py-1.5 rounded-lg bg-white/20 text-white text-xs font-bold">Hoy</button>}
        </div>
      </Banda>

      {error && <p className="text-[#e5484d] text-center py-6">{error}</p>}
      {cargando && !error && <p className="text-[#5c6b78] text-center py-12">Cargando…</p>}
      {!cargando && !error && (<>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-kpis>
          <Kpi label="De vacaciones" valor={`${datos.deVac} de ${datos.total}`} sub={datos.total ? `${Math.round((datos.deVac / datos.total) * 100)}% del personal` : ""} color={AZUL} icono="🏖" />
          <Kpi label="Pidieron y falta aprobar" valor={datos.pend} sub="en este día" color={AMBAR} icono="⏳" />
          <Kpi label="Salen en los próximos 7 días" valor={datos.salen} color={C.navy} icono="🧳" />
          <Kpi label="Vuelven en los próximos 7 días" valor={datos.vuelven} color={C.verde} icono="↩️" />
        </div>

        <div className="flex flex-wrap gap-3 text-[11px] text-[#5c6b78]">
          <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: C.verde }} /> Trabajando</span>
          <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: AZUL }} /> De vacaciones</span>
          <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: AMBAR }} /> Pidió vacaciones (falta aprobar)</span>
        </div>

        {/* Tarjetas por sector: el día elegido */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-sectores>
          {Object.keys(datos.porSector).sort((a, b) => a.localeCompare(b)).map((sec) => {
            const l = datos.porSector[sec], fuera = l.filter((x) => x.est === "vac").length, pct = l.length ? fuera / l.length : 0;
            const colBarra = pct >= 0.5 ? C.rojo : pct >= 0.25 ? AMBAR : AZUL;
            return (
              <Panel key={sec} titulo={sec} sub={`${fuera} de ${l.length} de vacaciones`} acento={colBarra}
                derecha={<span className="text-xs font-black tabular-nums" style={{ color: colBarra }}>{Math.round(pct * 100)}%</span>}>
                <div className="h-1.5 rounded-full bg-[#eef1f4] overflow-hidden mb-3"><div className="h-full rounded-full" style={{ width: `${pct * 100}%`, backgroundColor: colBarra }} /></div>
                <div className="flex flex-wrap gap-1.5" data-sector={sec}>
                  {l.map((e) => {
                    const c = e.est === "vac" ? AZUL : e.est === "pend" ? AMBAR : C.verde;
                    const det = e.est === "vac" ? `De vacaciones del ${corta(e.v.fecha_desde)} al ${corta(e.v.fecha_hasta)}` : e.est === "pend" ? `Pidió del ${corta(e.v.fecha_desde)} al ${corta(e.v.fecha_hasta)} (falta aprobar)` : e.prox ? `Trabajando · próximas vacaciones: ${corta(e.prox.fecha_desde)}` : "Trabajando";
                    return (
                      <span key={e.legajo} title={`${e.apellido}, ${e.nombre} — ${det}`} data-emp={e.legajo} data-est={e.est}
                        className="inline-flex items-center gap-1.5 rounded-full pl-0.5 pr-2.5 py-0.5 text-[11px] border"
                        style={{ borderColor: `${c}66`, backgroundColor: e.est === "trab" ? "#fff" : `${c}14` }}>
                        <span className="w-6 h-6 rounded-full grid place-items-center text-[10px] font-bold text-white shrink-0" style={{ backgroundColor: c }}>{e.est === "vac" ? "🏖" : iniciales(e)}</span>
                        <span className="font-medium text-[#1f2d38]">{e.apellido}</span>
                        {e.est === "vac" && <span className="text-[#2b7fa8]">hasta {corta(e.v.fecha_hasta)}</span>}
                        {e.est === "pend" && <span className="text-[#a26f00]">pidió</span>}
                        {e.est === "trab" && e.prox && e.prox.fecha_desde <= masDias(dia, 30) && <span className="text-[#94a1ab]">sale {corta(e.prox.fecha_desde)}</span>}
                      </span>
                    );
                  })}
                </div>
              </Panel>
            );
          })}
        </div>

        {/* Calendario del mes: una fila por empleado, agrupado por sector */}
        <Panel titulo={`Calendario de ${new Date(ini + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" })}`} sub="Tocá un día para ver cómo queda cada sector ese día" acento={AZUL}>
          <div className="overflow-x-auto" data-calendario>
            <table className="text-[10px] border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th className="sticky left-0 bg-white text-left pr-2 font-semibold text-[#94a1ab] min-w-[150px]">Empleado</th>
                  {diasMes.map((d) => {
                    const dow = new Date(d + "T12:00:00").getDay();
                    return <th key={d} onClick={() => setDia(d)} className="cursor-pointer px-0 font-semibold w-6 min-w-[22px]"
                      style={{ color: d === dia ? C.rojo : dow === 0 || dow === 6 ? "#cfd6dd" : "#94a1ab" }}>{Number(d.slice(8))}</th>;
                  })}
                </tr>
              </thead>
              <tbody>
                {Object.keys(datos.porSector).sort((a, b) => a.localeCompare(b)).map((sec) => [
                  <tr key={`s-${sec}`}><td colSpan={diasMes.length + 1} className="sticky left-0 bg-white pt-2 pb-0.5 text-[11px] font-bold text-[#223c7e]">{sec}</td></tr>,
                  ...datos.porSector[sec].map((e) => (
                    <tr key={e.legajo}>
                      <td className="sticky left-0 bg-white pr-2 text-[11px] text-[#1f2d38] whitespace-nowrap">{e.apellido}, {e.nombre}</td>
                      {diasMes.map((d) => {
                        const v = estadoEnFecha(vacs, e.legajo, d), dow = new Date(d + "T12:00:00").getDay();
                        const bg = v ? (v.estado === "aprobada" ? AZUL : AMBAR) : dow === 0 || dow === 6 ? "#f4f6f8" : "#fbfcfd";
                        return <td key={d} onClick={() => setDia(d)} title={v ? `${corta(v.fecha_desde)} al ${corta(v.fecha_hasta)}${v.estado === "pendiente" ? " (falta aprobar)" : ""}` : ""}
                          className="h-5 cursor-pointer" style={{ backgroundColor: bg, borderRight: "1px solid #fff", borderBottom: "1px solid #fff", outline: d === dia ? `1.5px solid ${C.rojo}` : undefined }} data-celda={v ? v.estado : ""} />;
                      })}
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </Panel>
      </>)}
    </div>
  );
}
