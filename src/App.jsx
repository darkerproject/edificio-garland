import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Home, Building2, ArrowDownCircle, ArrowUpCircle, Plus, X, Pencil,
  Trash2, CalendarClock, TrendingUp, TrendingDown, Check, Users,
  AlertCircle, Wallet, Tag, ChevronRight, ChevronLeft, BellRing,
  Settings, LogOut, Lock, User,
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
const APP_VERSION = "v9";

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
const SES_KEY = "sesion";
function getSesion() { try { return JSON.parse(localStorage.getItem(SES_KEY) || "null"); } catch { return null; } }
function setSesion(s) { try { localStorage.setItem(SES_KEY, JSON.stringify(s)); } catch {} }
function clearSesion() { try { localStorage.removeItem(SES_KEY); } catch {} }
function getToken() { const s = getSesion(); return s && s.token ? s.token : ""; }

async function login(usuario, password) {
  const r = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ usuario, password }) });
  const d = await r.json();
  return d;
}
async function cargarDatos() {
  const r = await fetch(API, { headers: { "x-sesion": getToken() } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const d = await r.json();
  if (!d || !d.ok) throw new Error(d && d.error ? d.error : "Respuesta inválida del servidor");
  return d.state;
}
async function guardarDatos(state) {
  const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", "x-sesion": getToken() }, body: JSON.stringify({ state }) });
  const d = await r.json();
  if (!d || !d.ok) throw new Error(d && d.error ? d.error : "Error al guardar");
}

const DEFAULT = {
  departamentos: [],
  inquilinos: [],
  depositos: [],
  asignaciones: [],
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
        <div className="px-5 py-4 overflow-y-auto" style={{ overflowX: "hidden", paddingBottom: footer ? undefined : "calc(env(safe-area-inset-bottom) + 16px)" }}>{children}</div>
        {footer && <div className="px-5 py-3 border-t flex gap-2" style={{ borderColor: C.line, paddingBottom: "calc(env(safe-area-inset-bottom) + 12px)" }}>{footer}</div>}
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

/* ============================== update card ================================ */
function UpdateCard() {
  const [show, setShow] = useState(typeof window !== "undefined" && !!window.__needRefresh);
  useEffect(() => {
    const h = () => setShow(true);
    window.addEventListener("pwa:need-refresh", h);
    return () => window.removeEventListener("pwa:need-refresh", h);
  }, []);
  if (!show) return null;
  const actualizar = () => { try { window.__updateSW ? window.__updateSW() : location.reload(); } catch { location.reload(); } };
  return (
    <div className="fixed inset-x-0 md:left-60 z-[60] bottom-20 md:bottom-4 px-4 flex justify-center" style={{ pointerEvents: "none" }}>
      <div className="w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg" style={{ background: C.ink, color: "#fff", pointerEvents: "auto" }}>
        <div className="flex-1">
          <div className="font-bold text-sm">Nueva versión disponible</div>
          <div className="text-xs" style={{ color: "#c9d2dc" }}>Actualiza para ver los últimos cambios.</div>
        </div>
        <button onClick={actualizar} className="rounded-xl px-3.5 py-2 text-sm font-bold shrink-0" style={{ background: C.primary, color: "#fff" }}>Actualizar</button>
      </div>
    </div>
  );
}

/* ================================ login ==================================== */
function Login({ onLogin }) {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const entrar = async () => {
    if (!usuario.trim() || !password) return;
    setCargando(true); setError("");
    try {
      const d = await login(usuario.trim(), password);
      if (d && d.ok && d.token) {
        const s = { token: d.token, nombre: d.nombre || usuario.trim(), usuario: usuario.trim() };
        setSesion(s); onLogin(s);
      } else {
        setError(d && d.error ? d.error : "No se pudo iniciar sesión");
      }
    } catch (e) {
      setError("Error de conexión. Intenta de nuevo.");
    }
    setCargando(false);
  };

  return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.ink }} className="min-h-screen flex items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3" style={{ background: C.primary }}><Building2 size={28} color="#fff" /></div>
          <div className="font-extrabold text-2xl tracking-tight">Edificio Garland</div>
          <div className="text-sm" style={{ color: C.sub }}>Control de alquileres y gastos</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <label className="block mb-3">
            <span className="block text-xs font-semibold mb-1.5" style={{ color: C.sub }}>Usuario</span>
            <div className="flex items-center gap-2 rounded-xl px-3" style={{ border: `1px solid ${C.line}` }}>
              <User size={17} color={C.sub} />
              <input value={usuario} onChange={(e) => setUsuario(e.target.value)} autoCapitalize="none" autoCorrect="off"
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 15, color: C.ink, background: "transparent", fontFamily: FONT }} />
            </div>
          </label>
          <label className="block mb-4">
            <span className="block text-xs font-semibold mb-1.5" style={{ color: C.sub }}>Contraseña</span>
            <div className="flex items-center gap-2 rounded-xl px-3" style={{ border: `1px solid ${C.line}` }}>
              <Lock size={17} color={C.sub} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entrar()}
                style={{ flex: 1, border: "none", outline: "none", padding: "10px 0", fontSize: 15, color: C.ink, background: "transparent", fontFamily: FONT }} />
            </div>
          </label>
          {error && <div className="text-sm mb-3 px-1" style={{ color: C.expense }}>{error}</div>}
          <button onClick={entrar} disabled={cargando || !usuario.trim() || !password}
            className="w-full rounded-xl py-3 font-semibold text-white transition active:scale-[.99] disabled:opacity-50" style={{ background: C.primary }}>
            {cargando ? "Entrando…" : "Entrar"}
          </button>
        </div>
        <div className="text-xs text-center mt-4" style={{ color: C.sub }}>Las cuentas las gestiona el administrador.</div>
      </div>
      <UpdateCard />
    </div>
  );
}

/* ================================== app ==================================== */
export default function App() {
  const [sesion, setSes] = useState(getSesion());
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
  const [deptoTab, setDeptoTab] = useState("deptos");
  const shiftMonth = (delta) => { const [y, m] = selMonth.split("-").map(Number); const d = new Date(y, m - 1 + delta, 1); setSelMonth(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); };
  const matchPeriod = (fechaStr) => { const f = parse(fechaStr); if (period === "año") return f.getFullYear() === selYear; const [y, m] = selMonth.split("-").map(Number); return f.getFullYear() === y && f.getMonth() === m - 1; };

  const onLogin = (s) => { setSesion(s); setSes(s); };
  const logout = () => { clearSesion(); setSes(null); setData(DEFAULT); setLoaded(false); setLoadError(null); setView("inicio"); firstSave.current = true; };

  /* load from API (only when logged in) */
  useEffect(() => {
    if (!sesion) return;
    firstSave.current = true;
    setLoaded(false); setLoadError(null);
    (async () => {
      try { const s = await cargarDatos(); if (s) setData({ ...DEFAULT, ...s }); }
      catch (e) {
        const msg = String(e.message || e);
        if (/inv[áa]lida|autoriz|sesi[óo]n/i.test(msg)) { logout(); return; }
        setLoadError(msg);
      }
      setLoaded(true);
    })();
  }, [sesion]);
  /* save to API (debounced) */
  useEffect(() => {
    if (!sesion || !loaded || loadError) return;
    if (firstSave.current) { firstSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSyncing(true);
      try { await guardarDatos(data); } catch (e) { /* se reintenta en el próximo cambio */ }
      setSyncing(false);
    }, 800);
  }, [data, loaded, loadError]);
  /* keep app height synced to the visible viewport (fixes keyboard leaving a gap) */
  useEffect(() => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    const setH = () => {
      const h = vv ? vv.height : window.innerHeight;
      document.documentElement.style.setProperty("--app-height", h + "px");
    };
    setH();
    if (vv) { vv.addEventListener("resize", setH); vv.addEventListener("scroll", setH); }
    window.addEventListener("resize", setH);
    window.addEventListener("orientationchange", setH);
    return () => {
      if (vv) { vv.removeEventListener("resize", setH); vv.removeEventListener("scroll", setH); }
      window.removeEventListener("resize", setH);
      window.removeEventListener("orientationchange", setH);
    };
  }, []);

  /* auto-create current month charges for occupied units and active deposits */
  useEffect(() => {
    if (!loaded) return;
    setData((prev) => {
      const per = currentPeriodo(); let changed = false; const cobros = [...prev.cobros];
      prev.inquilinos.filter((i) => !i.fechaRetiro).forEach((inq) => {
        if (!cobros.some((c) => c.tipo !== "deposito" && c.departamentoId === inq.departamentoId && c.periodo === per)) {
          cobros.push({ id: uid(), tipo: "alquiler", departamentoId: inq.departamentoId, inquilinoId: inq.id, depositoId: "", asignacionId: "", periodo: per, monto: inq.monto, vencimiento: vencimientoFor(per, inq.diaPago), inquilinoNombre: inq.nombre, pagos: [] });
          changed = true;
        }
      });
      prev.asignaciones.filter((a) => !a.fechaRetiro).forEach((a) => {
        if (!cobros.some((c) => c.tipo === "deposito" && c.asignacionId === a.id && c.periodo === per)) {
          const nom = prev.inquilinos.find((i) => i.departamentoId === a.departamentoId && !i.fechaRetiro)?.nombre || "";
          cobros.push({ id: uid(), tipo: "deposito", departamentoId: a.departamentoId, inquilinoId: "", depositoId: a.depositoId, asignacionId: a.id, periodo: per, monto: a.monto, vencimiento: vencimientoFor(per, a.diaPago), inquilinoNombre: nom, pagos: [] });
          changed = true;
        }
      });
      return changed ? { ...prev, cobros } : prev;
    });
  }, [loaded, data.inquilinos, data.asignaciones]);

  /* ----------------------------- mutations -------------------------------- */
  const upd = (fn) => setData((p) => fn({ ...p }));
  const saveDepto = (d) => upd((p) => {
    const ex = p.departamentos.find((x) => x.id === d.id);
    if (ex) p.departamentos = p.departamentos.map((x) => x.id === d.id ? { ...x, nombre: d.nombre } : x);
    else p.departamentos = [...p.departamentos, { id: d.id, nombre: d.nombre }];
    return p;
  });
  const delDepto = (id) => upd((p) => {
    p.departamentos = p.departamentos.filter((x) => x.id !== id);
    p.inquilinos = p.inquilinos.filter((i) => i.departamentoId !== id);
    p.cobros = p.cobros.filter((c) => c.departamentoId !== id);
    return p;
  });
  const ingresarInquilino = (deptId, inq) => {
    upd((p) => { p.inquilinos = [...p.inquilinos, { id: uid(), departamentoId: deptId, nombre: inq.nombre.trim(), monto: Number(inq.monto), diaPago: Number(inq.diaPago), fechaIngreso: inq.fechaIngreso || "", fechaRetiro: "" }]; return p; });
  };
  const editarInquilino = (inqId, campos) => upd((p) => {
    p.inquilinos = p.inquilinos.map((i) => i.id === inqId ? { ...i, nombre: campos.nombre.trim(), monto: Number(campos.monto), diaPago: Number(campos.diaPago), fechaIngreso: campos.fechaIngreso || "" } : i);
    return p;
  });
  const retirarInquilino = (inqId, fecha) => upd((p) => { p.inquilinos = p.inquilinos.map((i) => i.id === inqId ? { ...i, fechaRetiro: fecha } : i); return p; });
  const generarCobro = (deptId, periodo) => {
    const exist = data.cobros.find((c) => c.tipo !== "deposito" && c.departamentoId === deptId && c.periodo === periodo);
    if (exist) return exist.id;
    const inq = data.inquilinos.find((i) => i.departamentoId === deptId && !i.fechaRetiro);
    if (!inq) return null;
    const c = { id: uid(), tipo: "alquiler", departamentoId: deptId, inquilinoId: inq.id, depositoId: "", asignacionId: "", periodo, monto: inq.monto, vencimiento: vencimientoFor(periodo, inq.diaPago), inquilinoNombre: inq.nombre, pagos: [] };
    setData((p) => ({ ...p, cobros: [...p.cobros, c] }));
    return c.id;
  };
  /* ---- depósitos ---- */
  const asignacionActual = (depositoId) => data.asignaciones.find((a) => a.depositoId === depositoId && !a.fechaRetiro);
  const saveDeposito = (d) => upd((p) => {
    const ex = p.depositos.find((x) => x.id === d.id);
    if (ex) p.depositos = p.depositos.map((x) => x.id === d.id ? { ...x, nombre: d.nombre } : x);
    else p.depositos = [...p.depositos, { id: d.id, nombre: d.nombre }];
    return p;
  });
  const delDeposito = (id) => upd((p) => {
    p.depositos = p.depositos.filter((x) => x.id !== id);
    p.asignaciones = p.asignaciones.filter((a) => a.depositoId !== id);
    p.cobros = p.cobros.filter((c) => c.depositoId !== id);
    return p;
  });
  const asignarDeposito = (depositoId, campos) => upd((p) => {
    p.asignaciones = [...p.asignaciones, { id: uid(), depositoId, departamentoId: campos.departamentoId, monto: Number(campos.monto), diaPago: Number(campos.diaPago), fechaInicio: campos.fechaInicio || "", fechaRetiro: "" }];
    return p;
  });
  const editarAsignacion = (asigId, campos) => upd((p) => {
    p.asignaciones = p.asignaciones.map((a) => a.id === asigId ? { ...a, monto: Number(campos.monto), diaPago: Number(campos.diaPago), fechaInicio: campos.fechaInicio || "" } : a);
    return p;
  });
  const retirarAsignacion = (asigId, fecha) => upd((p) => { p.asignaciones = p.asignaciones.map((a) => a.id === asigId ? { ...a, fechaRetiro: fecha } : a); return p; });
  const generarCobroDeposito = (depositoId, periodo) => {
    const a = data.asignaciones.find((x) => x.depositoId === depositoId && !x.fechaRetiro);
    if (!a) return null;
    const exist = data.cobros.find((c) => c.tipo === "deposito" && c.asignacionId === a.id && c.periodo === periodo);
    if (exist) return exist.id;
    const nom = data.inquilinos.find((i) => i.departamentoId === a.departamentoId && !i.fechaRetiro)?.nombre || "";
    const c = { id: uid(), tipo: "deposito", departamentoId: a.departamentoId, inquilinoId: "", depositoId, asignacionId: a.id, periodo, monto: a.monto, vencimiento: vencimientoFor(periodo, a.diaPago), inquilinoNombre: nom, pagos: [] };
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
  const inquilinoActual = (deptId) => data.inquilinos.find((i) => i.departamentoId === deptId && !i.fechaRetiro);
  const ocupados = data.departamentos.filter((d) => inquilinoActual(d.id));
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
    data.cobros.forEach((c) => { if (c.tipo !== "deposito" && cobroEstado(c) === "pagado") { const k = c.inquilinoNombre || "—"; const a = cobroAtraso(c); if (!m[k]) m[k] = { nombre: k, total: 0, n: 0 }; m[k].total += a; m[k].n++; } });
    return Object.values(m).map((x) => ({ ...x, avg: x.total / x.n })).sort((a, b) => a.avg - b.avg);
  }, [data]);

  const alertas = useMemo(() => {
    const items = [];
    ocupados.forEach((d) => {
      const inq = inquilinoActual(d.id);
      const unpaid = data.cobros.filter((c) => c.tipo !== "deposito" && c.departamentoId === d.id && c.inquilinoId === inq.id && cobroEstado(c) !== "pagado").sort((a, b) => a.vencimiento < b.vencimiento ? -1 : 1);
      const base = { key: "d" + d.id, label: `${d.nombre} · ${inq.nombre}`, target: { type: "deptoDetail", id: d.id } };
      if (unpaid.length) { const c = unpaid[0]; items.push({ ...base, dias: daysBetween(todayStr(), c.vencimiento), venc: c.vencimiento, saldo: cobroSaldo(c), estado: cobroEstado(c) }); }
      else { const nd = nextDue(inq.diaPago); items.push({ ...base, dias: daysBetween(todayStr(), nd), venc: nd, saldo: inq.monto, estado: "al_dia" }); }
    });
    data.asignaciones.filter((a) => !a.fechaRetiro).forEach((a) => {
      const dep = data.depositos.find((x) => x.id === a.depositoId); if (!dep) return;
      const deptName = data.departamentos.find((x) => x.id === a.departamentoId)?.nombre || "";
      const inqName = inquilinoActual(a.departamentoId)?.nombre || "";
      const label = `${dep.nombre} · ${inqName}${deptName ? ` (${deptName})` : ""}`;
      const unpaid = data.cobros.filter((c) => c.tipo === "deposito" && c.asignacionId === a.id && cobroEstado(c) !== "pagado").sort((x, y) => x.vencimiento < y.vencimiento ? -1 : 1);
      const base = { key: "dep" + a.id, label, target: { type: "depositoDetail", id: a.depositoId } };
      if (unpaid.length) { const c = unpaid[0]; items.push({ ...base, dias: daysBetween(todayStr(), c.vencimiento), venc: c.vencimiento, saldo: cobroSaldo(c), estado: cobroEstado(c) }); }
      else { const nd = nextDue(a.diaPago); items.push({ ...base, dias: daysBetween(todayStr(), nd), venc: nd, saldo: a.monto, estado: "al_dia" }); }
    });
    return items.filter((a) => a.dias <= 7).sort((a, b) => a.dias - b.dias);
  }, [data]);

  const puntLabel = (avg) => {
    if (avg <= 0) return { txt: avg < -0.5 ? `paga ${Math.abs(Math.round(avg))} d antes` : "siempre puntual", color: C.income, bg: C.incomeSoft };
    if (avg <= 2) return { txt: `${avg.toFixed(1)} d de atraso`, color: C.primary, bg: C.primarySoft };
    if (avg <= 5) return { txt: `${avg.toFixed(1)} d de atraso`, color: C.amber, bg: C.amberSoft };
    return { txt: `${avg.toFixed(1)} d de atraso`, color: C.expense, bg: C.expenseSoft };
  };

  /* ------------------------------- nav ------------------------------------ */
  const NAV = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "deptos", label: "Dptos", icon: Building2 },
    { id: "ingresos", label: "Ingresos", icon: ArrowUpCircle },
    { id: "gastos", label: "Gastos", icon: ArrowDownCircle },
    { id: "ajustes", label: "Ajustes", icon: Settings },
  ];

  if (!sesion) return <Login onLogin={onLogin} />;
  if (!loaded) return <div style={{ fontFamily: FONT, background: C.bg }} className="min-h-screen flex items-center justify-center"><span style={{ color: C.sub }}>Cargando…</span></div>;
  if (loadError) return (
    <div style={{ fontFamily: FONT, background: C.bg, color: C.ink }} className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <div className="font-bold text-lg mb-2">No se pudo conectar con la base de datos</div>
        <div className="text-sm mb-4" style={{ color: C.sub }}>{loadError}</div>
        <div className="text-xs mb-4" style={{ color: C.sub }}>Revisa que en Vercel estén configuradas las variables APPSCRIPT_URL y APP_SECRET, y que la Web App de Apps Script esté publicada con acceso «Cualquier usuario».</div>
        <div className="flex gap-2 justify-center">
          <button onClick={() => location.reload()} className="rounded-xl px-4 py-2 text-sm font-semibold text-white" style={{ background: C.primary }}>Reintentar</button>
          <button onClick={logout} className="rounded-xl px-4 py-2 text-sm font-semibold" style={{ background: C.soft, color: C.sub }}>Cerrar sesión</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="app-shell flex flex-col" style={{ fontFamily: FONT, background: C.bg, color: C.ink, overflow: "hidden" }}>
      {/* franja safe-area superior (móvil) */}
      <div className="md:hidden shrink-0" style={{ paddingTop: "env(safe-area-inset-top)", background: C.surface, borderBottom: `1px solid ${C.line}` }} />
      {/* sidebar (desktop) */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 bottom-0 w-60 border-r px-3 py-5 z-30" style={{ background: C.surface, borderColor: C.line }}>
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: C.primary }}><Building2 size={20} color="#fff" /></div>
          <div><div className="font-bold leading-tight">Edificio Garland</div><div className="text-xs" style={{ color: C.sub }}>Control de alquileres</div></div>
        </div>
        {NAV.map((n) => { const A = n.icon; const on = view === n.id; return (
          <button key={n.id} onClick={() => setView(n.id)} className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-1 text-sm font-semibold transition" style={{ background: on ? C.primarySoft : "transparent", color: on ? C.primaryDk : C.sub }}>
            <A size={19} />{n.label}
          </button>
        ); })}
        <div className="mt-auto px-3 pt-3 border-t" style={{ borderColor: C.line }}>
          <div className="text-xs" style={{ color: C.sub }}>Sesión</div>
          <div className="text-sm font-semibold truncate">{sesion.nombre || sesion.usuario}</div>
        </div>
      </aside>

      {/* main (área scrollable) */}
      <main className="flex-1 overflow-y-auto md:ml-60" style={{ WebkitOverflowScrolling: "touch", overscrollBehavior: "contain" }}>
        <div className="max-w-3xl mx-auto px-4 md:px-8 pt-5 pb-8">
          {view === "inicio" && <Inicio />}
          {view === "deptos" && <Deptos />}
          {view === "ingresos" && <Ingresos />}
          {view === "gastos" && <Gastos />}
          {view === "ajustes" && <Configuracion />}
        </div>
      </main>

      {/* bottom nav (mobile) — estático, fuera del scroll, no se mueve */}
      <nav className="md:hidden flex border-t shrink-0 z-30" style={{ background: C.surface, borderColor: C.line, paddingBottom: "env(safe-area-inset-bottom)" }}>
        {NAV.map((n) => { const A = n.icon; const on = view === n.id; return (
          <button key={n.id} onClick={() => setView(n.id)} className="flex-1 flex flex-col items-center gap-0.5 py-2.5" style={{ color: on ? C.primary : C.sub }}>
            <A size={21} /><span className="text-[11px] font-semibold">{n.label}</span>
          </button>
        ); })}
      </nav>

      {syncing && <div className="fixed z-50 bottom-20 md:bottom-4 right-4 rounded-full px-3 py-1.5 text-xs font-semibold shadow" style={{ background: C.surface, border: `1px solid ${C.line}`, color: C.sub }}>Guardando…</div>}
      <UpdateCard />
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

        <button onClick={() => setModal({ type: "historial" })} className="w-full flex items-center gap-3 rounded-2xl px-4 py-3 mb-5 text-left" style={{ background: C.surface, border: `1px solid ${C.line}` }}>
          <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: C.primarySoft }}><Users size={18} color={C.primary} /></div>
          <div className="flex-1"><div className="font-semibold">Historial de Inquilinos</div><div className="text-xs" style={{ color: C.sub }}>Quién vivió en cada departamento y sus pagos</div></div>
          <ChevronRight size={18} color={C.sub} />
        </button>

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
                  <button key={a.key} onClick={() => setModal(a.target)} className="w-full flex items-center gap-3 px-4 py-3 text-left" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                    <CalendarClock size={20} color={col} />
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{a.label}</div>
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
    const esDep = deptoTab === "depositos";
    return (
      <>
        <Header title={esDep ? "Depósitos" : "Departamentos"} onAdd={() => setModal({ type: esDep ? "depositoForm" : "deptoForm" })} addLabel="Nuevo" />
        <div className="flex gap-1 p-1 rounded-xl mb-4 w-full md:w-auto md:inline-flex" style={{ background: C.soft, border: `1px solid ${C.line}` }}>
          {[["deptos", "Departamentos"], ["depositos", "Depósitos"]].map(([k, l]) => (
            <button key={k} onClick={() => setDeptoTab(k)} className="flex-1 md:flex-none rounded-lg px-4 py-1.5 text-sm font-semibold transition" style={{ background: deptoTab === k ? C.surface : "transparent", color: deptoTab === k ? C.ink : C.sub, boxShadow: deptoTab === k ? "0 1px 2px rgba(0,0,0,.06)" : "none" }}>{l}</button>
          ))}
        </div>

        {!esDep ? (
          data.departamentos.length === 0 ? (
            <Empty icon={Building2} title="Crea tu primer departamento" sub="Solo registra el nombre. El inquilino se agrega después con el botón Ingreso." />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {data.departamentos.map((d) => {
                const inq = inquilinoActual(d.id);
                const cur = data.cobros.find((c) => c.tipo !== "deposito" && c.departamentoId === d.id && c.periodo === currentPeriodo());
                const est = cur ? cobroEstado(cur) : "pendiente";
                return (
                  <button key={d.id} onClick={() => setModal({ type: "deptoDetail", id: d.id })} className="text-left">
                    <Card className="p-4 h-full">
                      <div className="flex items-start justify-between mb-2">
                        <div><div className="font-bold text-lg">{d.nombre}</div><div className="text-sm" style={{ color: C.sub }}>{inq ? inq.nombre : "Desalojado"}</div></div>
                        {inq ? estadoPill(est) : <Pill color={C.sub} bg={C.soft}>Desalojado</Pill>}
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: C.line }}>
                        <span style={{ color: C.sub }}>{inq ? "Alquiler" : "Sin inquilino"}</span>
                        <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{inq ? `${money(inq.monto)} · día ${inq.diaPago}` : "—"}</span>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          data.depositos.length === 0 ? (
            <Empty icon={Building2} title="Crea tu primer depósito" sub="Regístralo solo con un nombre. Luego lo asignas a un departamento con Ingreso." />
          ) : (
            <div className="grid md:grid-cols-2 gap-3">
              {data.depositos.map((dep) => {
                const a = asignacionActual(dep.id);
                const deptName = a ? (data.departamentos.find((x) => x.id === a.departamentoId)?.nombre || "") : "";
                const inqName = a ? (inquilinoActual(a.departamentoId)?.nombre || "—") : "";
                const cur = a ? data.cobros.find((c) => c.tipo === "deposito" && c.asignacionId === a.id && c.periodo === currentPeriodo()) : null;
                const est = cur ? cobroEstado(cur) : "pendiente";
                return (
                  <button key={dep.id} onClick={() => setModal({ type: "depositoDetail", id: dep.id })} className="text-left">
                    <Card className="p-4 h-full">
                      <div className="flex items-start justify-between mb-2">
                        <div><div className="font-bold text-lg">{dep.nombre}</div><div className="text-sm" style={{ color: C.sub }}>{a ? `${inqName} · ${deptName}` : "Libre"}</div></div>
                        {a ? estadoPill(est) : <Pill color={C.sub} bg={C.soft}>Libre</Pill>}
                      </div>
                      <div className="flex justify-between text-sm pt-2 border-t" style={{ borderColor: C.line }}>
                        <span style={{ color: C.sub }}>{a ? "Depósito" : "Sin asignar"}</span>
                        <span className="font-semibold" style={{ fontVariantNumeric: "tabular-nums" }}>{a ? `${money(a.monto)} · día ${a.diaPago}` : "—"}</span>
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )
        )}
      </>
    );
  }

  function Ingresos() {
    const lista = useMemo(() => {
      const r = [];
      data.cobros.forEach((c) => {
        const dep = data.departamentos.find((d) => d.id === c.departamentoId);
        const esDep = c.tipo === "deposito";
        const depo = esDep ? data.depositos.find((x) => x.id === c.depositoId) : null;
        c.pagos.forEach((pg) => r.push({
          tipo: "alquiler", fecha: pg.fecha, monto: pg.monto,
          t1: esDep ? `${depo?.nombre || "Depósito"} · ${c.inquilinoNombre}` : `${dep?.nombre || "Depto"} · ${c.inquilinoNombre}`,
          t2: `${esDep ? "Depósito" : "Alquiler"} ${periodoLabel(c.periodo)}`,
          key: pg.id, cobroId: c.id, pagoId: pg.id
        }));
      });
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
  function Configuracion() {
    return (
      <>
        <h1 className="text-2xl font-extrabold tracking-tight mb-4">Ajustes</h1>
        <Card className="p-4 mb-3">
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: C.sub }}>Sesión iniciada</div>
          <div className="font-bold text-lg">{sesion.nombre || sesion.usuario}</div>
          {sesion.usuario && <div className="text-sm" style={{ color: C.sub }}>Usuario: {sesion.usuario}</div>}
        </Card>
        <button onClick={logout} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white" style={{ background: C.expense }}>
          <LogOut size={18} /> Cerrar sesión
        </button>
        <div className="text-xs text-center mt-3" style={{ color: C.sub }}>Mientras no cierres sesión, seguirás dentro aunque cierres o recargues la ventana.</div>
        <div className="text-xs text-center mt-4" style={{ color: C.sub }}>Edificio Garland · {APP_VERSION}</div>
      </>
    );
  }

  function DepositoForm({ dep }) {
    const [nombre, setNombre] = useState(dep ? dep.nombre : "");
    const ok = nombre.trim();
    return (
      <Modal title={dep ? "Editar depósito" : "Nuevo depósito"} onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => {
          if (dep && !confirm("¿Seguro que deseas guardar estos cambios?")) return;
          saveDeposito({ id: dep ? dep.id : uid(), nombre: nombre.trim() }); setModal(dep ? { type: "depositoDetail", id: dep.id } : null);
        }}>Guardar</PrimaryBtn></>}>
        <Field label="Nombre del depósito"><input style={inputStyle} autoFocus value={nombre} placeholder="Ej. Deposito 1" onChange={(e) => setNombre(e.target.value)} /></Field>
        <div className="text-xs mb-3" style={{ color: C.sub }}>Luego lo asignas a un departamento con el botón Ingreso.</div>
        {dep && <button onClick={() => { if (confirm("¿Eliminar este depósito, su asignación y sus cobros?")) { delDeposito(dep.id); setModal(null); } }} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: C.red }}><Trash2 size={15} /> Eliminar depósito</button>}
      </Modal>
    );
  }

  function DepositoDetail({ id }) {
    const dep = data.depositos.find((x) => x.id === id);
    if (!dep) { setModal(null); return null; }
    const a = asignacionActual(id);
    const deptName = a ? (data.departamentos.find((x) => x.id === a.departamentoId)?.nombre || "") : "";
    const inqName = a ? (inquilinoActual(a.departamentoId)?.nombre || "—") : "";
    const cobros = a ? data.cobros.filter((c) => c.tipo === "deposito" && c.asignacionId === a.id).sort((x, y) => x.periodo < y.periodo ? 1 : -1) : [];
    const footer = a
      ? <><GhostBtn onClick={() => setModal({ type: "editAsignacion", asigId: a.id, depositoId: id })}>Editar</GhostBtn>
          <button onClick={() => setModal({ type: "retiroDeposito", asigId: a.id, depositoId: id })} className="rounded-xl py-2.5 px-4 font-semibold text-sm" style={{ color: C.expense, background: C.expenseSoft }}>Retiro</button>
          <PrimaryBtn onClick={() => { const c = generarCobroDeposito(id, currentPeriodo()); setModal({ type: "pagoForm", cobroId: c }); }}>Pagó</PrimaryBtn></>
      : <><GhostBtn onClick={() => setModal({ type: "depositoForm", dep })}>Editar</GhostBtn><PrimaryBtn onClick={() => setModal({ type: "asignarDeposito", depositoId: id })}>Ingreso</PrimaryBtn></>;
    return (
      <Modal title={dep.nombre} onClose={() => setModal(null)} footer={footer}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold">{a ? `${inqName} · ${deptName}` : "Libre"}</span>
          {a ? <Pill color={C.income} bg={C.incomeSoft}>Ocupado</Pill> : <Pill color={C.sub} bg={C.soft}>Libre</Pill>}
        </div>
        {a ? (
          <>
            <div className="text-sm mb-3" style={{ color: C.sub }}>{money(a.monto)} mensual · vence el día {a.diaPago}{a.fechaInicio ? ` · desde ${fmtDate(a.fechaInicio)}` : ""}</div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.sub }}>Historial de cobros</div>
            {cobros.length === 0 && <div className="text-sm" style={{ color: C.sub }}>Aún no hay cobros generados.</div>}
            {cobros.map((c) => <CobroRow key={c.id} c={c} onPay={() => setModal({ type: "pagoForm", cobroId: c.id })} />)}
          </>
        ) : (
          <div className="text-sm py-2" style={{ color: C.sub }}>Este depósito está libre. Usa <b>Ingreso</b> para asignarlo a un departamento.</div>
        )}
      </Modal>
    );
  }

  function AsignarDepositoForm({ depositoId }) {
    const dep = data.depositos.find((x) => x.id === depositoId);
    const [departamentoId, setDep] = useState(ocupados[0]?.id || "");
    const [monto, setMonto] = useState("");
    const [diaPago, setDiaPago] = useState(5);
    const [fechaInicio, setFechaInicio] = useState(todayStr());
    const inqName = inquilinoActual(departamentoId)?.nombre || "";
    const ok = departamentoId && Number(monto) > 0;
    return (
      <Modal title="Asignar depósito" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => { asignarDeposito(depositoId, { departamentoId, monto, diaPago, fechaInicio }); setModal({ type: "depositoDetail", id: depositoId }); }}>Guardar</PrimaryBtn></>}>
        <div className="text-sm mb-3" style={{ color: C.sub }}>{dep?.nombre}</div>
        {ocupados.length === 0 ? (
          <div className="text-sm" style={{ color: C.sub }}>No hay departamentos ocupados. Primero registra un inquilino en un departamento.</div>
        ) : (
          <>
            <Field label="Departamento (inquilino actual)">
              <select style={inputStyle} value={departamentoId} onChange={(e) => setDep(e.target.value)}>
                {ocupados.map((d) => <option key={d.id} value={d.id}>{d.nombre} · {inquilinoActual(d.id)?.nombre}</option>)}
              </select>
            </Field>
            <div className="text-xs mb-3" style={{ color: C.sub }}>El depósito quedará a nombre de: <b>{inqName || "—"}</b></div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Monto de pago (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} placeholder="0.00" onChange={(e) => setMonto(e.target.value)} /></Field>
              <Field label="Día de pago"><select style={inputStyle} value={diaPago} onChange={(e) => setDiaPago(Number(e.target.value))}>{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{pad(n)}</option>)}</select></Field>
            </div>
            <Field label="Fecha de inicio de uso"><input style={inputStyle} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Field>
          </>
        )}
      </Modal>
    );
  }

  function EditAsignacionForm({ asigId, depositoId }) {
    const a = data.asignaciones.find((x) => x.id === asigId);
    const [monto, setMonto] = useState(a ? String(a.monto) : "");
    const [diaPago, setDiaPago] = useState(a?.diaPago || 5);
    const [fechaInicio, setFechaInicio] = useState(a?.fechaInicio || "");
    const ok = Number(monto) > 0;
    return (
      <Modal title="Editar depósito" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => { if (!confirm("¿Seguro que deseas guardar estos cambios?")) return; editarAsignacion(asigId, { monto, diaPago, fechaInicio }); setModal({ type: "depositoDetail", id: depositoId }); }}>Guardar</PrimaryBtn></>}>
        <div className="text-xs mb-3" style={{ color: C.sub }}>Para cambiar de departamento, primero registra el retiro del depósito.</div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto de pago (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
          <Field label="Día de pago"><select style={inputStyle} value={diaPago} onChange={(e) => setDiaPago(Number(e.target.value))}>{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{pad(n)}</option>)}</select></Field>
        </div>
        <Field label="Fecha de inicio de uso"><input style={inputStyle} type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} /></Field>
      </Modal>
    );
  }

  function RetiroDepositoForm({ asigId, depositoId }) {
    const [fecha, setFecha] = useState(todayStr());
    return (
      <Modal title="Retiro de depósito" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn>
          <button onClick={() => { if (!confirm("¿Seguro que deseas registrar el retiro del depósito?")) return; retirarAsignacion(asigId, fecha); setModal({ type: "depositoDetail", id: depositoId }); }} className="flex-1 rounded-xl py-2.5 font-semibold text-white text-sm" style={{ background: C.expense }}>Confirmar retiro</button></>}>
        <Field label="Fecha de salida"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <div className="text-xs" style={{ color: C.sub }}>Sus cobros y pagos se conservan. El depósito quedará libre para una nueva asignación.</div>
      </Modal>
    );
  }

  function renderModal() {
    if (modal.type === "deptoForm") return <DeptoForm dept={modal.dept} />;
    if (modal.type === "deptoDetail") return <DeptoDetail id={modal.id} />;
    if (modal.type === "ingresoInquilino") return <IngresoInquilinoForm deptId={modal.deptId} />;
    if (modal.type === "editInquilino") return <EditInquilinoForm inqId={modal.inqId} deptId={modal.deptId} />;
    if (modal.type === "retiro") return <RetiroForm inqId={modal.inqId} deptId={modal.deptId} />;
    if (modal.type === "gastoForm") return <GastoForm />;
    if (modal.type === "ingresoForm") return <IngresoForm />;
    if (modal.type === "pagoForm") return <PagoForm cobroId={modal.cobroId} />;
    if (modal.type === "historial") return <HistorialInquilinos />;
    if (modal.type === "inquilinoHist") return <InquilinoHistorial inqId={modal.inqId} back={modal.back} />;
    if (modal.type === "depositoForm") return <DepositoForm dep={modal.dep} />;
    if (modal.type === "depositoDetail") return <DepositoDetail id={modal.id} />;
    if (modal.type === "asignarDeposito") return <AsignarDepositoForm depositoId={modal.depositoId} />;
    if (modal.type === "editAsignacion") return <EditAsignacionForm asigId={modal.asigId} depositoId={modal.depositoId} />;
    if (modal.type === "retiroDeposito") return <RetiroDepositoForm asigId={modal.asigId} depositoId={modal.depositoId} />;
    return null;
  }

  function DeptoForm({ dept }) {
    const [nombre, setNombre] = useState(dept ? dept.nombre : "");
    const ok = nombre.trim();
    return (
      <Modal title={dept ? "Editar departamento" : "Nuevo departamento"} onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => {
          if (dept && !confirm("¿Seguro que deseas guardar estos cambios?")) return;
          saveDepto({ id: dept ? dept.id : uid(), nombre: nombre.trim() }); setModal(null);
        }}>Guardar</PrimaryBtn></>}>
        <Field label="Nombre del departamento"><input style={inputStyle} autoFocus value={nombre} placeholder="Ej. Depto 101" onChange={(e) => setNombre(e.target.value)} /></Field>
        <div className="text-xs mb-3" style={{ color: C.sub }}>El inquilino se agrega después con el botón Ingreso.</div>
        {dept && <button onClick={() => { if (confirm("¿Eliminar este departamento, su inquilino actual y sus cobros?")) { delDepto(dept.id); setModal(null); } }} className="text-sm font-semibold flex items-center gap-1.5" style={{ color: C.red }}><Trash2 size={15} /> Eliminar departamento</button>}
      </Modal>
    );
  }

  function DeptoDetail({ id }) {
    const d = data.departamentos.find((x) => x.id === id);
    if (!d) { setModal(null); return null; }
    const inq = inquilinoActual(id);
    const cobros = data.cobros.filter((c) => c.departamentoId === id && (inq ? c.inquilinoId === inq.id : false)).sort((a, b) => a.periodo < b.periodo ? 1 : -1);
    const punt = inq ? puntualidad.find((p) => p.nombre === inq.nombre) : null;
    const footer = inq
      ? <><GhostBtn onClick={() => setModal({ type: "editInquilino", inqId: inq.id, deptId: id })}>Editar</GhostBtn>
          <button onClick={() => setModal({ type: "retiro", inqId: inq.id, deptId: id })} className="rounded-xl py-2.5 px-4 font-semibold text-sm" style={{ color: C.expense, background: C.expenseSoft }}>Retiro</button>
          <PrimaryBtn onClick={() => { const c = generarCobro(id, currentPeriodo()); setModal({ type: "pagoForm", cobroId: c }); }}>Pagó</PrimaryBtn></>
      : <><GhostBtn onClick={() => setModal({ type: "deptoForm", dept: d })}>Editar</GhostBtn><PrimaryBtn onClick={() => setModal({ type: "ingresoInquilino", deptId: id })}>Ingreso</PrimaryBtn></>;
    return (
      <Modal title={d.nombre} onClose={() => setModal(null)} footer={footer}>
        <div className="flex items-center justify-between mb-1">
          <span className="font-semibold">{inq ? inq.nombre : "Desalojado"}</span>
          {inq ? <Pill color={C.income} bg={C.incomeSoft}>Ocupado</Pill> : <Pill color={C.sub} bg={C.soft}>Desalojado</Pill>}
        </div>
        {inq ? (
          <>
            <div className="text-sm mb-3" style={{ color: C.sub }}>{money(inq.monto)} mensual · vence el día {inq.diaPago}{inq.fechaIngreso ? ` · desde ${fmtDate(inq.fechaIngreso)}` : ""}{punt && ` · ${puntLabel(punt.avg).txt}`}</div>
            <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.sub }}>Historial de cobros</div>
            {cobros.length === 0 && <div className="text-sm" style={{ color: C.sub }}>Aún no hay cobros generados.</div>}
            {cobros.map((c) => <CobroRow key={c.id} c={c} onPay={() => setModal({ type: "pagoForm", cobroId: c.id })} />)}
          </>
        ) : (
          <div className="text-sm py-2" style={{ color: C.sub }}>Este departamento está desalojado. Usa <b>Ingreso</b> para registrar un nuevo inquilino.</div>
        )}
      </Modal>
    );
  }

  function CobroRow({ c, onPay }) {
    const est = cobroEstado(c), saldo = cobroSaldo(c), atr = cobroAtraso(c);
    return (
      <div className="rounded-xl p-3 mb-2" style={{ background: C.soft }}>
        <div className="flex items-center justify-between"><span className="font-semibold">{periodoLabel(c.periodo)}</span>{estadoPill(est)}</div>
        <div className="text-xs mt-0.5" style={{ color: C.sub }}>
          Vence {fmtDate(c.vencimiento)} · {money(sumPagos(c))} de {money(c.monto)}
          {est === "pagado" && atr != null && (atr <= 0 ? " · pagó puntual" : ` · pagó ${atr} d tarde`)}
          {est !== "pagado" && ` · saldo ${money(saldo)}`}
        </div>
        {c.pagos.length > 0 && <div className="mt-2 space-y-1">{c.pagos.map((pg) => (
          <div key={pg.id} className="flex items-center justify-between text-xs"><span style={{ color: C.sub }}>{fmtDate(pg.fecha)}</span><span className="flex items-center gap-2"><b style={{ color: C.income }}>+{money(pg.monto)}</b><button onClick={() => delPago(c.id, pg.id)}><Trash2 size={13} color={C.sub} /></button></span></div>
        ))}</div>}
        {est !== "pagado" && onPay && <button onClick={onPay} className="text-xs font-semibold mt-2" style={{ color: C.primary }}>+ Registrar pago</button>}
      </div>
    );
  }

  function IngresoInquilinoForm({ deptId }) {
    const d = data.departamentos.find((x) => x.id === deptId);
    const [nombre, setNombre] = useState("");
    const [monto, setMonto] = useState("");
    const [diaPago, setDiaPago] = useState(5);
    const [fechaIngreso, setFechaIngreso] = useState(todayStr());
    const ok = nombre.trim() && Number(monto) > 0;
    return (
      <Modal title="Ingreso de inquilino" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => { ingresarInquilino(deptId, { nombre, monto, diaPago, fechaIngreso }); setModal({ type: "deptoDetail", id: deptId }); }}>Guardar</PrimaryBtn></>}>
        <div className="text-sm mb-3" style={{ color: C.sub }}>{d?.nombre}</div>
        <Field label="Nombre del inquilino"><input style={inputStyle} autoFocus value={nombre} placeholder="Nombre y apellido" onChange={(e) => setNombre(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto de pago (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} placeholder="0.00" onChange={(e) => setMonto(e.target.value)} /></Field>
          <Field label="Día de pago"><select style={inputStyle} value={diaPago} onChange={(e) => setDiaPago(Number(e.target.value))}>{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{pad(n)}</option>)}</select></Field>
        </div>
        <Field label="Fecha de ingreso"><input style={inputStyle} type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} /></Field>
      </Modal>
    );
  }

  function EditInquilinoForm({ inqId, deptId }) {
    const inq = data.inquilinos.find((x) => x.id === inqId);
    const [nombre, setNombre] = useState(inq?.nombre || "");
    const [monto, setMonto] = useState(inq ? String(inq.monto) : "");
    const [diaPago, setDiaPago] = useState(inq?.diaPago || 5);
    const [fechaIngreso, setFechaIngreso] = useState(inq?.fechaIngreso || "");
    const ok = nombre.trim() && Number(monto) > 0;
    return (
      <Modal title="Editar inquilino" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn><PrimaryBtn disabled={!ok} onClick={() => { if (!confirm("¿Seguro que deseas guardar estos cambios?")) return; editarInquilino(inqId, { nombre, monto, diaPago, fechaIngreso }); setModal({ type: "deptoDetail", id: deptId }); }}>Guardar</PrimaryBtn></>}>
        <Field label="Nombre del inquilino"><input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto de pago (S/)"><input style={inputStyle} type="number" inputMode="decimal" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
          <Field label="Día de pago"><select style={inputStyle} value={diaPago} onChange={(e) => setDiaPago(Number(e.target.value))}>{Array.from({ length: 31 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{pad(n)}</option>)}</select></Field>
        </div>
        <Field label="Fecha de ingreso"><input style={inputStyle} type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} /></Field>
      </Modal>
    );
  }

  function RetiroForm({ inqId, deptId }) {
    const inq = data.inquilinos.find((x) => x.id === inqId);
    const [fecha, setFecha] = useState(todayStr());
    return (
      <Modal title="Retiro de inquilino" onClose={() => setModal(null)}
        footer={<><GhostBtn onClick={() => setModal(null)}>Cancelar</GhostBtn>
          <button onClick={() => { if (!confirm("¿Seguro que deseas registrar el retiro? El departamento quedará desalojado.")) return; retirarInquilino(inqId, fecha); setModal({ type: "deptoDetail", id: deptId }); }} className="flex-1 rounded-xl py-2.5 font-semibold text-white text-sm" style={{ background: C.expense }}>Confirmar retiro</button></>}>
        <div className="text-sm mb-3" style={{ color: C.sub }}>{inq?.nombre}</div>
        <Field label="Fecha de salida"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field>
        <div className="text-xs" style={{ color: C.sub }}>Sus cobros y pagos se conservan en el historial. El departamento quedará disponible para un nuevo ingreso.</div>
      </Modal>
    );
  }

  function HistorialInquilinos() {
    const [deptId, setDeptId] = useState(data.departamentos[0]?.id || "");
    const lista = data.inquilinos.filter((i) => i.departamentoId === deptId).sort((a, b) => {
      if (!a.fechaRetiro && b.fechaRetiro) return -1;
      if (a.fechaRetiro && !b.fechaRetiro) return 1;
      const ka = a.fechaRetiro || a.fechaIngreso || "", kb = b.fechaRetiro || b.fechaIngreso || "";
      return ka < kb ? 1 : -1;
    });
    return (
      <Modal title="Historial de Inquilinos" onClose={() => setModal(null)}>
        <Field label="Departamento">
          <select style={inputStyle} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
            {data.departamentos.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
          </select>
        </Field>
        {lista.length === 0 ? (
          <div className="text-sm text-center py-4" style={{ color: C.sub }}>Sin inquilinos registrados en este departamento.</div>
        ) : lista.map((i) => (
          <button key={i.id} onClick={() => setModal({ type: "inquilinoHist", inqId: i.id, back: { type: "historial" } })} className="w-full text-left rounded-xl p-3 mb-2 flex items-center gap-3" style={{ background: C.soft }}>
            <div className="flex-1 min-w-0">
              <div className="font-semibold truncate">{i.nombre}</div>
              <div className="text-xs" style={{ color: C.sub }}>{i.fechaIngreso ? fmtDate(i.fechaIngreso) : "inicio no registrado"} → {i.fechaRetiro ? fmtDate(i.fechaRetiro) : "presente"}</div>
            </div>
            {!i.fechaRetiro && <Pill color={C.income} bg={C.incomeSoft}>Actual</Pill>}
            <ChevronRight size={18} color={C.sub} />
          </button>
        ))}
      </Modal>
    );
  }

  function InquilinoHistorial({ inqId, back }) {
    const inq = data.inquilinos.find((x) => x.id === inqId);
    if (!inq) { setModal(null); return null; }
    const cobros = data.cobros.filter((c) => c.inquilinoId === inqId).sort((a, b) => a.periodo < b.periodo ? 1 : -1);
    const totalPagado = cobros.reduce((s, c) => s + sumPagos(c), 0);
    return (
      <Modal title={inq.nombre} onClose={() => setModal(null)}
        footer={<GhostBtn onClick={() => setModal(back || null)}>← Volver</GhostBtn>}>
        <div className="text-sm mb-3" style={{ color: C.sub }}>{inq.fechaIngreso ? fmtDate(inq.fechaIngreso) : "inicio no registrado"} → {inq.fechaRetiro ? fmtDate(inq.fechaRetiro) : "presente"} · total pagado {money(totalPagado)}</div>
        <div className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: C.sub }}>Cobros y pagos</div>
        {cobros.length === 0 ? (
          <div className="text-sm" style={{ color: C.sub }}>No hay cobros registrados para este inquilino.</div>
        ) : cobros.map((c) => <CobroRow key={c.id} c={c} onPay={!inq.fechaRetiro ? () => setModal({ type: "pagoForm", cobroId: c.id }) : null} />)}
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
            {data.departamentos.map((d) => { const gi = inquilinoActual(d.id); return <option key={d.id} value={d.id}>{d.nombre}{gi ? ` · ${gi.nombre}` : ""}</option>; })}
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
    const [deptId, setDeptId] = useState(ocupados[0]?.id || "");
    const [mes, setMes] = useState(currentPeriodo());
    const [monto, setMonto] = useState("");
    const [fecha, setFecha] = useState(todayStr());
    // otro fields
    const [concepto, setConcepto] = useState("");

    const esAlquiler = categoriaId === "alquiler" && !creando;
    const dep = data.departamentos.find((x) => x.id === deptId);
    const inqDep = dep ? inquilinoActual(dep.id) : null;
    const cobroExist = data.cobros.find((c) => c.departamentoId === deptId && c.periodo === mes);
    const saldoSugerido = cobroExist ? cobroSaldo(cobroExist) : (inqDep ? inqDep.monto : 0);

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
          ocupados.length === 0 ? (
            <div className="text-sm" style={{ color: C.sub }}>No hay departamentos ocupados. Registra un inquilino con el botón Ingreso en la pestaña Departamentos.</div>
          ) : (
            <>
              <Field label="Inquilino / departamento">
                <select style={inputStyle} value={deptId} onChange={(e) => setDeptId(e.target.value)}>
                  {ocupados.map((d) => <option key={d.id} value={d.id}>{d.nombre} · {inquilinoActual(d.id)?.nombre}</option>)}
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
