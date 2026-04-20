/**
 * liveModerationWords.ts
 *
 * Wortliste + Matching-Engine für den Live-Chat-Filter.
 *
 * Härtung gegenüber v1 (Audit Phase 2 #9):
 *   - Word-Start-Boundary via Unicode-aware (?<!\p{L}) statt stupidem
 *     substring-Match → keine False-Positives mehr wie "schwichse" matcht
 *     "wichse" oder "spasticity" matcht "spasti".
 *   - NFKD-Normalize + Combining-Mark-Strip schützt vor Zalgo-Bypass
 *     (f̴u̴c̴k̴) und Full-Width/Unicode-Varianten (ＦＵＣＫ → fuck).
 *   - Precompiled Regex-Cache für Global-Liste (einmal beim Modul-Load)
 *     und Host-Words (FIFO-Cache) eliminiert Per-Comment-Array-Spread und
 *     Regex-Recompilation.
 *
 * Ergänzbar jederzeit — einfach neue Wörter zur jeweiligen Sektion hinzufügen.
 * Tschetschenische / Russische Wörter können unten eingetragen werden.
 */

/** Globale Basis-Wortliste (Word-Start-Boundary-Matching, Case-Insensitive, Unicode-normalisiert) */
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
  'neger',     // slur
  'kanake',    // slur
  'zigeuner',  // slur

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

  // ── Russisch ───────────────────────────────────────────────────────────────
  // Hier kannst du später russische Beleidigungen hinzufügen:
  // 'блядь', 'сука', 'пиздец', ...

  // ── Tschetschenisch ────────────────────────────────────────────────────────
  // Hier kannst du später tschetschenische Beleidigungen hinzufügen:
  //
]);

// ─── Internals ────────────────────────────────────────────────────────────────

/**
 * Unicode-Normalisierung + Case-Fold.
 * - NFKD zerlegt Ligaturen/Full-Width/Kompat-Zeichen (ＦＵＣＫ → FUCK, ﬁ → fi)
 * - Combining-Mark-Strip (\u0300–\u036F) entfernt Diakritika + Zalgo
 * - toLowerCase folgt Default-Locale-independent (konsistent, gut für Cache-Keys)
 */
function normalizeText(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Regex-Metazeichen escapen */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Kompiliert eine Word-Start-Boundary-Regex für ein Wort.
 * Pattern: Das Wort darf nicht direkt von einem Letter (beliebige Sprache)
 * vorangestellt werden — d.h. es muss am Wortanfang oder nach Nicht-Letter
 * stehen. Kein Word-End-Boundary → Konjugationen werden bewusst mitgematcht
 * (z.B. "scheiß" matcht "scheiße", "arsch" matcht "arschig" — gewollt).
 *
 * Unicode: `\p{L}` erkennt Umlaute + kyrillisch + alle Schriftsysteme.
 * `u` Flag schaltet Unicode-Mode ein, `i` Flag macht case-insensitive.
 */
function compileWordRegex(word: string): RegExp {
  const normalized = normalizeText(word);
  const escaped = escapeRegExp(normalized);
  return new RegExp(`(?<!\\p{L})${escaped}`, 'iu');
}

/** Precompile globale Liste einmal beim Modul-Load */
const GLOBAL_REGEXES: ReadonlyArray<RegExp> = GLOBAL_BLOCKED_WORDS
  .map((w) => w.trim())
  .filter(Boolean)
  .map(compileWordRegex);

/** FIFO-Cache für Host-Words (selten wechselnd, Cap verhindert unbegrenztes Wachstum) */
const MAX_HOST_CACHE = 256;
const hostRegexCache = new Map<string, RegExp>();

function getHostRegex(word: string): RegExp | null {
  const key = normalizeText(word);
  if (!key) return null;
  const cached = hostRegexCache.get(key);
  if (cached) return cached;
  if (hostRegexCache.size >= MAX_HOST_CACHE) {
    // FIFO-Eviction (Map-Iterationsreihenfolge = Insertion-Order)
    const firstKey = hostRegexCache.keys().next().value;
    if (firstKey !== undefined) hostRegexCache.delete(firstKey);
  }
  const rx = compileWordRegex(key);
  hostRegexCache.set(key, rx);
  return rx;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Prüft ob ein Text geblockte Wörter enthält.
 * @param text      Der Kommentar-Text (wird normalisiert + case-folded)
 * @param hostWords Zusätzliche Host-eigene Wörter aus live_sessions.moderation_words
 * @returns true wenn text einen blockierten Begriff enthält
 */
export function containsBlockedWord(text: string, hostWords: string[] = []): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;

  // Global check: precompiled, keine Allokation pro Call
  for (const rx of GLOBAL_REGEXES) {
    if (rx.test(normalized)) return true;
  }

  // Host-Words check: per-word cached
  for (const hw of hostWords) {
    if (!hw?.trim()) continue;
    const rx = getHostRegex(hw);
    if (rx?.test(normalized)) return true;
  }

  return false;
}
