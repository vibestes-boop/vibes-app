// -----------------------------------------------------------------------------
// Cross-Platform-Reaktions-Brücke (Web ↔ native App).
//
// Die native App (lib/useLiveSession.ts) sendet/empfängt Live-Reaktionen auf
// Channel `live-reactions-${id}` / event `new-reaction` mit Payload
// { id, user_id, emoji } (echte Emoji). Web nutzt intern semantische Keys
// (heart/fire/...). Früher sendete Web auf `live:${id}` / event `reaction` mit
// Key-Payload — anderer Channel, anderes Event, andere Semantik → Reaktionen
// kreuzten NIE die Plattform. Web vereinheitlicht jetzt auf den App-Vertrag.
// -----------------------------------------------------------------------------

export const REACTION_KEYS = ['heart', 'fire', 'clap', 'laugh', 'wow', 'sad'] as const;
export type ReactionKey = (typeof REACTION_KEYS)[number];

export const APP_REACTION_EVENT = 'new-reaction';

export function appReactionChannel(sessionId: string): string {
  return `live-reactions-${sessionId}`;
}

/** Web-Key → Emoji, das die App-Viewer schweben lassen. */
export const REACTION_KEY_TO_EMOJI: Record<ReactionKey, string> = {
  heart: '❤️',
  fire: '🔥',
  clap: '👏',
  laugh: '🤣',
  wow: '😮',
  sad: '😢',
};

/** App-Emoji → Web-Key (App-Set: ❤️🔥🤣👏🙌). Unbekannt → 'heart'. */
const EMOJI_TO_KEY: Record<string, ReactionKey> = {
  '❤️': 'heart',
  '🔥': 'fire',
  '🤣': 'laugh',
  '😂': 'laugh',
  '👏': 'clap',
  '🙌': 'clap',
  '😮': 'wow',
  '😢': 'sad',
};

export function reactionEmojiToKey(emoji: string): ReactionKey {
  return EMOJI_TO_KEY[emoji] ?? 'heart';
}
