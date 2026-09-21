// Kategorie wählen — eine Zeile, und dahinter das Blatt.
//
// ⚠️ DIE GESCHICHTE DIESES FELDES, weil sie die Entscheidung erklärt:
//
//   16.08.2026  Eine waagerechte Pillenreihe über elf flache Kategorien. Als
//               der Baum zweiundsiebzig Einträge bekam, wurde daraus zweimal
//               waagerecht: Eltern oben, Kinder darunter.
//   21.09.2026  Im Simulator nachgesehen: Von zwölf Eltern waren DREI zu
//               sehen, und bei einem Artikel in „Uhren" stand die GEWÄHLTE
//               Kategorie ausserhalb des Bildes. Ein Pflichtfeld, dessen Wert
//               man nicht sehen kann, ist kein Feld. → umbrechend.
//   21.09.2026  Zaur, am selben Abend: „kann man die unter kategorie button
//               tun … somit machen wir die seite kürzer". Umbrechend hiess
//               vier Zeilen Eltern plus bis zu drei Zeilen Kinder — rund 300
//               Punkte offen im Formular, für eine Entscheidung, die man
//               einmal trifft.
//
// Beide Male war die Diagnose richtig und die Form falsch. Eine Kachelwand ist
// richtig, wo die Auswahl das THEMA der Seite ist — die Kategorie-Leiste auf
// der Startseite bleibt deshalb, was sie ist. In einem Formular mit vierzehn
// Feldern gehört sie hinter einen Tipp.
//
// ⚠️ Die Auswahl darf auf der OBERKATEGORIE STEHENBLEIBEN. „Mode" ist eine
// gültige Angabe; wer es genauer weiss, verfeinert. Ein Pflichtfeld bis auf die
// unterste Ebene würde nur dazu führen, dass alle die erste Unterkategorie
// nehmen. Deshalb schliesst ein Tipp auf ein Elternteil das Blatt nicht,
// sondern klappt seine Kinder auf.

import { useMemo, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { useCategoryOptions } from '../lib/useCategories';
import { space, ui } from '../theme/tokens';
import { ChoiceField, ChoiceSheet, type Choice } from './ChoiceSheet';

type Props = {
  /** Slug der gewählten Kategorie — Ober- oder Unterkategorie. */
  value: string | null;
  onChange: (slug: string | null) => void;
  label?: string;
  hint?: string;
};

export function CategoryPicker({
  value,
  onChange,
  label = 'Kategorie',
  hint = 'Wähle die passende Kategorie, damit Käufer deinen Artikel beim Stöbern finden.',
}: Props) {
  const { groups } = useCategoryOptions();
  const { fontScale } = useWindowDimensions();
  const [open, setOpen] = useState(false);

  const options = useMemo(
    (): Choice[] =>
      groups.map((group) => ({
        key: group.slug,
        label: group.name,
        children: group.children.map((child) => ({ key: child.slug, label: child.name })),
      })),
    [groups],
  );

  /**
   * „Islamica · Gebetsteppiche" — Ober- UND Unterkategorie in der Zeile.
   *
   * ⚠️ Nur den Kindnamen zu zeigen wäre zu wenig: „Ringe" allein sagt nicht,
   * ob der Artikel unter Schmuck oder unter Sammeln liegt, und genau daran
   * entscheidet sich, wo ihn jemand findet.
   */
  const shown = useMemo(() => {
    if (!value) return null;
    for (const group of groups) {
      if (group.slug === value) return group.name;
      const child = group.children.find((c) => c.slug === value);
      if (child) return `${group.name} · ${child.name}`;
    }
    // Der Baum ist noch nicht geladen, der Wert steht aber schon fest (Bearbeiten).
    return null;
  }, [value, groups]);

  if (groups.length === 0) return null;

  return (
    <>
      <Text key={`label-${fontScale}`} style={s.label}>{label}</Text>
      <ChoiceField
        value={shown}
        placeholder="Kategorie wählen"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
      />

      {/* Ein Satz, nicht drei Zeilen. Er nennt die FOLGE („findet dich
          niemand"), nicht den Mechanismus — der Rest erklärte, bevor jemand
          gefragt hat (sechste Whatnot-Analyse, 19.08.2026). Und nur, solange
          nichts gewählt ist: ein Dauerhinweis neben einer getroffenen
          Entscheidung ist Lärm. */}
      {value ? null : <Text key={fontScale} style={s.hint}>{hint}</Text>}

      <ChoiceSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Kategorie"
        value={value}
        onChange={onChange}
        options={options}
        clearLabel="Keine Kategorie"
      />
    </>
  );
}

const s = StyleSheet.create({
  label: { fontSize: 12, color: ui.textMuted, marginTop: space.md },
  hint: { fontSize: 11, color: ui.textMuted, lineHeight: 16, marginTop: space.xs },
});
