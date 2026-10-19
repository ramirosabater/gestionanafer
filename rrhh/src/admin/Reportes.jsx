import { useState, useEffect } from "react";
import { sbGet } from "./supabase-admin.js";
import { calcularPeriodo, etiquetaPeriodo } from "../lib/fichaje.js";
import { computarCumplimiento, cargarConfig, minutosRecargo } from "../lib/cumplimiento.js";
import { jornadasDe, tieneExtrasPropias } from "../lib/jornada.js";
import { generarXlsx, descargarBytes } from "./xlsx.js";

export default function Reportes() {
  const [alcance, setAlcance] = useState("todos"); // todos | sector | empleado
  const [sector, setSector] = useState("");
  const [legajo, setLegajo] = useState("");
  const [refMes, setRefMes] = useState(new Date());
  const [datos, setDatos] = useState({ sectores: [], empleados: [] });
  const [config, setConfig] = useState({ recargos: [], feriados: {} });
  const [bajando, setBajando] = useState("");
  const [error, setError] = useState(null);
  const [ok, setOk] = useState(null);

  // cargar sectores y empleados para los selectores
  useEffect(() => {
    (async () => {
      try {
        const emps = await sbGet("empleados?select=legajo,apellido,nombre,sector,horario_id,activo&order=apellido.asc");
        let secs = [];
        try { secs = (await sbGet("sectores?select=nombre&order=nombre.asc")).map((s) => s.nombre); }
        catch { secs = [...new Set(emps.map((e) => e.sector).filter(Boolean))].sort(); }
        setDatos({ sectores: secs, empleados: emps });
        setConfig(await cargarConfig(sbGet));
      } catch { /* ignore */ }
    })();
  }, []);

  // conMargen: trae también el día anterior y la mañana siguiente, para ver el
  // descanso entre jornadas y las salidas pasada la medianoche del último día.
  async function traerFichajes(desde, hasta, filtroLegajo, conMargen) {
    const d = conMargen ? new Date(desde.getTime() - 24 * 3600000) : desde, h = conMargen ? new Date(hasta.getTime() + 20 * 3600000) : hasta;
    let q = `fichajes?timestamp=gte.${d.toISOString()}&timestamp=lte.${h.toISOString()}&order=timestamp.asc&limit=200000`;
    if (filtroLegajo) q += `&legajo=eq.${filtroLegajo}`;
    return sbGet(q);
  }

  const descargarDetalle = async () => {
    setError(null); setOk(null);
    if (alcance === "empleado" && !legajo) return setError("Elegí un empleado.");
    if (alcance === "sector" && !sector) return setError("Elegí un sector.");
    setBajando("detalle");
    try {
      const { desde, hasta } = calcularPeriodo(refMes);
      const [fichajes, locales] = await Promise.all([
        traerFichajes(desde, hasta, alcance === "empleado" ? legajo : null),
        sbGet("locales?select=*"),
      ]);
      const mapEmp = {}; datos.empleados.forEach((e) => (mapEmp[e.legajo] = e));
      const mapLoc = {}; locales.forEach((l) => (mapLoc[l.id] = l.nombre));
      let filas = fichajes.filter((f) => (mapEmp[f.legajo] || {}).activo !== false);
      if (alcance === "sector") filas = filas.filter((f) => (mapEmp[f.legajo] || {}).sector === sector);
      if (!filas.length) { setError("No hay fichadas para ese filtro."); setBajando(""); return; }
      const headers = ["Legajo", "Apellido y Nombre", "Sector", "Fecha", "Hora", "Día", "Tipo", "Estado", "Ubicación", "Distancia (m)"];
      const rows = filas.map((f) => {
        const e = mapEmp[f.legajo] || {}, d = new Date(f.timestamp);
        return [f.legajo, e.apellido ? `${e.apellido}, ${e.nombre}` : "(desconocido)", e.sector || "",
          d.toLocaleDateString("es-AR"), d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }),
          d.toLocaleDateString("es-AR", { weekday: "long" }), f.tipo || "", f.estado || "",
          f.local_id ? (mapLoc[f.local_id] || f.local_id) : "Remoto", f.distancia_metros == null ? "" : Number(f.distancia_metros)];
      });
      descargarBytes(generarXlsx(headers, rows), `fichadas_${desde.toISOString().slice(0, 10)}_a_${hasta.toISOString().slice(0, 10)}.xlsx`);
      setOk(`Reporte generado: ${rows.length} fichadas.`);
    } catch { setError("No se pudo generar el reporte."); }
    finally { setBajando(""); }
  };

  const descargarResumen = async () => {
    setError(null); setOk(null);
    setBajando("resumen");
    try {
      const { desde, hasta } = calcularPeriodo(refMes);
      const [fichajes, horarios] = await Promise.all([traerFichajes(desde, hasta, null, true), sbGet("horarios?select=*")]);
      const porEmp = {}; fichajes.forEach((f) => (porEmp[f.legajo] = porEmp[f.legajo] || []).push(f));
      const mapHor = {}; horarios.forEach((h) => (mapHor[h.id] = h));
      let lista = datos.empleados.filter((e) => e.activo !== false);
      if (alcance === "sector" && sector) lista = lista.filter((e) => e.sector === sector);
      if (alcance === "empleado" && legajo) lista = lista.filter((e) => String(e.legajo) === String(legajo));
      const headers = ["Legajo", "Empleado", "Sector", "Horario", "Días esperados", "Días trabajados", "Sin registro", "Sin entrada", "Sin salida", "Min. tarde", "Min. retiro", "Horas trabajadas", "Descuento (min)", "Horas normales", "Horas 50%", "Horas 100%", "Horas esperadas (libre)", "Diferencia horas (libre)"];
      const rows = lista.map((e) => {
        const c = computarCumplimiento(porEmp[e.legajo] || [], mapHor[e.horario_id] || null, desde, hasta, config);
        const hor = mapHor[e.horario_id];
        return [e.legajo, `${e.apellido}, ${e.nombre}`, e.sector || "", hor ? hor.nombre + (tieneExtrasPropias(hor) ? " (extras propias)" : "") : "",
          c.sinTurno ? "" : c.diasEsperados, c.sinTurno ? "" : c.diasTrabajados,
          c.sinTurno ? "" : c.sinRegistro, c.sinTurno ? "" : c.sinEntrada, c.sinTurno ? "" : c.sinSalida,
          Math.round(c.trabajadoMin / 6) / 10, c.minTarde, c.minRetiro, c.descuentoMin, Math.round(c.normalMin / 6) / 10, Math.round(c.horas50Min / 6) / 10, Math.round(c.horas100Min / 6) / 10,
          c.libre ? Math.round(c.esperadoMin / 6) / 10 : "", c.libre ? Math.round(c.diferenciaMin / 6) / 10 : ""];
      });
      if (!rows.length) { setError("No hay empleados para ese filtro."); setBajando(""); return; }
      descargarBytes(generarXlsx(headers, rows), `resumen_${desde.toISOString().slice(0, 10)}_a_${hasta.toISOString().slice(0, 10)}.xlsx`);
      setOk(`Resumen generado: ${rows.length} empleados.`);
    } catch { setError("No se pudo generar el resumen."); }
    finally { setBajando(""); }
  };

  // Una fila por jornada (entrada → salida), con normales / 50% / 100% y por qué.
  const descargarJornadas = async () => {
    setError(null); setOk(null);
    if (alcance === "empleado" && !legajo) return setError("Elegí un empleado.");
    if (alcance === "sector" && !sector) return setError("Elegí un sector.");
    setBajando("jornadas");
    try {
      const { desde, hasta } = calcularPeriodo(refMes);
      const [fichajes, horarios] = await Promise.all([traerFichajes(desde, hasta, alcance === "empleado" ? legajo : null, true), sbGet("horarios?select=*")]);
      const porEmp = {}; fichajes.forEach((f) => (porEmp[f.legajo] = porEmp[f.legajo] || []).push(f));
      const mapHor = {}; horarios.forEach((h) => (mapHor[h.id] = h));
      let lista = datos.empleados.filter((e) => e.activo !== false && porEmp[e.legajo]);
      if (alcance === "sector") lista = lista.filter((e) => e.sector === sector);
      if (alcance === "empleado") lista = lista.filter((e) => String(e.legajo) === String(legajo));
      const hs = (m) => Math.round(m / 6) / 10;
      const hora = (d) => (d ? d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "");
      const headers = ["Legajo", "Empleado", "Horario", "Fecha", "Día", "Entrada", "Salida", "Horas trabajadas", "Normales", "Extras 50%", "Extras 100%", "Descanso previo (h)", "Observaciones"];
      const rows = [];
      const tot = {};
      lista.forEach((e) => {
        const hor = mapHor[e.horario_id] || null;
        jornadasDe(porEmp[e.legajo], hor, config, (a, b) => minutosRecargo(a, b, config))
          .filter((j) => j.entrada >= desde && j.entrada <= hasta)
          .forEach((j) => {
            const sal = j.salida ? hora(j.salida) + (j.salida.toDateString() !== j.entrada.toDateString() ? " (+1)" : "") : "—";
            rows.push([e.legajo, `${e.apellido}, ${e.nombre}`, hor ? hor.nombre : "", j.entrada.toLocaleDateString("es-AR"), j.entrada.toLocaleDateString("es-AR", { weekday: "long" }),
              hora(j.entrada), sal, hs(j.total), hs(j.normal), hs(j.min50), hs(j.min100), j.descansoPrevioMin != null ? hs(j.descansoPrevioMin) : "", (j.observaciones || []).join(" · ")]);
            const t = (tot[e.legajo] = tot[e.legajo] || { n: `${e.apellido}, ${e.nombre}`, h: hor ? hor.nombre : "", total: 0, normal: 0, m50: 0, m100: 0 });
            t.total += j.total; t.normal += j.normal; t.m50 += j.min50; t.m100 += j.min100;
          });
      });
      if (!rows.length) { setError("No hay jornadas para ese filtro."); setBajando(""); return; }
      rows.push([]);
      Object.keys(tot).forEach((k) => { const t = tot[k]; rows.push([k, t.n, t.h, "TOTAL DEL MES", "", "", "", hs(t.total), hs(t.normal), hs(t.m50), hs(t.m100), "", ""]); });
      descargarBytes(generarXlsx(headers, rows), `jornadas_y_extras_${desde.toISOString().slice(0, 10)}_a_${hasta.toISOString().slice(0, 10)}.xlsx`);
      setOk(`Jornadas generadas: ${rows.length - Object.keys(tot).length - 1} jornadas de ${Object.keys(tot).length} empleados.`);
    } catch { setError("No se pudo generar el detalle de jornadas."); }
    finally { setBajando(""); }
  };

  const { desde, hasta } = calcularPeriodo(refMes);

  return (
    <div className="max-w-xl">
      <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-2xl p-5">
        <h2 className="text-base font-bold mb-1">Exportar a Excel</h2>
        <p className="text-[#94a1ab] text-xs mb-5">Descargá las fichadas o un resumen por empleado del período.</p>

        <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Alcance</p>
        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ id: "todos", label: "Todos" }, { id: "sector", label: "Un sector" }, { id: "empleado", label: "Un empleado" }].map((o) => (
            <button key={o.id} onClick={() => { setAlcance(o.id); setError(null); setOk(null); }}
              className="px-3 py-2 rounded-lg text-xs font-semibold border"
              style={{ backgroundColor: alcance === o.id ? "#223c7e" : "#f1f4f7", color: alcance === o.id ? "#ffffff" : "#5c6b78", borderColor: alcance === o.id ? "#223c7e" : "#cfd6dd" }}>
              {o.label}
            </button>
          ))}
        </div>

        {alcance === "sector" && (
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2.5 text-sm outline-none mb-4">
            <option value="">— Elegí un sector —</option>
            {datos.sectores.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
        {alcance === "empleado" && (
          <select value={legajo} onChange={(e) => setLegajo(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2.5 text-sm outline-none mb-4">
            <option value="">— Elegí un empleado —</option>
            {datos.empleados.map((e) => <option key={e.legajo} value={e.legajo}>{e.apellido}, {e.nombre} ({e.legajo})</option>)}
          </select>
        )}

        <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Período</p>
        <div className="rounded-xl bg-[#f1f4f7] border border-[#e3e8ed] p-3 flex items-center justify-between mb-5">
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-[#5c6b78] px-2 text-lg">‹</button>
          <p className="text-sm font-semibold">{etiquetaPeriodo(desde, hasta)}</p>
          <button onClick={() => setRefMes((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-[#5c6b78] px-2 text-lg">›</button>
        </div>

        {error && <p className="text-[#e5484d] text-xs mb-3">{error}</p>}
        {ok && <p className="text-[#16a34a] text-xs mb-3 font-semibold">{ok}</p>}

        <button onClick={descargarDetalle} disabled={!!bajando} className="w-full py-3 rounded-xl font-bold text-sm bg-[#223c7e] text-white disabled:opacity-50">
          {bajando === "detalle" ? "Generando…" : "⬇ Descargar fichadas (detalle)"}
        </button>
        <button onClick={descargarResumen} disabled={!!bajando} className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-[#f1f4f7] border border-[#cfd6dd] disabled:opacity-50">
          {bajando === "resumen" ? "Generando…" : "📊 Resumen por empleado (descuentos, 100%, faltantes)"}
        </button>
        <button onClick={descargarJornadas} disabled={!!bajando} className="w-full mt-2 py-3 rounded-xl font-bold text-sm bg-[#f1f4f7] border border-[#cfd6dd] disabled:opacity-50">
          {bajando === "jornadas" ? "Generando…" : "⏱ Jornadas y horas extras (una fila por día: normales, 50%, 100%)"}
        </button>
      </div>
    </div>
  );
}
