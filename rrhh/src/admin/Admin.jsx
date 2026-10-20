import { useState, useEffect } from "react";
import { loginAdmin, logoutAdmin, getAdminEmail, sesionGuardada, permisoRRHH } from "./supabase-admin.js";
import Empleados from "./Empleados.jsx";
import Plantillas from "./Plantillas.jsx";
import Sectores from "./Sectores.jsx";
import Dashboard from "./Dashboard.jsx";
import Reportes from "./Reportes.jsx";
import Indicadores from "./Indicadores.jsx";
import Dispositivos from "./Dispositivos.jsx";
import Aprobaciones from "./Aprobaciones.jsx";
import Configuracion from "./Configuracion.jsx";
import Depositos from "./Depositos.jsx";
import Fichadas from "./Fichadas.jsx";
import ImportarReloj from "./ImportarReloj.jsx";
import Presentismo from "./Presentismo.jsx";
import AusenciasAdmin from "./AusenciasAdmin.jsx";
import Auditoria from "./Auditoria.jsx";
import { LOGO } from "../lib/logo.js";
import { avisarConSifoncito, registrarVozSifoncito, avisarEquiposPendientes } from "./avisos.js";

export default function Admin() {
  const [logueado, setLogueado] = useState(false);
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [error, setError] = useState(null);
  const [entrando, setEntrando] = useState(false);
  const [vista, setVista] = useState("dashboard");
  const [revisando, setRevisando] = useState(true);

  // Si el perfil no tiene permiso de RR.HH. (⚙ → Acceso en Gestión), no entra.
  const habilitar = async () => {
    const p = await permisoRRHH();
    if (p === "oculta") {
      logoutAdmin(false);
      setError("Tu perfil no tiene acceso al panel de RR.HH. Pedíselo al administrador.");
      return false;
    }
    setLogueado(true);
    return true;
  };

  // Entrada directa con la sesión abierta en Gestión Anafer (misma base).
  useEffect(() => {
    sesionGuardada().then((ok) => (ok ? habilitar() : null)).finally(() => setRevisando(false));
  }, []);

  const entrar = async () => {
    setError(null);
    if (!email || !pass) return setError("Completá email y contraseña.");
    setEntrando(true);
    try {
      await loginAdmin(email.trim(), pass);
      await habilitar();
    } catch {
      setError("Email o contraseña incorrectos.");
    } finally {
      setEntrando(false);
    }
  };

  const salir = () => { logoutAdmin(); setLogueado(false); setPass(""); };

  // Sifoncito avisa (una vez por día) si quedaron turnos sin fichar la salida.
  useEffect(() => {
    if (!logueado) return;
    const t = setTimeout(() => { registrarVozSifoncito(); avisarConSifoncito((id) => setVista(id)); avisarEquiposPendientes((id) => setVista(id)); }, 1500);
    return () => clearTimeout(t);
  }, [logueado]);

  if (revisando && !logueado) {
    return <div className="min-h-screen w-full flex items-center justify-center text-[#94a1ab] text-sm">Cargando…</div>;
  }

  if (!logueado) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center p-4">
        <div className="w-full max-w-[380px] bg-[#ffffff] rounded-[28px] shadow-lg border border-[#e3e8ed] p-6">
          <div className="flex flex-col items-center text-center mb-6">
            <img src={LOGO} alt="ANAFER" className="h-12 mb-3" />
            <h1 className="text-lg font-bold">Panel de RR.HH.</h1>
            <p className="text-[#94a1ab] text-sm mt-1">Acceso solo para personal autorizado</p>
          </div>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Email" autoComplete="username"
            className="w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 outline-none" />
          <input value={pass} onChange={(e) => setPass(e.target.value)} type="password" placeholder="Contraseña" autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            className="w-full mt-3 bg-[#f1f4f7] border border-[#cfd6dd] rounded-xl px-4 py-3 outline-none" />
          {error && <p className="text-[#e5484d] text-xs mt-2">{error}</p>}
          <button onClick={entrar} disabled={entrando} className="w-full mt-4 py-3 rounded-xl font-bold bg-[#e1251b] text-white disabled:opacity-50">
            {entrando ? "Entrando…" : "Entrar"}
          </button>
        </div>
      </div>
    );
  }

  const grupos = [
    { id: "inicio", label: "Inicio", icono: "🏠", items: [
      { id: "dashboard", label: "Dashboard" },
      { id: "indicadores", label: "Indicadores" },
      { id: "presentismo", label: "En vivo" },
    ] },
    { id: "asistencia", label: "Asistencia", icono: "🕒", items: [
      { id: "fichadas", label: "Corrección de fichadas" },
      { id: "importar", label: "Importar reloj" },
      { id: "aprobaciones", label: "Aprobaciones" },
      { id: "ausencias", label: "Ausencias" },
    ] },
    { id: "personal", label: "Personal", icono: "👥", items: [
      { id: "empleados", label: "Empleados" },
      { id: "sectores", label: "Sectores" },
      { id: "plantillas", label: "Horarios" },
    ] },
    { id: "control", label: "Reportes y control", icono: "📊", items: [
      { id: "reportes", label: "Exportar a Excel" },
      { id: "dispositivos", label: "Dispositivos" },
      { id: "auditoria", label: "Auditoría" },
    ] },
    { id: "config", label: "Configuración", icono: "⚙️", items: [
      { id: "depositos", label: "Ubicaciones" },
      { id: "config", label: "General" },
    ] },
  ];
  const grupoActual = grupos.find((g) => g.items.some((i) => i.id === vista)) || grupos[0];
  const ultimoDe = (g) => { try { const v = localStorage.getItem(`admin_ult_${g.id}`); if (g.items.some((i) => i.id === v)) return v; } catch { /* sin storage */ } return g.items[0].id; };
  const irA = (id) => { setVista(id); try { localStorage.setItem(`admin_ult_${grupos.find((g) => g.items.some((i) => i.id === id)).id}`, id); } catch { /* sin storage */ } };

  return (
    <div className="min-h-screen w-full">
      <div className="max-w-6xl mx-auto px-4 py-5">
        {/* Header estilo Gestión Anafer */}
        <div className="bg-white rounded-2xl shadow-md border border-[#e3e8ed] overflow-hidden mb-4">
          <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg, #223c7e 0%, #223c7e 42%, #2ba9e0 42%, #2ba9e0 68%, #e1251b 68%, #e1251b 100%)" }} />
          <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <img src={LOGO} alt="ANAFER" className="h-11" />
              <div>
                <h1 className="text-xl font-extrabold leading-tight" style={{ color: "#223c7e" }}>Gestión Fichaje</h1>
                <p className="text-xs text-[#94a1ab]">Control de asistencia y presentismo · ANAFER S.A.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a href="../" title="Volver al inicio de Gestión Anafer" className="text-sm font-semibold text-[#5c6b78] hover:text-[#223c7e] py-1.5 px-3 rounded-lg border border-[#e3e8ed] bg-white">⌂ Inicio</a>
              <span className="text-xs text-[#5c6b78] bg-[#f1f4f7] border border-[#e3e8ed] rounded-full px-3 py-1.5 max-w-[240px] truncate">{getAdminEmail() || "admin"}</span>
              <button onClick={salir} className="text-sm font-semibold text-[#5c6b78] hover:text-[#223c7e] py-1.5 px-3 rounded-lg border border-[#e3e8ed] bg-white">
                Salir
              </button>
            </div>
          </div>
        </div>

        {/* Menú agrupado: temas arriba, secciones del tema abajo */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#e3e8ed] mb-5 overflow-hidden">
          <div className="flex flex-wrap gap-1 px-2 py-2">
            {grupos.map((g) => {
              const activo = g.id === grupoActual.id;
              return (
                <button key={g.id} onClick={() => irA(activo ? vista : ultimoDe(g))}
                  className="px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5"
                  style={{ backgroundColor: activo ? "#e1251b" : "transparent", color: activo ? "#ffffff" : "#5c6b78" }}>
                  <span aria-hidden>{g.icono}</span>{g.label}
                </button>
              );
            })}
          </div>
          {grupoActual.items.length > 1 && (
            <div className="flex flex-wrap gap-1 px-3 py-1.5 bg-[#f6f8fa] border-t border-[#e3e8ed]">
              {grupoActual.items.map((t) => (
                <button key={t.id} onClick={() => irA(t.id)}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-colors"
                  style={vista === t.id
                    ? { backgroundColor: "#ffffff", color: "#223c7e", boxShadow: "0 1px 2px rgba(0,0,0,.08)", border: "1px solid #e3e8ed" }
                    : { color: "#5c6b78", border: "1px solid transparent" }}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {vista === "dashboard" && <Dashboard />}
        {vista === "presentismo" && <Presentismo />}
        {vista === "empleados" && <Empleados />}
        {vista === "plantillas" && <Plantillas />}
        {vista === "sectores" && <Sectores />}
        {vista === "depositos" && <Depositos />}
        {vista === "fichadas" && <Fichadas />}
        {vista === "importar" && <ImportarReloj />}
        {vista === "reportes" && <Reportes />}
        {vista === "indicadores" && <Indicadores />}
        {vista === "dispositivos" && <Dispositivos />}
        {vista === "aprobaciones" && <Aprobaciones />}
        {vista === "ausencias" && <AusenciasAdmin />}
        {vista === "auditoria" && <Auditoria />}
        {vista === "config" && <Configuracion />}
      </div>
    </div>
  );
}
