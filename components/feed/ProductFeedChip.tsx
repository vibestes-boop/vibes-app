import { ShoppingBag } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import type { LinkedProduct } from '@/lib/useFeedProducts';

// Shoppable Posts (#2): tappbare Produktkarte über einem Post/Video. Geteilt
// von Feed (FeedItem), Post-Detail (post/[id]) und Guild-Detail (guild-post/[id])
// → konsistente Optik + ein Tap-Ziel (/shop/[id]). Vorbestellung zeigt € /
// „Vormerken", Coin-Produkt 🪙 / „Ansehen".
export function ProductFeedChip({
  product,
  style,
}: {
  product: LinkedProduct;
  style?: StyleProp<ViewStyle>;
}) {
  const router = useRouter();
  const isPreorder = product.sale_mode === 'preorder';
  const priceLabel = isPreorder
    ? (product.price_eur != null ? `${product.price_eur.toFixed(2).replace('.', ',')} €` : 'Preis im Shop')
    : `🪙 ${product.sale_price_coins ?? product.price_coins}`;
  const ctaLabel = isPreorder ? 'Vorbestellen' : 'Ansehen';

  return (
    <Pressable
      onPress={() => {
        impactAsync(ImpactFeedbackStyle.Light);
        router.push({ pathname: '/shop/[id]', params: { id: product.id } });
      }}
      style={[s.chip, style]}
      accessibilityRole="button"
      accessibilityLabel={`Produkt ansehen: ${product.title}`}
    >
      {product.cover_url ? (
        <Image source={{ uri: product.cover_url }} style={s.img} cachePolicy="memory-disk" contentFit="cover" />
      ) : (
        <View style={[s.img, s.imgFallback]}>
          <ShoppingBag size={16} color="#fff" strokeWidth={2} />
        </View>
      )}
      <View style={s.body}>
        <Text style={s.title} numberOfLines={1}>{product.title}</Text>
        <Text style={s.price} numberOfLines={1}>{priceLabel}</Text>
      </View>
      <View style={s.cta}>
        <ShoppingBag size={13} color="#0A0A0A" strokeWidth={2.4} />
        <Text style={s.ctaText}>{ctaLabel}</Text>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    maxWidth: '86%',
  },
  img: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  imgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flexShrink: 1,
    gap: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  price: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  ctaText: {
    color: '#0A0A0A',
    fontSize: 12,
    fontWeight: '700',
  },
});
