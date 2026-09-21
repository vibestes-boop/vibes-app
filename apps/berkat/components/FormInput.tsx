/**
 * Ein Eingabefeld, das aussieht wie eines — und zeigt, wo man gerade ist.
 *
 * ⚠️ WARUM ES DAS GIBT (21.09.2026)
 * Zaur: *„ich kann mich an das komplett graue nicht gewöhnen."*
 *
 * Die Felder im Einstell-Formular trugen `ui.sunken` (`#E7E7E7`) als Fläche.
 * Zwei Probleme, beide unabhängig von der Farbstimmung:
 *
 * **1 · Ein grau gefülltes Feld ist auf dem iPhone die Art, wie das System
 * „abgeschaltet" zeigt.** Wer damit aufgewachsen ist, liest ein volles graues
 * Rechteck als tot, nicht als Einladung. Und `sunken` ist laut `tokens.ts`
 * ausdrücklich für „Chips, Bildplatzhalter, ruhige Flächen" — dieselbe Farbe
 * trug bei uns also die leere Bildfläche, die Kachel und das Tippfeld. Drei
 * Bedeutungen, ein Ton.
 *
 * **2 · Es gab überhaupt keinen Fokus-Zustand.** Beim Tippen änderte sich
 * nichts. Ein Formular, in dem nichts reagiert, wirkt tot — egal wie es
 * eingefärbt ist. Das ist der größere der beiden Punkte, und er hat mit Grau
 * nichts zu tun.
 *
 * Jetzt: weiße Fläche mit Haarlinie, und beim Tippen wird die Linie aubergine.
 * Weniger Grau, ohne dass irgendwo Farbe dazukommt.
 *
 * ⚠️ DIE LINIENSTÄRKE ÄNDERT SICH NICHT, nur ihre Farbe. Ein Rahmen, der beim
 * Hineintippen von 1 auf 2 Punkt wächst, verschiebt den Text um einen halben
 * Punkt — auf jedem Feld, bei jedem Tipp. Das sieht man nicht bewusst, aber
 * man spürt es als Zappeln.
 *
 * ⚠️ EIGENES BAUTEIL, KEIN STIL. Der Fokus ist Zustand, und acht Felder im
 * Formular hätten acht `useState` gebraucht — eine Buchhaltung, bei der beim
 * neunten Feld jemand `onBlur` vergisst. Wer hier ein Feld hinzufügt, bekommt
 * das Verhalten geschenkt.
 */

import { forwardRef, useState } from 'react';
import { StyleSheet, TextInput, type TextInputProps } from 'react-native';

import { radius, space, ui } from '../theme/tokens';

export const FormInput = forwardRef<TextInput, TextInputProps>(function FormInput(
  { style, onFocus, onBlur, ...props },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      ref={ref}
      {...props}
      placeholderTextColor={props.placeholderTextColor ?? ui.textMuted}
      // ⚠️ Die durchgereichten Handler bleiben erhalten. Ein Bauteil, das die
      // Rückrufe seines Aufrufers verschluckt, ist eine Falle, die still
      // wartet — hier gibt es heute keinen solchen Aufrufer, morgen vielleicht.
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[s.input, focused && s.focused, style]}
    />
  );
});

const s = StyleSheet.create({
  input: {
    marginTop: space.md,
    backgroundColor: ui.card,
    borderWidth: 1,
    borderColor: ui.lineStrong,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    fontSize: 15,
    color: ui.text,
  },
  focused: { borderColor: ui.brand },
});
