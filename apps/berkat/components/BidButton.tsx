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

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Check, ChevronsRight, PartyPopper } from 'lucide-react-native';
import { stage, radius, space, auction as auctionConfig } from '../theme/tokens';
import { formatEuro, nextMinBid, type Auction } from '../lib/useAuction';
import { RollupNumber } from './RollupNumber';
import { useReducedMotion } from '../lib/useReducedMotion';

/** Griff und Innenabstand der Ziehbahn. Müssen zu `styles.knob` passen. */
const KNOB = 40;
const TRACK_PAD = 4;

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

/** A bid requires a horizontal drag. VoiceOver uses the explicit accessibility action. */
export function SlideToBid({
  confirmationKey,
  label,
  tone,
  onConfirm,
  busy,
}: {
  confirmationKey: string;
  label: string;
  tone: 'gold' | 'live';
  onConfirm: () => void;
  busy: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const [trackWidth, setTrackWidth] = useState(0);
  const x = useRef(new Animated.Value(0)).current;

  // Der zuletzt gezogene Weg. Als Ref, weil `Animated.Value` sich nicht sauber
  // synchron auslesen lässt und die PanResponder-Rückrufe sonst auf einem alten
  // Stand stehen blieben.
  const dragged = useRef(0);
  const travelRef = useRef(0);
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const confirmRef = useRef(onConfirm);
  confirmRef.current = onConfirm;
  const currentKey = useRef(confirmationKey);
  currentKey.current = confirmationKey;
  const startedKey = useRef<string | null>(null);
  const reducedMotion = useReducedMotion();
  const reduceRef = useRef(reducedMotion);
  reduceRef.current = reducedMotion;

  const travel = Math.max(0, trackWidth - KNOB - TRACK_PAD * 2);
  travelRef.current = travel;

  const reset = (animated: boolean) => {
    dragged.current = 0;
    if (animated && !reduceRef.current) {
      Animated.spring(x, { toValue: 0, useNativeDriver: true, friction: 7, tension: 180 }).start();
    } else {
      x.setValue(0);
    }
  };

  // Nach einem Gebot wechselt der Zustand ohnehin („Du führst"), aber wenn ein
  // Gegengebot sofort zurückkommt, steht derselbe Knopf wieder da — dann muss
  // der Griff links stehen und nicht am Anschlag.
  useEffect(() => {
    startedKey.current = null;
    reset(false);
  }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps

  // A changed article/amount or rotated track invalidates the gesture already in progress.
  useEffect(() => { startedKey.current = null; reset(false); }, [confirmationKey, trackWidth]); // eslint-disable-line react-hooks/exhaustive-deps

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Erst ab einer echten waagerechten Bewegung übernehmen. Ohne das
        // schluckt der Griff jedes Antippen, und ein senkrechtes Wischen über
        // dem Knopf würde die Liste darüber nicht mehr erreichen.
        onMoveShouldSetPanResponder: (_e, g) =>
          !busyRef.current && Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderGrant: () => { startedKey.current = currentKey.current; },
        onPanResponderMove: (_e, g) => {
          const next = Math.max(0, Math.min(travelRef.current, g.dx));
          dragged.current = next;
          x.setValue(next);
        },
        onPanResponderRelease: () => {
          const t = travelRef.current;
          // 60 % des Weges. Weniger wäre wieder versehentlich auslösbar, mehr
          // fühlt sich nach Arbeit an — und in den letzten Sekunden einer
          // Auktion zählt jede Zehntelsekunde.
          const sameQuote = startedKey.current !== null && startedKey.current === currentKey.current;
          startedKey.current = null;
          if (!busyRef.current && sameQuote && t > 0 && dragged.current >= t * 0.6) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            if (reduceRef.current) reset(false);
            else Animated.timing(x, {
              toValue: t,
              duration: 90,
              useNativeDriver: true,
            }).start(() => reset(false));
            confirmRef.current();
          } else {
            reset(true);
          }
        },
        onPanResponderTerminate: () => { startedKey.current = null; reset(true); },
      }),
    // Read current actions from refs without replacing the active responder.
    [x],
  );

  const ink = tone === 'gold' ? stage.goldInk : stage.liveInk;
  const surface = tone === 'gold' ? stage.gold : stage.live;

  const onLayout = (e: LayoutChangeEvent) => setTrackWidth(e.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      style={[styles.primary, { backgroundColor: surface, opacity: busy ? 0.6 : 1 }]}
      accessibilityRole="button"
      accessibilityState={{ disabled: busy, busy }}
      accessibilityLabel={`${label}. Zum Bieten nach rechts ziehen.`}
      onAccessibilityTap={() => {
        if (!busy) onConfirm();
      }}
    >
      <Text key={`copy-0-${fontScale}`} style={[styles.label, styles.slideLabel, { color: ink }]}>
        {label}
      </Text>

      <Animated.View
        {...responder.panHandlers}
        style={[styles.knob, { backgroundColor: ink, transform: [{ translateX: x }] }]}
      >
        <ChevronsRight size={20} color={surface} />
      </Animated.View>
    </View>
  );
}

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
  const { fontScale } = useWindowDimensions();
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

  /** Zustände, in denen ein Gebot überhaupt möglich ist. */
  const interactive = state === 'idle' || state === 'outbid' || state === 'urgent';

  // Ohne eigene Haptik: Die Ziehbahn meldet den Erfolg schon selbst, und zwei
  // Rückmeldungen für eine Handlung fühlen sich nach Fehler an.
  const confirm = () => {
    if (!canPress) return;
    onBid(target);
  };

  const showBuyNow =
    Boolean(auction.buy_now_cents) &&
    Boolean(onBuyNow) &&
    (state === 'idle' || state === 'urgent' || state === 'outbid');


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
            <Text key={`copy-1-${fontScale}`} style={styles.secondaryLabel}>Max</Text>
            <Text key={`copy-2-${fontScale}`}
              style={[styles.secondaryPrice, myMaxCents ? { color: stage.gold } : null]}
              numberOfLines={1}
            >
              {myMaxCents ? formatEuro(myMaxCents) : '—'}
            </Text>
          </Pressable>
        ) : null}

        {showBuyNow ? (
          <Pressable onPress={onBuyNow} style={styles.secondary} accessibilityRole="button">
            <Text key={`copy-3-${fontScale}`} style={styles.secondaryLabel}>Sofort</Text>
            <Text key={`copy-4-${fontScale}`} style={styles.secondaryPrice}>{formatEuro(auction.buy_now_cents)}</Text>
          </Pressable>
        ) : null}

        <Animated.View style={[styles.grow, { transform: [{ scale }] }]}>
          {interactive ? (
            <SlideToBid
              confirmationKey={`${auction.id}:${target}`}
              label={`${state === 'outbid' ? 'Kontern' : 'Gebot'}: ${formatEuro(target)}`}
              tone={state === 'outbid' ? 'live' : 'gold'}
              busy={Boolean(busy)}
              onConfirm={confirm}
            />
          ) : (
          <Pressable
            disabled
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
                <Text key={`copy-5-${fontScale}`} style={[styles.label, { color: stage.successInk, marginLeft: 8 }]}>
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
                <Text key={`copy-6-${fontScale}`} style={[styles.label, { color: stage.lead, marginLeft: 8 }]}>
                  Du führst · {formatEuro(auction.current_bid_cents)}
                </Text>
              </View>
            ) : state === 'seller' ? (
              <Text key={`copy-7-${fontScale}`} style={[styles.label, { color: stage.text }]}>
                {auction.current_bid_cents == null
                  ? 'Noch kein Gebot'
                  : `Läuft · ${formatEuro(auction.current_bid_cents)}`}
              </Text>
            ) : state === 'closed' ? (
              <Text key={`copy-8-${fontScale}`} style={[styles.label, { color: stage.textMuted }]}>
                Warte auf den nächsten Artikel
              </Text>
            ) : null /* idle, urgent und outbid rendert `SlideToBid` oben */}
          </Pressable>
          )}
        </Animated.View>
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
    minHeight: 48,
    paddingVertical: space.sm,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    // Der Griff liegt absolut darin — ohne das ragt er über die Pille hinaus.
    overflow: 'hidden',
  },
  /* Der Griff der Ziehbahn. Muss zu KNOB und TRACK_PAD oben passen. */
  knob: {
    position: 'absolute',
    left: TRACK_PAD,
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  slideLabel: { marginHorizontal: KNOB + TRACK_PAD * 2 },
  secondary: {
    minHeight: 48,
    paddingVertical: space.sm,
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
