import { useState, useEffect, useMemo } from "react";
import { sbGet, sbPost, sbUpsert, registrarAuditoria, getAdminEmail } from "./supabase-admin.js";
import { generarXlsx, descargarBytes } from "./xlsx.js";
import { leerPlanillaVacaciones, coincideNombre } from "./vacaciones-planilla.js";

// Vacaciones: días por legajo y período (vacaciones_saldos), con la subida
// anual de la planilla (legajo, nombre, días) y el saldo de cada uno
// (lo aprobado y lo pendiente sale de las solicitudes de tipo vacaciones).
const diasCorridos = (d1, d2) => Math.max(0, Math.round((new Date((d2 || d1) + "T12:00:00") - new Date(d1 + "T12:00:00")) / 86400000) + 1);
export default function Vacaciones() {
  const [periodo, setPeriodo] = useState(new Date().getFullYear());
  const [emps, setEmps] = useState([]);
  const [saldos, setSaldos] = useState([]);
  const [sols, setSols] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null); // { archivo, filas }
  const [subiendo, setSubiendo] = useState(false);
  const [ok, setOk] = useState(null);
  const [buscar, setBuscar] = useState("");
  // Carga de vacaciones por RR.HH. (para quien no las pide por la app)
  const [carga, setCarga] = useState(null); // { legajo, desde, hasta }

  const cargarVacaciones = async (f) => {
    const { desde, hasta } = carga;
    if (!desde) return alert("Elegí la fecha desde.");
    if (hasta && hasta < desde) return alert("La fecha hasta no puede ser anterior.");
    const n = diasCorridos(desde, hasta || desde);
    if (f.quedan == null && !confirm(`${f.apellido}, ${f.nombre} no tiene días cargados para el período ${periodo}. ¿Cargar igual?`)) return;
    if (f.quedan != null && n > f.quedan && !confirm(`Son ${n} días y le quedan ${f.quedan}. ¿Cargar igual?`)) return;
    try {
      await sbPost("solicitudes", { legajo: f.legajo, tipo: "vacaciones", fecha_desde: desde, fecha_hasta: hasta || desde, periodo, estado: "aprobada",
        motivo: "Cargada por RR.HH.", resolucion: `Cargada por ${getAdminEmail() || "RR.HH."}`, resuelto_en: new Date().toISOString() });
      registrarAuditoria(`Cargó vacaciones de ${f.apellido}, ${f.nombre}`, `${desde} al ${hasta || desde} (${n} días, período ${periodo})`);
      setCarga(null); cargar();
    } catch { alert("No se pudieron cargar las vacaciones."); }
  };

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [e, s, v] = await Promise.all([
        sbGet("empleados?select=*&order=apellido.asc"),
        sbGet(`vacaciones_saldos?select=*&periodo=eq.${periodo}`),
        sbGet(`solicitudes?select=id,legajo,fecha_desde,fecha_hasta,estado,periodo&tipo=eq.vacaciones&periodo=eq.${periodo}`),
      ]);
      setEmps(e); setSaldos(s); setSols(v);
    } catch { setError("No se pudieron cargar las vacaciones. ¿Corriste vacaciones.sql en Supabase?"); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); setPreview(null); setOk(null); /* eslint-disable-next-line */ }, [periodo]);

  const mapEmp = useMemo(() => { const m = {}; emps.forEach((e) => (m[e.legajo] = e)); return m; }, [emps]);
  const filas = useMemo(() => {
    const sal = {}; saldos.forEach((s) => (sal[s.legajo] = s));
    const uso = {}; sols.forEach((s) => { const u = (uso[s.legajo] = uso[s.legajo] || { tomados: 0, pendientes: 0 }); if (s.estado === "aprobada") u.tomados += diasCorridos(s.fecha_desde, s.fecha_hasta); if (s.estado === "pendiente") u.pendientes += diasCorridos(s.fecha_desde, s.fecha_hasta); });
    return emps.filter((e) => e.activo !== false || sal[e.legajo]).map((e) => {
      const s = sal[e.legajo], u = uso[e.legajo] || { tomados: 0, pendientes: 0 };
      return { ...e, dias: s ? Number(s.dias) : null, tomados: u.tomados, pendientes: u.pendientes, quedan: s ? Number(s.dias) - u.tomados - u.pendientes : null };
    });
  }, [emps, saldos, sols]);
  const visibles = filas.filter((f) => `${f.apellido} ${f.nombre} ${f.legajo} ${f.sector || ""}`.toLowerCase().includes(buscar.toLowerCase()));

  const planillaModelo = () => {
    const rows = filas.map((f) => [f.legajo, `${f.apellido}, ${f.nombre}`, f.dias == null ? "" : f.dias]);
    descargarBytes(generarXlsx(["Legajo", "Apellido y nombre", "Días"], rows), `vacaciones_${periodo}_planilla.xlsx`);
  };
  const exportar = () => {
    const rows = filas.map((f) => [f.legajo, `${f.apellido}, ${f.nombre}`, f.sector || "", f.dias ?? "", f.tomados, f.pendientes, f.quedan ?? ""]);
    descargarBytes(generarXlsx(["Legajo", "Empleado", "Sector", `Días ${periodo}`, "Tomados", "Pendientes de aprobar", "Le quedan"], rows), `vacaciones_${periodo}.xlsx`);
  };

  const leerArchivo = async (file) => {
    setOk(null); setError(null);
    try {
      const XLSX = await import("xlsx");
      // CSV: se lee como texto (UTF-8) para no romper los acentos; Excel, como archivo
      const wb = /\.csv$/i.test(file.name) ? XLSX.read(await file.text(), { type: "string" }) : XLSX.read(await file.arrayBuffer(), { type: "array" });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: null, blankrows: false });
      const leidas = leerPlanillaVacaciones(rows).map((r) => {
        const e = r.legajo ? mapEmp[r.legajo] : null;
        let estado = "ok", nota = "";
        if (!r.legajo) { estado = "error"; nota = "Sin legajo"; }
        else if (!e) { estado = "error"; nota = "No hay un empleado con ese legajo"; }
        else if (r.dias == null || r.dias < 0) { estado = "error"; nota = "Días vacíos o inválidos"; }
        else if (!coincideNombre(r.nombre, e)) { estado = "aviso"; nota = `El nombre no coincide con el del sistema (${e.apellido}, ${e.nombre})`; }
        return { ...r, emp: e, estado, nota, antes: (saldos.find((s) => s.legajo === r.legajo) || {}).dias };
      });
      if (!leidas.length) throw new Error("La planilla no tiene filas con legajo y días.");
      setPreview({ archivo: file.name, filas: leidas });
    } catch (e) { setError(e.message || "No se pudo leer la planilla."); }
  };

  const cargarPlanilla = async () => {
    const validas = preview.filas.filter((r) => r.estado !== "error");
    if (!validas.length) return;
    if (!confirm(`Se van a cargar los días de ${validas.length} empleado(s) para el período ${periodo}. Los que ya tenían días cargados en ese período se reemplazan. ¿Continuar?`)) return;
    setSubiendo(true);
    try {
      const yo = getAdminEmail();
      // si un legajo se repite en la planilla, vale la última fila
      const porLeg = {}; validas.forEach((r) => (porLeg[r.legajo] = r));
      await sbUpsert("vacaciones_saldos", Object.values(porLeg).map((r) => ({ legajo: r.legajo, periodo, dias: r.dias, cargado_por: yo, cargado_en: new Date().toISOString() })), "legajo,periodo");
      registrarAuditoria(`Cargó las vacaciones del período ${periodo}`, `${Object.keys(porLeg).length} empleados · ${preview.archivo}`);
      setOk(`Listo: se cargaron los días de ${Object.keys(porLeg).length} empleado(s) para el período ${periodo}.`);
      setPreview(null);
      cargar();
    } catch { setError("No se pudo cargar la planilla."); }
    finally { setSubiendo(false); }
  };

  const guardarDias = async (f, valor) => {
    const d = Number(String(valor).replace(",", "."));
    if (valor === "" || !isFinite(d) || d < 0 || d === f.dias) return;
    try {
      await sbUpsert("vacaciones_saldos", [{ legajo: f.legajo, periodo, dias: d, cargado_por: getAdminEmail(), cargado_en: new Date().toISOString() }], "legajo,periodo");
      registrarAuditoria(`Cambió los días de vacaciones ${periodo} de ${f.apellido}, ${f.nombre}`, `${f.dias ?? "—"} → ${d}`);
      setSaldos((ss) => [...ss.filter((s) => s.legajo !== f.legajo), { legajo: f.legajo, periodo, dias: d }]);
    } catch { alert("No se pudo guardar."); }
  };

  const cuenta = preview ? { ok: preview.filas.filter((r) => r.estado === "ok").length, aviso: preview.filas.filter((r) => r.estado === "aviso").length, error: preview.filas.filter((r) => r.estado === "error").length } : null;
  const col = { ok: "#16a34a", aviso: "#b9820b", error: "#e5484d" };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold">🏖 Vacaciones</h2>
          <p className="text-[11px] text-[#94a1ab]">Los días son corridos. Los empleados piden sus vacaciones desde el fichaje (Ausencias) y el responsable o RR.HH. las aprueba.</p>
        </div>
        <div className="rounded-xl bg-white border border-[#e3e8ed] p-2 flex items-center gap-2">
          <button onClick={() => setPeriodo((p) => p - 1)} className="text-[#5c6b78] px-2 text-lg">‹</button>
          <p className="text-sm font-semibold" data-periodo>Período {periodo}</p>
          <button onClick={() => setPeriodo((p) => p + 1)} className="text-[#5c6b78] px-2 text-lg">›</button>
        </div>
      </div>

      <div className="bg-white border border-[#e3e8ed] rounded-xl p-4 mb-4">
        <p className="text-sm font-bold mb-1">Carga anual del período {periodo}</p>
        <p className="text-[11px] text-[#94a1ab] mb-3">Subí un Excel (o CSV) con <b>Legajo</b>, <b>Apellido y nombre</b> y <b>Días</b>. Podés bajar la planilla modelo con todos los empleados, completar los días y subirla.</p>
        <div className="flex gap-2 flex-wrap">
          <button onClick={planillaModelo} className="px-3 py-2 rounded-lg text-xs font-bold border border-[#223c7e] text-[#223c7e]">⬇ Planilla modelo</button>
          <label className="px-3 py-2 rounded-lg text-xs font-bold bg-[#223c7e] text-white cursor-pointer">
            ⬆ Subir planilla
            <input type="file" accept=".xlsx,.xls,.csv" hidden data-subir onChange={(e) => { const f = e.target.files[0]; e.target.value = ""; if (f) leerArchivo(f); }} />
          </label>
          <button onClick={exportar} className="px-3 py-2 rounded-lg text-xs font-bold border border-[#cfd6dd] text-[#5c6b78]">⬇ Exportar saldos</button>
        </div>
        {error && <p className="text-xs text-[#e5484d] mt-3">{error}</p>}
        {ok && <p className="text-xs text-[#16a34a] font-semibold mt-3">{ok}</p>}

        {preview && (
          <div className="mt-4 border-t border-[#e3e8ed] pt-3" data-preview>
            <p className="text-xs mb-2"><b>{preview.archivo}</b> · {preview.filas.length} filas ·{" "}
              <span style={{ color: col.ok }}>{cuenta.ok} bien</span>{cuenta.aviso ? <> · <span style={{ color: col.aviso }}>{cuenta.aviso} con el nombre distinto (se cargan igual)</span></> : null}{cuenta.error ? <> · <span style={{ color: col.error }}>{cuenta.error} con error (no se cargan)</span></> : null}</p>
            <div className="max-h-80 overflow-auto border border-[#e3e8ed] rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-[#f1f4f7] sticky top-0"><tr><th className="text-left p-2">Fila</th><th className="text-left p-2">Legajo</th><th className="text-left p-2">En la planilla</th><th className="text-left p-2">En el sistema</th><th className="text-right p-2">Días</th><th className="text-left p-2"></th></tr></thead>
                <tbody>
                  {preview.filas.map((r, i) => (
                    <tr key={i} className="border-t border-[#f1f4f7]" data-estado={r.estado}>
                      <td className="p-2 text-[#94a1ab]">{r.fila}</td><td className="p-2">{r.legajo ?? "—"}</td><td className="p-2">{r.nombre}</td>
                      <td className="p-2">{r.emp ? `${r.emp.apellido}, ${r.emp.nombre}` : "—"}</td>
                      <td className="p-2 text-right font-semibold">{r.dias ?? "—"}{r.antes != null && Number(r.antes) !== r.dias ? <span className="text-[#94a1ab] font-normal"> (antes {r.antes})</span> : null}</td>
                      <td className="p-2" style={{ color: col[r.estado] }}>{r.estado === "ok" ? "✓" : r.nota}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={cargarPlanilla} disabled={subiendo || !(cuenta.ok + cuenta.aviso)} className="px-4 py-2 rounded-lg text-sm font-bold bg-[#16a34a] text-white disabled:opacity-50">
                {subiendo ? "Cargando…" : `Cargar ${cuenta.ok + cuenta.aviso} para el período ${periodo}`}
              </button>
              <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg text-sm border border-[#cfd6dd] text-[#5c6b78]">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border border-[#e3e8ed] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[#e3e8ed] flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm font-bold">Saldos del período {periodo}</p>
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar empleado…" className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-1.5 text-xs outline-none" />
        </div>
        {cargando ? <p className="text-[#5c6b78] text-center py-10 text-sm">Cargando…</p> : (
          <div className="overflow-auto">
            <table className="w-full text-xs" data-saldos>
              <thead className="bg-[#f1f4f7]"><tr><th className="text-left p-2">Legajo</th><th className="text-left p-2">Empleado</th><th className="text-left p-2">Sector</th><th className="text-right p-2">Días</th><th className="text-right p-2">Tomados</th><th className="text-right p-2">Pendientes</th><th className="text-right p-2">Le quedan</th><th className="p-2"></th></tr></thead>
              <tbody>
                {visibles.map((f) => (
                  <tr key={f.legajo} className="border-t border-[#f1f4f7]" data-legajo={f.legajo}>
                    <td className="p-2 text-[#5c6b78]">{f.legajo}</td><td className="p-2 font-medium">{f.apellido}, {f.nombre}{f.vacaciones_por_app === false && <span className="ml-1 text-[10px] font-semibold text-[#b9820b] bg-[#fef3c7] rounded px-1" title="No las pide por la app: las carga RR.HH.">carga RR.HH.</span>}</td><td className="p-2 text-[#5c6b78]">{f.sector || ""}</td>
                    <td className="p-2 text-right">
                      <input defaultValue={f.dias ?? ""} key={`${f.legajo}-${f.dias}`} onBlur={(e) => guardarDias(f, e.target.value.trim())} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
                        inputMode="decimal" placeholder="—" className="w-16 text-right bg-[#f1f4f7] border border-[#cfd6dd] rounded px-1.5 py-1 outline-none" />
                    </td>
                    <td className="p-2 text-right">{f.tomados || ""}</td><td className="p-2 text-right" style={{ color: f.pendientes ? "#b9820b" : undefined }}>{f.pendientes || ""}</td>
                    <td className="p-2 text-right font-bold" style={{ color: f.quedan == null ? "#94a1ab" : f.quedan < 0 ? "#e5484d" : "#16a34a" }}>{f.quedan ?? "—"}</td>
                    <td className="p-2 text-right whitespace-nowrap">
                      {carga && carga.legajo === f.legajo ? (
                        <span className="inline-flex items-center gap-1" data-carga>
                          <input type="date" value={carga.desde} onChange={(e) => setCarga({ ...carga, desde: e.target.value })} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded px-1 py-0.5" />
                          <span>a</span>
                          <input type="date" value={carga.hasta} onChange={(e) => setCarga({ ...carga, hasta: e.target.value })} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded px-1 py-0.5" />
                          <button onClick={() => cargarVacaciones(f)} className="px-2 py-0.5 rounded bg-[#16a34a] text-white font-bold">OK</button>
                          <button onClick={() => setCarga(null)} className="px-1 text-[#5c6b78]">✕</button>
                        </span>
                      ) : (
                        <button onClick={() => setCarga({ legajo: f.legajo, desde: "", hasta: "" })} className="text-[11px] text-[#223c7e] font-semibold" title="Cargar vacaciones ya aprobadas">+ Cargar vacaciones</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
