// Supabase Edge Function: send-push-notification
// Aufgerufen von: DB-Trigger auf notifications-Tabelle
// Sendet via Expo Push API an den Empfänger

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

interface NotificationPayload {
  record: {
    id: string;
    recipient_id: string;  // Empfänger
    sender_id: string;     // Auslöser
    type: string;          // 'like' | 'comment' | 'follow' | 'dm' | 'live' | 'live_invite' | 'gift' | 'new_order' | 'scheduled_live_reminder'
    post_id?: string;
    comment_text?: string;  // bei scheduled_live_reminder: Titel des geplanten Lives
    session_id?: string;   // Live-Session ID
    gift_name?: string;    // Gift-Name für Notification-Text
    gift_emoji?: string;   // Gift-Emoji für Notification-Text
    product_name?: string; // Produkt-Name für new_order
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
      live:         { title: '🔴 Live auf Serlo',    body: `${actorName} ist jetzt LIVE!${record.comment_text ? ` — ${record.comment_text}` : ''}` },
      live_invite:  { title: '🎥 Live-Einladung',    body: `${actorName} hat dich in sein Live eingeladen!` },
      gift:         { title: `${record.gift_emoji ?? '🎁'} Geschenk erhalten`, body: `${actorName} hat dir ${record.gift_emoji ?? '🎁'} ${record.gift_name ?? 'ein Geschenk'} geschickt!` },
      new_order:    { title: '🛍️ Neuer Verkauf!',   body: record.product_name ? `${actorName} hat "${record.product_name}" gekauft` : `${actorName} hat ein Produkt gekauft` },
      // v1.26.0 — Scheduled Lives. Ausgelöst vom scheduled-lives-cron 15 min
      // vor go-live. comment_text enthält den Titel des geplanten Lives.
      scheduled_live_reminder: {
        title: '🔔 Gleich live',
        body: record.comment_text
          ? `${actorName} startet in 15 Min: „${record.comment_text}"`
          : `${actorName} geht in 15 Minuten live!`,
      },
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
          // Follow-/Gift-Bezug (Sender-Profil)
          senderId: record.sender_id,
          // Live-Bezug
          session_id: record.session_id,
          // DM-Bezug
          conversationId: record.type === 'dm' ? record.post_id : undefined,
          senderUsername: actorName,
          // Gift-Bezug
          giftName:  record.gift_name,
          giftEmoji: record.gift_emoji,
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
