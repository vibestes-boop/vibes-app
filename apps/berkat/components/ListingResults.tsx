// Gefundene Artikel — die zweite Hälfte der Suche.
//
// `search_berkat_sellers` findet Menschen, das hier findet Ware. Bis zum
// 17.08.2026 versprach das Suchfeld „Show oder Verkäufer" — ein Artikel war
// unauffindbar, wenn man seinen Verkäufer nicht kannte. Mit einer Artikelseite
// je Angebot hat eine Artikelsuche jetzt ein Ziel.
//
// Steht UNTER den Verkäufer-Treffern: Wer einen Namen tippt, meint meist den
// Menschen; wer „Teekanne" tippt, bekommt trotzdem beides und liest einfach
// weiter. Rendert bei null Treffern NICHTS — die Verkäufer-Box erklärt den
// Leerfall schon, zwei „nichts gefunden" übereinander wären Lärm.

import { StyleSheet, Text, View } from 'react-native';
import { Tag } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import type { Listing } from '../lib/useListings';
import { ListingCard } from './ListingCard';

type Props = {
  listings: Listing[];
  onSelect: (auctionId: string) => void;
};

export function ListingResults({ listings, onSelect }: Props) {
  if (listings.length === 0) return null;

  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Tag size={15} color={ui.textMuted} />
        <Text style={s.headText}>Artikel</Text>
        <Text style={s.count}>{listings.length}</Text>
      </View>

      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          layout="row"
          onPress={() => onSelect(listing.id)}
        />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: ui.card,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    padding: space.lg,
    marginBottom: space.md,
    gap: space.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  headText: { flex: 1, fontSize: 13, fontWeight: '700', color: ui.textMuted },
  count: { fontSize: 12, fontWeight: '700', color: ui.textMuted },
});
