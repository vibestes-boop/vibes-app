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

    // Push-Token + Notification-Prefs des Empfängers aus profiles holen
    const { data: recipient } = await supabase
      .from('profiles')
      .select('username, push_token, notif_prefs')
      .eq('id', record.recipient_id)
      .single();

    if (!recipient?.push_token) {
      return new Response(JSON.stringify({ skipped: 'No push token' }), { status: 200 });
    }

    // Kanal-Präferenz prüfen — User kann einzelne Benachrichtigungs-Typen deaktivieren
    const TYPE_TO_PREF: Record<string, string> = {
      like:                      'likes',
      comment:                   'comments',
      follow:                    'follows',
      follow_request:            'follows',
      dm:                        'messages',
      live:                      'live',
      live_invite:               'live',
      scheduled_live_reminder:   'live',
      gift:                      'gifts',
      new_order:                 'orders',
      preorder_interest:         'orders',
      preorder_round_open:       'orders',
      order_payment_requested:   'orders',
      order_payment_reminder:    'orders',
      order_paid:                'orders',
      order_shipped:             'orders',
      order_cancelled:           'orders',
      order_address_updated:     'orders',
      order_review:              'orders',
      order_dispute:             'orders',
    };
    const prefKey = TYPE_TO_PREF[record.type];
    const prefs = recipient.notif_prefs as Record<string, boolean> | null;
    if (prefKey && prefs && prefs[prefKey] === false) {
      return new Response(JSON.stringify({ skipped: `Channel ${prefKey} disabled by user` }), { status: 200 });
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
      // Bestell-Lebenszyklus (echtes Geld / Parfüm). comment_text trägt den
      // fertigen Text aus den RPCs/Webhook — als Body verwenden wo sinnvoll.
      preorder_interest: {
        title: '🌸 Neue Vorbestellung',
        body: record.product_name
          ? `${actorName} hat „${record.product_name}" vorbestellt`
          : `${actorName} hat ein Produkt vorbestellt`,
      },
      preorder_round_open: {
        title: '🌸 Sammelbestellung läuft',
        body: record.comment_text
          ?? (record.product_name
            ? `„${record.product_name}" wird gerade gesammelt — jetzt sichern!`
            : 'Eine Sammelbestellung ist offen — jetzt sichern!'),
      },
      order_payment_requested: {
        title: '💶 Zeit zu bezahlen',
        body: record.comment_text ?? 'Deine Vorbestellung ist da — jetzt bezahlen 🌸',
      },
      order_payment_reminder: {
        title: '🌸 Dein Parfüm wartet',
        body: record.comment_text ?? 'Kurz bezahlen — dann geht deine Vorbestellung raus 🌸',
      },
      order_paid: {
        title: '💶 Bestellung bezahlt',
        body: `${actorName} hat bezahlt — bitte versenden 📦`,
      },
      order_shipped: {
        title: '📦 Unterwegs',
        body: record.comment_text ?? 'Dein Parfüm ist unterwegs 📦',
      },
      order_cancelled: {
        title: '🚫 Bestellung storniert',
        body: `${actorName} hat eine Bestellung storniert`,
      },
      order_address_updated: {
        title: '📍 Adresse geändert',
        body: `${actorName} hat die Lieferadresse aktualisiert`,
      },
      order_review: {
        title: '⭐ Neue Bewertung',
        body: record.comment_text ?? `${actorName} hat dich bewertet`,
      },
      order_dispute: {
        title: '⚠️ Problem gemeldet',
        body: record.comment_text ?? 'Ein Problem mit einer Bestellung wurde gemeldet',
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
          // Produkt-Bezug (Shoppable-/Vorbestell-Benachrichtigungen)
          productId: record.product_id,
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
    // Käufer-seitige Bestell-Pings → eigene Bestellungen
    case 'order_payment_requested':
    case 'order_shipped':
      return '/studio/orders?role=buyer';
    // Verkäufer-seitige Bestell-Pings → Verkäufe
    case 'order_paid':
    case 'order_cancelled':
    case 'order_address_updated':
    case 'preorder_interest':
      return '/studio/orders?role=seller';
    case 'order_review':
    case 'order_dispute':
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
    // Bestell-Pings: jede Zustands-Änderung ist eigenständig → keine Sammel-
    // Gruppierung, eindeutig pro Notification-Row.
    case 'order_payment_requested':
    case 'order_paid':
    case 'order_shipped':
    case 'order_cancelled':
    case 'order_address_updated':
    case 'preorder_interest':
    case 'order_review':
    case 'order_dispute':
      return `${record.type}:${record.id}`;
    default:
      return record.type;
  }
}
