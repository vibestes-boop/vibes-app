// Was Berkat dem Käufer geschickt hat — zum Nachlesen.
//
// Bis zum 14.08.2026 war ein Push flüchtig: weggewischt hieß für immer weg. Wer
// den Zuschlag verpasste, fand ihn nirgends wieder — es gab keine Liste. Genau
// das fiel beim ersten Durchlauf auf: Meldung angetippt, im Konto gelandet, und
// die Meldung selbst war verschwunden.
//
// Gelesen wird ausschließlich mit `app = 'berkat'`. Die Tabelle gehört Serlo und
// Berkat gemeinsam; ohne den Filter stünden hier Likes, Follows und
// Parfüm-Bestellungen aus der anderen App.
//
// BEWUSST OHNE REALTIME: Der Push IST das Live-Signal. Wer die App öffnet, holt
// über `refetchOnWindowFocus` und den Fokus-Effekt im Bildschirm den frischen
// Stand. Ein eigener Realtime-Kanal je Nutzer kostet dauerhaft Verbindungen für
// etwas, das ein Abruf beim Öffnen genauso löst.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from './supabase';

/** Die drei Ereignisse, die Berkat an den Käufer schickt. */
export type BerkatNotificationType =
  | 'auction_won'
  | 'order_payment_reminder'
  | 'order_shipped'
  /**
   * Der vorgemerkte Artikel wird JETZT aufgerufen (seit `20260819160000`).
   *
   * ⚠️ Die einzige Berkat-Meldung mit einer Halbwertszeit von Sekunden — eine
   * Auktion dauert zwanzig. Deshalb trägt sie `session_id`: Ein Tipp landet im
   * laufenden Raum, nicht auf einer Übersicht.
   */
  | 'auction_up'
  /**
   * Ein neues Angebot passt zu einer gespeicherten Suche (seit `20260821120000`).
   *
   * ⚠️ `product_name` trägt hier den SUCHBEGRIFF, nicht den Artikelnamen —
   * daraus baut `notificationTarget` das Ziel `/shop?q=…`. Der Artikelname
   * steht in `comment_text`.
   */
  | 'saved_search_hit';

/**
 * Wohin ein Antippen führt — für die LISTE und für den PUSH.
 *
 * ⚠️ DIESE FUNKTION GIBT ES, WEIL ES SIE ZWEIMAL GAB.
 * Am 19.08.2026 im Zwei-Konten-Durchlauf gefunden: Der Push „🔨 Dein Artikel
 * ist dran" kam an, und ein Tipp darauf öffnete **nichts**. Aus der Glocke
 * heraus funktionierte derselbe Weg.
 *
 * Die Ursache waren zwei Wahrheiten über dasselbe Ziel. `app/notifications.tsx`
 * pflegte ein `targetFor` mit acht Fällen — inklusive „direkt in den Raum" —,
 * während `routeFor` in `usePush.ts` seit dem 14.08. drei Typen kannte und für
 * alles andere `null` lieferte. `null` heißt: kein `router.push`, also öffnet
 * der Tipp nur die App. Betroffen waren `auction_up`, `order_paid`, `new_order`,
 * `scheduled_live_reminder`, `live` und `order_review` — die halbe Liste.
 *
 * Am teuersten bei `auction_up`: Die Meldung hat eine Halbwertszeit von
 * Sekunden, und der ganze Zweck war, den Umweg über eine Übersicht zu sparen.
 *
 * Der Push liefert seine Felder in einer anderen Schreibweise als die Tabelle
 * (`sessionId` statt `session_id`) — deshalb nimmt diese Funktion ein minimales
 * Objekt statt einer ganzen Zeile. Wer einen neuen Typ anlegt, ergänzt ihn
 * **hier**, und beide Wege haben ihn.
 *
 * ⚠️ **Nachtrag 20.08.2026: die Vereinheitlichung war zuerst zu grob.** Bei drei
 * Typen unterschieden sich die beiden alten Fassungen nicht aus Versehen,
 * sondern mit Grund: `auction_won`, `order_payment_reminder` und
 * `order_shipped` führten aus einem PUSH auf `/notifications`, aus der Glocke
 * dagegen ins Konto. Der Kommentar am gelöschten `routeFor` sagte auch warum —
 * „wer den Push antippt, hat oft mehr als eine Meldung offen … direkt ins Konto
 * zu springen ließ die Meldung selbst verschwinden", gefunden am 14.08.2026.
 * Beim Zusammenlegen fielen alle drei in den `default`-Zweig, und diese
 * Entscheidung war lautlos weg.
 *
 * Deshalb der zweite Parameter. Die Regel dahinter gilt für alle Typen:
 *
 * > **Eilig und mit eigenem Ziel** (laufende Auktion, zu packende Bestellung) →
 * > direkt dorthin, egal woher der Tipp kam.
 * > **Käufer-Sachen ohne Frist** → aus der Glocke ins Konto, aus einem Push in
 * > die Liste. Aus der Liste heraus wäre die Liste kein Ziel, und von außen
 * > kommend ist sie der Ort, an dem auch alles andere Offene steht.
 *
 * `from` hat bewusst **keine Voreinstellung** — dieselbe Vorsicht wie bei
 * `CropShape` (HANDOFF 3): Nur die Aufrufstelle weiß, woher der Tipp kam, und
 * eine Vorgabe würde die falsche Hälfte still bedienen.
 */
export function notificationTarget(
  n: {
    type: string | null | undefined;
    sessionId?: string | null;
    senderId?: string | null;
    /** Nur bei `saved_search_hit`: das gesuchte Wort, aus `product_name`. */
    query?: string | null;
  },
  from: 'push' | 'list',
): string {
  switch (n.type) {
    // Der Verkäufer packt und trägt die Sendungsnummer ein. Bis zum 16.08.2026
    // führte das auf `/(tabs)/sell` — also an den Anfang eines Reiters, unter
    // dem die Bestellungen ganz unten lagen.
    case 'order_paid':
    case 'new_order':
      return '/orders';
    // Der Artikel läuft JETZT. Jeder Zwischenschritt kostet Sekunden, die es
    // bei einer Zwanzig-Sekunden-Auktion nicht gibt.
    case 'auction_up':
    case 'live':
      return n.sessionId ? `/live/${n.sessionId}` : '/(tabs)/';
    // Zur Erinnerung an einen Termin gibt es noch keine Show — der einzige
    // sinnvolle Ort ist der Verkäufer, der ihn angekündigt hat.
    case 'scheduled_live_reminder':
      return n.senderId ? `/seller/${n.senderId}` : '/(tabs)/';
    // Gespeicherte Suche: zurück ins Regal, MIT dem gesuchten Wort. Ohne den
    // Parameter müsste der Empfänger erneut tippen, was genau den Umweg
    // zurückbrächte, den die gespeicherte Suche abschafft.
    case 'saved_search_hit':
      return n.query ? `/shop?q=${encodeURIComponent(n.query)}` : '/shop';
    // Zuschlag, Zahlungserinnerung, Versand, Bewertung: alles Käufer-Sachen.
    // Siehe die Regel im Kopf: von außen in die Liste, aus der Liste ins Konto.
    default:
      return from === 'push' ? '/notifications' : '/(tabs)/account';
  }
}

export type BerkatNotification = {
  id: string;
  type: string;
  /** Trägt die Einzelheiten: „Wasser · 1,00 €" bzw. „… ist unterwegs · <Nummer>". */
  comment_text: string | null;
  product_name: string | null;
  session_id: string | null;
  read: boolean;
  created_at: string;
  /** Absender-Name, für „von wem" — separat geholt, siehe unten. */
  sender_name: string | null;
  /**
   * Wird gebraucht, um beim Antippen zum richtigen Ort zu springen: Bei einer
   * Termin-Erinnerung gibt es noch keine Show, nur den Menschen, der sie
   * angekündigt hat. Wurde bis zum 16.08.2026 beim Umbau weggeworfen.
   */
  sender_id: string | null;
};

export function useBerkatNotifications(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'notifications', userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<BerkatNotification[]> => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, comment_text, product_name, session_id, read, created_at, sender_id')
        .eq('recipient_id', userId!)
        .eq('app', 'berkat')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        if (__DEV__) console.warn('[Berkat] Benachrichtigungen laden:', error.message);
        throw error;
      }

      const rows = (data ?? []) as Omit<BerkatNotification, 'sender_name'>[];
      if (rows.length === 0) return [];

      // Absender-Namen separat holen, NICHT als eingebettete Beziehung:
      // `sender:profiles(username)` quittiert Supabase mit PGRST200, weil
      // notifications.sender_id auf auth.users zeigt und nicht auf profiles.
      // Die Abfrage liefert dann still eine leere Liste — die Meldungen wären
      // spurlos weg, ohne Fehler in der Oberfläche.
      const senderIds = [...new Set(rows.map((r) => r.sender_id).filter(Boolean))] as string[];
      const names = new Map<string, string>();
      if (senderIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username')
          .in('id', senderIds);
        for (const p of (profiles ?? []) as { id: string; username: string | null }[]) {
          if (p.username) names.set(p.id, p.username);
        }
      }

      return rows.map((row) => ({
        ...row,
        sender_name: row.sender_id ? names.get(row.sender_id) ?? null : null,
      }));
    },
  });
}

/** Wie viele davon sind ungelesen — für das Abzeichen an der Glocke. */
export function useUnreadCount(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'notifications-unread', userId],
    enabled: Boolean(userId),
    staleTime: 15_000,
    refetchOnWindowFocus: true,
    // Meldungen entstehen SERVERSEITIG (Trigger, pg_cron, Webhook) — die App
    // erfährt davon nichts von selbst. Ohne diesen Takt erschien das Abzeichen
    // erst, wenn zufällig etwas anderes ein Nachladen auslöste; am 16.08.2026
    // genau so gemeldet: bezahlt, aber die Glocke blieb leer.
    refetchInterval: 30_000,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('recipient_id', userId!)
        .eq('app', 'berkat')
        .eq('read', false);

      if (error) {
        // Ein fehlendes Abzeichen ist ärgerlich, aber kein Grund, die
        // Startseite scheitern zu lassen.
        if (__DEV__) console.warn('[Berkat] Ungelesen-Zähler:', error.message);
        return 0;
      }
      return count ?? 0;
    },
  });
}

/**
 * Alles als gelesen markieren. Wird beim Öffnen der Liste aufgerufen — wer sie
 * ansieht, hat sie gesehen.
 */
export function useMarkAllRead(userId: string | null) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('recipient_id', userId)
        .eq('app', 'berkat')
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['berkat', 'notifications', userId] });
      qc.invalidateQueries({ queryKey: ['berkat', 'notifications-unread', userId] });
    },
    onError: (err) => {
      if (__DEV__) console.warn('[Berkat] Als gelesen markieren:', (err as Error)?.message ?? err);
    },
  });

  // Stabile Identität, damit ein Fokus-Effekt sie in seine Abhängigkeiten
  // nehmen kann, ohne bei jedem Render neu zu feuern.
  const { mutate } = mutation;
  return useCallback(() => mutate(), [mutate]);
}
