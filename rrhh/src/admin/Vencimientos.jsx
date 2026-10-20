import { useState, useEffect, useMemo } from "react";
import { sbGet, sbUpsert, sbDelete, sbSignedUrl, registrarAuditoria } from "./supabase-admin.js";
import { Banda, Panel, Kpi, C } from "./charts.jsx";
import FichaEmpleado, { TIPOS_DOC } from "./FichaEmpleado.jsx";
import { analizarVencimientos, licenciasSinCertificado, sinAcentos } from "./vencimientos.js";

// Vencimientos de documentos del legajo + documentos obligatorios por sector
// + licencias que siguen sin certificado.
const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fecha = (s) => (s ? new Date(s + "T12:00:00").toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
const nom = (e) => `${e.apellido}, ${e.nombre}`;
const TIPOS_LIC = { enfermedad: "Enfermedad", licencia: "Licencia especial" };

// Requisitos sugeridos según el nombre del sector
const SUGERIDOS = [
  { re: /log|chofer|repart|distrib|transp|camion/, tipos: [["Licencia de conducir", 30], ["Psicofísico / LINTI", 30]] },
  { re: /produc|planta|fabric|envas|llenad|elabor/, tipos: [["Carnet de manipulador de alimentos / libreta sanitaria", 30]] },
];

export default function Vencimientos() {
  const [emps, setEmps] = useState([]);
  const [docs, setDocs] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [sols, setSols] = useState([]);
  const [sectores, setSectores] = useState([]);
  const [sinTabla, setSinTabla] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [sector, setSector] = useState("");
  const [ver, setVer] = useState("vencimientos"); // vencimientos | faltantes | licencias | requisitos
  const [ficha, setFicha] = useState(null);
  const [nuevo, setNuevo] = useState({ sector: "", tipo: "Licencia de conducir", dias_aviso: 30 });
  const [guardando, setGuardando] = useState(false);
  const hoy = iso(new Date());

  const cargar = async () => {
    setCargando(true); setError(null);
    try {
      const [e, d, s] = await Promise.all([
        sbGet("empleados?select=*&order=apellido.asc"),
        sbGet("empleado_documentos?select=id,legajo,tipo,nombre_archivo,path,vencimiento,created_at&limit=10000"),
        sbGet("solicitudes?select=id,legajo,tipo,fecha_desde,fecha_hasta,estado,certificado_path&tipo=in.(enfermedad,licencia)&order=fecha_desde.desc&limit=2000").catch(() => []),
      ]);
      setEmps(e); setDocs(d); setSols(s);
      try { setReqs(await sbGet("documentos_requeridos?select=*&order=sector.asc,tipo.asc")); setSinTabla(false); }
      catch { setReqs([]); setSinTabla(true); }
      try { setSectores((await sbGet("sectores?select=nombre&order=nombre.asc")).map((x) => x.nombre)); }
      catch { setSectores([...new Set(e.map((x) => x.sector).filter(Boolean))].sort()); }
    } catch { setError("No se pudieron cargar los documentos."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const activos = useMemo(() => emps.filter((e) => e.activo !== false && (!sector || sinAcentos(e.sector) === sinAcentos(sector))), [emps, sector]);
  const res = useMemo(() => analizarVencimientos({ empleados: activos, docs, requeridos: reqs, hoy }), [activos, docs, reqs, hoy]);
  const legajos = useMemo(() => new Set(activos.map((e) => e.legajo)), [activos]);
  const licencias = useMemo(() => licenciasSinCertificado(sols).filter((s) => legajos.has(s.legajo)), [sols, legajos]);
  const empDe = (legajo) => emps.find((e) => e.legajo === legajo);

  const agregar = async (filas) => {
    setGuardando(true);
    try {
      await sbUpsert("documentos_requeridos", filas, "sector,tipo");
      registrarAuditoria("Documentos obligatorios", filas.map((f) => `${f.sector || "Todos"}: ${f.tipo} (${f.dias_aviso} días)`).join(" · "));
      setReqs(await sbGet("documentos_requeridos?select=*&order=sector.asc,tipo.asc"));
    } catch { alert("No se pudo guardar. ¿Corriste el SQL vencimientos-y-licencias.sql?"); }
    finally { setGuardando(false); }
  };
  const quitar = async (r) => {
    try {
      await sbDelete(`documentos_requeridos?sector=eq.${encodeURIComponent(r.sector)}&tipo=eq.${encodeURIComponent(r.tipo)}`);
      registrarAuditoria("Quitó documento obligatorio", `${r.sector || "Todos"}: ${r.tipo}`);
      setReqs((l) => l.filter((x) => !(x.sector === r.sector && x.tipo === r.tipo)));
    } catch { alert("No se pudo quitar."); }
  };
  const sugeridos = () => {
    const filas = [];
    for (const s of sectores) for (const g of SUGERIDOS) if (g.re.test(sinAcentos(s))) for (const [tipo, dias] of g.tipos) filas.push({ sector: s, tipo, dias_aviso: dias });
    filas.push({ sector: "", tipo: "Credencial ART", dias_aviso: 30 });
    const nuevas = filas.filter((f) => !reqs.some((r) => r.sector === f.sector && r.tipo === f.tipo));
    if (!nuevas.length) return alert("Ya están cargados los sugeridos.");
    if (confirm(`Se van a agregar:\n\n${nuevas.map((f) => `• ${f.sector || "Todos los sectores"}: ${f.tipo}`).join("\n")}`)) agregar(nuevas);
  };
  const verCert = async (path) => {
    const w = window.open("", "_blank");
    try { const u = await sbSignedUrl("legajos", path); if (w) w.location = u; } catch { if (w) w.close(); alert("No se pudo abrir."); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  const atencion = [...res.vencidos, ...res.porVencer];
  const BtnFicha = ({ legajo }) => <button onClick={() => setFicha(legajo)} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-[#cfd6dd] text-[#223c7e] shrink-0">Abrir ficha</button>;

  return (
    <div className="space-y-4" data-vencimientos>
      <Banda titulo="Vencimientos de documentos" subtitulo="Licencias, psicofísicos, carnets, ART y certificados: qué vence, qué falta y qué licencia no tiene certificado">
        <select value={sector} onChange={(e) => setSector(e.target.value)} className="bg-white/15 text-white border border-white/25 rounded-lg px-3 py-1.5 text-sm outline-none [&>option]:text-[#1f2d38]">
          <option value="">Todos los sectores</option>
          {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Banda>

      {sinTabla && <p className="text-sm bg-[#fff7e0] border border-[#f2d27a] text-[#7a5b00] rounded-xl px-4 py-2.5">Falta correr el SQL <b>vencimientos-y-licencias.sql</b> en Supabase para poder cargar los documentos obligatorios por sector.</p>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Vencidos" valor={res.vencidos.length} color={C.rojo} icono="⛔" onClick={() => setVer("vencimientos")} activo={ver === "vencimientos"} />
        <Kpi label="Vencen pronto" valor={res.porVencer.length} sub="dentro del aviso" color={C.ambar} icono="⏳" onClick={() => setVer("vencimientos")} activo={ver === "vencimientos"} />
        <Kpi label="Faltan obligatorios" valor={res.faltantes.length} color={C.azul} icono="📂" onClick={() => setVer("faltantes")} activo={ver === "faltantes"} />
        <Kpi label="Licencias sin certificado" valor={licencias.length} color={C.celeste} icono="🩺" onClick={() => setVer("licencias")} activo={ver === "licencias"} />
      </div>

      <div className="flex gap-2 flex-wrap">
        {[["vencimientos", "Vencidos y por vencer"], ["faltantes", "Faltantes"], ["licencias", "Licencias sin certificado"], ["requisitos", "⚙ Obligatorios por sector"]].map(([id, l]) => (
          <button key={id} onClick={() => setVer(id)} data-ver={id} className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
            style={{ backgroundColor: ver === id ? "#e1251b" : "#f1f4f7", color: ver === id ? "#fff" : "#5c6b78", borderColor: ver === id ? "#e1251b" : "#cfd6dd" }}>{l}</button>
        ))}
      </div>

      {ver === "vencimientos" && (
        <Panel titulo="Vencidos y por vencer" sub="Se toma el último vencimiento cargado de cada documento (si lo renovó, cuenta el nuevo)" acento={C.rojo}>
          {atencion.length === 0 ? <p className="text-sm text-[#94a1ab] italic">No hay documentos vencidos ni por vencer. 👌</p> : (
            <div className="divide-y divide-[#e3e8ed]" data-lista-venc>
              {atencion.map((f) => (
                <div key={f.doc.id} className="flex items-center gap-3 py-2 flex-wrap" data-legajo={f.empleado.legajo} data-estado={f.dias < 0 ? "vencido" : "por-vencer"}>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded shrink-0 min-w-[100px] whitespace-nowrap text-center"
                    style={f.dias < 0 ? { color: "#e5484d", backgroundColor: "rgba(229,72,77,.12)" } : { color: "#9a6700", backgroundColor: "rgba(237,161,0,.14)" }}>
                    {f.dias < 0 ? `Venció hace ${-f.dias} d` : f.dias === 0 ? "Vence hoy" : `Vence en ${f.dias} d`}
                  </span>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-semibold">{nom(f.empleado)} <span className="text-[11px] text-[#94a1ab] font-normal">· {f.empleado.sector || "Sin sector"}</span></p>
                    <p className="text-xs text-[#5c6b78]">{f.tipo} · {fecha(f.vencimiento)}{f.obligatorio ? "" : " · no obligatorio en su sector"}</p>
                  </div>
                  <BtnFicha legajo={f.empleado.legajo} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      {ver === "faltantes" && (
        <Panel titulo="Documentos obligatorios que faltan" sub={reqs.length ? "Según lo que pide cada sector (⚙ Obligatorios por sector)" : "Todavía no cargaste qué documentos pide cada sector"} acento={C.azul}>
          {!reqs.length ? <button onClick={() => setVer("requisitos")} className="text-sm text-[#223c7e] font-semibold underline">Cargar los documentos obligatorios</button>
            : res.faltantes.length === 0 ? <p className="text-sm text-[#94a1ab] italic">Están todos los documentos obligatorios cargados. 👌</p> : (
            <div className="divide-y divide-[#e3e8ed]" data-lista-faltan>
              {Object.entries(res.faltantes.reduce((m, f) => { (m[f.empleado.legajo] ||= []).push(f.tipo); return m; }, {})).map(([leg, tipos]) => { const e = empDe(Number(leg)); return (
                <div key={leg} className="flex items-center gap-3 py-2 flex-wrap" data-legajo={leg}>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-semibold">{nom(e)} <span className="text-[11px] text-[#94a1ab] font-normal">· {e.sector || "Sin sector"}</span></p>
                    <p className="text-xs text-[#e5484d]">Falta: {tipos.join(", ")}</p>
                  </div>
                  <BtnFicha legajo={Number(leg)} />
                </div>
              ); })}
            </div>
          )}
        </Panel>
      )}

      {ver === "licencias" && (
        <Panel titulo="Licencias sin certificado" sub="Enfermedad y licencias especiales pedidas desde el fichaje que todavía no tienen el certificado subido" acento={C.celeste}>
          {licencias.length === 0 ? <p className="text-sm text-[#94a1ab] italic">No hay licencias sin certificado. 👌</p> : (
            <div className="divide-y divide-[#e3e8ed]" data-lista-lic>
              {licencias.map((s) => { const e = empDe(s.legajo); return (
                <div key={s.id} className="flex items-center gap-3 py-2 flex-wrap" data-legajo={s.legajo}>
                  <div className="flex-1 min-w-[180px]">
                    <p className="text-sm font-semibold">{e ? nom(e) : `Legajo ${s.legajo}`}</p>
                    <p className="text-xs text-[#5c6b78]">{TIPOS_LIC[s.tipo] || s.tipo} · {fecha(s.fecha_desde)}{s.fecha_hasta !== s.fecha_desde ? ` al ${fecha(s.fecha_hasta)}` : ""} · {s.estado}</p>
                  </div>
                  {e && <BtnFicha legajo={s.legajo} />}
                </div>
              ); })}
            </div>
          )}
          {sols.some((s) => s.certificado_path) && (
            <details className="mt-3">
              <summary className="text-xs text-[#5c6b78] cursor-pointer">Últimos certificados recibidos</summary>
              <div className="mt-2 space-y-1">
                {sols.filter((s) => s.certificado_path && legajos.has(s.legajo)).slice(0, 15).map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="flex-1">{empDe(s.legajo) ? nom(empDe(s.legajo)) : s.legajo} · {TIPOS_LIC[s.tipo]} {fecha(s.fecha_desde)}</span>
                    <button onClick={() => verCert(s.certificado_path)} className="text-[#223c7e] font-bold">📎 Ver</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </Panel>
      )}

      {ver === "requisitos" && (
        <Panel titulo="Documentos obligatorios por sector" sub="Qué tiene que tener cada empleado en su legajo, y con cuántos días de anticipación avisar que vence" acento={C.navy}
          derecha={<button onClick={sugeridos} disabled={guardando || sinTabla} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-[#cfd6dd] text-[#223c7e] disabled:opacity-50">✨ Cargar sugeridos</button>}>
          <div className="flex gap-2 flex-wrap items-end mb-3" data-nuevo-req>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Sector
              <select value={nuevo.sector} onChange={(e) => setNuevo({ ...nuevo, sector: e.target.value })} className="block mt-1 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1.5 text-sm normal-case tracking-normal text-[#1f2d38]">
                <option value="">Todos los sectores</option>
                {sectores.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Documento
              <select value={nuevo.tipo} onChange={(e) => setNuevo({ ...nuevo, tipo: e.target.value })} className="block mt-1 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1.5 text-sm normal-case tracking-normal text-[#1f2d38] max-w-[260px]">
                {TIPOS_DOC.filter((t) => t !== "Otro").map((t) => <option key={t}>{t}</option>)}
              </select></label>
            <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Avisar (días antes)
              <input type="number" min="0" max="365" value={nuevo.dias_aviso} onChange={(e) => setNuevo({ ...nuevo, dias_aviso: e.target.value })} className="block mt-1 w-24 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1.5 text-sm" /></label>
            <button onClick={() => agregar([{ sector: nuevo.sector, tipo: nuevo.tipo, dias_aviso: Math.max(0, Number(nuevo.dias_aviso) || 0) }])} disabled={guardando || sinTabla}
              className="px-3 py-2 rounded-lg text-sm font-bold bg-[#e1251b] text-white disabled:opacity-50">+ Agregar</button>
          </div>
          {reqs.length === 0 ? <p className="text-sm text-[#94a1ab] italic">Todavía no hay documentos obligatorios. Probá con “✨ Cargar sugeridos”.</p> : (
            <table className="w-full text-sm" data-reqs>
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-[#94a1ab]"><th className="py-1">Sector</th><th>Documento</th><th>Aviso</th><th /></tr></thead>
              <tbody className="divide-y divide-[#e3e8ed]">
                {reqs.map((r) => (
                  <tr key={r.sector + "|" + r.tipo}>
                    <td className="py-1.5">{r.sector || <i className="text-[#5c6b78]">Todos</i>}</td>
                    <td>{r.tipo}</td>
                    <td>{r.dias_aviso} días antes</td>
                    <td className="text-right"><button onClick={() => quitar(r)} className="text-xs text-[#e5484d]">Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-[11px] text-[#94a1ab] mt-3">El vencimiento se carga en la ficha del empleado (pestaña Documentos) al subir el archivo. Sifoncito avisa al entrar al panel cuando algo vence dentro del aviso.</p>
        </Panel>
      )}

      {ficha && empDe(ficha) && (
        <FichaEmpleado key={ficha} empleado={empDe(ficha)} tabInicial="docs"
          onGuardado={(fila) => setEmps((l) => l.map((x) => (x.legajo === fila.legajo ? { ...x, ...fila } : x)))}
          onCerrar={() => { setFicha(null); cargar(); }} />
      )}
    </div>
  );
}
