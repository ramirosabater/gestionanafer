// Kit de gráficos livianos (SVG + HTML, sin librerías) para Dashboard e Indicadores.
// Paleta de marca ANAFER validada (orden fijo, nunca se cicla). Estados con color + texto.
import { useState } from "react";

export const C = {
  azul: "#3a5fc8", rojo: "#e1251b", celeste: "#21a0d8", ambar: "#eda100", verde: "#17a673",
  navy: "#223c7e", gris: "#94a1ab", grisClaro: "#e3e8ed", tinta: "#1f2d38", tinta2: "#5c6b78",
};
export const SERIES = [C.azul, C.rojo, C.celeste, C.ambar, C.verde];
export const ESTADO = { a_horario: C.verde, tarde: C.rojo, salida_anticipada: C.ambar, sin_turno: C.gris };

const fmtDef = (v) => Math.round(v).toLocaleString("es-AR");

// ---------- Contenedores ----------
export function Banda({ titulo, subtitulo, children }) {
  return (
    <div className="rounded-2xl px-5 py-4 flex flex-wrap items-center gap-4 text-white shadow-md"
      style={{ background: `linear-gradient(100deg, ${C.navy} 0%, #2c4ea3 60%, ${C.celeste} 140%)` }}>
      <div className="mr-auto">
        <h2 className="text-xl md:text-2xl font-black tracking-tight">{titulo}</h2>
        {subtitulo && <p className="text-xs text-white/75 mt-0.5">{subtitulo}</p>}
      </div>
      {children}
    </div>
  );
}

export function Panel({ titulo, sub, acento = C.azul, children, className = "", derecha }) {
  return (
    <div className={`bg-white rounded-2xl border border-[#e3e8ed] shadow-sm p-4 flex flex-col ${className}`}>
      {titulo && (
        <div className="flex items-start gap-2 mb-3">
          <span className="w-1 self-stretch rounded-full" style={{ backgroundColor: acento }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-[#1f2d38] leading-tight">{titulo}</p>
            {sub && <p className="text-[11px] text-[#94a1ab] mt-0.5">{sub}</p>}
          </div>
          {derecha}
        </div>
      )}
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}

// Tarjeta de número grande con banda de color e ícono
export function Kpi({ label, valor, sub, color = C.azul, icono, onClick, activo }) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag onClick={onClick}
      className="text-left bg-white rounded-2xl border shadow-sm overflow-hidden flex transition-transform hover:-translate-y-0.5"
      style={{ borderColor: activo ? color : "#e3e8ed", boxShadow: activo ? `0 0 0 2px ${color}33` : undefined }}>
      <span className="w-1.5 shrink-0" style={{ backgroundColor: color }} />
      <div className="p-3.5 flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {icono && <span className="w-7 h-7 rounded-lg grid place-items-center text-sm shrink-0" style={{ backgroundColor: `${color}1a` }}>{icono}</span>}
          <p className="text-[10px] uppercase tracking-wider text-[#94a1ab] font-semibold leading-tight">{label}</p>
        </div>
        <p className="text-2xl font-black text-[#1f2d38] tabular-nums mt-1.5 leading-none">{valor}</p>
        {sub && <p className="text-[11px] text-[#5c6b78] mt-1">{sub}</p>}
      </div>
    </Tag>
  );
}

// Selector de opciones tipo "píldoras" (filtros)
export function Pildoras({ opciones, valor, onChange, oscuro }) {
  return (
    <div className={`inline-flex rounded-xl p-0.5 ${oscuro ? "bg-white/15" : "bg-[#f1f4f7]"}`}>
      {opciones.map((o) => (
        <button key={o.id} onClick={() => onChange(o.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
          style={valor === o.id ? { backgroundColor: "#fff", color: C.navy } : { color: oscuro ? "#ffffffcc" : C.tinta2 }}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Leyenda({ items }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5 text-[11px] text-[#5c6b78]">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: i.color }} />{i.label}
        </span>
      ))}
    </div>
  );
}

export function Vacio({ texto = "Sin datos para este período." }) {
  return <p className="text-xs text-[#94a1ab] italic text-center py-8">{texto}</p>;
}

// ---------- Dona ----------
export function Dona({ datos, centro, centroSub, size = 150, grosor = 22, fmt = fmtDef, leyenda = true }) {
  const [hov, setHov] = useState(null);
  const total = datos.reduce((s, d) => s + d.valor, 0);
  const r = (size - grosor) / 2, cx = size / 2, cy = size / 2, circ = 2 * Math.PI * r;
  let acc = 0;
  const gap = datos.filter((d) => d.valor > 0).length > 1 ? 2 : 0;
  return (
    <div className="flex items-center gap-4 flex-wrap justify-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} onMouseLeave={() => setHov(null)}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f4f7" strokeWidth={grosor} />
          {total > 0 && datos.map((d, i) => {
            const len = (d.valor / total) * circ;
            const el = d.valor > 0 && (
              <circle key={d.label} cx={cx} cy={cy} r={r} fill="none" stroke={d.color}
                strokeWidth={hov === i ? grosor + 4 : grosor}
                strokeDasharray={`${Math.max(0, len - gap)} ${circ}`} strokeDashoffset={-acc}
                transform={`rotate(-90 ${cx} ${cy})`} onMouseEnter={() => setHov(i)} style={{ transition: "stroke-width .15s" }} />
            );
            acc += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 grid place-items-center text-center pointer-events-none">
          <div>
            <p className="text-xl font-black text-[#1f2d38] leading-none tabular-nums">
              {hov != null ? fmt(datos[hov].valor) : centro}
            </p>
            <p className="text-[10px] text-[#94a1ab] mt-1 max-w-[90px] leading-tight">
              {hov != null ? datos[hov].label : centroSub}
            </p>
          </div>
        </div>
      </div>
      {leyenda && (
        <div className="space-y-1.5 min-w-[120px]">
          {datos.map((d, i) => (
            <div key={d.label} className="flex items-center gap-2 text-xs" onMouseEnter={() => setHov(i)} onMouseLeave={() => setHov(null)}>
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: d.color }} />
              <span className="text-[#5c6b78] flex-1">{d.label}</span>
              <span className="font-bold text-[#1f2d38] tabular-nums">{fmt(d.valor)}</span>
              <span className="text-[10px] text-[#94a1ab] w-9 text-right tabular-nums">{total ? Math.round((d.valor / total) * 100) : 0}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Anillo de progreso (un solo %)
export function Anillo({ pct, color = C.verde, size = 96, grosor = 11, label }) {
  const r = (size - grosor) / 2, circ = 2 * Math.PI * r, p = Math.max(0, Math.min(100, pct || 0));
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f4f7" strokeWidth={grosor} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={grosor} strokeLinecap="round"
          strokeDasharray={`${(p / 100) * circ} ${circ}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-lg font-black text-[#1f2d38] leading-none">{pct == null ? "—" : `${Math.round(p)}%`}</p>
          {label && <p className="text-[9px] text-[#94a1ab] mt-0.5">{label}</p>}
        </div>
      </div>
    </div>
  );
}

// ---------- Barras verticales (agrupadas) ----------
export function BarrasV({ categorias, series, fmt = fmtDef, alto = 220, etiquetas = true, maxFijo, ancho = 640 }) {
  const [hov, setHov] = useState(null);
  const W = ancho, H = alto, pL = 8, pR = 8, pT = 22, pB = 34;
  const iw = W - pL - pR, ih = H - pT - pB;
  const max = maxFijo || Math.max(1, ...series.flatMap((s) => s.valores));
  const slot = iw / Math.max(1, categorias.length);
  const grupo = Math.min(slot * 0.78, 30 * series.length + 6 * (series.length - 1));
  const bw = Math.max(4, (grupo - 2 * (series.length - 1)) / series.length);
  const y = (v) => pT + ih - (v / max) * ih;
  const labelsEnEje = categorias.length > 14;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" onMouseLeave={() => setHov(null)}>
        {[0.5, 1].map((t) => <line key={t} x1={pL} x2={W - pR} y1={y(max * t)} y2={y(max * t)} stroke="#eef1f4" />)}
        <line x1={pL} x2={W - pR} y1={pT + ih} y2={pT + ih} stroke="#cfd6dd" />
        {categorias.map((c, ci) => {
          const x0 = pL + slot * ci + (slot - grupo) / 2;
          return (
            <g key={c} onMouseEnter={() => setHov(ci)}>
              <rect x={pL + slot * ci} y={pT} width={slot} height={ih} fill={hov === ci ? "#f6f8fa" : "transparent"} />
              {series.map((s, si) => {
                const v = s.valores[ci] || 0, h = Math.max(0, pT + ih - y(v)), x = x0 + si * (bw + 2), rr = Math.min(4, h, bw / 2);
                return (
                  <g key={s.nombre}>
                    {h > 0 && <path fill={s.color} d={`M${x},${pT + ih} V${y(v) + rr} Q${x},${y(v)} ${x + rr},${y(v)} H${x + bw - rr} Q${x + bw},${y(v)} ${x + bw},${y(v) + rr} V${pT + ih} Z`} />}
                    {etiquetas && v > 0 && bw >= 14 && (
                      <text x={x + bw / 2} y={y(v) - 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.tinta}>{fmt(v)}</text>
                    )}
                  </g>
                );
              })}
              {(!labelsEnEje || ci % Math.ceil(categorias.length / 12) === 0) && (
                <text x={pL + slot * ci + slot / 2} y={H - 12} textAnchor="middle" fontSize={categorias.length > 8 ? 9.5 : 11} fill={C.tinta2}>
                  {String(c).length > 12 ? String(c).slice(0, 11) + "…" : c}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hov != null && (
        <Tip x={((pL + slot * hov + slot / 2) / W) * 100}>
          <p className="font-semibold">{categorias[hov]}</p>
          {series.map((s) => (
            <p key={s.nombre} className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: s.color }} />{s.nombre}: <b>{fmt(s.valores[hov] || 0)}</b>
            </p>
          ))}
        </Tip>
      )}
    </div>
  );
}

// ---------- Barras horizontales ----------
export function BarrasH({ filas, color = C.azul, fmt = fmtDef, max, alAncho = 110 }) {
  const m = max || Math.max(1, ...filas.map((f) => f.valor));
  return (
    <div className="space-y-2">
      {filas.map((f) => (
        <div key={f.label} className="flex items-center gap-2 group" title={f.title || ""}>
          <span className="text-[11px] text-[#5c6b78] truncate text-right shrink-0" style={{ width: alAncho }}>{f.label}</span>
          <div className="flex-1 h-5 bg-[#f6f8fa] rounded-md overflow-hidden">
            <div className="h-full rounded-md transition-all group-hover:brightness-110"
              style={{ width: `${Math.max(f.valor > 0 ? 2 : 0, (f.valor / m) * 100)}%`, backgroundColor: f.color || color }} />
          </div>
          <span className="text-xs font-bold text-[#1f2d38] tabular-nums w-16 text-right shrink-0">{fmt(f.valor)}</span>
        </div>
      ))}
    </div>
  );
}

// ---------- Línea / área ----------
export function Linea({ puntos, color = C.azul, fmt = fmtDef, alto = 200, maxFijo, etiquetaMax = true, ancho = 640 }) {
  const [hov, setHov] = useState(null);
  const W = ancho, H = alto, pL = 34, pR = 22, pT = 18, pB = 26;
  const iw = W - pL - pR, ih = H - pT - pB;
  const vals = puntos.map((p) => p.valor);
  const max = maxFijo || Math.max(1, ...vals) * 1.1;
  const x = (i) => pL + (puntos.length <= 1 ? iw / 2 : (i / (puntos.length - 1)) * iw);
  const y = (v) => pT + ih - (v / max) * ih;
  const d = puntos.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.valor)}`).join(" ");
  const area = puntos.length ? `${d} L${x(puntos.length - 1)},${pT + ih} L${x(0)},${pT + ih} Z` : "";
  const iMax = vals.indexOf(Math.max(...vals));
  const paso = Math.ceil(puntos.length / 10);
  const gid = `g${color.slice(1)}`;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto"
        onMouseMove={(ev) => {
          const r = ev.currentTarget.getBoundingClientRect();
          const px = ((ev.clientX - r.left) / r.width) * W;
          let best = 0; puntos.forEach((_, i) => { if (Math.abs(x(i) - px) < Math.abs(x(best) - px)) best = i; });
          setHov(best);
        }}
        onMouseLeave={() => setHov(null)}>
        <defs>
          <linearGradient id={gid} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={pL} x2={W - pR} y1={y(max * t)} y2={y(max * t)} stroke={t === 0 ? "#cfd6dd" : "#eef1f4"} />
            <text x={pL - 5} y={y(max * t) + 3.5} textAnchor="end" fontSize="9.5" fill={C.gris}>{fmt(max * t)}</text>
          </g>
        ))}
        {area && <path d={area} fill={`url(#${gid})`} />}
        <path d={d} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        {puntos.map((p, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(p.valor)} r={hov === i ? 5 : puntos.length > 20 ? 2.2 : 3.5} fill="#fff" stroke={color} strokeWidth="2" />
            {i % paso === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="9.5" fill={C.tinta2}>{p.label}</text>}
          </g>
        ))}
        {etiquetaMax && iMax >= 0 && hov == null && vals[iMax] > 0 && (
          <text x={x(iMax)} y={y(vals[iMax]) - 9} textAnchor="middle" fontSize="10" fontWeight="700" fill={C.tinta}>{fmt(vals[iMax])}</text>
        )}
        {hov != null && <line x1={x(hov)} x2={x(hov)} y1={pT} y2={pT + ih} stroke={C.gris} strokeDasharray="3 3" />}
      </svg>
      {hov != null && (
        <Tip x={(x(hov) / W) * 100}>
          <p className="font-semibold">{puntos[hov].titulo || puntos[hov].label}</p>
          <p><b>{fmt(puntos[hov].valor)}</b>{puntos[hov].extra ? ` · ${puntos[hov].extra}` : ""}</p>
        </Tip>
      )}
    </div>
  );
}

function Tip({ x, children }) {
  return (
    <div className="absolute top-0 pointer-events-none bg-[#1f2d38] text-white rounded-lg px-2.5 py-1.5 text-[11px] shadow-lg whitespace-nowrap z-10 space-y-0.5"
      style={{ left: `${x}%`, transform: `translateX(${x > 70 ? "-100%" : x < 30 ? "0" : "-50%"})` }}>
      {children}
    </div>
  );
}
