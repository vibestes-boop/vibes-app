// Supabase Edge Function: send-push-notification
// Aufgerufen von: DB-Trigger auf notifications-Tabelle
// Sendet via Expo Push API an den Empfänger

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  record: {
    id: string;
    user_id: string;       // Empfänger
    actor_id: string;      // Auslöser
    type: string;          // 'like' | 'comment' | 'follow' | 'dm' | 'live'
    post_id?: string;
    message?: string;
    session_id?: string;   // Live-Session ID (für 'live' type)
  };
}

Deno.serve(async (req: Request) => {
  try {
    const payload: NotificationPayload = await req.json();
    const { record } = payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Push-Token des Empfängers aus profiles holen
    const { data: recipient } = await supabase
      .from('profiles')
      .select('username, push_token')
      .eq('id', record.user_id)
      .single();

    if (!recipient?.push_token) {
      return new Response(JSON.stringify({ skipped: 'No push token' }), { status: 200 });
    }

    // Auslöser-Username holen
    const { data: actor } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', record.actor_id)
      .single();

    const actorName = actor?.username ?? 'Jemand';

    // Notification-Text basierend auf Typ
    const messages: Record<string, { title: string; body: string }> = {
      like:    { title: '❤️ Neuer Like',       body: `${actorName} mag deinen Vibe` },
      comment: { title: '💬 Neuer Kommentar',   body: `${actorName} hat kommentiert` },
      follow:  { title: '👤 Neuer Follower',    body: `${actorName} folgt dir jetzt` },
      dm:      { title: '✉️ Neue Nachricht',    body: record.message ?? `${actorName} schreibt dir` },
      live:    { title: '🔴 Live auf Vibes',     body: `${actorName} ist jetzt LIVE!${record.message ? ` — ${record.message}` : ''}` },
    };

    const msg = messages[record.type] ?? { title: 'Neue Aktivität auf Vibes', body: '' };

    // Expo Push API aufrufen
    const pushRes = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        to: recipient.push_token,
        title: msg.title,
        body: msg.body,
        data: { type: record.type, postId: record.post_id, sessionId: record.session_id },
        sound: 'default',
        priority: 'high',
      }),
    });

    const result = await pushRes.json();
    console.log('[push] Expo response:', JSON.stringify(result));

    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  } catch (err) {
    console.error('[push] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
