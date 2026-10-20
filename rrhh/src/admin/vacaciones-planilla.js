// Lectura de la planilla anual de vacaciones (legajo, nombre, días) y control del nombre.
const norm = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zñ ]/g, " ").split(/\s+/).filter((x) => x.length > 1);
// El nombre de la planilla "coincide" si tiene el apellido del sistema (o al revés)
export function coincideNombre(planilla, emp) {
  const a = norm(planilla), b = norm(`${emp.apellido} ${emp.nombre}`), ap = norm(emp.apellido);
  if (!a.length) return true;
  return ap.some((x) => a.includes(x)) || a.filter((x) => b.includes(x)).length >= 2;
}

export function leerPlanillaVacaciones(rows) {
  const txt = (c) => String(c ?? "").trim();
  let h = rows.slice(0, 10).findIndex((r) => r.some((c) => /legajo/i.test(txt(c))));
  let cL = 0, cN = 1, cD = 2;
  if (h >= 0) {
    const r = rows[h].map(txt);
    cL = r.findIndex((c) => /legajo/i.test(c));
    cN = r.findIndex((c, i) => i !== cL && /nombre|apellido|empleado/i.test(c));
    cD = r.findIndex((c, i) => i !== cL && /^d.{1,2}as$|d[ií]as|vacacion|corresponde|cantidad/i.test(c));
    if (cD < 0) throw new Error('No encontré la columna de los días (un encabezado como "Días").');
  } else h = -1;
  const out = [];
  rows.slice(h + 1).forEach((r, i) => {
    const leg = parseInt(txt(r[cL]).replace(/\D/g, ""), 10);
    if (!leg && !txt(r[cD])) return; // fila vacía
    const d = Number(txt(r[cD]).replace(",", "."));
    out.push({ fila: h + 2 + i, legajo: leg || null, nombre: cN >= 0 ? txt(r[cN]) : "", dias: isFinite(d) && txt(r[cD]) !== "" ? d : null });
  });
  return out;
}

