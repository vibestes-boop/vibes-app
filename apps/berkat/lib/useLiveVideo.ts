// Zugangsticket für den LiveKit-Raum.
//
// Die Edge Function `livekit-token` gehört Serlo und prüft alles Wichtige
// serverseitig: Existiert die Session, ist sie aktiv, bin ich wirklich der
// Gastgeber, darf ich einen Frauen-Only-Stream überhaupt sehen. Berkat fragt
// nur — entschieden wird dort. Deshalb kann ein manipulierter Client sich hier
// kein Senderecht erschleichen.

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type LiveAccess = { token: string; url: string };

export type LiveAccessError = 'women_only' | 'followers_only' | 'unavailable';

export function liveAccessErrorText(reason: LiveAccessError): string {
  switch (reason) {
    case 'women_only':
      return 'Diese Show ist nur für Frauen. Frag im Konto nach der Freigabe.';
    case 'followers_only':
      return 'Diese Show ist nur für Follower — folge zuerst, dann geht es los.';
    default:
      return 'Das Video lässt sich gerade nicht öffnen. Der Ton der Auktion läuft weiter.';
  }
}

export function useLiveAccess(
  roomName: string | null | undefined,
  isHost: boolean,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['berkat', 'live-access', roomName, isHost],
    enabled: enabled && Boolean(roomName),
    // Tokens laufen serverseitig ab; eine Stunde ist deutlich kürzer als die
    // Gültigkeit und spart trotzdem jeden Reconnect einen Funktionsaufruf.
    staleTime: 60 * 60_000,
    retry: false,
    queryFn: async (): Promise<LiveAccess> => {
      const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: { roomName, isHost },
      });

      if (error) {
        // Die Function antwortet bei 403 mit einem Grund im Body — den holen
        // wir uns, statt „Fehler" anzuzeigen.
        const body = (error as { context?: { body?: unknown } }).context?.body;
        const text = typeof body === 'string' ? body : '';
        if (text.includes('women_only')) throw new Error('women_only');
        if (text.includes('followers_only')) throw new Error('followers_only');
        throw new Error('unavailable');
      }

      const result = data as { token?: string; url?: string; error?: string } | null;
      if (result?.error === 'women_only') throw new Error('women_only');
      if (result?.error === 'followers_only') throw new Error('followers_only');
      if (!result?.token || !result?.url) throw new Error('unavailable');

      return { token: result.token, url: result.url };
    },
  });
}

export function toLiveAccessError(error: unknown): LiveAccessError {
  const message = error instanceof Error ? error.message : String(error);
  if (message === 'women_only') return 'women_only';
  if (message === 'followers_only') return 'followers_only';
  return 'unavailable';
}
