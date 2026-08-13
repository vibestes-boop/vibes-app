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
import { Gift, X } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';
import { formatEuro, type Auction } from '../lib/useAuction';

type Props = {
  visible: boolean;
  auctions: Auction[];
  onClose: () => void;
  /** Regie-Funktionen — nur für den Gastgeber gesetzt */
  isHost?: boolean;
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
}: Props) {
  const insets = useSafeAreaInsets();
  const [giftTitle, setGiftTitle] = useState('');

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

        <ScrollView contentContainerStyle={{ paddingBottom: space.lg }}>
          {auctions.length === 0 ? (
            <Text style={styles.empty}>Der Verkäufer hat noch nichts aufgelegt.</Text>
          ) : (
            auctions.map((item) => {
              const status = statusLabel(item);
              const startable = isHost && onStart && item.status === 'scheduled';
              return (
                <View key={item.id} style={styles.row}>
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
              );
            })
          )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
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
});
