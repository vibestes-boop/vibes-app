// Einladungen und was sie einbringen.
//
// Zwei Seiten, weil Berkat zwei verschiedene Knappheiten hat (Migration
// 20260816130000):
//
//   Käufer gebracht    → 1× Gratis-Versand für ihn sofort,
//                         1× für dich, sobald er zum ersten Mal bezahlt
//   Verkäufer gebracht → 30 Tage provisionsfrei für beide,
//                         sobald er zum ersten Mal etwas verkauft
//
// Nichts davon rechnet der Client. Code erzeugen, einlösen und auszahlen liegt
// vollständig auf dem Server; hier stehen nur Anzeige und Fehlertexte. Eine
// Gutschrift, die eine App selbst anlegen könnte, wäre Falschgeld — deshalb hat
// keine der vier Tabellen eine Schreib-Policy.

import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { SITE_URL } from './links';

export type InvitedPerson = {
  name: string;
  /** Hat schon einmal bezahlt — damit ist die Käufer-Belohnung ausgezahlt. */
  bought: boolean;
  /** Hat schon einmal verkauft — damit ist die Verkäufer-Belohnung ausgezahlt. */
  selling: boolean;
};

export type SellerPerk = {
  days: number;
  reason: string | null;
  /** NULL = die Uhr läuft noch nicht, weil Berkat keine Provision nimmt. */
  starts_at: string | null;
  ends_at: string | null;
};

export type Rewards = {
  /**
   * Ob es für geworbene KÄUFER gerade eine Versand-Gutschrift gibt.
   *
   * Steht ab Werk auf `false`. Nicht aus Vorsicht, sondern weil die Rechnung es
   * verlangt: Eine eingelöste Gutschrift kostet 4,83 € (Pauschale weg, Porto
   * bleibt), und sie rechnet sich erst ab der zweiten Bestellung eines
   * geworbenen Käufers. Die Wiederkaufsrate kennt heute niemand — Phase 0 hat
   * nie begonnen. Die vollständige Herleitung steht im Kopf von
   * `20260816130000_berkat_rewards.sql`.
   *
   * Die Einladungen selbst werden trotzdem verzeichnet. Genau daraus entsteht
   * die Zahl, die vor dem Anschalten fehlt.
   */
  buyer_rewards_enabled: boolean;
  /** Ab diesem Warenwert ist eine Gutschrift einlösbar (Vorgabe 15 €). */
  min_cart_cents: number;
  code: string | null;
  invited_by: string | null;
  invited: InvitedPerson[];
  credits_open: number;
  credits_used: number;
  perks: SellerPerk[];
};

const EMPTY: Rewards = {
  // Der sichere Ausgangswert ist AUS: Scheitert die Abfrage oder fehlt das
  // Feld, verspricht die App lieber nichts als etwas Falsches.
  buyer_rewards_enabled: false,
  min_cart_cents: 1500,
  code: null,
  invited_by: null,
  invited: [],
  credits_open: 0,
  credits_used: 0,
  perks: [],
};

export function useMyRewards(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'rewards', userId],
    enabled: Boolean(userId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<Rewards> => {
      const { data, error } = await supabase.rpc('get_my_rewards');
      if (error) {
        if (__DEV__) console.warn('[Berkat] Belohnungen laden:', error.message);
        throw error;
      }
      return { ...EMPTY, ...((data ?? {}) as Partial<Rewards>) };
    },
  });
}

/**
 * Der eigene Code — wird beim ersten Aufruf serverseitig erzeugt.
 *
 * Bewusst eine eigene Abfrage und nicht Teil von `get_my_rewards`: Die dortige
 * Funktion ist reine Anzeige und darf nichts anlegen. Wer die Belohnungs-Seite
 * nie öffnet, bekommt auch keinen Code — das spart eine Zeile pro Konto, das
 * nie einlädt.
 */
export function useMyReferralCode(userId: string | null) {
  return useQuery({
    queryKey: ['berkat', 'referral-code', userId],
    enabled: Boolean(userId),
    // Ein Code ändert sich nie. Einmal geholt, bleibt er die Sitzung über.
    staleTime: Infinity,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc('get_my_referral_code');
      if (error) {
        if (__DEV__) console.warn('[Berkat] Einladungs-Code:', error.message);
        return null;
      }
      return (data as string) ?? null;
    },
  });
}

export function rewardErrorText(message: string): string {
  if (message.includes('unknown_code'))
    return 'Diesen Code gibt es nicht. Vertippt? Groß- und Kleinschreibung ist egal.';
  if (message.includes('own_code'))
    return 'Das ist dein eigener Code. 🙂 Schick ihn jemandem, der noch nicht dabei ist.';
  if (message.includes('already_claimed'))
    return 'Du hast schon eine Einladung eingelöst — die gilt für immer.';
  if (message.includes('too_late'))
    return 'Einen Code kann man nur vor dem ersten Kauf einlösen. Deiner liegt schon hinter dir.';
  if (message.includes('not_authenticated')) return 'Melde dich an, dann geht es weiter.';
  if (message.includes('does not exist') || message.includes('PGRST202'))
    return 'Die Einladungs-Funktion fehlt noch in der Datenbank. Migration einspielen.';
  // Kein Sammel-Satz: „Das hat nicht geklappt" ist keine Fehlermeldung, sondern
  // eine Sackgasse — sie hat am 15.08.2026 zweimal Zeit gekostet (HANDOFF 3).
  return message ? `Der Server sagt: ${message}` : 'Das hat nicht geklappt.';
}

export function useClaimReferral(userId: string | null) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (code: string) => {
      const { data, error } = await supabase.rpc('claim_referral_code', {
        p_code: code.trim().toUpperCase(),
      });
      if (error) throw error;
      // `credit_granted` sagt, ob wirklich etwas entstanden ist. Bei
      // abgeschaltetem Bonus wird die Einladung verzeichnet, aber keine
      // Gutschrift angelegt — die Erfolgsmeldung darf dann keine versprechen.
      return data as {
        ok: boolean;
        inviter_name: string | null;
        credit_granted: boolean;
      };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'rewards', userId] });
      // Die Gutschrift taucht sofort im Aktivitäts-Reiter auf — ohne das stünde
      // sie dort erst nach einer Minute.
      void queryClient.invalidateQueries({ queryKey: ['berkat', 'activity', userId] });
    },
  });

  return mutation;
}

/**
 * Der Text, der beim Teilen herausgeht.
 *
 * Bewusst mit dem Code IM TEXT und nicht als Deeplink: Wer eingeladen wird, hat
 * die App noch nicht. Ein `berkat://`-Link führt auf seinem Gerät ins Leere, und
 * die Website kennt den Parameter nicht — sie müsste dafür erst eine Seite
 * bekommen (`apps/berkat-web`). Ein abgetippter Code funktioniert heute, auf
 * jedem Weg, auch vorgelesen in einer Sprachnachricht. Genau dafür ist das
 * Alphabet ohne I, O, 0 und 1 gewählt.
 *
 * ⚠️ Der Satz über den geschenkten Versand steht NUR drin, wenn es ihn gibt.
 * Diese Nachricht geht an einen Menschen aus der eigenen Community und wird
 * weitergeleitet — ein Versprechen darin ist schwerer zurückzunehmen als jeder
 * Text in der App.
 */
export function useInviteText(code: string | null, buyerRewardsEnabled: boolean) {
  return useCallback(
    (): string => {
      if (!code) return SITE_URL;
      return [
        'Ich verkaufe bei Berkat — Live-Auktionen, echte Menschen, kein Glücksspiel.',
        buyerRewardsEnabled
          ? `Mit meinem Code ${code} ist dein erster Versand geschenkt.`
          : `Mein Code ist ${code} — trag ihn ein, dann weiß ich, dass du über mich gekommen bist.`,
        SITE_URL,
      ].join('\n\n');
    },
    [code, buyerRewardsEnabled],
  );
}
