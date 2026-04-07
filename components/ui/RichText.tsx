/**
 * components/ui/RichText.tsx
 * Parst einen String und rendert @mentions und #hashtags als tippbare Spans.
 *
 * - @username  → bold,  navigiert zu /user/[username]
 * - #hashtag   → cyan,  öffnet Explore mit ausgewähltem Tag
 * - Normaler Text → transparent/weiß
 */
import { Text, Pressable, StyleSheet, TextStyle } from 'react-native';
import { router } from 'expo-router';
import * as Haptics from 'expo-haptics';

type Token =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; username: string }
  | { type: 'hashtag'; value: string; tag: string };

/** Teilt einen Fließtext in Token-Liste auf */
function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  // Erkennt @username und #tag (alphanumeric + Unterstriche)
  const PATTERN = /(@[a-zA-Z0-9_]+|#[a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF]+)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = PATTERN.exec(text)) !== null) {
    // Text vor dem Match
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const raw = match[0];
    if (raw.startsWith('@')) {
      tokens.push({ type: 'mention', value: raw, username: raw.slice(1) });
    } else {
      tokens.push({ type: 'hashtag', value: raw, tag: raw.slice(1) });
    }
    lastIndex = match.index + raw.length;
  }

  // Rest-Text nach letztem Match
  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

type Props = {
  text: string;
  /** Basis-Textstyle (Farbe, Größe, usw.) */
  style?: TextStyle | TextStyle[];
  numberOfLines?: number;
  onTextLayout?: (e: { nativeEvent: { lines: unknown[] } }) => void;
};

export function RichText({ text, style, numberOfLines, onTextLayout }: Props) {
  const tokens = tokenize(text);

  return (
    <Text style={style} numberOfLines={numberOfLines} onTextLayout={onTextLayout}>
      {tokens.map((token, i) => {
        if (token.type === 'mention') {
          return (
            <Text
              key={i}
              style={rt.mention}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({ pathname: '/user/[id]', params: { id: token.username } });
              }}
              suppressHighlighting
            >
              {token.value}
            </Text>
          );
        }

        if (token.type === 'hashtag') {
          return (
            <Text
              key={i}
              style={rt.hashtag}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push({
                  pathname: '/(tabs)/explore',
                  params: { tag: token.tag },
                });
              }}
              suppressHighlighting
            >
              {token.value}
            </Text>
          );
        }

        return <Text key={i}>{token.value}</Text>;
      })}
    </Text>
  );
}

const rt = StyleSheet.create({
  mention: {
    color: '#fff',
    fontWeight: '700',
  },
  hashtag: {
    color: '#22D3EE',
    fontWeight: '600',
  },
});
