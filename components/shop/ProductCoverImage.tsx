import { useTheme } from '@/lib/useTheme';
import { Image } from 'expo-image';
import { ShoppingBag } from 'lucide-react-native';
import { useEffect,useState } from 'react';
import { StyleProp,StyleSheet,Text,View,ViewStyle } from 'react-native';

type ProductCategory = 'digital' | 'physical' | 'service' | 'collectible';

export function ProductCoverImage({
  uri,
  category,
  style,
  contentFit = 'cover',
  transition = 160,
  iconSize = 28,
}: {
  uri?: string | null;
  category?: ProductCategory | null;
  style?: StyleProp<ViewStyle>;
  contentFit?: 'cover' | 'contain';
  transition?: number;
  iconSize?: number;
}) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={style as any}
        contentFit={contentFit}
        transition={transition}
        cachePolicy="memory-disk"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={[style, styles.fallback, { backgroundColor: colors.bg.elevated }]}>
      <ShoppingBag size={iconSize} color={colors.text.muted} strokeWidth={1.25} />
      {category ? (
        <Text style={[styles.label, { color: colors.text.muted }]}>{categoryLabel(category)}</Text>
      ) : null}
    </View>
  );
}

function categoryLabel(category: ProductCategory) {
  if (category === 'digital') return 'Digital';
  if (category === 'service') return 'Service';
  if (category === 'collectible') return 'Collectible';
  return 'Shop';
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    opacity: 0.7,
  },
});
