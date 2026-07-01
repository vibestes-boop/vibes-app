import { ChevronRight, ShoppingBag } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import type { LinkedProduct } from '@/lib/useFeedProducts';

// Shoppable Posts (#2): kompakte tappbare Produkt-Pille über einem Post/Video.
// Geteilt von Feed (FeedItem), Post-Detail (post/[id]) und Guild-Detail
// (guild-post/[id]) → konsistente Optik + ein Tap-Ziel (/shop/[id]).
//
// Bewusst OHNE eigenen CTA-Button (TikTok-Anchor-Pattern): die ganze Pille
// navigiert zur Produktseite, dort lebt der echte Kauf-/Vorbestell-CTA.
// Und bewusst schlank (~36px): sitzt ÜBER der Autor-Zeile, damit Nickname +
// Caption an ihrer gewohnten Position bleiben (nicht hochgedrückt werden).
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
    ? (product.price_eur != null ? `${product.price_eur.toFixed(2).replace('.', ',')} €` : 'Vorbestellung')
    : `🪙 ${product.sale_price_coins ?? product.price_coins}`;

  return (
    <Pressable
      onPress={() => {
        impactAsync(ImpactFeedbackStyle.Light);
        router.push({ pathname: '/shop/[id]', params: { id: product.id } });
      }}
      style={[s.chip, style]}
      accessibilityRole="button"
      accessibilityLabel={`Produkt ansehen: ${product.title}, ${priceLabel}`}
    >
      {product.cover_url ? (
        <Image source={{ uri: product.cover_url }} style={s.img} cachePolicy="memory-disk" contentFit="cover" />
      ) : (
        <View style={[s.img, s.imgFallback]}>
          <ShoppingBag size={13} color="#fff" strokeWidth={2} />
        </View>
      )}
      <Text style={s.title} numberOfLines={1}>{product.title}</Text>
      <Text style={s.price} numberOfLines={1}>{priceLabel}</Text>
      <ChevronRight size={13} color="rgba(255,255,255,0.55)" strokeWidth={2.4} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 4,
    paddingLeft: 4,
    paddingRight: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    alignSelf: 'flex-start',
    maxWidth: '80%',
  },
  img: {
    width: 28,
    height: 28,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  imgFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flexShrink: 1,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '600',
  },
  price: {
    color: '#FBBF24',
    fontSize: 12,
    fontWeight: '600',
  },
});
