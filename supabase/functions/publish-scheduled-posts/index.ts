/**
 * Supabase Edge Function: publish-scheduled-posts
 *
 * v1.20.0 — Creator-Studio Pro.
 *
 * Wird via pg_cron jede Minute aufgerufen und published alle fälligen
 * `scheduled_posts` (publish_at <= NOW() AND status='pending').
 *
 * Die eigentliche Arbeit macht die RPC `publish_due_scheduled_posts(batch)`:
 *   • SELECT … FOR UPDATE SKIP LOCKED — zwei Concurrent-Runs crashen nicht
 *   • pro Row: INSERT in posts, status='published', published_post_id gesetzt
 *   • bei Fehler: retries++, nach 3 Fehlversuchen status='failed'
 *
 * Der Edge-Layer existiert nur um
 *   (a) Logging zentralisieren (→ Sentry später),
 *   (b) Push-Notifications an den Author zu schicken ("Dein Post ist live!"),
 *   (c) Queues / Rate-Limits falls der Batch mal größer wird.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BATCH_SIZE = 50;

Deno.serve(async (_req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const startedAt = Date.now();

  const { data: results, error } = await supabase.rpc(
    'publish_due_scheduled_posts',
    { p_batch_size: BATCH_SIZE },
  );

  if (error) {
    console.error('[publish-scheduled-posts] RPC error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }

  const rows = (results ?? []) as Array<{
    scheduled_id: string;
    post_id: string | null;
    success: boolean;
    error: string | null;
  }>;

  const published = rows.filter((r) => r.success);
  const failed = rows.filter((r) => !r.success);

  // Push-Notification für jeden erfolgreichen Publish ("Dein Post ist live")
  // Best-effort: wenn send-push-notification nicht erreichbar, einfach loggen.
  if (published.length > 0) {
    for (const row of published) {
      try {
        // Author ID aus scheduled_posts holen (published_post_id ist jetzt gesetzt)
        const { data: sched } = await supabase
          .from('scheduled_posts')
          .select('author_id, caption')
          .eq('id', row.scheduled_id)
          .maybeSingle();

        if (sched?.author_id) {
          await supabase.functions.invoke('send-push-notification', {
            body: {
              user_id: sched.author_id,
              title:   'Dein geplanter Post ist live',
              body:    sched.caption?.slice(0, 80) ?? 'Zeig der Community, was du gemacht hast.',
              data:    { type: 'scheduled_post_published', post_id: row.post_id },
            },
          });
        }
      } catch (pushErr) {
        console.warn(
          '[publish-scheduled-posts] push failed for',
          row.scheduled_id,
          pushErr,
        );
      }
    }
  }

  const duration = Date.now() - startedAt;
  console.log(
    `[publish-scheduled-posts] ${published.length} published, ${failed.length} failed in ${duration}ms`,
  );

  if (failed.length > 0) {
    console.warn(
      '[publish-scheduled-posts] failures:',
      failed.map((f) => ({ id: f.scheduled_id, err: f.error })),
    );
  }

  return new Response(
    JSON.stringify({
      ok:         true,
      published:  published.length,
      failed:     failed.length,
      duration_ms: duration,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
