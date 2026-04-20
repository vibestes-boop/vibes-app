'use client';

// -----------------------------------------------------------------------------
// useWebPush — Client-Hook für Web-Push-Subscribe / Unsubscribe / Status.
//
// State-Machine:
//   unsupported       → Browser kann kein Web-Push (keine Push-API in window,
//                       oder Safari iOS < 16.4 ohne PWA-Install).
//   denied            → User hat Permission explizit abgelehnt. Nur via
//                       Browser-Settings zurücksetzbar, wir können nichts tun.
//   default           → Permission noch nicht gefragt. CTA anzeigen.
//   subscribed        → Active Subscription vorhanden.
//   pending           → Subscribe/Unsubscribe läuft gerade.
//
// Persistenz:
//   Subscription wird in Supabase-Tabelle `web_push_subscriptions` geschrieben
//   (via RLS-gated insert). `touch_web_push_subscription` wird bei jedem
//   Mount aufgerufen damit `last_seen_at` aktuell bleibt — ohne den Heartbeat
//   würde die 60-Tage-Stale-Cleanup-Logik aktive Nutzer fälschlich prunen.
//
// VAPID:
//   `NEXT_PUBLIC_VAPID_PUBLIC_KEY` muss gesetzt sein. Wird als Base64URL in
//   Uint8Array konvertiert und dem `pushManager.subscribe()` als
//   `applicationServerKey` übergeben.
// -----------------------------------------------------------------------------

import { useCallback, useEffect, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

export type WebPushStatus =
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'subscribed'
  | 'pending';

interface UseWebPushResult {
  status: WebPushStatus;
  error: string | null;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
  /** true, solange die initiale Status-Feststellung läuft */
  isLoading: boolean;
}

// Base64URL → Uint8Array. Standard-Utility für VAPID-applicationServerKey.
// Web-Push-Spec verlangt den Public-Key als binary (nicht als string).
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function supportsWebPush(): boolean {
  if (typeof window === 'undefined') return false;
  if (!('serviceWorker' in navigator)) return false;
  if (!('PushManager' in window)) return false;
  if (!('Notification' in window)) return false;
  return true;
}

// Extrahiert die drei Base64-Felder aus einer PushSubscription, die der
// Server in `web_push_subscriptions` persistieren will.
function extractSubFields(sub: PushSubscription): {
  endpoint: string;
  p256dh: string;
  auth: string;
} | null {
  const p256dhBuf = sub.getKey('p256dh');
  const authBuf = sub.getKey('auth');
  if (!p256dhBuf || !authBuf) return null;

  const b64 = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  return {
    endpoint: sub.endpoint,
    p256dh: b64(p256dhBuf),
    auth: b64(authBuf),
  };
}

export function useWebPush(): UseWebPushResult {
  const [status, setStatus] = useState<WebPushStatus>('pending');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initial-Status-Check + Heartbeat beim Mount.
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        if (!supportsWebPush()) {
          if (!cancelled) {
            setStatus('unsupported');
            setIsLoading(false);
          }
          return;
        }

        const permission = Notification.permission;
        if (permission === 'denied') {
          if (!cancelled) {
            setStatus('denied');
            setIsLoading(false);
          }
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const existing = await registration.pushManager.getSubscription();

        if (cancelled) return;

        if (existing) {
          setStatus('subscribed');
          // Heartbeat — updated last_seen_at damit die Subscription nicht
          // gepruned wird. Fehler hier ist non-fatal (DB-Unreachable etc.),
          // nur Sentry/Log.
          try {
            const supabase = createClient();
            await supabase.rpc('touch_web_push_subscription', {
              p_endpoint: existing.endpoint,
            });
          } catch {
            // No-op — Heartbeat ist best-effort.
          }
        } else if (permission === 'granted') {
          // Permission granted aber keine Subscription (z.B. nach SW-Update
          // oder `pushsubscriptionchange`). Der User hat mal zugestimmt; wir
          // zeigen trotzdem „default" damit er den Re-Subscribe bewusst
          // anstößt — silent re-subscribe hinter dem Rücken wirkt kreepig.
          setStatus('default');
        } else {
          setStatus('default');
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
          setStatus('default');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, []);

  const subscribe = useCallback(async () => {
    setError(null);
    if (!supportsWebPush()) {
      setStatus('unsupported');
      return;
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!vapidPublic) {
      setError(
        'Push-Konfiguration fehlt (NEXT_PUBLIC_VAPID_PUBLIC_KEY). Bitte Server-Konfiguration prüfen.',
      );
      return;
    }

    setStatus('pending');
    try {
      // Permission muss NUTZER-getriggert sein (synchroner Call stack aus
      // Click-Handler) — wir sind aus onClick aufgerufen, also OK.
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'default');
        return;
      }

      const registration = await navigator.serviceWorker.ready;

      // Falls noch keine Sub existiert, neu subscriben. userVisibleOnly=true
      // ist Pflicht auf Chrome — silent push wäre sonst missbrauchbar.
      let sub = await registration.pushManager.getSubscription();
      if (!sub) {
        // `applicationServerKey` erwartet BufferSource. TS-Lib hat einen
        // Hickup bei Uint8Array<ArrayBufferLike> vs ArrayBuffer im DOM-
        // Typ (Shared-ArrayBuffer-Varianten). Wir übergeben das darunter-
        // liegende ArrayBuffer → Runtime-identisch, Types glücklich.
        const keyBytes = urlBase64ToUint8Array(vapidPublic);
        sub = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: keyBytes.buffer.slice(
            keyBytes.byteOffset,
            keyBytes.byteOffset + keyBytes.byteLength,
          ) as ArrayBuffer,
        });
      }

      const fields = extractSubFields(sub);
      if (!fields) {
        setError('Subscription-Keys konnten nicht gelesen werden.');
        setStatus('default');
        return;
      }

      const supabase = createClient();

      // Upsert: wenn `(user_id, endpoint)` bereits existiert, nur
      // `last_seen_at` updaten. Die Tabelle hat `UNIQUE(user_id, endpoint)`,
      // d.h. ON CONFLICT greift. `user_id` kommt aus dem Session-Cookie,
      // muss nicht explizit gesetzt werden — RLS-Policy setzt ohnehin
      // WITH CHECK auth.uid() = user_id, ein gefälschter Client kommt
      // durch den Check nicht durch.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Nicht angemeldet.');
        setStatus('default');
        return;
      }

      const { error: upsertError } = await supabase
        .from('web_push_subscriptions')
        .upsert(
          {
            user_id: user.id,
            endpoint: fields.endpoint,
            p256dh: fields.p256dh,
            auth: fields.auth,
            user_agent:
              typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 500) : null,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,endpoint' },
        );

      if (upsertError) {
        setError(upsertError.message);
        // Rollback der browser-seitigen Subscription — ohne persistierte
        // Row wird der Push-Service eh keine Messages bekommen (Server
        // weiß nicht an wen senden).
        try {
          await sub.unsubscribe();
        } catch {
          /* best-effort */
        }
        setStatus('default');
        return;
      }

      setStatus('subscribed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Subscribe fehlgeschlagen');
      setStatus('default');
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setError(null);
    setStatus('pending');
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();

      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();

        // DB-Row entfernen. Auch wenn das fehlschlägt, ist der Browser
        // unsubscribed und der Push-Service wird 410 Gone zurückgeben,
        // was die Edge-Function dann via `prune_web_push_subscription`
        // nachräumt.
        try {
          const supabase = createClient();
          await supabase
            .from('web_push_subscriptions')
            .delete()
            .eq('endpoint', endpoint);
        } catch {
          /* best-effort */
        }
      }
      setStatus('default');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unsubscribe fehlgeschlagen');
      // Fallback-Status: wenn Unsubscribe scheitert, ist unklar ob noch
      // subscribed — lieber auf default stellen und User neu-subscriben
      // lassen.
      setStatus('default');
    }
  }, []);

  return { status, error, subscribe, unsubscribe, isLoading };
}
