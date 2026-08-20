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
  | 'auction_up';

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
