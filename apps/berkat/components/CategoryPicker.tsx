// Kategorie wählen — zwei Reihen statt einer.
//
// Bis zum 16.08.2026 war das eine einzige waagerechte Pillenreihe über elf
// flache Kategorien. Seit der Baum zweiundsiebzig Einträge hat (Migration
// 20260816150000), wäre dieselbe Reihe unbenutzbar: Wer „Oud & Bakhoor" sucht,
// wischt an sechzig Pillen vorbei.
//
// Deshalb oben die zwölf Oberkategorien, und darunter — erst nach dem Antippen
// — deren Kinder. Zwei Wischbewegungen statt einer langen, und die zweite
// Reihe ist nie länger als elf Einträge.
//
// Die Auswahl darf auf der Oberkategorie STEHENBLEIBEN. „Mode" ist eine
// gültige Angabe; wer es genauer weiß, verfeinert. Ein Pflichtfeld bis auf die
// unterste Ebene würde nur dazu führen, dass alle die erste Unterkategorie
// nehmen.

import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { useCategoryOptions } from '../lib/useCategories';
import { ui, radius, space } from '../theme/tokens';

type Props = {
  /** Slug der gewählten Kategorie — Ober- oder Unterkategorie. */
  value: string | null;
  onChange: (slug: string | null) => void;
  /** Welche Oberkategorie gerade aufgeklappt ist. */
  openParent: string | null;
  onOpenParent: (slug: string | null) => void;
  label?: string;
};

export function CategoryPicker({
  value,
  onChange,
  openParent,
  onOpenParent,
  label = 'Kategorie',
}: Props) {
  const { groups } = useCategoryOptions();
  if (groups.length === 0) return null;

  const open = groups.find((group) => group.slug === openParent);

  return (
    <>
      <Text style={s.label}>{label}</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.row}
        keyboardShouldPersistTaps="handled"
      >
        {groups.map((group) => {
          // Aktiv ist die Oberkategorie auch dann, wenn eines ihrer Kinder
          // gewählt ist — sonst sähe die obere Reihe leer aus, obwohl unten
          // etwas markiert ist.
          const active =
            value === group.slug || group.children.some((child) => child.slug === value);
          return (
            <Pressable
              key={group.slug}
              onPress={() => {
                if (openParent === group.slug) {
                  // Zweiter Tipp: zuklappen und abwählen. Ohne das gäbe es
                  // keinen Weg zurück zu „keine Kategorie".
                  onOpenParent(null);
                  onChange(null);
                } else {
                  onOpenParent(group.slug);
                  onChange(group.slug);
                }
              }}
              style={[s.pill, active && s.pillOn]}
              accessibilityRole="button"
              accessibilityState={{ selected: active, expanded: openParent === group.slug }}
            >
              <Text style={[s.pillText, active && s.pillTextOn]}>{group.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {open && open.children.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[s.row, s.rowChildren]}
          keyboardShouldPersistTaps="handled"
        >
          {open.children.map((child) => {
            const active = value === child.slug;
            return (
              <Pressable
                key={child.slug}
                // Zweiter Tipp auf dasselbe Kind fällt auf die Oberkategorie
                // zurück statt auf gar nichts — das ist der Schritt, den man
                // meint, wenn man „doch nicht so genau" denkt.
                onPress={() => onChange(active ? open.slug : child.slug)}
                style={[s.childPill, active && s.childPillOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.childText, active && s.childTextOn]}>{child.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {value ? null : (
        <View style={s.hintWrap}>
          <Text style={s.hint}>
            Ohne Kategorie liegt der Artikel nur auf deinem Profil — im Kategorien-Reiter
            findet ihn dann niemand, der dich noch nicht kennt.
          </Text>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 11, color: ui.textMuted, marginTop: space.md, marginBottom: space.sm },
  row: { gap: space.sm, paddingRight: space.md },
  rowChildren: { paddingTop: space.sm },

  pill: {
    paddingHorizontal: space.md,
    height: 34,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  pillOn: { backgroundColor: ui.gold },
  pillText: { fontSize: 13, fontWeight: '600', color: ui.text },
  pillTextOn: { color: ui.goldInk },

  // Die zweite Reihe ist als Kontur gezeichnet, nicht als Fläche — damit auf
  // einen Blick klar bleibt, welche Reihe die übergeordnete ist.
  childPill: {
    paddingHorizontal: space.md,
    height: 30,
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.line,
  },
  childPillOn: { borderColor: ui.brand, backgroundColor: ui.card },
  childText: { fontSize: 12, fontWeight: '600', color: ui.textMuted },
  childTextOn: { color: ui.text },

  hintWrap: { marginTop: space.sm },
  hint: { fontSize: 11, color: ui.textMuted, lineHeight: 16 },
});
