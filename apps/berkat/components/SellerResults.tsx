// Gefundene Verkäufer — was die Suche zeigt, wenn niemand live ist.
//
// Steht an derselben Stelle wie sonst der „Demnächst"-Streifen: oben, über dem
// Raster. Wer sucht, sucht selten eine laufende Show — er sucht einen Menschen.

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Search, ShoppingBag } from 'lucide-react-native';
import { ui, radius, space } from '../theme/tokens';
import { Avatar } from './Avatar';
import type { FoundSeller } from '../lib/useSellerSearch';

type Props = {
  sellers: FoundSeller[];
  loading: boolean;
  query: string;
  onSelect: (sellerId: string) => void;
};

/** „3 kaufbar · 12 Zuschläge" — oder ehrlich, dass es hier noch nichts gibt. */
function subtitle(seller: FoundSeller): string {
  const parts: string[] = [];
  if (seller.listings > 0) parts.push(`${seller.listings} kaufbar`);
  if (seller.sold > 0)
    parts.push(`${seller.sold} ${seller.sold === 1 ? 'Zuschlag' : 'Zuschläge'}`);
  return parts.length > 0 ? parts.join(' · ') : 'Noch nichts im Regal';
}

export function SellerResults({ sellers, loading, query, onSelect }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.head}>
        <Search size={15} color={ui.textMuted} />
        <Text style={s.headText}>Verkäufer</Text>
      </View>

      {sellers.length === 0 ? (
        <Text style={s.empty}>
          {loading
            ? 'Suche …'
            : `Niemand mit „${query}" gefunden. Achte auf die Schreibweise — gesucht wird der Benutzername.`}
        </Text>
      ) : (
        sellers.map((seller) => (
          <Pressable
            key={seller.id}
            style={s.row}
            onPress={() => onSelect(seller.id)}
            accessibilityRole="button"
            accessibilityLabel={`${seller.username ?? 'Verkäufer'} — ${subtitle(seller)}`}
          >
            <Avatar uri={seller.avatar_url} name={seller.username} size={38} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={s.name}>
                {seller.username ?? 'Verkäufer'}
              </Text>
              <Text style={s.sub}>{subtitle(seller)}</Text>
            </View>
            {/* Das Einkaufstaschen-Zeichen nur, wenn es wirklich etwas zu holen
                gibt — sonst verspricht die Liste einen Laden, der leer ist. */}
            {seller.listings > 0 ? <ShoppingBag size={16} color={ui.brand} /> : null}
          </Pressable>
        ))
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { marginBottom: space.md },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm },
  headText: { fontSize: 13, fontWeight: '700', color: ui.text },
  empty: { fontSize: 13, color: ui.textMuted, lineHeight: 19 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: ui.card,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: ui.line,
    paddingHorizontal: space.md,
    paddingVertical: space.sm + 2,
    marginBottom: space.sm,
  },
  name: { fontSize: 15, fontWeight: '700', color: ui.text },
  sub: { fontSize: 12, color: ui.textMuted, marginTop: 1 },
});
