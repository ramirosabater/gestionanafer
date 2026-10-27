import { useState, useEffect, useMemo } from "react";
import { sbGet, sbPost, registrarAuditoria } from "./supabase-admin.js";
import { calcularEstado } from "../lib/fichaje.js";
import { contextoFichada } from "../lib/jornada.js";
import { leerArchivoReloj, asignarTipos, unirLecturas } from "./importar-reloj.js";

const LS_LOCAL = "importar_reloj_local";
const LS_DUP = "importar_reloj_dupmin";
const lsGet = (k) => { try { return localStorage.getItem(k) || ""; } catch { return ""; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin storage */ } };
const DIAS = ["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"];
const fmtDia = (iso) => { const d = new Date(iso + "T12:00:00"); return `${DIAS[d.getDay()]} ${iso.slice(8)}/${iso.slice(5, 7)}`; };
const clave = (legajo, ts) => `${legajo}|${ts.getTime()}`;
const labelCls = "text-[10px] uppercase tracking-wider text-[#94a1ab]";
const LETRAS = "ABCDEFGH";

export default function ImportarReloj() {
  const [locales, setLocales] = useState([]);
  const [localId, setLocalId] = useState(lsGet(LS_LOCAL));
  // Archivos subidos (pueden ser de relojes distintos): { nombre, datos, localId }
  const [lecturas, setLecturas] = useState([]);
  const [empleadosDB, setEmpleadosDB] = useState({});
  const [horarios, setHorarios] = useState([]);
  const [existentes, setExistentes] = useState({}); // legajo -> [timestamps ms]
  const [overrides, setOverrides] = useState({});   // clave -> "entrada" | "salida" | "ignorar"
  const [dupMin, setDupMin] = useState(() => Number(lsGet(LS_DUP)) || 10);
  const [excluidos, setExcluidos] = useState({});   // legajo -> true
  const [abiertos, setAbiertos] = useState({});
  const [leyendo, setLeyendo] = useState(false);
  const [importando, setImportando] = useState(null);
  const [error, setError] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    sbGet("locales?select=id,nombre&order=nombre.asc").then((ls) => {
      setLocales(ls);
      // El reloj está en Sopladora: se elige solo si no hay otra elección guardada
      const guardado = ls.find((l) => String(l.id) === String(lsGet(LS_LOCAL)));
      if (!guardado) {
        const sop = ls.find((l) => /soplador/i.test(l.nombre));
        if (sop) { setLocalId(String(sop.id)); lsSet(LS_LOCAL, String(sop.id)); }
      }
    }).catch(() => {});
  }, []);

  // Todas las marcas de todos los archivos, unidas por legajo
  const datos = useMemo(() => (lecturas.length ? unirLecturas(lecturas.map((l) => l.datos)) : null), [lecturas]);

  // Empleados, horarios y fichadas ya cargadas del período (de todos los archivos juntos)
  const cargarContexto = async (d) => {
    const legajos = d.empleados.map((e) => e.legajo);
      const desde = new Date(`${d.desde}T00:00:00-03:00`);
      const hasta = new Date(new Date(`${d.hasta}T00:00:00-03:00`).getTime() + 2 * 864e5);
      const [emps, hs, prev] = await Promise.all([
        sbGet(`empleados?select=legajo,apellido,nombre,horario_id,activo&legajo=in.(${legajos.join(",")})`),
        sbGet("horarios?select=*"),
        sbGet(`fichajes?select=legajo,timestamp&legajo=in.(${legajos.join(",")})&timestamp=gte.${desde.toISOString()}&timestamp=lt.${hasta.toISOString()}&limit=100000`),
      ]);
    const mapE = {}; emps.forEach((e) => (mapE[e.legajo] = e));
    const mapX = {}; prev.forEach((f) => { (mapX[f.legajo] ||= []).push(new Date(f.timestamp).getTime()); });
    setEmpleadosDB(mapE); setHorarios(hs); setExistentes(mapX);
  };

  // Se pueden elegir varios archivos a la vez, o sumar otro después (ej. el reloj de Sopladora y la
  // planilla de E-S de los camioneros): las marcas del mismo legajo se juntan antes de deducir E/S.
  const elegirArchivo = async (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    if (!files.length) return;
    setError(null); setResultado(null);
    setLeyendo(true);
    const nuevas = [...lecturas], errores = [];
    for (const file of files) {
      if (nuevas.some((l) => l.nombre === file.name)) { errores.push(`${file.name}: ya está agregado.`); continue; }
      try {
        const d = await leerArchivoReloj(file);
        if (!d.empleados.length) throw new Error("no tiene fichadas en el período.");
        nuevas.push({ nombre: file.name, datos: d, localId });
      } catch (e) {
        errores.push(`${file.name}: ${e.message || "no se pudo leer."}`);
      }
    }
    try {
      if (nuevas.length !== lecturas.length) await cargarContexto(unirLecturas(nuevas.map((l) => l.datos)));
      setLecturas(nuevas);
    } catch {
      errores.push("No se pudieron traer los empleados y las fichadas ya cargadas. Probá de nuevo.");
    }
    if (errores.length) setError(errores.join(" · "));
    setLeyendo(false);
  };

  const quitarArchivo = async (i) => {
    const nuevas = lecturas.filter((_, j) => j !== i);
    setError(null);
    if (nuevas.length) { try { await cargarContexto(unirLecturas(nuevas.map((l) => l.datos))); } catch { /* se mantiene el contexto anterior */ } }
    setLecturas(nuevas);
    if (!nuevas.length) { setOverrides({}); setExcluidos({}); setAbiertos({}); }
  };

  const cambiarLocal = (i, v) => {
    setLecturas((ls) => ls.map((l, j) => (j === i ? { ...l, localId: v } : l)));
    setLocalId(v); lsSet(LS_LOCAL, v);
  };

  // Vista previa calculada: tipos deducidos + overrides + marcas ya cargadas
  const preview = useMemo(() => {
    if (!datos) return [];
    return datos.empleados.map((e) => {
      const emp = empleadosDB[e.legajo];
      const prev = existentes[e.legajo] || [];
      const ignorar = new Set(), incluir = new Set();
      e.marcas.forEach((m) => {
        const o = overrides[clave(e.legajo, m.ts)];
        if (o === "ignorar") ignorar.add(m.ts.getTime());
        else if (o) incluir.add(m.ts.getTime());
      });
      const marcas = asignarTipos(e.marcas, { dupMin, ignorar, incluir }).map((m) => {
        const k = clave(e.legajo, m.ts);
        const o = overrides[k];
        return { ...m, k, tipo: o && o !== "ignorar" ? o : m.tipo, yaCargada: prev.some((t) => Math.abs(t - m.ts.getTime()) < 60000) };
      });
      const porDia = {};
      marcas.forEach((m) => (porDia[m.fecha] ||= []).push(m));
      const dias = Object.entries(porDia).map(([fecha, ms]) => {
        const validas = ms.filter((m) => !m.descartada);
        const ent = validas.filter((m) => m.tipo === "entrada").length;
        const sal = validas.length - ent;
        return { fecha, marcas: ms, revisar: validas.length % 2 === 1 || ent !== sal };
      });
      const nuevas = marcas.filter((m) => !m.descartada && !m.yaCargada);
      return {
        legajo: e.legajo, nombreReloj: e.nombreReloj, emp, dias, nuevas,
        yaCargadas: marcas.filter((m) => m.yaCargada && !m.descartada).length,
        descartadas: marcas.filter((m) => m.descartada).length,
        revisar: dias.filter((d) => d.revisar).length,
      };
    });
  }, [datos, empleadosDB, existentes, overrides, dupMin]);

  const validos = preview.filter((p) => p.emp && !excluidos[p.legajo]);
  const noExisten = preview.filter((p) => !p.emp);
  const totalNuevas = validos.reduce((s, p) => s + p.nuevas.length, 0);

  // Clic en una marca: Entrada → Salida → Descartada → Entrada…
  const toggleTipo = (m) => setOverrides((o) => ({
    ...o, [m.k]: m.descartada ? "entrada" : m.tipo === "entrada" ? "salida" : "ignorar",
  }));

  const importar = async () => {
    if (!totalNuevas) return;
    if (!confirm(`Se van a cargar ${totalNuevas} fichadas de ${validos.filter((p) => p.nuevas.length).length} empleados (${lecturas.length === 1 ? "1 archivo" : `${lecturas.length} archivos unidos`}). ¿Continuar?`)) return;
    const filas = [];
    for (const p of validos) {
      const horario = horarios.find((h) => String(h.id) === String(p.emp.horario_id)) || null;
      const ordenadas = p.nuevas.slice().sort((a, b) => a.ts - b.ts);
      for (const m of p.nuevas) {
        const est = calcularEstado(m.tipo, m.ts, horario, contextoFichada(ordenadas.filter((x) => x !== m), m.ts));
        const lec = lecturas[m.origen] || lecturas[0];
        filas.push({
          legajo: p.legajo, tipo: m.tipo, timestamp: m.ts.toISOString(),
          estado: est.estado, minutos_tarde: est.minutosTarde || 0,
          local_id: lec?.localId || null, lat: null, lng: null, distancia_metros: null,
          device_id: null, user_agent: `Reloj (importado) · ${lec?.nombre || "archivo"}`,
        });
      }
    }
    let ok = 0;
    try {
      for (let i = 0; i < filas.length; i += 400) {
        setImportando(`Cargando ${Math.min(i + 400, filas.length)} de ${filas.length}…`);
        await sbPost("fichajes", filas.slice(i, i + 400));
        ok += Math.min(400, filas.length - i);
      }
      registrarAuditoria(`Importó fichadas del reloj (${datos.desde} a ${datos.hasta})`,
        `${ok} fichadas · ${validos.length} empleados · ${lecturas.map((l) => l.nombre).join(" + ")}`);
      setResultado({ ok, total: filas.length, desde: datos.desde, hasta: datos.hasta });
      setLecturas([]); setOverrides({}); setExcluidos({}); setAbiertos({});
    } catch {
      setError(`Se cortó la carga: entraron ${ok} de ${filas.length}. Volvé a subir los mismos archivos; las ya cargadas se saltean solas.`);
    } finally { setImportando(null); }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white border border-[#e3e8ed] rounded-xl p-4">
        <p className="text-sm font-bold">Importar fichadas del reloj</p>
        <p className="text-xs text-[#5c6b78] mt-1 max-w-3xl">
          Subí el reporte del reloj (ej. <b>Sumario.xls</b>, hoja <b>Registros</b>) o la <b>planilla de E-S</b> (columnas LEG, FECHA, HORA 1…).
          Si la misma gente ficha en dos relojes (camioneros, sopladora), subí los dos archivos: las marcas de cada legajo se
          juntan antes de deducir entrada/salida (ej. entra 8:17 en uno y sale 19:52 en el otro). Se descartan los empleados sin
          marcas. Podés subirlo semanal, quincenal o mensual: las fichadas que ya están cargadas se saltean.
        </p>
        <div className="flex gap-3 mt-3 flex-wrap items-end">
          <label className={`px-4 py-2 rounded-lg text-sm font-bold text-white cursor-pointer ${leyendo ? "bg-[#94a1ab]" : "bg-[#223c7e]"}`}>
            {leyendo ? "Leyendo…" : lecturas.length ? "➕ Sumar otro archivo" : "📂 Elegir archivo(s) del reloj"}
            <input type="file" accept=".xls,.xlsx" multiple onChange={elegirArchivo} disabled={leyendo || !!importando} className="hidden" />
          </label>
          <div>
            <label className={labelCls}>Marcas repetidas</label>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-[#5c6b78]">
              unificar si hay menos de
              <input type="number" min={0} max={60} value={dupMin}
                onChange={(e) => { const v = Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)); setDupMin(v); lsSet(LS_DUP, String(v)); }}
                className="w-14 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1.5 text-sm outline-none text-center" />
              min
            </div>
          </div>
        </div>
        {lecturas.length > 0 && (
          <div className="mt-3 grid gap-1.5" data-archivos>
            {lecturas.map((l, i) => (
              <div key={l.nombre} className="flex items-center gap-2 flex-wrap text-xs bg-[#f6f8fa] border border-[#e3e8ed] rounded-lg px-2.5 py-1.5">
                {lecturas.length > 1 && <span className="font-bold text-[#223c7e] w-4">{LETRAS[i]}</span>}
                <span className="font-semibold">{l.nombre}</span>
                <span className="text-[#5c6b78]">{l.datos.formato} · {fmtDia(l.datos.desde)} → {fmtDia(l.datos.hasta)} · {l.datos.empleados.length} con marcas</span>
                <span className="ml-auto text-[#94a1ab]">reloj en</span>
                <select value={l.localId} onChange={(e) => cambiarLocal(i, e.target.value)} aria-label={`Ubicación del reloj de ${l.nombre}`}
                  className="bg-white border border-[#cfd6dd] rounded-md px-1.5 py-1 text-xs outline-none">
                  <option value="">— Sin depósito —</option>
                  {locales.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}
                </select>
                <button onClick={() => quitarArchivo(i)} disabled={!!importando} title="Quitar este archivo" className="text-[#94a1ab] hover:text-[#e5484d] px-1">✕</button>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-[#e5484d] mt-3">{error}</p>}
        {resultado && <p className="text-sm text-[#16a34a] font-semibold mt-3">✓ Listo: se cargaron {resultado.ok} fichadas del {fmtDia(resultado.desde)} al {fmtDia(resultado.hasta)}. Para verlas en Reportes, Dashboard o Corrección, mové el mes con las flechas hasta {new Date(resultado.desde + "T12:00:00").toLocaleDateString("es-AR", { month: "long", year: "numeric" })}.</p>}
      </div>

      {datos && (
        <>
          <div className="bg-white border border-[#e3e8ed] rounded-xl p-4 flex flex-wrap gap-x-6 gap-y-2 items-center">
            <Dato n={`${fmtDia(datos.desde)} → ${fmtDia(datos.hasta)}`} t={lecturas.length > 1 ? "Período (archivos unidos)" : "Período del archivo"} />
            <Dato n={validos.length} t="Empleados a importar" />
            <Dato n={totalNuevas} t="Fichadas nuevas" color="#16a34a" />
            <Dato n={validos.reduce((s, p) => s + p.yaCargadas, 0)} t="Ya estaban cargadas" />
            <Dato n={validos.reduce((s, p) => s + p.revisar, 0)} t="Días para revisar" color="#9a6700" />
            <button onClick={importar} disabled={!totalNuevas || !!importando}
              className="ml-auto px-5 py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
              {importando || `Importar ${totalNuevas} fichadas`}
            </button>
          </div>

          {lecturas.length > 1 && (
            <p className="text-[11px] text-[#5c6b78]">
              Archivos unidos: la letra al lado de cada hora dice de qué archivo vino ({lecturas.map((l, i) => `${LETRAS[i]} = ${l.nombre}`).join(" · ")}).
            </p>
          )}

          {noExisten.length > 0 && (
            <p className="text-xs bg-[#fdecec] text-[#b42318] border border-[#f5c2c0] rounded-lg px-3 py-2">
              Estos números del reloj no existen como legajo en el sistema y se van a omitir:{" "}
              {noExisten.map((p) => `${p.legajo} (${p.nombreReloj || "sin nombre"}, ${p.nuevas.length} marcas)`).join(" · ")}.
              Si son empleados, dalos de alta con ese mismo legajo y volvé a subir el archivo.
            </p>
          )}

          <p className="text-[11px] text-[#5c6b78]">
            Tocá una marca para cambiarla: <b className="text-[#16a34a]">Entrada</b> → <b className="text-[#e5484d]">Salida</b> → <s>Descartada</s>.
            Al descartar una, se recalculan las siguientes. Las tachadas no se importan (se descartan solas las que están a menos de {dupMin} min de la anterior);
            las grises ya estaban cargadas.
          </p>

          {preview.filter((p) => p.emp).map((p) => {
            const abierto = abiertos[p.legajo] ?? p.revisar > 0;
            const excl = !!excluidos[p.legajo];
            return (
              <div key={p.legajo} className="bg-white border border-[#e3e8ed] rounded-xl" style={{ opacity: excl ? 0.5 : 1 }}>
                <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <input type="checkbox" checked={!excl} onChange={() => setExcluidos((x) => ({ ...x, [p.legajo]: !excl }))} title="Incluir en la importación" />
                  <button onClick={() => setAbiertos((a) => ({ ...a, [p.legajo]: !abierto }))} className="flex-1 text-left min-w-[200px]">
                    <span className="text-sm font-semibold">{p.emp.apellido}, {p.emp.nombre}</span>
                    <span className="text-[11px] text-[#94a1ab] ml-2">Legajo {p.legajo} · en el reloj: "{p.nombreReloj}"</span>
                  </button>
                  <span className="text-xs text-[#16a34a] font-semibold">{p.nuevas.length} nuevas</span>
                  {p.yaCargadas > 0 && <span className="text-xs text-[#94a1ab]">{p.yaCargadas} ya cargadas</span>}
                  {p.revisar > 0 && <span className="text-xs text-[#9a6700] bg-[#fff7e6] border border-[#f5d48a] rounded-full px-2 py-0.5">⚠ {p.revisar} días para revisar</span>}
                  <button onClick={() => setAbiertos((a) => ({ ...a, [p.legajo]: !abierto }))} className="text-xs text-[#5c6b78]">{abierto ? "▲" : "▼"}</button>
                </div>
                {abierto && (
                  <div className="border-t border-[#e3e8ed] px-4 py-2 grid gap-1">
                    {p.dias.map((d) => (
                      <div key={d.fecha} className={`flex items-center gap-2 flex-wrap py-1 px-2 rounded-lg ${d.revisar ? "bg-[#fff7e6]" : ""}`}>
                        <span className="text-xs w-16 text-[#5c6b78] font-semibold">{fmtDia(d.fecha)}</span>
                        {d.marcas.map((m, i) => (
                          <button key={m.k + "-" + i} disabled={m.yaCargada || excl}
                            onClick={() => toggleTipo(m)}
                            title={m.descartada === "repetida" ? `Repetida (a menos de ${dupMin} min de la anterior). Tocá para incluirla.` : m.descartada ? "Descartada a mano. Tocá para incluirla." : "Tocá para cambiar"}
                            className="text-xs px-2 py-0.5 rounded-md border font-semibold"
                            style={m.descartada
                              ? { color: "#94a1ab", borderColor: "#e3e8ed", borderStyle: "dashed", textDecoration: "line-through" }
                              : m.yaCargada
                              ? { color: "#94a1ab", borderColor: "#e3e8ed", cursor: "default" }
                              : m.tipo === "entrada"
                                ? { color: "#16a34a", borderColor: "rgba(22,163,74,.4)", backgroundColor: "rgba(22,163,74,.08)" }
                                : { color: "#e5484d", borderColor: "rgba(229,72,77,.4)", backgroundColor: "rgba(229,72,77,.08)" }}>
                            {m.descartada ? "✕" : m.tipo === "entrada" ? "E" : "S"} {m.hora}
                            {lecturas.length > 1 && <sup className="ml-0.5 text-[9px] opacity-70" title={lecturas[m.origen]?.nombre}>{LETRAS[m.origen]}</sup>}
                          </button>
                        ))}
                        {d.revisar && <span className="text-[11px] text-[#9a6700]">marcas impares, falta una entrada o salida</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

function Dato({ n, t, color }) {
  return (
    <div>
      <p className="text-lg font-bold leading-tight" style={{ color: color || "#1f2d3a" }}>{n}</p>
      <p className="text-[10px] uppercase tracking-wider text-[#94a1ab]">{t}</p>
    </div>
  );
}
