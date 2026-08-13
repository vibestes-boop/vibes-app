// Herzen im Live-Raum.
//
// Ein Herz ist Applaus, kein Beleg. Es fliegt hoch, verschwindet nach zwei
// Sekunden, und niemand fragt später nach, wer es geschickt hat. Deshalb läuft
// es über Broadcast statt über eine Tabellenzeile pro Tipp: Bei zweihundert
// Zuschauern, die gleichzeitig klatschen, wären das zweihundert Schreibvorgänge
// für etwas, das kein Mensch je wieder liest.
//
// Der Kanal ist bewusst Serlos: `live-reactions-<id>` / `new-reaction` mit
// { id, user_id, emoji }. Damit sieht ein Serlo-Zuschauer die Herzen aus Berkat
// und umgekehrt — dieselbe Show, egal aus welcher App man zuschaut.

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { sendBroadcast, subscribeToBroadcast } from './realtime';

/**
 * Nur ein Emoji. `live_reactions.emoji` lässt per CHECK ohnehin bloß fünf zu,
 * und eine Auswahl zu bauen, hieße den Applaus zu verkomplizieren — bei
 * Whatnot ist er ein einziger Knopf.
 */
export const HEART = '❤️';

const CHANNEL_PREFIX = 'live-reactions-';
const EVENT = 'new-reaction';

/** So lange fliegt ein Herz. Muss über der Animationsdauer liegen. */
const LIFETIME_MS = 2_600;
/** Mehr gleichzeitig sieht niemand, kostet aber jedes einzeln Bildrate. */
const MAX_ON_SCREEN = 14;
/** Ein Schreibvorgang je Applaus-Welle, siehe `countLike`. */
const LIKE_WINDOW_MS = 2_000;

export type LiveReaction = {
  id: string;
  user_id: string;
  emoji: string;
};

export function reactionChannel(sessionId: string): string {
  return `${CHANNEL_PREFIX}${sessionId}`;
}

export type LiveReactions = {
  /** Was gerade fliegt. */
  reactions: LiveReaction[];
  /** Herzen dieser Show — steigt, fällt nie. */
  likes: number;
  /** Ein Herz senden. Ohne angemeldetes Konto passiert nichts. */
  react: () => void;
};

export function useLiveReactions(
  sessionId: string | undefined,
  myUserId: string | null | undefined,
  serverLikes: number,
): LiveReactions {
  const [reactions, setReactions] = useState<LiveReaction[]>([]);
  const [likes, setLikes] = useState(serverLikes);

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const likeGate = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Der Server holt nur nach oben. Ein Zähler, der zwischendurch zurückspringt,
  // sieht kaputt aus — und fachlich kann die Zahl ohnehin nie kleiner werden.
  useEffect(() => {
    setLikes((shown) => Math.max(shown, serverLikes));
  }, [serverLikes]);

  useEffect(() => {
    return () => {
      timers.current.forEach(clearTimeout);
      timers.current = [];
      if (likeGate.current) clearTimeout(likeGate.current);
    };
  }, []);

  const show = useCallback((reaction: LiveReaction) => {
    setReactions((prev) => [...prev, reaction].slice(-MAX_ON_SCREEN));
    setLikes((shown) => shown + 1);

    const timer = setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      timers.current = timers.current.filter((t) => t !== timer);
    }, LIFETIME_MS);
    timers.current.push(timer);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    return subscribeToBroadcast(reactionChannel(sessionId), EVENT, (payload) => {
      const reaction = payload as unknown as LiveReaction;
      if (!reaction?.id || !reaction.emoji) return;
      show(reaction);
    });
  }, [sessionId, show]);

  /**
   * `increment_live_likes` erhöht um genau eins und nimmt keine Anzahl entgegen.
   * Deshalb ein Ruf je Fenster statt je Tipp: der bleibende Zähler zählt
   * Applaus-Wellen, die lebendige Zahl im Raum ist die lokale. Zwanzig
   * Schreibvorgänge pro Sekunde wären der schlechtere Tausch.
   *
   * Sperre am Anfang des Fensters, nicht am Ende — das erste Herz soll sofort
   * zählen, nicht erst, wenn es zwei Sekunden still war.
   */
  const countLike = useCallback(() => {
    if (!sessionId || likeGate.current) return;
    void supabase.rpc('increment_live_likes', { p_session_id: sessionId });
    likeGate.current = setTimeout(() => {
      likeGate.current = null;
    }, LIKE_WINDOW_MS);
  }, [sessionId]);

  const react = useCallback(() => {
    if (!sessionId || !myUserId) return;

    const reaction: LiveReaction = {
      // Nur zum Auseinanderhalten der fliegenden Herzen — nie ein Schlüssel in
      // der Datenbank.
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: myUserId,
      emoji: HEART,
    };

    // Sofort zeigen. Supabase spiegelt den eigenen Broadcast nicht zurück, und
    // ein Herz, das erst nach dem Netzweg erscheint, fühlt sich kaputt an.
    show(reaction);
    sendBroadcast(reactionChannel(sessionId), EVENT, reaction);
    countLike();
  }, [sessionId, myUserId, show, countLike]);

  return { reactions, likes, react };
}
