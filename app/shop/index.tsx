/**
 * app/shop/index.tsx — Shop: 2-Spalten Grid, TikTok-inspired
 *
 * v1.26.3 Richer Cards + UI-Polish (v1.26.4):
 * - 3:4 Hochformat-Karten, Sterne-Rating
 * - Sale-Badge, Bilder-Counter, Location, Gratis-Versand-Pill, NEU-Badge
 * - Kategorie-Chips (Fix: kein maxHeight-Clipping mehr)
 * - Filter-Chips (Nur Angebote / Gratis Versand / Frauen-Only)
 * - Sort-Sheet (Beliebt / Neueste / Preis ↑ / Preis ↓)
 * - Skeleton-Grid beim initialen Laden
 * - Coin-Balance Hero-Pill im Header
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, FlatList,
  TextInput, RefreshControl, ScrollView, Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Search, Package, ShoppingBag, X, Star,
  MapPin, Camera, Truck, Flame, Sparkles, ArrowDownUp, Check,
} from 'lucide-react-native';
import { useShopProducts, type Product, type ProductCategory } from '@/lib/useShop';
import { useCoinsWallet } from '@/lib/useGifts';
import { useTheme } from '@/lib/useTheme';

// ─── Konstanten ──────────────────────────────────────────────────────────────

const CATEGORIES: { key: ProductCategory | 'all'; emoji: string; label: string }[] = [
  { key: 'all',      emoji: '🛍',  label: 'Alle'     },
  { key: 'digital',  emoji: '💾',  label: 'Digital'  },
  { key: 'physical', emoji: '📦',  label: 'Physisch' },
  { key: 'service',  emoji: '✨',  label: 'Service'  },
];

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'popular',    label: 'Beliebt'       },
  { key: 'newest',     label: 'Neueste'       },
  { key: 'price_asc',  label: 'Preis ↑'       },
  { key: 'price_desc', label: 'Preis ↓'       },
];

// Produkt gilt 48h lang als „neu"
const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;

// ─── Helfer: Effektiver Preis (sale hat Vorrang) ─────────────────────────────

function effectivePrice(p: Product): number {
  return p.sale_price_coins != null && p.sale_price_coins < p.price_coins
    ? p.sale_price_coins
    : p.price_coins;
}

// ─── Inline Sterne-Anzeige ────────────────────────────────────────────────────

function MiniStars({ rating, count, colors }: { rating?: number | null; count?: number; colors: any }) {
  if (!rating || !count) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
      <Star size={10} color={colors.text.primary} fill={colors.text.primary} strokeWidth={0} />
      <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.primary }}>
        {rating.toFixed(1)}
      </Text>
      <Text style={{ fontSize: 10, color: colors.text.muted }}>({count})</Text>
    </View>
  );
}

// ─── Produktkarte ─────────────────────────────────────────────────────────────

function ProductCard({ product, onPress, colors }: {
  product: Product;
  onPress: () => void;
  colors: any;
}) {
  const isLowStock = product.stock !== -1 && product.stock > 0 && product.stock <= 5;
  const isSoldOut  = product.stock === 0;

  // Bilder-Count: cover_url + image_urls zusammen (1 + n)
  const imageCount = (product.cover_url ? 1 : 0) + (product.image_urls?.length ?? 0);

  // Sale-State: aktueller Preis = sale_price wenn gesetzt; price_coins wird Vorpreis
  const hasSale       = product.sale_price_coins != null && product.sale_price_coins < product.price_coins;
  const currentPrice  = hasSale ? product.sale_price_coins! : product.price_coins;
  const salePercent   = hasSale
    ? Math.round((1 - product.sale_price_coins! / product.price_coins) * 100)
    : 0;

  const showFreeShipping = product.free_shipping && product.category === 'physical';

  // „NEU"-Badge: Produkt ist < 48h alt (nur wenn kein Sale, damit nichts überlappt)
  const isNew = !hasSale
    && Date.now() - new Date(product.created_at).getTime() < NEW_THRESHOLD_MS;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        card.wrap,
        { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle },
        pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
      ]}
      accessibilityRole="button"
      accessibilityLabel={product.title}
    >
      {/* ── Bild (3:4 Hochformat, TikTok-Style Blur-Fill) ──
          Karten behalten konsistente 3:4-Höhe, aber das Bild wird nie
          beschnitten: geblurrte Kopie füllt den Rahmen, Original oben
          drauf mit `contain`. Funktioniert für Landscape, Portrait,
          Square — immer volles Produkt sichtbar. */}
      <View style={card.imgWrap}>
        {product.cover_url ? (
          <>
            <Image
              source={{ uri: product.cover_url }}
              style={card.imgBg}
              contentFit="cover"
              blurRadius={25}
              transition={150}
            />
            <View style={card.imgDim} />
            <Image
              source={{ uri: product.cover_url }}
              style={card.imgFg}
              contentFit="contain"
              transition={250}
            />
          </>
        ) : (
          <View style={[card.imgFill, card.imgFallback, { backgroundColor: colors.bg.primary }]}>
            <ShoppingBag size={36} color={colors.text.muted} strokeWidth={1.2} />
          </View>
        )}

        {/* Sale-Badge oben links (höchste Priorität) */}
        {hasSale && (
          <View style={card.saleBadge}>
            <Text style={card.saleBadgeText}>-{salePercent}%</Text>
          </View>
        )}

        {/* „NEU"-Badge oben links (wenn kein Sale) */}
        {isNew && (
          <View style={card.newBadge}>
            <Sparkles size={10} color="#fff" strokeWidth={2.5} fill="#fff" />
            <Text style={card.newBadgeText}>NEU</Text>
          </View>
        )}

        {/* Bilder-Counter oben rechts — nur wenn > 1 Bild */}
        {imageCount > 1 && (
          <View style={card.imgCount}>
            <Camera size={10} color="#fff" strokeWidth={2.4} />
            <Text style={card.imgCountText}>{imageCount}</Text>
          </View>
        )}

        {/* Women-Only Badge unten rechts (nicht mit Bilder-Counter kollidieren) */}
        {product.women_only && (
          <View style={card.wozBadge}>
            <Text style={{ fontSize: 11 }}>🌸</Text>
          </View>
        )}

        {/* Ausverkauft-Badge */}
        {isSoldOut && (
          <View style={card.soldOut}>
            <Text style={card.soldOutText}>Ausverkauft</Text>
          </View>
        )}

        {/* Wenig Lager-Badge */}
        {isLowStock && !isSoldOut && (
          <View style={card.lowStock}>
            <Text style={card.lowStockText}>⚡ Nur {product.stock} übrig</Text>
          </View>
        )}
      </View>

      {/* ── Info ── */}
      <View style={card.info}>
        {/* Seller-Zeile */}
        <View style={card.sellerRow}>
          {product.seller_avatar ? (
            <Image
              source={{ uri: product.seller_avatar }}
              style={card.sellerAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[card.sellerAvatar, { backgroundColor: colors.bg.primary }]} />
          )}
          <Text style={[card.sellerName, { color: colors.text.muted }]} numberOfLines={1}>
            @{product.seller_username}
            {product.seller_verified ? ' ✓' : ''}
          </Text>
        </View>

        {/* Titel */}
        <Text style={[card.title, { color: colors.text.primary }]} numberOfLines={2}>
          {product.title}
        </Text>

        {/* Rating */}
        <MiniStars
          rating={product.avg_rating}
          count={product.review_count}
          colors={colors}
        />

        {/* Location — nur wenn gesetzt */}
        {product.location ? (
          <View style={card.locationRow}>
            <MapPin size={10} color={colors.text.muted} strokeWidth={2} />
            <Text style={[card.locationText, { color: colors.text.muted }]} numberOfLines={1}>
              {product.location}
            </Text>
          </View>
        ) : null}

        {/* Gratis-Versand-Pill */}
        {showFreeShipping && (
          <View style={card.shippingPill}>
            <Truck size={10} color="#22C55E" strokeWidth={2.2} />
            <Text style={card.shippingText}>Gratis Versand</Text>
          </View>
        )}

        {/* Preis-Zeile: aktueller Preis (+ durchgestrichener Vorpreis bei Sale) + Sold-Pill */}
        <View style={card.footer}>
          <View style={card.priceCol}>
            <Text style={[card.price, { color: hasSale ? '#EF4444' : colors.text.primary }]}>
              🪙 {currentPrice.toLocaleString('de-DE')}
            </Text>
            {hasSale && (
              <Text style={[card.priceOld, { color: colors.text.muted }]}>
                {product.price_coins.toLocaleString('de-DE')}
              </Text>
            )}
          </View>
          {product.sold_count > 0 && (
            <View style={[card.soldPill, { backgroundColor: colors.bg.primary }]}>
              <Text style={[card.sold, { color: colors.text.muted }]}>
                {product.sold_count >= 1000
                  ? `${(product.sold_count / 1000).toFixed(1)}K`
                  : product.sold_count}× verkauft
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  wrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  // 3:4-Rahmen auf dem Container — Blur-Background + Foreground-Image
  // teilen sich dieselbe Bounding-Box. overflow:hidden schneidet den
  // Blur an der Karten-Kante sauber ab.
  imgWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  imgBg: { ...StyleSheet.absoluteFillObject },
  // Leichte Abdunklung über dem Blur — macht den Foreground-Rand klarer
  // und verhindert dass knallige Landscape-Fotos den Rahmen optisch
  // überstrahlen. 18% reicht, nicht zu dunkel.
  imgDim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  imgFg: { ...StyleSheet.absoluteFillObject },
  // Fallback wenn kein Bild gesetzt: füllt komplett
  imgFill: { ...StyleSheet.absoluteFillObject },
  imgFallback: { alignItems: 'center', justifyContent: 'center' },

  soldOut: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.68)',
    paddingVertical: 6, alignItems: 'center',
  },
  soldOutText: { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },

  lowStock: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(245,158,11,0.92)',
    paddingVertical: 5, alignItems: 'center',
  },
  lowStockText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  saleBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6,
  },
  saleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },

  newBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#6366F1',
    paddingHorizontal: 7, paddingVertical: 3,
    borderRadius: 6,
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  imgCount: {
    position: 'absolute', top: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 10,
  },
  imgCountText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  wozBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
  },

  info: { padding: 10, gap: 5 },
  sellerRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sellerAvatar: { width: 16, height: 16, borderRadius: 8 },
  sellerName: { fontSize: 10, flex: 1 },
  title: { fontSize: 13, fontWeight: '700', lineHeight: 18 },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 10, flex: 1 },

  shippingPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(34,197,94,0.12)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6,
  },
  shippingText: { color: '#22C55E', fontSize: 10, fontWeight: '600' },

  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2, gap: 4 },
  priceCol: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' },
  price: { fontSize: 14, fontWeight: '700' },
  priceOld: {
    fontSize: 11,
    fontWeight: '600',
    textDecorationLine: 'line-through',
  },
  soldPill: { borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  sold: { fontSize: 9, fontWeight: '600' },
});

// ─── Skeleton Card (Loading State) ────────────────────────────────────────────

function SkeletonCard({ colors }: { colors: any }) {
  return (
    <View style={[card.wrap, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
      <View style={[card.imgWrap, { backgroundColor: colors.bg.primary }]} />
      <View style={card.info}>
        <View style={[sk.line, { width: '50%', backgroundColor: colors.bg.primary }]} />
        <View style={[sk.line, { width: '90%', backgroundColor: colors.bg.primary, height: 14 }]} />
        <View style={[sk.line, { width: '70%', backgroundColor: colors.bg.primary, height: 14 }]} />
        <View style={[sk.line, { width: '40%', backgroundColor: colors.bg.primary, marginTop: 4 }]} />
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  line: { height: 10, borderRadius: 5, opacity: 0.7 },
});

// ─── Hauptscreen ─────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { coins } = useCoinsWallet();

  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  // Filter & Sort (Client-seitig)
  const [onSaleOnly,      setOnSaleOnly]      = useState(false);
  const [freeShipOnly,    setFreeShipOnly]    = useState(false);
  const [sortBy,          setSortBy]          = useState<SortKey>('popular');
  const [sortSheetOpen,   setSortSheetOpen]   = useState(false);

  const { data: products = [], isLoading, refetch, isRefetching } = useShopProducts({
    category: category === 'all' ? undefined : category,
  });

  // ── Filter + Sort pipeline ──
  const filtered = useMemo(() => {
    let list = products;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.title.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.seller_username ?? '').toLowerCase().includes(q)
      );
    }

    // „Nur Angebote"-Filter
    if (onSaleOnly) {
      list = list.filter(p => p.sale_price_coins != null && p.sale_price_coins < p.price_coins);
    }

    // „Gratis Versand"-Filter (nur physische Produkte sinnvoll)
    if (freeShipOnly) {
      list = list.filter(p => p.free_shipping && p.category === 'physical');
    }

    // Sort
    if (sortBy !== 'popular') {
      list = [...list]; // don't mutate query cache
      switch (sortBy) {
        case 'newest':
          list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          break;
        case 'price_asc':
          list.sort((a, b) => effectivePrice(a) - effectivePrice(b));
          break;
        case 'price_desc':
          list.sort((a, b) => effectivePrice(b) - effectivePrice(a));
          break;
      }
    }

    return list;
  }, [products, search, onSaleOnly, freeShipOnly, sortBy]);

  // Spacer bei ungerader Anzahl — verhindert volle Breite für einzelne Karte
  const gridData = useMemo<(Product | { id: '__spacer__' })[]>(() => {
    if (filtered.length % 2 === 1) {
      return [...filtered, { id: '__spacer__' as const }];
    }
    return filtered;
  }, [filtered]);

  const handlePress = useCallback((p: Product) => {
    router.push({ pathname: '/shop/[id]', params: { id: p.id } } as any);
  }, [router]);

  const activeFilterCount = (onSaleOnly ? 1 : 0) + (freeShipOnly ? 1 : 0);
  const currentSortLabel  = SORT_OPTIONS.find(o => o.key === sortBy)?.label ?? 'Sort';

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>

      {/* ── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 10, borderBottomColor: colors.border.subtle }]}>
        {showSearch ? (
          <>
            <View style={[s.searchBox, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
              <Search size={15} color={colors.text.muted} strokeWidth={2} />
              <TextInput
                style={[s.searchInput, { color: colors.text.primary }]}
                placeholder="Produkte, Creator suchen…"
                placeholderTextColor={colors.text.muted}
                value={search}
                onChangeText={setSearch}
                autoFocus
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {search.length > 0 && (
                <Pressable onPress={() => setSearch('')} hitSlop={8}>
                  <X size={14} color={colors.text.muted} strokeWidth={2.5} />
                </Pressable>
              )}
            </View>
            <Pressable
              onPress={() => { setShowSearch(false); setSearch(''); }}
              hitSlop={12}
              style={s.cancelBtn}
            >
              <Text style={[s.cancelText, { color: colors.text.primary }]}>Abbrechen</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={s.headerLeft}>
              <Text style={[s.headerTitle, { color: colors.text.primary }]}>Shop</Text>
            </View>
            <View style={s.headerRight}>
              {/* Coin-Balance */}
              <View style={[s.coinPill, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
                <Text style={{ fontSize: 14 }}>🪙</Text>
                <Text style={[s.coinText, { color: colors.text.primary }]}>
                  {coins.toLocaleString('de-DE')}
                </Text>
              </View>
              {/* Suche */}
              <Pressable
                onPress={() => setShowSearch(true)}
                style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                hitSlop={8}
                accessibilityLabel="Suchen"
              >
                <Search size={17} color={colors.text.primary} strokeWidth={2} />
              </Pressable>
              {/* Bestellungen */}
              <Pressable
                onPress={() => router.push('/shop/orders' as any)}
                style={[s.iconBtn, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                hitSlop={8}
                accessibilityLabel="Meine Bestellungen"
              >
                <Package size={17} color={colors.text.primary} strokeWidth={1.8} />
              </Pressable>
            </View>
          </>
        )}
      </View>

      {/* ── Kategorie-Chips ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipScroll}
        contentContainerStyle={s.catRow}
      >
        {CATEGORIES.map((c) => {
          const isActive = category === c.key;
          return (
            <Pressable
              key={c.key}
              onPress={() => setCategory(c.key as any)}
              style={[
                s.catChip,
                { borderColor: isActive ? colors.text.primary : colors.border.subtle },
                isActive && { backgroundColor: colors.text.primary },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: isActive }}
            >
              <Text style={s.catEmoji}>{c.emoji}</Text>
              <Text style={[s.catLabel, { color: isActive ? colors.bg.primary : colors.text.primary }]}>
                {c.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Filter + Sort Row ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipScroll}
        contentContainerStyle={s.filterRow}
      >
        {/* Sort-Pill (öffnet Sheet) */}
        <Pressable
          onPress={() => setSortSheetOpen(true)}
          style={[
            s.filterChip,
            { borderColor: colors.border.subtle, backgroundColor: colors.bg.elevated },
          ]}
          accessibilityLabel="Sortierung ändern"
        >
          <ArrowDownUp size={12} color={colors.text.primary} strokeWidth={2.2} />
          <Text style={[s.filterLabel, { color: colors.text.primary }]}>{currentSortLabel}</Text>
        </Pressable>

        {/* Nur Angebote */}
        <Pressable
          onPress={() => setOnSaleOnly(v => !v)}
          style={[
            s.filterChip,
            { borderColor: onSaleOnly ? '#EF4444' : colors.border.subtle,
              backgroundColor: onSaleOnly ? 'rgba(239,68,68,0.12)' : colors.bg.elevated },
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: onSaleOnly }}
        >
          <Flame size={12} color={onSaleOnly ? '#EF4444' : colors.text.primary} strokeWidth={2.2} fill={onSaleOnly ? '#EF4444' : 'transparent'} />
          <Text style={[s.filterLabel, { color: onSaleOnly ? '#EF4444' : colors.text.primary }]}>
            Nur Angebote
          </Text>
        </Pressable>

        {/* Gratis Versand */}
        <Pressable
          onPress={() => setFreeShipOnly(v => !v)}
          style={[
            s.filterChip,
            { borderColor: freeShipOnly ? '#22C55E' : colors.border.subtle,
              backgroundColor: freeShipOnly ? 'rgba(34,197,94,0.12)' : colors.bg.elevated },
          ]}
          accessibilityRole="switch"
          accessibilityState={{ checked: freeShipOnly }}
        >
          <Truck size={12} color={freeShipOnly ? '#22C55E' : colors.text.primary} strokeWidth={2.2} />
          <Text style={[s.filterLabel, { color: freeShipOnly ? '#22C55E' : colors.text.primary }]}>
            Gratis Versand
          </Text>
        </Pressable>

        {/* Clear-Filter wenn mind. einer aktiv */}
        {activeFilterCount > 0 && (
          <Pressable
            onPress={() => { setOnSaleOnly(false); setFreeShipOnly(false); }}
            style={[s.filterChip, s.filterClear, { borderColor: colors.border.subtle }]}
            accessibilityLabel="Filter zurücksetzen"
          >
            <X size={12} color={colors.text.muted} strokeWidth={2.4} />
            <Text style={[s.filterLabel, { color: colors.text.muted }]}>Filter aus</Text>
          </Pressable>
        )}
      </ScrollView>

      {/* ── Ergebnis-Zeile ── */}
      {!isLoading && filtered.length > 0 && (
        <View style={s.resultRow}>
          <Text style={[s.resultText, { color: colors.text.muted }]}>
            {filtered.length} Produkt{filtered.length !== 1 ? 'e' : ''}
            {search.trim() ? ` für „${search}"` : ''}
          </Text>
        </View>
      )}

      {/* ── Produkt-Grid ── */}
      {isLoading ? (
        // Skeleton-Grid: 6 Karten (3 Zeilen à 2) statt Spinning-Wheel
        <FlatList
          data={[0, 1, 2, 3, 4, 5]}
          keyExtractor={i => String(i)}
          numColumns={2}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={[s.gridContent, { paddingBottom: insets.bottom + 48 }]}
          renderItem={() => (
            <View style={s.gridCell}>
              <SkeletonCard colors={colors} />
            </View>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
          scrollEnabled={false}
        />
      ) : filtered.length === 0 ? (
        <View style={s.center}>
          <Text style={{ fontSize: 44 }}>🛒</Text>
          <Text style={[s.emptyText, { color: colors.text.muted }]}>
            {search.trim()
              ? `Nichts gefunden für „${search}"`
              : activeFilterCount > 0
                ? 'Keine Produkte mit diesen Filtern'
                : 'Noch keine Produkte'}
          </Text>
          {activeFilterCount > 0 && (
            <Pressable
              onPress={() => { setOnSaleOnly(false); setFreeShipOnly(false); }}
              style={[s.emptyAction, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
            >
              <Text style={[s.emptyActionText, { color: colors.text.primary }]}>Filter zurücksetzen</Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          data={gridData}
          keyExtractor={p => p.id}
          numColumns={2}
          columnWrapperStyle={s.gridRow}
          contentContainerStyle={[s.gridContent, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.text.primary}
            />
          }
          renderItem={({ item }) => {
            if ((item as { id: string }).id === '__spacer__') {
              return <View style={s.gridCell} pointerEvents="none" />;
            }
            const product = item as Product;
            return (
              <View style={s.gridCell}>
                <ProductCard
                  product={product}
                  onPress={() => handlePress(product)}
                  colors={colors}
                />
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 6 }} />}
        />
      )}

      {/* ── Sort-Sheet ── */}
      <Modal
        transparent
        visible={sortSheetOpen}
        animationType="fade"
        onRequestClose={() => setSortSheetOpen(false)}
      >
        <Pressable style={s.sheetBackdrop} onPress={() => setSortSheetOpen(false)}>
          <Pressable
            style={[s.sheet, { backgroundColor: colors.bg.elevated, paddingBottom: insets.bottom + 16 }]}
            onPress={e => e.stopPropagation()}
          >
            <View style={s.sheetHandle} />
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>Sortieren nach</Text>
            {SORT_OPTIONS.map((opt) => {
              const isActive = sortBy === opt.key;
              return (
                <Pressable
                  key={opt.key}
                  onPress={() => { setSortBy(opt.key); setSortSheetOpen(false); }}
                  style={({ pressed }) => [
                    s.sheetRow,
                    { borderBottomColor: colors.border.subtle },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[s.sheetRowText, { color: colors.text.primary, fontWeight: isActive ? '700' : '500' }]}>
                    {opt.label}
                  </Text>
                  {isActive && <Check size={18} color={colors.text.primary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: { flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8 },

  searchBox: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },
  cancelBtn: { paddingLeft: 4 },
  cancelText: { fontSize: 14, fontWeight: '600' },

  coinPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
  },
  coinText: { fontWeight: '600', fontSize: 13 },

  iconBtn: {
    width: 36, height: 36, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },

  // Wichtig: ScrollView in vertikalem Flex-Container hat per Default
  // flex:1 und würde sonst den freien Platz einnehmen (Riesen-Gap zwischen
  // Chip-Reihen). flexGrow:0/flexShrink:0 sorgen für intrinsische Höhe.
  chipScroll: { flexGrow: 0, flexShrink: 0 },

  // Kategorie-Chips — feste Höhe + explizite lineHeight für Emoji & Label
  // verhindern Baseline-Misalignment und Descender-Clipping (g, p, y).
  catRow: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: 'center' },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14,
    height: 38,              // feste Höhe → immer ausreichend für Text + Emoji
    borderRadius: 20, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  catEmoji: { fontSize: 14, lineHeight: 20 },
  catLabel: { fontSize: 13, fontWeight: '700', lineHeight: 18, includeFontPadding: false },

  // Filter + Sort Row — darunter, etwas kompakter aber nicht zu flach
  filterRow: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8, gap: 6, alignItems: 'center' },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 11,
    height: 32,              // feste Höhe → kein Clipping
    borderRadius: 16, borderWidth: 1,
    alignSelf: 'flex-start',
  },
  filterClear: {
    backgroundColor: 'transparent',
  },
  filterLabel: { fontSize: 12, fontWeight: '700', lineHeight: 16, includeFontPadding: false },

  resultRow: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 2 },
  resultText: { fontSize: 12, fontWeight: '500' },

  gridContent: { paddingHorizontal: 6, paddingTop: 6 },
  gridRow: { gap: 6 },
  gridCell: { flex: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 15, textAlign: 'center', maxWidth: 240 },
  emptyAction: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1,
    marginTop: 4,
  },
  emptyActionText: { fontSize: 13, fontWeight: '700' },

  // Sort-Sheet
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingTop: 10,
  },
  sheetHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(128,128,128,0.4)',
    alignSelf: 'center', marginBottom: 14,
  },
  sheetTitle: { fontSize: 17, fontWeight: '600', marginBottom: 6 },
  sheetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowText: { fontSize: 15 },
});
