import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

// Estado en memoria
let clientes = [];
let servicios = [];          // vista "agenda" (servicio + datos del cliente)
let vistaActual = "dashboard";
let filtroPeriodo = "semana";
let filtroEstado = "";
let textoBusqueda = "";

// ================= Utilidades =================
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.add("hidden"), 2600);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtHora = (f) => new Date(f).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const mayus = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fmtDia = (f) => new Date(f).toLocaleDateString("es-BO", { weekday: "long", day: "numeric", month: "long" });
const fmtCorto = (f) => new Date(f).toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" });
const bs = (n) => `${Number(n || 0).toLocaleString("es-BO", { maximumFractionDigits: 0 })}`;
const inicioDia = (d = new Date()) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const inicioMes = (d = new Date(), delta = 0) => new Date(d.getFullYear(), d.getMonth() + delta, 1);
const mismoDia = (a, b) => inicioDia(a).getTime() === inicioDia(b).getTime();
const activo = (s) => s.estado !== "cancelado";
const pendiente = (s) => s.estado === "pendiente" || s.estado === "confirmado";

function aInputLocal(fecha) {
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function soloNumeros(tel) {
  let n = String(tel ?? "").replace(/\D/g, "");
  if (n.length === 8) n = "591" + n; // celular boliviano
  return n;
}
function iniciales(nombre) {
  return String(nombre || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}
function claseTipo(tipo = "") {
  const t = tipo.toLowerCase();
  if (t.includes("rat")) return "t-rat";
  if (t.includes("termit")) return "t-ter";
  if (t.includes("insect")) return "t-ins";
  if (t.includes("desinf")) return "t-des";
  return "t-fum";
}
function cuandoFalta(fecha) {
  const min = Math.round((new Date(fecha) - new Date()) / 60000);
  if (min < 0) return "En curso / atrasado";
  if (min < 60) return `En ${min} min`;
  if (mismoDia(fecha, new Date())) return `Hoy en ${Math.round(min / 60)} h`;
  if (mismoDia(fecha, sumarDias(new Date(), 1))) return "Mañana";
  return `En ${Math.ceil((inicioDia(fecha) - inicioDia()) / 86400000)} días`;
}

// Enlaces útiles
function linkWhatsApp(s) {
  const tel = soloNumeros(s.telefono);
  if (!tel) return "";
  const txt = `Hola ${s.cliente}, le confirmamos su servicio de ${s.tipo_servicio} el ${fmtDia(s.fecha_hora)} a las ${fmtHora(s.fecha_hora)}. FumiHouse - Expertos en fumigación.`;
  return `https://wa.me/${tel}?text=${encodeURIComponent(txt)}`;
}
function linkGoogleCalendar(s) {
  const f = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const ini = new Date(s.fecha_hora);
  const fin = new Date(ini.getTime() + 90 * 60_000);
  const detalle = [
    s.telefono ? "Tel: " + s.telefono : "",
    s.plaga ? "Plaga: " + s.plaga : "",
    s.producto ? "Producto: " + s.producto : "",
    s.precio != null ? "Precio: " + s.precio + " Bs" : "",
    s.notas ?? "",
  ].filter(Boolean).join("\n");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: `${s.tipo_servicio} - ${s.cliente}`,
    dates: `${f(ini)}/${f(fin)}`,
    details: detalle,
    location: [s.direccion, s.zona].filter(Boolean).join(", "),
  });
  return "https://calendar.google.com/calendar/render?" + q.toString();
}

const ICO = {
  flecha: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M8 7h9v9"/></svg>',
  tel: '<svg viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2"/></svg>',
  wa: '<svg viewBox="0 0 24 24"><path d="M3 21l1.6-4.8A8.5 8.5 0 1112 20.5a8.4 8.4 0 01-4.2-1.1z"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M16 3v4M8 3v4M3 10h18M12 13v5M9.5 15.5h5"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>',
  check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  cash: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="13" rx="3"/><circle cx="12" cy="12.5" r="2.5"/></svg>',
  mas: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
};

// ================= Sesión =================
async function iniciar() {
  $("fecha-hoy").textContent = mayus(fmtDia(new Date()));
  const { data } = await sb.auth.getSession();
  mostrarVista(data.session);
  sb.auth.onAuthStateChange((_e, session) => mostrarVista(session));
}

function mostrarVista(session) {
  const logueado = !!session;
  $("vista-login").classList.toggle("hidden", logueado);
  $("vista-app").classList.toggle("hidden", !logueado);
  if (logueado) {
    const email = session.user?.email ?? "";
    $("usuario-email").textContent = email;
    $("avatar").textContent = (email[0] || "F").toUpperCase();
    cargarTodo();
  }
}

$("form-login").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("login-error").textContent = "";
  const { error } = await sb.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-pass").value,
  });
  if (error) {
    console.error(error);
    $("login-error").textContent = error.message === "Invalid login credentials"
      ? "Correo o contraseña incorrectos"
      : "Error: " + error.message;
  }
});
$("btn-salir").addEventListener("click", () => sb.auth.signOut());

// ================= Datos =================
async function cargarTodo() {
  const [c, s] = await Promise.all([
    sb.from("clientes").select("*").order("nombre"),
    sb.from("agenda").select("*").order("fecha_hora"),
  ]);
  if (c.error || s.error) return toast("Error al cargar: " + (c.error || s.error).message);
  clientes = c.data;
  servicios = s.data;
  pintarTodo();
}

function pintarTodo() {
  const hoy = servicios.filter((s) => pendiente(s) && mismoDia(s.fecha_hora, new Date())).length;
  const b = $("badge-hoy");
  b.textContent = hoy;
  b.classList.toggle("hidden", !hoy);
  pintarDashboard();
  pintarAgenda();
  pintarClientes();
  pintarCobros();
}

// ================= Navegación =================
function irA(vista) {
  vistaActual = vista;
  document.querySelectorAll(".vista").forEach((v) => v.classList.toggle("hidden", v.id !== "vista-" + vista));
  document.querySelectorAll("[data-vista]").forEach((b) => b.classList.toggle("activo", b.dataset.vista === vista));
  window.scrollTo({ top: 0 });
}
document.querySelectorAll("[data-vista]").forEach((b) => b.addEventListener("click", () => irA(b.dataset.vista)));
document.addEventListener("click", (e) => {
  const ir = e.target.closest("[data-ir]");
  if (ir) {
    if (ir.dataset.periodo) setPeriodo(ir.dataset.periodo);
    if (ir.dataset.ir === "agenda") setEstado(ir.dataset.estado ?? "");
    irA(ir.dataset.ir);
  }
  if (e.target.closest("[data-nuevo-servicio]")) nuevoServicio();
  if (e.target.closest("[data-nuevo-cliente]")) abrirCliente(null);
});

$("buscar").addEventListener("input", (e) => {
  textoBusqueda = e.target.value.trim().toLowerCase();
  if (vistaActual === "dashboard" && textoBusqueda) { setPeriodo("todos"); irA("agenda"); }
  pintarAgenda();
  pintarClientes();
});
const coincide = (...campos) => !textoBusqueda || campos.join(" ").toLowerCase().includes(textoBusqueda);

// ================= Dashboard =================
function pintarDashboard() {
  const ahora = new Date();
  const mIni = inicioMes(), mFin = inicioMes(ahora, 1), mAntIni = inicioMes(ahora, -1);
  const enRango = (s, a, b) => new Date(s.fecha_hora) >= a && new Date(s.fecha_hora) < b;

  const delMes = servicios.filter((s) => activo(s) && enRango(s, mIni, mFin));
  const mesAnterior = servicios.filter((s) => activo(s) && enRango(s, mAntIni, mIni)).length;
  const realizadosMes = delMes.filter((s) => s.estado === "realizado");
  const proximos = servicios.filter((s) => pendiente(s) && new Date(s.fecha_hora) >= inicioDia());
  const hoyN = proximos.filter((s) => mismoDia(s.fecha_hora, ahora)).length;
  const porCobrar = servicios.filter((s) => s.estado === "realizado" && !s.pagado);
  const montoCobrar = porCobrar.reduce((a, s) => a + Number(s.precio || 0), 0);

  const dif = delMes.length - mesAnterior;
  const pctReal = delMes.length ? Math.round((realizadosMes.length / delMes.length) * 100) : 0;

  $("kpis").innerHTML = `
    <div class="card kpi destacado" data-ir="agenda" data-periodo="mes">
      <h4>Servicios del mes</h4><span class="flecha">${ICO.flecha}</span>
      <div class="num">${delMes.length}</div>
      <div class="pie"><i>${dif >= 0 ? "▲" : "▼"} ${Math.abs(dif)}</i> ${dif >= 0 ? "más" : "menos"} que el mes pasado</div>
    </div>
    <div class="card kpi" data-ir="agenda" data-periodo="mes" data-estado="realizado">
      <h4>Realizados</h4><span class="flecha">${ICO.flecha}</span>
      <div class="num">${realizadosMes.length}</div>
      <div class="pie"><i>${pctReal}%</i> del mes completado</div>
    </div>
    <div class="card kpi" data-ir="agenda" data-periodo="proximos" data-estado="">
      <h4>Por atender</h4><span class="flecha">${ICO.flecha}</span>
      <div class="num">${proximos.length}</div>
      <div class="pie"><i>${hoyN}</i> ${hoyN === 1 ? "servicio" : "servicios"} hoy</div>
    </div>
    <div class="card kpi" data-ir="cobros">
      <h4>Por cobrar</h4><span class="flecha">${ICO.flecha}</span>
      <div class="num">${bs(montoCobrar)}<small>Bs</small></div>
      <div class="pie ${porCobrar.length ? "malo" : ""}"><i>${porCobrar.length}</i> ${porCobrar.length ? "servicios sin pagar" : "todo al día"}</div>
    </div>`;

  pintarChartSemana();
  pintarProximo(proximos);

  // Próximos servicios (lista)
  const lista = proximos.slice(0, 7);
  $("lista-proximos").innerHTML = lista.length ? lista.map((s) => `
    <div class="item">
      <div class="ico ${claseTipo(s.tipo_servicio)}">${iniciales(s.tipo_servicio)}</div>
      <div class="txt"><b>${esc(s.cliente)}</b><span>${fmtCorto(s.fecha_hora)} · ${fmtHora(s.fecha_hora)} · ${esc(s.tipo_servicio)}</span></div>
    </div>`).join("") : `<p class="vacio">No hay servicios programados.</p>`;

  // Pendientes de cobro (top 4)
  $("lista-cobrar-dash").innerHTML = porCobrar.length ? porCobrar.slice(0, 4).map(itemCobro).join("")
    : `<p class="vacio">Todo cobrado 🎉</p>`;

  // Gauge cobranza del mes
  const facturado = realizadosMes.reduce((a, s) => a + Number(s.precio || 0), 0);
  const cobrado = realizadosMes.filter((s) => s.pagado).reduce((a, s) => a + Number(s.precio || 0), 0);
  const programado = delMes.filter(pendiente).reduce((a, s) => a + Number(s.precio || 0), 0);
  pintarGauge(cobrado, facturado - cobrado, programado);
}

function pintarChartSemana() {
  const hoy = inicioDia();
  const lunes = sumarDias(hoy, -((hoy.getDay() + 6) % 7));
  const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
  const datos = dias.map((d) => {
    const del = servicios.filter((s) => activo(s) && mismoDia(s.fecha_hora, d));
    return { d, real: del.filter((s) => s.estado === "realizado").length, pend: del.filter(pendiente).length };
  });
  const max = Math.max(2, ...datos.map((x) => x.real + x.pend));
  const nombres = ["L", "M", "M", "J", "V", "S", "D"];
  $("chart-semana").innerHTML = datos.map((x, i) => {
    const tot = x.real + x.pend;
    const alto = tot ? Math.max(28, (tot / max) * 100) : 34;
    return `
      <div class="barra ${mismoDia(x.d, hoy) ? "hoy" : ""}" title="${fmtDia(x.d)}: ${tot} servicio(s)">
        <span class="cuenta ${tot ? "" : "cero"}">${tot}</span>
        <div class="pildora ${tot ? "" : "vacia"}" style="height:${alto}%">
          ${x.pend ? `<div class="seg-pend" style="flex:${x.pend}"></div>` : ""}
          ${x.real ? `<div class="seg-real" style="flex:${x.real}"></div>` : ""}
        </div>
        <span class="dia">${nombres[i]}</span>
      </div>`;
  }).join("");
}

function pintarProximo(proximos) {
  const s = proximos.find((x) => new Date(x.fecha_hora) >= new Date(Date.now() - 60 * 60000));
  if (!s) {
    $("card-proximo").innerHTML = `<h3>Próximo servicio</h3>
      <p class="vacio">No tienes servicios programados.</p>
      <button class="btn primario ancho" data-nuevo-servicio>${ICO.mas} Agendar servicio</button>`;
    return;
  }
  const wa = linkWhatsApp(s);
  $("card-proximo").innerHTML = `
    <h3>Próximo servicio</h3>
    <div class="prox-cliente">${esc(s.cliente)}</div>
    <div class="prox-meta">${esc(s.tipo_servicio)}${s.plaga ? " · " + esc(s.plaga) : ""}<br>
      ${fmtCorto(s.fecha_hora)} · ${fmtHora(s.fecha_hora)}${s.zona ? " · " + esc(s.zona) : ""}</div>
    <span class="prox-cuando">${cuandoFalta(s.fecha_hora)}</span>
    <div class="prox-acciones">
      ${wa ? `<a class="btn primario" href="${wa}" target="_blank">${ICO.wa} WhatsApp</a>` : ""}
      <a class="btn contorno" href="${linkGoogleCalendar(s)}" target="_blank">${ICO.cal} Calendario</a>
    </div>`;
}

function pintarGauge(cobrado, porCobrar, programado) {
  const total = cobrado + porCobrar + programado;
  const pct = total ? Math.round((cobrado / total) * 100) : 0;
  // Semicírculo: arco de 180°, r=80, centro (100,100)
  const L = Math.PI * 80;
  const seg = (v) => (total ? (v / total) * L : 0);
  const a = seg(cobrado), b = seg(porCobrar), c = seg(programado);
  const arco = (len, off, color, extra = "") =>
    len > 0 ? `<path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="${color}" stroke-width="26" stroke-linecap="butt"
      stroke-dasharray="${len} ${L}" stroke-dashoffset="${-off}" ${extra}/>` : "";
  $("gauge").innerHTML = `
    <div class="gauge-caja">
      <svg viewBox="0 0 200 112">
        <defs><pattern id="rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#fff"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b7c2b9" stroke-width="2.5"/></pattern></defs>
        <path d="M20 100 A80 80 0 0 1 180 100" fill="none" stroke="#eef0ec" stroke-width="26"/>
        ${arco(a, 0, "#1b7400")}
        ${arco(b, a, "#012d10")}
        ${arco(c, a + b, "url(#rayas)")}
      </svg>
      <div class="gauge-num"><b>${pct}%</b><span>cobrado del mes</span></div>
    </div>
    <div class="gauge-ley">
      <span><i style="background:#1b7400"></i>Cobrado ${bs(cobrado)}</span>
      <span><i style="background:#012d10"></i>Por cobrar ${bs(porCobrar)}</span>
      <span><i style="background:repeating-linear-gradient(135deg,#b7c2b9 0 2px,#fff 2px 4px);border:1px solid #c9d1ca"></i>Programado ${bs(programado)}</span>
    </div>`;
}

function itemCobro(s) {
  return `
    <div class="item">
      <div class="ini ${claseTipo(s.tipo_servicio)}">${iniciales(s.cliente)}</div>
      <div class="txt"><b>${esc(s.cliente)}</b><span>${fmtCorto(s.fecha_hora)} · ${esc(s.tipo_servicio)}</span></div>
      <span class="monto">${bs(s.precio)} Bs</span>
      ${linkWhatsApp(s) ? `<a class="icono-btn" href="https://wa.me/${soloNumeros(s.telefono)}" target="_blank" title="WhatsApp">${ICO.wa}</a>` : ""}
      <button class="btn mini primario" data-accion="pagado" data-id="${s.id}">Cobrado</button>
    </div>`;
}

// ================= Agenda =================
function setPeriodo(p) {
  filtroPeriodo = p;
  document.querySelectorAll("#filtro-periodo button").forEach((b) => b.classList.toggle("activo", b.dataset.p === p));
  pintarAgenda();
}
function setEstado(e) {
  filtroEstado = e;
  document.querySelectorAll("#filtro-estado button").forEach((b) => b.classList.toggle("activo", b.dataset.e === e));
  pintarAgenda();
}
document.querySelectorAll("#filtro-periodo button").forEach((b) => b.addEventListener("click", () => setPeriodo(b.dataset.p)));
document.querySelectorAll("#filtro-estado button").forEach((b) => b.addEventListener("click", () => setEstado(b.dataset.e)));

function pintarAgenda() {
  const hoy = inicioDia();
  let lista = servicios.filter((s) => {
    const f = new Date(s.fecha_hora);
    switch (filtroPeriodo) {
      case "hoy": return mismoDia(f, hoy);
      case "semana": return f >= hoy && f < sumarDias(hoy, 7);
      case "proximos": return f >= hoy;
      case "pasados": return f < hoy;
      case "mes": return f >= inicioMes() && f < inicioMes(new Date(), 1);
      default: return true;
    }
  });
  if (filtroEstado) lista = lista.filter((s) => s.estado === filtroEstado);
  lista = lista.filter((s) => coincide(s.cliente, s.zona, s.direccion, s.tipo_servicio, s.plaga, s.telefono));
  if (filtroPeriodo === "pasados") lista.reverse();

  if (!lista.length) {
    $("lista-agenda").innerHTML = `<div class="card"><p class="vacio">No hay servicios con estos filtros.</p>
      <div style="text-align:center"><button class="btn primario" data-nuevo-servicio>${ICO.mas} Nuevo servicio</button></div></div>`;
    return;
  }
  let html = "", diaActual = "";
  for (const s of lista) {
    const dia = fmtDia(s.fecha_hora);
    if (dia !== diaActual) {
      const n = lista.filter((x) => fmtDia(x.fecha_hora) === dia).length;
      html += `<div class="dia-tit">${mismoDia(s.fecha_hora, hoy) ? "Hoy · " + dia : mayus(dia)}<span>${n} ${n === 1 ? "servicio" : "servicios"}</span></div>`;
      diaActual = dia;
    }
    const tel = soloNumeros(s.telefono);
    const wa = linkWhatsApp(s);
    const dir = [s.direccion, s.zona].filter(Boolean).join(", ");
    html += `
    <div class="card servicio ${s.estado}">
      <div class="hora">${fmtHora(s.fecha_hora)}<small>${esc(s.tipo_servicio)}</small></div>
      <div>
        <div class="cliente">${esc(s.cliente)}</div>
        <div class="detalle">
          ${s.plaga ? "🪲 " + esc(s.plaga) : ""}${s.producto ? " · 🧪 " + esc(s.producto) : ""}${s.plaga || s.producto ? "<br>" : ""}
          ${dir ? "📍 " + esc(dir) + "<br>" : ""}
          💲 ${s.precio != null ? bs(s.precio) + " Bs" : "-"}${s.area_m2 ? " · " + s.area_m2 + " m²" : ""}${s.frecuencia_dias ? " · 🔁 cada " + s.frecuencia_dias + " días" : ""}
          ${s.notas ? "<br>📝 " + esc(s.notas) : ""}
        </div>
      </div>
      <div class="lado">
        <div style="display:flex;gap:.35rem;flex-wrap:wrap;justify-content:flex-end">
          <span class="estado ${s.estado}">${s.estado}</span>
          ${s.estado !== "cancelado" ? `<span class="estado ${s.pagado ? "realizado" : "pago"}">${s.pagado ? "pagado" : "sin pagar"}</span>` : ""}
        </div>
        <div class="botones">
          ${tel ? `<a class="icono-btn" href="tel:+${tel}" title="Llamar">${ICO.tel}</a>` : ""}
          ${wa ? `<a class="icono-btn" href="${wa}" target="_blank" title="WhatsApp">${ICO.wa}</a>` : ""}
          ${pendiente(s) ? `<a class="icono-btn" href="${linkGoogleCalendar(s)}" target="_blank" title="Agregar a mi calendario">${ICO.cal}</a>` : ""}
          <button class="icono-btn" data-accion="editar" data-id="${s.id}" title="Editar">${ICO.edit}</button>
        </div>
        <div class="botones">
          ${s.estado === "pendiente" ? `<button class="btn mini contorno" data-accion="confirmado" data-id="${s.id}">Confirmar</button>` : ""}
          ${pendiente(s) ? `<button class="btn mini primario" data-accion="realizado" data-id="${s.id}">${ICO.check} Realizado</button>` : ""}
          ${!s.pagado && s.estado === "realizado" ? `<button class="btn mini primario" data-accion="pagado" data-id="${s.id}">${ICO.cash} Cobrado</button>` : ""}
        </div>
      </div>
    </div>`;
  }
  $("lista-agenda").innerHTML = html;
}

// Acciones sobre servicios (en cualquier vista)
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-accion]");
  if (!b) return;
  const { accion, id } = b.dataset;
  const s = servicios.find((x) => x.id === id);
  if (accion === "editar") return abrirServicio(s);
  const cambio = accion === "pagado" ? { pagado: true } : { estado: accion };
  b.disabled = true;
  const { error } = await sb.from("servicios").update(cambio).eq("id", id);
  if (error) { b.disabled = false; return toast("Error: " + error.message); }
  toast(accion === "realizado"
    ? (s?.frecuencia_dias ? "Realizado ✔ — próxima visita agendada" : "Servicio realizado ✔")
    : accion === "pagado" ? "Cobro registrado 💵" : "Servicio confirmado");
  cargarTodo();
});

// ================= Modal servicio =================
function nuevoServicio(clienteId) {
  if (!clientes.length) {
    toast("Primero registra un cliente");
    return abrirCliente(null);
  }
  abrirServicio(clienteId ? { cliente_id: clienteId } : null);
}
function abrirServicio(s) {
  const esNuevo = !s?.id;
  $("s-cliente").innerHTML = clientes
    .map((c) => `<option value="${c.id}" ${c.id === s?.cliente_id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("");
  $("titulo-servicio").textContent = esNuevo ? "Nuevo servicio" : "Editar servicio";
  $("s-id").value = s?.id ?? "";
  const manana = sumarDias(new Date(), 1); manana.setHours(9, 0, 0, 0);
  $("s-fecha").value = aInputLocal(s?.fecha_hora ?? manana);
  $("s-tipo").value = s?.tipo_servicio ?? "Fumigación";
  $("s-plaga").value = s?.plaga ?? "";
  $("s-producto").value = s?.producto ?? "";
  $("s-area").value = s?.area_m2 ?? "";
  $("s-precio").value = s?.precio ?? "";
  $("s-frecuencia").value = s?.frecuencia_dias ?? "";
  $("s-estado").value = s?.estado ?? "pendiente";
  $("s-pagado").checked = !!s?.pagado;
  $("s-notas").value = s?.notas ?? "";
  $("btn-borrar-servicio").classList.toggle("hidden", esNuevo);
  $("form-servicio")._fechaOriginal = s?.fecha_hora ?? null;
  $("modal-servicio").showModal();
}

$("form-servicio").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("s-id").value;
  const fecha = new Date($("s-fecha").value).toISOString();
  const num = (v) => (v === "" ? null : Number(v));
  const datos = {
    cliente_id: $("s-cliente").value,
    fecha_hora: fecha,
    tipo_servicio: $("s-tipo").value,
    plaga: $("s-plaga").value.trim() || null,
    producto: $("s-producto").value.trim() || null,
    area_m2: num($("s-area").value),
    precio: num($("s-precio").value),
    frecuencia_dias: num($("s-frecuencia").value),
    estado: $("s-estado").value,
    pagado: $("s-pagado").checked,
    notas: $("s-notas").value.trim() || null,
  };
  const { error } = id
    ? await sb.from("servicios").update(datos).eq("id", id)
    : await sb.from("servicios").insert(datos);
  if (error) return toast("Error: " + error.message);
  $("modal-servicio").close();
  toast("Servicio guardado");
  cargarTodo();
});

$("btn-borrar-servicio").addEventListener("click", async () => {
  if (!confirm("¿Eliminar este servicio?")) return;
  const { error } = await sb.from("servicios").delete().eq("id", $("s-id").value);
  if (error) return toast("Error: " + error.message);
  $("modal-servicio").close();
  toast("Servicio eliminado");
  cargarTodo();
});

// ================= Clientes =================
function pintarClientes() {
  const lista = clientes.filter((c) => coincide(c.nombre, c.telefono, c.zona, c.direccion));
  $("sub-clientes").textContent = `${clientes.length} ${clientes.length === 1 ? "cliente registrado" : "clientes registrados"}`;
  if (!lista.length) {
    $("tabla-clientes").innerHTML = `<p class="vacio">${textoBusqueda ? "Ningún cliente coincide con la búsqueda." : "Aún no tienes clientes. Registra el primero."}</p>`;
    return;
  }
  const filas = lista.map((c) => {
    const suyos = servicios.filter((s) => s.cliente_id === c.id && activo(s));
    const hechos = suyos.filter((s) => s.estado === "realizado");
    const ultimo = hechos.at(-1);
    const proximo = suyos.find((s) => pendiente(s) && new Date(s.fecha_hora) >= inicioDia());
    const total = hechos.reduce((a, s) => a + Number(s.precio || 0), 0);
    const tel = soloNumeros(c.telefono);
    return `
      <tr>
        <td><div class="nombre"><div class="ini ${claseTipo(c.tipo === "empresa" ? "insect" : c.tipo === "restaurante" ? "desinf" : "")}">${iniciales(c.nombre)}</div>
          <div><b>${esc(c.nombre)}</b><span>${esc(c.tipo)}${c.zona ? " · " + esc(c.zona) : ""}</span></div></div></td>
        <td class="ocultar-movil">${esc(c.telefono ?? "-")}</td>
        <td class="ocultar-movil">${ultimo ? fmtCorto(ultimo.fecha_hora) : "-"}</td>
        <td class="ocultar-movil">${proximo ? fmtCorto(proximo.fecha_hora) : `<span style="color:var(--ambar)">Sin agendar</span>`}</td>
        <td class="num-der ocultar-movil">${hechos.length}</td>
        <td class="num-der ocultar-movil">${bs(total)} Bs</td>
        <td><div class="acc">
          ${tel ? `<a class="icono-btn" href="https://wa.me/${tel}" target="_blank" title="WhatsApp">${ICO.wa}</a>` : ""}
          <button class="icono-btn" data-editar-cliente="${c.id}" title="Editar">${ICO.edit}</button>
          <button class="btn mini primario" data-agendar="${c.id}">+ Servicio</button>
        </div></td>
      </tr>`;
  }).join("");
  $("tabla-clientes").innerHTML = `
    <table class="tabla">
      <thead><tr><th>Cliente</th><th class="ocultar-movil">Teléfono</th><th class="ocultar-movil">Último servicio</th>
        <th class="ocultar-movil">Próximo</th><th class="num-der ocultar-movil">Servicios</th><th class="num-der ocultar-movil">Facturado</th><th></th></tr></thead>
      <tbody>${filas}</tbody>
    </table>`;
}

$("tabla-clientes").addEventListener("click", (e) => {
  const ed = e.target.closest("[data-editar-cliente]");
  const ag = e.target.closest("[data-agendar]");
  if (ed) abrirCliente(clientes.find((c) => c.id === ed.dataset.editarCliente));
  if (ag) nuevoServicio(ag.dataset.agendar);
});

function abrirCliente(c) {
  $("titulo-cliente").textContent = c ? "Editar cliente" : "Nuevo cliente";
  $("c-id").value = c?.id ?? "";
  $("c-nombre").value = c?.nombre ?? "";
  $("c-telefono").value = c?.telefono ?? "";
  $("c-direccion").value = c?.direccion ?? "";
  $("c-zona").value = c?.zona ?? "";
  $("c-tipo").value = c?.tipo ?? "domicilio";
  $("c-notas").value = c?.notas ?? "";
  $("modal-cliente").showModal();
}

$("form-cliente").addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("c-id").value;
  const datos = {
    nombre: $("c-nombre").value.trim(),
    telefono: $("c-telefono").value.trim() || null,
    direccion: $("c-direccion").value.trim() || null,
    zona: $("c-zona").value.trim() || null,
    tipo: $("c-tipo").value,
    notas: $("c-notas").value.trim() || null,
  };
  const { error } = id
    ? await sb.from("clientes").update(datos).eq("id", id)
    : await sb.from("clientes").insert(datos);
  if (error) return toast("Error: " + error.message);
  $("modal-cliente").close();
  toast("Cliente guardado");
  cargarTodo();
});

// ================= Por cobrar =================
function pintarCobros() {
  const lista = servicios.filter((s) => s.estado === "realizado" && !s.pagado);
  const total = lista.reduce((a, s) => a + Number(s.precio || 0), 0);
  $("lista-cobros").innerHTML = lista.length
    ? `<div style="padding:1rem 1.2rem;border-bottom:1px solid var(--borde);display:flex;justify-content:space-between;align-items:center">
         <span class="sub" style="margin:0">${lista.length} ${lista.length === 1 ? "servicio" : "servicios"}</span>
         <b style="font-size:1.3rem">${bs(total)} Bs</b></div>
       <div style="padding:0 1.2rem">${lista.map(itemCobro).join("")}</div>`
    : `<p class="vacio">No tienes cobros pendientes 🎉</p>`;
}

// ================= Cerrar modales =================
document.querySelectorAll("[data-cerrar]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close()));

iniciar();
