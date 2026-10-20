// Vencimientos de documentos del legajo (sin React, para poder probarlo solo).
//
// * Por cada empleado activo y cada tipo de documento se toma el que vence
//   más tarde (si renovó la licencia, cuenta la nueva).
// * Vencido: la fecha ya pasó. Por vencer: faltan menos días que el aviso del
//   requisito (o 30 si el documento no es obligatorio en su sector).
// * Faltante: el sector lo pide (documentos_requeridos) y el empleado no tiene
//   ningún archivo de ese tipo.

export const sinAcentos = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const diasEntre = (a, b) => Math.round((new Date(b + "T12:00:00") - new Date(a + "T12:00:00")) / 86400000);

// Requisitos que aplican a un sector ('' = todos los sectores)
export function requisitosDe(sector, requeridos) {
  const s = sinAcentos(sector);
  const m = new Map();
  for (const r of requeridos || []) {
    if (r.sector && sinAcentos(r.sector) !== s) continue;
    const prev = m.get(r.tipo);
    // si está para todos y además para el sector, gana el aviso más largo
    if (!prev || Number(r.dias_aviso) > Number(prev.dias_aviso)) m.set(r.tipo, r);
  }
  return [...m.values()];
}

export function analizarVencimientos({ empleados, docs, requeridos, hoy }) {
  const vencidos = [], porVencer = [], faltantes = [];
  const porLegajo = new Map();
  for (const d of docs || []) {
    if (!porLegajo.has(d.legajo)) porLegajo.set(d.legajo, []);
    porLegajo.get(d.legajo).push(d);
  }
  for (const e of empleados || []) {
    if (e.activo === false) continue;
    const suyos = porLegajo.get(e.legajo) || [];
    const reqs = requisitosDe(e.sector, requeridos);
    const avisoDe = (tipo) => { const r = reqs.find((x) => x.tipo === tipo); return r ? Number(r.dias_aviso) || 30 : 30; };
    // último vencimiento por tipo
    const ultimo = new Map();
    for (const d of suyos) {
      if (!d.vencimiento) continue;
      const p = ultimo.get(d.tipo);
      if (!p || d.vencimiento > p.vencimiento) ultimo.set(d.tipo, d);
    }
    for (const d of ultimo.values()) {
      const dias = diasEntre(hoy, d.vencimiento);
      const fila = { empleado: e, doc: d, tipo: d.tipo, vencimiento: d.vencimiento, dias, obligatorio: reqs.some((r) => r.tipo === d.tipo) };
      if (dias < 0) vencidos.push(fila);
      else if (dias <= avisoDe(d.tipo)) porVencer.push(fila);
    }
    for (const r of reqs) {
      if (!suyos.some((d) => d.tipo === r.tipo)) faltantes.push({ empleado: e, tipo: r.tipo });
    }
  }
  vencidos.sort((a, b) => a.dias - b.dias);
  porVencer.sort((a, b) => a.dias - b.dias);
  faltantes.sort((a, b) => (a.empleado.sector || "").localeCompare(b.empleado.sector || "") || (a.empleado.apellido || "").localeCompare(b.empleado.apellido || ""));
  return { vencidos, porVencer, faltantes };
}

// Licencias (enfermedad / especial) aprobadas o pendientes que siguen sin certificado
export const TIPOS_CON_CERTIFICADO = ["enfermedad", "licencia"];
export function licenciasSinCertificado(solicitudes) {
  return (solicitudes || []).filter((s) => TIPOS_CON_CERTIFICADO.includes(s.tipo) && !s.certificado_path && s.estado !== "rechazada");
}
