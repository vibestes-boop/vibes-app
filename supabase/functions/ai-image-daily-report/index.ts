/**
 * ai-image-daily-report — Supabase Edge Function
 *
 * Täglicher Email-Report über AI-Image-Generation-Nutzung. Läuft per pg_cron
 * jeden Morgen um 08:00 UTC und schickt dem Betreiber eine Zusammenfassung
 * des Vortags per Resend.
 *
 * ZWECK
 * -----
 * Als Platform-Pool-Betreiber (wir zahlen die OpenAI-Rechnung) wollen wir
 * täglich sehen:
 *   • Wie viele Generierungen gab es?
 *   • Wie hoch waren die Kosten?
 *   • Wo stehen wir im 30-Tage-Budget ($50 Cap)?
 *   • Welche Purposes dominieren?
 *   • Heavy-Users — Signal für Missbrauchs-Pattern
 * Bei Überschreitung der 80%-Marke des Platform-Caps → WARN-Level im Betreff.
 *
 * ENV
 * ---
 *   RESEND_API_KEY            — Resend-API-Key
 *   AI_IMAGE_REPORT_TO_EMAIL  — Ziel-Adresse (Default: zaurhatu@gmail.com)
 *   AI_IMAGE_REPORT_FROM      — Absender (Default: reports@resend.dev)
 *   SUPABASE_URL              — automatisch
 *   SUPABASE_SERVICE_ROLE_KEY — automatisch
 *
 * TRIGGER
 * -------
 *   pg_cron: 0 8 * * *   →   SELECT net.http_post(...)  → diese Function
 * (siehe Migration 20260423200000_ai_image_safeguards.sql Fußnote — Cron-
 *  Schedule wird separat per `supabase` CLI oder SQL-Snippet angelegt, weil
 *  pg_cron Secrets enthält.)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PLATFORM_CAP_CENTS = 5000;
const WARN_THRESHOLD_PCT = 80;

Deno.serve(async (_req: Request) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
  const TO_EMAIL = Deno.env.get('AI_IMAGE_REPORT_TO_EMAIL') ?? 'zaurhatu@gmail.com';
  const FROM_EMAIL = Deno.env.get('AI_IMAGE_REPORT_FROM') ?? 'reports@resend.dev';

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'supabase_env_missing' }), { status: 500 });
  }
  if (!RESEND_API_KEY) {
    return new Response(JSON.stringify({ error: 'resend_key_missing' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Report-Daten via RPC ──────────────────────────────────────────────────
  // `since = NOW() - 1 day` ist der Default — wir rufen explizit ohne Param.
  const { data: report, error: reportErr } = await supabase.rpc('get_ai_image_daily_report');

  if (reportErr) {
    console.error('[daily-report] RPC failed:', reportErr);
    return new Response(
      JSON.stringify({ error: 'rpc_failed', detail: reportErr.message }),
      { status: 500 },
    );
  }

  const r = report as {
    since: string;
    total_requests: number;
    successful: number;
    failed: number;
    total_cents: number;
    total_dollars: number;
    unique_users: number;
    platform_30d_cents: number;
    platform_30d_dollars: number;
    platform_cap_cents: number;
    platform_pct_used: number;
    by_purpose: Record<string, number>;
    top_users: Array<{ user_id: string; count: number }>;
  };

  const isWarn = r.platform_pct_used >= WARN_THRESHOLD_PCT;
  const isCritical = r.platform_pct_used >= 100;

  // ── Skip-Logik: keine Aktivität = keine Mail ──────────────────────────────
  // Ausnahme: wenn wir im WARN-Bereich sind, wollen wir trotzdem Alarm.
  if (r.total_requests === 0 && !isWarn) {
    console.log('[daily-report] no activity, skipping email');
    return new Response(
      JSON.stringify({ ok: true, skipped: 'no_activity', report: r }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // ── Subject ───────────────────────────────────────────────────────────────
  const dateLabel = new Date().toISOString().slice(0, 10);
  let subject = `[Vibes AI-Bilder] Tagesreport ${dateLabel} — ${r.total_requests} Gen, $${r.total_dollars.toFixed(2)}`;
  if (isCritical) {
    subject = `🚨 [Vibes AI-Bilder] BUDGET 100%+ ÜBERSCHRITTEN — Feature automatisch blockiert`;
  } else if (isWarn) {
    subject = `⚠️ [Vibes AI-Bilder] WARN: Budget ${r.platform_pct_used}% voll — Tagesreport ${dateLabel}`;
  }

  // ── HTML ──────────────────────────────────────────────────────────────────
  const purposeRows = Object.entries(r.by_purpose)
    .sort(([, a], [, b]) => b - a)
    .map(([k, v]) => `<tr><td style="padding:4px 12px;border-bottom:1px solid #eee">${k}</td><td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right">${v}</td></tr>`)
    .join('');

  const topUserRows = r.top_users
    .map((u) => `<tr><td style="padding:4px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${u.user_id}</td><td style="padding:4px 12px;border-bottom:1px solid #eee;text-align:right">${u.count}</td></tr>`)
    .join('');

  const progressBarColor = isCritical ? '#ef4444' : isWarn ? '#f59e0b' : '#10b981';
  const progressPct = Math.min(r.platform_pct_used, 100);

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f6f6f6;margin:0;padding:24px">
  <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,0.06)">
    <h1 style="margin:0 0 8px;font-size:22px;color:#111">Vibes — AI-Image Daily Report</h1>
    <p style="margin:0 0 24px;color:#666;font-size:14px">Zeitraum: letzte 24 Stunden (${r.since})</p>

    ${isCritical ? '<div style="background:#fee2e2;border:1px solid #ef4444;border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#991b1b"><strong>🚨 KRITISCH:</strong> Platform-Budget ist auf 100% oder darüber. Weitere Generierungen sind automatisch blockiert bis zum Rollover.</div>' : ''}
    ${isWarn && !isCritical ? '<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#92400e"><strong>⚠️ WARN:</strong> Platform-Budget über 80%. Feature noch aktiv, aber Rollover bald erforderlich.</div>' : ''}

    <h2 style="margin:24px 0 8px;font-size:16px;color:#111">Tagessummen</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px">
      <tr><td style="padding:6px 0;color:#666">Gesamt-Requests</td><td style="padding:6px 0;text-align:right;font-weight:600">${r.total_requests}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Erfolgreich</td><td style="padding:6px 0;text-align:right">${r.successful}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Fehlgeschlagen</td><td style="padding:6px 0;text-align:right">${r.failed}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Unique Users</td><td style="padding:6px 0;text-align:right">${r.unique_users}</td></tr>
      <tr><td style="padding:6px 0;color:#666">Tageskosten</td><td style="padding:6px 0;text-align:right;font-weight:600">$${r.total_dollars.toFixed(2)}</td></tr>
    </table>

    <h2 style="margin:24px 0 8px;font-size:16px;color:#111">Platform-Budget (30-Tage-Rolling)</h2>
    <div style="background:#f3f4f6;border-radius:8px;height:24px;overflow:hidden;margin:8px 0">
      <div style="background:${progressBarColor};height:100%;width:${progressPct}%;transition:width .3s"></div>
    </div>
    <p style="margin:8px 0 0;font-size:14px;color:#666">
      <strong style="color:#111">$${r.platform_30d_dollars.toFixed(2)}</strong>
      von $${(r.platform_cap_cents / 100).toFixed(2)}
      (${r.platform_pct_used}%)
    </p>

    ${purposeRows ? `<h2 style="margin:24px 0 8px;font-size:16px;color:#111">Nach Purpose</h2>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #eee">
      ${purposeRows}
    </table>` : ''}

    ${topUserRows ? `<h2 style="margin:24px 0 8px;font-size:16px;color:#111">Top 5 User (by Count)</h2>
    <p style="margin:0 0 8px;font-size:12px;color:#999">Achtung auf Ausreißer — User mit 3+ Requests/Tag sind maxed (Limit).</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border-top:1px solid #eee">
      ${topUserRows}
    </table>` : ''}

    <p style="margin:32px 0 0;font-size:12px;color:#999;text-align:center">
      Automatisch generiert · Platform-Pool-Modell · Limits: 3/Tag + 10/Woche pro User
    </p>
  </div>
</body>
</html>
  `.trim();

  // ── Send via Resend ───────────────────────────────────────────────────────
  const resendRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      subject,
      html,
    }),
  });

  if (!resendRes.ok) {
    const errText = await resendRes.text();
    console.error('[daily-report] Resend failed:', resendRes.status, errText.slice(0, 500));
    return new Response(
      JSON.stringify({ error: 'resend_failed', status: resendRes.status, detail: errText.slice(0, 500) }),
      { status: 502, headers: { 'Content-Type': 'application/json' } },
    );
  }

  console.log(`[daily-report] sent to ${TO_EMAIL} — ${r.total_requests} requests, $${r.total_dollars.toFixed(2)}`);

  return new Response(
    JSON.stringify({
      ok: true,
      to: TO_EMAIL,
      total_requests: r.total_requests,
      total_dollars: r.total_dollars,
      platform_pct_used: r.platform_pct_used,
      warn: isWarn,
      critical: isCritical,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
