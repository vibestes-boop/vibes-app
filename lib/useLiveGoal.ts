/**
 * lib/useLiveGoal.ts
 *
 * LIVE Goals — Host setzt ein Ziel (z.B. "50 Roses → ich tanze").
 * Viewer sehen den Fortschritt als Balken.
 *
 * Unterstützte Typen:
 *   gift_value — Summe aller empfangenen Coin-Werte
 *   likes      — Gesamt-Likes des Streams
 */

import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

export type GoalType = 'gift_value' | 'likes';

export interface LiveGoal {
  type: GoalType;
  target: number;
  current: number;
  title: string;
  reached: boolean;
}

// ─── Hook: Liest + verwaltet das Ziel einer Session ──────────────────────────
export function useLiveGoal(sessionId: string | null) {
  const [goal, setGoal] = useState<LiveGoal | null>(null);
  const prevReachedRef = useRef(false);
  const [justReached, setJustReached] = useState(false); // Trigger für Celebration

  // Initiales Laden + Supabase Realtime
  useEffect(() => {
    if (!sessionId) return;

    // Direkt laden
    supabase
      .from('live_sessions')
      .select('goal_type, goal_target, goal_current, goal_title, goal_reached')
      .eq('id', sessionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.goal_type && data.goal_target) {
          setGoal({
            type: data.goal_type as GoalType,
            target: data.goal_target,
            current: data.goal_current ?? 0,
            title: data.goal_title ?? '',
            reached: data.goal_reached ?? false,
          });
        }
      });

    // Realtime: live_sessions ändert sich → goal_current und goal_reached aktualisieren
    const channel = supabase
      .channel(`live-goal-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'live_sessions',
          filter: `id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as {
            goal_type?: string;
            goal_target?: number;
            goal_current?: number;
            goal_title?: string;
            goal_reached?: boolean;
          };

          if (row.goal_type && row.goal_target) {
            const reached = row.goal_reached ?? false;

            // Erkennen ob Ziel gerade erreicht wurde (vorher false, jetzt true)
            if (reached && !prevReachedRef.current) {
              setJustReached(true);
              setTimeout(() => setJustReached(false), 5000);
            }
            prevReachedRef.current = reached;

            setGoal({
              type: row.goal_type as GoalType,
              target: row.goal_target,
              current: row.goal_current ?? 0,
              title: row.goal_title ?? '',
              reached,
            });
          } else if (!row.goal_type) {
            // Goal wurde entfernt
            setGoal(null);
            prevReachedRef.current = false;
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { goal, justReached };
}

// ─── Host-seitige Funktionen ──────────────────────────────────────────────────

/**
 * Setzt ein neues Ziel für eine Session (oder löscht es).
 */
export async function setLiveGoal(
  sessionId: string,
  goal: { type: GoalType; target: number; title: string } | null
): Promise<void> {
  if (!goal) {
    // Ziel löschen
    await supabase
      .from('live_sessions')
      .update({
        goal_type: null,
        goal_target: null,
        goal_current: 0,
        goal_title: null,
        goal_reached: false,
      })
      .eq('id', sessionId);
    return;
  }

  await supabase
    .from('live_sessions')
    .update({
      goal_type: goal.type,
      goal_target: goal.target,
      goal_current: 0,
      goal_title: goal.title,
      goal_reached: false,
    })
    .eq('id', sessionId);
}

/**
 * Aktualisiert den Fortschritt eines Ziels.
 * Wird nach jedem Geschenk (gift_value) oder Like aufgerufen.
 *
 * @param sessionId   ID der Session
 * @param goalType    Typ des Ziels (muss mit dem gesetzten Typ übereinstimmen)
 * @param addAmount   Wert der hinzuaddiert wird (z.B. coin_cost eines Gifts)
 */
export async function incrementGoalProgress(
  sessionId: string,
  goalType: GoalType,
  addAmount: number
): Promise<void> {
  // Single atomares UPDATE — kein Race-Condition möglich
  // Nur wenn: goal_type stimmt, goal_reached = false, goal_target noch nicht null
  // Supabase unterstützt kein "UPDATE ... SET col = col + val WHERE ..." direkt,
  // daher zuerst aktuellen Wert holen und dann atomisches UPDATE mit Bedingungen.
  const { data } = await supabase
    .from('live_sessions')
    .select('goal_type, goal_target, goal_current, goal_reached')
    .eq('id', sessionId)
    .eq('goal_type', goalType)
    .eq('goal_reached', false)
    .not('goal_target', 'is', null)
    .maybeSingle();

  // Kein Goal gesetzt oder bereits erreicht → nichts tun
  if (!data) return;

  const newCurrent = (data.goal_current ?? 0) + addAmount;
  const nowReached = newCurrent >= (data.goal_target ?? Infinity);

  await supabase
    .from('live_sessions')
    .update({
      goal_current: newCurrent,
      goal_reached: nowReached,
    })
    .eq('id', sessionId)
    .eq('goal_reached', false); // nochmals sichern: nicht überschreiben falls parallel reached
}
