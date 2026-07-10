/**
 * lib/i18n/useLocaleProfileSync.ts — synct die aktive App-Sprache nach
 * `profiles.locale` (Migration 20260710130000), damit die Edge Function
 * send-push-notification Push-Texte in der Sprache des Empfängers baut.
 *
 * Fire-and-forget: Fehler (z. B. Spalte existiert noch nicht, offline)
 * werden geschluckt — Sprache ist nie ein kritischer Pfad. Ein UPDATE pro
 * Kaltstart/Sprachwechsel/Login (Realtime-Kostenhygiene: kein Channel).
 *
 * Einmal im Root-Layout mounten.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { useI18nStore } from './i18nStore';

export function useLocaleProfileSync() {
  const locale = useI18nStore((s) => s.locale);
  const userId = useAuthStore((s) => s.profile?.id);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('profiles')
      .update({ locale })
      .eq('id', userId)
      .then(({ error }) => {
        if (error && __DEV__) console.warn('[i18n] locale sync failed:', error.message);
      });
  }, [locale, userId]);
}
