// Der Block am unteren Rand des Live-Raums.
//
// Aufbau von oben nach unten, in der Reihenfolge der Fragen, die ein Zuschauer
// stellt: Was kommt noch? Wer führt gerade? Was ist das und was kostet es?
// Und dann erst: der Knopf.

import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Package, Play } from 'lucide-react-native';
import { stage, radius, space, auction as auctionConfig } from '../theme/tokens';
import { formatCountdown, formatEuro, type Auction, type MiniProfile } from '../lib/useAuction';
import { shippingHint } from '../lib/useShipping';
import { Avatar } from './Avatar';
import { BidButton } from './BidButton';

type Props = {
  auction: Auction | null;
  upcoming: Auction[];
  secondsLeft: number;
  myUserId: string | null;
  leader: MiniProfile | null;
  busy?: boolean;
  cartLabel?: string | null;
  onBid: (amountCents: number) => void;
  onBuyNow?: () => void;
  /**
   * Nur für den Gastgeber: den nächsten Artikel starten, ohne den Raum zu
   * verlassen. Ohne das müsste er den Stream beenden, um weiterzuverkaufen.
   */
  onStartNext?: () => void;
  startBusy?: boolean;
  onMaxBid?: () => void;
  myMaxCents?: number | null;
  /**
   * Günstigster Versandsatz des Verkäufers in Cent, `null` wenn keiner
   * hinterlegt ist. Steht hier nichts, wird auch nichts behauptet.
   */
  shippingFromCents?: number | null;
};

export function AuctionPanel({
  auction,
  upcoming,
  secondsLeft,
  myUserId,
  leader,
  busy,
  cartLabel,
  onBid,
  onBuyNow,
  onStartNext,
  startBusy,
  onMaxBid,
  myMaxCents,
  shippingFromCents,
}: Props) {
  const isSold = auction?.status === 'sold';
  const urgent = secondsLeft <= auctionConfig.urgentSeconds;

  return (
    <View>
      {cartLabel ? (
        <View style={styles.cartBar}>
          <Package size={14} color={stage.gold} />
          <Text style={styles.cartText}>{cartLabel}</Text>
        </View>
      ) : null}

      {upcoming.length > 0 ? (
        <View style={styles.nextRow}>
          <Text style={styles.nextLabel}>Als Nächstes</Text>
          {upcoming.slice(0, 4).map((item) => (
            <View key={item.id} style={styles.nextTile}>
              {item.image_url ? (
                <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} />
              ) : (
                <Text numberOfLines={1} style={styles.nextTileText}>
                  {item.title.slice(0, 2)}
                </Text>
              )}
            </View>
          ))}
          {upcoming.length > 4 ? (
            <Text style={styles.nextMore}>+{upcoming.length - 4}</Text>
          ) : null}
        </View>
      ) : null}

      {auction && leader ? (
        <View style={styles.leaderRow}>
          <Avatar uri={leader.avatarUrl} name={leader.username} size={22} ring />
          <Text numberOfLines={1} style={styles.leaderText}>
            <Text style={styles.leaderName}>{leader.username}</Text>
            <Text style={styles.leaderVerb}>
              {isSold ? ' hat den Zuschlag!' : ' hat das Höchstgebot!'}
            </Text>
          </Text>
        </View>
      ) : null}

      {auction ? (
        <View style={styles.product}>
          <View style={styles.thumb}>
            {auction.image_url ? (
              <Image source={{ uri: auction.image_url }} style={StyleSheet.absoluteFill} />
            ) : null}
          </View>

          <View style={styles.productText}>
            <Text numberOfLines={1} style={styles.title}>
              {auction.title}
            </Text>
            <Text numberOfLines={2} style={styles.description}>
              {auction.buy_now_cents
                ? `Auktion oder Sofortkauf für ${formatEuro(auction.buy_now_cents)}`
                : `Startet bei ${formatEuro(auction.start_price_cents)}, Schritt ${formatEuro(auction.min_increment_cents)}`}
            </Text>
            {/* Stand bis 15.08.2026 „Versand und Steuern kommen dazu" — beides
                war unwahr: Es wurde weder Versand noch Steuer berechnet. Eine
                falsche Preisangabe ist nach PAngV angreifbar, und beim ersten
                fremden Verkäufer wäre es ein Streit. Jetzt steht hier der echte
                Satz, oder gar nichts. */}
            <Text style={styles.shipping}>
              {shippingHint(shippingFromCents) ?? 'Alle Zuschläge kommen in ein Paket'}
            </Text>
          </View>

          <View style={styles.priceBlock}>
            <Text style={styles.price}>
              {formatEuro(auction.current_bid_cents ?? auction.start_price_cents)}
            </Text>
            {isSold ? (
              <Text style={[styles.countdown, { color: stage.live }]}>Verkauft</Text>
            ) : secondsLeft <= 0 ? (
              // Zwischen "Zeit um" und dem Zuschlag liegt ein Server-Aufruf.
              // Eine stehende 00:00 sieht nach Absturz aus, das hier nicht.
              <Text style={[styles.countdown, { color: stage.textMuted }]}>Zuschlag …</Text>
            ) : (
              <Text
                style={[styles.countdown, { color: urgent ? stage.live : stage.textMuted }]}
              >
                {formatCountdown(secondsLeft)}
              </Text>
            )}
          </View>
        </View>
      ) : (
        <View style={styles.product}>
          <View style={styles.productText}>
            <Text style={styles.title}>
              {onStartNext ? 'Bereit für den nächsten' : 'Gleich geht es weiter'}
            </Text>
            <Text style={styles.description}>
              {upcoming.length > 0
                ? `${upcoming.length} Artikel warten`
                : onStartNext
                  ? 'Leg im Reiter „Verkaufen" noch etwas auf'
                  : 'Der Verkäufer legt gleich den nächsten Artikel auf'}
            </Text>
          </View>
        </View>
      )}

      {/* Der Gastgeber braucht genau einen Knopf, wenn nichts läuft. Vorher
          stand hier nur Text — und die Show war zu Ende, weil Starten nur im
          Studio ging und der Weg dorthin den Stream beendet hätte. */}
      {onStartNext && !auction && upcoming.length > 0 ? (
        <View style={styles.startWrap}>
          <Pressable
            onPress={onStartNext}
            disabled={startBusy}
            style={[styles.startNext, startBusy && styles.startNextBusy]}
            accessibilityRole="button"
            accessibilityLabel="Nächsten Artikel starten"
          >
            <Play size={19} color={stage.goldInk} />
            <Text style={styles.startNextText}>Nächsten Artikel starten</Text>
          </Pressable>
        </View>
      ) : null}

      <BidButton
        auction={auction}
        secondsLeft={secondsLeft}
        myUserId={myUserId}
        busy={busy}
        onBid={onBid}
        onBuyNow={onBuyNow}
        onMaxBid={onMaxBid}
        myMaxCents={myMaxCents}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  cartBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginLeft: space.md,
    marginBottom: space.sm,
    backgroundColor: 'rgba(233,167,60,0.14)',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  cartText: { fontSize: 11, fontWeight: '600', color: stage.gold },

  nextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  nextLabel: { fontSize: 11, color: stage.textMuted, marginRight: 2 },
  nextTile: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(245,241,232,0.12)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextTileText: { fontSize: 11, fontWeight: '600', color: stage.text },
  nextMore: { fontSize: 11, color: stage.textMuted, marginLeft: 2 },

  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  leaderText: { flex: 1, fontSize: 12 },
  leaderName: { color: stage.text, fontWeight: '700' },
  leaderVerb: { color: stage.gold, fontWeight: '700' },

  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(245,241,232,0.12)',
    overflow: 'hidden',
  },
  productText: { flex: 1, minWidth: 0 },
  title: { fontSize: 17, fontWeight: '700', color: stage.text },
  description: { fontSize: 12, color: stage.textMuted, marginTop: 1 },
  shipping: { fontSize: 10, color: stage.textMuted, marginTop: 2, opacity: 0.8 },
  startWrap: { paddingHorizontal: space.md, paddingBottom: space.md },
  startNext: {
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: stage.gold,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  startNextBusy: { opacity: 0.6 },
  startNextText: { fontSize: 16, fontWeight: '700', color: stage.goldInk },

  priceBlock: { alignItems: 'flex-end' },
  price: { fontSize: 22, fontWeight: '700', color: stage.text },
  countdown: { fontSize: 13, fontWeight: '700', marginTop: 1 },
});
