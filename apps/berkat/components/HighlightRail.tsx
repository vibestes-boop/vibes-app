// Die Highlight-Scheiben auf dem Verkäufer-Profil.
//
// ⚠️ Sie rendern NICHTS, wenn es keine Highlights gibt und das Profil einem
// anderen gehört. Dieselbe Regel wie beim Story-Ring, beim „Demnächst"-Streifen
// (Übergabe 62, Fund 6) und beim Fuss-Knopf der Kategorie-Seite: Eine leere
// Reihe ist schlimmer als keine — sie sagt „hier ist nichts", und zwar über
// jemanden, der gerade erst anfängt.
//
// Auf dem EIGENEN Profil steht dagegen immer mindestens die „+"-Scheibe. Dort
// ist sie keine Behauptung über andere, sondern eine Einladung.
//
// Rund und nicht eckig, obwohl die Ware hochkant ist: Die Scheibe ist eine
// Sammlung, kein Artikel. Ein 4:5-Kärtchen sähe aus wie ein Angebot, und dann
// wäre der Tipp darauf eine Enttäuschung.

import { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Plus } from 'lucide-react-native';

import type { Highlight } from '../lib/useHighlights';
import { radius, space, ui } from '../theme/tokens';

const SIZE = 66;

type Props = {
  highlights: Highlight[];
  /** Steht das eigene Profil offen? Nur dann gibt es die „+"-Scheibe. */
  isSelf: boolean;
  onOpen: (highlightId: string) => void;
  onCreate: () => void;
};

function HighlightRailInner({ highlights, isSelf, onOpen, onCreate }: Props) {
  if (highlights.length === 0 && !isSelf) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={s.row}
      style={s.wrap}
    >
      {isSelf ? (
        <Pressable
          onPress={onCreate}
          style={({ pressed }) => [s.item, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Neues Highlight anlegen"
        >
          <View style={[s.disc, s.discNew]}>
            <Plus size={22} color={ui.textMuted} strokeWidth={2.2} />
          </View>
          <Text numberOfLines={1} style={s.label}>
            Neu
          </Text>
        </Pressable>
      ) : null}

      {highlights.map((h) => (
        <Pressable
          key={h.id}
          onPress={() => onOpen(h.id)}
          style={({ pressed }) => [s.item, pressed && s.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`${h.title}, ${h.items.length} ${h.items.length === 1 ? 'Bild' : 'Bilder'}`}
        >
          <View style={s.disc}>
            <Image
              source={{ uri: h.cover_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={120}
            />
          </View>
          <Text numberOfLines={1} style={s.label}>
            {h.title}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export const HighlightRail = memo(HighlightRailInner);

const s = StyleSheet.create({
  wrap: { backgroundColor: ui.bg },
  row: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: space.md },
  item: { width: SIZE + 6, alignItems: 'center' },
  pressed: { opacity: 0.6 },

  disc: {
    width: SIZE,
    height: SIZE,
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    overflow: 'hidden',
  },
  // Gestrichelt, damit die leere Scheibe als PLATZ lesbar ist und nicht als
  // Bild, das nicht geladen hat.
  discNew: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: ui.lineStrong,
    backgroundColor: ui.card,
    alignItems: 'center',
    justifyContent: 'center',
  },

  label: {
    marginTop: 5,
    fontSize: 11,
    color: ui.textMuted,
    maxWidth: SIZE + 6,
    textAlign: 'center',
  },
});
