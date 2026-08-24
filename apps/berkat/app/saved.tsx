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
import { Pressable, StyleSheet, Text, View } from 'react-native';
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
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Gemerkt</Text>
        <View style={styles.back} />
      </View>

      {!myUserId ? (
        <View style={styles.empty}>
          <Heart size={36} color={ui.sunken} />
          <Text style={styles.emptyTitle}>Melde dich an</Text>
          <Text style={styles.emptyBody}>
            Deine Merkliste hängt an deinem Konto — sonst wäre sie beim nächsten Gerät weg.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/login')}>
            <Text style={styles.emptyBtnText}>Anmelden</Text>
          </Pressable>
        </View>
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
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  empty: { alignItems: 'center', paddingTop: space.xl * 2, paddingHorizontal: space.lg, gap: space.sm },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: ui.text },
  emptyBody: { fontSize: 13, color: ui.textMuted, textAlign: 'center', lineHeight: 19 },
  emptyBtn: {
    marginTop: space.sm,
    height: 44,
    paddingHorizontal: space.xl,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: ui.text },
});
