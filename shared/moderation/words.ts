/**
 * shared/moderation/words.ts
 *
 * 1:1 Port von `lib/liveModerationWords.ts` (Native) — platform-agnostisch.
 * Nutzt Standard-ECMAScript (kein React Native). Funktioniert in Node, Deno,
 * Browsers und React Native.
 *
 * Die Native-Datei könnte perspektivisch durch einen Re-Export aus HIER ersetzt
 * werden (später, um Wortliste wirklich an einer Stelle zu pflegen). Vorerst
 * bleibt sie als Kopie synchron — neue Wörter IMMER in BEIDEN Dateien pflegen,
 * bis die Konsolidierung durchgeführt ist.
 */

export const GLOBAL_BLOCKED_WORDS: readonly string[] = Object.freeze([
  // ── Deutsch ────────────────────────────────────────────────────────────────
  'scheiß',
  'arschloch',
  'wichser',
  'hurensohn',
  'hurentochter',
  'fotze',
  'nutte',
  'vollidiot',
  'wichse',
  'dreckssau',
  'schlampe',
  'spast',
  'spasti',
  'mongo',
  'neger',
  'kanake',
  'zigeuner',

  // ── Englisch ───────────────────────────────────────────────────────────────
  'fuck',
  'shit',
  'asshole',
  'bitch',
  'nigger',
  'cunt',
  'faggot',
  'retard',
  'motherfucker',
  'whore',
  'slut',
]);

function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileWordRegex(word: string): RegExp {
  const normalized = normalizeText(word);
  const escaped = escapeRegExp(normalized);
  return new RegExp(`(?<!\\p{L})${escaped}`, 'iu');
}

const GLOBAL_REGEXES: ReadonlyArray<RegExp> = GLOBAL_BLOCKED_WORDS
  .map((w) => w.trim())
  .filter(Boolean)
  .map(compileWordRegex);

const MAX_HOST_CACHE = 256;
const hostRegexCache = new Map<string, RegExp>();

function getHostRegex(word: string): RegExp | null {
  const key = normalizeText(word);
  if (!key) return null;
  const cached = hostRegexCache.get(key);
  if (cached) return cached;
  if (hostRegexCache.size >= MAX_HOST_CACHE) {
    const firstKey = hostRegexCache.keys().next().value;
    if (firstKey !== undefined) hostRegexCache.delete(firstKey);
  }
  const rx = compileWordRegex(key);
  hostRegexCache.set(key, rx);
  return rx;
}

export function containsBlockedWord(text: string, hostWords: string[] = []): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  for (const rx of GLOBAL_REGEXES) {
    if (rx.test(normalized)) return true;
  }

  for (const hw of hostWords) {
    if (!hw?.trim()) continue;
    const rx = getHostRegex(hw);
    if (rx?.test(normalized)) return true;
  }

  return false;
}
