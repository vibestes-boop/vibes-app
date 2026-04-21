/**
 * liveModerationWords.test.ts — Chat-Moderation-Filter.
 *
 * Regression-Anker für v1.27.0 Härtung #2 (Substring-False-Positives +
 * Zalgo-Bypass + Full-Width-Unicode-Fold). Falls jemand das Regex-Pattern
 * späterhin versehentlich lockert, flaggen diese Tests sofort.
 *
 * Hinweis: Der Test-Body enthält offensive Tokens als Fixtures, weil genau
 * die der Filter abdecken muss. Die Fixtures spiegeln den produktiven
 * Wortlisten-Scope.
 */

import { containsBlockedWord } from '../liveModerationWords';

// -----------------------------------------------------------------------------
// Positive Cases — müssen geblockt werden
// -----------------------------------------------------------------------------

describe('containsBlockedWord — positives', () => {
  const cases: Array<[string, string]> = [
    // Basic hit pro Sprache
    ['halt die fresse du arschloch', 'DE: arschloch direkt'],
    ['was für ein wichser', 'DE: wichser'],
    ['fuck you all', 'EN: fuck am wortanfang'],
    ['shit happens here', 'EN: shit am wortanfang (eigener Token)'],

    // Case-insensitivity
    ['ARSCHLOCH', 'UPPERCASE'],
    ['ArschLoch', 'MixedCase'],
    ['ＦＵＣＫ', 'Full-Width ＦＵＣＫ → fuck'],

    // Konjugationen (kein Word-End-Boundary bewusst — "scheiß" matcht "scheiße",
    // "spasti" matcht "spasticity" u.ä.)
    ['so eine scheiße', 'DE: scheiße enthält scheiß am Wortanfang'],
    ['spasticity is a medical term', 'EN: spasti matcht spasticity (Konjugations-Policy, kein Word-End-Boundary)'],

    // NFKD-Normalisierung entfernt Zalgo-Combining-Marks
    ['f\u0334u\u0334c\u0334k\u0334 off', 'Zalgo: f̴u̴c̴k̴'],
    ['a\u0301rschloch', 'Diakritika: árschloch'],
  ];

  it.each(cases)('blocks: %s (%s)', (text) => {
    expect(containsBlockedWord(text)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Negative Cases — dürfen NICHT geblockt werden (ehemalige False-Positives)
// -----------------------------------------------------------------------------

describe('containsBlockedWord — negatives (regression anchors)', () => {
  const cases: Array<[string, string]> = [
    // Word-Start-Boundary greift: Letter davor → kein Match (ehemalige
    // Substring-False-Positives aus v1).
    ['schwichse', 'kein match auf "wichse" mit Letter davor'],
    ['narschmäuler', 'kein match auf "arschloch" wenn Letter davor'],
    ['unfuckingbelievable', 'kein match auf "fuck" wenn Letter davor'],
    ['pischitt am himmel', 'kein match auf "shit" wenn Letter davor'],

    // Harmlos, nur Letter-Mix
    ['Ich bin fasziniert', 'kein blocker'],
    ['Hey Freund, alles gut?', 'kein blocker'],
    ['Sending love', 'kein blocker'],

    // Edge: leer + whitespace-only
    ['', 'leer'],
    ['     ', 'nur whitespace'],
    ['\n\t', 'newlines + tabs'],
  ];

  it.each(cases)('passes through: %s (%s)', (text) => {
    expect(containsBlockedWord(text)).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// Host-Word-Liste — dynamische Wörter aus live_sessions.moderation_words
// -----------------------------------------------------------------------------

describe('containsBlockedWord — host words', () => {
  it('blocks a host-defined word that is not in the global list', () => {
    expect(containsBlockedWord('hey stinker', [])).toBe(false);
    expect(containsBlockedWord('hey stinker', ['stinker'])).toBe(true);
  });

  it('applies word-start-boundary to host words the same way', () => {
    // "ausstinker" hat "stinker" nach einem Letter → kein match
    expect(containsBlockedWord('ausstinker', ['stinker'])).toBe(false);
    // direkt am Wortanfang → match
    expect(containsBlockedWord('stinker loser', ['stinker'])).toBe(true);
  });

  it('is case-insensitive for host words', () => {
    expect(containsBlockedWord('STINKER', ['stinker'])).toBe(true);
    expect(containsBlockedWord('stinker', ['STINKER'])).toBe(true);
  });

  it('ignores empty / whitespace-only host entries', () => {
    // Host-Words-Array mit Garbage darf den Filter nicht crashen
    expect(
      containsBlockedWord('all good here', ['', '   ', '\t', 'nonexistentword']),
    ).toBe(false);
  });

  it('handles a large host-word list without exploding', () => {
    // FIFO-Cache Cap = 256 — mehr Einträge dürfen den Filter nicht kaputt
    // machen (nur die Performance kann leiden, aber Korrektheit bleibt).
    const many = Array.from({ length: 300 }, (_, i) => `customword${i}`);
    expect(containsBlockedWord('harmless text here', many)).toBe(false);
    expect(
      containsBlockedWord('customword42 is here', many),
    ).toBe(true);
  });
});

// -----------------------------------------------------------------------------
// Defensive: Input-Validation
// -----------------------------------------------------------------------------

describe('containsBlockedWord — defensive', () => {
  it('returns false for empty string', () => {
    expect(containsBlockedWord('')).toBe(false);
  });

  it('returns false for whitespace-only', () => {
    expect(containsBlockedWord('   \t\n ')).toBe(false);
  });

  it('accepts default empty host-words array', () => {
    // Kein zweites Argument — Default []
    expect(containsBlockedWord('hello world')).toBe(false);
  });
});
