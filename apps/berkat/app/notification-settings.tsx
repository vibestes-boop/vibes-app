// Was Berkat auf dein Handy schickt — und was nicht.
//
// ⚠️ WARUM ES DIESEN BILDSCHIRM GIBT
// Berkat schickt Push für acht Anlässe. Bis zum 22.08.2026 gab es keinen
// einzigen Schalter — wem es zu viel wurde, dem blieb nur der Weg über die
// iOS-Einstellungen, und dort gibt es alles oder nichts. Der schaltet dann ALLE
// ab, auch den Zuschlag. Das ist die teuerste Art, einen Käufer zu verlieren:
// Er bleibt in der App und bekommt nichts mehr mit.
//
// ⚠️ DIE LISTE IST KURZ, UND DAS IST DER PUNKT
// Hier stehen nur die Anlässe, deren Wegfall niemandem schadet. Zuschlag,
// Zahlungserinnerung, Versand, neue Bestellung und Streitfall fehlen: Überall
// dort hängt Geld oder eine Frist daran. Die Datenbank hält dieselbe Grenze als
// CHECK (`20260822130000`) — ein Schalter, den jemand später versehentlich
// hier ergänzt, läuft in einen Fehler statt in einen stillen Schaden.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import { MUTABLE_PUSH, usePushMutes, useTogglePushMute } from '../lib/usePushMutes';
import { radius, space, ui } from '../theme/tokens';

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: muted } = usePushMutes(myUserId);
  const toggle = useTogglePushMute(myUserId);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable hitSlop={10} onPress={() => goBack('/(tabs)/account')} style={styles.back}>
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Benachrichtigungen</Text>
        <View style={styles.back} />
      </View>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: space.md,
          paddingBottom: insets.bottom + space.xl,
        }}
      >
        {/* ⚠️ Der wichtigste Satz auf dem Bildschirm. Ohne ihn liest sich jeder
            ausgeschaltete Schalter als „ich erfahre es nicht mehr" — und
            jemand, der das glaubt, schaltet gar nichts ab. */}
        <Text style={styles.lead}>
          Ausgeschaltet heißt: kein Ton, keine Einblendung. Die Meldung steht trotzdem in deiner
          Glocke.
        </Text>

        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        <View style={styles.card}>
          {MUTABLE_PUSH.map((item, index) => {
            const on = !muted?.has(item.type);
            return (
              <View key={item.type} style={[styles.row, index > 0 && styles.rowSplit]}>
                <View style={styles.rowText}>
                  <Text style={styles.rowLabel}>{item.label}</Text>
                  <Text style={styles.rowHint}>{item.hint}</Text>
                </View>
                <Switch
                  value={on}
                  onValueChange={(next) =>
                    void toggle
                      .mutateAsync({ type: item.type, mute: !next })
                      .catch(() => setNotice('Das ließ sich gerade nicht speichern. Nochmal?'))
                  }
                />
              </View>
            );
          })}
        </View>

        {/* ⚠️ Was NICHT abschaltbar ist, gehört genannt — sonst sucht jemand
            danach und hält die Liste für unvollständig. Und der Satz erklärt
            zugleich, warum: Es geht nicht um uns, es geht um sein Geld. */}
        <Text style={styles.footTitle}>Immer an</Text>
        <Text style={styles.footText}>
          Zuschlag, Zahlungserinnerung, Versand, neue Bestellungen und gemeldete Probleme kommen
          weiterhin. Dort hängt Geld oder eine Frist dran — ein Sammelkorb schließt nach 24 Stunden,
          und das soll dir niemand still wegnehmen können.
        </Text>

        <Text style={styles.footText}>
          Ganz ohne Push? Das stellst du in den iPhone-Einstellungen bei Berkat ein — dann kommt
          allerdings auch der Zuschlag nicht mehr an.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: ui.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingBottom: space.sm,
  },
  back: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700', color: ui.text },

  lead: { fontSize: 13, color: ui.textMuted, lineHeight: 19, marginBottom: space.md },

  notice: {
    backgroundColor: ui.sunken,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.sm,
  },
  noticeText: { fontSize: 13, color: ui.text },

  card: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.line,
    paddingHorizontal: space.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md },
  rowSplit: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.line },
  rowText: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: ui.text },
  rowHint: { fontSize: 12, color: ui.textMuted, marginTop: 1, lineHeight: 17 },

  footTitle: { fontSize: 13, fontWeight: '700', color: ui.text, marginTop: space.xl },
  footText: { fontSize: 12, color: ui.textMuted, lineHeight: 18, marginTop: space.xs },
});
