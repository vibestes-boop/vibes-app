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

    // ───────────────────────────────────────────────────────────────────────
    // v1.w.12.8 — Web-Push Fan-Out (Serlo Web Parity)
    //
    // Jede notifications-Row wird zusätzlich an send-web-push weitergereicht,
    // damit Web-User (serlo-web.vercel.app) dieselben Benachrichtigungen
    // bekommen wie die Native-App. title/body sind oben schon gebaut (msg),
    // deep-link URL + tag werden typ-abhängig abgeleitet.
    //
    // Skip bei type='dm': DMs haben einen separaten Trigger auf messages
    // (notify_web_push_on_dm → send-web-push direkt), der bereits in
    // v1.w.12.4 live ging. Ein zweiter Web-Push hier würde Doppel-Ping
    // verursachen. Der Expo-Pfad dupliziert NICHT weil DMs genau einen
    // notifications-Eintrag erzeugen und Expo das push_token dedupliziert.
    //
    // Fire-and-forget: Web-Push-Fehler blockieren nie die Expo-Response.
    // ───────────────────────────────────────────────────────────────────────
    if (record.type !== 'dm') {
      try {
        const webUrl = deriveWebUrl(record, actorName);
        const webTag = deriveWebTag(record);
        const webPushRes = await fetch(
          `${Deno.env.get('SUPABASE_URL')!}/functions/v1/send-web-push`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
            },
            body: JSON.stringify({
              user_id: record.recipient_id,
              title: msg.title,
              body: msg.body,
              url: webUrl,
              tag: webTag,
              data: {
                type: record.type,
                senderId: record.sender_id,
                senderUsername: actorName,
                postId: record.post_id,
                sessionId: record.session_id,
              },
            }),
          },
        );
        const webResult = await webPushRes.json().catch(() => ({}));
        console.log('[push] Web-Push response:', JSON.stringify(webResult));
      } catch (webErr) {
        // Non-fatal: Expo-Push ist die primäre Zustellung, Web nur Parity.
        console.warn('[push] Web-Push dispatch failed (non-fatal):', webErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, result }), { status: 200 });
  } catch (err) {
    console.error('[push] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Web-URL-Derivation — wohin klickt der User aus der Browser-Notification?
//
// Routen müssen mit den tatsächlichen apps/web-Pfaden übereinstimmen:
//   /p/[postId], /u/[username], /live/[id], /studio/orders
//
// sender_id ist eine UUID. Für /u/[username] übergeben wir den bereits
// aufgelösten `actorName` (aus dem Expo-Pfad oben geholt). Fällt `actorName`
// auf 'Jemand' zurück (Profil nicht gefunden), gehen wir zur Startseite.
// ─────────────────────────────────────────────────────────────────────────────
function deriveWebUrl(
  record: NotificationPayload['record'],
  actorName: string,
): string {
  const hasActorUsername = actorName && actorName !== 'Jemand';

  switch (record.type) {
    case 'like':
    case 'comment':
      return record.post_id ? `/p/${record.post_id}` : '/';
    case 'follow':
    case 'follow_request':
      return hasActorUsername ? `/u/${actorName}` : '/';
    case 'live':
    case 'live_invite':
    case 'scheduled_live_reminder':
      return record.session_id ? `/live/${record.session_id}` : '/live';
    case 'gift':
      // Live-Gift: zur Live-Session. Shop-Gift (kein session_id): zum Profil
      // des Senders (dort wird das Geschenk Kontext-gegeben kommuniziert).
      if (record.session_id) return `/live/${record.session_id}`;
      return hasActorUsername ? `/u/${actorName}` : '/';
    case 'new_order':
      return '/studio/orders';
    default:
      return '/';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Web-Tag-Derivation — Browser gruppiert Notifications mit gleichem `tag`
// und ersetzt alte durch neue. Wichtig damit z.B. 10 Likes in 2 Sekunden
// nur EINE Notification im Tray erzeugen, nicht zehn.
// ─────────────────────────────────────────────────────────────────────────────
function deriveWebTag(record: NotificationPayload['record']): string {
  switch (record.type) {
    case 'like':
    case 'comment':
      return record.post_id ? `${record.type}:${record.post_id}` : record.type;
    case 'follow':
    case 'follow_request':
      return `follow:${record.sender_id ?? 'unknown'}`;
    case 'live':
    case 'live_invite':
    case 'scheduled_live_reminder':
      return `live:${record.session_id ?? record.sender_id ?? 'unknown'}`;
    case 'gift':
      return `gift:${record.sender_id ?? 'unknown'}:${record.session_id ?? 'shop'}`;
    case 'new_order':
      return `new_order:${record.post_id ?? Date.now()}`;
    default:
      return record.type;
  }
}
