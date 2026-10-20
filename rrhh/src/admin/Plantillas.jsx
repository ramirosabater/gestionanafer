import { useState, useEffect } from "react";
import { sbGet, sbPost, sbPatch, sbDelete, registrarAuditoria } from "./supabase-admin.js";
import { EXTRAS_CAMIONEROS, BLOQUES_CAMIONEROS } from "../lib/jornada.js";

const DIAS = [
  { n: 1, l: "L" }, { n: 2, l: "M" }, { n: 3, l: "X" }, { n: 4, l: "J" },
  { n: 5, l: "V" }, { n: 6, l: "S" }, { n: 7, l: "D" },
];

export default function Plantillas() {
  const [horarios, setHorarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null); // id que se está editando, o null

  // form
  const [nombre, setNombre] = useState("");
  const [tolerancia, setTolerancia] = useState(10);
  const [dias, setDias] = useState([1, 2, 3, 4, 5]);
  const [inicio, setInicio] = useState("08:00");
  const [fin, setFin] = useState("17:00");
  const [bloques, setBloques] = useState([]);
  const [libre, setLibre] = useState(false);
  const [horasDiarias, setHorasDiarias] = useState(8);
  const [horasSabado, setHorasSabado] = useState(4);
  const [guardando, setGuardando] = useState(false);
  // Horas extras propias del horario (ej. Camioneros): si está apagado, rige la regla general de recargos.
  const [extrasOn, setExtrasOn] = useState(false);
  const [tramos, setTramos] = useState([]);
  const [descansoH, setDescansoH] = useState(0);
  const [teniaExtras, setTeniaExtras] = useState(false);
  // Turno rotativo por semana (ej. una semana 9 a 17 y la otra 10 a 18)
  const [rotaOn, setRotaOn] = useState(false);
  const [bloques2, setBloques2] = useState([]);
  const [rotaDesde, setRotaDesde] = useState("");
  const [d2, setD2] = useState([1, 2, 3, 4, 5]);
  const [ini2, setIni2] = useState("10:00");
  const [fin2, setFin2] = useState("18:00");
  const lunesDeEstaSemana = () => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

  const cargar = async () => {
    setCargando(true); setError(null);
    try { setHorarios(await sbGet("horarios?select=*&order=nombre.asc")); }
    catch { setError("No se pudieron cargar los horarios."); }
    finally { setCargando(false); }
  };
  useEffect(() => { cargar(); }, []);

  const toggleDia = (n) => setDias((d) => d.includes(n) ? d.filter((x) => x !== n) : [...d, n].sort());

  const agregarBloque = () => {
    if (!dias.length) return alert("Elegí al menos un día.");
    setBloques((b) => [...b, { dias: [...dias], inicio, fin }]);
  };

  const limpiar = () => {
    setEditando(null); setNombre(""); setTolerancia(10);
    setDias([1, 2, 3, 4, 5]); setInicio("08:00"); setFin("17:00"); setBloques([]);
    setLibre(false); setHorasDiarias(8); setHorasSabado(4);
    setExtrasOn(false); setTramos([]); setDescansoH(0); setTeniaExtras(false);
    setRotaOn(false); setBloques2([]); setRotaDesde(""); setD2([1, 2, 3, 4, 5]); setIni2("10:00"); setFin2("18:00");
  };
  const modeloCamioneros = () => {
    setLibre(false);
    if (!nombre.trim()) setNombre("Camioneros");
    setTolerancia(10);
    setBloques(BLOQUES_CAMIONEROS.map((b) => ({ ...b, dias: [...b.dias] })));
    setExtrasOn(true);
    setTramos(EXTRAS_CAMIONEROS.tramos.map((t) => ({ ...t, dias: [...t.dias] })));
    setDescansoH(EXTRAS_CAMIONEROS.descanso_horas);
  };
  // Al prender las extras propias, propone un tramo por cada grupo de días del horario.
  const prenderExtras = (on) => {
    setExtrasOn(on);
    if (on && !tramos.length) {
      const base = bloques.length ? bloques : [{ dias, inicio, fin }];
      const vistos = new Set(), ts = [];
      base.forEach((b) => { const k = b.dias.join(","); if (vistos.has(k)) return; vistos.add(k);
        const [h, m] = String(b.fin).split(":").map(Number); const hasta = `${String(Math.min(23, h + 5)).padStart(2, "0")}:${String(m || 0).padStart(2, "0")}`;
        ts.push({ dias: [...b.dias], hasta_50: hasta, todo_100_si_pasa: false }); });
      setTramos(ts);
    }
  };
  const cambiarTramo = (i, campo, v) => setTramos((ts) => ts.map((t, j) => (j === i ? { ...t, [campo]: v } : t)));

  const abrirNuevo = () => { limpiar(); setMostrarForm(true); };
  const cancelar = () => { limpiar(); setMostrarForm(false); };

  const editar = (h) => {
    setEditando(h.id);
    setNombre(h.nombre || "");
    setTolerancia(h.tolerancia_minutos ?? 10);
    setLibre(h.tipo === "libre");
    setHorasDiarias(h.horas_diarias ?? 8);
    setHorasSabado(h.horas_sabado ?? 4);
    if (h.tipo === "libre") {
      const ds = new Set(); (h.bloques || []).forEach((b) => (b.dias || []).forEach((d) => ds.add(d)));
      setBloques([]); setDias([...ds].sort());
      setMostrarForm(true); window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setBloques(Array.isArray(h.bloques) ? h.bloques.map((b) => ({ dias: [...(b.dias || [])], inicio: b.inicio, fin: b.fin })) : []);
    const ex = h.extras && Array.isArray(h.extras.tramos) && h.extras.tramos.length ? h.extras : null;
    setTeniaExtras(!!h.extras); setExtrasOn(!!ex);
    const rot = h.extras && h.extras.rotacion && Array.isArray(h.extras.rotacion.semanas) ? h.extras.rotacion : null;
    setRotaOn(!!rot); setRotaDesde(rot ? rot.desde : "");
    setBloques2(rot && rot.semanas[1] ? rot.semanas[1].map((b) => ({ dias: [...(b.dias || [])], inicio: b.inicio, fin: b.fin })) : []);
    setTramos(ex ? ex.tramos.map((t) => ({ dias: [...(t.dias || [])], hasta_50: t.hasta_50, todo_100_si_pasa: !!t.todo_100_si_pasa })) : []);
    setDescansoH(ex ? Number(ex.descanso_horas) || 0 : 0);
    setDias([1, 2, 3, 4, 5]); setInicio("08:00"); setFin("17:00");
    setMostrarForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const guardar = async () => {
    if (!nombre.trim()) return alert("Poné un nombre.");
    if (libre && !dias.length) return alert("Elegí al menos un día laborable.");
    if (libre && !(Number(horasDiarias) > 0)) return alert("Indicá las horas diarias (mayor a 0).");
    if (libre && dias.includes(6) && !(Number(horasSabado) >= 0)) return alert("Indicá las horas del sábado.");
    // Horario libre: un bloque solo con días (sin hora de inicio/fin); lo que cuenta son las horas trabajadas.
    const bloquesFinales = libre
      ? [{ dias: [...dias] }]
      : (bloques.length ? bloques : (dias.length ? [{ dias: [...dias], inicio, fin }] : []));
    if (!bloquesFinales.length) return alert("Agregá al menos un bloque de horario.");
    setGuardando(true);
    let conExtras = false;
    try {
      const datos = {
        nombre: nombre.trim(), bloques: bloquesFinales, tolerancia_minutos: libre ? 0 : (Number(tolerancia) || 0),
        tipo: libre ? "libre" : "fijo", horas_diarias: libre ? Number(horasDiarias) : null,
        horas_sabado: libre ? Number(horasSabado) : null,
      };
      if (!libre && extrasOn && !tramos.length) { setGuardando(false); return alert("Agregá al menos un tramo de horas extras (o apagá las extras propias)."); }
      if (!libre && rotaOn && !bloques2.length) { setGuardando(false); return alert("Agregá los bloques de la semana 2 (o apagá el turno rotativo)."); }
      if (!libre && (extrasOn || rotaOn)) {
        datos.extras = {
          tramos: extrasOn ? tramos.map((t) => ({ dias: t.dias, hasta_50: t.hasta_50, todo_100_si_pasa: !!t.todo_100_si_pasa })) : [],
          descanso_horas: extrasOn ? Number(descansoH) || 0 : 0,
        };
        if (rotaOn) datos.extras.rotacion = { desde: rotaDesde || lunesDeEstaSemana(), semanas: [bloquesFinales, bloques2] };
      } else if (teniaExtras) datos.extras = null; // vuelve a la regla general
      conExtras = "extras" in datos;
      if (editando) {
        await sbPatch(`horarios?id=eq.${editando}`, datos);
        setHorarios((h) => h.map((x) => (x.id === editando ? { ...x, ...datos } : x)));
        registrarAuditoria(`Editó el horario "${datos.nombre}"`, null);
      } else {
        const id = `custom_${Date.now()}`;
        const [creado] = await sbPost("horarios", { id, ...datos });
        setHorarios((h) => [...h, creado]);
        registrarAuditoria(`Creó el horario "${datos.nombre}"`, null);
      }
      limpiar(); setMostrarForm(false);
    } catch (e) {
      alert(conExtras && /: 400$/.test(String(e && e.message)) ? "No se pudo guardar: falta correr horario-camioneros.sql en la base (agrega la columna de horas extras)." : "No se pudo guardar el horario.");
    }
    finally { setGuardando(false); }
  };

  const borrar = async (id, nom) => {
    if (!confirm(`¿Borrar el horario "${nom}"? Los empleados que lo tenían quedan sin turno.`)) return;
    try { await sbDelete(`horarios?id=eq.${id}`); setHorarios((h) => h.filter((x) => x.id !== id)); registrarAuditoria(`Borró el horario "${nom}"`, null); }
    catch { alert("No se pudo borrar."); }
  };

  if (cargando) return <p className="text-[#5c6b78] text-center py-16">Cargando…</p>;
  if (error) return <p className="text-[#e5484d] text-center py-10">{error}</p>;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold">Horarios de turnos</h2>
        <button onClick={() => (mostrarForm ? cancelar() : abrirNuevo())} className="px-3 py-2 rounded-lg text-sm font-bold bg-[#223c7e] text-white">
          {mostrarForm ? "Cancelar" : "+ Nuevo horario"}
        </button>
      </div>

      {mostrarForm && (
        <div className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-4 mb-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold">{editando ? "Editar horario" : "Nuevo horario"}</p>
            <button onClick={modeloCamioneros} className="text-xs font-semibold text-[#223c7e] px-2 py-1 rounded-lg border border-[#223c7e]/40" title="Lun a vie 08–16, sáb 08–12, extras y descanso de 12 h">🚛 Usar modelo Camioneros</button>
          </div>
          <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Nombre</label>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Mañana Lun-Vie"
            className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mb-3 mt-1" />

          <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Tipo</label>
          <div className="flex gap-1.5 my-1 mb-3">
            {[{ v: false, l: "Fijo (con horas de entrada/salida)" }, { v: true, l: "Libre (cuenta horas trabajadas)" }].map((o) => (
              <button key={String(o.v)} onClick={() => setLibre(o.v)} className="px-3 py-2 rounded-lg text-xs font-bold border"
                style={{ backgroundColor: libre === o.v ? "#223c7e" : "#f1f4f7", color: libre === o.v ? "#ffffff" : "#5c6b78", borderColor: libre === o.v ? "#223c7e" : "#cfd6dd" }}>
                {o.l}
              </button>
            ))}
          </div>

          <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Días</label>
          <div className="flex gap-1.5 my-1 mb-3">
            {DIAS.map((d) => (
              <button key={d.n} onClick={() => toggleDia(d.n)}
                className="w-8 h-8 rounded-lg text-xs font-bold border"
                style={{ backgroundColor: dias.includes(d.n) ? "#223c7e" : "#f1f4f7", color: dias.includes(d.n) ? "#ffffff" : "#5c6b78", borderColor: dias.includes(d.n) ? "#223c7e" : "#cfd6dd" }}>
                {d.l}
              </button>
            ))}
          </div>

          {libre && (
            <div className="mb-3">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Horas diarias a cumplir</label>
              <input type="number" min="0" step="0.5" value={horasDiarias} onChange={(e) => setHorasDiarias(e.target.value)}
                className="w-32 block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
              {dias.includes(6) && (<>
                <label className="text-[10px] uppercase tracking-wider text-[#94a1ab] block mt-3">Horas los sábados</label>
                <input type="number" min="0" step="0.5" value={horasSabado} onChange={(e) => setHorasSabado(e.target.value)}
                  className="w-32 block bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
              </>)}
              <p className="text-[11px] text-[#94a1ab] mt-1">No hay llegada tarde ni salida anticipada: se suman las horas entre cada entrada y salida y se comparan con la meta del período.</p>
            </div>
          )}
          {!libre && (<>
          <div className="flex gap-3 mb-3">
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Entrada</label>
              <input type="time" value={inicio} onChange={(e) => setInicio(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div className="flex-1">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Salida</label>
              <input type="time" value={fin} onChange={(e) => setFin(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
            <div className="w-24">
              <label className="text-[10px] uppercase tracking-wider text-[#94a1ab]">Toler. (min)</label>
              <input type="number" value={tolerancia} onChange={(e) => setTolerancia(e.target.value)} className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2 text-sm outline-none mt-1" />
            </div>
          </div>

          <button onClick={agregarBloque} className="text-xs text-[#223c7e] mb-2">+ Agregar este bloque (para días con horario distinto)</button>
          {bloques.length > 0 && (
            <div className="mb-3 space-y-1">
              {bloques.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-[#5c6b78] bg-[#f1f4f7] rounded-lg px-2 py-1">
                  <span>{b.dias.map((n) => DIAS.find((d) => d.n === n)?.l).join("")} · {b.inicio}–{b.fin}</span>
                  <button onClick={() => setBloques((bs) => bs.filter((_, j) => j !== i))} className="text-[#e5484d]">✕</button>
                </div>
              ))}
            </div>
          )}
          {bloques.length === 0 && <p className="text-[11px] text-[#94a1ab] mb-3">Si no agregás bloques, se usa el día/horario de arriba. Para un turno partido o días con horarios distintos, agregá cada bloque.</p>}

          <div className="rounded-xl border border-[#e3e8ed] bg-[#f8fafc] p-3 mb-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={extrasOn} onChange={(e) => prenderExtras(e.target.checked)} />
              Horas extras propias de este horario
            </label>
            <p className="text-[11px] text-[#94a1ab] mt-1">Si está apagado, rige la regla general de recargos (Configuración). Prendido: lo trabajado después de la salida del horario es extra al 50% hasta la hora que pongas, y después al 100%. Domingos y feriados, todo al 100%.</p>
            {extrasOn && (<div className="mt-3 space-y-2">
              {tramos.map((t, i) => (
                <div key={i} className="bg-white border border-[#e3e8ed] rounded-lg p-2">
                  <div className="flex items-center gap-1 flex-wrap">
                    {DIAS.map((d) => (
                      <button key={d.n} onClick={() => cambiarTramo(i, "dias", t.dias.includes(d.n) ? t.dias.filter((x) => x !== d.n) : [...t.dias, d.n].sort())}
                        className="w-7 h-7 rounded-md text-[11px] font-bold border"
                        style={{ backgroundColor: t.dias.includes(d.n) ? "#223c7e" : "#f1f4f7", color: t.dias.includes(d.n) ? "#fff" : "#5c6b78", borderColor: t.dias.includes(d.n) ? "#223c7e" : "#cfd6dd" }}>{d.l}</button>
                    ))}
                    <button onClick={() => setTramos((ts) => ts.filter((_, j) => j !== i))} className="ml-auto text-[#e5484d] text-xs">✕</button>
                  </div>
                  <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-[#5c6b78]">
                    <span>Extras al 50% hasta las</span>
                    <input type="time" value={t.hasta_50} onChange={(e) => cambiarTramo(i, "hasta_50", e.target.value)} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-sm outline-none" />
                    <span>· después, al 100%</span>
                  </div>
                  <label className="flex items-center gap-2 mt-2 text-xs text-[#5c6b78] cursor-pointer">
                    <input type="checkbox" checked={!!t.todo_100_si_pasa} onChange={(e) => cambiarTramo(i, "todo_100_si_pasa", e.target.checked)} />
                    <span>Si se pasa de esa hora, <b>todas</b> las extras del día van al 100%</span>
                  </label>
                </div>
              ))}
              <button onClick={() => setTramos((ts) => [...ts, { dias: [], hasta_50: "21:00", todo_100_si_pasa: false }])} className="text-xs text-[#223c7e]">+ Agregar tramo (para días con otra regla)</button>
              <div className="flex items-center gap-2 text-xs text-[#5c6b78] pt-1">
                <span>Descanso mínimo entre jornadas</span>
                <input type="number" min="0" step="0.5" value={descansoH} onChange={(e) => setDescansoH(e.target.value)} className="w-20 bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-sm outline-none" />
                <span>horas (0 = no aplica)</span>
              </div>
              <p className="text-[11px] text-[#94a1ab]">Con descanso: si terminó tarde (ej. volvió 00:05), puede entrar recién al cumplir el descanso (12:05) y esa llegada <b>no</b> es tarde.</p>
            </div>)}
          </div>

          <div className="rounded-xl border border-[#e3e8ed] bg-[#f8fafc] p-3 mb-3">
            <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
              <input type="checkbox" checked={rotaOn} onChange={(e) => { setRotaOn(e.target.checked); if (e.target.checked && !rotaDesde) setRotaDesde(lunesDeEstaSemana()); }} />
              Turno rotativo por semana
            </label>
            <p className="text-[11px] text-[#94a1ab] mt-1">Una semana se usa el horario de arriba (semana 1) y la siguiente el de la semana 2, y así se van alternando.</p>
            {rotaOn && (<div className="mt-3">
              <div className="flex items-center gap-2 text-xs text-[#5c6b78] mb-2 flex-wrap">
                <span>La semana 1 es la del</span>
                <input type="date" value={rotaDesde} onChange={(e) => setRotaDesde(e.target.value)} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-sm outline-none" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-[#94a1ab] mb-1">Semana 2</p>
              <div className="flex gap-1 flex-wrap mb-2">
                {DIAS.map((d) => (
                  <button key={d.n} onClick={() => setD2((x) => (x.includes(d.n) ? x.filter((y) => y !== d.n) : [...x, d.n].sort()))} className="w-7 h-7 rounded-md text-[11px] font-bold border"
                    style={{ backgroundColor: d2.includes(d.n) ? "#223c7e" : "#f1f4f7", color: d2.includes(d.n) ? "#fff" : "#5c6b78", borderColor: d2.includes(d.n) ? "#223c7e" : "#cfd6dd" }}>{d.l}</button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap text-xs text-[#5c6b78]">
                <input type="time" value={ini2} onChange={(e) => setIni2(e.target.value)} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-sm outline-none" />
                <span>a</span>
                <input type="time" value={fin2} onChange={(e) => setFin2(e.target.value)} className="bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2 py-1 text-sm outline-none" />
                <button onClick={() => { if (!d2.length) return alert("Elegí al menos un día."); setBloques2((b) => [...b, { dias: [...d2], inicio: ini2, fin: fin2 }]); }} className="text-xs text-[#223c7e]">+ Agregar bloque a la semana 2</button>
              </div>
              {bloques2.length > 0 && (
                <div className="mt-2 space-y-1">
                  {bloques2.map((b, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-[#5c6b78] bg-white border border-[#e3e8ed] rounded-lg px-2 py-1">
                      <span>{b.dias.map((n) => DIAS.find((d) => d.n === n)?.l).join("")} · {b.inicio}–{b.fin}</span>
                      <button onClick={() => setBloques2((bs) => bs.filter((_, j) => j !== i))} className="text-[#e5484d]">✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>)}
          </div>
          </>)}

          <button onClick={guardar} disabled={guardando} className="w-full py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
            {guardando ? "Guardando…" : (editando ? "Guardar cambios" : "Guardar horario")}
          </button>
        </div>
      )}

      <div className="space-y-2">
        {horarios.length === 0 && <p className="text-[#94a1ab] text-sm italic">No hay horarios todavía.</p>}
        {horarios.map((h) => (
          <div key={h.id} className="bg-[#ffffff] border border-[#e3e8ed] rounded-xl p-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold">{h.nombre}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {h.tipo === "libre" && <span className="text-[11px] font-bold text-[#223c7e] bg-[#e8eefb] rounded px-1.5 py-0.5">LIBRE · {h.horas_diarias ?? "?"} h/día{(h.bloques || []).some((b) => (b.dias || []).includes(6)) ? ` · sáb ${h.horas_sabado ?? 4} h` : ""}</span>}
                {(h.bloques || []).map((b, i) => (
                  <span key={i} className="text-[11px] text-[#5c6b78] bg-[#f1f4f7] rounded px-1.5 py-0.5">
                    {(b.dias || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("")}{b.inicio ? ` ${b.inicio}–${b.fin}` : ""}
                  </span>
                ))}
                {h.tipo !== "libre" && <span className="text-[11px] text-[#94a1ab]">· tol. {h.tolerancia_minutos ?? 0}m</span>}
                {h.extras && h.extras.rotacion && (h.extras.rotacion.semanas || [])[1] && (
                  <span className="text-[11px] font-bold text-[#0d9488] bg-[#ccfbf1] rounded px-1.5 py-0.5">
                    ROTA POR SEMANA · sem. 2: {h.extras.rotacion.semanas[1].map((b) => `${(b.dias || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("")} ${b.inicio}–${b.fin}`).join(" · ")}
                  </span>
                )}
                {h.extras && (h.extras.tramos || []).length > 0 && (
                  <span className="text-[11px] font-bold text-[#b45309] bg-[#fef3c7] rounded px-1.5 py-0.5" title={(h.extras.tramos || []).map((t) => `${(t.dias || []).map((n) => DIAS.find((d) => d.n === n)?.l).join("")}: 50% hasta ${t.hasta_50}${t.todo_100_si_pasa ? " (si pasa, todo al 100%)" : ""}`).join(" · ")}>
                    EXTRAS PROPIAS{Number(h.extras.descanso_horas) ? ` · descanso ${h.extras.descanso_horas} h` : ""}
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => editar(h)} className="text-xs text-[#223c7e] px-2 py-1 rounded-lg border border-[#223c7e]/40">Editar</button>
              <button onClick={() => borrar(h.id, h.nombre)} className="text-xs text-[#e5484d] px-2 py-1 rounded-lg border border-[#e5484d]/40">Borrar</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
