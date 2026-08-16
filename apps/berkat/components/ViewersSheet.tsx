// Wer gerade zusieht — das Blatt hinter der Zuschauerzahl.
//
// Nur der Gastgeber öffnet es. Die Begründung steht in `lib/useLiveViewers.ts`:
// Eine für Zuschauer sichtbare Teilnehmerliste würde das Loch zurückbringen,
// das am 14.08.2026 mit `live_reactions_rls` geschlossen wurde — bei einer
// Frauen-Only-Sendung wäre sie ein Verrat am Kernversprechen.
//
// Der @-Knopf ist der eigentliche Zweck des Blattes, nicht die Liste. Eine Zahl
// sagt „acht Leute schauen zu"; ein Name sagt, wen man ansprechen kann. Für
// Phase 0 ist das der Unterschied zwischen einer Sendung, nach der jemand
// wiederkommt, und einer, nach der niemand wiederkommt.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AtSign, Users, X } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';
import { Avatar } from './Avatar';
import { watchingSince, type LiveViewer } from '../lib/useLiveViewers';

type Props = {
  visible: boolean;
  viewers: LiveViewer[];
  loading: boolean;
  /**
   * ⚠️ Muss durchgereicht werden, nicht verschluckt.
   *
   * Ohne diesen Zweig zeigt das Blatt bei einem Fehlschlag „Noch schaut niemand
   * zu" — eine leere Menge statt eines Fehlers. Genau dieses Muster hat in
   * diesem Projekt schon zweimal Stunden gekostet (HANDOFF Abschnitt 3,
   * „Geerbte Serlo-Tabellen sind enger, als sie aussehen"): Die Abfrage ist
   * syntaktisch richtig, das Recht oder der Fremdschlüssel fehlt, und PostgREST
   * antwortet mit null Zeilen. Man sucht den Fehler dann im Client.
   */
  error: unknown;
  onClose: () => void;
  /** Schreibt `@name ` ins Chat-Feld und schließt das Blatt. */
  onMention: (username: string) => void;
  /** Öffnet das Profil — dieselbe Geste wie überall sonst. */
  onOpenProfile: (userId: string) => void;
};

export function ViewersSheet({
  visible,
  viewers,
  loading,
  error,
  onClose,
  onMention,
  onOpenProfile,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={s.head}>
          <Users size={18} color={stage.text} />
          <Text style={s.title}>
            {viewers.length === 1 ? '1 schaut zu' : `${viewers.length} schauen zu`}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schließen">
            <X size={20} color={stage.textMuted} />
          </Pressable>
        </View>

        {/* Einmal gesagt statt an jeder Zeile: Die Liste ist nicht öffentlich. */}
        <Text style={s.hint}>Nur du siehst diese Liste.</Text>

        {error ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: stage.live }]}>Die Liste kam nicht durch</Text>
            <Text style={s.emptyBody}>
              Das heißt nicht, dass niemand zusieht — die Zahl oben stimmt weiter. Nur die Namen
              ließen sich gerade nicht laden.
            </Text>
            {__DEV__ ? (
              <Text style={[s.emptyBody, { marginTop: space.sm }]}>
                {error instanceof Error ? error.message : String(error)}
              </Text>
            ) : null}
          </View>
        ) : viewers.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyTitle}>
              {loading ? 'Einen Moment …' : 'Noch schaut niemand zu'}
            </Text>
            {!loading ? (
              <Text style={s.emptyBody}>
                Kündige den nächsten Termin an — wer dir folgt, bekommt 15 Minuten vorher eine
                Erinnerung aufs Handy.
              </Text>
            ) : null}
          </View>
        ) : (
          <ScrollView style={s.list} contentContainerStyle={s.listInner}>
            {viewers.map((viewer) => {
              const name = viewer.username ?? 'Jemand';
              return (
                <View key={viewer.user_id} style={s.row}>
                  <Pressable
                    style={s.who}
                    onPress={() => onOpenProfile(viewer.user_id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Profil von ${name}`}
                  >
                    <Avatar uri={viewer.avatar_url} name={viewer.username} size={38} />
                    <View style={s.whoText}>
                      <Text numberOfLines={1} style={s.name}>
                        {name}
                      </Text>
                      <Text style={s.since}>{watchingSince(viewer.joined_at)}</Text>
                    </View>
                  </Pressable>

                  {/* Ohne Namen kein Erwähnen — `@Jemand` träfe niemanden. */}
                  {viewer.username ? (
                    <Pressable
                      onPress={() => onMention(viewer.username!)}
                      style={s.mention}
                      hitSlop={6}
                      accessibilityRole="button"
                      accessibilityLabel={`${name} im Chat ansprechen`}
                    >
                      <AtSign size={17} color={stage.gold} />
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: stage.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    // Höchstens zwei Drittel des Bildschirms: Der Gastgeber sendet nebenbei und
    // soll sein eigenes Bild nicht verlieren, während er die Liste liest.
    maxHeight: '66%',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: stage.text },
  hint: { fontSize: 12, color: stage.textMuted, marginTop: space.xs },

  list: { marginTop: space.md },
  listInner: { paddingBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stage.line,
  },
  who: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  whoText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '600', color: stage.text },
  since: { fontSize: 12, color: stage.textMuted, marginTop: 1 },

  // Gold, weil es die Handlung ist, um die es hier geht — nicht als Kauf-Signal,
  // sondern als der eine Knopf, den dieses Blatt rechtfertigt.
  mention: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1.5,
    borderColor: stage.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  empty: { paddingVertical: space.xl, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: stage.text },
  emptyBody: {
    fontSize: 13,
    color: stage.textMuted,
    marginTop: space.xs,
    textAlign: 'center',
    lineHeight: 19,
  },
});
