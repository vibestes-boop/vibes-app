import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

// -----------------------------------------------------------------------------
// linkify — Konvertiert Plaintext (Bio, Caption, Kommentar) in eine Mischung
// aus Text-Fragmenten und klickbaren <Link>/<a>-Elementen für URLs, @mentions
// und #hashtags. Entspricht Fix D6 aus UI_AUDIT_WEB.md.
//
// Warum kein `dangerouslySetInnerHTML`/regex-replace-to-string: wir brauchen
// echte Next-<Link>-Components für Client-Side-Navigation bei @mentions und
// Hashtags, und wir wollen externe URLs mit target="_blank" + rel-Safe-Attrs.
// Daher parsen wir in React-Nodes.
//
// Punctuation-Bug-Vermeidung: Regex greift URLs/Mentions greedy inkl. möglicher
// trailing Punkte/Kommas/etc. — die ziehen wir danach raus und hängen sie als
// reinen Text hinter den Link, damit "Check https://example.com." einen Link
// auf `https://example.com` ergibt (nicht `https://example.com.` → 404).
//
// Multi-Line-Support: `whitespace-pre-line` auf dem Parent-Container reicht —
// wir traversieren Text-Content linear, Line-Breaks bleiben als rohe `\n`
// erhalten und werden vom CSS gerendert.
// -----------------------------------------------------------------------------

// Unicode-aware:
//   - URLs:     http/https + non-whitespace
//   - @mention: @ + 1-30 Unicode-Letter/Number/Underscore
//   - #hashtag: # + 1-50 Unicode-Letter/Number/Underscore
//
// Die Mention/Hashtag-Längen sind konservativ gegenüber dem App-DB-Schema
// (profiles.username ist typisch <= 30, Hashtag hat kein formales Limit aber
// > 50 Zeichen wäre kein praktischer Tag mehr).
const TOKEN_RE = /(https?:\/\/[^\s<>)\]]+|@[\p{L}\p{N}_]{1,30}|#[\p{L}\p{N}_]{1,50})/gu;

// Trailing Punctuation die von Links abgeschnitten werden soll.
const TRAILING_PUNCT_RE = /[.,!?;:)\]}"'»]+$/;

export interface LinkifyOptions {
  /**
   * CSS-Klasse für die erzeugten Link-Elemente. Default: `text-primary hover:underline`.
   * Überschreibbar falls man z.B. in einem dunklen Overlay andere Akzent-Farbe braucht.
   */
  linkClassName?: string;
}

export function linkify(text: string, options: LinkifyOptions = {}): ReactNode[] {
  if (!text) return [];

  const linkClassName = options.linkClassName ?? 'text-primary hover:underline';

  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;

  for (const match of text.matchAll(TOKEN_RE)) {
    const token = match[0];
    const matchIdx = match.index ?? 0;

    // Text-Fragment vor dem Token
    if (matchIdx > lastIndex) {
      parts.push(text.slice(lastIndex, matchIdx));
    }

    // Trailing-Punct abspalten — Link-Text ist das Clean-Token, Punctuation
    // wird als raw Text nach dem Link eingefügt.
    const trailingMatch = token.match(TRAILING_PUNCT_RE);
    const trailing = trailingMatch ? trailingMatch[0] : '';
    const cleanToken = trailing ? token.slice(0, -trailing.length) : token;

    const key = `lnk-${keyCounter++}`;

    if (cleanToken.startsWith('http')) {
      parts.push(
        <a
          key={key}
          href={cleanToken}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className={linkClassName}
        >
          {cleanToken}
        </a>,
      );
    } else if (cleanToken.startsWith('@')) {
      const username = cleanToken.slice(1);
      // Typed-Routes-Cast: Username ist zur Build-Time unbekannt, also
      // template-literal + as Route (gleiches Pattern wie im Rest des Repos).
      parts.push(
        <Link key={key} href={`/u/${username}` as Route} className={linkClassName}>
          {cleanToken}
        </Link>,
      );
    } else if (cleanToken.startsWith('#')) {
      const tag = cleanToken.slice(1);
      // Hashtag → Suche. `%23` = URL-encoded `#` damit die Suche-Page
      // einen Marker bekommt dass es ein Tag-Query ist.
      parts.push(
        <Link
          key={key}
          href={`/search?q=%23${encodeURIComponent(tag)}` as Route}
          className={linkClassName}
        >
          {cleanToken}
        </Link>,
      );
    } else {
      // Defensiv — sollte durch die Regex nicht erreichbar sein.
      parts.push(token);
    }

    if (trailing) parts.push(trailing);
    lastIndex = matchIdx + token.length;
  }

  // Text-Rest nach dem letzten Match
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}
