// Datos de prueba de Compras / Pagos / Retenciones (inventados).
export const REGIMENES = [
  { codigo: 78, descripcion: "Enajenación de bienes muebles", alic_insc: 2, escala: null, alic_no_insc: 10, alic_no_insc_ph: null, mnsr: 224000, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, activo: true, orden: 1 },
  { codigo: 94, descripcion: "Locaciones de obra y/o servicios", alic_insc: 2, escala: null, alic_no_insc: 25, alic_no_insc_ph: 28, mnsr: 67170, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, activo: true, orden: 2 },
  { codigo: 95, descripcion: "Transporte de carga", alic_insc: 0.25, escala: null, alic_no_insc: 25, alic_no_insc_ph: 28, mnsr: 67170, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, activo: true, orden: 3 },
  { codigo: 119, descripcion: "Profesiones liberales", alic_insc: null, escala: "119", alic_no_insc: 28, alic_no_insc_ph: null, mnsr: 160000, mnsr_no_insc: false, min_insc: 240, min_no_insc: 240, activo: true, orden: 4 },
];
export const ESCALAS = [
  { escala: "119", desde: 0, hasta: 71000, fijo: 0, pct: 5 }, { escala: "119", desde: 71000, hasta: 142000, fijo: 3550, pct: 9 },
  { escala: "119", desde: 142000, hasta: 213000, fijo: 9940, pct: 12 }, { escala: "119", desde: 852000, hasta: null, fijo: 165430, pct: 31 },
];
export const PROVEEDORES = [
  { id: "serv", nombre: "Servicios SA", cuit: "30-11111111-1", condicion_iva: "Responsable inscripto", rubro: "Locación de servicios" },
  { id: "medico", nombre: "Dr. Pérez", cuit: "20-22222222-2", condicion_iva: "Responsable inscripto", rubro: "Honorarios" },
  { id: "mono", nombre: "Mono Juan", cuit: "20-33333333-3", condicion_iva: "Responsable monotributo", rubro: "Locación de servicios" },
  { id: "noins", nombre: "Sin Inscripción", cuit: "20-44444444-4", condicion_iva: "Responsable inscripto", rubro: "Locación de servicios", gan_condicion: "no_inscripto" },
  { id: "bien", nombre: "Ferretería SA", cuit: "30-55555555-5", condicion_iva: "Responsable inscripto", rubro: "Bienes" },
  { id: "trans", nombre: "Transporte SRL", cuit: "30-66666666-6", condicion_iva: "Responsable inscripto", rubro: "Transporte de carga", prioritario: true },
];
export const FACTURAS = [
  { id: "s1", proveedor_id: "serv", numero: "S-1", fecha: "2026-10-01", monto: 121000, estado: "pendiente" },
  { id: "s2", proveedor_id: "serv", numero: "S-2", fecha: "2026-10-02", monto: 60500, neto: 50000, estado: "pendiente" },
  { id: "m1", proveedor_id: "medico", numero: "M-1", fecha: "2026-10-02", monto: 363000, neto: 300000, estado: "pendiente" },
  { id: "mo1", proveedor_id: "mono", numero: "MO-1", fecha: "2026-10-02", monto: 500000, estado: "pendiente" },
  { id: "n1", proveedor_id: "noins", numero: "N-1", fecha: "2026-10-02", monto: 10000, neto: 10000, estado: "pendiente" },
  { id: "b1", proveedor_id: "bien", numero: "B-1", fecha: "2026-10-02", monto: 242000, estado: "pendiente" },
  { id: "t1", proveedor_id: "trans", numero: "T-1", fecha: "2026-10-03", monto: 1210000, estado: "pendiente" },
];
export const CENTROS = [
  { id: "cc_logistica", codigo: "", descripcion: "Logística", parent_id: null, activo: true, requiere: "", orden: 1 },
  { id: "cc_logistica_deposito", codigo: "", descripcion: "Depósito", parent_id: "cc_logistica", activo: true, requiere: "", orden: 1 },
  { id: "cc_logistica_moviles", codigo: "", descripcion: "Móviles", parent_id: "cc_logistica", activo: true, requiere: "movil", orden: 2 },
  { id: "imp_general", codigo: "", descripcion: "General", parent_id: null, activo: false, requiere: "", orden: 0 },
];
export const CUENTAS = [
  { id: "bco", nombre: "Banco Santander", tipo: "banco", saldo_inicial: 2000000 },
  { id: "caja", nombre: "Caja", tipo: "caja", saldo_inicial: 50000 },
];
export const MEDIOS = [{ id: "tr1", codigo: "TR1", nombre: "Transferencia", cuenta_id: "bco", cheque: "no", activo: true }];

export function datosCompras(extra = {}) {
  return {
    gan_regimenes: REGIMENES, gan_escalas: ESCALAS, proveedores: PROVEEDORES, facturas: FACTURAS,
    centros_costo: CENTROS, cuentas: CUENTAS, medios_caja: MEDIOS,
    parametros: [{ id: "agente_retencion", valor: { razon_social: "ANAFER S.A.", cuit: "30-00000000-0", domicilio: "Calle 1", localidad: "Comodoro Rivadavia", provincia: "Chubut" } }],
    ...extra,
  };
}
