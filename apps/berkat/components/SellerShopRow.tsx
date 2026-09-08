import { memo } from 'react';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { Listing } from '../lib/useListings';
import type { SoldItem } from '../lib/useSellerProfile';
import { formatEuro } from '../lib/useAuction';
import { radius, ratio, space, ui } from '../theme/tokens';
import { ListingCard } from './ListingCard';

export const SellerListingRow = memo(function SellerListingRow({ cells, mine, savedIds, onToggleSaved }: {
  cells: (Listing | null)[];
  mine: boolean;
  savedIds?: Set<string>;
  onToggleSaved: (id: string, saved: boolean) => void;
}) {
  return <View style={[sellerShopStyles.surface, s.listingRow]}>
    {cells.map((listing, index) => <View key={listing?.id ?? `empty:${index}`} style={s.cell}>
      {listing ? <ListingCard listing={listing} mine={mine} saved={Boolean(savedIds?.has(listing.id))}
        onPress={() => router.push(`/listing/${listing.id}`)}
        onToggleSaved={() => onToggleSaved(listing.id, Boolean(savedIds?.has(listing.id)))} /> : null}
    </View>)}
  </View>;
});

export const SellerSoldRow = memo(function SellerSoldRow({ cells }: { cells: (SoldItem | null)[] }) {
  return <View style={s.soldRow}>
    {cells.map((item, index) => <View key={item?.id ?? `empty:${index}`} style={s.cell}>
      {item ? <>
        <View style={s.thumb}>
          {item.image_url ? <Image source={{ uri: item.image_url }} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} /> : null}
          {item.current_bid_cents != null ? <View style={s.pricePill}>
            <Text style={s.priceText}>{formatEuro(item.current_bid_cents)}</Text>
          </View> : null}
        </View>
        <Text numberOfLines={1} style={s.cellTitle}>{item.title}</Text>
      </> : null}
    </View>)}
  </View>;
});

// The header, virtual rows and footer form one continuous shop surface.
export const sellerShopStyles = StyleSheet.create({
  surface: { backgroundColor: ui.card, borderLeftWidth: StyleSheet.hairlineWidth, borderRightWidth: StyleSheet.hairlineWidth, borderColor: ui.line, paddingHorizontal: space.lg },
  head: { borderTopWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingTop: space.lg, paddingBottom: space.md, marginTop: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: ui.text },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },
  foot: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomLeftRadius: radius.lg, borderBottomRightRadius: radius.lg, paddingBottom: space.lg },
  hint: { fontSize: 11, lineHeight: 16, color: ui.textMuted, marginTop: space.xs },
});
const s = StyleSheet.create({
  listingRow: { flexDirection: 'row', gap: space.md, paddingBottom: space.md },
  soldRow: { flexDirection: 'row', gap: space.xs, paddingBottom: space.xs },
  cell: { flex: 1, minWidth: 0 },
  thumb: { aspectRatio: ratio.card, borderRadius: radius.sm, backgroundColor: ui.sunken, overflow: 'hidden' },
  pricePill: { position: 'absolute', left: space.xs, bottom: space.xs, backgroundColor: ui.onImage, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 2 },
  priceText: { fontSize: 11, fontWeight: '700', color: ui.card },
  cellTitle: { fontSize: 11, color: ui.textMuted, marginTop: 3 },
});
