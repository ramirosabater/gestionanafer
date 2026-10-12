import { useState, useEffect, useMemo } from "react";
import { sbGet, sbGetAll } from "./supabase-admin.js";
import { computarCumplimiento, cargarConfig } from "../lib/cumplimiento.js";
import { generarXlsx, descargarBytes } from "./xlsx.js";
import { C, Banda, Panel, Kpi, Dona, BarrasV, BarrasH, Linea, Leyenda, Vacio } from "./charts.jsx";

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const ymKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const ymLabel = (k) => `${MESES[+k.slice(5) - 1]} ${k.slice(2, 4)}`;
const ymLargo = (k) => { const t = new Date(+k.slice(0, 4), +k.slice(5) - 1, 1).toLocaleDateString("es-AR", { month: "long", year: "numeric" }); return t.charAt(0).toUpperCase() + t.slice(1); };
const sumarMes = (k, n) => ymKey(new Date(+k.slice(0, 4), +k.slice(5) - 1 + n, 1));
const h1 = (min) => Math.round(min / 6) / 10; // minutos → horas con 1 decimal
const fmtH = (min) => { const t = Math.round(min); return `${Math.floor(t / 60).toLocaleString("es-AR")}h ${String(t % 60).padStart(2, "0")}m`; };
const fmtN = (n) => Math.round(n).toLocaleString("es-AR");
const pct = (a, b) => (b ? (a / b) * 100 : null);

// Métricas disponibles: cómo se muestran y cómo se grafican
const METRICAS = [
  { id: "horas", label: "Horas trabajadas", fmt: fmtH, chart: (r) => r.trabajadoMin / 60, val: (r) => r.trabajadoMin, color: C.azul, icono: "⏱️", fmtEje: (v) => `${Math.round(v)}h` },
  { id: "presentismo", label: "Presentismo", fmt: (v) => (v == null ? "—" : `${v.toFixed(1)}%`), chart: (r) => r.presentismo ?? 0, val: (r) => r.presentismo, color: C.verde, icono: "✅", fmtEje: (v) => `${Math.round(v)}%` },
  { id: "ausencias", label: "Días sin registro", fmt: fmtN, chart: (r) => r.sinRegistro, val: (r) => r.sinRegistro, color: C.navy, icono: "📭" },
  { id: "tardes", label: "Llegadas tarde", fmt: fmtN, chart: (r) => r.tardes, val: (r) => r.tardes, color: C.rojo, icono: "⏰" },
  { id: "minTarde", label: "Minutos tarde", fmt: fmtN, chart: (r) => r.minTarde, val: (r) => r.minTarde, color: C.rojo, icono: "⌛" },
  { id: "salidas", label: "Salidas anticipadas", fmt: fmtN, chart: (r) => r.salidas, val: (r) => r.salidas, color: C.ambar, icono: "🚪" },
  { id: "incompletas", label: "Fichadas incompletas", fmt: fmtN, chart: (r) => r.sinEntrada + r.sinSalida, val: (r) => r.sinEntrada + r.sinSalida, color: C.celeste, icono: "⚠️" },
  { id: "extra100", label: "Horas al 100%", fmt: fmtH, chart: (r) => r.horas100Min / 60, val: (r) => r.horas100Min, color: C.verde, icono: "💰", fmtEje: (v) => `${Math.round(v)}h` },
];

function acumVacio() {
  return { trabajadoMin: 0, diasEsperados: 0, diasTrabajados: 0, sinRegistro: 0, sinEntrada: 0, sinSalida: 0,
    tardes: 0, minTarde: 0, salidas: 0, minRetiro: 0, horas50Min: 0, horas100Min: 0, empleados: 0 };
}
function sumar(a, c, extra) {
  a.trabajadoMin += c.trabajadoMin; a.horas50Min += c.horas50Min; a.horas100Min += c.horas100Min;
  a.minTarde += c.minTarde; a.minRetiro += c.minRetiro;
  if (!c.sinTurno) {
    a.diasEsperados += c.diasEsperados; a.diasTrabajados += c.diasTrabajados;
    a.sinRegistro += c.sinRegistro; a.sinEntrada += c.sinEntrada; a.sinSalida += c.sinSalida;
  }
  a.tardes += extra.tardes; a.salidas += extra.salidas;
}
const cerrar = (a) => ({ ...a, presentismo: pct(a.diasTrabajados, a.diasEsperados) });

const selCls = "bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1";
const labelCls = "text-[10px] uppercase tracking-wider text-[#94a1ab]";

export default function Indicadores() {
  const hoyYM = ymKey(new Date());
  const [empleados, setEmpleados] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [horarios, setHorarios] = useState({});
  const [config, setConfig] = useState({ recargos: [], feriados: {} });
  const [sector, setSector] = useState("");
  const [legajo, setLegajo] = useState("");
  const [desdeYM, setDesdeYM] = useState(sumarMes(hoyYM, -5));
  const [hastaYM, setHastaYM] = useState(hoyYM);
  const [metrica, setMetrica] = useState("horas");
  const [fichajes, setFichajes] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [orden, setOrden] = useState({ col: "trabajadoMin", asc: false });

  useEffect(() => {
    (async () => {
      try {
        const base = "empleados?select=legajo,apellido,nombre,sector,horario_id,activo";
        const [emps, hs] = await Promise.all([
          sbGet(`${base},fecha_ingreso&order=apellido.asc`).catch(() => sbGet(`${base}&order=apellido.asc`)),
          sbGet("horarios?select=*"),
        ]);
        setEmpleados(emps);
        const mh = {}; hs.forEach((h) => (mh[h.id] = h)); setHorarios(mh);
        try { setSectores((await sbGet("sectores?select=nombre&order=nombre.asc")).map((s) => s.nombre)); }
        catch { setSectores([...new Set(emps.map((e) => e.sector).filter(Boolean))].sort()); }
        setConfig(await cargarConfig(sbGet));
      } catch { setError("No se pudieron cargar los empleados."); }
    })();
  }, []);

  // Empleados que entran en el filtro
  const lista = useMemo(() => empleados.filter((e) =>
    e.activo !== false && (!sector || e.sector === sector) && (!legajo || String(e.legajo) === String(legajo))),
  [empleados, sector, legajo]);

  // Fichadas del rango (todas las páginas)
  useEffect(() => {
    if (!empleados.length || desdeYM > hastaYM) return;
    let cancel = false;
    (async () => {
      setCargando(true); setError(null);
      try {
        const desde = new Date(+desdeYM.slice(0, 4), +desdeYM.slice(5) - 1, 1);
        const hasta = new Date(+hastaYM.slice(0, 4), +hastaYM.slice(5), 1);
        let q = `fichajes?select=id,legajo,tipo,timestamp,estado,minutos_tarde,autorizado&timestamp=gte.${desde.toISOString()}&timestamp=lt.${hasta.toISOString()}&order=timestamp.asc,id.asc`;
        if (legajo) q += `&legajo=eq.${legajo}`;
        let fs;
        try { fs = await sbGetAll(q); }
        catch { fs = await sbGetAll(q.replace(",autorizado", "")); } // por si la columna no existe
        if (!cancel) setFichajes(fs);
      } catch { if (!cancel) setError("No se pudieron cargar las fichadas."); }
      finally { if (!cancel) setCargando(false); }
    })();
    return () => { cancel = true; };
  }, [empleados.length, desdeYM, hastaYM, legajo]);

  // Cálculo: por mes y por empleado, con el mismo criterio que el Resumen por empleado
  const calc = useMemo(() => {
    if (!fichajes) return null;
    const meses = [];
    for (let k = desdeYM; k <= hastaYM; k = sumarMes(k, 1)) meses.push(k);
    const enLista = new Set(lista.map((e) => e.legajo));
    const idx = {}; // legajo -> mes -> fichadas
    const primera = {}; // legajo -> fecha de la primera fichada del rango
    fichajes.forEach((f) => {
      if (!enLista.has(f.legajo)) return;
      const d = new Date(f.timestamp);
      ((idx[f.legajo] ||= {})[ymKey(d)] ||= []).push(f);
      if (!primera[f.legajo] || d < primera[f.legajo]) primera[f.legajo] = d;
    });
    const porMes = Object.fromEntries(meses.map((k) => [k, acumVacio()]));
    const porEmp = {};
    const hoy = new Date();
    for (const e of lista) {
      const tot = acumVacio();
      // Se cuenta desde que el empleado empezó a fichar en el sistema (o su ingreso, si es posterior):
      // los meses previos no son ausencias, es que todavía no se usaba el sistema.
      if (!primera[e.legajo]) { porEmp[e.legajo] = cerrar(tot); continue; }
      let inicio = new Date(primera[e.legajo]); inicio.setHours(0, 0, 0, 0);
      if (e.fecha_ingreso) { const fi = new Date(e.fecha_ingreso + "T00:00:00"); if (fi > inicio) inicio = fi; }
      for (const k of meses) {
        let desde = new Date(+k.slice(0, 4), +k.slice(5) - 1, 1);
        const hasta = new Date(+k.slice(0, 4), +k.slice(5), 0, 23, 59, 59, 999);
        if (desde > hoy || hasta < inicio) continue;
        if (inicio > desde) desde = inicio;
        const fs = idx[e.legajo]?.[k] || [];
        const c = computarCumplimiento(fs, horarios[e.horario_id] || null, desde, hasta, config);
        const extra = {
          tardes: fs.filter((f) => f.estado === "tarde" && !f.autorizado).length,
          salidas: fs.filter((f) => f.estado === "salida_anticipada" && !f.autorizado).length,
        };
        sumar(porMes[k], c, extra); sumar(tot, c, extra);
        if (fs.length) porMes[k].empleados++;
      }
      porEmp[e.legajo] = cerrar(tot);
    }
    const filasMes = meses.map((k) => ({ k, ...cerrar(porMes[k]) }));
    const total = acumVacio();
    filasMes.forEach((r) => {
      Object.keys(total).forEach((c) => { if (c !== "empleados") total[c] += r[c]; });
    });
    total.empleados = lista.filter((e) => idx[e.legajo]).length;
    const ps = {};
    lista.forEach((e) => {
      const r = porEmp[e.legajo], a = (ps[e.sector || "Sin sector"] ||= acumVacio());
      Object.keys(a).forEach((c) => { if (c !== "empleados") a[c] += r[c] || 0; });
      if (idx[e.legajo]) a.empleados++;
    });
    const porSector = Object.entries(ps).map(([s, a]) => ({ s, ...cerrar(a) })).sort((x, y) => y.trabajadoMin - x.trabajadoMin);
    return { meses, filasMes, total: cerrar(total), porEmp, porSector };
  }, [fichajes, lista, horarios, config, desdeYM, hastaYM]);

  const m = METRICAS.find((x) => x.id === metrica);
  const rango = (n) => { setHastaYM(hoyYM); setDesdeYM(sumarMes(hoyYM, -(n - 1))); };
  const opcionesMes = useMemo(() => { const o = []; for (let i = 0; i < 36; i++) o.push(sumarMes(hoyYM, -i)); return o; }, [hoyYM]);
  const empsDelSector = empleados.filter((e) => e.activo !== false && (!sector || e.sector === sector));

  const exportar = () => {
    if (!calc) return;
    const hM = ["Mes", "Horas trabajadas", "Días esperados", "Días trabajados", "Presentismo %", "Días sin registro", "Sin entrada", "Sin salida", "Llegadas tarde", "Min. tarde", "Salidas anticipadas", "Min. retiro", "Horas 50%", "Horas 100%"];
    const fila = (nombre, r) => [nombre, h1(r.trabajadoMin), r.diasEsperados, r.diasTrabajados, r.presentismo == null ? "" : Math.round(r.presentismo * 10) / 10,
      r.sinRegistro, r.sinEntrada, r.sinSalida, r.tardes, r.minTarde, r.salidas, r.minRetiro, h1(r.horas50Min), h1(r.horas100Min)];
    const rows = [...calc.filasMes.map((r) => fila(ymLargo(r.k), r)), fila("ACUMULADO", calc.total), [],
      ["Legajo / Empleado", ...hM.slice(1)],
      ...lista.map((e) => fila(`${e.legajo} · ${e.apellido}, ${e.nombre}${e.sector ? ` (${e.sector})` : ""}`, calc.porEmp[e.legajo]))];
    const filtro = legajo ? `leg${legajo}` : sector ? sector.replace(/\W+/g, "_") : "todos";
    descargarBytes(generarXlsx(hM, rows), `indicadores_${filtro}_${desdeYM}_a_${hastaYM}.xlsx`);
  };

  const filasEmp = calc ? lista.map((e) => ({ e, r: calc.porEmp[e.legajo] }))
    .sort((a, b) => {
      const va = orden.col === "nombre" ? `${a.e.apellido} ${a.e.nombre}` : (a.r[orden.col] ?? -1);
      const vb = orden.col === "nombre" ? `${b.e.apellido} ${b.e.nombre}` : (b.r[orden.col] ?? -1);
      return (va > vb ? 1 : va < vb ? -1 : 0) * (orden.asc ? 1 : -1);
    }) : [];
  const ordenarPor = (col) => setOrden((o) => ({ col, asc: o.col === col ? !o.asc : col === "nombre" }));

  const selOsc = "bg-white/15 text-white border border-white/25 rounded-lg px-2.5 py-1.5 text-sm outline-none mt-1 [&>option]:text-[#1f2d38]";
  const lblOsc = "text-[10px] uppercase tracking-wider text-white/70";
  const quien = legajo ? `${lista[0]?.apellido}, ${lista[0]?.nombre}` : sector || "Toda la empresa";
  const topEmp = (fn, n = 8) => (calc ? lista.map((e) => ({ e, v: fn(calc.porEmp[e.legajo]) })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v).slice(0, n) : []);

  return (
    <div className="space-y-4">
      <Banda titulo="Indicadores" subtitulo={`${quien} · acumulado de ${ymLargo(desdeYM)} a ${ymLargo(hastaYM)}`}>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className={lblOsc}>Sector</label>
            <select value={sector} onChange={(e) => { setSector(e.target.value); setLegajo(""); }} className={`${selOsc} block min-w-[150px]`}>
              <option value="">Todos los sectores</option>
              {sectores.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
          <div>
            <label className={lblOsc}>Empleado</label>
            <select value={legajo} onChange={(e) => setLegajo(e.target.value)} className={`${selOsc} block min-w-[190px] max-w-[240px]`}>
              <option value="">Todos{sector ? ` (${sector})` : ""}</option>
              {empsDelSector.map((e) => <option key={e.legajo} value={e.legajo}>{e.apellido}, {e.nombre} ({e.legajo})</option>)}
            </select>
          </div>
          <div>
            <label className={lblOsc}>Desde</label>
            <select value={desdeYM} onChange={(e) => setDesdeYM(e.target.value)} className={`${selOsc} block`}>
              {opcionesMes.slice().reverse().map((k) => <option key={k} value={k} disabled={k > hastaYM}>{ymLargo(k)}</option>)}
            </select>
          </div>
          <div>
            <label className={lblOsc}>Hasta</label>
            <select value={hastaYM} onChange={(e) => setHastaYM(e.target.value)} className={`${selOsc} block`}>
              {opcionesMes.map((k) => <option key={k} value={k} disabled={k < desdeYM}>{ymLargo(k)}</option>)}
            </select>
          </div>
          <div className="flex gap-1">
            {[3, 6, 12].map((n) => (
              <button key={n} onClick={() => rango(n)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/15 hover:bg-white/25">{n}m</button>
            ))}
          </div>
          <button onClick={exportar} disabled={!calc || cargando} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-white text-[#223c7e] disabled:opacity-50">⬇ Excel</button>
        </div>
      </Banda>

      {error && <p className="text-[#e5484d] text-sm">{error}</p>}
      {(cargando || !calc) && !error && <p className="text-[#5c6b78] text-center py-12">Calculando indicadores…</p>}

      {calc && !cargando && (
        <>
          {/* KPIs acumulados: tocá uno para graficarlo por mes */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {METRICAS.map((x) => (
              <Kpi key={x.id} label={x.label} valor={x.fmt(x.val(calc.total))} color={x.color} icono={x.icono}
                activo={x.id === metrica} onClick={() => setMetrica(x.id)}
                sub={x.id === "presentismo" ? `${fmtN(calc.total.diasTrabajados)} de ${fmtN(calc.total.diasEsperados)} días`
                  : x.id === "minTarde" && calc.total.tardes ? `≈ ${Math.round(calc.total.minTarde / calc.total.tardes)} min por llegada tarde`
                  : x.id === "horas" ? `${calc.total.empleados} empleados con fichadas` : x.id === metrica ? "▼ graficado abajo" : "tocá para graficar"} />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            <Panel titulo={`${m.label} por mes`} sub="Tocá otra tarjeta de arriba para cambiar el gráfico" acento={m.color} className="lg:col-span-8">
              <BarrasV categorias={calc.filasMes.map((r) => ymLabel(r.k))} maxFijo={metrica === "presentismo" ? 100 : undefined}
                series={[{ nombre: m.label, color: m.color, valores: calc.filasMes.map((r) => m.chart(r)) }]}
                fmt={(v) => (m.fmtEje ? m.fmtEje(v) : fmtN(v))} alto={250} ancho={720} />
            </Panel>
            <Panel titulo="Días que el turno pedía" sub="Acumulado del rango" acento={C.verde} className="lg:col-span-4">
              {calc.total.diasEsperados ? (
                <Dona centro={calc.total.presentismo == null ? "—" : `${calc.total.presentismo.toFixed(0)}%`} centroSub="presentismo" size={140}
                  datos={[
                    { label: "Completos (entrada y salida)", valor: calc.total.diasTrabajados, color: C.verde },
                    { label: "Incompletos", valor: Math.max(0, calc.total.diasEsperados - calc.total.diasTrabajados - calc.total.sinRegistro), color: C.ambar },
                    { label: "Sin registro", valor: calc.total.sinRegistro, color: C.rojo },
                  ]} />
              ) : <Vacio texto="Sin turnos asignados en este filtro: no hay días esperados." />}
            </Panel>

            <Panel titulo="Presentismo por mes" sub="Solo meses con días esperados" acento={C.verde} className="lg:col-span-6">
              <Linea color={C.verde} maxFijo={100} ancho={520} alto={220} fmt={(v) => `${Math.round(v)}%`}
                puntos={calc.filasMes.filter((r) => r.presentismo != null).map((r) => ({ label: ymLabel(r.k), titulo: ymLargo(r.k), valor: r.presentismo, extra: `${r.diasTrabajados} de ${r.diasEsperados} días` }))} />
            </Panel>
            <Panel titulo="Llegadas tarde y salidas anticipadas" acento={C.rojo} className="lg:col-span-6"
              derecha={<Leyenda items={[{ label: "Tarde", color: C.rojo }, { label: "Salida ant.", color: C.ambar }]} />}>
              <BarrasV categorias={calc.filasMes.map((r) => ymLabel(r.k))}
                ancho={520} series={[{ nombre: "Llegadas tarde", color: C.rojo, valores: calc.filasMes.map((r) => r.tardes) },
                  { nombre: "Salidas anticipadas", color: C.ambar, valores: calc.filasMes.map((r) => r.salidas) }]} />
            </Panel>

            {!legajo && !sector && calc.porSector.length > 1 && (
              <>
                <Panel titulo="Horas trabajadas por sector" acento={C.azul} className="lg:col-span-6">
                  <BarrasH filas={calc.porSector.map((x) => ({ label: x.s, valor: x.trabajadoMin }))} fmt={(v) => `${Math.round(v / 60).toLocaleString("es-AR")} h`} />
                </Panel>
                <Panel titulo="Presentismo por sector" sub="Solo sectores con turnos asignados" acento={C.verde} className="lg:col-span-6">
                  {calc.porSector.some((x) => x.presentismo != null)
                    ? <BarrasH color={C.verde} max={100} fmt={(v) => `${Math.round(v)}%`} filas={calc.porSector.filter((x) => x.presentismo != null).map((x) => ({ label: x.s, valor: x.presentismo }))} />
                    : <Vacio texto="Ningún sector tiene turnos asignados." />}
                </Panel>
              </>
            )}
            {!legajo && (
              <>
                <Panel titulo="Más horas trabajadas" acento={C.azul} className="lg:col-span-6">
                  {topEmp((r) => r.trabajadoMin).length ? <BarrasH alAncho={140} filas={topEmp((r) => r.trabajadoMin).map(({ e, v }) => ({ label: e.apellido, title: `${e.apellido}, ${e.nombre}`, valor: v }))} fmt={(v) => `${Math.round(v / 60)} h`} /> : <Vacio />}
                </Panel>
                <Panel titulo="Más minutos de llegada tarde" acento={C.rojo} className="lg:col-span-6">
                  {topEmp((r) => r.minTarde).length ? <BarrasH alAncho={140} color={C.rojo} filas={topEmp((r) => r.minTarde).map(({ e, v }) => ({ label: e.apellido, title: `${e.apellido}, ${e.nombre}`, valor: v }))} fmt={(v) => `${fmtN(v)}′`} /> : <Vacio texto="Sin llegadas tarde en el rango. 🎉" />}
                </Panel>
              </>
            )}
          </div>

          {/* Tabla por mes */}
          <Panel titulo="Detalle mes por mes" acento={C.navy}>
            <div className="overflow-x-auto -mx-4">
              <table className="w-full text-xs tabular-nums">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-[#94a1ab] text-right">
                    <th className="text-left px-4 py-2 font-semibold">Mes</th>
                    <th className="px-3 font-semibold">Horas</th>
                    <th className="px-3 font-semibold">Presentismo</th>
                    <th className="px-3 font-semibold">Sin registro</th>
                    <th className="px-3 font-semibold">Tardes</th>
                    <th className="px-3 font-semibold">Min. tarde</th>
                    <th className="px-3 font-semibold">Salidas ant.</th>
                    <th className="px-3 font-semibold">Incompletas</th>
                    <th className="px-4 font-semibold">Horas 100%</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.filasMes.map((r) => <FilaTabla key={r.k} nombre={ymLargo(r.k)} r={r} />)}
                  <FilaTabla nombre="Acumulado" r={calc.total} total />
                </tbody>
              </table>
            </div>
          </Panel>

          {/* Detalle por empleado */}
          {!legajo && (
            <Panel titulo="Por empleado" sub="Acumulado del rango · tocá un encabezado para ordenar o un nombre para ver solo ese empleado" acento={C.azul}>
              <div className="overflow-x-auto -mx-4">
                <table className="w-full text-xs tabular-nums">
                  <thead>
                    <tr className="text-[10px] uppercase tracking-wider text-[#94a1ab] text-right">
                      {[["nombre", "Empleado"], ["trabajadoMin", "Horas"], ["presentismo", "Presentismo"], ["sinRegistro", "Sin registro"],
                        ["tardes", "Tardes"], ["minTarde", "Min. tarde"], ["salidas", "Salidas ant."], ["horas100Min", "Horas 100%"]].map(([c, l]) => (
                        <th key={c} onClick={() => ordenarPor(c)} className={`px-3 py-2 font-semibold cursor-pointer select-none hover:text-[#223c7e] ${c === "nombre" ? "text-left pl-4" : ""}`}>
                          {l}{orden.col === c ? (orden.asc ? " ▲" : " ▼") : ""}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filasEmp.map(({ e, r }) => (
                      <tr key={e.legajo} className="border-t border-[#f1f4f7] text-right hover:bg-[#f8fafb]">
                        <td className="text-left pl-4 pr-3 py-2">
                          <button onClick={() => { setSector(e.sector || ""); setLegajo(String(e.legajo)); }} className="font-semibold text-[#1f2d38] hover:text-[#223c7e] hover:underline text-left">
                            {e.apellido}, {e.nombre}
                          </button>
                          <span className="text-[10px] text-[#94a1ab] ml-1.5">{e.legajo}{e.sector ? ` · ${e.sector}` : ""}</span>
                        </td>
                        <td className="px-3">{fmtH(r.trabajadoMin)}</td>
                        <td className="px-3"><BarraPct v={r.presentismo} /></td>
                        <td className="px-3">{r.diasEsperados ? r.sinRegistro : "—"}</td>
                        <td className="px-3" style={{ color: r.tardes ? C.rojo : undefined }}>{r.tardes}</td>
                        <td className="px-3">{r.minTarde}</td>
                        <td className="px-3">{r.salidas}</td>
                        <td className="px-3">{fmtH(r.horas100Min)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
          <p className="text-[11px] text-[#94a1ab]">
            Presentismo = días con entrada y salida ÷ días que el turno pide (hasta hoy). Para cada empleado se cuenta desde su primera fichada del rango (o su fecha de ingreso si es posterior), así los meses en que todavía no se usaba el sistema no figuran como faltas.
            Los empleados sin turno asignado o con horario libre no cuentan para presentismo ni días sin registro. Se usa el turno actual de cada empleado. Las tardanzas justificadas en Aprobaciones no se cuentan.
          </p>
        </>
      )}
    </div>
  );
}

function BarraPct({ v }) {
  if (v == null) return <span>—</span>;
  const col = v >= 90 ? C.verde : v >= 75 ? C.ambar : C.rojo;
  return (
    <span className="inline-flex items-center gap-1.5 justify-end">
      <span className="w-14 h-1.5 bg-[#f1f4f7] rounded-full overflow-hidden"><span className="block h-full rounded-full" style={{ width: `${v}%`, backgroundColor: col }} /></span>
      <span className="w-9 text-right">{v.toFixed(0)}%</span>
    </span>
  );
}

function FilaTabla({ nombre, r, total }) {
  return (
    <tr className={`text-right border-t ${total ? "border-[#cfd6dd] font-bold bg-[#f6f8fa]" : "border-[#f1f4f7]"}`}>
      <td className="text-left px-4 py-2">{nombre}</td>
      <td className="px-3">{fmtH(r.trabajadoMin)}</td>
      <td className="px-3">{r.presentismo == null ? "—" : `${r.presentismo.toFixed(1)}%`}</td>
      <td className="px-3">{r.diasEsperados ? r.sinRegistro : "—"}</td>
      <td className="px-3">{r.tardes}</td>
      <td className="px-3">{fmtN(r.minTarde)}</td>
      <td className="px-3">{r.salidas}</td>
      <td className="px-3">{r.sinEntrada + r.sinSalida}</td>
      <td className="px-3">{fmtH(r.horas100Min)}</td>
    </tr>
  );
}
