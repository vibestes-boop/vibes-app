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
//
// ── AUS EINEM BLOCK WURDEN ZWEI GRUPPEN (11.09.2026) ──────────────────────
// Am Gerät gemeldet, direkt nach dem Versand-Umbau. Dieselben Muster:
//   1. Grüne System-Schalter — das iOS-Grün kommt sonst nirgends in Berkat
//      vor. `interests.tsx` färbt seine schon in `ui.brand`; jetzt hier auch.
//   2. Sechs Zeilen in einem Block, aber zwei Zielgruppen. „Nur für
//      Verkäufer." stand zweimal als Hinweis — ein Hinweis, der die Arbeit
//      einer Überschrift tat. Jetzt: „Als Käufer" und „Als Verkäufer" wie im
//      Konto (Übergabe 94).
//   3. Zwei Absätze Fußtext, sieben Zeilen. Jetzt zwei Sätze.
// Die Zeilen tragen Haarlinien, die Gruppe die Fläche — kein Rahmen.

import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { useSession } from '../lib/session';
import { goBack } from '../lib/nav';
import {
  MUTABLE_PUSH,
  type PushAudience,
  usePushMutes,
  useTogglePushMute,
} from '../lib/usePushMutes';
import { radius, space, ui } from '../theme/tokens';

const GROUPS: { audience: PushAudience; title: string }[] = [
  { audience: 'buyer', title: 'Als Käufer' },
  { audience: 'seller', title: 'Als Verkäufer' },
];

export default function NotificationSettingsScreen() {
  const insets = useSafeAreaInsets();
  const myUserId = useSession((s) => s.userId);
  const { data: muted } = usePushMutes(myUserId);
  const toggle = useTogglePushMute(myUserId);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.head}>
        <Pressable
          hitSlop={10}
          onPress={() => goBack('/(tabs)/account')}
          accessibilityLabel="Zurück"
        >
          <ChevronLeft size={24} color={ui.text} />
        </Pressable>
        <Text style={styles.headTitle}>Benachrichtigungen</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.md, paddingBottom: insets.bottom + space.xl }}
      >
        {/* ⚠️ Der wichtigste Satz auf dem Bildschirm. Ohne ihn liest sich jeder
            ausgeschaltete Schalter als „ich erfahre es nicht mehr" — und
            jemand, der das glaubt, schaltet gar nichts ab. */}
        <Text style={styles.lead}>
          Aus heißt: kein Ton, keine Einblendung. Die Meldung steht trotzdem in deiner Glocke.
        </Text>

        {notice ? (
          <Pressable style={styles.notice} onPress={() => setNotice(null)}>
            <Text style={styles.noticeText}>{notice}</Text>
          </Pressable>
        ) : null}

        {GROUPS.map((group) => {
          const items = MUTABLE_PUSH.filter((i) => i.audience === group.audience);
          return (
            <View key={group.audience}>
              <Text style={styles.sectionLabel}>{group.title}</Text>
              <View style={styles.group}>
                {items.map((item, index) => {
                  const on = !muted?.has(item.type);
                  return (
                    <View
                      key={item.type}
                      style={[styles.row, index === items.length - 1 && styles.rowLast]}
                    >
                      <View style={styles.copy}>
                        <Text style={styles.label}>{item.label}</Text>
                        <Text style={styles.hint}>{item.hint}</Text>
                      </View>
                      <Switch
                        value={on}
                        // Dieselbe Färbung wie in `interests.tsx` — nicht das
                        // iOS-Grün, das sonst nirgends in Berkat vorkommt.
                        trackColor={{ false: ui.sunken, true: ui.brand }}
                        thumbColor={ui.card}
                        accessibilityLabel={item.label}
                        onValueChange={(next) =>
                          void toggle
                            .mutateAsync({ type: item.type, mute: !next })
                            .catch(() =>
                              setNotice('Das ließ sich gerade nicht speichern. Nochmal?'),
                            )
                        }
                      />
                    </View>
                  );
                })}
              </View>
            </View>
          );
        })}

        {/* ⚠️ Was NICHT abschaltbar ist, gehört genannt — sonst sucht jemand
            danach und hält die Liste für unvollständig. Zwei Sätze, nicht
            zwei Absätze: der Grund („Geld oder Frist") und der eine Ausweg,
            samt seinem Preis. */}
        <Text style={styles.sectionLabel}>Immer an</Text>
        <Text style={styles.foot}>
          Zuschlag, Zahlungserinnerung, Versand, neue Bestellungen und gemeldete Probleme — dort
          hängt Geld oder eine Frist dran.
        </Text>
        <Text style={styles.foot}>
          Ganz ohne Push geht nur in den iPhone-Einstellungen. Dann fehlt auch der Zuschlag.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: ui.bg },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  headTitle: { fontSize: 17, fontWeight: '600', color: ui.text },

  lead: { fontSize: 13, lineHeight: 18, color: ui.textMuted, marginBottom: space.xs },

  notice: {
    backgroundColor: ui.sunken,
    borderRadius: radius.md,
    padding: space.sm,
    marginTop: space.md,
  },
  noticeText: { fontSize: 13, color: ui.text },

  sectionLabel: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
    color: ui.text,
    marginTop: space.lg,
    marginBottom: space.sm,
  },

  /* Dasselbe Muster wie `(tabs)/account.tsx` und `shipping.tsx`: Die Gruppe
     trägt die Fläche, die Zeile nur eine Haarlinie. Die letzte Zeile trägt
     keine — sonst läge sie auf der abgerundeten Kante. */
  group: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ui.line,
  },
  rowLast: { borderBottomWidth: 0 },
  copy: { flex: 1, minWidth: 0, gap: 3 },
  label: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: ui.text },
  hint: { fontSize: 12, lineHeight: 18, color: ui.textMuted },

  foot: { fontSize: 13, lineHeight: 18, color: ui.textMuted, marginBottom: space.sm },
});
