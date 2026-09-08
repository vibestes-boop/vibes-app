// Die Merkliste — alles, wo ein Herz drauf ist.
//
// Erreichbar über das Konto. Die Liste zeigt auch VERKAUFTE und ZURÜCKGEZOGENE
// Artikel — mit Etikett statt sie stumm zu verschlucken: „Das, was du wolltest,
// ist weg" ist genau die Auskunft, für die man eine Merkliste hat. Wer den
// toten Eintrag loswerden will, tippt das Herz.
//
// ⚠️ Die Liste selbst steht seit dem 24.08.2026 in `components/SavedList.tsx` —
// sie hat ein zweites Haus bekommen, den Reiter „Gemerkt" auf „Aktivität".
// Hier bleibt nur, was sich zwischen beiden Häusern unterscheidet: Kopfzeile,
// Zurück-Pfeil und die Aufforderung, sich anzumelden.

import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { SavedList } from '../components/SavedList';
import { radius, space, ui } from '../theme/tokens';

export default function SavedScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => goBack('/(tabs)/account')} style={styles.back} accessibilityRole="button" accessibilityLabel="Zurück">
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle} accessibilityRole="header">Gemerkt</Text>
        <View style={styles.back} />
      </View>

      {!myUserId ? (
        <ScrollView contentContainerStyle={[styles.empty, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={styles.emptyIcon}><Heart size={28} color={ui.brand} /></View>
          <Text style={styles.emptyTitle}>Melde dich an</Text>
          <Text style={styles.emptyBody}>
            Speichere deine Favoriten und finde sie auf jedem Gerät wieder.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/login')} accessibilityRole="button">
            <Text style={styles.emptyBtnText}>Anmelden</Text>
          </Pressable>
        </ScrollView>
      ) : (
        <SavedList userId={myUserId} bottomInset={insets.bottom} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  empty: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingTop: space.xl, paddingHorizontal: space.xl, gap: space.sm },
  emptyIcon: { width: 72, height: 72, borderRadius: 24, backgroundColor: ui.card, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  emptyTitle: { fontSize: 21, lineHeight: 28, fontWeight: '700', color: ui.text, textAlign: 'center' },
  emptyBody: { fontSize: 15, color: ui.textMuted, textAlign: 'center', lineHeight: 22, maxWidth: 340 },
  emptyBtn: {
    marginTop: space.sm,
    minHeight: 48,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    backgroundColor: ui.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.card },
});
