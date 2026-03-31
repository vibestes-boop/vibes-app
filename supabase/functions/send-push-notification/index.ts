// Supabase Edge Function: send-push-notification
// Aufgerufen von: DB-Trigger auf notifications-Tabelle
// Sendet via Expo Push API an den Empfänger

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  record: {
    id: string;
    recipient_id: string;  // Empfänger (DB-Trigger sendet recipient_id)
    sender_id: string;     // Auslöser  (DB-Trigger sendet sender_id)
    type: string;          // 'like' | 'comment' | 'follow' | 'dm' | 'live' | 'live_invite'
    post_id?: string;
    comment_text?: string;
    session_id?: string;   // Live-Session ID (für 'live' / 'live_invite')
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
      .eq('id', record.recipient_id)
      .single();

    if (!recipient?.push_token) {
      return new Response(JSON.stringify({ skipped: 'No push token' }), { status: 200 });
    }

    // Auslöser-Username holen
    const { data: actor } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', record.sender_id)
      .single();

    const actorName = actor?.username ?? 'Jemand';

    // Notification-Text basierend auf Typ
    const messages: Record<string, { title: string; body: string }> = {
      like:         { title: '❤️ Neuer Like',       body: `${actorName} mag deinen Vibe` },
      comment:      { title: '💬 Neuer Kommentar',   body: `${actorName}: "${record.comment_text ?? '...'}"` },
      follow:       { title: '👤 Neuer Follower',    body: `${actorName} folgt dir jetzt` },
      dm:           { title: '✉️ Neue Nachricht',    body: record.comment_text ?? `${actorName} schreibt dir` },
      live:         { title: '🔴 Live auf Vibes',    body: `${actorName} ist jetzt LIVE!${record.comment_text ? ` — ${record.comment_text}` : ''}` },
      live_invite:  { title: '🎥 Live-Einladung',    body: `${actorName} hat dich in sein Live eingeladen!` },
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
        // WICHTIG: Keys müssen exakt mit dem Client-Handler übereinstimmen (usePushNotifications.ts)
        data: {
          type: record.type,
          // Post-Bezug (like, comment)
          postId: record.post_id,
          // Follow-Bezug
          senderId: record.sender_id,
          // Live-Bezug
          session_id: record.session_id,
          // DM-Bezug — conversationId wird vom DB-Trigger als post_id Feld mitgegeben
          conversationId: record.type === 'dm' ? record.post_id : undefined,
          senderUsername: actorName,
        },
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
