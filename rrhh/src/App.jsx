import { useState, useEffect } from "react";
import { sbGet, sbRpc } from "./lib/supabase.js";
import {
  calcularEstado, obtenerPosicion, estadoUbicacion, obtenerDeviceId,
} from "./lib/fichaje.js";
import Historial from "./screens/Historial.jsx";
import Equipo from "./screens/Equipo.jsx";
import Ausencias from "./screens/Ausencias.jsx";
import Calidad from "./screens/Calidad.jsx";
import { LOGO } from "./lib/logo.js";
import { cargarConfig } from "./lib/cumplimiento.js";
import { contextoFichada, tieneExtrasPropias } from "./lib/jornada.js";

export default function App() {
  // Identificación
  const [legajo, setLegajo] = useState("");
  const [pin, setPin] = useState("");
  const [pinAuth, setPinAuth] = useState(null);
  const [empleado, setEmpleado] = useState(null);
  const [errorLogin, setErrorLogin] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [tardanzas, setTardanzas] = useState(0);
  const [aCargo, setACargo] = useState(0);
  const [debeCambiar, setDebeCambiar] = useState(false);
  const [okPin, setOkPin] = useState(null);
  const [nvPin, setNvPin] = useState("");
  const [nvPinRep, setNvPinRep] = useState("");
  const [ausenciasPend, setAusenciasPend] = useState(0);
  const [vista, setVista] = useState("fichaje"); // "fichaje" | "historial" | "equipo" | "ausencias" | "calidad"
  // Calidad: permisos del empleado (cargar reclamos / responsable de acciones de mejora)
  const [calidad, setCalidad] = useState(null);
  // Entrando por el link "Reclamos y acciones de mejora" del ingreso de Gestión (?ir=calidad)
  const irCalidad = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("ir") === "calidad";

  // Cambio de PIN (desde el login)
  const [modoPin, setModoPin] = useState(false);
  const [pinActual, setPinActual] = useState("");
  const [pinNuevo, setPinNuevo] = useState("");
  const [pinRep, setPinRep] = useState("");
  const [pinMsg, setPinMsg] = useState(null);
  const [cambiandoPin, setCambiandoPin] = useState(false);

  // Datos base
  const [horarios, setHorarios] = useState([]);
  const [locales, setLocales] = useState([]);
  const [config, setConfig] = useState({ recargos: [], feriados: {} });

  // Estado del turno
  const [ahora, setAhora] = useState(new Date());
  const [enTurno, setEnTurno] = useState(false);
  const [historial, setHistorial] = useState([]);
  // Fichadas de las últimas 30 h: para el descanso entre jornadas y las jornadas que terminan pasada la medianoche.
  const [recientes, setRecientes] = useState([]);
  const [jornadaDeAyer, setJornadaDeAyer] = useState(null); // hora de entrada de una jornada que sigue abierta desde ayer
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [ubic, setUbic] = useState(null); // { tipo, local, distancia }
  // Quien ficha "desde su computadora" (sin GPS): { modo: 'gps' | 'pc', estado: 'aprobado' | 'pendiente' | 'rechazado' | 'sin_id', local_id, local_nombre }
  const [equipo, setEquipo] = useState({ modo: "gps" });
  const desdePC = equipo.modo === "pc";
  const [ubicCargando, setUbicCargando] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const horarioEmpleado = empleado ? horarios.find((h) => String(h.id) === String(empleado.horario_id)) : null;

  const refrescarUbicacion = async () => {
    setUbicCargando(true);
    try {
      const pos = await obtenerPosicion();
      setUbic(estadoUbicacion(pos, locales, empleado?.locales_asignados));
    } catch { setUbic({ tipo: "sin_gps" }); }
    finally { setUbicCargando(false); }
  };

  // Al entrar al fichaje, obtener la ubicación para mostrarla
  useEffect(() => {
    if (empleado && vista === "fichaje" && !desdePC) refrescarUbicacion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empleado, vista, locales, desdePC]);
  const consultarEquipo = async (nro, pinUsado) => {
    try {
      const r = await sbRpc("mi_equipo", { p_legajo: nro, p_pin: pinUsado, p_device_id: obtenerDeviceId(), p_aparato: navigator.userAgent.slice(0, 300) });
      if (r && r.ok) setEquipo(r); else setEquipo({ modo: "gps" });
    } catch { setEquipo({ modo: "gps" }); } // la base todavía no tiene esta función: se ficha como siempre
  };

  const consultarCalidad = async (nro, pinUsado) => {
    try {
      const r = await sbRpc("calidad_mis_permisos", { p_legajo: nro, p_pin: pinUsado });
      const c = r && r.ok ? r : null;
      setCalidad(c);
      return c;
    } catch { setCalidad(null); return null; } // la base todavía no tiene Calidad para empleados
  };

  const ingresar = async () => {
    setErrorLogin(null);
    const nro = parseInt(legajo, 10);
    if (!nro) return setErrorLogin("Ingresá un número de legajo válido.");
    if (!pin || pin.length < 4) return setErrorLogin("Ingresá tu PIN (mínimo 4 dígitos).");
    setBuscando(true);
    try {
      const r = await sbRpc("login_empleado", { p_legajo: nro, p_pin: pin });
      if (!r || !r.ok) {
        setErrorLogin(r?.motivo === "pin_incorrecto" ? "PIN incorrecto." : "No se encontró ningún empleado con ese legajo.");
      } else {
        const [hs, ls] = await Promise.all([sbGet("horarios?select=*"), sbGet("locales?select=*")]);
        setHorarios(hs);
        setLocales(ls);
        // La config de recargos es opcional: si falla, se usan los valores por defecto y el login igual funciona.
        try { setConfig(await cargarConfig(sbGet)); } catch { /* usa defaults */ }
        await consultarEquipo(nro, pin);
        const cal = await consultarCalidad(nro, pin);
        setEmpleado(r.empleado);
        setPinAuth(pin);
        setTardanzas(r.tardanzas_periodo || 0);
        setACargo(r.a_cargo || 0);
        setAusenciasPend(r.ausencias_pendientes || 0);
        setDebeCambiar(!!r.debe_cambiar_pin);
        setVista(irCalidad ? "calidad" : "fichaje");
        if (irCalidad && !(cal && (cal.reclamos || cal.acciones))) setMsg({ ok: false, texto: "No tenés permiso para cargar reclamos ni acciones de mejora. Pedíselo a Calidad." });
        const hoy = Array.isArray(r.fichajes_hoy) ? r.fichajes_hoy : [];
        let rec = hoy;
        try {
          const h = await sbRpc("mi_historial", { p_legajo: nro, p_pin: pin, p_desde: new Date(Date.now() - 30 * 3600000).toISOString(), p_hasta: new Date().toISOString() });
          if (h && h.ok && Array.isArray(h.fichajes)) rec = h.fichajes;
        } catch { /* sin historial: solo lo de hoy */ }
        setRecientes(rec.map((f) => ({ tipo: f.tipo, ts: new Date(f.timestamp) })));
        if (hoy.length) {
          const ultimo = hoy[hoy.length - 1];
          setEnTurno(ultimo.tipo === "entrada");
          setHistorial(hoy.slice().reverse().map((f) => ({ tipo: f.tipo, hora: new Date(f.timestamp), estado: f.estado })));
        } else {
          // Camioneros y otros horarios con jornada larga: si la entrada de ayer sigue
          // abierta (volvió pasada la medianoche), el botón registra la SALIDA de esa jornada.
          const hor = hs.find((x) => String(x.id) === String(r.empleado.horario_id));
          const ult = rec[rec.length - 1];
          if (tieneExtrasPropias(hor) && ult && ult.tipo === "entrada" && (Date.now() - new Date(ult.timestamp)) < 20 * 3600000) {
            setEnTurno(true);
            setJornadaDeAyer(new Date(ult.timestamp));
            setHistorial([{ tipo: "entrada", hora: new Date(ult.timestamp), estado: ult.estado }]);
          }
        }
      }
    } catch {
      setErrorLogin("No se pudo conectar con la base. Revisá la conexión.");
    } finally {
      setBuscando(false);
    }
  };

  const cambiarMiPin = async () => {
    setPinMsg(null);
    const nro = parseInt(legajo, 10);
    if (!nro) return setPinMsg({ ok: false, texto: "Ingresá tu legajo arriba." });
    if (!pinActual) return setPinMsg({ ok: false, texto: "Ingresá tu PIN actual." });
    if (!pinNuevo || pinNuevo.length < 4) return setPinMsg({ ok: false, texto: "El PIN nuevo debe tener 4+ dígitos." });
    if (pinNuevo !== pinRep) return setPinMsg({ ok: false, texto: "El PIN nuevo no coincide." });
    setCambiandoPin(true);
    try {
      const r = await sbRpc("cambiar_pin", { p_legajo: nro, p_pin_actual: pinActual, p_nuevo_pin: pinNuevo });
      if (!r || !r.ok) {
        setPinMsg({ ok: false, texto: r?.motivo === "pin_incorrecto" ? "El PIN actual es incorrecto." : "No se encontró ese legajo." });
      } else {
        setPinMsg({ ok: true, texto: "¡PIN actualizado! Ya podés ingresar con el nuevo." });
        setPinActual(""); setPinNuevo(""); setPinRep("");
      }
    } catch {
      setPinMsg({ ok: false, texto: "No se pudo conectar. Probá de nuevo." });
    } finally {
      setCambiandoPin(false);
    }
  };

  const salir = () => {
    setEmpleado(null); setPinAuth(null); setLegajo(""); setPin("");
    setEnTurno(false); setHistorial([]); setRecientes([]); setJornadaDeAyer(null); setMsg(null); setEquipo({ modo: "gps" }); setTardanzas(0); setACargo(0); setAusenciasPend(0); setDebeCambiar(false); setVista("fichaje"); setCalidad(null);
  };

  const fichar = async () => {
    const tipo = enTurno ? "salida" : "entrada";
    setGuardando(true);
    setMsg(null);
    try {
      const hora = new Date();
      if (desdePC && equipo.estado !== "aprobado") {
        setMsg({ ok: false, texto: equipo.estado === "pendiente" ? "Esta computadora todavía no fue aprobada por RR.HH." : "Desde este equipo no podés fichar: usá tu computadora del escritorio." });
        setGuardando(false); return;
      }
      // Desde la computadora no se usa el GPS: la ubicación es la de la computadora aprobada.
      const pos = desdePC ? null : await obtenerPosicion();
      const eu = desdePC ? (equipo.local_id ? { tipo: "dentro", local: { id: equipo.local_id, nombre: equipo.local_nombre }, distancia: null } : { tipo: "remoto" }) : estadoUbicacion(pos, locales, empleado?.locales_asignados);
      if (!desdePC) setUbic(eu);
      const dentro = eu.tipo === "dentro";
      const est = calcularEstado(tipo, hora, horarioEmpleado, contextoFichada(recientes, hora));
      const r = await sbRpc("registrar_fichaje", {
        p_legajo: empleado.legajo,
        p_pin: pinAuth,
        p_data: {
          tipo,
          timestamp: hora.toISOString(),
          lat: pos?.lat ?? null,
          lng: pos?.lng ?? null,
          local_id: dentro ? eu.local.id : null,
          distancia_metros: eu.distancia ?? null,
          estado: est.estado,
          minutos_tarde: est.minutosTarde || 0,
          device_id: obtenerDeviceId(),
          user_agent: navigator.userAgent.slice(0, 300),
        },
      });
      if (!r || !r.ok) throw new Error("rechazado");
      setHistorial((h) => [{ tipo, hora, estado: est.estado }, ...h]);
      setRecientes((x) => [...x, { tipo, ts: hora }]);
      setJornadaDeAyer(null);
      if (est.estado === "tarde") setTardanzas((n) => n + 1);
      setEnTurno(!enTurno);
      setMsg({ ok: true, texto: `${tipo === "entrada" ? "Entrada" : "Salida"} registrada · ${est.label}` });
    } catch {
      setMsg({ ok: false, texto: desdePC ? "No se pudo guardar el fichaje (¿esta computadora sigue aprobada?). Avisale a RR.HH." : "No se pudo guardar el fichaje. Probá de nuevo." });
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Login ----------
  if (!empleado) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[380px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <img src={LOGO} alt="ANAFER" className="h-12 mb-3" />
            <h1 className="text-lg font-bold">{irCalidad ? "Reclamos y acciones de mejora" : "Identificate para fichar"}</h1>
            <p className="text-[#94a1ab] text-sm mt-1">{irCalidad ? "Calidad · ingresá con tu legajo y tu PIN" : "Ingresá tu legajo y tu PIN"}</p>
          </div>
          <input value={legajo} onChange={(e) => setLegajo(e.target.value)} type="number" placeholder="Legajo"
            className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 text-center text-lg outline-none" />
          <input value={pin} onChange={(e) => setPin(e.target.value)} type="password" inputMode="numeric" placeholder="PIN"
            onKeyDown={(e) => e.key === "Enter" && ingresar()}
            className="w-full mt-3 bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 text-center text-lg tracking-[0.5em] outline-none" />
          {errorLogin && <p className="text-[#e5484d] text-sm mt-3">{errorLogin}</p>}
          <button onClick={ingresar} disabled={buscando}
            className="w-full mt-4 py-3 rounded-xl font-bold bg-[#e1251b] text-white disabled:opacity-50">
            {buscando ? "Ingresando…" : "Continuar"}
          </button>

          {!modoPin ? (
            <button onClick={() => { setModoPin(true); setPinMsg(null); }}
              className="w-full mt-3 text-xs text-[#94a1ab] hover:text-[#5c6b78]">Cambiar mi PIN</button>
          ) : (
            <div className="mt-4 pt-4 border-t border-dashed border-[#cfd6dd]">
              <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Cambiar mi PIN</p>
              <p className="text-[11px] text-[#94a1ab] mb-3">Usá el legajo de arriba. Necesitás tu PIN actual.</p>
              <input value={pinActual} onChange={(e) => setPinActual(e.target.value)} type="password" inputMode="numeric" placeholder="PIN actual"
                className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none mb-2" />
              <input value={pinNuevo} onChange={(e) => setPinNuevo(e.target.value)} type="password" inputMode="numeric" placeholder="PIN nuevo"
                className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none mb-2" />
              <input value={pinRep} onChange={(e) => setPinRep(e.target.value)} type="password" inputMode="numeric" placeholder="Repetir PIN nuevo"
                onKeyDown={(e) => e.key === "Enter" && cambiarMiPin()}
                className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-2.5 text-center tracking-[0.4em] outline-none" />
              {pinMsg && <p className={`text-xs mt-2 ${pinMsg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{pinMsg.texto}</p>}
              <div className="flex gap-2 mt-3">
                <button onClick={() => { setModoPin(false); setPinMsg(null); setPinActual(""); setPinNuevo(""); setPinRep(""); }}
                  className="flex-1 py-2.5 rounded-xl font-semibold text-xs bg-[#f1f4f7] border border-[#cfd6dd] text-[#5c6b78]">Volver</button>
                <button onClick={cambiarMiPin} disabled={cambiandoPin}
                  className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-[#e1251b] text-white disabled:opacity-50">
                  {cambiandoPin ? "…" : "Guardar PIN"}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Historial ----------
  if (vista === "historial") {
    return <Historial empleado={empleado} pin={pinAuth} onVolver={() => setVista("fichaje")} />;
  }

  if (vista === "ausencias") {
    return <Ausencias empleado={empleado} pin={pinAuth} esJefe={aCargo > 0} onVolver={() => setVista("fichaje")} />;
  }

  // ---------- Equipo ----------
  if (vista === "calidad" && calidad && (calidad.reclamos || calidad.acciones)) {
    return <Calidad empleado={empleado} pin={pinAuth} permisos={calidad} onVolver={() => setVista("fichaje")} onRefrescar={() => consultarCalidad(empleado.legajo, pinAuth)} />;
  }

  if (vista === "equipo") {
    return <Equipo empleado={empleado} pin={pinAuth} horarios={horarios} config={config} onVolver={() => setVista("fichaje")} />;
  }

  // ---------- Cambio de PIN obligatorio (primer ingreso) ----------
  const cambiarPinObligatorio = async () => {
    setOkPin(null);
    if (!nvPin || nvPin.length < 4) return setOkPin({ ok: false, texto: "El PIN nuevo debe tener 4 o más dígitos." });
    if (nvPin === pinAuth) return setOkPin({ ok: false, texto: "Elegí un PIN distinto al que te dieron." });
    if (nvPin !== nvPinRep) return setOkPin({ ok: false, texto: "Los PIN no coinciden." });
    try {
      const r = await sbRpc("cambiar_pin", { p_legajo: empleado.legajo, p_pin_actual: pinAuth, p_nuevo_pin: nvPin });
      if (!r || !r.ok) return setOkPin({ ok: false, texto: r?.motivo === "mismo_pin" ? "Elegí un PIN distinto." : "No se pudo cambiar. Probá de nuevo." });
      setPinAuth(nvPin); setDebeCambiar(false); setNvPin(""); setNvPinRep(""); setOkPin(null);
    } catch { setOkPin({ ok: false, texto: "No se pudo conectar. Probá de nuevo." }); }
  };

  if (debeCambiar) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[400px] bg-white rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden">
          <div className="px-6 pt-6 pb-2 flex items-center gap-3 border-b border-dashed border-[#cfd6dd]">
            <img src={LOGO} alt="ANAFER" className="h-9" />
            <div><p className="text-sm font-bold">Hola, {empleado.nombre}</p><p className="text-[#94a1ab] text-xs">Legajo {empleado.legajo}</p></div>
          </div>
          <div className="px-6 py-5">
            <div className="rounded-xl p-3 mb-4 text-sm" style={{ backgroundColor: "rgba(43,169,224,.1)", color: "#1f6f96" }}>
              🔒 Por seguridad, antes de fichar tenés que <b>cambiar el PIN</b> que te dio RR.HH. por uno personal que solo vos sepas.
            </div>
            <label className="text-[10px] uppercase tracking-widest text-[#94a1ab]">PIN nuevo</label>
            <input type="password" inputMode="numeric" value={nvPin} onChange={(e) => setNvPin(e.target.value)} placeholder="Mínimo 4 dígitos"
              className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2.5 text-sm outline-none mt-1 mb-3" />
            <label className="text-[10px] uppercase tracking-widest text-[#94a1ab]">Repetir PIN nuevo</label>
            <input type="password" inputMode="numeric" value={nvPinRep} onChange={(e) => setNvPinRep(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && cambiarPinObligatorio()}
              className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-3 py-2.5 text-sm outline-none mt-1 mb-2" />
            {okPin && <p className={`text-xs mb-2 ${okPin.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{okPin.texto}</p>}
            <button onClick={cambiarPinObligatorio} className="w-full py-3 rounded-xl font-bold text-sm bg-[#e1251b] text-white">
              Guardar PIN y continuar
            </button>
            <button onClick={salir} className="w-full mt-2 text-xs text-[#94a1ab]">Salir</button>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Fichaje ----------
  const duracion = () => {
    if (!enTurno || !historial.length) return "0h 0m";
    const ent = historial.find((h) => h.tipo === "entrada");
    if (!ent) return "0h 0m";
    const ms = ahora - ent.hora;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4">
      <div className="w-full max-w-[400px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-dashed border-[#cfd6dd]">
          <div>
            <p className="text-[#5c6b78] text-xs uppercase tracking-widest">{empleado.apellido}, {empleado.nombre}</p>
            <p className="text-sm capitalize">{ahora.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</p>
          </div>
          <button onClick={salir} className="text-[#94a1ab] hover:text-[#5c6b78] text-xs">Salir</button>
        </div>

        {aCargo > 0 && ausenciasPend > 0 && (
          <button onClick={() => setVista("ausencias")} className="mx-6 mt-3 w-[calc(100%-3rem)] rounded-xl p-3 flex items-center gap-2 border text-left"
            style={{ backgroundColor: "rgba(242,169,0,.12)", borderColor: "rgba(242,169,0,.5)" }}>
            <span>🔔</span>
            <span className="text-xs flex-1" style={{ color: "#b9820b" }}>Tenés <b>{ausenciasPend} solicitud{ausenciasPend !== 1 ? "es" : ""} de ausencia</b> de tu equipo esperando aprobación.</span>
            <span className="text-xs font-bold" style={{ color: "#e1251b" }}>Revisar ›</span>
          </button>
        )}

        {tardanzas >= 3 && (
          <div className="mx-6 mt-3 rounded-xl p-3 flex items-center gap-2 border"
            style={{ backgroundColor: "rgba(229,72,77,.1)", borderColor: "rgba(229,72,77,.4)" }}>
            <span>⚠️</span>
            <span className="text-xs text-[#e5484d]">Llevás <b>{tardanzas} llegadas tarde</b> este período. Tené en cuenta la puntualidad.</span>
          </div>
        )}

        <div className="px-6 py-6 text-center">
          <p className="text-5xl font-black tabular-nums">{ahora.toLocaleTimeString("es-AR")}</p>
          <span className="inline-block mt-3 text-xs font-semibold px-3 py-1 rounded-full"
            style={{ backgroundColor: enTurno ? "rgba(61,220,132,.12)" : "#f1f4f7", color: enTurno ? "#16a34a" : "#5c6b78" }}>
            {enTurno ? `EN TURNO · ${duracion()}` : "FUERA DE TURNO"}
          </span>
          {!horarioEmpleado && <p className="text-[11px] text-[#94a1ab] mt-3">Sin turno asignado</p>}
          {jornadaDeAyer && (
            <div className="mt-3 text-[11px] text-[#5c6b78] bg-[#f1f4f7] rounded-xl px-3 py-2">
              Tu jornada empezó {jornadaDeAyer.toLocaleDateString("es-AR", { weekday: "long" })} a las {jornadaDeAyer.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}: el botón registra la <b>salida</b> de esa jornada.
              <button onClick={() => { setEnTurno(false); setJornadaDeAyer(null); setHistorial([]); }} className="block mx-auto mt-1 text-[#223c7e] underline">No, empiezo una jornada nueva</button>
            </div>
          )}
        </div>

        {msg && <p className={`mx-6 mb-3 text-xs text-center font-semibold ${msg.ok ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{msg.texto}</p>}

        {/* Estado de ubicación (o de la computadora, para quien ficha desde su PC) */}
        <div className="px-6 pb-3">
          {desdePC ? (() => {
            const c = {
              aprobado: { bg: "rgba(22,163,74,.1)", bd: "rgba(22,163,74,.4)", col: "#16a34a", ico: "💻", txt: `Fichás desde tu computadora${equipo.local_nombre ? ` · ${equipo.local_nombre}` : ""}` },
              pendiente: { bg: "rgba(242,169,0,.12)", bd: "rgba(242,169,0,.5)", col: "#b9820b", ico: "⏳", txt: "Esta computadora está esperando que RR.HH. la apruebe. Cuando la aprueben vas a poder fichar desde acá." },
              rechazado: { bg: "rgba(229,72,77,.1)", bd: "rgba(229,72,77,.4)", col: "#e5484d", ico: "⛔", txt: "Desde este equipo no podés fichar: usá tu computadora del escritorio." },
              sin_id: { bg: "rgba(229,72,77,.1)", bd: "rgba(229,72,77,.4)", col: "#e5484d", ico: "⛔", txt: "Este navegador no permite identificar la computadora (¿modo incógnito?)." },
            }[equipo.estado] || { bg: "#f1f4f7", bd: "#e3e8ed", col: "#5c6b78", ico: "💻", txt: "Revisando la computadora…" };
            return (
              <div className="rounded-xl p-3 flex items-center gap-2 border" style={{ backgroundColor: c.bg, borderColor: c.bd }}>
                <span>{c.ico}</span>
                <span className="text-xs flex-1" style={{ color: c.col }}>{c.txt}</span>
                {equipo.estado !== "aprobado" && <button onClick={() => consultarEquipo(empleado.legajo, pinAuth)} className="text-[11px] text-[#5c6b78] hover:text-[#1f2d38]" title="Volver a fijarse">↻</button>}
              </div>
            );
          })() : (() => {
            const cfg = {
              sin_gps: { bg: "rgba(148,161,171,.12)", bd: "#cfd6dd", col: "#5c6b78", ico: "📍", txt: "Ubicación no disponible (revisá el permiso del navegador)" },
              remoto: { bg: "rgba(43,169,224,.1)", bd: "rgba(43,169,224,.4)", col: "#2ba9e0", ico: "📡", txt: "Ubicación remota — sin depósitos cargados cerca" },
              fuera: { bg: "rgba(229,72,77,.1)", bd: "rgba(229,72,77,.4)", col: "#e5484d", ico: "⚠️", txt: ubic ? `Fuera del radio de ${ubic.local?.nombre} (a ${ubic.distancia} m)` : "" },
              dentro: { bg: "rgba(22,163,74,.1)", bd: "rgba(22,163,74,.4)", col: "#16a34a", ico: "✅", txt: ubic ? `En ${ubic.local?.nombre} (a ${ubic.distancia} m)` : "" },
            };
            const c = ubicCargando || !ubic ? { bg: "#f1f4f7", bd: "#e3e8ed", col: "#5c6b78", ico: "📍", txt: "Obteniendo ubicación…" } : (cfg[ubic.tipo] || cfg.remoto);
            return (
              <div className="rounded-xl p-3 flex items-center gap-2 border" style={{ backgroundColor: c.bg, borderColor: c.bd }}>
                <span>{c.ico}</span>
                <span className="text-xs flex-1" style={{ color: c.col }}>{c.txt}</span>
                {!ubicCargando && <button onClick={refrescarUbicacion} className="text-[11px] text-[#5c6b78] hover:text-[#1f2d38]" title="Actualizar">↻</button>}
              </div>
            );
          })()}
        </div>

        <div className="px-6 pb-3">
          <button onClick={fichar} disabled={guardando || (desdePC && equipo.estado !== "aprobado")}
            className="w-full py-4 rounded-xl font-bold text-base transition active:scale-[0.98] disabled:opacity-50"
            style={{ backgroundColor: enTurno ? "#e5484d" : "#e1251b", color: enTurno ? "#fff" : "#ffffff" }}>
            {guardando ? "Registrando…" : enTurno ? "FICHAR SALIDA" : "FICHAR ENTRADA"}
          </button>
        </div>

        {aCargo > 0 && (
          <div className="px-6 pb-3">
            <button onClick={() => setVista("equipo")}
              className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#e3e8ed] hover:border-[#cfd6dd]">
              👥 Revisar mi equipo ({aCargo})
            </button>
          </div>
        )}

        <div className="px-6 pb-3">
          <button onClick={() => setVista("historial")}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#e3e8ed] hover:border-[#cfd6dd]">
            📋 Mi historial
          </button>
        </div>

        {calidad && (calidad.reclamos || calidad.acciones) && (
          <div className="px-6 pb-3">
            <button onClick={() => setVista("calidad")} data-btn-calidad
              className="w-full py-3 rounded-xl font-semibold text-sm border hover:border-[#cfd6dd]" style={{ backgroundColor: "rgba(124,58,237,.07)", borderColor: "rgba(124,58,237,.3)", color: "#5b21b6" }}>
              🔬 {calidad.reclamos && calidad.acciones ? "Reclamos y acciones de mejora" : calidad.reclamos ? "Cargar un reclamo" : "Mis acciones de mejora"}
              {calidad.acciones_pendientes > 0 && <span className="ml-1 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-[#f2a900] text-white">{calidad.acciones_pendientes}</span>}
            </button>
          </div>
        )}

        <div className="px-6 pb-3">
          <button onClick={() => setVista("ausencias")}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-[#f1f4f7] border border-[#e3e8ed] hover:border-[#cfd6dd]">
            📅 Vacaciones y ausencias
          </button>
        </div>

        <div className="px-6 pb-6">
          <p className="text-[10px] uppercase tracking-widest text-[#94a1ab] mb-2">Cartilla de hoy</p>
          {historial.length === 0 ? (
            <p className="text-[#94a1ab] text-sm italic">Todavía no fichaste ningún movimiento.</p>
          ) : (
            <div className="space-y-1">
              {historial.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-[#f1f4f7] last:border-0">
                  <span className="capitalize">{r.tipo === "entrada" ? "🟢 Entrada" : "🔴 Salida"}</span>
                  <span className="text-[#5c6b78] tabular-nums">{r.hora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
