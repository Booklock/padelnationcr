// =====================================================================
// Padel Nation CR — Edge Function: send-event-reminders
// =====================================================================
// Envía recordatorios por email a jugadores inscritos confirmados:
//   · 12 horas antes del evento
//   · 1 hora antes del evento
//
// Llamada por GitHub Actions cada hora (ver .github/workflows/event-reminders.yml)
// Proveedor de email: Resend (resend.com) — plan gratuito: 3 000 emails/mes
//
// Variables de entorno requeridas en Supabase (Dashboard → Edge Functions → Secrets):
//   RESEND_API_KEY          — clave API de Resend
//   CRON_SECRET             — secret compartido con GitHub Actions para autenticar
//   FROM_EMAIL              — ej. "Padel Nation CR <no-reply@padelnationcr.com>"
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const CRON_SECRET    = Deno.env.get("CRON_SECRET")!;
const FROM_EMAIL     = Deno.env.get("FROM_EMAIL") ?? "Padel Nation CR <no-reply@padelnationcr.com>";
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY    = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Ventanas de recordatorio: [horas antes del evento, tipo, etiqueta para email]
const REMINDER_WINDOWS = [
  { hoursMin: 11.5, hoursMax: 12.5, type: "event_reminder_12h", label: "en 12 horas" },
  { hoursMin: 0.5,  hoursMax: 1.5,  type: "event_reminder_1h",  label: "en 1 hora"   },
];

Deno.serve(async (req) => {
  // Verificar secret compartido con GitHub Actions
  const authHeader = req.headers.get("x-cron-secret");
  if (authHeader !== CRON_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const now      = new Date();
  let   sent     = 0;
  let   skipped  = 0;
  let   failed   = 0;

  for (const window of REMINDER_WINDOWS) {
    const rangeStart = new Date(now.getTime() + window.hoursMin * 60 * 60 * 1000);
    const rangeEnd   = new Date(now.getTime() + window.hoursMax * 60 * 60 * 1000);

    // Eventos que empiezan dentro de esta ventana y están activos
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("id, title, starts_at, location, category_code, format")
      .in("status", ["open", "almost_full", "closed", "in_progress"])
      .gte("starts_at", rangeStart.toISOString())
      .lt("starts_at",  rangeEnd.toISOString());

    if (evErr) { console.error("events query error:", evErr); continue; }
    if (!events?.length) continue;

    for (const event of events) {
      // Inscripciones confirmadas con datos del jugador
      const { data: regs } = await supabase
        .from("event_registrations")
        .select("id, player_id, profiles(full_name, email)")
        .eq("event_id", event.id)
        .eq("status", "confirmed");

      if (!regs?.length) continue;

      for (const reg of regs) {
        const profile = reg.profiles as { full_name: string; email: string } | null;
        if (!profile?.email) { skipped++; continue; }

        // Verificar si ya enviamos este recordatorio
        const { data: existing } = await supabase
          .from("notifications")
          .select("id")
          .eq("recipient_id", reg.player_id)
          .eq("type",         window.type)
          .eq("entity_type",  "event")
          .eq("entity_id",    event.id)
          .not("sent_at",     "is", null)
          .maybeSingle();

        if (existing) { skipped++; continue; }

        // Registrar notificación (antes de enviar para no duplicar si falla el email)
        const { data: notif, error: notifErr } = await supabase
          .from("notifications")
          .insert({
            recipient_id: reg.player_id,
            type:         window.type,
            channel:      "email",
            entity_type:  "event",
            entity_id:    event.id,
            payload:      { event_title: event.title, starts_at: event.starts_at },
          })
          .select("id")
          .single();

        if (notifErr) { console.error("notif insert error:", notifErr); failed++; continue; }

        // Enviar email via Resend
        const emailRes = await fetch("https://api.resend.com/emails", {
          method:  "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type":  "application/json",
          },
          body: JSON.stringify({
            from:    FROM_EMAIL,
            to:      [profile.email],
            subject: `⏰ Recordatorio: ${event.title} empieza ${window.label}`,
            html:    buildReminderEmail(profile.full_name, event, window.label),
          }),
        });

        if (emailRes.ok) {
          await supabase
            .from("notifications")
            .update({ sent_at: new Date().toISOString() })
            .eq("id", notif.id);
          sent++;
        } else {
          const errBody = await emailRes.text();
          await supabase
            .from("notifications")
            .update({ failed_at: new Date().toISOString(), error_message: errBody })
            .eq("id", notif.id);
          failed++;
          console.error("resend error for", profile.email, ":", errBody);
        }
      }
    }
  }

  console.log(`Reminders: sent=${sent} skipped=${skipped} failed=${failed}`);
  return new Response(
    JSON.stringify({ ok: true, sent, skipped, failed }),
    { headers: { "Content-Type": "application/json" } }
  );
});

// ── Template HTML del email ─────────────────────────────────────────

function buildReminderEmail(
  name:      string,
  event:     { title: string; starts_at: string; location?: string | null; category_code?: string },
  timeLabel: string
): string {
  const dateStr = new Intl.DateTimeFormat("es-CR", {
    weekday: "long", day: "numeric", month: "long",
    hour: "numeric", minute: "2-digit", hour12: true,
  }).format(new Date(event.starts_at));

  const firstName = name?.split(" ")[0] ?? "Jugador/a";

  return `<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background-color:#111112;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#111112;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#1a1a1b;border-radius:16px;border:1px solid #2a2a2b;overflow:hidden;">

      <!-- Header -->
      <tr><td style="padding:28px 40px 20px;border-bottom:1px solid #2a2a2b;">
        <table cellpadding="0" cellspacing="0"><tr>
          <td style="background-color:#DCFB00;border-radius:10px;width:40px;height:40px;text-align:center;vertical-align:middle;">
            <span style="font-size:16px;font-weight:900;color:#111112;line-height:40px;display:block;">PN</span>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <span style="font-size:17px;font-weight:900;color:#ffffff;">Padel Nation</span>
            <span style="font-size:13px;font-weight:700;color:#DCFB00;margin-left:4px;">CR</span>
          </td>
        </tr></table>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:32px 40px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:800;color:#DCFB00;text-transform:uppercase;letter-spacing:0.1em;">⏰ Recordatorio</p>
        <h1 style="margin:0 0 16px;font-size:24px;font-weight:900;color:#ffffff;line-height:1.2;">
          Tu evento empieza ${timeLabel}
        </h1>
        <p style="margin:0 0 24px;font-size:15px;color:#a0a0a8;line-height:1.7;">
          Hola <strong style="color:#ffffff;">${firstName}</strong>, este es un recordatorio de que tu próximo evento está por comenzar.
        </p>

        <!-- Event card -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#111112;border-radius:12px;border:1px solid #2a2a2b;margin-bottom:28px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 4px;font-size:12px;color:#DCFB00;font-weight:800;text-transform:uppercase;">Categoría ${event.category_code ?? ""}</p>
            <p style="margin:0 0 12px;font-size:18px;font-weight:900;color:#ffffff;">${event.title}</p>
            <p style="margin:0 0 6px;font-size:14px;color:#a0a0a8;">📅 ${dateStr}</p>
            ${event.location ? `<p style="margin:0;font-size:14px;color:#a0a0a8;">📍 ${event.location}</p>` : ""}
          </td></tr>
        </table>

        <p style="margin:0;font-size:14px;color:#606068;line-height:1.6;">
          ¡Mucha suerte y a dar lo mejor en la cancha! 🎾
        </p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="padding:16px 40px 28px;border-top:1px solid #2a2a2b;text-align:center;">
        <p style="margin:0;font-size:12px;color:#404048;">
          © 2026 Padel Nation CR · Costa Rica<br/>
          Si no querés recibir recordatorios, cancelá tu inscripción desde la app.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}
