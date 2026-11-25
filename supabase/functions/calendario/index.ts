// supabase/functions/calendario/index.ts
// Publica la agenda como feed de calendario (.ics) para suscribirse
// desde Google Calendar, iPhone u Outlook.
//
// Deploy:  supabase functions deploy calendario --no-verify-jwt
// Secret:  CAL_TOKEN = una clave larga inventada (ej. 32 caracteres aleatorios)
// URL:     https://TU_PROYECTO.supabase.co/functions/v1/calendario?token=CAL_TOKEN
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Formato de fecha ICS en UTC: 20261125T150000Z
const ics = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
// Escapar texto según el estándar ICS
const esc = (t: string) =>
  (t ?? "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

Deno.serve(async (req) => {
  const token = new URL(req.url).searchParams.get("token");
  if (token !== Deno.env.get("CAL_TOKEN")) {
    return new Response("No autorizado", { status: 401 });
  }

  // Últimos 30 días + todo lo futuro, sin cancelados
  const desde = new Date(Date.now() - 30 * 86400_000).toISOString();
  const { data } = await sb.from("agenda").select("*")
    .neq("estado", "cancelado")
    .gte("fecha_hora", desde)
    .order("fecha_hora");

  const ahora = ics(new Date());
  const eventos = (data ?? []).map((s: any) => {
    const ini = new Date(s.fecha_hora);
    const fin = new Date(ini.getTime() + 90 * 60_000); // duración por defecto: 1h30
    const estado = s.estado === "realizado" ? "✅ " : "";
    return [
      "BEGIN:VEVENT",
      `UID:${s.id}@agenda-fumigacion`,
      `DTSTAMP:${ahora}`,
      `DTSTART:${ics(ini)}`,
      `DTEND:${ics(fin)}`,
      `SUMMARY:${esc(`${estado}${s.tipo_servicio} - ${s.cliente}`)}`,
      `LOCATION:${esc([s.direccion, s.zona].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${esc(
        `Tel: ${s.telefono ?? "-"}\nPlaga: ${s.plaga ?? "-"}\nProducto: ${s.producto ?? "-"}\n` +
        `Precio: ${s.precio ?? "-"} Bs\nEstado: ${s.estado}\n${s.notas ?? ""}`,
      )}`,
      // Recordatorio del propio calendario 1 hora antes
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:FumiHouse: servicio",
      "END:VALARM",
      "END:VEVENT",
    ].join("\r\n");
  });

  const cuerpo = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Agenda Fumigacion//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:FumiHouse - Agenda",
    "X-WR-TIMEZONE:America/La_Paz",
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...eventos,
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(cuerpo, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="agenda.ics"',
    },
  });
});
