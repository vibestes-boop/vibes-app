// Die Sendungen eines Verkäufers — angekündigt und vergangen.
//
// Whatnots Profil hat dafür einen eigenen Reiter, und er beantwortet die Frage,
// die den Sendeplan überhaupt erst wertvoll macht: „Wann kommt der wieder?"
// (HANDOFF 13 — die 80 % Monatsretention kommen daher, dass donnerstags um
// 14:30 dieselbe Person dieselbe Show macht).
//
// Zwei Abfragen, weil es zwei Tabellen sind: `scheduled_lives` trägt die
// Ankündigung, `live_sessions` die tatsächlich gelaufene Sendung. Beide gehören
// Serlo mit — der `app`-Filter ist deshalb Pflicht, sonst stünden Serlo-Lives
// auf einem Berkat-Profil (die Falle vom 14.08., HANDOFF 8).

import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';

export type PastShow = {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  started_at: string | null;
  ended_at: string | null;
  women_only: boolean;
};

export type AnnouncedShow = {
  id: string;
  title: string | null;
  scheduled_at: string;
  women_only: boolean;
};

export function useSellerShows(sellerId: string | undefined) {
  const past = useQuery({
    queryKey: ['berkat', 'seller-past-shows', sellerId],
    enabled: Boolean(sellerId),
    staleTime: 60_000,
    queryFn: async (): Promise<PastShow[]> => {
      const { data, error } = await supabase
        .from('live_sessions')
        .select('id, title, thumbnail_url, started_at, ended_at, women_only')
        .eq('host_id', sellerId!)
        .eq('app', 'berkat')
        .eq('status', 'ended')
        .order('started_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as PastShow[];
    },
  });

  const announced = useQuery({
    queryKey: ['berkat', 'seller-announced-shows', sellerId],
    enabled: Boolean(sellerId),
    staleTime: 60_000,
    queryFn: async (): Promise<AnnouncedShow[]> => {
      const { data, error } = await supabase
        .from('scheduled_lives')
        .select('id, title, scheduled_at, women_only')
        .eq('host_id', sellerId!)
        .eq('app', 'berkat')
        .in('status', ['scheduled', 'reminded'])
        .gt('scheduled_at', new Date().toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as AnnouncedShow[];
    },
  });

  return { past, announced };
}

/**
 * „heute 12:23", „gestern 22:28", „Sa 20:00", sonst „15.08. · 12:34".
 *
 * Die erste Fassung taugte nur für die ZUKUNFT: Sie prüfte `days >= 0 && days
 * < 7` und fiel für alles andere auf ein blankes Datum ohne Uhrzeit zurück.
 * Eine Show, die heute um 12:23 lief, stand damit als „16.08.26" da — also mit
 * der einzigen Angabe, die man ohnehin weiß, und ohne die, die man sucht.
 *
 * ⚠️ Gerechnet wird über KALENDERTAGE, nicht über Millisekunden. `(a - b) /
 * 86_400_000` beantwortet „wie viele 24-Stunden-Blöcke liegen dazwischen" und
 * nicht „welcher Tag ist das" — eine Show von gestern 23:00 wäre um 08:00
 * morgens noch „vor 9 Stunden" und damit fälschlich „heute". Dieselbe
 * Unterscheidung wie bei den wiederkehrenden Terminen (Abschnitt 13).
 */
export function showWhen(iso: string): string {
  const date = new Date(iso);
  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  const midnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((midnight(date) - midnight(new Date())) / 86_400_000);

  if (days === 0) return `heute ${time}`;
  if (days === 1) return `morgen ${time}`;
  if (days === -1) return `gestern ${time}`;
  // Innerhalb einer Woche in beide Richtungen reicht der Wochentag. Weiter weg
  // wird er mehrdeutig — „Sa" könnte drei Wochen her sein.
  if (days > 1 && days < 7) return `${date.toLocaleDateString('de-DE', { weekday: 'short' })} ${time}`;
  if (days < -1 && days > -7)
    return `${date.toLocaleDateString('de-DE', { weekday: 'short' })} ${time}`;
  return `${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · ${time}`;
}
