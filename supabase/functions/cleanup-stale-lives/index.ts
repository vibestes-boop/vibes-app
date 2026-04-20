/**
 * Supabase Edge Function: cleanup-stale-lives
 *
 * Beendet Live-Sessions die seit mehr als 10 Minuten keine Heartbeats mehr
 * erhalten haben. Wird via pg_cron alle 5 Minuten aufgerufen.
 *
 * Trigger-Logik:
 *   updated_at < NOW() - INTERVAL '10 minutes'  →  status = 'ended'
 *
 * Schützt vor:
 *   - App-Crash ohne sauberes endSession()
 *   - Netzwerkverlust des Hosts
 *   - Hängende "active" Sessions im Feed
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Sessions beenden die älter als 10 Minuten ohne Update sind
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('live_sessions')
    .update({
      status:     'ended',
      ended_at:   new Date().toISOString(),
      viewer_count: 0,
    })
    .eq('status', 'active')
    .lt('updated_at', cutoff)
    .select('id, host_id, title');

  if (error) {
    console.error('[cleanup] Fehler:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const cleaned = data?.length ?? 0;
  console.log(`[cleanup] ${cleaned} stale Session(s) beendet`);

  if (cleaned > 0) {
    console.log('[cleanup] Beendete Sessions:', data?.map(s => s.id));
  }

  return new Response(
    JSON.stringify({ ok: true, cleaned, sessions: data }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
