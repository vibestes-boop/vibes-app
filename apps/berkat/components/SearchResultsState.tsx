import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { RefreshCw, Search } from 'lucide-react-native';
import { radius, space, ui } from '../theme/tokens';

export type SearchStateProps = {
  loading: boolean;
  error?: unknown;
  onRetry: () => void;
  onSignIn?: () => void;
  needsLogin?: boolean;
};

type Props = SearchStateProps & {
  hasResults: boolean;
  kind: string;
  emptyText: string;
};

/** Gleiche Zustände für jede Trefferart; Cache-Treffer bleiben bei Fehlern sichtbar. */
export function SearchResultsState({ loading, error, onRetry, onSignIn, needsLogin,
  hasResults, kind, emptyText }: Props) {
  if (needsLogin) {
    return <View style={s.notice} accessibilityLiveRegion="polite">
      <Text style={s.title}>Verkäufer finden</Text>
      <Text style={s.body}>Melde dich für die Verkäufersuche an. Artikel kannst du auch ohne Anmeldung finden.</Text>
      <Pressable onPress={onSignIn} accessibilityRole="button" style={({ pressed }) => [s.action, pressed && s.pressed]}>
        <Text style={s.actionText}>Anmelden</Text>
      </Pressable>
    </View>;
  }
  if (loading) {
    if (hasResults) return <View style={s.updating} accessibilityRole="progressbar" accessibilityLabel={`${kind} werden aktualisiert`}>
      <ActivityIndicator size="small" color={ui.brand} /><Text style={s.body}>Wird aktualisiert …</Text>
    </View>;
    return <View accessible accessibilityRole="progressbar" accessibilityLabel={`${kind} werden gesucht`} accessibilityState={{ busy: true }}>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={s.skeletons}>
        {[0, 1, 2].map((key) => <View key={key} style={s.skeletonRow}>
          <View style={s.skeletonPhoto} /><View style={s.skeletonCopy}>
            <View style={s.skeletonTitle} /><View style={s.skeletonDetail} />
          </View>
        </View>)}
      </View>
    </View>;
  }
  if (error) return <View style={s.notice} accessibilityLiveRegion="polite">
    <Text style={s.title}>{hasResults ? 'Aktualisieren hat nicht geklappt' : 'Die Suche braucht einen neuen Versuch'}</Text>
    <Text style={s.body}>{hasResults ? 'Deine bisherigen Treffer bleiben hier. Lade sie noch einmal, um den aktuellen Stand zu sehen.' : `${kind} konnten gerade nicht geladen werden. Versuch es noch einmal.`}</Text>
    <Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={`${kind} erneut suchen`}
      style={({ pressed }) => [s.action, pressed && s.pressed]}>
      <RefreshCw size={16} color={ui.brand} /><Text style={s.actionText}>Erneut versuchen</Text>
    </Pressable>
  </View>;
  if (hasResults) return null;
  return <View style={s.empty} accessibilityLiveRegion="polite">
    <View style={s.icon}><Search size={28} color={ui.brand} strokeWidth={1.6} /></View>
    <Text style={s.title}>Noch kein passender Treffer</Text>
    <Text style={[s.body, s.center]}>{emptyText}</Text>
  </View>;
}

const s = StyleSheet.create({
  notice: { padding: space.lg, backgroundColor: ui.card, borderRadius: radius.lg, gap: space.sm, marginBottom: space.md },
  title: { fontSize: 18, lineHeight: 24, fontWeight: '700', color: ui.text },
  body: { fontSize: 14, lineHeight: 21, color: ui.textMuted, flexShrink: 1 },
  action: { minHeight: 48, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.sm, paddingVertical: space.sm },
  actionText: { fontSize: 14, fontWeight: '600', color: ui.brand, flexShrink: 1 },
  pressed: { opacity: 0.65 },
  empty: { alignItems: 'center', paddingHorizontal: space.lg, paddingVertical: space.xl * 2, gap: space.md },
  center: { textAlign: 'center' },
  icon: { width: 64, height: 64, borderRadius: radius.lg, backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center' },
  updating: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.md },
  skeletons: { gap: space.md },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, backgroundColor: ui.card, borderRadius: radius.md },
  skeletonPhoto: { width: 76, height: 92, backgroundColor: ui.sunken, borderRadius: radius.sm },
  skeletonCopy: { flex: 1, gap: space.md },
  skeletonTitle: { height: 16, width: '85%', backgroundColor: ui.sunken, borderRadius: radius.sm },
  skeletonDetail: { height: 14, width: '50%', backgroundColor: ui.sunken, borderRadius: radius.sm },
});
