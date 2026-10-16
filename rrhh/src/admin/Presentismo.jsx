import { useState, useEffect } from "react";
import { sbGet, sbGetAll } from "./supabase-admin.js";
import { salidasSinFichar, fechaCorta } from "./avisos.js";

export default function Presentismo() {
  const [dentro, setDentro] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [actualizado, setActualizado] = useState(null);
  const [delDia, setDelDia] = useState(0);
  const [ultimas, setUltimas] = useState([]);
  const [ahora, setAhora] = useState(new Date());

  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 30000); return () => clearInterval(t); }, []);

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      // Se mira hacia atrás 20 horas (no desde la medianoche): así aparecen
      // también los turnos que empezaron ayer a la noche y siguen abiertos.
      const desde = new Date(Date.now() - 20 * 3600000);
      const [fichajes, emps] = await Promise.all([
        sbGetAll(`fichajes?select=id,legajo,tipo,timestamp&timestamp=gte.${encodeURIComponent(desde.toISOString())}&order=timestamp.asc,id.asc`),
        empleados.length ? Promise.resolve(empleados) : sbGet("empleados?select=legajo,nombre,apellido,sector,activo"),
      ]);
      if (!empleados.length) setEmpleados(emps);
      const mapEmp = {}; (empleados.length ? empleados : emps).forEach((e) => (mapEmp[String(e.legajo)] = e));
      // último movimiento de cada empleado en la ventana
      const ultimo = {};
      fichajes.forEach((f) => { ultimo[String(f.legajo)] = f; });
      const activos = Object.values(ultimo)
        .filter((f) => String(f.tipo || "").toLowerCase() === "entrada" && (mapEmp[String(f.legajo)] || {}).activo !== false)
        .map((f) => {
          const e = mapEmp[String(f.legajo)] || {};
          return { legajo: f.legajo, nombre: e.nombre || "?", apellido: e.apellido || "?", sector: e.sector || "Sin sector", desde: new Date(f.timestamp) };
        })
        .sort((a, b) => a.apellido.localeCompare(b.apellido));
      setDentro(activos);
      const hoy0 = new Date(); hoy0.setHours(0, 0, 0, 0);
      setDelDia(fichajes.filter((f) => new Date(f.timestamp) >= hoy0).length);
      setUltimas(fichajes.slice(-5).reverse().map((f) => ({ ...f, emp: mapEmp[String(f.legajo)] })));
      setActualizado(new Date());
    } catch (e) { setError("No se pudo cargar el presentismo" + (e && e.message ? ": " + e.message : ".")); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); /* eslint-disable-next-line */ }, []);

  // Turnos de la última semana que quedaron sin fichar la salida.
  const [sinSalida, setSinSalida] = useState([]);
  useEffect(() => { salidasSinFichar(7).then(setSinSalida).catch(() => setSinSalida([])); }, []);

  const dur = (desde) => {
    const ms = ahora - desde;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  // agrupar por sector
  const porSector = {};
  dentro.forEach((d) => { (porSector[d.sector] = porSector[d.sector] || []).push(d); });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-base font-bold">Presentismo en vivo</h2>
          <p className="text-[#94a1ab] text-xs">
            {cargando ? "Actualizando…" : `${dentro.length} persona${dentro.length !== 1 ? "s" : ""} fichada${dentro.length !== 1 ? "s" : ""} ahora`}
            {!cargando && ` · ${delDia} fichada${delDia !== 1 ? "s" : ""} hoy`}
            {actualizado && ` · ${actualizado.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <button onClick={cargar} className="text-xs px-3 py-1.5 rounded-lg border border-[#e3e8ed] bg-white text-[#5c6b78]">↻ Actualizar</button>
      </div>

      {error ? (
        <p className="text-[#e5484d] text-center py-10">{error}</p>
      ) : dentro.length === 0 && !cargando ? (
        <div className="bg-white border border-[#e3e8ed] rounded-xl px-4 py-10 text-center shadow-sm">
          <p className="text-2xl mb-2">🌙</p>
          <p className="text-[#94a1ab] text-sm">No hay nadie fichado en este momento.</p>
          {ultimas.length > 0 && (
            <div className="mt-4 text-left max-w-sm mx-auto">
              <p className="text-[11px] uppercase tracking-wide text-[#94a1ab] mb-1">Últimas fichadas recibidas</p>
              {ultimas.map((f) => (
                <p key={f.id} className="text-xs text-[#5c6b78]">
                  {new Date(f.timestamp).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })} · {f.tipo} · {f.emp ? `${f.emp.apellido}, ${f.emp.nombre}` : `leg. ${f.legajo}`}
                </p>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {Object.keys(porSector).sort().map((sector) => (
            <div key={sector} className="bg-white border border-[#e3e8ed] rounded-xl overflow-hidden shadow-sm">
              <div className="px-4 py-2 border-b border-[#e3e8ed] flex items-center justify-between bg-[#f1f4f7]">
                <p className="text-xs font-bold uppercase tracking-wide text-[#5c6b78]">{sector}</p>
                <span className="text-xs text-[#94a1ab]">{porSector[sector].length}</span>
              </div>
              <div className="divide-y divide-[#f1f4f7]">
                {porSector[sector].map((d) => (
                  <div key={d.legajo} className="px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[#16a34a]"></span>
                      <p className="text-sm">{d.apellido}, {d.nombre} <span className="text-[#94a1ab] text-xs">· leg. {d.legajo}</span></p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-[#16a34a] tabular-nums">{dur(d.desde)}</p>
                      <p className="text-[10px] text-[#94a1ab]">desde {d.desde.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {sinSalida.length > 0 && (
        <div className="mt-6 bg-white border border-[#f3d38a] rounded-xl overflow-hidden shadow-sm">
          <div className="px-4 py-2 border-b border-[#f3d38a] bg-[#fff8e6] flex items-center justify-between">
            <p className="text-xs font-bold uppercase tracking-wide text-[#a16207]">⚠ Salidas sin fichar · últimos 7 días</p>
            <span className="text-xs text-[#a16207]">{sinSalida.reduce((t, x) => t + x.dias.length, 0)}</span>
          </div>
          <div className="divide-y divide-[#f1f4f7]">
            {sinSalida.map((x) => (
              <div key={x.legajo} className="px-4 py-2.5 flex items-center justify-between gap-3">
                <p className="text-sm">{x.nombre} <span className="text-[#94a1ab] text-xs">· leg. {x.legajo}{x.sector ? ` · ${x.sector}` : ""}</span></p>
                <p className="text-xs text-[#a16207] text-right">{x.dias.length} {x.dias.length === 1 ? "día" : "días"}: {x.dias.map(fechaCorta).join(", ")}</p>
              </div>
            ))}
          </div>
          <p className="px-4 py-2 text-[11px] text-[#94a1ab] border-t border-[#f1f4f7]">Entradas de hace más de 16 horas sin su salida. Se corrigen en Asistencia → Corrección de fichadas.</p>
        </div>
      )}
    </div>
  );
}
