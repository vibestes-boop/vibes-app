/**
 * app/shop/saved.tsx — Gespeicherte Produkte
 *
 * Erreichbar über: More-Menu → "Gespeicherte ansehen"
 */

import { CoinIcon } from '@/components/ui/CoinIcon';
import { useSavedProduct,useSavedProducts,type SavedProduct } from '@/lib/useShop';
import { ProductCoverImage } from '@/components/shop/ProductCoverImage';
import { useTheme } from '@/lib/useTheme';
import { impactAsync,ImpactFeedbackStyle } from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ArrowLeft,Bookmark } from 'lucide-react-native';
import { useCallback } from 'react';
import {
ActivityIndicator,
FlatList,
Pressable,
RefreshControl,
StyleSheet,
Text,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';

// ─── Produktkarte ─────────────────────────────────────────────────────────────

function SavedCard({ product, onPress, colors }: {
  product: SavedProduct;
  onPress: () => void;
  colors: any;
}) {
  const { toggle } = useSavedProduct(product.id);

  return (
    <Pressable
      style={[card.wrap, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <ProductCoverImage uri={product.cover_url} category={product.category} style={card.img} transition={200} />

      {/* Unsave-Button */}
      <Pressable
        style={[card.unsaveBtn, { backgroundColor: colors.bg.elevated }]}
        onPress={async () => { impactAsync(ImpactFeedbackStyle.Light); await toggle(); }}
        hitSlop={8}
      >
        <Bookmark size={14} color={colors.text.primary} fill={colors.text.primary} strokeWidth={2} />
      </Pressable>

      <View style={card.info}>
        <Text style={[card.title, { color: colors.text.primary }]} numberOfLines={2}>{product.title}</Text>
        <View style={card.footer}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <CoinIcon size={13} />
            <Text style={[card.price, { color: colors.text.primary }]}>{product.price_coins.toLocaleString('de-DE')}</Text>
          </View>
          <Text style={[card.seller, { color: colors.text.muted }]}>@{product.seller_username}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: { flex: 1, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  img: { width: '100%', aspectRatio: 1 },
  unsaveBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  info: { padding: 10, gap: 4 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  price: { fontSize: 13, fontWeight: '700' },
  seller: { fontSize: 10 },
});

// ─── Hauptscreen ─────────────────────────────────────────────────────────────

export default function SavedProductsScreen() {
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const { data: saved = [], isLoading, refetch, isRefetching } = useSavedProducts();

  const handlePress = useCallback((p: SavedProduct) => {
    router.push({ pathname: '/shop/[id]', params: { id: p.id } } as any);
  }, [router]);

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={s.backBtn}>
          <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2.5} />
        </Pressable>
        <Text style={[s.title, { color: colors.text.primary }]}>Gespeichert</Text>
        <Bookmark size={20} color={colors.text.primary} fill={colors.text.primary} strokeWidth={2} />
      </View>

      {isLoading ? (
        <View style={s.center}><ActivityIndicator color={colors.text.primary} size="large" /></View>
      ) : saved.length === 0 ? (
        <View style={s.center}>
          <Bookmark size={52} color={colors.text.muted} strokeWidth={1.2} />
          <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Noch nichts gemerkt 🔖</Text>
          <Text style={[s.emptyText, { color: colors.text.muted }]}>
            {'Tippe auf „Merken“ auf einem Produkt um es hier zu speichern.'}
          </Text>
          <Pressable
            onPress={() => router.push('/(tabs)/shop' as any)}
            style={[s.browseBtn, { backgroundColor: colors.text.primary }]}
          >
            <Text style={[s.browseBtnText, { color: colors.bg.primary }]}>Shop durchstöbern</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={saved}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 4 }}
          contentContainerStyle={{ paddingHorizontal: 4, paddingTop: 8, paddingBottom: insets.bottom + 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.text.primary} />
          }
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          renderItem={({ item }) => (
            <SavedCard product={item} onPress={() => handlePress(item)} colors={colors} />
          )}
          ListHeaderComponent={() => (
            <Text style={[s.countLabel, { color: colors.text.muted }]}>
              {saved.length} {saved.length === 1 ? 'Produkt' : 'Produkte'} gespeichert
            </Text>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  browseBtn: { paddingHorizontal: 24, paddingVertical: 13, borderRadius: 22, marginTop: 8 },
  browseBtnText: { fontSize: 15, fontWeight: '600' },
  countLabel: { fontSize: 12, paddingHorizontal: 4, paddingBottom: 8 },
});
