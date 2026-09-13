import { useEffect, useRef, useState } from 'react';
import { Keyboard, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight, Package, Play } from 'lucide-react-native';
import { stage, radius, space, auction as auctionConfig } from '../theme/tokens';
import { formatCountdown, formatEuro, type Auction, type MiniProfile } from '../lib/useAuction';
import { shippingHint } from '../lib/useShipping';
import { sellerKindNote } from '../lib/useBerkatSeller';
import { BidButton } from './BidButton';
import { PressFeedback } from './PressFeedback';
import { StageSheet } from './StageSheet';

type Props = {
  auction: Auction | null; upcoming: Auction[]; secondsLeft: number;
  myUserId: string | null; leader: MiniProfile | null; isHost?: boolean; compact?: boolean;
  busy?: boolean; cartLabel?: string | null; onBid: (amountCents: number) => void;
  onBuyNow?: () => void; onStartNext?: () => void; startBusy?: boolean;
  onMaxBid?: () => void; myMaxCents?: number | null; onOpenItems?: () => void;
  shippingFromCents?: number | null; sellerTakesPayment?: boolean;
};

/** One article row on stage; full image and additional information open deliberately. */
export function AuctionPanel({ auction, upcoming, secondsLeft, myUserId, leader, isHost: hostRole = false,
  compact = false, busy, cartLabel, onBid, onBuyNow, onStartNext, startBusy, onMaxBid, myMaxCents,
  onOpenItems, shippingFromCents, sellerTakesPayment }: Props) {
  const { fontScale } = useWindowDimensions();
  const [sheet, setSheet] = useState<'details' | 'bid' | null>(null);
  const afterBidClose = useRef<(() => void) | null>(null);
  const largeType = fontScale > 1.4;
  useEffect(() => { setSheet(null); afterBidClose.current = null; }, [auction?.id]);
  const isHost = hostRole || Boolean(myUserId && auction?.seller_id === myUserId);
  const sold = auction?.status === 'sold';
  const running = auction?.status === 'running';
  const priceLabel = sold ? 'Zuschlag' : auction?.current_bid_cents != null ? 'Höchstgebot' : 'Startpreis';
  const time = sold ? 'Verkauft' : running ? secondsLeft > 0 ? formatCountdown(secondsLeft) : 'Zuschlag …'
    : auction?.status === 'unsold' ? 'Ohne Gebot' : 'Bereit';
  const price = formatEuro(auction?.current_bid_cents ?? auction?.start_price_cents ?? 0);
  const bids = auction?.bid_count ?? 0;
  const bidder = sold ? leader?.username ? `Zuschlag an ${leader.username}` : 'Zuschlag bestätigt'
    : bids ? `${bids} ${bids === 1 ? 'Gebot' : 'Gebote'}${leader?.username ? ` · ${leader.username} führt` : ''}` : 'Noch kein Gebot';
  // These remain in the viewer's bidding path, including at large font sizes.
  const purchaseNotes = auction ? <View key={`notes-${fontScale}`} style={s.notes}>
    <Text style={s.note}>{shippingHint(shippingFromCents) ?? 'Alle Zuschläge kommen in ein Paket'}</Text>
    {sellerKindNote(auction.seller_kind) ? <Text style={s.note}>{sellerKindNote(auction.seller_kind)}</Text> : null}
    {sellerTakesPayment === false ? <Text style={s.note}>Bezahlt wird direkt beim Verkäufer — schreib ihm nach dem Zuschlag</Text> : null}
  </View> : null;

  return <View testID={isHost ? 'host-auction' : 'viewer-auction'}>
    {auction ? <PressFeedback onPress={() => { Keyboard.dismiss(); setSheet('details'); }} style={s.product}
      accessibilityRole="button" accessibilityLabel={`${auction.title}. ${priceLabel} ${price}. ${time}. Artikeldetails öffnen`}>
      {!compact ? <View style={s.thumb}>{auction.image_url
        ? <Image source={{ uri: auction.image_url }} style={StyleSheet.absoluteFill} contentFit="contain" />
        : <Package size={22} color={stage.textMuted} />}</View> : null}
      <View key={`summary-${fontScale}`} style={s.copy}>
        <Text numberOfLines={compact || fontScale <= 1.4 ? 1 : 2} style={s.title}>{auction.title}</Text>
        <View style={s.priceLine}>
          <Text style={s.price}>{price}</Text>
          <Text style={s.status}>{isHost && running ? `${bids} ${bids === 1 ? 'Gebot' : 'Gebote'}` : priceLabel}</Text>
        </View>
      </View>
      <Text key={`time-${fontScale}`} style={[s.time, running && secondsLeft > 0 && secondsLeft <= auctionConfig.urgentSeconds && s.urgent]}>{time}</Text>
      <ChevronRight size={15} color={stage.textMuted} />
    </PressFeedback> : !compact ? <View key={`idle-${fontScale}`} style={s.empty}>
      <View style={s.copy}>
        <Text style={s.title}>{isHost ? 'Deine Bühne ist frei' : 'Gleich geht es weiter'}</Text>
        <Text style={s.status}>{isHost ? upcoming.length ? `${upcoming.length} Artikel vorbereitet` : 'Öffne den Shop, um Artikel bereitzulegen.' : 'Der nächste Artikel folgt.'}</Text>
      </View>
      {isHost && onStartNext && upcoming.length ? <PressFeedback onPress={onStartNext} disabled={startBusy || busy} style={s.start}
        accessibilityRole="button" accessibilityLabel="Nächsten Artikel starten" accessibilityState={{ disabled: Boolean(startBusy || busy), busy: Boolean(startBusy) }}>
        <Play size={18} color={stage.goldInk} /><Text style={s.startText}>{startBusy ? 'Startet …' : 'Starten'}</Text>
      </PressFeedback> : onOpenItems && isHost ? <PressFeedback onPress={onOpenItems} style={s.openShop} accessibilityRole="button" accessibilityLabel="Artikel öffnen">
        <Package size={21} color={stage.text} />
      </PressFeedback> : null}
    </View> : null}
    {!isHost && !compact && auction ? largeType ? <PressFeedback style={s.prepareBid}
      onPress={() => setSheet('bid')} accessibilityRole="button" accessibilityLabel="Gebot und Verkaufsdetails öffnen">
      <Text key={`prepare-${fontScale}`} style={s.prepareText}>Gebot & Details</Text><ChevronRight size={20} color={stage.goldInk} />
    </PressFeedback> : <>
      {purchaseNotes}
      <BidButton auction={auction} secondsLeft={secondsLeft} myUserId={myUserId} busy={busy}
        onBid={onBid} onBuyNow={onBuyNow} onMaxBid={onMaxBid} myMaxCents={myMaxCents} />
    </> : null}
    <StageSheet visible={sheet !== null && Boolean(auction)} title={sheet === 'bid' ? 'Dein Gebot' : 'Aktueller Artikel'} onClose={() => setSheet(null)}
      onDismiss={() => { const action = afterBidClose.current; afterBidClose.current = null; action?.(); }}>
      {auction && sheet === 'bid' ? <>
        <Text key={`bid-title-${fontScale}`} style={s.detailTitle}>{auction.title}</Text>
        <Text key={`bid-price-${fontScale}`} style={s.detailPrice}>{priceLabel}: {price} · {time}</Text>
        {purchaseNotes}
        <BidButton auction={auction} secondsLeft={secondsLeft} myUserId={myUserId} busy={busy} onBid={onBid} onBuyNow={onBuyNow}
          onMaxBid={onMaxBid ? () => { afterBidClose.current = onMaxBid; setSheet(null); } : undefined} myMaxCents={myMaxCents} />
      </> : null}
      {auction && sheet === 'details' ? <View key={`detail-${auction.id}-${fontScale}`} style={s.details}>
        <View style={s.largeImage}>{auction.image_url
          ? <Image source={{ uri: auction.image_url }} style={StyleSheet.absoluteFill} contentFit="contain" />
          : <Package size={48} color={stage.textMuted} />}</View>
        <Text style={s.detailTitle}>{auction.title}</Text>
        <Text style={s.detailPrice}>{priceLabel}: {price} · {time}</Text>
        <Text style={s.detailText}>{bidder}</Text>
        <Text style={s.detailText}>Gebotsschritt: {formatEuro(auction.min_increment_cents)}</Text>
        {onBuyNow && auction.buy_now_cents ? <Text style={s.detailText}>Sofortkauf: {formatEuro(auction.buy_now_cents)}</Text> : null}
        {purchaseNotes}
        {cartLabel && !isHost ? <Text style={s.detailText}>{cartLabel}</Text> : null}

      </View> : null}
    </StageSheet>
  </View>;
}
const s = StyleSheet.create({
  product: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginHorizontal: space.md, padding: space.sm,
    backgroundColor: stage.control, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: stage.line },
  thumb: { width: 44, height: 44, borderRadius: radius.sm, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: stage.surfaceHigh },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, lineHeight: 19, fontWeight: '600', color: stage.text },
  priceLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: 6 },
  price: { fontSize: 16, lineHeight: 21, fontWeight: '700', color: stage.text },
  status: { fontSize: 11, lineHeight: 16, color: stage.textMuted, flexShrink: 1 },
  time: { flexShrink: 1, maxWidth: '30%', fontSize: 13, lineHeight: 18, fontWeight: '700', fontVariant: ['tabular-nums'], color: stage.text },
  urgent: { color: stage.live },
  notes: { paddingHorizontal: space.md, paddingTop: 4, paddingBottom: 6, gap: 1 },
  note: { fontSize: 11, lineHeight: 15, color: stage.text },
  empty: { marginHorizontal: space.md, padding: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: stage.control, borderRadius: radius.md },
  start: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44, maxWidth: '45%', paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.pill, backgroundColor: stage.gold },
  startText: { flexShrink: 1, fontSize: 13, lineHeight: 19, fontWeight: '700', color: stage.goldInk },
  openShop: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  prepareBid: { marginHorizontal: space.md, marginTop: space.sm, marginBottom: space.xs, minHeight: 48, paddingHorizontal: space.md, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, borderRadius: radius.pill, backgroundColor: stage.gold },
  prepareText: { flexShrink: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: stage.goldInk },
  details: { gap: space.sm },
  largeImage: { height: 260, backgroundColor: stage.surfaceHigh, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  detailTitle: { fontSize: 21, lineHeight: 28, color: stage.text, fontWeight: '700' },
  detailPrice: { fontSize: 18, lineHeight: 26, color: stage.text, fontWeight: '700' },
  detailText: { flexShrink: 1, fontSize: 14, lineHeight: 21, color: stage.text },
  allItems: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: stage.line, paddingVertical: space.sm },
});
