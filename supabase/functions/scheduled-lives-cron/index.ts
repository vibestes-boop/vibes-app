/**
 * Supabase Edge Function: scheduled-lives-cron
 *
 * v1.26.0 — Scheduled Lives.
 *
 * Wird via pg_cron alle 5 Minuten aufgerufen und erledigt zwei Dinge:
 *
 *   1. mark_due_scheduled_lives_reminded(BATCH)
 *      → Findet alle 'scheduled' Einträge mit scheduled_at <= NOW()+15min.
 *      → Setzt Status auf 'reminded', schreibt Notifications an alle Follower.
 *      → Die Notifications-INSERTs triggern den bestehenden
 *        send-push-notification Flow (via Auto-Trigger auf notifications).
 *      → SELECT … FOR UPDATE SKIP LOCKED → race-safe bei parallelen Runs.
 *
 *   2. expire_stale_scheduled_lives()
 *      → Setzt alle 'scheduled'/'reminded' Einträge, deren scheduled_at > 2h
 *        vorbei ist, auf 'expired'. Aufräum-Operation — Host ist einfach
 *        nicht live gegangen.
 *
 * Der Edge-Layer existiert hier hauptsächlich für
 *   (a) zentrales Logging (→ Sentry später),
 *   (b) saubere Service-Role-Auth (RPCs sind nur service_role),
 *   (c) Möglichkeit später komplexere Retry-/Backoff-Logik einzubauen.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BATCH_SIZE = 50;

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = Date.now();

  // ─── 1. Reminder fanout ──────────────────────────────────────────────────
  const { data: reminded, error: remindErr } = await supabase.rpc(
    'mark_due_scheduled_lives_reminded',
    { p_batch_size: BATCH_SIZE },
  );

  if (remindErr) {
    console.error('[scheduled-lives-cron] remind RPC error:', remindErr.message);
    return new Response(
      JSON.stringify({ error: remindErr.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const remindedRows = (reminded ?? []) as Array<{
    scheduled_live_id: string;
    host_id:           string;
    notified_count:    number;
    success:           boolean;
    error:             string | null;
  }>;

  const successReminds = remindedRows.filter((r) => r.success);
  const failedReminds  = remindedRows.filter((r) => !r.success);
  const totalNotified  = successReminds.reduce((sum, r) => sum + (r.notified_count ?? 0), 0);

  // ─── 2. Expire-Cleanup ───────────────────────────────────────────────────
  const { data: expiredCount, error: expireErr } = await supabase.rpc(
    'expire_stale_scheduled_lives',
  );

  if (expireErr) {
    console.error('[scheduled-lives-cron] expire RPC error:', expireErr.message);
    // Nicht als Fatal werten — Reminder-Fanout war erfolgreich
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[scheduled-lives-cron] reminded=${successReminds.length} ` +
    `notified=${totalNotified} failed=${failedReminds.length} ` +
    `expired=${expiredCount ?? 0} in ${duration}ms`,
  );

  if (failedReminds.length > 0) {
    console.warn(
      '[scheduled-lives-cron] reminder failures:',
      failedReminds.map((f) => ({ id: f.scheduled_live_id, err: f.error })),
    );
  }

  return new Response(
    JSON.stringify({
      ok:             true,
      reminded:       successReminds.length,
      notified:       totalNotified,
      failed:         failedReminds.length,
      expired:        expiredCount ?? 0,
      duration_ms:    duration,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
