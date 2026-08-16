// Das Regal — was ohne Show kaufbar bleibt.
//
// Lag bis zum 16.08.2026 im Verkaufen-Reiter zwischen Show-Regie und
// Bestellungen. Das war der Grund für eine Verwechslung, die beim ersten
// echten Gebrauch auffiel: Über dem Regal-Formular stand das Formular „Artikel
// auflegen" MIT Bild-Wähler, das Regal-Formular selbst hatte keinen — und es
// sah aus, als müsse man erst oben ein Bild wählen.
//
// Zwei Formulare direkt übereinander, die fast dasselbe tun aber verschiedene
// Ziele haben, sind eine Falle. Jetzt haben sie zwei Orte:
//
//   Verkaufen-Reiter → was JETZT in der Sendung passiert
//   dieser Bildschirm → was DAUERHAFT liegen bleibt
//
// Das Regal ist der ruhigere Job. Er hat keine Frist, aber er ist der einzige
// Grund, warum ein Fremder bei einem Verkäufer etwas tun kann, während der
// nicht sendet — also 94 % der Zeit (HANDOFF 17).

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import {
  standingErrorText,
  useStandingActions,
  useStandingListings,
} from '../lib/useStanding';
import { StandingComposer } from '../components/StandingComposer';
import { StandingShelf } from '../components/StandingShelf';
import { radius, space, ui } from '../theme/tokens';

export default function ShelfScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const myProfile = useSession((s) => s.profile);

  const { data: standing = [], refetch } = useStandingListings(myUserId ?? undefined);
  const actions = useStandingActions(myUserId ?? undefined, myUserId);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );

  const onPull = useCallback(async () => {
    setPulling(true);
    try {
      await refetch();
    } finally {
      setPulling(false);
    }
  }, [refetch]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/sell')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Dein Regal</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={pulling} onRefresh={onPull} tintColor={ui.textMuted} />
        }
      >
        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        <StandingComposer
          busy={actions.create.isPending}
          canWomenOnly={Boolean(myProfile?.women_only_verified)}
          onCreate={(input) =>
            void actions.create
              .mutateAsync(input)
              .then(() => setNotice('Liegt im Regal — ab jetzt kaufbar. 🎉'))
              .catch((e: unknown) =>
                setNotice(standingErrorText(e instanceof Error ? e.message : String(e))),
              )
          }
        />

        <StandingShelf
          listings={standing}
          isOwner
          signedIn
          busyId={busyId}
          // Auf dem eigenen Regal gibt es nichts zu kaufen — der Server ließe
          // es ohnehin nicht zu (`seller_cannot_bid`).
          onBuy={() => {}}
          onCancel={(item) => {
            setBusyId(item.id);
            void actions.cancel
              .mutateAsync(item.id)
              .then(() => setNotice('Zurückgezogen.'))
              .catch((e: unknown) =>
                setNotice(standingErrorText(e instanceof Error ? e.message : String(e))),
              )
              .finally(() => setBusyId(null));
          }}
          emptyText="Noch nichts drin. Trag oben den ersten Artikel ein — er ist dann rund um die Uhr kaufbar, auch wenn du nicht sendest."
        />
      </ScrollView>
    </KeyboardAvoidingView>
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

  notice: {
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: ui.lineStrong,
    padding: space.md,
    marginBottom: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text, lineHeight: 19 },
});
