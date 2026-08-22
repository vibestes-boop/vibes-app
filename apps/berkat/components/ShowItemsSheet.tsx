// Alle Artikel einer Show auf einen Blick — und für den Gastgeber zugleich
// die Regie.
//
// Whatnot versteckt den Katalog hinter einer Einkaufstüte in der Icon-Leiste,
// das übernehmen wir. Zwei Unterschiede: Hier steht auch, was schon weg ist
// (wer sieht, dass die letzten drei für 40, 55 und 60 € weggingen, weiß, worauf
// er sich einlässt) — und der Gastgeber startet den nächsten Artikel von hier
// aus, ohne den Raum zu verlassen. Ginge das nicht, müsste er den Stream
// beenden, um weiterzuverkaufen.

import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Gift, Package, X } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';
import { formatEuro, type Auction } from '../lib/useAuction';
import { euroToCents } from '../lib/useStudio';
import { shelfBridgeErrorText, useShelfBridge } from '../lib/useShelfBridge';
import { ShelfPickSheet } from './ShelfPickSheet';

type Props = {
  visible: boolean;
  auctions: Auction[];
  onClose: () => void;
  /** Regie-Funktionen — nur für den Gastgeber gesetzt */
  isHost?: boolean;
  /**
   * Für die beiden Wege zwischen Regal und Show (`20260821160000`). Nur beim
   * Gastgeber gesetzt — ein Zuschauer räumt fremde Regale nicht um.
   */
  sessionId?: string;
  hostId?: string | null;
  duration?: number;
  onDuration?: (seconds: number) => void;
  onStart?: (auctionId: string) => void;
  /** Solange ein Artikel läuft, kann kein zweiter gestartet werden */
  blocked?: boolean;
  /** Gewinnspiel eröffnen — nur Gastgeber, nur wenn keines offen ist */
  onCreateGiveaway?: (title: string) => void;
  giveawayOpen?: boolean;
};

const DURATIONS = [20, 30, 60];

function statusLabel(item: Auction): { text: string; color: string } {
  switch (item.status) {
    case 'running':
      return { text: 'läuft', color: stage.live };
    case 'sold':
      return { text: 'verkauft', color: stage.textMuted };
    case 'unsold':
      return { text: 'kein Gebot', color: stage.textMuted };
    default:
      return { text: 'kommt noch', color: stage.textMuted };
  }
}

export function ShowItemsSheet({
  visible,
  auctions,
  onClose,
  isHost,
  duration = 30,
  onDuration,
  onStart,
  blocked,
  onCreateGiveaway,
  giveawayOpen,
  sessionId,
  hostId,
}: Props) {
  const insets = useSafeAreaInsets();
  const [giftTitle, setGiftTitle] = useState('');

  // ── Regal ↔ Show ──────────────────────────────────────────────────────────
  // `shelfFor` ist die Artikel-ID, deren Zeile gerade nach einem Preis fragt.
  // ⚠️ Kein `Alert.prompt` — das gibt es nur auf iOS (CLAUDE.md, Regel 5). Die
  // Zeile klappt stattdessen selbst auf; das ist auch der ehrlichere Ort, weil
  // der Verkäufer den Artikel dabei weiter vor sich sieht.
  const [pickerOpen, setPickerOpen] = useState(false);
  const [shelfFor, setShelfFor] = useState<string | null>(null);
  const [shelfPrice, setShelfPrice] = useState('');
  const [shelfBusy, setShelfBusy] = useState(false);
  const [shelfNotice, setShelfNotice] = useState<string | null>(null);
  const { toShelf } = useShelfBridge();

  const openShelfFor = (item: Auction) => {
    setShelfNotice(null);
    setShelfFor(item.id);
    // Vorschlag, keine Vorgabe: Der Sofortkauf war der Preis fürs Abkürzen der
    // Auktion und steht bewusst hoch. Als Regalpreis ist er meist zu teuer —
    // deshalb steht er zwar da, aber der Mensch bestätigt ihn.
    setShelfPrice(item.buy_now_cents ? (item.buy_now_cents / 100).toFixed(2) : '');
  };

  const confirmShelf = async () => {
    if (!shelfFor || shelfBusy) return;
    const cents = euroToCents(shelfPrice);
    if (cents === null || cents <= 100) {
      setShelfNotice('Der Regalpreis muss über 1 € liegen — dort startet später die Auktion.');
      return;
    }
    setShelfBusy(true);
    setShelfNotice(null);
    try {
      await toShelf.mutateAsync({ id: shelfFor, priceCents: cents });
      setShelfFor(null);
      setShelfPrice('');
    } catch (e) {
      setShelfNotice(shelfBridgeErrorText(e instanceof Error ? e.message : String(e)));
    } finally {
      setShelfBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Ohne das schiebt die Tastatur den Zettel nicht hoch, sondern legt sich
          darüber — und man tippt blind. */}
      <KeyboardAvoidingView
        style={styles.modalRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom || space.md }]}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.title}>Artikel in dieser Show</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Schließen">
            <X size={22} color={stage.textMuted} />
          </Pressable>
        </View>

        {isHost && onDuration ? (
          <View style={styles.durationRow}>
            <Text style={styles.durationLabel}>Dauer</Text>
            {DURATIONS.map((seconds) => (
              <Pressable
                key={seconds}
                onPress={() => onDuration(seconds)}
                style={[styles.durationChip, duration === seconds && styles.durationChipActive]}
              >
                <Text
                  style={[
                    styles.durationChipText,
                    duration === seconds && styles.durationChipTextActive,
                  ]}
                >
                  {seconds} s
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {isHost && onCreateGiveaway && !giveawayOpen ? (
          <View style={styles.giftRow}>
            <TextInput
              value={giftTitle}
              onChangeText={setGiftTitle}
              placeholder="Gewinnspiel, z. B. Probe-Set"
              placeholderTextColor={stage.textMuted}
              style={styles.giftInput}
            />
            <Pressable
              onPress={() => {
                if (!giftTitle.trim()) return;
                onCreateGiveaway(giftTitle.trim());
                setGiftTitle('');
              }}
              style={styles.giftButton}
              accessibilityRole="button"
              accessibilityLabel="Gewinnspiel starten"
            >
              <Gift size={15} color={stage.goldInk} />
            </Pressable>
          </View>
        ) : null}

        {/* Aus dem Regal holen — mitten in der Sendung. Genau das ist der
            Live-Vorteil: Ein Zuschauer fragt nach etwas, und es liegt schon im
            Regal, statt vor der Kamera neu getippt zu werden. */}
        {isHost && sessionId ? (
          <Pressable
            style={styles.shelfBar}
            onPress={() => setPickerOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Artikel aus dem Regal holen"
          >
            <Package size={15} color={stage.text} />
            <Text style={styles.shelfBarText}>Aus dem Regal holen</Text>
          </Pressable>
        ) : null}

        {shelfNotice ? (
          <Pressable style={styles.shelfNotice} onPress={() => setShelfNotice(null)}>
            <Text style={styles.shelfNoticeText}>{shelfNotice}</Text>
          </Pressable>
        ) : null}

        <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
          {auctions.length === 0 ? (
            <Text style={styles.empty}>Der Verkäufer hat noch nichts aufgelegt.</Text>
          ) : (
            auctions.map((item) => {
              const status = statusLabel(item);
              const startable = isHost && onStart && item.status === 'scheduled';
              // ⚠️ `running` fehlt hier bewusst — einen Artikel aus einer
              // laufenden Auktion zu ziehen, während jemand bietet, ist kein
              // Umräumen, sondern ein Wortbruch. Der Server lehnt es ohnehin ab
              // (`not_returnable`); der Knopf soll gar nicht erst dastehen.
              const returnable =
                isHost && (item.status === 'unsold' || item.status === 'scheduled');
              const asking = shelfFor === item.id;
              return (
                <View key={item.id}>
                  <View style={styles.row}>
                    <View style={styles.thumb}>
                      {item.image_url ? (
                        <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} />
                      ) : null}
                    </View>
                    <View style={styles.rowText}>
                      <Text numberOfLines={1} style={styles.rowTitle}>
                        {item.title}
                      </Text>
                      <Text style={[styles.rowStatus, { color: status.color }]}>{status.text}</Text>
                    </View>

                    {startable ? (
                      <Pressable
                        onPress={() => onStart(item.id)}
                        disabled={blocked}
                        style={[styles.startButton, blocked && styles.startButtonBlocked]}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.title} starten`}
                      >
                        <Text style={styles.startButtonText}>Starten</Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.rowPrice}>
                        {formatEuro(item.current_bid_cents ?? item.start_price_cents)}
                      </Text>
                    )}
                  </View>

                  {returnable && !asking ? (
                    <Pressable
                      onPress={() => openShelfFor(item)}
                      style={styles.toShelfLink}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.title} ins Regal legen`}
                    >
                      <Text style={styles.toShelfLinkText}>Ins Regal legen</Text>
                    </Pressable>
                  ) : null}

                  {asking ? (
                    <View style={styles.askRow}>
                      <TextInput
                        value={shelfPrice}
                        onChangeText={setShelfPrice}
                        placeholder="Preis in €"
                        placeholderTextColor={stage.textMuted}
                        keyboardType="decimal-pad"
                        style={styles.askInput}
                        autoFocus
                      />
                      <Pressable
                        onPress={() => void confirmShelf()}
                        disabled={shelfBusy}
                        style={[styles.askConfirm, shelfBusy && styles.startButtonBlocked]}
                        accessibilityRole="button"
                        accessibilityLabel="Ins Regal legen"
                      >
                        <Text style={styles.askConfirmText}>Ins Regal</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => setShelfFor(null)}
                        hitSlop={8}
                        accessibilityLabel="Abbrechen"
                      >
                        <X size={18} color={stage.textMuted} />
                      </Pressable>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      {isHost && sessionId ? (
        <ShelfPickSheet
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          sellerId={hostId}
          target={{ sessionId }}
          targetLabel="in deine laufende Sendung"
        />
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: stage.surface,
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    paddingHorizontal: space.md,
    maxHeight: '72%',
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: stage.lineStrong,
    marginTop: space.sm,
    marginBottom: space.md,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  title: { fontSize: 18, fontWeight: '700', color: stage.text },
  empty: { fontSize: 14, color: stage.textMuted, paddingVertical: space.lg },

  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginBottom: space.md,
  },
  durationLabel: { fontSize: 12, color: stage.textMuted, marginRight: 2 },
  durationChip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.line,
    paddingHorizontal: space.md,
    paddingVertical: 6,
  },
  durationChipActive: { borderColor: stage.gold, backgroundColor: 'rgba(233,167,60,0.14)' },
  durationChipText: { fontSize: 13, color: stage.textMuted },
  durationChipTextActive: { color: stage.gold, fontWeight: '700' },

  giftRow: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
  giftInput: {
    flex: 1,
    height: 38,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: stage.line,
    backgroundColor: stage.ink,
    paddingHorizontal: space.md,
    fontSize: 13,
    color: stage.text,
  },
  giftButton: {
    width: 44,
    height: 38,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: stage.line,
  },
  thumb: {
    width: 46,
    height: 46,
    borderRadius: radius.sm,
    backgroundColor: stage.surfaceHigh,
    overflow: 'hidden',
  },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '600', color: stage.text },
  rowStatus: { fontSize: 12, marginTop: 1 },
  rowPrice: { fontSize: 15, fontWeight: '700', color: stage.gold },
  startButton: {
    backgroundColor: stage.gold,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 9,
  },
  startButtonBlocked: { opacity: 0.35 },
  startButtonText: { fontSize: 13, fontWeight: '700', color: stage.goldInk },

  // ── Regal ↔ Show ──────────────────────────────────────────────────────────
  // Beides bewusst ohne Gold: Gold trägt auf der Bühne den Kauf. Umräumen ist
  // Regie, kein Verkauf — dieselbe Unterscheidung wie bei der Umsatz-Zeile.
  shelfBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    backgroundColor: stage.surfaceHigh,
    borderRadius: radius.pill,
    paddingVertical: space.sm,
    marginBottom: space.sm,
  },
  shelfBarText: { fontSize: 13, fontWeight: '600', color: stage.text },
  shelfNotice: {
    backgroundColor: stage.surfaceHigh,
    borderRadius: radius.sm,
    padding: space.sm,
    marginBottom: space.sm,
  },
  shelfNoticeText: { fontSize: 13, color: stage.text },
  // Eine Textzeile, kein Knopf: Der Weg ins Regal soll auffindbar sein, aber
  // nicht mit „Starten" um die Aufmerksamkeit streiten.
  toShelfLink: { paddingLeft: 52, paddingBottom: space.sm, marginTop: -space.sm },
  toShelfLinkText: { fontSize: 12, fontWeight: '600', color: stage.lead },
  askRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: 52,
    paddingBottom: space.sm,
    marginTop: -space.sm,
  },
  askInput: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: stage.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: space.md,
    color: stage.text,
    fontSize: 14,
  },
  askConfirm: {
    height: 36,
    borderRadius: radius.pill,
    paddingHorizontal: space.md,
    backgroundColor: stage.lead,
    alignItems: 'center',
    justifyContent: 'center',
  },
  askConfirmText: { fontSize: 13, fontWeight: '700', color: stage.ink },
});
