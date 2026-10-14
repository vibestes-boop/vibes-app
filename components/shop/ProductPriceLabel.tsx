import { Text, View } from 'react-native';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useTheme } from '@/lib/useTheme';
import { useI18n } from '@/lib/i18n';
import { formatEur, type Product } from '@/lib/useShop';
import { productDisplayPrice } from '@/lib/productDisplayPrice';
export function ProductPriceLabel({ product }: { product: Product }) {
  const { colors } = useTheme();
  const { t } = useI18n();
  const price = productDisplayPrice(product);
  return <View style={{ flexDirection: 'row', gap: 4, alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8 }}>
    {price.currency === 'coins' && <CoinIcon size={14} />}
    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.accent.primary, flexShrink: 1 }}>
      {price.amount == null ? t('nativeUi.askPrice') : price.currency === 'eur' ? formatEur(price.amount) : price.amount.toLocaleString()}
    </Text>
  </View>;
}
