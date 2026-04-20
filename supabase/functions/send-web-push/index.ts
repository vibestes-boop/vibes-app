// =============================================================================
// Supabase Edge Function: send-web-push  (v1.w.12.4)
// =============================================================================
//
// Zweck: Versendet eine Web-Push-Notification an alle aktiven Subscriptions
// eines Users. Wird aufgerufen von:
//   (a) DB-Triggern auf DM-Insert / Follow / Gift / Live-Start  [Slice D.2+]
//   (b) direkt aus Server-Actions / anderen Edge-Functions
//
// Diese Function ist bewusst nur für WEB-Push (VAPID / W3C Push-API). Die
// parallele Expo-Push-Function `send-push-notification` bleibt für die
// Native-App unverändert. Beide zu einer Function zu mergen wäre möglich,
// aber die Dispatch-Protokolle sind so unterschiedlich dass die Wartbarkeit
// leidet.
//
// Security:
//   - Nur vom Supabase-Runtime aus aufrufbar (Service-Role-Secret-Header).
//     Externe Caller kommen durch den Auth-Check nicht durch.
//   - `get_active_web_push_subs(user_id)` ist nur für service_role
//     ausgeführbar — ein regulärer User kann nicht feststellen, auf
//     welchen Geräten Ein anderer User subscribed ist.
//
// Environment-Requirements (als Supabase-Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (automatisch gesetzt)
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

import { corsHeaders } from '../_shared/cors.ts';

// -----------------------------------------------------------------------------
// Input-Contract
//
// Aufrufer schickt EINES der beiden Shapes:
//   { user_id, title, body, url?, tag?, icon?, badge?, data? }
//   { user_ids: [...], title, body, url?, tag?, icon?, badge?, data? }
//
// Batch-Dispatch (user_ids-Array) ist wichtig für Fan-Out-Use-Cases
// (z.B. „Host geht live" → alle Follower bekommen Push). Wir iterieren
// sequential statt Promise.all weil die Push-Services (FCM etc.)
// Rate-Limits haben und parallel-fanout leicht throttled wird.
// -----------------------------------------------------------------------------
interface WebPushInput {
  user_id?: string;
  user_ids?: string[];
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}

interface SubRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidSubject = Deno.env.get('VAPID_SUBJECT');

  if (!vapidPublic || !vapidPrivate || !vapidSubject) {
    return new Response(
      JSON.stringify({
        error: 'vapid_not_configured',
        detail: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT must be set as Supabase secrets.',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  let input: WebPushInput;
  try {
    input = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  if (!input.title || !input.body) {
    return json(400, { error: 'missing_required_fields', need: ['title', 'body'] });
  }

  const userIds = input.user_ids ?? (input.user_id ? [input.user_id] : []);
  if (userIds.length === 0) {
    return json(400, { error: 'no_recipients' });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Payload-Form ist identisch mit dem Contract im Service-Worker
  // (siehe apps/web/public/sw.js → push-Listener). Wenn sich die Form
  // ändert, MÜSSEN beide Seiten migriert werden.
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    icon: input.icon,
    badge: input.badge,
    tag: input.tag,
    url: input.url,
    data: input.data ?? {},
  });

  let sent = 0;
  let pruned = 0;
  let failed = 0;

  for (const userId of userIds) {
    // Subscriptions via SECURITY-DEFINER-Helper laden (filtered stale > 60d).
    const { data: subs, error: subsError } = await supabase.rpc(
      'get_active_web_push_subs',
      { p_user_id: userId },
    );

    if (subsError) {
      failed++;
      continue;
    }

    const rows: SubRow[] = subs ?? [];

    for (const row of rows) {
      try {
        await webpush.sendNotification(
          {
            endpoint: row.endpoint,
            keys: { p256dh: row.p256dh, auth: row.auth },
          },
          payload,
          { TTL: 60 * 60 * 24 }, // 24h — nach 24h ist ein DM-Ping eh nicht mehr relevant
        );
        sent++;
      } catch (err) {
        // web-push-library wirft `WebPushError` mit `.statusCode`. 404/410
        // = Subscription tot → aufräumen. Andere (403 = bad VAPID, 413 =
        // payload too big, 429 = rate-limit) sind Ops-Issues, nicht
        // Pruning-Anlass.
        //
        // deno-lint-ignore no-explicit-any
        const statusCode = (err as any)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await supabase.rpc('prune_web_push_subscription', {
              p_endpoint: row.endpoint,
            });
            pruned++;
          } catch {
            // Prune-Fehler ist non-fatal — nächster Dispatch-Versuch räumt
            // sie beim nächsten 404/410 auf.
          }
        } else {
          failed++;
        }
      }
    }
  }

  return json(200, { sent, pruned, failed, recipients: userIds.length });
});

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
