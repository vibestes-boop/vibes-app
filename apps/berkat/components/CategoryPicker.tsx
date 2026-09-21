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

import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useCategoryOptions } from '../lib/useCategories';
import { ui, radius, space } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';

type Props = {
  /** Slug der gewählten Kategorie — Ober- oder Unterkategorie. */
  value: string | null;
  onChange: (slug: string | null) => void;
  /** Welche Oberkategorie gerade aufgeklappt ist. */
  openParent: string | null;
  onOpenParent: (slug: string | null) => void;
  label?: string;
  hint?: string;
};

export function CategoryPicker({
  value,
  onChange,
  openParent,
  onOpenParent,
  label = 'Kategorie',
  hint = 'Wähle die passende Kategorie, damit Käufer deinen Artikel beim Stöbern finden.',
}: Props) {
  const { groups } = useCategoryOptions();
  const { fontScale } = useWindowDimensions();
  if (groups.length === 0) return null;

  const open = groups.find((group) => group.slug === openParent);

  return (
    <>
      <Text key={`label-${fontScale}`} style={s.label}>{label}</Text>

      {/* ⚠️ UMBRECHEND SEIT DEM 21.09.2026 — vorher eine waagerechte Wischreihe.
          Zaur: „das UI versteht man nicht". Am Gerät nachgesehen war es
          schlimmer als unuebersichtlich: Von zwoelf Oberkategorien waren DREI
          zu sehen, und bei einem Artikel in „Uhren" stand die GEWAEHLTE
          Kategorie ausserhalb des Bildes. Ein Pflichtfeld, dessen Wert man
          nicht sehen kann, ist kein Feld, sondern eine Wette.

          Kein Pfeil wie in der Kategorie-Leiste auf der Startseite: Dort
          gehoert die Reihe zum Stoebern und darf lang sein. Hier ist es eine
          einmalige Entscheidung beim Einstellen — da will man alles sehen und
          einmal tippen. Zwoelf Pillen sind vier Zeilen. */}
      <View style={s.row}>
        {groups.map((group) => {
          // Aktiv ist die Oberkategorie auch dann, wenn eines ihrer Kinder
          // gewählt ist — sonst sähe die obere Reihe leer aus, obwohl unten
          // etwas markiert ist.
          const active =
            value === group.slug || group.children.some((child) => child.slug === value);
          return (
            <PressFeedback
              key={`${group.slug}-${fontScale}`}
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
            </PressFeedback>
          );
        })}
      </View>

      {open && open.children.length > 0 ? (
        <View style={[s.row, s.rowChildren]}>
          {open.children.map((child) => {
            const active = value === child.slug;
            return (
              <PressFeedback
                key={`${child.slug}-${fontScale}`}
                // Zweiter Tipp auf dasselbe Kind fällt auf die Oberkategorie
                // zurück statt auf gar nichts — das ist der Schritt, den man
                // meint, wenn man „doch nicht so genau" denkt.
                onPress={() => onChange(active ? open.slug : child.slug)}
                style={[s.childPill, active && s.childPillOn]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[s.childText, active && s.childTextOn]}>{child.name}</Text>
              </PressFeedback>
            );
          })}
        </View>
      ) : null}

      {/* Ein Satz, nicht drei Zeilen. Er nennt die FOLGE („findet dich
          niemand"), nicht den Mechanismus — der Rest erklärte, bevor jemand
          gefragt hat (sechste Whatnot-Analyse, 19.08.2026). */}
      {value ? null : (
        <View style={s.hintWrap}>
          <Text key={fontScale} style={s.hint}>{hint}</Text>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 11, color: ui.textMuted, marginTop: space.md, marginBottom: space.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  rowChildren: { paddingTop: space.sm },

  pill: {
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: ui.sunken,
  },
  /* ⚠️ Markenfarbe, nicht Gold (21.09.2026).
     Dieselbe Begruendung, die in `StandingComposer` schon an `tierOn` steht:
     „Gold traegt in Berkat den Kaufweg, und eine Versandart ist keine
     Kaufhandlung." Fuer die Kategorie gilt sie genauso — sie wurde damals nur
     vergessen. Im Formular standen dadurch die gewaehlte Kategorie und der
     Knopf „Ins Regal legen" in derselben Signalfarbe: einmal eine Auswahl,
     einmal eine Handlung. Jetzt ist Gold im Formular genau EIN Element. */
  pillOn: { backgroundColor: ui.brand },
  pillText: { fontSize: 13, fontWeight: '600', color: ui.text },
  pillTextOn: { color: ui.bg },

  // Die zweite Reihe ist als Kontur gezeichnet, nicht als Fläche — damit auf
  // einen Blick klar bleibt, welche Reihe die übergeordnete ist.
  childPill: {
    paddingHorizontal: space.md,
    minHeight: 44,
    paddingVertical: space.sm,
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
