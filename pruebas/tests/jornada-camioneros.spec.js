// Horario "Camioneros": horas extras al 50% / 100% según el horario y descanso
// de 12 h entre jornadas (documento "Jornada Laboral y Horas Extras - Camioneros").
// Son pruebas de la lógica (sin navegador): rrhh/src/lib/jornada.js y cumplimiento.js.
import { test, expect } from "@playwright/test";
import { liquidarJornada, EXTRAS_CAMIONEROS, BLOQUES_CAMIONEROS, jornadasDe } from "../../rrhh/src/lib/jornada.js";
import { calcularEstado } from "../../rrhh/src/lib/fichaje.js";
import { computarCumplimiento } from "../../rrhh/src/lib/cumplimiento.js";

const H = { id: "camioneros", nombre: "Camioneros", tipo: "fijo", tolerancia_minutos: 10, bloques: BLOQUES_CAMIONEROS, extras: EXTRAS_CAMIONEROS };
// 19/10/2026 es lunes; 24 sábado; 25 domingo
const t = (dia, h, m = 0) => new Date(2026, 9, dia, h, m);
const horas = (r) => ({ normal: r.normal / 60, al50: r.min50 / 60, al100: r.min100 / 60 });

test("lunes a viernes: 08 a 16 normal, 16 a 21 al 50%", () => {
  expect(horas(liquidarJornada(t(19, 8), t(19, 16), H, {}))).toEqual({ normal: 8, al50: 0, al100: 0 });
  expect(horas(liquidarJornada(t(19, 8), t(19, 19, 30), H, {}))).toEqual({ normal: 8, al50: 3.5, al100: 0 });
  expect(horas(liquidarJornada(t(19, 8), t(19, 21), H, {}))).toEqual({ normal: 8, al50: 5, al100: 0 });
});

test("si pasa de las 21, TODAS las extras desde las 16 van al 100%", () => {
  const r = liquidarJornada(t(19, 8), t(19, 22), H, {});
  expect(horas(r)).toEqual({ normal: 8, al50: 0, al100: 6 });
  expect(r.nota).toContain("100%");
  // vuelve 00:05 del día siguiente
  const r2 = liquidarJornada(t(19, 8), t(20, 0, 5), H, {});
  expect(r2.normal).toBe(8 * 60);
  expect(r2.min100).toBe(8 * 60 + 5);
  expect(r2.min50).toBe(0);
});

test("sábado: 08 a 12 normal, 12 a 13 al 50%, después de las 13 al 100%", () => {
  expect(horas(liquidarJornada(t(24, 8), t(24, 12), H, {}))).toEqual({ normal: 4, al50: 0, al100: 0 });
  expect(horas(liquidarJornada(t(24, 8), t(24, 12, 30), H, {}))).toEqual({ normal: 4, al50: 0.5, al100: 0 });
  expect(horas(liquidarJornada(t(24, 8), t(24, 15), H, {}))).toEqual({ normal: 4, al50: 1, al100: 2 });
});

test("domingo y feriado: todo al 100%", () => {
  expect(horas(liquidarJornada(t(25, 9), t(25, 12), H, {}))).toEqual({ normal: 0, al50: 0, al100: 3 });
  expect(horas(liquidarJornada(t(19, 8), t(19, 16), H, { "2026-10-19": 100 }))).toEqual({ normal: 0, al50: 0, al100: 8 });
});

test("descanso de 12 h: terminó 00:05, entrar a las 12:00 NO es llegada tarde", () => {
  const ctx = { ultimaSalida: t(20, 0, 5) };
  expect(calcularEstado("entrada", t(20, 12, 0), H, ctx).estado).toBe("a_horario");
  expect(calcularEstado("entrada", t(20, 12, 14), H, ctx).estado).toBe("a_horario");   // 12:05 + 10 de tolerancia
  const tarde = calcularEstado("entrada", t(20, 12, 30), H, ctx);
  expect(tarde.estado).toBe("tarde");
  expect(tarde.minutosTarde).toBe(25);
  // sin esa salida tardía, a las 12 sí es tarde
  expect(calcularEstado("entrada", t(20, 12, 0), H, { ultimaSalida: t(19, 16) }).estado).toBe("tarde");
  // la salida de las 00:05 es de la jornada del lunes: no es "salida anticipada"
  expect(calcularEstado("salida", t(20, 0, 5), H, { entradaAbierta: t(19, 8) }).estado).toBe("a_horario");
});

test("un horario común sigue igual (sin regla propia)", () => {
  const comun = { tipo: "fijo", tolerancia_minutos: 10, bloques: [{ dias: [1, 2, 3, 4, 5], inicio: "08:00", fin: "16:00" }] };
  expect(calcularEstado("entrada", t(19, 8, 20), comun).minutosTarde).toBe(20);
  expect(calcularEstado("entrada", t(20, 12, 0), comun, { ultimaSalida: t(20, 0, 5) }).estado).toBe("tarde");
});

test("resumen del mes: suma normales, 50% y 100%, y no marca tarde ni 'sin salida' por la vuelta pasada la medianoche", () => {
  const f = (dia, h, m, tipo, extra = {}) => ({ timestamp: t(dia, h, m).toISOString(), tipo, ...extra });
  const fichajes = [
    f(19, 8, 0, "entrada", { estado: "a_horario" }), f(20, 0, 5, "salida", { estado: "salida_anticipada", minutos_tarde: 955 }),   // lunes hasta 00:05
    f(20, 12, 0, "entrada", { estado: "tarde", minutos_tarde: 240 }), f(20, 18, 0, "salida"),                                        // martes 12 a 18
    f(24, 8, 0, "entrada"), f(24, 14, 0, "salida"),                                                                                    // sábado 08 a 14
  ];
  const c = computarCumplimiento(fichajes, H, t(19, 0), t(24, 23, 59), { recargos: [], feriados: {} });
  expect(c.minTarde).toBe(0);
  expect(c.minRetiro).toBe(0);
  expect(c.sinSalida).toBe(0);
  expect(c.sinEntrada).toBe(0);
  // lunes: 8 normal + 8:05 al 100 · martes: 4 normal + 2 al 50 · sábado: 4 normal + 1 al 50 + 1 al 100
  expect(c.normalMin).toBe((8 + 4 + 4) * 60);
  expect(c.horas50Min).toBe((2 + 1) * 60);
  expect(c.horas100Min).toBe(8 * 60 + 5 + 60);
  const js = c.jornadas;
  expect(js).toHaveLength(3);
  expect(js[1].observaciones.join(" ")).toContain("Reingreso desde las 12:05");
});

test("jornada sin salida queda marcada", () => {
  const js = jornadasDe([{ timestamp: t(19, 8).toISOString(), tipo: "entrada" }, { timestamp: t(21, 8).toISOString(), tipo: "entrada" }, { timestamp: t(21, 16).toISOString(), tipo: "salida" }], H, {});
  expect(js[0].observaciones[0]).toContain("Sin salida");
  expect(js[1].normal).toBe(480);
});

// Horarios de Administración con extras propias solo algunos días
test("extras propias solo el sábado (Caja/Administración): sábado 12–13 al 50% y después 100%; entre semana rige la regla general", () => {
  const Hs = { tipo: "fijo", tolerancia_minutos: 10, bloques: [{ dias: [1, 2, 3, 4, 5], inicio: "08:00", fin: "17:00" }, { dias: [6], inicio: "08:00", fin: "12:00" }],
    extras: { tramos: [{ dias: [6], hasta_50: "13:00", todo_100_si_pasa: false }], descanso_horas: 0 } };
  const f = (dia, h, m, tipo) => ({ timestamp: t(dia, h, m).toISOString(), tipo });
  const c = computarCumplimiento([f(24, 8, 0, "entrada"), f(24, 15, 0, "salida"), f(19, 8, 0, "entrada"), f(19, 18, 0, "salida")], Hs, t(19, 0), t(24, 23, 59), { recargos: [], feriados: {} });
  // sábado: 4 normales + 1 al 50 + 2 al 100 (de 13 a 15) · lunes 8–18: la regla general por defecto no tiene recargo entre semana
  expect(c.horas50Min).toBe(60);
  expect(c.horas100Min).toBe(120);
  expect(c.normalMin).toBe(4 * 60 + 10 * 60);
});

test("Décima: 8 a 16 y de 16 a 17 extra al 50%", () => {
  const Hd = { tipo: "fijo", tolerancia_minutos: 10, bloques: [{ dias: [1, 2, 3, 4, 5], inicio: "08:00", fin: "16:00" }], extras: { tramos: [{ dias: [1, 2, 3, 4, 5], hasta_50: "17:00", todo_100_si_pasa: false }], descanso_horas: 0 } };
  expect(horas(liquidarJornada(t(19, 8), t(19, 17), Hd, {}))).toEqual({ normal: 8, al50: 1, al100: 0 });
  expect(calcularEstado("salida", t(19, 17), Hd).estado).toBe("a_horario");
});

test("turno rotativo por semana (Maldonado): una semana 9 a 17 y la otra 10 a 18", async () => {
  const { bloquesDeHoy, semanaDeRotacion } = await import("../../rrhh/src/lib/fichaje.js");
  const sem1 = [{ dias: [1, 2, 3, 4, 5], inicio: "09:00", fin: "17:00" }, { dias: [6], inicio: "08:00", fin: "12:00" }];
  const sem2 = [{ dias: [1, 2, 3, 4, 5], inicio: "10:00", fin: "18:00" }, { dias: [6], inicio: "08:00", fin: "12:00" }];
  const Hm = { tipo: "fijo", tolerancia_minutos: 10, bloques: sem1, extras: { tramos: [{ dias: [6], hasta_50: "13:00" }], descanso_horas: 0, rotacion: { desde: "2026-10-21", semanas: [sem1, sem2] } } };
  expect(semanaDeRotacion(Hm, t(19, 9))).toBe(0);          // semana del 19/10 (el "desde" puede ser cualquier día de esa semana)
  expect(semanaDeRotacion(Hm, new Date(2026, 9, 26))).toBe(1);
  expect(semanaDeRotacion(Hm, new Date(2026, 10, 2))).toBe(0);
  expect(semanaDeRotacion(Hm, new Date(2026, 9, 12))).toBe(1); // la semana anterior también alterna
  expect(bloquesDeHoy(Hm, new Date(2026, 9, 27, 10))[0].inicio).toBe("10:00");
  // llegar 10:00 es tarde la semana 1 y a horario la semana 2
  expect(calcularEstado("entrada", t(20, 10, 0), Hm).estado).toBe("tarde");
  expect(calcularEstado("entrada", new Date(2026, 9, 27, 10, 0), Hm).estado).toBe("a_horario");
  // salir a las 17 la semana 2 es salida anticipada
  expect(calcularEstado("salida", new Date(2026, 9, 27, 17, 0), Hm).estado).toBe("salida_anticipada");
});
