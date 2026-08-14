// Fünf Sterne, antippbar.
//
// Bewusst ohne halbe Sterne: Ein Käufer, der gerade ein Paket ausgepackt hat,
// soll in zwei Sekunden fertig sein. Die Feinheit steckt im Kommentarfeld,
// nicht in der Skala.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Star } from 'lucide-react-native';
import { space, ui } from '../theme/tokens';

type Props = {
  value: number;
  onChange?: (rating: number) => void;
  size?: number;
  /** Gesetzt heißt: nur anzeigen, nicht ändern. */
  readOnly?: boolean;
};

const LABELS = ['', 'Gar nicht gut', 'Ging so', 'In Ordnung', 'Gut', 'Alles top'];

export function RatingStars({ value, onChange, size = 30, readOnly }: Props) {
  return (
    <View>
      <View style={styles.row}>
        {[1, 2, 3, 4, 5].map((n) => {
          const filled = n <= value;
          const star = (
            <Star
              size={size}
              color={filled ? ui.gold : ui.lineStrong}
              fill={filled ? ui.gold : 'transparent'}
            />
          );
          if (readOnly) return <View key={n}>{star}</View>;
          return (
            <Pressable
              key={n}
              onPress={() => onChange?.(n)}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={`${n} von 5 Sternen`}
            >
              {star}
            </Pressable>
          );
        })}
      </View>
      {!readOnly && value > 0 ? <Text style={styles.label}>{LABELS[value]}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  label: { fontSize: 12, color: ui.textMuted, marginTop: 4 },
});
