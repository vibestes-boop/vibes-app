/**
 * Eine Auswahl als Blatt von unten — statt einer Wand aus Kacheln.
 *
 * ⚠️ WARUM ES DAS GIBT (21.09.2026)
 * Zaur: *„bei artikel einstellen sind alle kategorien aufgelistet, kann man die
 * unter kategorie button tun … somit machen wir die seite kürzer"*.
 *
 * Im Einstell-Formular standen drei Kachelwände offen im Bild:
 *
 *   Kategorie   zwölf Oberkategorien (vier Zeilen) + bis zu elf Kinder
 *   Farbe       dreizehn Kacheln (drei Zeilen)
 *   Zustand     sechs Kacheln (zwei Zeilen)
 *
 * Zusammen rund **370 Punkte** — fast ein ganzer Bildschirm, für drei
 * Entscheidungen, die man je einmal trifft. Eine Kachelwand ist richtig, wenn
 * die Auswahl das Thema der Seite IST (die Kategorie-Leiste auf der
 * Startseite). In einem Formular mit vierzehn Feldern ist sie Ballast: Man
 * sieht sie beim Scrollen immer, braucht sie aber genau einmal.
 *
 * Jetzt: eine Zeile mit der getroffenen Wahl, und dahinter dieses Blatt.
 *
 * ⚠️ EIN BLATT FÜR ALLE DREI. Zustand, Farbe und Kategorie sind dieselbe
 * Handlung — „wähl eins aus einer Liste". Drei Abschriften wären der Fehler,
 * für den es `ListingCard` gibt. Der einzige Unterschied ist die zweite Ebene
 * bei der Kategorie, und die trägt `children`.
 *
 * ⚠️ Helles Blatt, kein `StageSheet`. Dieselbe Falle wie beim Kategorie-Blatt
 * am selben Tag: Die dunkle Fläche gehört der Bühne des Live-Raums, wo ein
 * Video läuft. Über einem hellen Formular sähe sie aus wie ein Stück aus einer
 * fremden App.
 */

import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, ChevronDown } from 'lucide-react-native';

import { radius, space, ui } from '../theme/tokens';
import { useReducedMotion } from '../lib/useReducedMotion';
import { PressFeedback } from './PressFeedback';
import { SheetHeader } from './SheetHeader';

export type Choice = {
  key: string;
  label: string;
  /** Erklärung unter dem Namen — beim Zustand ist sie der rechtliche Maßstab. */
  hint?: string;
  /** Zweite Ebene. Nur die Kategorie hat sie; genau eine Stufe tief. */
  children?: Choice[];
};

export function ChoiceSheet({
  visible,
  onClose,
  title,
  value,
  onChange,
  options,
  clearLabel,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: string | null;
  onChange: (key: string | null) => void;
  options: Choice[];
  /**
   * Zeile ganz oben zum Abwählen („Keine Angabe"). Weglassen, wo die Auswahl
   * Pflicht ist.
   *
   * ⚠️ Ohne sie gäbe es keinen Weg zurück. Bei Kacheln wählte ein zweiter Tipp
   * auf die markierte Kachel ab — in einer Liste erwartet das niemand.
   */
  clearLabel?: string;
}) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [open, setOpen] = useState<string | null>(null);

  /**
   * ⚠️ NUR BEIM ÖFFNEN die Gruppe des gewählten Kindes aufklappen.
   *
   * Der Zweck: Öffnet sich das Blatt mit einer gewählten Unterkategorie, soll
   * deren Gruppe offen sein. Sonst sieht die Liste unmarkiert aus, obwohl eine
   * Wahl getroffen ist — der Nutzer denkt, sie sei weg, und trifft sie noch
   * einmal.
   *
   * ⚠️ `wasVisible` ist kein Zierrat. Ohne die Kante lief der Effekt bei JEDER
   * Wertänderung: Ein Tipp auf „Mode" klappte die Kinder auf, der Effekt fand
   * danach zu „mode" kein Elternteil (ein Elternteil ist kein Kind) und setzte
   * sofort wieder zu. Die Unterkategorien blitzten auf und verschwanden. Der
   * Test `das Auswahlblatt verfeinert …` hat genau das gefangen, bevor es
   * jemand am Gerät sehen musste.
   */
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) {
      const parent = options.find((o) => o.children?.some((c) => c.key === value));
      setOpen(parent ? parent.key : null);
    }
    wasVisible.current = visible;
  }, [visible, value, options]);

  const pick = (key: string | null) => {
    onChange(key);
    onClose();
  };

  return (
    <Modal visible={visible} animationType={reducedMotion ? 'none' : 'slide'} transparent onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose}
          accessibilityLabel="Blatt schließen" accessibilityRole="button" />
        <View style={[s.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <SheetHeader title={title} onClose={onClose} />
          <ScrollView style={s.scroll} contentContainerStyle={s.content}>
            {clearLabel ? (
              <PressFeedback
                style={s.row}
                onPress={() => pick(null)}
                accessibilityRole="button"
                accessibilityState={{ selected: value === null }}
                accessibilityLabel={clearLabel}
              >
                <Text style={[s.label, s.clear]}>{clearLabel}</Text>
                {value === null ? <Check size={18} color={ui.brand} /> : null}
              </PressFeedback>
            ) : null}

            {options.map((option) => {
              const expanded = open === option.key;
              const selfSelected = value === option.key;
              const childSelected = option.children?.some((c) => c.key === value) ?? false;
              return (
                <View key={option.key}>
                  <PressFeedback
                    style={s.row}
                    onPress={() => {
                      // ⚠️ Ein Elternteil SCHLIESST NICHT. „Mode" ist eine
                      // gültige Angabe — wer es genauer weiß, verfeinert
                      // danach. Würde das Blatt hier zugehen, käme man an die
                      // Unterkategorie nur über ein zweites Öffnen.
                      if (option.children?.length) {
                        onChange(option.key);
                        setOpen(expanded ? null : option.key);
                        return;
                      }
                      pick(option.key);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: selfSelected || childSelected, expanded }}
                    accessibilityLabel={option.label}
                  >
                    <View style={s.copy}>
                      <Text style={[s.label, (selfSelected || childSelected) && s.labelOn]}>
                        {option.label}
                      </Text>
                      {option.hint ? <Text style={s.hint}>{option.hint}</Text> : null}
                    </View>
                    {selfSelected ? <Check size={18} color={ui.brand} /> : null}
                    {option.children?.length ? (
                      <ChevronDown size={16} color={ui.textMuted} style={expanded ? s.chevOpen : undefined} />
                    ) : null}
                  </PressFeedback>

                  {expanded && option.children?.length
                    ? option.children.map((child) => (
                        <PressFeedback
                          key={child.key}
                          style={[s.row, s.childRow]}
                          onPress={() => pick(child.key)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: value === child.key }}
                          accessibilityLabel={`${option.label}, ${child.label}`}
                        >
                          <Text style={[s.label, s.childLabel, value === child.key && s.labelOn]}>
                            {child.label}
                          </Text>
                          {value === child.key ? <Check size={18} color={ui.brand} /> : null}
                        </PressFeedback>
                      ))
                    : null}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Der Auslöser — sieht aus wie ein Eingabefeld, ist aber ein Knopf.
 *
 * ⚠️ Bewusst dieselbe graue Fläche wie „Titel" und „Preis in €" daneben, nicht
 * die Kontur einer Navigationszeile. Im Formular steht diese Wahl AUF EINER
 * STUFE mit den getippten Feldern; sähe sie aus wie ein Weg woandershin, läse
 * man sie als Verlassen des Formulars.
 */
export function ChoiceField({
  value,
  placeholder,
  onPress,
  accessibilityLabel,
}: {
  value: string | null;
  placeholder: string;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  return (
    <PressFeedback
      style={f.field}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={value ? `${accessibilityLabel}: ${value}` : accessibilityLabel}
      accessibilityHint="Öffnet die Auswahl"
    >
      <Text numberOfLines={1} style={[f.value, !value && f.placeholder]}>
        {value ?? placeholder}
      </Text>
      <ChevronDown size={18} color={ui.textMuted} />
    </PressFeedback>
  );
}

const f = StyleSheet.create({
  /* ⚠️ Dieselbe Kontur wie `FormInput` — weisse Flaeche, Haarlinie. Die Wahl
     steht im Formular auf einer Stufe mit den getippten Feldern; saehe sie
     anders aus, waere sie eine andere Art von Ding. */
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginTop: space.xs,
    minHeight: 48,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: ui.lineStrong,
    backgroundColor: ui.card,
  },
  value: { flex: 1, minWidth: 0, fontSize: 15, color: ui.text },
  placeholder: { color: ui.textMuted },
});

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    overflow: 'hidden',
    backgroundColor: ui.card,
    borderTopLeftRadius: radius.phone,
    borderTopRightRadius: radius.phone,
    paddingHorizontal: space.md,
    maxHeight: '80%',
  },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  content: { paddingBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 12,
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  /* Eingerückt und ohne eigene Linie oben — die Kinder gehören sichtbar zum
     Elternteil darüber. */
  childRow: { paddingLeft: space.lg },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  label: { flex: 1, fontSize: 15, lineHeight: 21, color: ui.text },
  labelOn: { fontWeight: '700', color: ui.brand },
  childLabel: { fontSize: 14, color: ui.textMuted },
  clear: { color: ui.textMuted },
  hint: { fontSize: 12, lineHeight: 17, color: ui.textMuted },
  chevOpen: { transform: [{ rotate: '180deg' }] },
});
