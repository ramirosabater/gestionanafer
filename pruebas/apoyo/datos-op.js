// Orden de pago ya pagada (con cheque de cartera, transferencia y retención), para las pruebas.
import { datosCompras } from "./datos-compras.js";

function enDias(n) { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

// Orden de pago ya pagada: 300.000 con un cheque de cartera + 200.000 por transferencia.
export function datosConOPPagada() {
  const hoy = enDias(0);
  const facturas = datosCompras().facturas.map((f) => (f.id === "mo1" ? { ...f, estado: "pagada" } : f));
  return datosCompras({
    facturas,
    cuentas: [
      { id: "bco", nombre: "Banco Santander", tipo: "banco", saldo_inicial: 2000000 },
      { id: "cartera_cheques", nombre: "Cartera de cheques", tipo: "cartera", saldo_inicial: 0 },
    ],
    medios_caja: [
      { id: "tr1", codigo: "TR1", nombre: "Transferencia", cuenta_id: "bco", cheque: "no", activo: true },
      { id: "che", codigo: "CHE", nombre: "Cheque de terceros", cuenta_id: "cartera_cheques", cheque: "cartera", activo: true },
    ],
    ordenes_pago: [{ id: "op7", numero: 7, proveedor_id: "mono", factura_ids: ["mo1"], fecha: hoy, monto: 500000, estado: "pagada",
      medio_pago: "", medio_id: "che", cheque_ids: [], cuenta_id: "cartera_cheques", notas: "", who: "",
      retenciones: [{ regimen: 94, base: 400000, acum_prev: 0, ret_prev: 0, importe: 1000, condicion: "inscripto", certificado: 5 }], retenido: 0,
      formas: [{ medio_id: "che", cuenta_id: "cartera_cheques", importe: 300000, cheque_ids: ["c1"] }, { medio_id: "tr1", cuenta_id: "bco", importe: 200000, cheque_ids: [] }],
      anulado_en: null, anulado_por: "", motivo_anulacion: "" }],
    movimientos: [
      { id: "mov_c1", cuenta_id: "cartera_cheques", fecha: hoy, concepto: "Cobro cliente X", monto: 300000, tipo: "ingreso", medio_id: "che", cheque_ids: ["c1"], pago_id: null, notas: "" },
      { id: "mov_op_op7", cuenta_id: "cartera_cheques", fecha: hoy, concepto: "Pago OP-0007", monto: 300000, tipo: "egreso", medio_id: "che", cheque_ids: ["c1"], pago_id: "op7", notas: "" },
      { id: "mov_op_op7_2", cuenta_id: "bco", fecha: hoy, concepto: "Pago OP-0007 (2/2)", monto: 200000, tipo: "egreso", medio_id: "tr1", cheque_ids: [], pago_id: "op7", notas: "" },
      { id: "mov_caja", cuenta_id: "bco", fecha: hoy, concepto: "Gasto mal cargado", monto: 15000, tipo: "egreso", medio_id: "tr1", cheque_ids: [], pago_id: null, notas: "" },
    ],
    cheques: [{ id: "c1", banco: "Banco Nación", numero: "111", titular: "Cliente X", importe: 300000, estado: "entregado", fecha_cobro: enDias(10),
      cuenta_id: "cartera_cheques", mov_ingreso_id: "mov_c1", pago_id: "op7", proveedor_id: "mono", destino: "Entregado a Mono Juan (OP-0007)" }],
  });
}
