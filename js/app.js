import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config.js";

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);
const TZ = "America/La_Paz";

let clientes = [];

// ---------- Utilidades ----------
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 2500);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmtHora = (f) => new Date(f).toLocaleTimeString("es-BO", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const fmtDia = (f) => new Date(f).toLocaleDateString("es-BO", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const bs = (n) => (n == null ? "-" : `${Number(n).toLocaleString("es-BO")} Bs`);

// Date -> valor para <input type="datetime-local"> (hora local del dispositivo)
function aInputLocal(fecha) {
  const d = new Date(fecha);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function soloNumeros(tel) {
  let n = String(tel ?? "").replace(/\D/g, "");
  if (n.length === 8) n = "591" + n; // celular boliviano sin código de país
  return n;
}

// Enlace para crear el evento en Google Calendar (Google avisa con su recordatorio)
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

// ---------- Sesión ----------
async function iniciar() {
  const { data } = await sb.auth.getSession();
  mostrarVista(!!data.session);
  sb.auth.onAuthStateChange((_e, session) => mostrarVista(!!session));
}

function mostrarVista(logueado) {
  $("vista-login").classList.toggle("hidden", logueado);
  $("vista-app").classList.toggle("hidden", !logueado);
  if (logueado) {
    cargarClientes().then(cargarAgenda);
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

// ---------- Tabs ----------
document.querySelectorAll(".tabs button").forEach((b) =>
  b.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach((x) => x.classList.toggle("activo", x === b));
    document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + b.dataset.tab));
  }));

// ---------- Agenda ----------
$("filtro-agenda").addEventListener("change", cargarAgenda);

async function cargarAgenda() {
  const filtro = $("filtro-agenda").value;
  const ahora = new Date();
  const inicioHoy = new Date(ahora); inicioHoy.setHours(0, 0, 0, 0);
  let q = sb.from("agenda").select("*");

  if (filtro === "hoy") {
    const fin = new Date(inicioHoy); fin.setDate(fin.getDate() + 1);
    q = q.gte("fecha_hora", inicioHoy.toISOString()).lt("fecha_hora", fin.toISOString()).order("fecha_hora");
  } else if (filtro === "semana") {
    const fin = new Date(inicioHoy); fin.setDate(fin.getDate() + 7);
    q = q.gte("fecha_hora", inicioHoy.toISOString()).lt("fecha_hora", fin.toISOString()).order("fecha_hora");
  } else if (filtro === "proximos") {
    q = q.gte("fecha_hora", inicioHoy.toISOString()).order("fecha_hora");
  } else {
    const desde = new Date(inicioHoy); desde.setDate(desde.getDate() - 30);
    q = q.gte("fecha_hora", desde.toISOString()).lt("fecha_hora", inicioHoy.toISOString())
      .order("fecha_hora", { ascending: false });
  }

  const { data, error } = await q;
  if (error) return toast("Error al cargar: " + error.message);
  pintarResumen(data);
  pintarServicios(data);
}

function pintarResumen(lista) {
  const activos = lista.filter((s) => s.estado !== "cancelado");
  const total = activos.reduce((a, s) => a + Number(s.precio || 0), 0);
  const porCobrar = activos.filter((s) => !s.pagado).reduce((a, s) => a + Number(s.precio || 0), 0);
  $("resumen").innerHTML = `
    <div class="card"><b>${activos.length}</b><span>servicios</span></div>
    <div class="card"><b>${bs(total)}</b><span>total</span></div>
    <div class="card"><b>${bs(porCobrar)}</b><span>por cobrar</span></div>`;
}

function pintarServicios(lista) {
  const cont = $("lista-servicios");
  if (!lista.length) {
    cont.innerHTML = `<p class="vacio">No hay servicios en este periodo.</p>`;
    return;
  }
  let html = "", diaActual = "";
  for (const s of lista) {
    const dia = fmtDia(s.fecha_hora);
    if (dia !== diaActual) { html += `<div class="dia">${dia}</div>`; diaActual = dia; }
    const tel = soloNumeros(s.telefono);
    const dir = [s.direccion, s.zona].filter(Boolean).join(", ");
    const wa = tel ? `https://wa.me/${tel}?text=${encodeURIComponent(
      `Hola ${s.cliente}, le confirmamos su servicio de ${s.tipo_servicio} el ${fmtDia(s.fecha_hora)} a las ${fmtHora(s.fecha_hora)}.`)}` : "";

    html += `
    <div class="card servicio ${s.estado}">
      <div class="cabecera">
        <div>
          <div class="hora">${fmtHora(s.fecha_hora)}</div>
          <div class="cliente">${esc(s.cliente)}</div>
        </div>
        <div>
          <span class="badge ${s.estado}">${s.estado}</span>
          ${s.pagado ? `<span class="badge">pagado</span>` : `<span class="badge pago">sin pagar</span>`}
        </div>
      </div>
      <div class="detalle">
        🧪 ${esc(s.tipo_servicio)}${s.plaga ? " · " + esc(s.plaga) : ""}${s.producto ? " · " + esc(s.producto) : ""}<br>
        ${dir ? "📍 " + esc(dir) + "<br>" : ""}
        💲 ${bs(s.precio)}${s.area_m2 ? " · " + s.area_m2 + " m²" : ""}${s.frecuencia_dias ? " · 🔁 cada " + s.frecuencia_dias + " días" : ""}
        ${s.notas ? "<br>📝 " + esc(s.notas) : ""}
      </div>
      <div class="links">
        ${tel ? `<a class="btn chico" href="tel:+${tel}">📞 Llamar</a>` : ""}
        ${wa ? `<a class="btn chico" href="${wa}" target="_blank">💬 WhatsApp</a>` : ""}
        ${["pendiente", "confirmado"].includes(s.estado) ? `<a class="btn chico" href="${linkGoogleCalendar(s)}" target="_blank">📅 Agregar a mi calendario</a>` : ""}
      </div>
      <div class="acciones">
        ${s.estado === "pendiente" ? `<button class="btn chico" data-accion="confirmado" data-id="${s.id}">Confirmar</button>` : ""}
        ${["pendiente", "confirmado"].includes(s.estado) ? `<button class="btn chico primario" data-accion="realizado" data-id="${s.id}">✔ Realizado</button>` : ""}
        ${!s.pagado && s.estado !== "cancelado" ? `<button class="btn chico" data-accion="pagado" data-id="${s.id}">💵 Cobrado</button>` : ""}
        <button class="btn chico" data-accion="editar" data-id="${s.id}">Editar</button>
      </div>
    </div>`;
  }
  cont.innerHTML = html;
  cont._datos = lista;
}

$("lista-servicios").addEventListener("click", async (e) => {
  const b = e.target.closest("button[data-accion]");
  if (!b) return;
  const { accion, id } = b.dataset;
  if (accion === "editar") {
    const s = $("lista-servicios")._datos.find((x) => x.id === id);
    return abrirServicio(s);
  }
  const cambio = accion === "pagado" ? { pagado: true } : { estado: accion };
  const { error } = await sb.from("servicios").update(cambio).eq("id", id);
  if (error) return toast("Error: " + error.message);
  toast(accion === "realizado" ? "Servicio realizado ✔" : "Actualizado");
  cargarAgenda();
});

// ---------- Modal servicio ----------
$("btn-nuevo-servicio").addEventListener("click", () => {
  if (!clientes.length) {
    toast("Primero registra un cliente");
    return document.querySelector('[data-tab="clientes"]').click();
  }
  abrirServicio(null);
});

function llenarSelectClientes(seleccionado) {
  $("s-cliente").innerHTML = clientes
    .map((c) => `<option value="${c.id}" ${c.id === seleccionado ? "selected" : ""}>${esc(c.nombre)}</option>`)
    .join("");
}

function abrirServicio(s) {
  const esNuevo = !s?.id;
  llenarSelectClientes(s?.cliente_id);
  $("titulo-servicio").textContent = esNuevo ? "Nuevo servicio" : "Editar servicio";
  $("s-id").value = s?.id ?? "";
  const manana = new Date(); manana.setDate(manana.getDate() + 1); manana.setHours(9, 0, 0, 0);
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
  // Si cambió la fecha, se vuelven a enviar los avisos
  const original = $("form-servicio")._fechaOriginal;
  if (!id || new Date(original).getTime() !== new Date(fecha).getTime()) {
    datos.aviso_dia_antes = false;
    datos.aviso_2h = false;
  }
  const { error } = id
    ? await sb.from("servicios").update(datos).eq("id", id)
    : await sb.from("servicios").insert(datos);
  if (error) return toast("Error: " + error.message);
  $("modal-servicio").close();
  toast("Servicio guardado");
  cargarAgenda();
});

$("btn-borrar-servicio").addEventListener("click", async () => {
  if (!confirm("¿Eliminar este servicio?")) return;
  const { error } = await sb.from("servicios").delete().eq("id", $("s-id").value);
  if (error) return toast("Error: " + error.message);
  $("modal-servicio").close();
  toast("Servicio eliminado");
  cargarAgenda();
});

// ---------- Clientes ----------
async function cargarClientes() {
  const { data, error } = await sb.from("clientes").select("*").order("nombre");
  if (error) return toast("Error al cargar clientes: " + error.message);
  clientes = data;
  pintarClientes();
}

function pintarClientes() {
  const txt = $("buscar-cliente").value.toLowerCase();
  const lista = clientes.filter((c) =>
    [c.nombre, c.telefono, c.zona, c.direccion].join(" ").toLowerCase().includes(txt));
  $("lista-clientes").innerHTML = lista.length
    ? lista.map((c) => `
      <div class="card">
        <div class="cabecera" style="display:flex;justify-content:space-between;gap:.5rem">
          <div>
            <b>${esc(c.nombre)}</b> <span class="badge pago">${esc(c.tipo)}</span>
            <div class="detalle" style="color:var(--gris);font-size:.9rem;margin-top:.3rem">
              ${c.telefono ? "📞 " + esc(c.telefono) + "<br>" : ""}
              ${c.direccion || c.zona ? "📍 " + esc([c.direccion, c.zona].filter(Boolean).join(", ")) : ""}
            </div>
          </div>
          <div class="acciones" style="margin:0;align-items:start">
            <button class="btn chico" data-agendar="${c.id}">+ Servicio</button>
            <button class="btn chico" data-editar="${c.id}">Editar</button>
          </div>
        </div>
      </div>`).join("")
    : `<p class="vacio">No hay clientes${txt ? " con ese nombre" : ""}.</p>`;
}

$("buscar-cliente").addEventListener("input", pintarClientes);
$("btn-nuevo-cliente").addEventListener("click", () => abrirCliente(null));

$("lista-clientes").addEventListener("click", (e) => {
  const ed = e.target.closest("[data-editar]");
  const ag = e.target.closest("[data-agendar]");
  if (ed) abrirCliente(clientes.find((c) => c.id === ed.dataset.editar));
  if (ag) abrirServicio({ cliente_id: ag.dataset.agendar });
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
  await cargarClientes();
  cargarAgenda();
});

// ---------- Cerrar modales ----------
document.querySelectorAll("[data-cerrar]").forEach((b) =>
  b.addEventListener("click", () => b.closest("dialog").close()));

iniciar();
