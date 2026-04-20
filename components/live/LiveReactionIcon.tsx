/**
 * LiveReactionIcon — Custom Serlo/Vibes Live-Reactions
 *
 * TikTok-style in-house reactions. Keine Apple-Smileys — alles pure SVG mit
 * Gradients + Highlights für den premium look.
 *
 * Mapping: Emoji-String (broadcast payload) → SVG-Component.
 * Fallback: unbekanntes Emoji → schlichter Text (damit ältere Clients die
 * Reaktion trotzdem sehen).
 *
 * Reaction-Set (TikTok-ähnlich, April 2026):
 *   ❤️  love       — Herz
 *   🔥  fire       — Flamme
 *   🤣  laugh      — Lachen mit Tränen
 *   👏  clap       — Klatschen
 *   🙌  raise      — Hoch
 */
import React, { memo } from 'react';
import { Text, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';

export type LiveReactionEmoji = '❤️' | '🔥' | '🤣' | '👏' | '🙌';

/** Die 5 offiziellen Serlo-Live-Reactions (Broadcast-Strings). */
export const LIVE_REACTION_EMOJIS: LiveReactionEmoji[] = [
  '❤️', '🔥', '🤣', '👏', '🙌',
];

interface Props {
  /** Emoji-String, wie er im Broadcast-Payload ankommt. */
  emoji: string;
  /** Icon-Größe in px (Breite + Höhe). */
  size?: number;
}

// ────────────────────────────────────────────────────────────────────────────
// Heart
// ────────────────────────────────────────────────────────────────────────────
const HeartIcon = memo(({ size = 36 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="heartBody" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FF5B82" />
        <Stop offset="0.5" stopColor="#FF2D55" />
        <Stop offset="1" stopColor="#C91E3F" />
      </LinearGradient>
      <RadialGradient id="heartGloss" cx="0.35" cy="0.28" rx="0.35" ry="0.25">
        <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.85" />
        <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
      </RadialGradient>
    </Defs>
    <Path
      d="M50 86 C20 66 8 49 8 32 C8 19 18 10 30 10 C39 10 46 15 50 22 C54 15 61 10 70 10 C82 10 92 19 92 32 C92 49 80 66 50 86 Z"
      fill="url(#heartBody)"
    />
    <Ellipse cx="36" cy="28" rx="12" ry="8" fill="url(#heartGloss)" />
  </Svg>
));
HeartIcon.displayName = 'HeartIcon';

// ────────────────────────────────────────────────────────────────────────────
// Fire
// ────────────────────────────────────────────────────────────────────────────
const FireIcon = memo(({ size = 36 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="fireOuter" x1="0.5" y1="0" x2="0.5" y2="1">
        <Stop offset="0" stopColor="#FFB800" />
        <Stop offset="0.55" stopColor="#FF6A00" />
        <Stop offset="1" stopColor="#D1180F" />
      </LinearGradient>
      <LinearGradient id="fireInner" x1="0.5" y1="0.2" x2="0.5" y2="1">
        <Stop offset="0" stopColor="#FFF2A0" />
        <Stop offset="0.6" stopColor="#FFD23A" />
        <Stop offset="1" stopColor="#FF7A00" />
      </LinearGradient>
    </Defs>
    {/* Flammen-Außen-Kontur */}
    <Path
      d="M50 6 C50 18 60 24 64 34 C68 26 70 20 72 18 C78 28 88 40 88 58 C88 78 72 92 50 92 C28 92 12 78 12 58 C12 44 22 36 30 28 C34 34 38 38 40 42 C40 30 46 20 50 6 Z"
      fill="url(#fireOuter)"
    />
    {/* Innere, hellere Flamme */}
    <Path
      d="M50 38 C52 48 58 52 60 60 C62 54 64 50 66 48 C70 56 76 64 76 72 C76 82 64 90 50 90 C36 90 26 82 26 72 C26 64 32 58 38 52 C40 56 42 58 44 60 C44 52 48 46 50 38 Z"
      fill="url(#fireInner)"
    />
    {/* Weißer Hotspot */}
    <Ellipse cx="50" cy="76" rx="8" ry="10" fill="#FFF4C0" opacity="0.9" />
  </Svg>
));
FireIcon.displayName = 'FireIcon';

// ────────────────────────────────────────────────────────────────────────────
// Laugh (Rolling on the floor laughing style)
// ────────────────────────────────────────────────────────────────────────────
const LaughIcon = memo(({ size = 36 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <RadialGradient id="faceBg" cx="0.5" cy="0.4" rx="0.6" ry="0.6">
        <Stop offset="0" stopColor="#FFE770" />
        <Stop offset="0.7" stopColor="#FFC107" />
        <Stop offset="1" stopColor="#E69200" />
      </RadialGradient>
      <LinearGradient id="tearGrad" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#7FD9FF" />
        <Stop offset="1" stopColor="#2AA8E8" />
      </LinearGradient>
    </Defs>
    {/* Gesichts-Kreis */}
    <Circle cx="50" cy="50" r="44" fill="url(#faceBg)" />
    {/* Augen — geschlossene Bögen (lachend) */}
    <Path
      d="M24 42 Q32 32 40 42"
      stroke="#1A1A1A"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
    <Path
      d="M60 42 Q68 32 76 42"
      stroke="#1A1A1A"
      strokeWidth="4"
      strokeLinecap="round"
      fill="none"
    />
    {/* Großes lachendes Maul */}
    <Path
      d="M26 58 Q50 88 74 58 Q62 64 50 64 Q38 64 26 58 Z"
      fill="#1A1A1A"
    />
    {/* Zunge */}
    <Path d="M38 68 Q50 80 62 68 Q56 76 50 76 Q44 76 38 68 Z" fill="#FF5B82" />
    {/* Tränen */}
    <Path
      d="M18 52 Q14 58 16 64 Q22 62 22 56 Q20 54 18 52 Z"
      fill="url(#tearGrad)"
    />
    <Path
      d="M82 52 Q86 58 84 64 Q78 62 78 56 Q80 54 82 52 Z"
      fill="url(#tearGrad)"
    />
  </Svg>
));
LaughIcon.displayName = 'LaughIcon';

// ────────────────────────────────────────────────────────────────────────────
// Clap
// ────────────────────────────────────────────────────────────────────────────
const ClapIcon = memo(({ size = 36 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="clapHand" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFD7A8" />
        <Stop offset="0.5" stopColor="#F5B97D" />
        <Stop offset="1" stopColor="#C97D3C" />
      </LinearGradient>
      <LinearGradient id="clapHandR" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFE3BA" />
        <Stop offset="0.5" stopColor="#F7C590" />
        <Stop offset="1" stopColor="#D18A4A" />
      </LinearGradient>
    </Defs>
    {/* Motion-Linien oben */}
    <Path d="M20 20 L28 28" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />
    <Path d="M50 10 L50 20" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />
    <Path d="M80 20 L72 28" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />
    <Path d="M8 46 L18 46" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />
    <Path d="M92 46 L82 46" stroke="#FFC107" strokeWidth="3" strokeLinecap="round" />

    {/* Linke Hand (rotiert) */}
    <G transform="rotate(-18 38 60)">
      <Path
        d="M22 50 L22 78 Q22 86 30 86 L46 86 Q54 86 54 78 L54 46 Q54 40 49 40 Q44 40 44 46 L44 50 Q44 40 38 40 Q32 40 32 50 Q32 38 26 38 Q20 38 20 50 Q20 36 14 36 Q8 36 8 50 L8 64 Q8 74 18 78 Z"
        fill="url(#clapHand)"
        stroke="#8B5828"
        strokeWidth="1.5"
      />
    </G>
    {/* Rechte Hand (gespiegelt + rotiert) */}
    <G transform="rotate(18 62 60)">
      <Path
        d="M78 50 L78 78 Q78 86 70 86 L54 86 Q46 86 46 78 L46 46 Q46 40 51 40 Q56 40 56 46 L56 50 Q56 40 62 40 Q68 40 68 50 Q68 38 74 38 Q80 38 80 50 Q80 36 86 36 Q92 36 92 50 L92 64 Q92 74 82 78 Z"
        fill="url(#clapHandR)"
        stroke="#8B5828"
        strokeWidth="1.5"
      />
    </G>
  </Svg>
));
ClapIcon.displayName = 'ClapIcon';

// ────────────────────────────────────────────────────────────────────────────
// Raised Hands (Celebrate)
// ────────────────────────────────────────────────────────────────────────────
const RaiseIcon = memo(({ size = 36 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 100 100">
    <Defs>
      <LinearGradient id="raiseHand" x1="0" y1="0" x2="0" y2="1">
        <Stop offset="0" stopColor="#FFE0B8" />
        <Stop offset="0.5" stopColor="#F3B77A" />
        <Stop offset="1" stopColor="#B87232" />
      </LinearGradient>
    </Defs>
    {/* Sparkles */}
    <Path d="M14 14 L18 22 L26 26 L18 30 L14 38 L10 30 L2 26 L10 22 Z" fill="#FFD23A" />
    <Path d="M86 14 L89 20 L95 22 L89 24 L86 30 L83 24 L77 22 L83 20 Z" fill="#FFD23A" />
    <Circle cx="50" cy="10" r="3" fill="#FFD23A" />

    {/* Linke erhobene Hand */}
    <Path
      d="M14 60 Q14 40 24 40 L24 30 Q24 24 30 24 Q34 24 34 30 L34 38 Q34 32 40 32 Q44 32 44 38 L44 44 L44 58 Q44 70 40 78 Q36 88 24 92 L20 92 Q14 86 14 78 Z"
      fill="url(#raiseHand)"
      stroke="#8B5828"
      strokeWidth="1.5"
    />
    {/* Rechte erhobene Hand (gespiegelt) */}
    <Path
      d="M86 60 Q86 40 76 40 L76 30 Q76 24 70 24 Q66 24 66 30 L66 38 Q66 32 60 32 Q56 32 56 38 L56 44 L56 58 Q56 70 60 78 Q64 88 76 92 L80 92 Q86 86 86 78 Z"
      fill="url(#raiseHand)"
      stroke="#8B5828"
      strokeWidth="1.5"
    />
  </Svg>
));
RaiseIcon.displayName = 'RaiseIcon';

// ────────────────────────────────────────────────────────────────────────────
// Public Component
// ────────────────────────────────────────────────────────────────────────────
/**
 * Rendert die passende Serlo-Reaction für einen Broadcast-Emoji-String.
 * Unbekannte Emojis fallen auf nativen Text zurück (Forward-Kompatibilität).
 */
export const LiveReactionIcon = memo(function LiveReactionIcon({
  emoji,
  size = 36,
}: Props) {
  switch (emoji) {
    case '❤️':
    case '\u2764\uFE0F':
    case '❤':
      return <HeartIcon size={size} />;
    case '🔥':
      return <FireIcon size={size} />;
    case '🤣':
      return <LaughIcon size={size} />;
    case '👏':
      return <ClapIcon size={size} />;
    case '🙌':
      return <RaiseIcon size={size} />;
    default:
      // Forward-compat: ältere Clients können weiterhin andere Emojis senden.
      return (
        <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: size * 0.9 }}>{emoji}</Text>
        </View>
      );
  }
});
