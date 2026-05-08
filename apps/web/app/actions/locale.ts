'use server';

// Server Action fürs Umstellen der UI-Sprache. Setzt den Locale-Cookie und
// revalidiert den aktuellen Pfad, damit SSR mit den neuen Messages rendert.
//
// Security-/Abuse-Überlegung: Cookie-Write benötigt keine Auth — ist bewusst,
// weil der Switcher auch auf anonymen Landing-Pages nutzbar sein muss.
// Payload (Locale-String) ist strikt validiert gegen SUPPORTED_LOCALES;
// Unbekannte Werte werden ignoriert statt zu crashen.

import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

import { LOCALE_COOKIE, isLocale } from '@/lib/i18n/config';

// 1 Jahr — passend zu Apple/TikTok-Pattern (Sprache ist Long-term-Preference,
// nicht per-Session). Cookie als httpOnly=false damit Client-Side-Scripts
// den Wert auch lesen können (z.B. für `Intl.NumberFormat`-Locale-Pick).
const ONE_YEAR_SECS = 60 * 60 * 24 * 365;

export async function setLocale(value: string, pathToRevalidate?: string) {
  if (!isLocale(value)) {
    // Silent-ignore — Client darf keine unvalidierten Werte setzen. Wir loggen
    // nicht weiter weil das den Logstream bei bösartigen Clients fluten würde.
    return { ok: false as const, error: 'invalid-locale' };
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, value, {
    path: '/',
    maxAge: ONE_YEAR_SECS,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false,
  });

  // Revalidate den Pfad damit die neue Sprache sofort wirkt ohne full-Reload.
  // Wenn kein Pfad mitgegeben wird, revalidieren wir die Root (reicht für die
  // meisten Fälle weil SiteHeader + Layout neu gerendert werden).
  revalidatePath(pathToRevalidate ?? '/', 'layout');

  return { ok: true as const };
}
