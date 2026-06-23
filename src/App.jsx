import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, Building2, ArrowDownCircle, ArrowUpCircle, Plus, X, Pencil,
  Trash2, CalendarClock, TrendingUp, TrendingDown, Check, Users,
  AlertCircle, Wallet, Tag, ChevronRight, ChevronLeft, BellRing,
} from "lucide-react";

/* ----------------------------- design tokens ----------------------------- */
const C = {
  bg: "#eef1f4", surface: "#ffffff", ink: "#1b2430", sub: "#66727f",
  line: "#e3e8ed", soft: "#f5f7f9",
  primary: "#0f6e63", primaryDk: "#0b574e", primarySoft: "#e3f1ef",
  income: "#197a4b", incomeSoft: "#e7f4ec",
  expense: "#c0492a", expenseSoft: "#f8ebe5",
  amber: "#b9821a", amberSoft: "#fbf2df",
  red: "#c0392b",
};
const FONT = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/* ------------------------------- utilities -------------------------------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const fmtDate = (s) => parse(s).toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 86400000); // b - a
const lastDay = (y, m) => new Date(y, m, 0).getDate();
const currentPeriodo = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const periodoLabel = (p) => { const [y, m] = p.split("-").map(Number); const s = new Date(y, m - 1, 1).toLocaleDateString("es-PE", { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); };
const vencimientoFor = (periodo, dia) => { const [y, m] = periodo.split("-").map(Number); const d = Math.min(dia, lastDay(y, m)); return `${y}-${pad(m)}-${pad(d)}`; };
const money = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const sumPagos = (c) => c.pagos.reduce((s, p) => s + Number(p.monto), 0);
const cobroSaldo = (c) => c.monto - sumPagos(c);
const cobroEstado = (c) => { const p = sumPagos(c); if (p <= 0.001) return "pendiente"; if (p >= c.monto - 0.001) return "pagado"; return "parcial"; };
const cobroFechaCompleto = (c) => cobroEstado(c) === "pagado" ? c.pagos.map((p) => p.fecha).sort().slice(-1)[0] : null;
const cobroAtraso = (c) => { const f = cobroFechaCompleto(c); return f == null ? null : daysBetween(c.vencimiento, f); };

const startOfWeek = () => { const d = new Date(); const day = (d.getDay() + 6) % 7; d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - day); return d; };
const inPeriod = (fechaStr, mode) => {
  const f = parse(fechaStr), now = new Date();
  if (mode === "año") return f.getFullYear() === now.getFullYear();
  if (mode === "mes") return f.getFullYear() === now.getFullYear() && f.getMonth() === now.getMonth();
  const sow = startOfWeek(), eow = new Date(sow); eow.setDate(sow.getDate() + 7);
  return f >= sow && f < eow;
};
const nextDue = (dia) => {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth() + 1;
  let cand = vencimientoFor(`${y}-${pad(m)}`, dia);
  if (daysBetween(todayStr(), cand) < 0) { const nm = m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; cand = vencimientoFor(nm, dia); }
  return cand;
};

/* ------------------------------- storage ---------------------------------- */
const API = "/api/data";
async function cargarDatos() {
  const r = await fetch(API);
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  if (!d || !d.ok) throw new Error(d && d.error ? d.error : "Respuesta inválida del servidor");
  return d.state;
}
async function guardarDatos(state) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state }) });
  const d = await r.json();
  if (!d || !d.ok) throw new Error(d && d.error ? d.error : "Error al guardar");
}

const DEFAULT = {
  departamentos: [],
  cobros: [],
  gastos: [],
  otrosIngresos: [],
  catGasto: [
    { id: "g1", nombre: "Mantenimiento" }, { id: "g2", nombre: "Servicios (luz, agua)" },
    { id: "g3", nombre: "Reparaciones" }, { id: "g4", nombre: "Limpieza" },
  ],
  catIngreso: [{ id: "alquiler", nombre: "Alquiler", sistema: true }, { id: "otro", nombre: "Otro" }],
};

/* ============================== small pieces =============================== */
function Pill({ children, color, bg }) {
  return <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold" style={{ color, background: bg }}>{children}</span>;
}
function estadoPill(estado) {
  if (estado === "pagado") return <Pill color={C.income} bg={C.incomeSoft}>Pagado</Pill>;
  if (estado === "parcial") return <Pill color={C.amber} bg={C.amberSoft}>Parcial</Pill>;
  return <Pill color={C.expense} bg={C.expenseSoft}>Pendiente</Pill>;
}
function Field({ label, children }) {
  return <label className="block mb-3"><span className="block text-xs font-semibold mb-1.5" style={{ color: C.sub }}>{label}</span>{children}</label>;
}
const inputStyle = { width: "100%", border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 15, color: C.ink, background: C.surface, outline: "none", fontFamily: FONT };

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center" style={{ background: "rgba(20,28,38,.45)" }} onClick={onClose}>
      <div className="w-full md:max-w-md bg-white md:rounded-2xl rounded-t-2xl shadow-xl max-h-[92vh] flex flex-col" style={{ fontFamily: FONT }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.line }}>
          <h3 className="font-bold text-lg" style={{ color: C.ink }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100"><X size={20} color={C.sub} /></button>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t flex gap-2" style={{ borderColor: C.line }}>{footer}</div>}
      </div>
    </div>
  );
}
function PrimaryBtn({ children, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} className="flex-1 rounded-xl py-2.5 font-semibold text-white text-sm transition active:scale-[.99] disabled:opacity-50" style={{ background: C.primary }}>{children}</button>;
}
function GhostBtn({ children, onClick }) {
  return <button onClick={onClick} className="rounded-xl py-2.5 px-4 font-semibold text-sm" style={{ color: C.sub, background: C.soft }}>{children}</button>;
}
function Card({ children, className = "", style = {} }) {
  return <div className={`rounded-2xl ${className}`} style={{ background: C.surface, border: `1px solid ${C.line}`, ...style }}>{children}</div>;
}
function SectionTitle({ children, right }) {
  return <div className="flex items-center justify-between mb-2 mt-1"><h2 className="text-sm font-bold uppercase tracking-wide" style={{ color: C.sub, letterSpacing: ".04em" }}>{children}</h2>{right}</div>;
}

/* ================================== app ==================================== */
export default function App() {
  const [view, setView] = useState("inicio");
  const [data, setData] = useState(DEFAULT);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const saveTimer = useRef(null);
  const firstSave = useRef(true);
  const [modal, setModal] = useState(null);
  const [period, setPeriod] = useState("mes");
  const [selMonth, setSelMonth] = useState(currentPeriodo());
  const [selYear, setSelYear] = useState(new Date().getFullYear());
  const shiftMonth = (delta) => { const [y, m] = selMonth.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); setSelMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };
  const matchPeriod = (fechaStr) => { const f = parse(fechaStr); if (period === "año") return f.getFullYear() === selYear; const [y, m] = selMonth.split("-").map(Number); return f.getFullYear() === y && f.getMonth() === m - 1; };

  /* load from API */
  useEffect(() => { (async () => {
    try { const s = await cargarDatos(); if (s) setData({ ...DEFAULT, ...s }); }
    catch (e) { setLoadError(String(e.message || e)); }
    setLoaded(true);
  })(); }, []);
  /* save to API (debounced) */
  useEffect(() => {
    if (!loaded || loadError) return;
    if (firstSave.current) { firstSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncing(true);
      try { await guardarDatos(data); } catch (e) { /* se reintenta en el próximo cambio */ }
      setSyncing(false);
    }, 800);
  }, [data, loaded, loadError]);
  /* auto-create current month charges for active units */
  useEffect(() => {
    if (!loaded) return;
    setData((prev) => {
      const per = currentPeriodo(); let changed = false; const cobros = [...prev.cobros];
      prev.departamentos.filter((d) => d.activo).forEach((d) => {
        if (!cobros.some((c) => c.departamentoId === d.id && c.periodo === per)) {
          cobros.push({ id: uid(), departamentoId: d.id, periodo: per, monto: d.monto, vencimiento: vencimientoFor(per, d.diaPago), inquilinoNombre: d.inquilino, pagos: [] });
          changed = true;
        }
      });
      return changed ? { ...prev, cobros } : prev;
    });
  }, [loaded, data.departamentos]);

  /* ----------------------------- mutations -------------------------------- */
  const upd = (fn) => setData((p) => fn({ ...p }));
  const saveDepto = (d) => upd((p) => {
    const ex = p.departamentos.find((x) => x.id === d.id);
    if (ex) p.departamentos = p.departamentos.map((x) => x.id === d.id ? d : x);
    else p.departamentos = [...p.departamentos, d];
    return p;
  });
  const delDepto = (id) => upd((p) => { p.departamentos = p.departamentos.filter((x) => x.id !== id); p.cobros = p.cobros.filter((c) => c.departamentoId !== id); return p; });
  const generarCobro = (deptId, periodo) => {
    const exist = data.cobros.find((c) => c.departamentoId === deptId && c.periodo === periodo);
    if (exist) return exist.id;
    const d = data.departamentos.find((x) => x.id === deptId);
    const c = { id: uid(), departamentoId: deptId, periodo, monto: d.monto, vencimiento: vencimientoFor(periodo, d.diaPago), inquilinoNombre: d.inquilino, pagos: [] };
    setData((p) => ({ ...p, cobros: [...p.cobros, c] }));
    return c.id;
  };
  const registrarPago = (cobroId, fecha, monto) => { if (!cobroId) return; upd((p) => {
    p.cobros = p.cobros.map((c) => c.id === cobroId ? { ...c, pagos: [...c.pagos, { id: uid(), fecha, monto: Number(monto) }] } : c);
    return p;
  }); };
  const delPago = (cobroId, pagoId) => upd((p) => { p.cobros = p.cobros.map((c) => c.id === cobroId ? { ...c, pagos: c.pagos.filter((x) => x.id !== pagoId) } : c); return p; });
  const addGasto = (g) => upd((p) => { p.gastos = [{ id: uid(), ...g }, ...p.gastos]; return p; });
  const delGasto = (id) => upd((p) => { p.gastos = p.gastos.filter((x) => x.id !== id); return p; });
  const addOtroIngreso = (g) => upd((p) => { p.otrosIngresos = [{ id: uid(), ...g }, ...p.otrosIngresos]; return p; });
  const delOtroIngreso = (id) => upd((p) => { p.otrosIngresos = p.otrosIngresos.filter((x) => x.id !== id); return p; });
  const addCatGasto = (nombre) => { const id = uid(); upd((p) => { p.catGasto = [...p.catGasto, { id, nombre }]; return p; }); return id; };
  const addCatIngreso = (nombre) => { const id = uid(); upd((p) => { p.catIngreso = [...p.catIngreso, { id, nombre }]; return p; }); return id; };

  /* ----------------------------- derived ---------------------------------- */
  const activos = data.departamentos.filter((d) => d.activo);
  const ingresosPeriodo = useMemo(() => {
    let t = 0;
    data.cobros.forEach((c) => c.pagos.forEach((pg) => { if (matchPeriod(pg.fecha)) t += Number(pg.monto); }));
    data.otrosIngresos.forEach((o) => { if (matchPeriod(o.fecha)) t += Number(o.monto); });
    return t;
  }, [data, period, selMonth, selYear]);
  const gastosPeriodo = useMemo(() => data.gastos.filter((g) => matchPeriod(g.fecha)).reduce((s, g) => s + Number(g.monto), 0), [data, period, selMonth, selYear]);
  const ganancia = ingresosPeriodo - gastosPeriodo;

  const gastosPorCat = useMemo(() => {
    const m = {};
    data.gastos.filter((g) => matchPeriod(g.fecha)).forEach((g) => { m[g.categoriaId] = (m[g.categoriaId] || 0) + Number(g.monto); });
    return Object.entries(m).map(([id, total]) => ({ nombre: data.catGasto.find((c) => c.id === id)?.nombre || "Otro", total })).sort((a, b) => b.total - a.total);
  }, [data, period, selMonth, selYear]);

  const puntualidad = useMemo(() => {
    const m = {};
    data.cobros.forEach((c) => { if (cobroEstado(c) === "pagado") { const k = c.inquilinoNombre || "—"; const a = cobroAtraso(c); if (!m[k]) m[k] = { nombre: k, total: 0, n: 0 }; m[k].total += a; m[k].n++; } });
    return Object.values(m).map((x) => ({ ...x, avg: x.total / x.n })).sort((a, b) => a.avg - b.avg);
  }, [data]);

  const alertas = useMemo(() => {
    return activos.map((d) => {
      const unpaid = data.cobros.filter((c) => c.departamentoId === d.id && cobroEstado(c) !== "pagado").sort((a, b) => a.vencimiento < b.vencimiento ? -1 : 1);
      if (unpaid.length) { const c = unpaid[0]; return { dept: d, dias: daysBetween(todayStr(), c.vencimiento), venc: c.vencimiento, saldo: cobroSaldo(c), estado: cobroEstado(c) }; }
      const nd = nextDue(d.diaPago); return { dept: d, dias: daysBetween(todayStr(), nd), venc: nd, saldo: d.monto, estado: "al_dia" };
    }).filter((a) => a.dias <= 7).sort((a, b) => a.dias - b.dias);
  }, [activos, data.cobros]);

  const puntLabel = (avg) => {
    if (avg <= 0) return { txt: avg < -0.5 ? `paga ${Math.abs(Math.round(avg))} d antes` : "siempre puntual", color: C.income, bg: C.incomeSoft };
    if (avg <= 2) return { txt: `${avg.toFixed(1)} d de atraso`, color: C.primary, bg: C.primarySoft };
    if (avg <= 5) return { txt: `${avg.toFixed(1)} d de atraso`, color: C.amber, bg: C.amberSoft };
    return { txt: `${avg.toFixed(1)} d de atraso`, color: C.expense, bg: C.expenseSoft };
  };

  /* ------------------------------- nav ------------------------------------ */
  const NAV = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "deptos", label: "Departamentos", icon: Building2 },
    { id: "ingresos", label: "Ingresos", icon: ArrowUpCircle },
    { id: "gastos", label: "Gastos", icon: ArrowDownCircle },
  ];

  if (!loaded) return <div style={{ fontFamily: FONT, background: C.bg }} className="min-h-screen flex items-center justify-center"><span style={{ color: C.sub }}>Cargando…</span></div>;
  if (loadError) return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.ink }} className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="font-bold text-lg mb-2">No se pudo conectar con la base de datos</div>
        <div className="text-sm mb-4" style={{ color: C.sub }}>{loadError}</div>
        <div className="text-xs mb-4" style={{ color: C.sub }}>Revisa que en Vercel estén configuradas las variables APPSCRIPT_URL y APP_SECRET, y que la Web App de Apps Script esté publicada con acceso «Cualquier usuario».</div>
        <button onClick={() => location.reload()} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: C.primary }}>Reintentar</button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.ink }} className="min-h-screen">
      {/* sidebar (desktop) */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 border-r px-3 py-5" style={{ background: C.surface, borderColor: C.line }}>
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.primary }}><Building2 size={20} color="#fff" /></div>
          <div><div className="font-bold leading-tight">Edificio</div><div className="text-xs" style={{ color: C.sub }}>Control de alquileres</div></div>
        </div>
        {NAV.map((n) => { const A = n.icon; const on = view === n.id; return (
          <button key={n.id} onClick={() => setView(n.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-semibold transition" style={{ background: on ? C.primarySoft : "transparent", color: on ? C.primaryDk : C.sub }}>
            <A size={19} />{n.label}
          </button>
        ); })}
      </aside>

      {/* main */}
      <main className="md:ml-60 pb-24 md:pb-10">
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-5">
          {view === "inicio" && <Inicio />}
          {view === "deptos" && <Deptos />}
          {view === "ingresos" && <Ingresos />}
          {view === "gastos" && <Gastos />}
        </div>
      </main>

      {/* bottom nav (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 flex border-t z-40" style={{ background: C.surface, borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map((n) => { const A = n.icon; const on = view === n.id; return (
          <button key={n.id} onClick={() => setView(n.id)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5" style={{ color: on ? C.primary : C.sub }}>
            <A size={21} /><span className="text-[11px] font-semibold">{n.label}</span>
          </button>
        ); })}
      </nav>

      {syncing && <div className="fixed z-50 bottom-20 md:bottom-4 right-4 rounded-full px-3 py-1.5 text-xs font-semibold shadow" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.sub }}>Guardando…</div>}
      {modal && renderModal()}
    </div>
  );

  /* =============================== views ================================== */
  function Header({ title, onAdd, addLabel }) {
    return (
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {onAdd && <button onClick={onAdd} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white" style={{ background: C.primary }}><Plus size={17} />{addLabel}</button>}
      </div>
    );
  }

  function Inicio() {
    return (
      <>
        <Header title="Inicio" />
        {/* period selector */}
        <div className="flex items-center justify-between gap-2 mb-4 flex-wrap">
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: C.soft, border: `1px solid ${C.line}` }}>
            {[["mes", "Mes"], ["año", "Año"]].map(([k, l]) => (
              <button key={k} onClick={() => setPeriod(k)} className="rounded-lg px-5 py-1.5 text-sm font-semibold transition" style={{ background: period === k ? C.surface : "transparent", color: period === k ? C.ink : C.sub, boxShadow: period === k ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>{l}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-xl p-1" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
            <button onClick={() => period === "año" ? setSelYear(selYear - 1) : shiftMonth(-1)} className="p-1.5 rounded-lg" style={{ color: C.sub }} aria-label="Anterior"><ChevronLeft size={18} /></button>
            <span className="text-sm font-bold text-center px-1" style={{ minWidth: 116 }}>{period === "año" ? selYear : periodoLabel(selMonth)}</span>
            <button onClick={() => period === "año" ? setSelYear(selYear + 1) : shiftMonth(1)} className="p-1.5 rounded-lg" style={{ color: C.sub }} aria-label="Siguiente"><ChevronRight size={18} /></button>
          </div>
        </div>

        {/* totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1" style={{ color: C.income }}><TrendingUp size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Ingresos</span></div>
            <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(ingresosPeriodo)}</div>
          </Card>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-1" style={{ color: C.expense }}><TrendingDown size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Gastos</span></div>
            <div className="text-2xl font-extrabold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(gastosPeriodo)}</div>
          </Card>
          <Card className="p-4" style={{ background: ganancia >= 0 ? C.primary : C.expense, borderColor: "transparent" }}>
            <div className="flex items-center gap-2 mb-1 text-white opacity-90"><Wallet size={16} /><span className="text-xs font-semibold uppercase tracking-wide">Ganancia neta</span></div>
            <div className="text-2xl font-extrabold text-white" style={{ fontVariantNumeric: "tabular-nums" }}>{money(ganancia)}</div>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 gap-5">
          <div>
            {/* alerts */}
            <SectionTitle right={<BellRing size={15} color={C.sub} />}>Cobros próximos</SectionTitle>
            <Card className="overflow-hidden mb-5">
              {alertas.length === 0 ? (
                <div className="p-5 text-sm text-center" style={{ color: C.sub }}>No hay cobros próximos ni vencidos.</div>
              ) : alertas.map((a, i) => {
                const overdue = a.dias < 0;
                const col = a.estado === "al_dia" && !overdue ? C.primary : overdue ? C.expense : C.amber;
                return (
                  <button key={a.dept.id} onClick={() => setModal({ type: "deptoDetail", id: a.dept.id })} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                    <CalendarClock size={20} color={col} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{a.dept.nombre} · {a.dept.inquilino}</div>
                      <div className="text-xs" style={{ color: C.sub }}>
                        {overdue ? `Vencido hace ${Math.abs(a.dias)} d` : a.dias === 0 ? "Vence hoy" : `Vence en ${a.dias} d`} · {fmtDate(a.venc)}
                        {a.estado !== "al_dia" && ` · saldo ${money(a.saldo)}`}
                      </div>
                    </div>
                    <ChevronRight size={18} color={C.sub} />
                  </button>
                );
              })}
            </Card>
          </div>

          <div>
            {/* punctuality */}
            <SectionTitle right={<Users size={15} color={C.sub} />}>Puntualidad</SectionTitle>
            {puntualidad.length === 0 ? (
              <Card className="p-5 text-sm text-center mb-5" style={{ color: C.sub }}>Aún no hay alquileres pagados para evaluar.</Card>
            ) : (
              <div className="grid grid-cols-1 gap-3 mb-5">
                <PuntCard titulo="Más puntual" data={puntualidad[0]} />
                {puntualidad.length > 1 && <PuntCard titulo="Menos puntual" data={puntualidad[puntualidad.length - 1]} />}
              </div>
            )}
          </div>
        </div>

        {/* expenses by category */}
        <SectionTitle>Gastos por categoría</SectionTitle>
        <Card className="p-4 mb-4">
          {gastosPorCat.length === 0 ? (
            <div className="text-sm text-center py-3" style={{ color: C.sub }}>Sin gastos en este período.</div>
          ) : gastosPorCat.map((g, i) => {
            const max = gastosPorCat[0].total || 1;
            return (
              <div key={i} className="mb-3 last:mb-0">
                <div className="flex justify-between text-sm mb-1"><span className="font-medium">{g.nombre}</span><span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(g.total)}</span></div>
                <div className="h-2 rounded-full" style={{ background: C.soft }}><div className="h-2 rounded-full" style={{ width: `${(g.total / max) * 100}%`, background: C.expense }} /></div>
              </div>
            );
          })}
        </Card>
      </>
    );
  }

  function PuntCard({ titulo, data }) {
    const lab = puntLabel(data.avg);
    return (
      <Card className="p-4">
        <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.sub }}>{titulo}</div>
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg">{data.nombre}</span>
          <Pill color={lab.color} bg={lab.bg}>{lab.txt}</Pill>
        </div>
        <div className="text-xs mt-1" style={{ color: C.sub }}>{data.n} {data.n === 1 ? "mes evaluado" : "meses evaluados"}</div>
      </Card>
    );
  }

  function Deptos() {
    return (
      <>
        <Header title="Departamentos" onAdd={() => setModal({ type: "deptoForm" })} addLabel="Nuevo" />
        {data.departamentos.length === 0 ? (
          <Empty icon={Building2} title="Crea tu primer departamento" sub="Registra el nombre del depto, su inquilino, el monto del alquiler y el día de pago." />
        ) : (
          <div className="grid md:grid-cols-2 gap-3">
            {data.departamentos.map((d) => {
              const cur = data.cobros.find((c) => c.departamentoId === d.id && c.periodo === currentPeriodo());
              const est = cur ? cobroEstado(cur) : "pendiente";
              return (
                <button key={d.id} onClick={() => setModal({ type: "deptoDetail", id: d.id })} className="text-left">
                  <Card className="p-4 h-full" style={{ opacity: d.activo ? 1 : 0.6 }}>
                    <div className="flex items-start justify-between mb-2">
                      <div><div className="font-bold text-lg">{d.nombre}</div><div className="text-sm" style={{ color: C.sub }}>{d.inquilino || "Sin inquilino"}</div></div>
                      {d.activo ? estadoPill(est) : <Pill color={C.sub} bg={C.soft}>Desocupado</Pill>}
                    </div>
                    <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: C.line }}>
                      <span style={{ color: C.sub }}>Alquiler</span>
                      <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{money(d.monto)} · día {d.diaPago}</span>
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </>
    );
  }

  function Ingresos() {
    const lista = useMemo(() => {
      const r = [];
      data.cobros.forEach((c) => { const dep = data.departamentos.find((d) => d.id === c.departamentoId); c.pagos.forEach((pg) => r.push({ tipo: "alquiler", fecha: pg.fecha, monto: pg.monto, t1: `${dep?.nombre || "Depto"} · ${c.inquilinoNombre}`, t2: `Alquiler ${periodoLabel(c.periodo)}`, key: pg.id, cobroId: c.id, pagoId: pg.id })); });
      data.otrosIngresos.forEach((o) => r.push({ tipo: "otro", fecha: o.fecha, monto: o.monto, t1: o.concepto, t2: data.catIngreso.find((x) => x.id === o.categoriaId)?.nombre || "Otro", key: o.id, otroId: o.id }));
      return r.sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    }, [data]);
    return (
      <>
        <Header title="Ingresos" onAdd={() => setModal({ type: "ingresoForm" })} addLabel="Registrar" />
        {lista.length === 0 ? (
          <Empty icon={ArrowUpCircle} title="Registra un ingreso" sub="Cobra un alquiler (con pagos parciales si hace falta) u otro ingreso del edificio." />
        ) : (
          <Card className="overflow-hidden">
            {lista.map((it, i) => (
              <div key={it.key} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.incomeSoft }}><ArrowUpCircle size={18} color={C.income} /></div>
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{it.t1}</div><div className="text-xs" style={{ color: C.sub }}>{it.t2} · {fmtDate(it.fecha)}</div></div>
                <span className="font-bold" style={{ color: C.income, fontVariantNumeric: "tabular-nums" }}>+{money(it.monto)}</span>
                <button onClick={() => { it.otroId ? delOtroIngreso(it.otroId) : delPago(it.cobroId, it.pagoId); }} className="p-1"><Trash2 size={16} color={C.sub} /></button>
              </div>
            ))}
          </Card>
        )}
      </>
    );
  }

  function Gastos() {
    const lista = [...data.gastos].sort((a, b) => a.fecha < b.fecha ? 1 : -1);
    return (
      <>
        <Header title="Gastos" onAdd={() => setModal({ type: "gastoForm" })} addLabel="Registrar" />
        {lista.length === 0 ? (
          <Empty icon={ArrowDownCircle} title="Registra un gasto" sub="Focos, mantenimiento, pintado… elige una categoría o crea una nueva." />
        ) : (
          <Card className="overflow-hidden">
            {lista.map((g, i) => (
              <div key={g.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.expenseSoft }}><Tag size={17} color={C.expense} /></div>
                <div className="flex-1 min-w-0"><div className="font-semibold truncate">{g.concepto}</div><div className="text-xs" style={{ color: C.sub }}>{data.catGasto.find((c) => c.id === g.categoriaId)?.nombre || "Otro"} · {(!g.departamentoId || g.departamentoId === "general") ? "General" : (data.departamentos.find((d) => d.id === g.departamentoId)?.nombre || "Departamento")} · {fmtDate(g.fecha)}</div></div>
                <span className="font-bold" style={{ color: C.expense, fontVariantNumeric: "tabular-nums" }}>-{money(g.monto)}</span>
                <button onClick={() => delGasto(g.id)} className="p-1"><Trash2 size={16} color={C.sub} /></button>
              </div>
            ))}
          </Card>
        )}
      </>
    );
  }

  function Empty({ icon: I, title, sub }) {
    return (
      <Card className="p-8 text-center mt-2">
        <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-3" style={{ background: C.soft }}><I size={26} color={C.primary} /></div>
        <div className="font-bold text-lg mb-1">{title}</div>
        <div className="text-sm max-w-xs mx-auto" style={{ color: C.sub }}>{sub}</div>
      </Card>
    );
  }

  /* =============================== modals ================================= */
  function renderModal() {
    if (modal.type === "deptoForm") return <DeptoForm dept={modal.dept} />;
    if (modal.type === "deptoDetail") return <DeptoDetail id={modal.id} />;
    if (modal.type === "gastoForm") return <GastoForm />;
    if (modal.type === "ingresoForm") return <IngresoForm />;
    if (modal.type === "pagoForm") return <PagoForm cobroId={modal.cobroId} />;
    return null;
  }

  function DeptoForm({ dept }) {
    const [f, setF] = useState(dept || { id: uid(), nombre: "", inquilino: "", monto: "", diaPago: 5, activo: true });
    const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
    const ok = f.nombre.trim() && f.inquilino.trim() && Number(f.monto) > 0;
    return (
      <Modal title={dept ? "Editar departamento" : "Nuevo departamento"} onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => { saveDepto({ ...f, monto: Number(f.monto), diaPago: Number(f.diaPago) }); setModal(null); }}>Guardar</PrimaryBtn></>}>
        <Field label="Nombre del departamento"><input style={inputStyle} value={f.nombre} placeholder="Ej. Depto 101" onChange={(e) => set("nombre", e.target.value)} /></Field>
        <Field label="Inquilino actual"><input style={inputStyle} value={f.inquilino} placeholder="Nombre del inquilino" onChange={(e) => set("inquilino", e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Alquiler mensual (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={f.monto} placeholder="0.00" onChange={(e) => set("monto", e.target.value)} /></Field>
          <Field label="Día de pago"><select style={inputStyle} value={f.diaPago} onChange={(e) => set("diaPago", Number(e.target.value))}>{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{pad(n)}</option>)}</select></Field>
        </div>
        {dept && (
          <label className="flex items-center gap-2 mt-1 mb-3 cursor-pointer">
            <input type="checkbox" checked={f.activo} onChange={(e) => set("activo", e.target.checked)} />
            <span className="text-sm" style={{ color: C.sub }}>Departamento ocupado</span>
          </label>
        )}
        {dept && <button onClick={() => { if (confirm("¿Eliminar este departamento y sus cobros?")) { delDepto(dept.id); setModal(null); } }} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: C.red }}><Trash2 size={15} /> Eliminar departamento</button>}
      </Modal>
    );
  }

  function DeptoDetail({ id }) {
    const d = data.departamentos.find((x) => x.id === id);
    if (!d) { setModal(null); return null; }
    const cobros = data.cobros.filter((c) => c.departamentoId === id).sort((a, b) => a.periodo < b.periodo ? 1 : -1);
    const punt = puntualidad.find((p) => p.nombre === d.inquilino);
    return (
      <Modal title={d.nombre} onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal({ type: "deptoForm", dept: d })}>Editar</GhostBtn><PrimaryBtn onClick={() => { const c = generarCobro(id, currentPeriodo()); setModal({ type: "pagoForm", cobroId: c }); }}>Registrar pago</PrimaryBtn></>}>
        <div className="flex items-center justify-between mb-1"><span className="font-semibold">{d.inquilino || "Sin inquilino"}</span>{d.activo ? <Pill color={C.income} bg={C.incomeSoft}>Ocupado</Pill> : <Pill color={C.sub} bg={C.soft}>Desocupado</Pill>}</div>
        <div className="text-sm mb-3" style={{ color: C.sub }}>{money(d.monto)} mensual · vence el día {d.diaPago}{punt && ` · ${puntLabel(punt.avg).txt}`}</div>

        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.sub }}>Historial de cobros</div>
        {cobros.length === 0 && <div className="text-sm" style={{ color: C.sub }}>Aún no hay cobros generados.</div>}
        {cobros.map((c) => {
          const est = cobroEstado(c), saldo = cobroSaldo(c), atr = cobroAtraso(c);
          return (
            <div key={c.id} className="rounded-xl p-3 mb-2" style={{ background: C.soft }}>
              <div className="flex items-center justify-between">
                <span className="font-semibold">{periodoLabel(c.periodo)}</span>{estadoPill(est)}
              </div>
              <div className="text-xs mt-0.5" style={{ color: C.sub }}>
                Vence {fmtDate(c.vencimiento)} · {money(sumPagos(c))} de {money(c.monto)}
                {est === "pagado" && atr != null && (atr <= 0 ? " · pagó puntual" : ` · pagó ${atr} d tarde`)}
                {est !== "pagado" && ` · saldo ${money(saldo)}`}
              </div>
              {c.pagos.length > 0 && <div className="mt-2 space-y-1">{c.pagos.map((pg) => (
                <div key={pg.id} className="flex items-center justify-between text-xs"><span style={{ color: C.sub }}>{fmtDate(pg.fecha)}</span><span className="flex items-center gap-2"><b style={{ color: C.income }}>+{money(pg.monto)}</b><button onClick={() => delPago(c.id, pg.id)}><Trash2 size={13} color={C.sub} /></button></span></div>
              ))}</div>}
              {est !== "pagado" && <button onClick={() => setModal({ type: "pagoForm", cobroId: c.id })} className="text-xs font-semibold mt-2" style={{ color: C.primary }}>+ Registrar pago</button>}
            </div>
          );
        })}
      </Modal>
    );
  }

  function PagoForm({ cobroId }) {
    const c = data.cobros.find((x) => x.id === cobroId);
    const saldo = c ? cobroSaldo(c) : 0;
    const [monto, setMonto] = useState(saldo > 0 ? String(saldo) : "");
    const [fecha, setFecha] = useState(todayStr());
    const dep = data.departamentos.find((x) => x.id === c?.departamentoId);
    return (
      <Modal title="Registrar pago" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!(Number(monto) > 0)} onClick={() => { registrarPago(cobroId, fecha, monto); setModal(c?.departamentoId ? { type: "deptoDetail", id: c.departamentoId } : null); }}>Guardar pago</PrimaryBtn></>}>
        <div className="text-sm mb-3" style={{ color: C.sub }}>{dep?.nombre} · {c && periodoLabel(c.periodo)} · saldo {money(saldo)}</div>
        <Field label="Monto pagado (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
        <Field label="Fecha del pago"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <div className="text-xs" style={{ color: C.sub }}>Si pagas menos que el saldo, quedará como pago parcial.</div>
      </Modal>
    );
  }

  function GastoForm() {
    const [departamentoId, setDep] = useState("general");
    const [categoriaId, setCat] = useState(data.catGasto[0]?.id || "");
    const [creando, setCreando] = useState(false);
    const [nuevaCat, setNuevaCat] = useState("");
    const [concepto, setConcepto] = useState("");
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState(todayStr());
    const ok = concepto.trim() && Number(monto) > 0 && (creando ? nuevaCat.trim() : categoriaId);
    return (
      <Modal title="Registrar gasto" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => { let cid = categoriaId; if (creando) cid = addCatGasto(nuevaCat.trim()); addGasto({ departamentoId, categoriaId: cid, concepto: concepto.trim(), monto: Number(monto), fecha }); setModal(null); }}>Guardar</PrimaryBtn></>}>
        <Field label="Departamento">
          <select style={inputStyle} value={departamentoId} onChange={(e) => setDep(e.target.value)}>
            <option value="general">General (edificio)</option>
            {data.departamentos.map((d) => <option key={d.id} value={d.id}>{d.nombre}{d.inquilino ? ` · ${d.inquilino}` : ""}</option>)}
          </select>
        </Field>
        <Field label="Categoría">
          {!creando ? (
            <select style={inputStyle} value={categoriaId} onChange={(e) => e.target.value === "__new" ? setCreando(true) : setCat(e.target.value)}>
              {data.catGasto.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <option value="__new">+ Crear categoría…</option>
            </select>
          ) : (
            <div className="flex gap-2"><input style={inputStyle} autoFocus placeholder="Nueva categoría" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} /><GhostBtn onClick={() => { setCreando(false); setNuevaCat(""); }}>↩</GhostBtn></div>
          )}
        </Field>
        <Field label="Concepto"><input style={inputStyle} placeholder="Ej. Cambio de focos pasillo" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} placeholder="0.00" onChange={(e) => setMonto(e.target.value)} /></Field>
          <Field label="Fecha"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        </div>
      </Modal>
    );
  }

  function IngresoForm() {
    const [categoriaId, setCat] = useState("alquiler");
    const [creando, setCreando] = useState(false);
    const [nuevaCat, setNuevaCat] = useState("");
    // alquiler fields
    const [deptId, setDeptId] = useState(activos[0]?.id || "");
    const [mes, setMes] = useState(currentPeriodo());
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState(todayStr());
    // otro fields
    const [concepto, setConcepto] = useState("");

    const esAlquiler = categoriaId === "alquiler" && !creando;
    const dep = data.departamentos.find((x) => x.id === deptId);
    const cobroExist = data.cobros.find((c) => c.departamentoId === deptId && c.periodo === mes);
    const saldoSugerido = cobroExist ? cobroSaldo(cobroExist) : (dep ? dep.monto : 0);

    const ok = esAlquiler ? (deptId && mes && Number(monto || saldoSugerido) > 0) : (concepto.trim() && Number(monto) > 0 && (creando ? nuevaCat.trim() : categoriaId));

    const guardar = () => {
      if (esAlquiler) {
        const cid = generarCobro(deptId, mes);
        registrarPago(cid, fecha, Number(monto || saldoSugerido));
      } else {
        let cid = categoriaId; if (creando) cid = addCatIngreso(nuevaCat.trim());
        addOtroIngreso({ categoriaId: cid, concepto: concepto.trim(), monto: Number(monto), fecha });
      }
      setModal(null);
    };

    return (
      <Modal title="Registrar ingreso" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={guardar}>Guardar</PrimaryBtn></>}>
        <Field label="Categoría">
          {!creando ? (
            <select style={inputStyle} value={categoriaId} onChange={(e) => e.target.value === "__new" ? setCreando(true) : setCat(e.target.value)}>
              {data.catIngreso.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              <option value="__new">+ Crear categoría…</option>
            </select>
          ) : (
            <div className="flex gap-2"><input style={inputStyle} autoFocus placeholder="Nueva categoría (ej. Cochera)" value={nuevaCat} onChange={(e) => setNuevaCat(e.target.value)} /><GhostBtn onClick={() => { setCreando(false); setNuevaCat(""); }}>↩</GhostBtn></div>
          )}
        </Field>

        {esAlquiler ? (
          activos.length === 0 ? (
            <div className="text-sm" style={{ color: C.sub }}>Primero crea un departamento con inquilino en la pestaña Departamentos.</div>
          ) : (
            <>
              <Field label="Inquilino / departamento">
                <select style={inputStyle} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                  {activos.map((d) => <option key={d.id} value={d.id}>{d.nombre} · {d.inquilino}</option>)}
                </select>
              </Field>
              <Field label="Mes del alquiler"><input style={inputStyle} type="month" value={mes} onChange={(e) => setMes(e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monto (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} placeholder={saldoSugerido ? saldoSugerido.toFixed(2) : "0.00"} onChange={(e) => setMonto(e.target.value)} /></Field>
                <Field label="Fecha del pago"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
              </div>
              <div className="text-xs" style={{ color: C.sub }}>Saldo sugerido: {money(saldoSugerido)}. Puedes pagar menos (parcial).</div>
            </>
          )
        ) : (
          <>
            <Field label="Concepto"><input style={inputStyle} placeholder="Ej. Alquiler de cochera" value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} placeholder="0.00" onChange={(e) => setMonto(e.target.value)} /></Field>
              <Field label="Fecha"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
            </div>
          </>
        )}
      </Modal>
    );
  }
}
