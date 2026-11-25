// supabase/functions/avisos/index.ts
// Envía avisos por Telegram: 24h antes y 2h antes de cada servicio.
// Secrets (Supabase > Edge Functions > Secrets):
//   TELEGRAM_TOKEN, TELEGRAM_CHAT_ID
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);
const TOKEN = Deno.env.get("TELEGRAM_TOKEN")!;
const CHAT = Deno.env.get("TELEGRAM_CHAT_ID")!;

async function telegram(texto: string) {
  await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: CHAT, text: texto, parse_mode: "HTML" }),
  });
}

const hora = (f: string) =>
  new Date(f).toLocaleString("es-BO", { timeZone: "America/La_Paz",
    weekday: "short", day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit" });

const msg = (s: any, cuando: string) =>
  `🪲 <b>FumiHouse · ${cuando}</b>\n` +
  `📅 ${hora(s.fecha_hora)}\n` +
  `👤 ${s.cliente} (${s.telefono ?? "-"})\n` +
  `📍 ${s.direccion ?? ""} ${s.zona ? "- " + s.zona : ""}\n` +
  `🧪 ${s.tipo_servicio}${s.plaga ? " / " + s.plaga : ""}\n` +
  `💲 ${s.precio ?? "-"} Bs`;

async function avisar(horas: number, campo: string, titulo: string) {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + horas * 3600_000);
  const { data } = await sb.from("agenda").select("*")
    .in("estado", ["pendiente", "confirmado"])
    .eq(campo, false)
    .gte("fecha_hora", ahora.toISOString())
    .lte("fecha_hora", limite.toISOString());

  for (const s of data ?? []) {
    await telegram(msg(s, titulo));
    await sb.from("servicios").update({ [campo]: true }).eq("id", s.id);
  }
  return data?.length ?? 0;
}

Deno.serve(async () => {
  const a = await avisar(24, "aviso_dia_antes", "Servicio mañana");
  const b = await avisar(2, "aviso_2h", "Servicio en 2 horas");
  return new Response(JSON.stringify({ avisos_24h: a, avisos_2h: b }));
});
