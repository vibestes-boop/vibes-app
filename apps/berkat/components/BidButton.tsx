// Der Gebots-Button.
//
// Form folgt Whatnot: volle Pillen, große Schrift, der Betrag steht im Knopf.
// Zwei Dinge machen wir bewusst anders:
//
//  • "Du führst" ist kein Knopf. Man kann sich nicht selbst überbieten — der
//    Server weist es ab, also darf die UI es gar nicht erst anbieten.
//  • Unter den Knöpfen läuft eine dünne Linie mit der Restzeit. Verlängert ein
//    spätes Gebot die Auktion, springt sie sichtbar zurück. Anti-Snipe ist eine
//    Regel, kein Trick — man soll sie sehen.

import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronsRight, PartyPopper } from 'lucide-react-native';
import { stage, radius, space, auction as auctionConfig } from '../theme/tokens';
import { formatEuro, nextMinBid, type Auction } from '../lib/useAuction';
import { RollupNumber } from './RollupNumber';

export type BidButtonState =
  | 'idle'
  | 'leading'
  | 'outbid'
  | 'urgent'
  | 'won'
  | 'closed'
  | 'seller';

type Props = {
  auction: Auction | null;
  secondsLeft: number;
  myUserId: string | null;
  busy?: boolean;
  onBid: (amountCents: number) => void;
  onBuyNow?: () => void;
  /** Öffnet die Eingabe für das Höchstgebot */
  onMaxBid?: () => void;
  /** Bereits hinterlegtes Maximum — macht den Knopf zur Anzeige */
  myMaxCents?: number | null;
};

function resolveState(
  auction: Auction | null,
  secondsLeft: number,
  myUserId: string | null,
  wasOutbid: boolean,
): BidButtonState {
  if (!auction) return 'closed';
  if (auction.status === 'sold') {
    return auction.winner_id && auction.winner_id === myUserId ? 'won' : 'closed';
  }
  if (auction.status !== 'running') return 'closed';
  if (secondsLeft <= 0) return 'closed';
  if (myUserId && auction.seller_id === myUserId) return 'seller';
  if (myUserId && auction.current_bidder_id === myUserId) return 'leading';
  if (wasOutbid) return 'outbid';
  if (secondsLeft <= auctionConfig.urgentSeconds) return 'urgent';
  return 'idle';
}

export function BidButton({
  auction,
  secondsLeft,
  myUserId,
  busy,
  onBid,
  onBuyNow,
  onMaxBid,
  myMaxCents,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const [wasOutbid, setWasOutbid] = useState(false);
  const wasLeadingRef = useRef(false);
  const wonRef = useRef<string | null>(null);

  useEffect(() => {
    if (!auction || !myUserId) return;
    if (auction.current_bidder_id === myUserId) {
      wasLeadingRef.current = true;
      setWasOutbid(false);
      return;
    }
    if (wasLeadingRef.current && auction.status === 'running') {
      setWasOutbid(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  }, [auction, myUserId]);

  useEffect(() => {
    wasLeadingRef.current = false;
    setWasOutbid(false);
  }, [auction?.id]);

  const state = resolveState(auction, secondsLeft, myUserId, wasOutbid);

  useEffect(() => {
    if (state !== 'won' || !auction) return;
    if (wonRef.current === auction.id) return;
    wonRef.current = auction.id;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [state, auction]);

  if (!auction) return null;

  const target = nextMinBid(auction);
  const canPress = (state === 'idle' || state === 'outbid' || state === 'urgent') && !busy;

  const press = () => {
    if (!canPress) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.97, duration: 70, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 220, useNativeDriver: true }),
    ]).start();
    onBid(target);
  };

  const showBuyNow =
    Boolean(auction.buy_now_cents) &&
    Boolean(onBuyNow) &&
    (state === 'idle' || state === 'urgent' || state === 'outbid');

  const barPercent = Math.max(0, Math.min(100, (secondsLeft / 30) * 100));
  const barVisible = state !== 'won' && state !== 'closed';

  return (
    <View>
      <View style={styles.row}>
        {/* Max-Gebot bleibt auch sichtbar, wenn man führt — man will sein
            Maximum nachziehen können, ohne auf ein Gegengebot zu warten. */}
        {onMaxBid && (state === 'idle' || state === 'urgent' || state === 'outbid' || state === 'leading') ? (
          <Pressable
            onPress={onMaxBid}
            style={[styles.secondary, myMaxCents ? styles.secondaryActive : null]}
            accessibilityRole="button"
            accessibilityLabel="Höchstgebot festlegen"
          >
            <Text style={styles.secondaryLabel}>Max</Text>
            <Text
              style={[styles.secondaryPrice, myMaxCents ? { color: stage.gold } : null]}
              numberOfLines={1}
            >
              {myMaxCents ? formatEuro(myMaxCents) : '—'}
            </Text>
          </Pressable>
        ) : null}

        {showBuyNow ? (
          <Pressable onPress={onBuyNow} style={styles.secondary} accessibilityRole="button">
            <Text style={styles.secondaryLabel}>Sofort</Text>
            <Text style={styles.secondaryPrice}>{formatEuro(auction.buy_now_cents)}</Text>
          </Pressable>
        ) : null}

        <Animated.View style={[styles.grow, { transform: [{ scale }] }]}>
          <Pressable
            onPress={press}
            disabled={!canPress}
            accessibilityRole="button"
            accessibilityLabel={
              state === 'leading'
                ? `Du führst mit ${formatEuro(auction.current_bid_cents)}`
                : `Bieten für ${formatEuro(target)}`
            }
            style={[styles.primary, stateStyles[state]]}
          >
            {state === 'won' ? (
              <View style={styles.center}>
                <PartyPopper size={19} color={stage.successInk} />
                <Text style={[styles.label, { color: stage.successInk, marginLeft: 8 }]}>
                  Gewonnen ·{' '}
                </Text>
                <RollupNumber
                  cents={auction.current_bid_cents ?? 0}
                  style={[styles.label, { color: stage.successInk }]}
                />
              </View>
            ) : state === 'leading' ? (
              <View style={styles.center}>
                <Check size={19} color={stage.lead} />
                <Text style={[styles.label, { color: stage.lead, marginLeft: 8 }]}>
                  Du führst · {formatEuro(auction.current_bid_cents)}
                </Text>
              </View>
            ) : state === 'seller' ? (
              <Text style={[styles.label, { color: stage.text }]}>
                {auction.current_bid_cents == null
                  ? 'Noch kein Gebot'
                  : `Läuft · ${formatEuro(auction.current_bid_cents)}`}
              </Text>
            ) : state === 'closed' ? (
              <Text style={[styles.label, { color: stage.textMuted }]}>
                Warte auf den nächsten Artikel
              </Text>
            ) : (
              <View style={styles.center}>
                <Text
                  style={[
                    styles.label,
                    { color: state === 'outbid' ? stage.liveInk : stage.goldInk },
                  ]}
                >
                  {state === 'outbid' ? 'Kontern' : 'Gebot'}: {formatEuro(target)}
                </Text>
                <ChevronsRight
                  size={20}
                  color={state === 'outbid' ? stage.liveInk : stage.goldInk}
                  style={{ marginLeft: 6 }}
                />
              </View>
            )}
          </Pressable>
        </Animated.View>
      </View>

      <View style={styles.barTrack}>
        {barVisible ? (
          <View
            style={[
              styles.barFill,
              {
                width: `${barPercent}%`,
                backgroundColor:
                  secondsLeft <= auctionConfig.urgentSeconds ? stage.live : stage.gold,
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.sm,
  },
  grow: { flex: 1 },
  center: { flexDirection: 'row', alignItems: 'center' },
  primary: {
    height: 48,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '700' },
  secondary: {
    height: 48,
    minWidth: 88,
    paddingHorizontal: space.lg,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: stage.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryActive: { borderColor: stage.gold },
  secondaryLabel: { fontSize: 11, color: stage.textMuted },
  secondaryPrice: { fontSize: 14, fontWeight: '700', color: stage.text },

  barTrack: {
    height: 3,
    marginHorizontal: space.md,
    borderRadius: 2,
    backgroundColor: 'rgba(245,241,232,0.10)',
    overflow: 'hidden',
  },
  barFill: { height: 3, borderRadius: 2 },
});

const stateStyles = StyleSheet.create({
  idle: { backgroundColor: stage.gold },
  urgent: { backgroundColor: stage.gold },
  outbid: { backgroundColor: stage.live },
  leading: { backgroundColor: 'rgba(79,183,142,0.12)', borderWidth: 1.5, borderColor: stage.lead },
  won: { backgroundColor: stage.success },
  closed: { backgroundColor: 'rgba(245,241,232,0.08)' },
  seller: { backgroundColor: 'rgba(245,241,232,0.08)' },
});
