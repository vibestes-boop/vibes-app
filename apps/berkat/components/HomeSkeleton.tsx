import { StyleSheet, View } from 'react-native';
import { radius, ratio, space, ui } from '../theme/tokens';

/** Statische Platzhalter in den Proportionen des Rasters, ohne Dauerschleife. */
export function HomeSkeleton() {
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel="Entdeckungen werden geladen"
      accessibilityState={{ busy: true }}>
      <View style={s.row} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[0, 1].map((key) => (
          <View key={key} style={s.card}>
            <View style={s.photo} />
            <View style={s.title} />
            <View style={s.detail} />
          </View>
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.md },
  card: { flex: 1, gap: space.md },
  photo: { aspectRatio: ratio.card, borderRadius: radius.md, backgroundColor: ui.sunken },
  title: { width: '78%', height: 16, borderRadius: radius.sm, backgroundColor: ui.sunken },
  detail: { width: '38%', height: 14, borderRadius: radius.sm, backgroundColor: ui.sunken },
});
