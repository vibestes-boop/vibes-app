// „Aus deinen Sendungen übrig" — die Nachlese.
//
// DAS PROBLEM, DAS DIESE LISTE LÖST
// Ein Artikel, der in einer Show kein Gebot bekam, war bis zum 21.08.2026 eine
// Sackgasse: `settle_live_auction` setzt `status = 'unsold'`, und danach
// passierte mit ihm nie wieder etwas. Dasselbe gilt für alles, was nie
// drankam (`scheduled`) — bei zwanzig Artikeln am Abend ist das regelmäßig ein
// halbes Dutzend. Foto, Beschreibung, Sendezeit: verfallen.
//
// Sie hier ins Regal zu legen ist die billigste Ware, die Berkat haben kann —
// und sie wirkt genau dort, wo es am meisten fehlt: Das Regal ist dünn, und
// eine gespeicherte Suche (`20260821120000`) kann nur melden, was da ist.
//
// ⚠️ WARUM DIESE LISTE HIER STEHT UND NICHT IM LIVE-RAUM
// Im Live-Raum gibt es den Weg auch (`ShowItemsSheet`), aber dort ist der
// Verkäufer beschäftigt. Der Moment, in dem man aufräumt, ist NACH der Sendung
// — und danach ist der Live-Raum zu. Ohne diesen Ort wäre der ganze Weg nur
// während der Show erreichbar, also genau dann nicht, wenn man ihn braucht.

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';

import { formatEuro } from '../lib/useAuction';
import { euroToCents } from '../lib/useStudio';
import { shelfBridgeErrorText, useLeftovers, useShelfBridge, type Leftover } from '../lib/useShelfBridge';
import { radius, space, ui } from '../theme/tokens';

type Props = {
  userId: string | null | undefined;
  /** Der Bildschirm trägt den Hinweis-Zustand, nicht diese Liste. */
  onNotice: (text: string) => void;
};

function reasonText(item: Leftover): string {
  return item.status === 'unsold' ? 'kein Gebot' : 'nie drangekommen';
}

export function LeftoverShelf({ userId, onNotice }: Props) {
  const { data: leftovers } = useLeftovers(userId);
  const { toShelf } = useShelfBridge();
  const [askFor, setAskFor] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [busy, setBusy] = useState(false);

  // Nichts übrig heißt: kein Abschnitt. Ein Leerzustand mit „Hier landet, was
  // du nicht verkauft hast" wäre eine Erinnerung an Misserfolge auf einem
  // Bildschirm, der sonst vom Bestand handelt (Design-Gesetz 2 und 3).
  if (!leftovers || leftovers.length === 0) return null;

  const open = (item: Leftover) => {
    setAskFor(item.id);
    // Vorschlag aus dem Sofortkauf, wenn es einen gab — er war der Preis fürs
    // Abkürzen und steht hoch. Deshalb ein Vorschlag und keine Vorgabe.
    setPrice(item.buy_now_cents ? (item.buy_now_cents / 100).toFixed(2) : '');
  };

  const confirm = async () => {
    if (!askFor || busy) return;
    const cents = euroToCents(price);
    if (cents === null || cents <= 100) {
      onNotice('Der Regalpreis muss über 1 € liegen — dort startet später die Auktion.');
      return;
    }
    setBusy(true);
    try {
      await toShelf.mutateAsync({ id: askFor, priceCents: cents });
      setAskFor(null);
      setPrice('');
      onNotice('Liegt im Regal — ab jetzt kaufbar. 🎉');
    } catch (e) {
      onNotice(shelfBridgeErrorText(e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={s.wrap}>
      <Text style={s.title}>
        {leftovers.length === 1 ? '1 Artikel aus deinen Sendungen übrig' : `${leftovers.length} Artikel aus deinen Sendungen übrig`}
      </Text>
      <Text style={s.hint}>
        Leg sie ins Regal, dann sind sie rund um die Uhr kaufbar — ohne sie neu einzustellen.
      </Text>

      {leftovers.map((item) => {
        const asking = askFor === item.id;
        return (
          <View key={item.id} style={s.row}>
            <View style={s.rowTop}>
              <View style={s.thumb}>
                {item.image_url ? (
                  <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} />
                ) : null}
              </View>
              <View style={s.rowText}>
                <Text numberOfLines={1} style={s.rowTitle}>
                  {item.title}
                </Text>
                <Text style={s.rowMeta}>
                  {reasonText(item)}
                  {item.buy_now_cents ? ` · zuletzt sofort ${formatEuro(item.buy_now_cents)}` : ''}
                </Text>
              </View>
              {!asking ? (
                <Pressable
                  onPress={() => open(item)}
                  style={s.action}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title} ins Regal legen`}
                >
                  <Text style={s.actionText}>Ins Regal</Text>
                </Pressable>
              ) : null}
            </View>

            {asking ? (
              <View style={s.askRow}>
                <TextInput
                  value={price}
                  onChangeText={setPrice}
                  placeholder="Preis in €"
                  placeholderTextColor={ui.textMuted}
                  keyboardType="decimal-pad"
                  style={s.input}
                  autoFocus
                />
                <Pressable
                  onPress={() => void confirm()}
                  disabled={busy}
                  style={[s.confirm, busy && s.confirmOff]}
                  accessibilityRole="button"
                  accessibilityLabel="Ins Regal legen"
                >
                  <Text style={s.confirmText}>Ins Regal</Text>
                </Pressable>
                <Pressable onPress={() => setAskFor(null)} hitSlop={8} accessibilityLabel="Abbrechen">
                  <X size={18} color={ui.textMuted} />
                </Pressable>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginTop: space.lg },
  title: { fontSize: 15, fontWeight: '700', color: ui.text },
  hint: { fontSize: 12, color: ui.textMuted, marginTop: 2, marginBottom: space.sm },

  row: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: ui.line,
    padding: space.md,
    marginBottom: space.sm,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: ui.sunken,
    overflow: 'hidden',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '600', color: ui.text },
  rowMeta: { fontSize: 12, color: ui.textMuted, marginTop: 1 },

  action: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: ui.lineStrong,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  actionText: { fontSize: 12, fontWeight: '700', color: ui.text },

  askRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  input: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: ui.lineStrong,
    backgroundColor: ui.bg,
    paddingHorizontal: space.md,
    color: ui.text,
    fontSize: 14,
  },
  confirm: {
    height: 38,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    backgroundColor: ui.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmOff: { opacity: 0.5 },
  confirmText: { fontSize: 13, fontWeight: '700', color: ui.goldInk },
});
