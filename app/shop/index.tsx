import { COIN_SHOP_ENABLED } from '@/lib/featureFlags';
/**
 * app/shop/index.tsx — Shop (TikTok-inspiriertes Layout)
 *
 * Aufbau von oben nach unten:
 *  1. Kopf: „Shop" + Coin-Balance
 *  2. Volle Suchleiste (immer sichtbar)
 *  3. Menü-Shortcuts (Icon + Label): Bestellungen · Favoriten · Coins · Mein Shop
 *  4. Werbe-Banner-Karussell (auto-swipe + Finger, DB-gestützt → vermietbar)
 *  5. Dünne Text-Kategorien ohne Icons (Unterstrich-Aktiv) + Sortier-Icon
 *  6. Produkt-Grid (2 Spalten)
 *
 * Banner kommen aus `shop_banners` (Migration 20260626120000). Leere Liste /
 * fehlende Tabelle → Karussell rendert einfach nicht (graceful).
 */

import { GuildRoundCard } from '@/components/guild';
import { CoinIcon } from '@/components/ui/CoinIcon';
import { useAuthStore } from '@/lib/authStore';
import { supabase } from '@/lib/supabase';
import { useCoinsWallet } from '@/lib/useGifts';
import { formatEur, useActivePreorderRound, useSavedProducts, useShopBanners, useShopProducts, type Product, type ProductCategory, type ShopBanner } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useThemedStatusBar } from '@/lib/useThemedStatusBar';
import { useI18n, type TranslationKey } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { impactAsync, ImpactFeedbackStyle } from 'expo-haptics';
import { useRouter } from 'expo-router';
import {
ArrowDownUp,
Camera,
Check,
Coins,
Flame,
Heart,
MapPin,
Package,
Plus,
Search,
ShoppingBag,
Sparkles,
Star,
Store,
Truck,
X,
} from 'lucide-react-native';
import { useCallback,useEffect,useMemo,useRef,useState } from 'react';
import {
FlatList,
Modal,
NativeScrollEvent,
NativeSyntheticEvent,
Pressable,
RefreshControl,ScrollView,
StyleSheet,
Text,
TextInput,
useWindowDimensions,
View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Konstanten ──────────────────────────────────────────────────────────────

// Dünne Text-Kategorien. Mappt direkt auf vorhandene Daten — keine Migration:
//  all → kein Filter · sale → Angebote · women → Frauen-Only ·
//  physical/digital/service/collectible → echte Produkt-Kategorien (server-seitig)
type TabKey = 'all' | 'sale' | 'physical' | 'digital' | 'service' | 'collectible' | 'women';

const TABS: { key: TabKey; labelKey: TranslationKey }[] = [
  { key: 'all',         labelKey: 'shop.tabAll'         },
  { key: 'sale',        labelKey: 'shop.tabSale'        },
  { key: 'physical',    labelKey: 'shop.tabPhysical'    },
  { key: 'digital',     labelKey: 'shop.tabDigital'     },
  { key: 'service',     labelKey: 'shop.tabService'     },
  { key: 'collectible', labelKey: 'shop.tabCollectible' },
  { key: 'women',       labelKey: 'shop.tabWomen'       },
];

const REAL_CATEGORIES: ProductCategory[] = ['physical', 'digital', 'service', 'collectible'];

// Menü-Shortcuts (Navigation zu anderen Screens). Verkaufen bleibt der FAB.
// Coins-Shortcut nur mit aktivem Coin-Shop (App-Store-v1: Flag aus).
const SHORTCUTS: { key: string; labelKey: TranslationKey; Icon: typeof Package; route: string }[] = [
  { key: 'orders', labelKey: 'shop.orders', Icon: Package, route: '/shop/my-orders'  },
  { key: 'saved',  labelKey: 'shop.favorites', Icon: Heart,   route: '/shop/saved'   },
  ...(COIN_SHOP_ENABLED ? [{ key: 'coins', labelKey: 'shop.coins' as TranslationKey, Icon: Coins, route: '/coin-shop' }] : []),
  { key: 'myshop', labelKey: 'shop.myShop', Icon: Store,   route: '/shop/my-shop' },
];

type SortKey = 'popular' | 'newest' | 'price_asc' | 'price_desc';

const SORT_OPTIONS: { key: SortKey; labelKey: TranslationKey }[] = [
  { key: 'popular',    labelKey: 'shop.sortPopular'  },
  { key: 'newest',     labelKey: 'shop.sortNewest'   },
  { key: 'price_asc',  labelKey: 'shop.sortPriceAsc' },
  { key: 'price_desc', labelKey: 'shop.sortPriceDesc' },
];

// Produkt gilt 48h lang als „neu"
const NEW_THRESHOLD_MS = 48 * 60 * 60 * 1000;

// Skeleton-Platzhalter (6 Karten) während des initialen Ladens
const SKELETON_DATA = Array.from({ length: 6 }, (_, i) => ({ id: `__sk${i}__` }));

// ─── Helfer: Effektiver Preis (sale hat Vorrang) ─────────────────────────────

function effectivePrice(p: Product): number {
  return p.sale_price_coins != null && p.sale_price_coins < p.price_coins
    ? p.sale_price_coins
    : p.price_coins;
}

// ─── Werbe-Banner-Karussell (auto-swipe + Finger) ─────────────────────────────

function BannerCarousel({ banners, onPress }: {
  banners: ShopBanner[];
  onPress: (b: ShopBanner) => void;
}) {
  const { width: winW } = useWindowDimensions();
  const PAD = 16, GAP = 10;
  const slideW = winW - PAD * 2;
  const step = slideW + GAP;

  const [idx, setIdx] = useState(0);
  const ref = useRef<ScrollView>(null);

  // Auto-Advance alle 3.5s — pausiert implizit nicht, ist aber bewusst dezent.
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % banners.length;
        ref.current?.scrollTo({ x: next * step, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(t);
  }, [banners.length, step]);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(Math.round(e.nativeEvent.contentOffset.x / step));
  };

  if (banners.length === 0) return null;

  return (
    <View style={bn.wrap}>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        disableIntervalMomentum
        onMomentumScrollEnd={onMomentumEnd}
        contentContainerStyle={{ paddingHorizontal: PAD }}
      >
        {banners.map((b) => (
          <Pressable
            key={b.id}
            onPress={() => onPress(b)}
            style={[bn.slide, { width: slideW, marginRight: GAP, backgroundColor: b.bg_color }]}
            accessibilityRole="button"
            accessibilityLabel={b.title}
          >
            {b.image_url ? (
              <>
                <Image
                  source={{ uri: b.image_url }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.42)' }]} />
              </>
            ) : null}
            <View style={bn.slideInner}>
              {b.tag ? <Text style={bn.tag} numberOfLines={1}>{b.tag}</Text> : null}
              <Text style={bn.title} numberOfLines={1}>{b.title}</Text>
              {b.subtitle ? <Text style={bn.subtitle} numberOfLines={1}>{b.subtitle}</Text> : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {banners.length > 1 && (
        <View style={bn.dots}>
          {banners.map((_, i) => (
            <View key={i} style={[bn.dot, i === idx && bn.dotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

const bn = StyleSheet.create({
  wrap: { paddingTop: 4 },
  slide: {
    height: 116,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  slideInner: { paddingHorizontal: 18 },
  tag: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '700', letterSpacing: 0.4, marginBottom: 3 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { color: 'rgba(255,255,255,0.78)', fontSize: 12.5, fontWeight: '500', marginTop: 3 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: 9 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.4)' },
  dotActive: { width: 16, backgroundColor: 'rgba(160,160,160,0.95)' },
});

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

function ProductCard({ product, onPress, colors, saved, onToggleSave }: {
  product: Product;
  onPress: () => void;
  colors: any;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const { t } = useI18n();
  const isLowStock = product.stock !== -1 && product.stock > 0 && product.stock <= 5;
  const isSoldOut  = product.stock === 0;

  // Bilder-Count: cover_url + image_urls zusammen (1 + n)
  const imageCount = (product.cover_url ? 1 : 0) + (product.image_urls?.length ?? 0);

  const isPreorder    = product.sale_mode === 'preorder';
  // Sale-State: aktueller Preis = sale_price wenn gesetzt; price_coins wird Vorpreis
  const hasSale       = product.sale_price_coins != null && product.sale_price_coins < product.price_coins;
  const currentPrice  = hasSale ? product.sale_price_coins! : product.price_coins;
  const salePercent   = hasSale
    ? Math.round((1 - product.sale_price_coins! / product.price_coins) * 100)
    : 0;

  const showFreeShipping = product.free_shipping && product.category === 'physical';
  const primaryImageUrl = product.cover_url ?? product.image_urls?.[0] ?? null;
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [primaryImageUrl]);

  // „NEU"-Badge: Produkt ist < 48h alt (nur wenn kein Sale, damit nichts überlappt)
  const isNew = !hasSale
    && Date.now() - new Date(product.created_at).getTime() < NEW_THRESHOLD_MS;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        card.wrap,
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={product.title}
    >
      {/* ── Bild (3:4 Hochformat) ──
          Ein einzelner Decode pro Karte hält den Shop beim Öffnen spürbar leichter. */}
      <View style={card.imgWrap}>
        {primaryImageUrl && !imageFailed ? (
          <Image
            source={{ uri: primaryImageUrl }}
            style={card.imgFg}
            contentFit="cover"
            transition={120}
            cachePolicy="memory-disk"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={[card.imgFill, card.imgFallback, { backgroundColor: colors.bg.primary }]}>
            <ShoppingBag size={36} color={colors.text.muted} strokeWidth={1.2} />
          </View>
        )}

        {/* Vorbestellung-Badge oben links (höchste Priorität) */}
        {isPreorder && (
          <View style={[card.saleBadge, { backgroundColor: 'rgba(217,119,6,0.92)' }]}>
            <Text style={card.saleBadgeText}>{t('shop.preorderBadge')}</Text>
          </View>
        )}

        {/* Sale-Badge oben links */}
        {hasSale && !isPreorder && (
          <View style={card.saleBadge}>
            <Text style={card.saleBadgeText}>-{salePercent}%</Text>
          </View>
        )}

        {/* „NEU"-Badge oben links (wenn kein Sale) */}
        {isNew && !isPreorder && (
          <View style={card.newBadge}>
            <Sparkles size={10} color="#fff" strokeWidth={2.5} fill="#fff" />
            <Text style={card.newBadgeText}>NEU</Text>
          </View>
        )}

        {/* Merken-Herz oben rechts — Toggle direkt aus dem Grid */}
        <Pressable
          onPress={(e) => { e.stopPropagation?.(); onToggleSave(); }}
          hitSlop={8}
          style={card.saveBtn}
          accessibilityRole="button"
          accessibilityLabel={saved ? t('shop.removeFav') : t('shop.save')}
          accessibilityState={{ selected: saved }}
        >
          <Heart
            size={17}
            color={saved ? '#EF4444' : '#fff'}
            fill={saved ? '#EF4444' : 'transparent'}
            strokeWidth={2.2}
          />
        </Pressable>

        {/* Bilder-Counter unten links — nur wenn > 1 Bild und kein Lager-/Ausverkauft-Hinweis */}
        {imageCount > 1 && !isLowStock && !isSoldOut && (
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
            <Text style={card.soldOutText}>{t('shop.soldOut')}</Text>
          </View>
        )}

        {/* Wenig Lager — dezenter Glas-Chip (statt neon-Streifen) */}
        {isLowStock && !isSoldOut && (
          <View style={card.lowStock}>
            <Flame size={11} color="#FBBF24" strokeWidth={2.4} />
            <Text style={card.lowStockText}>Nur {product.stock} übrig</Text>
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
              cachePolicy="memory-disk"
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
            <Text style={card.shippingText}>{t('shop.freeShipping')}</Text>
          </View>
        )}

        {/* Preis-Zeile: aktueller Preis (+ durchgestrichener Vorpreis bei Sale) + Sold-Pill.
            Bei Vorbestellung: kein Coin-Preis (zahlbar bei Lieferung). */}
        <View style={card.footer}>
          {isPreorder ? (
            <Text style={[card.price, { color: '#B45309' }]} numberOfLines={1}>
              {formatEur(product.price_eur) ?? t('shop.preorder')}
            </Text>
          ) : (
            <>
              <View style={card.priceCol}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                  <CoinIcon size={13} />
                  <Text style={[card.price, { color: hasSale ? '#EF4444' : colors.text.primary }]}>
                    {currentPrice.toLocaleString('de-DE')}
                  </Text>
                </View>
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
            </>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const card = StyleSheet.create({
  // Keine Karten-Box mehr: Produkte liegen durchgehend auf dem Seiten-BG
  // (Short-Video-Shop-Stil). Nur das Bild ist abgerundet, Text flush darunter.
  wrap: {
    width: '100%',
  },
  // 3:4-Rahmen auf dem Container; das Produktbild wird vollständig sichtbar
  // und nur einmal dekodiert. Abgerundet — ersetzt die alte Karten-Rundung.
  imgWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#0B0B0E',
  },
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
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 9, paddingVertical: 5,
    borderRadius: 999,
  },
  lowStockText: { color: '#fff', fontSize: 10.5, fontWeight: '700', letterSpacing: 0.2 },

  saleBadge: {
    position: 'absolute', top: 8, left: 8,
    backgroundColor: '#EF4444',
    paddingHorizontal: 9, paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  saleBadgeText: { color: '#fff', fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },

  newBadge: {
    position: 'absolute', top: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#6366F1',
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  newBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700', letterSpacing: 0.4 },

  imgCount: {
    position: 'absolute', bottom: 8, left: 8,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6, paddingVertical: 3,
    borderRadius: 10,
  },
  imgCountText: { color: '#fff', fontSize: 10, fontWeight: '600' },

  // Merken-Herz oben rechts (Glas-Chip, damit weißes Herz auf hell/dunkel sitzt)
  saveBtn: {
    position: 'absolute', top: 6, right: 6,
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.42)',
  },

  wozBadge: {
    position: 'absolute', bottom: 8, right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3,
  },

  info: { paddingTop: 8, paddingHorizontal: 2, gap: 5 },
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
    <View style={card.wrap}>
      <View style={[card.imgWrap, { backgroundColor: colors.bg.elevated }]} />
      <View style={card.info}>
        <View style={[sk.line, { width: '50%', backgroundColor: colors.bg.elevated }]} />
        <View style={[sk.line, { width: '90%', backgroundColor: colors.bg.elevated, height: 14 }]} />
        <View style={[sk.line, { width: '70%', backgroundColor: colors.bg.elevated, height: 14 }]} />
        <View style={[sk.line, { width: '40%', backgroundColor: colors.bg.elevated, marginTop: 4 }]} />
      </View>
    </View>
  );
}

const sk = StyleSheet.create({
  line: { height: 10, borderRadius: 5, opacity: 0.7 },
});

// ─── Hauptscreen ─────────────────────────────────────────────────────────────

export default function ShopScreen() {
  const { t } = useI18n();
  useThemedStatusBar('auto');
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();
  const { coins } = useCoinsWallet();

  const listRef = useRef<FlatList>(null);

  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [search, setSearch]       = useState('');

  // Zusatz-Filter + Sortierung (über das Sheet erreichbar)
  const [freeShipOnly,  setFreeShipOnly]  = useState(false);
  const [sortBy,        setSortBy]        = useState<SortKey>('popular');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);

  // Server-Kategorie nur für echte Produkt-Kategorien; all/sale/women → client-seitig
  const serverCategory = REAL_CATEGORIES.includes(activeTab as ProductCategory)
    ? (activeTab as ProductCategory)
    : undefined;

  // Limit 200 statt Default 30: Der App-Browse filtert/sortiert client-seitig,
  // also muss genug Material geladen sein — sonst sind Produkte jenseits der
  // ersten 30 unsichtbar (Suche/Sort greifen nur auf Geladenes). Pflaster bis zur
  // echten Server-Query + Infinite-Scroll (Parität mit Web). 200 reicht für die
  // Parfüm-Launch-Menge locker.
  const { data: products = [], isLoading, refetch } = useShopProducts({
    category: serverCategory,
    limit: 200,
  });
  const { data: banners = [] } = useShopBanners();
  const { data: activeRound } = useActivePreorderRound();

  // ── Merken/Favoriten: eine Liste laden (statt 1 Query pro Karte) → Set ──
  const { data: savedProducts = [] } = useSavedProducts();
  const qc = useQueryClient();
  const user = useAuthStore((st) => st.user);
  const savedIds = useMemo(() => new Set(savedProducts.map((p) => p.id)), [savedProducts]);
  // Optimistische Overrides, damit das Herz sofort reagiert
  const [savedOverride, setSavedOverride] = useState<Record<string, boolean>>({});
  const isSaved = useCallback(
    (id: string) => savedOverride[id] ?? savedIds.has(id),
    [savedOverride, savedIds],
  );
  const toggleSave = useCallback(async (id: string) => {
    if (!user?.id) { router.push('/(auth)/login' as any); return; }
    const next = !(savedOverride[id] ?? savedIds.has(id));
    setSavedOverride((o) => ({ ...o, [id]: next }));
    impactAsync(ImpactFeedbackStyle.Light);
    try {
      const { data, error } = await supabase.rpc('toggle_save_product', { p_product_id: id });
      if (error) throw error;
      const actual = (data as { saved: boolean } | null)?.saved ?? next;
      setSavedOverride((o) => ({ ...o, [id]: actual }));
      qc.invalidateQueries({ queryKey: ['saved-products', user.id] });
    } catch {
      setSavedOverride((o) => ({ ...o, [id]: !next })); // Rollback
    }
  }, [user?.id, savedOverride, savedIds, qc, router]);

  // ── Pull-to-Refresh (sichtbar): Produkte + Merken-Liste neu laden ──
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        qc.invalidateQueries({ queryKey: ['saved-products'] }),
        qc.invalidateQueries({ queryKey: ['active-preorder-round'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [refetch, qc]);

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

    // Tab-abhängige Filter
    if (activeTab === 'sale') {
      list = list.filter(p => p.sale_price_coins != null && p.sale_price_coins < p.price_coins);
    } else if (activeTab === 'women') {
      list = list.filter(p => p.women_only);
    }

    // „Gratis Versand"-Filter (aus dem Sheet)
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
  }, [products, search, activeTab, freeShipOnly, sortBy]);

  // Spacer bei ungerader Anzahl — verhindert volle Breite für einzelne Karte
  const gridData = useMemo<(Product | { id: string })[]>(() => {
    if (filtered.length % 2 === 1) {
      return [...filtered, { id: '__spacer__' }];
    }
    return filtered;
  }, [filtered]);

  const listData = isLoading ? SKELETON_DATA : gridData;

  const handlePress = useCallback((p: Product) => {
    router.push({ pathname: '/shop/[id]', params: { id: p.id } } as any);
  }, [router]);

  const selectTab = useCallback((key: TabKey) => {
    setActiveTab(key);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  // Banner-Tap: 'tab:<key>' wechselt die Kategorie, '/route' navigiert.
  const handleBannerPress = useCallback((b: ShopBanner) => {
    if (!b.link) return;
    if (b.link.startsWith('tab:')) {
      const key = b.link.slice(4) as TabKey;
      if (TABS.some(t => t.key === key)) selectTab(key);
    } else if (b.link.startsWith('/')) {
      router.push(b.link as any);
    }
  }, [router, selectTab]);

  const resetAll = useCallback(() => {
    setActiveTab('all'); setFreeShipOnly(false); setSearch('');
  }, []);

  const currentSortLabel = t(SORT_OPTIONS.find(o => o.key === sortBy)?.labelKey ?? 'shop.sortPopular');
  const sortActive = sortBy !== 'popular' || freeShipOnly;

  // ── Scrollbarer Kopf: Shortcuts → Banner → Tabs → Ergebnis-Zeile ──
  const ListHeader = (
    <View>
      {/* Menü-Shortcuts */}
      <View style={s.shortcutRow}>
        {SHORTCUTS.map(({ key, labelKey, Icon, route }) => (
          <Pressable
            key={key}
            onPress={() => router.push(route as any)}
            style={({ pressed }) => [s.shortcut, pressed && { opacity: 0.55 }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t(labelKey)}
          >
            <Icon size={22} color={colors.text.primary} strokeWidth={1.9} />
            <Text style={[s.shortcutLabel, { color: colors.text.secondary }]} numberOfLines={1}>
              {t(labelKey)}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Aktive Sammelbestellungs-Runde (Parfüm-Flywheel) — nur wenn eine läuft.
          Prominent im Shop, wo Käufer stöbern; navigiert direkt zum Produkt. */}
      {activeRound && <GuildRoundCard round={activeRound} />}

      {/* Werbe-Banner-Karussell (vermietbar) */}
      <BannerCarousel banners={banners} onPress={handleBannerPress} />

      {/* Dünne Text-Kategorien + Sortier-Icon */}
      <View style={[s.tabBar, { borderBottomColor: colors.border.subtle }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={s.tabScroll}
          contentContainerStyle={s.tabRow}
        >
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <Pressable key={tab.key} onPress={() => selectTab(tab.key)} style={s.tab} hitSlop={4}>
                <Text style={[
                  s.tabLabel,
                  { color: active ? colors.text.primary : colors.text.muted, fontWeight: active ? '700' : '500' },
                ]}>
                  {t(tab.labelKey)}
                </Text>
                <View style={[s.tabUnderline, { backgroundColor: active ? colors.text.primary : 'transparent' }]} />
              </Pressable>
            );
          })}
        </ScrollView>

        <Pressable
          onPress={() => setSortSheetOpen(true)}
          style={[
            s.sortBtn,
            { borderColor: sortActive ? colors.text.primary : colors.border.subtle, backgroundColor: colors.bg.elevated },
          ]}
          hitSlop={8}
          accessibilityLabel="Sortieren & Filtern"
        >
          <ArrowDownUp size={15} color={sortActive ? colors.text.primary : colors.text.muted} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* Ergebnis-Zeile */}
      {!isLoading && (
        <View style={s.resultRow}>
          <Text style={[s.resultText, { color: colors.text.muted }]}>
            {filtered.length} Produkt{filtered.length !== 1 ? 'e' : ''}
            {search.trim() ? ` für „${search}"` : ''}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={[s.root, { backgroundColor: colors.bg.primary }]}>

      {/* ── Fixierter Kopf: Titel + Coins ── */}
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <Text style={[s.headerTitle, { color: colors.text.primary }]}>{t('shop.title')}</Text>
        <View style={s.coinRow}>
          <CoinIcon size={26} />
          <Text style={[s.coinText, { color: colors.text.primary }]}>
            {coins.toLocaleString('de-DE')}
          </Text>
        </View>
      </View>

      {/* ── Volle Suchleiste (immer sichtbar) ── */}
      <View style={s.searchWrap}>
        <View style={[s.searchBox, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
          <Search size={16} color={colors.text.muted} strokeWidth={2} />
          <TextInput
            style={[s.searchInput, { color: colors.text.primary }]}
            placeholder={t('shop.searchPlaceholder')}
            placeholderTextColor={colors.text.muted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')} hitSlop={8}>
              <X size={15} color={colors.text.muted} strokeWidth={2.5} />
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Eine Liste: scrollbarer Kopf + Grid (oder Skeleton/Empty) ── */}
      <FlatList
        ref={listRef}
        data={listData}
        keyExtractor={(item) => (item as { id: string }).id}
        numColumns={2}
        columnWrapperStyle={s.gridRow}
        contentContainerStyle={[s.gridContent, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          isLoading ? null : (
            <View style={s.center}>
              <Text style={{ fontSize: 44 }}>🛒</Text>
              <Text style={[s.emptyText, { color: colors.text.muted }]}>
                {search.trim()
                  ? `Zu „${search}" ist nichts dabei — anders suchen?`
                  : (activeTab !== 'all' || freeShipOnly)
                    ? t('shop.emptyFilter')
                    : t('shop.emptyShop')}
              </Text>
              {(activeTab !== 'all' || freeShipOnly || search.trim().length > 0) && (
                <Pressable
                  onPress={resetAll}
                  style={[s.emptyAction, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}
                >
                  <Text style={[s.emptyActionText, { color: colors.text.primary }]}>{t('shop.reset')}</Text>
                </Pressable>
              )}
            </View>
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.text.muted}
            colors={[colors.text.primary]}
          />
        }
        renderItem={({ item }) => {
          const id = (item as { id: string }).id;
          if (id === '__spacer__') {
            return <View style={s.gridCell} pointerEvents="none" />;
          }
          if (id.startsWith('__sk')) {
            return (
              <View style={s.gridCell}>
                <SkeletonCard colors={colors} />
              </View>
            );
          }
          const product = item as Product;
          return (
            <View style={s.gridCell}>
              <ProductCard
                product={product}
                onPress={() => handlePress(product)}
                colors={colors}
                saved={isSaved(product.id)}
                onToggleSave={() => toggleSave(product.id)}
              />
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: 18 }} />}
      />

      {/* ── Sort- & Filter-Sheet ── */}
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
            <Text style={[s.sheetTitle, { color: colors.text.primary }]}>{t('shop.sortTitle')}</Text>
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
                    {t(opt.labelKey)}
                  </Text>
                  {isActive && <Check size={18} color={colors.text.primary} strokeWidth={2.5} />}
                </Pressable>
              );
            })}

            {/* Filter: Gratis Versand */}
            <Text style={[s.sheetTitle, { color: colors.text.primary, marginTop: 18 }]}>{t('shop.filter')}</Text>
            <Pressable
              onPress={() => setFreeShipOnly(v => !v)}
              style={({ pressed }) => [s.sheetRow, { borderBottomColor: colors.border.subtle }, pressed && { opacity: 0.7 }]}
              accessibilityRole="switch"
              accessibilityState={{ checked: freeShipOnly }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Truck size={16} color={freeShipOnly ? '#22C55E' : colors.text.primary} strokeWidth={2.2} />
                <Text style={[s.sheetRowText, { color: colors.text.primary, fontWeight: freeShipOnly ? '700' : '500' }]}>
                  Nur Gratis Versand
                </Text>
              </View>
              {freeShipOnly && <Check size={18} color="#22C55E" strokeWidth={2.5} />}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── „Verkaufen"-FAB: schnellster Weg zum Produkt-Erstellen ── */}
      <Pressable
        onPress={() => router.push('/shop/my-shop?create=1' as any)}
        style={[s.sellFab, { bottom: insets.bottom + 62, backgroundColor: colors.text.primary }]}
        accessibilityLabel="Produkt verkaufen"
      >
        <Plus size={18} color={colors.bg.primary} strokeWidth={2.6} />
        <Text style={[s.sellFabText, { color: colors.bg.primary }]}>{t('shop.sell')}</Text>
      </Pressable>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // „Verkaufen"-FAB (schwebt unten rechts über der Bottom-Nav)
  sellFab: {
    position: 'absolute', right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 26,
    shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 5,
  },
  sellFabText: { fontSize: 14, fontWeight: '700' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingBottom: 8,
  },
  headerTitle: { fontSize: 26, fontWeight: '700', letterSpacing: -0.8 },
  coinRow: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 2 },
  coinText: { fontWeight: '700', fontSize: 16 },

  // Suchleiste (immer sichtbar)
  searchWrap: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 14, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // Menü-Shortcuts
  shortcutRow: {
    flexDirection: 'row',
    paddingHorizontal: 12, paddingTop: 2, paddingBottom: 12,
  },
  shortcut: { flex: 1, alignItems: 'center', gap: 6 },
  shortcutLabel: { fontSize: 11, fontWeight: '600' },

  // Dünne Text-Kategorien
  tabBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, marginTop: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabScroll: { flex: 1 },
  tabRow: { gap: 18, alignItems: 'flex-end' },
  tab: { alignItems: 'center' },
  tabLabel: { fontSize: 14, lineHeight: 18, paddingBottom: 8, includeFontPadding: false },
  tabUnderline: { height: 2, width: '100%', borderRadius: 1 },

  sortBtn: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    marginLeft: 8, marginBottom: 6,
  },

  resultRow: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  resultText: { fontSize: 12, fontWeight: '500' },

  // Kein horizontales Padding hier: es würde auch den ListHeader (inkl. Banner,
  // das voll-bleed laufen soll) einrücken. Stattdessen polstern die Grid-Reihen
  // selbst auf 16 — bündig mit dem fixierten Kopf/der Suchleiste.
  gridContent: { paddingTop: 4 },
  gridRow: { gap: 10, paddingHorizontal: 16 },
  gridCell: { flex: 1 },

  center: { alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 32, paddingTop: 60 },
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
