import { useState, useEffect } from "react";
import { sbGet, sbPatch, sbPost, sbDelete, sbUpload, sbSignedUrl, sbStorageDelete,
  registrarAuditoria, getAdminEmail } from "./supabase-admin.js";

const BUCKET = "legajos";
export const TIPOS_DOC = [
  "DNI frente", "DNI dorso", "Constancia de CUIL", "Alta temprana (AFIP)",
  "Contrato", "Apto médico / preocupacional", "Certificado de domicilio",
  "Licencia de conducir", "Certificado de antecedentes", "Título / certificado", "Otro",
];

const CAMPOS = [
  { k: "apellido", label: "Apellido *" },
  { k: "nombre", label: "Nombre *" },
  { k: "dni", label: "DNI", inputMode: "numeric" },
  { k: "cuil", label: "CUIL", placeholder: "20-12345678-9" },
  { k: "fecha_nacimiento", label: "Fecha de nacimiento", type: "date" },
  { k: "fecha_ingreso", label: "Fecha de ingreso", type: "date" },
  { k: "telefono", label: "Teléfono", type: "tel" },
  { k: "email", label: "Email", type: "email" },
  { k: "direccion", label: "Dirección" },
  { k: "localidad", label: "Localidad" },
  { k: "contacto_emergencia", label: "Contacto de emergencia", placeholder: "Nombre y vínculo" },
  { k: "telefono_emergencia", label: "Tel. de emergencia", type: "tel" },
];
const EDITABLES = [...CAMPOS.map((c) => c.k), "observaciones"];

const inputCls = "w-full bg-[#f1f4f7] border border-[#cfd6dd] rounded-lg px-2.5 py-2 text-sm outline-none mt-1 focus:border-[#223c7e]";
const labelCls = "text-[10px] uppercase tracking-wider text-[#94a1ab]";
const fmtFecha = (d) => (d ? new Date(d + (d.length === 10 ? "T12:00:00" : "")).toLocaleDateString("es-AR") : "");
const fmtTam = (b) => (b == null ? "" : b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function validar(f) {
  if (!f.apellido?.trim() || !f.nombre?.trim()) return "Completá apellido y nombre.";
  if (f.dni && !/^\d{7,8}$/.test(f.dni.replace(/\./g, ""))) return "El DNI debe tener 7 u 8 números.";
  if (f.cuil && !/^\d{11}$/.test(f.cuil.replace(/[-\s]/g, ""))) return "El CUIL debe tener 11 números.";
  if (f.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email)) return "El email no es válido.";
  return null;
}
const normalizar = (k, v) => {
  if (v == null) return null;
  let s = String(v).trim();
  if (k === "dni") s = s.replace(/\./g, "");
  if (k === "cuil") { const d = s.replace(/\D/g, ""); if (d.length === 11) s = `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`; }
  if (k === "email") s = s.toLowerCase();
  return s === "" ? null : s;
};

export default function FichaEmpleado({ empleado, onCerrar, onGuardado, tabInicial = "datos" }) {
  const [tab, setTab] = useState(tabInicial);
  const [form, setForm] = useState(() => Object.fromEntries(EDITABLES.map((k) => [k, empleado[k] ?? ""])));
  const [vacApp, setVacApp] = useState(empleado.vacaciones_por_app !== false);
  const [guardando, setGuardando] = useState(false);
  const [msg, setMsg] = useState(null);

  const [docs, setDocs] = useState([]);
  const [docsError, setDocsError] = useState(null);
  const [tipo, setTipo] = useState(TIPOS_DOC[0]);
  const [venc, setVenc] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const cargarDocs = async () => {
    try {
      setDocs(await sbGet(`empleado_documentos?legajo=eq.${empleado.legajo}&order=created_at.desc`));
      setDocsError(null);
    } catch {
      setDocsError("No se pudieron cargar los documentos. ¿Corriste el SQL de la ficha (tabla empleado_documentos)?");
    }
  };
  useEffect(() => { cargarDocs(); }, [empleado.legajo]);
  useEffect(() => {
    const esc = (ev) => ev.key === "Escape" && onCerrar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onCerrar]);

  const guardar = async () => {
    const err = validar(form);
    if (err) return setMsg({ tipo: "error", texto: err });
    const cambios = {};
    EDITABLES.forEach((k) => {
      const nuevo = normalizar(k, form[k]);
      if (nuevo !== (empleado[k] ?? null)) cambios[k] = nuevo;
    });
    if (vacApp !== (empleado.vacaciones_por_app !== false)) cambios.vacaciones_por_app = vacApp;
    if (!Object.keys(cambios).length) return setMsg({ tipo: "ok", texto: "No hay cambios para guardar." });
    setGuardando(true); setMsg(null);
    try {
      const filas = await sbPatch(`empleados?legajo=eq.${empleado.legajo}`, cambios);
      if (!Array.isArray(filas) || filas.length === 0) {
        setMsg({ tipo: "error", texto: "Supabase no guardó nada (0 filas). Falta permiso de UPDATE sobre la tabla empleados: ver el SQL de la ficha, punto 4." });
        return;
      }
      registrarAuditoria(`Editó la ficha del empleado ${empleado.legajo}`, Object.keys(cambios).join(", "));
      onGuardado(filas[0]);
      setMsg({ tipo: "ok", texto: "Ficha guardada ✓" });
    } catch (e) {
      setMsg({ tipo: "error", texto: String(e.message).includes("400")
        ? "Error al guardar. ¿Corriste el SQL que agrega los campos nuevos?" : "No se pudo guardar. Probá de nuevo." });
    } finally { setGuardando(false); }
  };

  const subir = async (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    if (!files.length) return;
    setSubiendo(true); setDocsError(null);
    for (const file of files) {
      if (file.size > 10 * 1048576) { setDocsError(`"${file.name}" pesa más de 10 MB.`); continue; }
      const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
      const slug = tipo.normalize("NFD").replace(/[^\w]+/g, "-").replace(/-+$/,"").toLowerCase();
      const path = `${empleado.legajo}/${Date.now()}-${slug}.${ext}`;
      try {
        await sbUpload(BUCKET, path, file);
        try {
          await sbPost("empleado_documentos", {
            legajo: empleado.legajo, tipo, nombre_archivo: file.name, path,
            mime: file.type || null, tamano: file.size, vencimiento: venc || null,
            subido_por: getAdminEmail() || null,
          });
        } catch (e) { await sbStorageDelete(BUCKET, path).catch(() => {}); throw e; }
        registrarAuditoria(`Subió documento al empleado ${empleado.legajo}`, `${tipo}: ${file.name}`);
      } catch (e) {
        setDocsError(`No se pudo subir "${file.name}". ${e.message || ""}`);
      }
    }
    setVenc("");
    await cargarDocs();
    setSubiendo(false);
  };

  const abrir = async (d) => {
    const w = window.open("", "_blank"); // se abre ya para que el navegador no lo bloquee
    try {
      const url = await sbSignedUrl(BUCKET, d.path);
      if (w) w.location.href = url; else window.location.href = url;
    } catch { if (w) w.close(); alert("No se pudo abrir el archivo."); }
  };

  const borrar = async (d) => {
    if (!confirm(`¿Borrar "${d.tipo} – ${d.nombre_archivo}"? No se puede deshacer.`)) return;
    try {
      await sbStorageDelete(BUCKET, d.path);
      await sbDelete(`empleado_documentos?id=eq.${d.id}`);
      registrarAuditoria(`Borró documento del empleado ${empleado.legajo}`, `${d.tipo}: ${d.nombre_archivo}`);
      setDocs((l) => l.filter((x) => x.id !== d.id));
    } catch { alert("No se pudo borrar el documento."); }
  };

  const hoy = new Date().toISOString().slice(0, 10);
  const en30 = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const tiene = (t) => docs.some((d) => d.tipo === t);
  const faltan = ["DNI frente", "DNI dorso", "Alta temprana (AFIP)"].filter((t) => !tiene(t));

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start md:items-center justify-center p-3 overflow-y-auto"
      onMouseDown={(ev) => ev.target === ev.currentTarget && onCerrar()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-6">
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-[#e3e8ed]">
          <div>
            <p className="text-base font-bold">{empleado.apellido}, {empleado.nombre}</p>
            <p className="text-[11px] text-[#94a1ab]">Legajo {empleado.legajo} · el legajo no se puede cambiar porque identifica sus fichadas</p>
          </div>
          <button onClick={onCerrar} className="text-[#5c6b78] text-lg px-2" aria-label="Cerrar">✕</button>
        </div>

        <div className="flex gap-1 px-5 pt-3">
          {[["datos", "Datos personales"], ["docs", `Documentos${docs.length ? ` (${docs.length})` : ""}`]].map(([id, l]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${tab === id ? "bg-[#223c7e] text-white" : "text-[#5c6b78] hover:bg-[#f1f4f7]"}`}>{l}</button>
          ))}
        </div>

        {tab === "datos" && (
          <div className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {CAMPOS.map((c) => (
                <div key={c.k}>
                  <label className={labelCls}>{c.label}</label>
                  <input type={c.type || "text"} inputMode={c.inputMode} placeholder={c.placeholder}
                    value={form[c.k] ?? ""} onChange={(ev) => setForm({ ...form, [c.k]: ev.target.value })} className={inputCls} />
                </div>
              ))}
              <div className="sm:col-span-2 rounded-lg border border-[#e3e8ed] bg-[#f8fafc] p-3">
                <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                  <input type="checkbox" checked={vacApp} onChange={(ev) => setVacApp(ev.target.checked)} data-vac-app />
                  Pide sus vacaciones por la app
                </label>
                <p className="text-[11px] text-[#94a1ab] mt-1">Si no las pide por la app (o no ficha), se las carga RR.HH. en Asistencia → Vacaciones y en el fichaje no le aparece la opción de pedirlas.</p>
              </div>
              <div className="sm:col-span-2">
                <label className={labelCls}>Observaciones</label>
                <textarea rows={3} value={form.observaciones ?? ""} onChange={(ev) => setForm({ ...form, observaciones: ev.target.value })} className={inputCls} />
              </div>
            </div>
            {msg && <p className={`mt-3 text-sm ${msg.tipo === "ok" ? "text-[#16a34a]" : "text-[#e5484d]"}`}>{msg.texto}</p>}
            <div className="flex gap-2 mt-4">
              <button onClick={guardar} disabled={guardando} className="flex-1 py-2.5 rounded-lg font-bold text-sm bg-[#16a34a] text-white disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar ficha"}
              </button>
              <button onClick={onCerrar} className="px-4 py-2.5 rounded-lg text-sm text-[#5c6b78] border border-[#cfd6dd]">Cerrar</button>
            </div>
          </div>
        )}

        {tab === "docs" && (
          <div className="p-5">
            {faltan.length > 0 && !docsError && (
              <p className="text-xs bg-[#fff7e6] text-[#9a6700] border border-[#f5d48a] rounded-lg px-3 py-2 mb-3">
                Falta cargar: {faltan.join(", ")}
              </p>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end bg-[#f8fafb] border border-[#e3e8ed] rounded-xl p-3">
              <div>
                <label className={labelCls}>Tipo de documento</label>
                <select value={tipo} onChange={(ev) => setTipo(ev.target.value)} className={inputCls}>
                  {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Vencimiento (opcional)</label>
                <input type="date" value={venc} onChange={(ev) => setVenc(ev.target.value)} className={inputCls} />
              </div>
              <label className={`block text-center py-2.5 rounded-lg font-bold text-sm cursor-pointer ${subiendo ? "bg-[#94a1ab]" : "bg-[#223c7e]"} text-white`}>
                {subiendo ? "Subiendo…" : "📎 Subir archivo / foto"}
                <input type="file" multiple accept="image/*,application/pdf"
                  disabled={subiendo} onChange={subir} className="hidden" />
              </label>
            </div>
            <p className="text-[11px] text-[#94a1ab] mt-1.5">JPG, PNG, HEIC o PDF, hasta 10 MB. Desde el celular podés sacarle la foto al DNI directamente.</p>
            {docsError && <p className="mt-3 text-sm text-[#e5484d]">{docsError}</p>}

            <div className="mt-4 divide-y divide-[#e3e8ed] border border-[#e3e8ed] rounded-xl">
              {docs.length === 0 && !docsError && <p className="text-sm text-[#94a1ab] italic p-4">Todavía no hay documentos cargados.</p>}
              {docs.map((d) => {
                const vencido = d.vencimiento && d.vencimiento < hoy;
                const porVencer = d.vencimiento && !vencido && d.vencimiento <= en30;
                return (
                  <div key={d.id} className="flex items-center gap-3 px-4 py-2.5 flex-wrap">
                    <span className="text-xl">{d.mime === "application/pdf" ? "📄" : "🖼️"}</span>
                    <div className="flex-1 min-w-[160px]">
                      <p className="text-sm font-semibold">{d.tipo}</p>
                      <p className="text-[11px] text-[#94a1ab] break-all">
                        {d.nombre_archivo} · {fmtTam(d.tamano)} · {fmtFecha(d.created_at.slice(0, 10))}
                        {d.vencimiento && (
                          <span className={`ml-1 font-semibold ${vencido ? "text-[#e5484d]" : porVencer ? "text-[#9a6700]" : ""}`}>
                            · vence {fmtFecha(d.vencimiento)}{vencido ? " (VENCIDO)" : ""}
                          </span>
                        )}
                      </p>
                    </div>
                    <button onClick={() => abrir(d)} className="px-2.5 py-1 rounded-lg text-xs font-bold border border-[#cfd6dd] text-[#223c7e]">Ver</button>
                    <button onClick={() => borrar(d)} className="px-2.5 py-1 rounded-lg text-xs text-[#e5484d]">Borrar</button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
