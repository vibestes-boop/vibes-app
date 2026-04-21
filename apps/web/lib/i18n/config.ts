// i18n-Konfiguration: Sprachen, Default, Fallback.
//
// Architektur-Entscheidung: Cookie-basiert statt URL-basiert (`/de/...`).
// Gründe:
//   (1) Vermeidet eine invasive Restrukturierung aller `app/`-Routen in
//       `app/[locale]/...`. Serlo hat >80 Routen, der Refactor wäre groß.
//   (2) Social-Media-Content ist überwiegend User-Generated und damit
//       mehrsprachig *innerhalb* derselben Route — URL-Prefix wäre irre-
//       führend ("ist /de/u/rusmann das russische Profil?").
//   (3) SEO-Verlust ist akzeptabel weil die primären Landing-Pages
//       (/login, /signup, /shop, /explore) auf Deutsch bleiben und via
//       Accept-Language-Header fürs initiale Rendering reichen.
//
// Wer später URL-basiertes Routing will (für Marketing-Pages z.B.) kann das
// parallel über `app/(marketing)/[locale]/...` einführen ohne diese Basis
// anzurühren.

export const SUPPORTED_LOCALES = ['de', 'ru', 'ce', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'de';

export const LOCALE_COOKIE = 'serlo-locale';

// Für den Locale-Switcher in der UI. `native` = Eigenbezeichnung der Sprache
// (so wie TikTok/Instagram's Locale-Pickers es handhaben — User erkennen
// ihre Muttersprache schneller als den deutschen Namen).
export const LOCALE_LABELS: Record<Locale, { native: string; de: string }> = {
  de: { native: 'Deutsch',     de: 'Deutsch' },
  ru: { native: 'Русский',     de: 'Russisch' },
  ce: { native: 'Нохчийн',     de: 'Tschetschenisch' },
  en: { native: 'English',     de: 'Englisch' },
};

/** BCP-47 Lang-Tag fürs `<html lang="...">`-Attribut. */
export const LOCALE_HTML_LANG: Record<Locale, string> = {
  de: 'de-DE',
  ru: 'ru-RU',
  ce: 'ce-RU', // Chechen in Russia — ISO 639-2 `ce`
  en: 'en-US',
};

/** BCP-47 für `Intl.NumberFormat`/`DateTimeFormat`-Calls (Coins, Uhrzeiten). */
export const LOCALE_INTL: Record<Locale, string> = {
  de: 'de-DE',
  ru: 'ru-RU',
  ce: 'ru-RU', // Chechen uses Cyrillic but Intl fällt zurück auf `ru-RU`
              // für Zahlen-/Datumsformate, weil `ce-RU` in vielen Browsern
              // nicht hinterlegt ist. Reviewen wenn Chrome/Safari das supporten.
  en: 'en-US',
};

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
