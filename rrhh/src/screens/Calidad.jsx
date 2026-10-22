import { useState, useEffect } from "react";
import { sbRpc } from "../lib/supabase.js";

// Calidad desde el fichaje (legajo + PIN):
//  * "Cargar un reclamo": 1ª parte del reclamo (recepción). La fecha es la del
//    día y el número sale al guardar (se muestra en gris el que le va a tocar).
//    Después no se ve más: lo sigue Calidad desde Gestión.
//  * "Mis acciones de mejora": las que tiene asignadas como responsable; completa
//    los puntos 2 (riesgo y causa), 3 (corrección) y 4 (acción correctiva).

// Listas de siempre (si Calidad nunca las editó en Gestión → ⚙ → Calidad)
const LISTAS_DEF = {
  productos: ["Bx5Azul", "Bx8Azul", "Bx12Azul", "Bx20Azul", "Bx5Verde", "Bx8Verde", "Bx12Verde", "Bx20Verde", "Soda Descartable", "Soda retornable 1.5L", "Soda retornable 650ml", "Otro"],
  origenes_reclamo: ["Planta", "Sucursal", "Distribuidor", "Reparto", "Atención al cliente"],
  desvios: ["Mal gusto", "Otros", "Pinchado", "No pasó repartidor"],
  reclamos_cliente: ["MG: plastico", "MG: cloro", "MG: otro", "EE: insecto", "EE: precinto/tapa", "EE: otro", "Pierde por tapa", "Pinchado"],
  riesgos: ["ALTO", "MEDIO", "BAJO"],
  opciones_riesgo: ["Cambiar la probabilidad o consecuencia", "Eliminar el riesgo", "Evitar el riesgo", "Compartir o mantener el riesgo mediante decisiones informadas", "Asumir el riesgo para perseguir una oportunidad"],
};
const lista = (listas, id) => ((listas && Array.isArray(listas[id]) && listas[id].length) ? listas[id] : LISTAS_DEF[id] || []);
const fFecha = (d) => (d ? String(d).slice(0, 10).split("-").reverse().join("/") : "");
const horaAhora = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const inputCls = "w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1";
const labelCls = "text-[10px] uppercase tracking-widest text-[#94a1ab]";
const MOTIVOS = { sin_permiso: "No tenés permiso para esto. Pedíselo a Calidad.", falta_producto: "Elegí el producto.", pin_incorrecto: "Tu sesión venció: volvé a entrar.", no_es_responsable: "Esa acción ya no está a tu cargo.", cerrada: "Esa acción ya está cerrada." };

function Sel({ value, onChange, opciones, vacio, ...rest }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} {...rest}>
      {vacio != null && <option value="">{vacio}</option>}
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function CargarReclamo({ empleado, pin, permisos, onRefrescar }) {
  const vacio = () => ({ hora: horaAhora(), producto: "", lote: "", vencimiento: "", vencimiento_ilegible: false, cantidad: 1, desvio: "", reclamo_cliente: "", cliente: "", comentarios: "", origen: permisos.origen || "" });
  const [d, setD] = useState(vacio);
  const [enviando, setEnviando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [listo, setListo] = useState(null); // { numero, anio }
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const L = (id) => lista(permisos.listas, id);

  const guardar = async () => {
    setMsg(null);
    if (!d.producto) return setMsg("Elegí el producto.");
    if (!permisos.origen && !d.origen) return setMsg("Elegí el origen del reclamo.");
    setEnviando(true);
    try {
      const r = await sbRpc("calidad_cargar_reclamo", { p_legajo: empleado.legajo, p_pin: pin, p_datos: { ...d, vencimiento: d.vencimiento_ilegible ? "" : d.vencimiento } });
      if (!r || !r.ok) return setMsg(MOTIVOS[r?.motivo] || "No se pudo guardar el reclamo.");
      setListo({ numero: r.numero, anio: r.anio });
      onRefrescar();
    } catch { setMsg("No se pudo conectar. Probá de nuevo."); }
    finally { setEnviando(false); }
  };

  if (listo) {
    return (
      <div className="text-center py-6" data-reclamo-listo>
        <p className="text-4xl mb-2">✅</p>
        <p className="text-base font-bold">Reclamo Nº {listo.numero} / {listo.anio} cargado</p>
        <p className="text-sm text-[#5c6b78] mt-1">Anotá el número para el cliente. Desde acá lo sigue Calidad.</p>
        <button onClick={() => { setListo(null); setD(vacio()); }} className="mt-5 w-full py-3 rounded-xl font-bold text-sm bg-[#e1251b] text-white">Cargar otro reclamo</button>
      </div>
    );
  }
  return (
    <div data-form-reclamo>
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-sm font-bold">Nuevo reclamo</p>
        <p className="text-sm text-[#94a1ab]" data-nro title="Número que se le va a asignar (se confirma al guardar)">Nº {permisos.proximo_numero} / {permisos.anio}</p>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2">
        <div>
          <label className={labelCls}>Fecha</label>
          <input value={fFecha(permisos.hoy)} readOnly tabIndex={-1} className={inputCls + " text-[#5c6b78] cursor-not-allowed"} data-fecha />
        </div>
        <div>
          <label className={labelCls}>Origen</label>
          {permisos.origen
            ? <input value={permisos.origen} readOnly tabIndex={-1} className={inputCls + " text-[#5c6b78] cursor-not-allowed"} />
            : <Sel value={d.origen} onChange={set("origen")} opciones={L("origenes_reclamo")} vacio="Elegir…" />}
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Cliente</label>
          <input value={d.cliente} onChange={(e) => set("cliente")(e.target.value)} maxLength={80} placeholder="Nombre o Nº de cliente" className={inputCls} />
        </div>
      </div>
      {/* Producto, lote, hora y vencimiento en la misma línea */}
      <div className="grid grid-cols-4 gap-2 mt-2" data-linea>
        <div className="col-span-4 sm:col-span-1">
          <label className={labelCls}>Producto</label>
          <Sel value={d.producto} onChange={set("producto")} opciones={L("productos")} vacio="Elegir…" data-prod />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Lote</label>
          <input value={d.lote} onChange={(e) => set("lote")(e.target.value)} maxLength={30} placeholder="Ej: 343" className={inputCls} />
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className={labelCls}>Hora</label>
          <input type="time" value={d.hora} onChange={(e) => set("hora")(e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-4 sm:col-span-1">
          <label className={labelCls}>Vencimiento</label>
          <input type="date" value={d.vencimiento} disabled={d.vencimiento_ilegible} onChange={(e) => set("vencimiento")(e.target.value)} className={inputCls + " disabled:opacity-50"} />
          <label className="text-[11px] text-[#5c6b78] flex items-center gap-1 mt-1"><input type="checkbox" checked={d.vencimiento_ilegible} onChange={(e) => set("vencimiento_ilegible")(e.target.checked)} /> Ilegible</label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-2 mt-2">
        <div>
          <label className={labelCls}>Cantidad</label>
          <input type="number" min="1" step="1" value={d.cantidad} onChange={(e) => set("cantidad")(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Desvío informado</label>
          <Sel value={d.desvio} onChange={set("desvio")} opciones={L("desvios")} vacio="—" />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Reclamo del cliente</label>
          <Sel value={d.reclamo_cliente} onChange={set("reclamo_cliente")} opciones={L("reclamos_cliente")} vacio="—" data-rc />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Comentarios</label>
          <textarea value={d.comentarios} onChange={(e) => set("comentarios")(e.target.value)} rows={3} placeholder="Lo que contó el cliente, cómo llegó el producto…" className={inputCls + " resize-none"} />
        </div>
      </div>
      {msg && <p className="text-xs text-[#e5484d] mt-2">{msg}</p>}
      <button onClick={guardar} disabled={enviando} className="w-full mt-3 py-3 rounded-xl font-bold text-sm bg-[#e1251b] text-white disabled:opacity-50">
        {enviando ? "Guardando…" : "Guardar reclamo"}
      </button>
      <p className="text-[11px] text-[#94a1ab] mt-2 text-center">El control en fábrica lo completa Calidad. Una vez guardado, el reclamo no se ve más desde acá.</p>
    </div>
  );
}

function MisAcciones({ empleado, pin, onRefrescar }) {
  const [acciones, setAcciones] = useState(null);
  const [listas, setListas] = useState({});
  const [abierta, setAbierta] = useState(null);
  const [d, setD] = useState({});
  const [msg, setMsg] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const cargar = async () => {
    try {
      const r = await sbRpc("calidad_mis_acciones", { p_legajo: empleado.legajo, p_pin: pin });
      setAcciones(r && r.ok ? r.acciones || [] : []);
      setListas((r && r.listas) || {});
    } catch { setAcciones([]); }
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);
  const abrir = (a) => {
    setAbierta(a); setMsg(null);
    setD({ riesgo: a.riesgo || "", opcion_riesgo: a.opcion_riesgo || "", causa: a.causa || "", correccion: a.correccion || "", fecha_correccion: a.fecha_correccion || "", accion: a.accion || "", fecha_accion: a.fecha_accion || "" });
  };
  const set = (k) => (v) => setD((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    setMsg(null);
    if (!d.causa.trim()) return setMsg({ ok: false, t: "Escribí la causa (punto 2)." });
    if (!d.correccion.trim() && !d.accion.trim()) return setMsg({ ok: false, t: "Completá la corrección (punto 3) o la acción (punto 4)." });
    setGuardando(true);
    try {
      const r = await sbRpc("calidad_guardar_accion", { p_legajo: empleado.legajo, p_pin: pin, p_id: abierta.id, p_datos: d });
      if (!r || !r.ok) return setMsg({ ok: false, t: MOTIVOS[r?.motivo] || "No se pudo guardar." });
      setMsg({ ok: true, t: "Guardado ✓. Calidad ya lo ve." });
      await cargar(); onRefrescar();
      setAbierta(null);
    } catch { setMsg({ ok: false, t: "No se pudo conectar. Probá de nuevo." }); }
    finally { setGuardando(false); }
  };

  if (acciones === null) return <p className="text-[#94a1ab] text-sm">Cargando…</p>;
  if (abierta) {
    const L = (id) => lista(listas, id);
    return (
      <div data-accion={abierta.id}>
        <button onClick={() => setAbierta(null)} className="text-xs text-[#5c6b78] mb-2">‹ Volver a mis acciones</button>
        <p className="text-sm font-bold">Acción de mejora {abierta.numero}-{String(abierta.anio).slice(-2)}</p>
        <div className="bg-[#f1f4f7] border border-[#e3e8ed] rounded-xl p-3 my-2 text-sm">
          <p className={labelCls}>1 · Hallazgo <span className="normal-case tracking-normal">· {fFecha(abierta.fecha)}{abierta.origen ? ` · ${abierta.origen}` : ""}{abierta.proceso ? ` · ${abierta.proceso}` : ""}</span></p>
          <p className="mt-1 whitespace-pre-wrap">{abierta.hallazgo}</p>
        </div>
        <p className="text-xs font-bold mt-3 text-[#0d9488]">2 · Riesgo y causa</p>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={labelCls}>Riesgo</label><Sel value={d.riesgo} onChange={set("riesgo")} opciones={L("riesgos")} vacio="—" /></div>
          <div><label className={labelCls}>Cómo abordarlo</label><Sel value={d.opcion_riesgo} onChange={set("opcion_riesgo")} opciones={L("opciones_riesgo")} vacio="—" /></div>
          <div className="col-span-2"><label className={labelCls}>Causa</label><textarea data-causa value={d.causa} onChange={(e) => set("causa")(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="¿Por qué pasó?" /></div>
        </div>
        <p className="text-xs font-bold mt-3 text-[#0d9488]">3 · Corrección (lo inmediato)</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><label className={labelCls}>Corrección</label><textarea data-correccion value={d.correccion} onChange={(e) => set("correccion")(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Qué se hizo en el momento" /></div>
          <div><label className={labelCls}>Fecha límite</label><input type="date" value={d.fecha_correccion} onChange={(e) => set("fecha_correccion")(e.target.value)} className={inputCls} /></div>
        </div>
        <p className="text-xs font-bold mt-3 text-[#0d9488]">4 · Acción correctiva / de mejora</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2"><label className={labelCls}>Acción</label><textarea data-accion-txt value={d.accion} onChange={(e) => set("accion")(e.target.value)} rows={2} className={inputCls + " resize-none"} placeholder="Qué se va a hacer para que no se repita" /></div>
          <div><label className={labelCls}>Fecha límite de implementación</label><input type="date" value={d.fecha_accion} onChange={(e) => set("fecha_accion")(e.target.value)} className={inputCls} /></div>
        </div>
        {msg && <p className={`text-xs mt-2 ${msg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{msg.t}</p>}
        <button onClick={guardar} disabled={guardando} className="w-full mt-3 py-3 rounded-xl font-bold text-sm bg-[#0d9488] text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar y enviar a Calidad"}</button>
        <p className="text-[11px] text-[#94a1ab] mt-2 text-center">Los puntos 5 y 6 (seguimiento y eficacia) los hace Calidad.</p>
      </div>
    );
  }
  return (
    <div data-mis-acciones>
      {msg && msg.ok && <p className="text-xs text-[#16a34a] mb-2">{msg.t}</p>}
      {acciones.length === 0 ? <p className="text-[#94a1ab] text-sm italic">No tenés acciones de mejora abiertas a tu cargo. 👌</p> : (
        <div className="space-y-2">
          {acciones.map((a) => (
            <button key={a.id} onClick={() => abrir(a)} className="w-full text-left border border-[#e3e8ed] rounded-xl p-3 hover:border-[#cfd6dd]" data-accion-item={a.id}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{a.numero}-{String(a.anio).slice(-2)} · {fFecha(a.fecha)}</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={a.resp_completo_en ? { color: "#16a34a", backgroundColor: "rgba(22,163,74,.12)" } : { color: "#b9820b", backgroundColor: "rgba(242,169,0,.14)" }}>{a.resp_completo_en ? "Enviada" : "Para completar"}</span>
              </div>
              <p className="text-xs text-[#5c6b78] mt-1 line-clamp-2">{a.hallazgo}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Calidad({ empleado, pin, permisos, onVolver, onRefrescar }) {
  const tabs = [permisos.reclamos && ["reclamo", "📝 Cargar un reclamo"], permisos.acciones && ["acciones", `🛠 Mis acciones${permisos.acciones_pendientes ? ` (${permisos.acciones_pendientes})` : ""}`]].filter(Boolean);
  const [tab, setTab] = useState(tabs[0] ? tabs[0][0] : "reclamo");
  return (
    <div className="min-h-screen w-full flex items-start justify-center p-4">
      <div className="w-full max-w-[460px] bg-white rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden" data-calidad>
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#cfd6dd]">
          <div><p className="text-sm font-bold">🔬 Calidad</p><p className="text-[#94a1ab] text-xs">{empleado.apellido}, {empleado.nombre}</p></div>
          <button onClick={onVolver} className="text-[#94a1ab] hover:text-[#1f2d38] text-xl leading-none" title="Volver">×</button>
        </div>
        {tabs.length > 1 && (
          <div className="flex border-b border-[#e3e8ed]">
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className="flex-1 py-2.5 text-sm font-semibold" style={{ color: tab === id ? "#e1251b" : "#94a1ab", borderBottom: tab === id ? "2px solid #e1251b" : "2px solid transparent" }}>{label}</button>
            ))}
          </div>
        )}
        <div className="px-6 py-4">
          {!tabs.length ? <p className="text-sm text-[#5c6b78]">No tenés permisos de Calidad. Si tenés que cargar reclamos o completar acciones de mejora, pedíselo a Calidad.</p>
            : tab === "reclamo" ? <CargarReclamo empleado={empleado} pin={pin} permisos={permisos} onRefrescar={onRefrescar} />
            : <MisAcciones empleado={empleado} pin={pin} onRefrescar={onRefrescar} />}
        </div>
      </div>
    </div>
  );
}
