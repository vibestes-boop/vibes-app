// Was der Abend einbringt — das Blatt hinter der Umsatz-Zahl in der Leiste.
//
// Nur der Gastgeber öffnet es; die Begründung steht in `lib/useShowEarnings.ts`.
//
// WAS DIESES BLATT VON EINEM DASHBOARD UNTERSCHEIDET
// Abschnitt 40 hat „Account Health" abgelehnt — drei Kennzahlen über null
// Vorgänge sind nichts. Das hier ist keine Bilanz, sondern eine **Rückmeldung im
// Moment des Tuns**: zwei Zahlen, die sich während der Sendung bewegen, und die
// Gesichter dahinter. Der Unterschied ist nicht die Datenmenge, sondern der
// Zeitpunkt.
//
// Whatnot zeigt an derselben Stelle „Verkäufe 1310 € · Bestellungen 108".
// **„Bestellungen" wäre in Berkat falsch**: Ein Sammelkorb bleibt 24 Stunden
// offen und wird erst danach zur Bestellung — während der Sendung gibt es keine
// einzige. Deshalb „Zuschläge", und das ist die ehrlichere Zahl: Sie zählt, was
// gerade wirklich passiert ist.

import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Gift, TrendingUp, X } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';
import { Avatar } from './Avatar';
import { formatEuro } from '../lib/useAuction';
import { eventAgo, type ShowEarnings } from '../lib/useShowEarnings';

type Props = {
  visible: boolean;
  data: ShowEarnings | undefined;
  loading: boolean;
  /**
   * ⚠️ Muss durchgereicht werden, nicht verschluckt — dieselbe Begründung wie im
   * `ViewersSheet`: Ohne diesen Zweig zeigt ein Rechte- oder Schlüsselfehler
   * „Noch nichts verkauft" statt eines Fehlers, und man sucht ihn im Client.
   * Bei Geldzahlen wiegt das schwerer als bei einer Namensliste: „0 €" sieht aus
   * wie eine Auskunft, ist aber keine.
   */
  error: unknown;
  onClose: () => void;
  onOpenProfile: (userId: string) => void;
};

export function EarningsSheet({
  visible,
  data,
  loading,
  error,
  onClose,
  onOpenProfile,
}: Props) {
  const insets = useSafeAreaInsets();
  const gross = data?.grossCents ?? 0;
  const sold = data?.soldCount ?? 0;
  const tips = data?.tipCents ?? 0;
  const events = data?.events ?? [];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={s.head}>
          <TrendingUp size={18} color={stage.text} />
          <Text style={s.title}>Dieser Abend</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schließen">
            <X size={20} color={stage.textMuted} />
          </Pressable>
        </View>

        <Text style={s.hint}>Nur du siehst diese Zahlen.</Text>

        {error ? (
          <View style={s.empty}>
            <Text style={[s.emptyTitle, { color: stage.live }]}>Die Zahlen kamen nicht durch</Text>
            <Text style={s.emptyBody}>
              Das heißt nicht, dass nichts verkauft wurde. Die Zuschläge stehen weiter in deinen
              Bestellungen — hier ließen sie sich gerade nur nicht laden.
            </Text>
            {__DEV__ ? (
              <Text style={[s.emptyBody, { marginTop: space.sm }]}>
                {error instanceof Error ? error.message : String(error)}
              </Text>
            ) : null}
          </View>
        ) : (
          <>
            <View style={s.stats}>
              <View style={s.stat}>
                <Text style={s.statLabel}>Verkäufe</Text>
                {/* Hellgrün, nicht gold. Gold ist auf der Bühne der KAUF —
                    Gebot, Preis, Zuschlag. Was der Verkäufer eingenommen hat,
                    ist eine Bestätigung, kein Kaufweg; dieselbe Unterscheidung
                    wie bei der Bürgen-Zeile (Abschnitt 15). */}
                <Text style={[s.statValue, { color: stage.lead }]}>{formatEuro(gross)}</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.stat}>
                <Text style={s.statLabel}>Zuschläge</Text>
                <Text style={s.statValue}>{sold}</Text>
              </View>
            </View>

            {/* Nur wenn es welche gab. „0 € Trinkgeld" wäre eine Enttäuschung in
                Zahlenform — dieselbe Regel wie bei der Erinnerungs-Zahl an den
                Terminen (Abschnitt 37). */}
            {tips > 0 ? (
              <View style={s.tipLine}>
                <Gift size={14} color={stage.lead} />
                <Text style={s.tipText}>
                  Dazu {formatEuro(tips)} Trinkgeld — das geht ganz an dich.
                </Text>
              </View>
            ) : null}

            {events.length === 0 ? (
              <View style={s.empty}>
                <Text style={s.emptyTitle}>
                  {loading ? 'Einen Moment …' : 'Noch ist nichts weggegangen'}
                </Text>
                {!loading ? (
                  <Text style={s.emptyBody}>
                    Leg einen Artikel auf und starte ihn — sobald der erste Zuschlag fällt, steht
                    er hier.
                  </Text>
                ) : null}
              </View>
            ) : (
              <ScrollView style={s.list} contentContainerStyle={s.listInner}>
                {events.map((ev) => {
                  const name = ev.username ?? 'Jemand';
                  const row = (
                    <>
                      <Avatar uri={ev.avatarUrl} name={ev.username} size={36} />
                      <View style={s.body}>
                        <Text numberOfLines={1} style={s.line}>
                          <Text style={s.name}>{name}</Text>
                          {ev.kind === 'tip' ? (
                            <Text style={{ color: stage.lead }}>
                              {' '}
                              hat {formatEuro(ev.cents)} Trinkgeld gegeben
                            </Text>
                          ) : (
                            <Text style={s.dim}> hat zugeschlagen</Text>
                          )}
                        </Text>
                        <Text numberOfLines={1} style={s.meta}>
                          {ev.kind === 'sale'
                            ? `${formatEuro(ev.cents)} · ${ev.title ?? 'Artikel'}`
                            : eventAgo(ev.at)}
                          {ev.kind === 'sale' ? ` · ${eventAgo(ev.at)}` : ''}
                        </Text>
                      </View>
                      {/* Artikelbild eckig, Avatar rund — der Formunterschied
                          trägt die Bedeutung ohne ein Wort (Abschnitt 18). */}
                      {ev.imageUrl ? (
                        <Image source={{ uri: ev.imageUrl }} style={s.thumb} contentFit="cover" />
                      ) : null}
                    </>
                  );

                  // Ohne Konto-ID kein Profil-Weg — ein Pressable, der nichts
                  // tut, ist schlechter als keiner.
                  return ev.userId ? (
                    <Pressable
                      key={ev.key}
                      style={s.row}
                      onPress={() => onOpenProfile(ev.userId!)}
                      accessibilityRole="button"
                      accessibilityLabel={`Profil von ${name}`}
                    >
                      {row}
                    </Pressable>
                  ) : (
                    <View key={ev.key} style={s.row}>
                      {row}
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </>
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
    // Wie beim Zuschauer-Blatt: Der Gastgeber sendet nebenbei und soll sein
    // eigenes Bild nicht verlieren, während er liest.
    maxHeight: '66%',
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 17, fontWeight: '700', color: stage.text },
  hint: { fontSize: 12, color: stage.textMuted, marginTop: space.xs },

  stats: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: stage.surfaceHigh,
    borderRadius: radius.md,
    paddingVertical: space.md,
    marginTop: space.md,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: stage.line },
  statLabel: { fontSize: 12, color: stage.textMuted },
  statValue: { fontSize: 26, fontWeight: '700', color: stage.text },

  tipLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    marginTop: space.sm,
  },
  tipText: { flex: 1, fontSize: 13, color: stage.textMuted },

  list: { marginTop: space.md },
  listInner: { paddingBottom: space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stage.line,
  },
  body: { flex: 1, minWidth: 0 },
  line: { fontSize: 14, color: stage.text },
  name: { fontWeight: '700', color: stage.text },
  dim: { color: stage.textMuted },
  meta: { fontSize: 12, color: stage.textMuted, marginTop: 1 },
  thumb: { width: 40, height: 40, borderRadius: radius.sm, backgroundColor: stage.surfaceHigh },

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
