// Die Gewinnspiel-Karte oben rechts.
//
// Sitzt an derselben Stelle wie bei Whatnot, weil sie dort funktioniert: hoch
// genug, um nicht mit dem Handel zu kollidieren, prominent genug, dass niemand
// sie übersieht.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, Gift } from 'lucide-react-native';
import { stage, radius, space } from '../theme/tokens';
import type { Giveaway } from '../lib/useGiveaway';

type Props = {
  giveaway: Giveaway;
  isHost: boolean;
  entered: boolean;
  winnerName: string | null;
  busy?: boolean;
  onEnter: () => void;
  onDraw: () => void;
};

export function GiveawayCard({
  giveaway,
  isHost,
  entered,
  winnerName,
  busy,
  onEnter,
  onDraw,
}: Props) {
  const drawn = giveaway.status === 'drawn';

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Gift size={13} color={stage.gold} />
        <Text style={styles.headText}>Gewinnspiel</Text>
      </View>

      <Text numberOfLines={1} style={styles.title}>
        {giveaway.title}
      </Text>

      {drawn ? (
        <Text numberOfLines={2} style={styles.winner}>
          {winnerName ? `${winnerName} hat gewonnen!` : 'Niemand hat mitgemacht'}
        </Text>
      ) : (
        <Text style={styles.count}>
          {giveaway.entry_count} {giveaway.entry_count === 1 ? 'Teilnahme' : 'Teilnahmen'}
        </Text>
      )}

      {drawn ? null : isHost ? (
        <Pressable
          onPress={onDraw}
          disabled={busy}
          style={[styles.action, busy && styles.actionOff]}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>Gewinner ziehen</Text>
        </Pressable>
      ) : entered ? (
        <View style={styles.entered}>
          <Check size={13} color={stage.lead} />
          <Text style={styles.enteredText}>Du bist dabei</Text>
        </View>
      ) : (
        <Pressable
          onPress={onEnter}
          disabled={busy}
          style={[styles.action, busy && styles.actionOff]}
          accessibilityRole="button"
        >
          <Text style={styles.actionText}>Mitmachen</Text>
        </Pressable>
      )}

      {!drawn && !isHost && !entered && giveaway.requires_follow ? (
        <Text style={styles.hint}>Folgen genügt</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 150,
    backgroundColor: 'rgba(11,21,18,0.72)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: stage.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headText: { fontSize: 11, fontWeight: '700', color: stage.gold },
  title: { fontSize: 13, fontWeight: '700', color: stage.text },
  count: { fontSize: 11, color: stage.textMuted },
  winner: { fontSize: 12, fontWeight: '700', color: stage.lead, lineHeight: 16 },
  action: {
    marginTop: 4,
    height: 30,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOff: { opacity: 0.5 },
  actionText: { fontSize: 12, fontWeight: '700', color: stage.goldInk },
  entered: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  enteredText: { fontSize: 12, fontWeight: '700', color: stage.lead },
  hint: { fontSize: 10, color: stage.textMuted, marginTop: 1 },
});
