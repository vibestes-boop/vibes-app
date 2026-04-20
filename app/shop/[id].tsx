/**
 * app/shop/[id].tsx — TikTok Shop-style Produkt-Detailseite
 *
 * Features:
 * - Header: Zurück | Seller-Name (truncated) | Suche | Teilen | Warenkorb | ···
 * - Bild-Carousel: swipeable, Counter-Badge oben rechts, Tap → Vollbild (X + Zähler)
 * - Preis: große Ganzzahl + kleine Dezimalstelle
 * - Promo-Pills (verkaufte Stücke, Wenig Lager) als farbige Tags
 * - Versand/Lieferdatum-Zeile
 * - Seller-Karte mit Verified Badge
 * - Beschreibung (collapsible)
 * - Stock-Bar
 * - 2 Sticky-Buttons: [Merken] + [Kaufen]
 * - Share-Sheet
 * - More-Menu (Speichern, Melden, Hilfe)
 */

import { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Pressable, ScrollView, Modal,
  ActivityIndicator, useWindowDimensions, Share,
  NativeSyntheticEvent, NativeScrollEvent, Alert, TextInput, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ArrowLeft, Search, Share2, ShoppingCart,
  MoreHorizontal, X, Truck, Bookmark, Flag,
  HelpCircle, ChevronDown, ChevronUp, FileText, Box, Wrench, ShoppingBag,
  CheckCircle, AlertCircle, Check, Send, BadgeCheck, MapPin, Minus, Plus,
  MessageCircle,
} from 'lucide-react-native';
import { useAuthStore } from '@/lib/authStore';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  impactAsync, ImpactFeedbackStyle,
  notificationAsync, NotificationFeedbackType,
} from 'expo-haptics';
import { useShopProducts, useBuyProduct, useSavedProduct, useReportProduct, REPORT_REASONS, type ReportReason, type Product } from '@/lib/useShop';
import { useCoinsWallet } from '@/lib/useGifts';
import { useTheme } from '@/lib/useTheme';
import { StarDisplay } from '@/components/shop/ReviewSheet';
import { useProductReviews } from '@/lib/useProductReviews';
import { useOrCreateConversation, useSendMessage } from '@/lib/useMessages';
import { supabase } from '@/lib/supabase';
import * as Clipboard from 'expo-clipboard';

// ─── Konstanten ───────────────────────────────────────────────────────────────

const CAT_META = {
  digital:  { label: 'Digital',  icon: FileText, delivery: 'Sofortiger Download' },
  physical: { label: 'Physisch', icon: Box,      delivery: 'Lieferung per DM mit Creator' },
  service:  { label: 'Service',  icon: Wrench,   delivery: 'Creator meldet sich nach Kauf' },
};

const BUY_ERRORS: Record<string, string> = {
  insufficient_coins: 'Nicht genug Coins.',
  no_wallet:          'Wallet nicht gefunden.',
  cannot_buy_own:     'Du kannst dein eigenes Produkt nicht kaufen.',
  product_not_found:  'Produkt nicht mehr verfügbar.',
  out_of_stock:       'Leider ausverkauft.',
  network_error:      'Netzwerkfehler. Bitte nochmal versuchen.',
};

// ─── v1.26.3: Effektiver Preis = Angebot falls gesetzt, sonst Original ───────

function effectivePrice(p: Product): number {
  return p.sale_price_coins != null && p.sale_price_coins < p.price_coins
    ? p.sale_price_coins
    : p.price_coins;
}

function salePercent(p: Product): number | null {
  if (p.sale_price_coins == null || p.sale_price_coins >= p.price_coins) return null;
  return Math.round((1 - p.sale_price_coins / p.price_coins) * 100);
}

// ─── Preis-Formatter: große Ganzzahl + kleine Dezimalstelle ──────────────────

function PriceDisplay({
  coins, color, size = 'large',
}: {
  coins: number;
  color: string;
  size?: 'large' | 'medium';
}) {
  const formatted = coins.toLocaleString('de-DE');
  const parts = formatted.split(',');
  const integer = parts[0];
  const decimal = parts[1];
  const isLarge = size === 'large';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 1 }}>
      <Text style={{ fontSize: isLarge ? 12 : 11, fontWeight: '700', color }}>🪙</Text>
      <Text style={{
        fontSize: isLarge ? 36 : 20,
        fontWeight: '700',
        color,
        letterSpacing: isLarge ? -1.5 : -0.6,
      }}>{integer}</Text>
      {decimal && (
        <Text style={{ fontSize: isLarge ? 17 : 12, fontWeight: '700', color }}>,{decimal}</Text>
      )}
    </View>
  );
}

// ─── Vollbild-Galerie Modal ───────────────────────────────────────────────────

function FullscreenGallery({
  images, startIndex, onClose, colors,
}: {
  images: string[];
  startIndex: number;
  onClose: () => void;
  colors: any;
}) {
  const { width, height } = useWindowDimensions();
  const [current, setCurrent] = useState(startIndex);

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        {/* Header */}
        <View style={[fsg.header]}>
          <Pressable onPress={onClose} hitSlop={16} style={fsg.closeBtn}>
            <X size={22} color="#fff" strokeWidth={2.5} />
          </Pressable>
          <Text style={fsg.counter}>{current + 1}/{images.length}</Text>
        </View>

        {/* Bilder */}
        <ScrollView
          horizontal pagingEnabled showsHorizontalScrollIndicator={false}
          contentOffset={{ x: startIndex * width, y: 0 }}
          onScroll={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={16}
          style={{ flex: 1 }}
        >
          {images.map((uri, i) => (
            <View key={i} style={{ width, height, justifyContent: 'center' }}>
              <Image source={{ uri }} style={{ width, height: width }} contentFit="contain" />
            </View>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const fsg = StyleSheet.create({
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 54, paddingHorizontal: 16, paddingBottom: 12,
  },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  counter: { color: '#fff', fontSize: 14, fontWeight: '700' },
});

// ─── Bild-Carousel (v1.26.3: Blur-Fill + Thumbnail-Strip) ────────────────────
// Drei Layer:
//   1. Hintergrund: gleiche URL, blurRadius=30, contentFit=cover (füllt die
//      gesamte Fläche, unabhängig vom Aspect-Ratio des Originals)
//   2. Dim-Overlay: leichter schwarzer Schleier damit der Blur nicht zu
//      aufdringlich wird und der Vordergrund klar hervorsteht
//   3. Vordergrund: contentFit=contain — zeigt das Bild unbeschnitten,
//      egal ob quadratisch, 3:4, 4:5 oder Panorama
// Aspekt: 1:1 hero (quadratisch, etwas kompakter als 4:5 damit mehr Content
// "above the fold" sichtbar ist).

function ImageCarousel({
  images, width, activeIndex, onIndexChange, onTap, onScrollRef, colors,
}: {
  images: string[];
  width: number;
  activeIndex: number;
  onIndexChange: (i: number) => void;
  onTap: (index: number) => void;
  onScrollRef: (ref: ScrollView | null) => void;
  colors: any;
}) {
  const CAROUSEL_HEIGHT = Math.round(width * 1.0); // 1:1 Hero

  if (images.length === 0) {
    return (
      <View style={[{
        width,
        height: CAROUSEL_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg.elevated,
      }]}>
        <ShoppingBag size={60} color={colors.text.muted} strokeWidth={1.2} />
      </View>
    );
  }

  return (
    <View style={{ position: 'relative' }}>
      <ScrollView
        ref={onScrollRef}
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        // v1.26.8: Index nur am Ende der Scroll-Animation setzen (statt
        // kontinuierlich via onScroll alle 16ms). Verhindert das „Springen"
        // des ThumbnailStrip-Active-States beim programmatischen scrollTo
        // (Thumbnail-Klick auf entferntes Bild) und beim normalen Swipen.
        onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
          onIndexChange(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      >
        {images.map((uri, i) => (
          <Pressable key={i} onPress={() => onTap(i)} style={{ width, height: CAROUSEL_HEIGHT }}>
            {/* 1. Blur-Hintergrund */}
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              blurRadius={30}
              transition={200}
            />
            {/* 2. Dim-Overlay */}
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.22)' }]} />
            {/* 3. Vordergrund (contain) */}
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="contain"
              transition={200}
            />
          </Pressable>
        ))}
      </ScrollView>

      {/* Counter-Badge oben rechts */}
      {images.length > 1 && (
        <View style={car.counterBadge}>
          <Text style={car.counterText}>{activeIndex + 1}/{images.length}</Text>
        </View>
      )}

      {/* Dots unten */}
      {images.length > 1 && (
        <View style={car.dotsRow}>
          {images.map((_, i) => (
            <View
              key={i}
              style={[
                car.dot,
                i === activeIndex && car.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Thumbnail-Strip unter dem Hero-Bild ──────────────────────────────────────

function ThumbnailStrip({
  images, activeIndex, onSelect, colors,
}: {
  images: string[];
  activeIndex: number;
  onSelect: (i: number) => void;
  colors: any;
}) {
  if (images.length <= 1) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={car.thumbRow}
    >
      {images.map((uri, i) => {
        const active = i === activeIndex;
        return (
          <Pressable
            key={i}
            onPress={() => onSelect(i)}
            style={[
              car.thumb,
              {
                borderColor: active ? colors.text.primary : 'transparent',
                backgroundColor: colors.bg.elevated,
              },
            ]}
          >
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFillObject}
              contentFit="cover"
              transition={150}
            />
            {!active && (
              <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.25)' }]} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const car = StyleSheet.create({
  counterBadge: {
    position: 'absolute', top: 14, right: 14,
    backgroundColor: 'rgba(0,0,0,0.52)',
    borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4,
  },
  counterText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  dotsRow: {
    position: 'absolute', bottom: 12, left: 0, right: 0,
    flexDirection: 'row', justifyContent: 'center', gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  dotActive: {
    width: 18, backgroundColor: '#fff',
  },
  thumbRow: {
    paddingHorizontal: 16, paddingVertical: 12, gap: 8,
  },
  thumb: {
    width: 56, height: 56, borderRadius: 10,
    borderWidth: 2, overflow: 'hidden',
  },
});

// ─── Beschreibung (collapsible) ───────────────────────────────────────────────

function Description({ text, colors }: { text: string; colors: any }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text
        style={{ fontSize: 14, lineHeight: 22, color: colors.text.secondary ?? colors.text.muted }}
        numberOfLines={expanded ? undefined : 3}
      >
        {text}
      </Text>
      {text.length > 100 && (
        <Pressable
          onPress={() => setExpanded(e => !e)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
          hitSlop={10}
        >
          {expanded
            ? <><ChevronUp size={13} color={colors.text.primary} /><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text.primary }}>Weniger</Text></>
            : <><ChevronDown size={13} color={colors.text.primary} /><Text style={{ fontSize: 12, fontWeight: '700', color: colors.text.primary }}>Mehr lesen</Text></>
          }
        </Pressable>
      )}
    </View>
  );
}

// ─── TikTok-Style Produkt-ShareSheet ───────────────────────────────────────

type ShareTarget = { id: string; username: string | null; avatar_url: string | null };

function ShareSheet({ product, onClose, colors }: { product: Product; onClose: () => void; colors: any }) {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [copied, setCopied]   = useState(false);
  const [sending, setSending] = useState(false);

  const { mutateAsync: getOrCreateConv } = useOrCreateConversation();
  const { mutateAsync: sendMsg }         = useSendMessage();

  const productUrl  = `serlo://shop/${product.id}`;
  const shareText   = `${product.title} — 🪙 ${product.price_coins.toLocaleString('de-DE')} Coins\n${productUrl}`;

  const { data: users = [] } = useQuery<ShareTarget[]>({
    queryKey: ['product-share-users', currentUserId],
    enabled: !!currentUserId,
    queryFn: async () => {
      if (!currentUserId) return [];
      const { data } = await supabase
        .from('follows')
        .select('following_id, profiles!follows_following_id_fkey(id, username, avatar_url)')
        .eq('follower_id', currentUserId)
        .limit(40);
      return ((data ?? []).map((d: any) => d.profiles).filter(Boolean)) as ShareTarget[];
    },
  });

  const filtered = users.filter((u) =>
    !search || u.username?.toLowerCase().includes(search.toLowerCase())
  );

  const toggleSelect = (id: string) => {
    impactAsync(ImpactFeedbackStyle.Light);
    setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleSend = async () => {
    if (selected.size === 0 || !currentUserId) return;
    setSending(true);
    impactAsync(ImpactFeedbackStyle.Medium);
    try {
      await Promise.all(Array.from(selected).map(async (targetId) => {
        const conversationId = await getOrCreateConv(targetId);
        await sendMsg({ conversationId, content: shareText });
      }));
      notificationAsync(NotificationFeedbackType.Success);
      onClose();
    } catch { Alert.alert('Fehler', 'Produkt konnte nicht gesendet werden.'); }
    setSending(false);
  };

  const APPS = [
    { id: 'copy',     label: 'Link\nkopieren', color: '#374151', emoji: '🔗' },
    { id: 'whatsapp', label: 'WhatsApp',       color: '#25D366', emoji: '💬' },
    { id: 'telegram', label: 'Telegram',       color: '#2CA5E0', emoji: '✈️' },
    { id: 'more',     label: 'Mehr…',         color: '#6B7280', emoji: '⋯'  },
  ];

  const handleApp = async (id: string) => {
    if (id === 'copy') {
      await Clipboard.setStringAsync(productUrl);
      setCopied(true);
      notificationAsync(NotificationFeedbackType.Success);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    onClose();
    if (id === 'whatsapp') {
      Linking.openURL(`whatsapp://send?text=${encodeURIComponent(shareText)}`).catch(() => Share.share({ message: shareText }));
      return;
    }
    if (id === 'telegram') {
      Linking.openURL(`tg://msg?text=${encodeURIComponent(shareText)}`).catch(() => Share.share({ message: shareText }));
      return;
    }
    Share.share({ message: shareText });
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose}>
        <Pressable style={[ss.sheet, { backgroundColor: '#0F0F0F' }]} onPress={() => {}}>

          {/* Handle */}
          <View style={ss.handle} />

          {/* Produkt-Preview */}
          <View style={ss.productPreview}>
            {product.cover_url
              ? <Image source={{ uri: product.cover_url }} style={ss.previewImg} contentFit="cover" />
              : <View style={[ss.previewImg, { backgroundColor: 'rgba(255,255,255,0.06)' }]} />}
            <View style={{ flex: 1 }}>
              <Text style={ss.previewTitle} numberOfLines={2}>{product.title}</Text>
              <Text style={ss.previewPrice}>🪙 {product.price_coins.toLocaleString('de-DE')} Coins</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={12}>
              <X size={20} color="rgba(255,255,255,0.4)" />
            </Pressable>
          </View>

          {/* Suche */}
          <View style={ss.searchBar}>
            <Search size={14} color="rgba(255,255,255,0.35)" />
            <TextInput
              style={ss.searchInput}
              placeholder="Follower suchen…"
              placeholderTextColor="rgba(255,255,255,0.25)"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          {/* User-Zeile */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.userRow}>
            {filtered.map((u) => {
              const isSel = selected.has(u.id);
              return (
                <Pressable key={u.id} style={ss.userItem} onPress={() => toggleSelect(u.id)}>
                  <View style={ss.userAvatarWrap}>
                    {u.avatar_url
                      ? <Image source={{ uri: u.avatar_url }} style={ss.userAvatar} contentFit="cover" />
                      : <View style={[ss.userAvatar, { backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' }]}>
                          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{(u.username ?? '?')[0].toUpperCase()}</Text>
                        </View>}
                    {isSel && <View style={ss.checkBadge}><Check size={11} color="#000" strokeWidth={3} /></View>}
                  </View>
                  <Text style={ss.userName} numberOfLines={1}>{u.username ?? 'User'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Senden-Button */}
          {selected.size > 0 && (
            <Pressable style={ss.sendBtn} onPress={handleSend} disabled={sending}>
              {sending
                ? <ActivityIndicator color="#000" size="small" />
                : <><Send size={15} color="#000" strokeWidth={2.5} /><Text style={ss.sendBtnText}>Senden{selected.size > 1 ? ` (${selected.size})` : ''}</Text></>
              }
            </Pressable>
          )}

          {/* App-Icons */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={ss.appsRow}>
            {APPS.map((app) => (
              <Pressable key={app.id} style={ss.appItem} onPress={() => handleApp(app.id)}>
                <View style={[ss.appIcon, { backgroundColor: app.id === 'copy' && copied ? '#22C55E' : app.color }]}>
                  {app.id === 'copy' && copied
                    ? <Check size={22} color="#fff" strokeWidth={2.5} />
                    : <Text style={{ fontSize: 22 }}>{app.emoji}</Text>}
                </View>
                <Text style={[ss.appLabel, { color: 'rgba(255,255,255,0.5)' }]}>{app.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet:    { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingBottom: 36, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.08)' },
  handle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'center', marginTop: 12, marginBottom: 14 },
  // Produkt Preview
  productPreview: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, marginBottom: 14 },
  previewImg:     { width: 48, height: 48, borderRadius: 10 },
  previewTitle:   { color: '#fff', fontSize: 14, fontWeight: '700', lineHeight: 18 },
  previewPrice:   { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 3 },
  // Suche
  searchBar:   { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  searchInput: { flex: 1, color: '#fff', fontSize: 14 },
  // User
  userRow:       { paddingHorizontal: 20, gap: 14, paddingBottom: 4, alignItems: 'flex-start' },
  userItem:      { alignItems: 'center', gap: 5, width: 58 },
  userAvatarWrap: { position: 'relative' },
  userAvatar:    { width: 50, height: 50, borderRadius: 25 },
  checkBadge:    { position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0F0F0F' },
  userName:      { color: 'rgba(255,255,255,0.6)', fontSize: 10, textAlign: 'center' },
  // Senden
  sendBtn:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, backgroundColor: '#fff', borderRadius: 14, marginHorizontal: 20, marginTop: 10, paddingVertical: 12 },
  sendBtnText: { color: '#000', fontSize: 14, fontWeight: '600' },
  // Apps
  appsRow:  { paddingHorizontal: 20, gap: 18, paddingVertical: 14 },
  appItem:  { alignItems: 'center', gap: 6, width: 58 },
  appIcon:  { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
  appLabel: { fontSize: 10, textAlign: 'center', lineHeight: 13 },
});

// ─── More-Menu ────────────────────────────────────────────────────────────────

function MoreMenu({ onClose, onSave, onReport, colors }: {
  onClose: () => void;
  onSave: () => void;
  onReport: () => void;
  colors: any;
}) {
  const ITEMS = [
    { icon: Bookmark, label: 'Gespeicherte ansehen', action: onSave },
    { icon: Flag,     label: 'Melden',               action: onReport },
    { icon: HelpCircle, label: 'Hilfecenter',        action: onClose },
  ];
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={mm.overlay} onPress={onClose}>
        <View style={[mm.sheet, { backgroundColor: colors.bg.elevated }]}>
          <View style={[mm.handle, { backgroundColor: colors.border.subtle }]} />
          {ITEMS.map((item, i) => {
            const Icon = item.icon;
            return (
              <Pressable
                key={i}
                style={[mm.row, i < ITEMS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle }]}
                onPress={() => { item.action(); onClose(); }}
              >
                <Icon size={18} color={colors.text.primary} strokeWidth={1.8} />
                <Text style={[mm.rowText, { color: colors.text.primary }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Pressable>
    </Modal>
  );
}

const mm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingBottom: 40, paddingTop: 12 },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 16 },
  rowText: { fontSize: 15, fontWeight: '500' },
});

// ─── Hauptscreen ─────────────────────────────────────────────────────────────

export default function ProductDetailScreen() {
  const { id }     = useLocalSearchParams<{ id: string }>();
  const insets     = useSafeAreaInsets();
  const router     = useRouter();
  const { colors } = useTheme();
  const { width }  = useWindowDimensions();

  const { data: products = [], isLoading } = useShopProducts();
  const product = products.find(p => p.id === id);

  const { coins, refetch: refetchCoins }         = useCoinsWallet();
  const { buyProduct, isBuying }                  = useBuyProduct();
  const { saved, toggle: toggleSave }             = useSavedProduct(id ?? '');
  const { report, isReporting }                   = useReportProduct();
  const { data: reviews = [] }                    = useProductReviews(id ?? null);

  // Bewertungs-Durchschnitt live berechnen (reviews live > gespeicherter Wert in DB)
  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : product?.avg_rating ?? null;
  const reviewCount = reviews.length || product?.review_count || 0;

  const [showConfirm,    setShowConfirm]    = useState(false);
  const [showShare,      setShowShare]      = useState(false);
  const [showMore,       setShowMore]       = useState(false);
  const [showReport,     setShowReport]     = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [fullscreenIdx,  setFullscreenIdx]  = useState(0);
  const [reportReason,   setReportReason]   = useState<ReportReason | null>(null);
  const [buyResult,      setBuyResult]      = useState<'success' | 'error' | null>(null);
  const [resultMsg,      setResultMsg]      = useState('');
  // v1.26.4: Carousel-Index wird im Screen gehalten, damit der Thumbnail-Strip
  // tappable ist + programmatisch zum Bild gescrollt werden kann.
  const [activeImgIdx, setActiveImgIdx] = useState(0);
  const carouselRef = useRef<ScrollView | null>(null);
  // v1.26.5: Chat-mit-Seller-Button
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const { mutateAsync: openConversation } = useOrCreateConversation();
  const [isChatOpening, setIsChatOpening] = useState(false);
  // v1.26.4: Quantity-Stepper. Max = verfügbarer Stock (oder 99 bei stock=-1
  // = unbegrenzt). Wird unten in buyProduct(… , quantity) eingesetzt.
  const [quantity, setQuantity] = useState(1);

  const effPrice     = product ? effectivePrice(product) : 0;
  const percentOff   = product ? salePercent(product) : null;
  const totalCost    = effPrice * quantity;
  const canAfford    = product ? coins >= totalCost : false;
  const isOutOfStock = product ? product.stock === 0 : false;
  const isLowStock   = product ? product.stock !== -1 && product.stock > 0 && product.stock <= 5 : false;
  const maxQty       = product ? (product.stock === -1 ? 99 : Math.max(1, product.stock)) : 1;
  const catMeta      = product ? CAT_META[product.category] : null;
  const CatIcon      = catMeta ? (CAT_META[product!.category].icon) : ShoppingBag;
  const images = product ? [
    ...(product.cover_url  ? [product.cover_url]    : []),
    ...(product.image_urls ?? []),
  ] : [];

  // Bei Produkt-Wechsel: Quantity + Carousel zurücksetzen
  const resetQtyOnProduct = product?.id;
  // Note: React würde quantity bei Route-Wechsel eh reset-en, weil Screen
  // komplett neu gemountet wird. Keine Zusatz-Logik nötig.
  void resetQtyOnProduct;

  // v1.26.5: Direkt-Chat mit dem Seller zu diesem Produkt. Öffnet (oder
  // erstellt) eine Konversation und navigiert zum DM-Screen. Vorformulierte
  // Nachricht wird NICHT geschickt — das fühlt sich zu aggressiv an, der
  // User kann selbst tippen was er fragen möchte.
  const handleChatSeller = useCallback(async () => {
    if (!product || isChatOpening) return;
    if (product.seller_id === currentUserId) return;
    impactAsync(ImpactFeedbackStyle.Light);
    setIsChatOpening(true);
    try {
      const conversationId = await openConversation(product.seller_id);
      router.push({
        pathname: '/messages/[id]',
        params: { id: conversationId, productId: product.id },
      } as any);
    } catch {
      await notificationAsync(NotificationFeedbackType.Error);
      setBuyResult('error');
      setResultMsg('Chat konnte nicht geöffnet werden.');
      setTimeout(() => setBuyResult(null), 2500);
    } finally {
      setIsChatOpening(false);
    }
  }, [product, currentUserId, isChatOpening, openConversation, router]);

  const handleBuy = useCallback(async () => {
    if (!product) return;
    setShowConfirm(false);
    const result = await buyProduct(product.id, quantity);
    if (result.success) {
      await notificationAsync(NotificationFeedbackType.Success);
      setBuyResult('success');
      setResultMsg('🎉 Erfolgreich gekauft!');
      await refetchCoins();
      setTimeout(() => setBuyResult(null), 2500);
    } else {
      await notificationAsync(NotificationFeedbackType.Error);
      setBuyResult('error');
      setResultMsg(BUY_ERRORS[result.error] ?? 'Fehler.');
      if (result.error === 'insufficient_coins') {
        setTimeout(() => { setBuyResult(null); router.push('/coin-shop' as any); }, 2000);
      } else {
        setTimeout(() => setBuyResult(null), 2500);
      }
    }
  }, [product, buyProduct, refetchCoins, router, quantity]);

  if (isLoading) {
    return <View style={[s.root, s.center, { backgroundColor: colors.bg.secondary }]}><ActivityIndicator color={colors.text.primary} size="large" /></View>;
  }
  if (!product) {
    return (
      <View style={[s.root, s.center, { backgroundColor: colors.bg.secondary }]}>
        <Text style={{ color: colors.text.muted, fontSize: 16 }}>Produkt nicht gefunden.</Text>
        <Pressable onPress={() => router.back()} style={[s.backPill, { borderColor: colors.border.subtle }]}>
          <Text style={{ color: colors.text.primary, fontWeight: '600' }}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  // Qty-Stepper-Zeile wird nur gerendert wenn maxQty > 1 und stock != 0 —
  // reservier entsprechend Scroll-Padding, damit Sticky-Bar nichts verdeckt.
  const hasQtyRow = product.stock !== 0 && maxQty > 1;
  const buyBarH   = Math.max(insets.bottom, 14) + 80 + (hasQtyRow ? 52 : 0);

  // v1.26.6: TikTok-Look — komplette Detailseite auf weißem Untergrund
  // (`bg.secondary`), nicht auf `bg.primary` (was in Light-Mode #F5F5F5
  // hellgrau ist). Dividers sind jetzt Hairline-Lines statt 8px-Stripes,
  // bg-Akzente nutzen `bg.subtle` damit Pills/Buttons in beiden Themes
  // sichtbar bleiben.
  const bgMain    = colors.bg.secondary;
  const bgAccent  = colors.bg.subtle;

  return (
    <View style={[s.root, { backgroundColor: bgMain }]}>

      {/* ─── Header ── */}
      <View style={[s.header, { paddingTop: insets.top + 6, backgroundColor: bgMain, borderBottomColor: colors.border.subtle }]}>
        <Pressable onPress={() => router.back()} hitSlop={14} style={s.headerBtn}>
          <ArrowLeft size={20} color={colors.text.primary} strokeWidth={2.5} />
        </Pressable>

        {/* Seller-Info (truncated) */}
        <Pressable
          style={s.sellerHeaderWrap}
          onPress={() => router.push({ pathname: '/user/[id]', params: { id: product.seller_id } } as any)}
        >
          {product.seller_avatar ? (
            <Image source={{ uri: product.seller_avatar }} style={s.sellerHeaderAvatar} contentFit="cover" />
          ) : (
            <View style={[s.sellerHeaderAvatar, { backgroundColor: bgAccent }]} />
          )}
          <Text style={[s.sellerHeaderName, { color: colors.text.primary }]} numberOfLines={1}>
            {product.seller_username}
          </Text>
          {product.seller_verified && (
            <BadgeCheck size={14} color={colors.text.primary} strokeWidth={2} />
          )}
        </Pressable>

        {/* Action Icons */}
        <Pressable onPress={() => {}} hitSlop={12} style={s.headerBtn}>
          <Search size={19} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={() => setShowShare(true)} hitSlop={12} style={s.headerBtn}>
          <Share2 size={19} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={() => router.push('/shop/orders' as any)} hitSlop={12} style={s.headerBtn}>
          <ShoppingCart size={19} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
        <Pressable onPress={() => setShowMore(true)} hitSlop={12} style={s.headerBtn}>
          <MoreHorizontal size={19} color={colors.text.primary} strokeWidth={2} />
        </Pressable>
      </View>

      {/* ─── Scrollbarer Inhalt ── */}
      <ScrollView
        contentContainerStyle={{ paddingBottom: buyBarH }}
        showsVerticalScrollIndicator={false}
        bounces
      >
        {/* 1. Bild-Hero (Blur-Fill + Dots) */}
        <ImageCarousel
          images={images}
          width={width}
          activeIndex={activeImgIdx}
          onIndexChange={setActiveImgIdx}
          onScrollRef={(r) => { carouselRef.current = r; }}
          onTap={(i) => { setFullscreenIdx(i); setShowFullscreen(true); }}
          colors={colors}
        />

        {/* 1b. Thumbnail-Strip (nur bei > 1 Bild) */}
        <ThumbnailStrip
          images={images}
          activeIndex={activeImgIdx}
          onSelect={(i) => {
            setActiveImgIdx(i);
            carouselRef.current?.scrollTo({ x: i * width, animated: true });
          }}
          colors={colors}
        />

        {/* 2. Preis + Sale-Badge + Merken */}
        <View style={s.priceSection}>
          {/* Preis-Zeile: Sale-Prozent-Badge + Preis (evtl. rot) + Merken-Btn */}
          <View style={s.priceRow}>
            <View style={{ flex: 1, gap: 6 }}>
              {percentOff != null && (
                <View style={s.saleBadge}>
                  <Text style={s.saleBadgeText}>-{percentOff}%</Text>
                </View>
              )}
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <PriceDisplay
                  coins={effPrice}
                  color={percentOff != null ? '#EF4444' : colors.text.primary}
                />
                {percentOff != null && (
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '600',
                      color: colors.text.muted,
                      textDecorationLine: 'line-through',
                    }}
                  >
                    🪙 {product.price_coins.toLocaleString('de-DE')}
                  </Text>
                )}
              </View>
            </View>
            <Pressable
              onPress={async () => {
                impactAsync(ImpactFeedbackStyle.Light);
                await toggleSave();
              }}
              hitSlop={14}
              style={[s.bookmarkBtn, {
                backgroundColor: saved ? colors.text.primary : bgAccent,
                borderColor: colors.border.subtle,
              }]}
            >
              <Bookmark
                size={18}
                color={saved ? colors.bg.primary : colors.text.primary}
                fill={saved ? colors.bg.primary : 'transparent'}
                strokeWidth={2}
              />
            </Pressable>
          </View>

          {/* Promo-Pills */}
          <View style={s.pillRow}>
            {product.sold_count > 0 && (
              <View style={[s.pill, { backgroundColor: 'rgba(239,68,68,0.12)', borderColor: 'rgba(239,68,68,0.25)' }]}>
                <Text style={[s.pillText, { color: '#EF4444' }]}>
                  🔥 {product.sold_count.toLocaleString('de-DE')}× gekauft
                </Text>
              </View>
            )}
            {isLowStock && (
              <View style={[s.pill, { backgroundColor: 'rgba(245,158,11,0.12)', borderColor: 'rgba(245,158,11,0.25)' }]}>
                <Text style={[s.pillText, { color: '#F59E0B' }]}>
                  ⚡ Nur noch {product.stock} übrig
                </Text>
              </View>
            )}
            {product.category === 'physical' && product.free_shipping && (
              <View style={[s.pill, { backgroundColor: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.25)', flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Truck size={11} color="#22C55E" strokeWidth={2.2} />
                <Text style={[s.pillText, { color: '#22C55E' }]}>Gratis Versand</Text>
              </View>
            )}
            {product.location && (
              <View style={[s.pill, { backgroundColor: bgAccent, borderColor: colors.border.subtle, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <MapPin size={11} color={colors.text.muted} strokeWidth={2.2} />
                <Text style={[s.pillText, { color: colors.text.muted }]}>{product.location}</Text>
              </View>
            )}
          </View>

          {/* Bewertungs-Zeile */}
          <StarDisplay rating={avgRating} count={reviewCount} />

          {/* Versand/Lieferzeile */}
          <View style={s.deliveryRow}>
            <Truck size={13} color={colors.text.muted} strokeWidth={2} />
            <Text style={[s.deliveryText, { color: colors.text.muted }]}>
              {catMeta?.delivery}
            </Text>
          </View>
        </View>

        <View style={[s.divider, { backgroundColor: colors.border.subtle }]} />

        {/* 3. Seller-Karte (v1.26.5: Chat-Button zusätzlich) */}
        <View style={s.sellerCard}>
          {/* Avatar + Infos öffnen das Profil */}
          <Pressable
            style={s.sellerInner}
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: product.seller_id } } as any)}
          >
            {product.seller_avatar ? (
              <Image source={{ uri: product.seller_avatar }} style={s.sellerAvatar} contentFit="cover" />
            ) : (
              <View style={[s.sellerAvatar, { backgroundColor: bgAccent, alignItems: 'center', justifyContent: 'center' }]}>
                <Text style={{ fontSize: 20 }}>👤</Text>
              </View>
            )}
            <View style={s.sellerInfo}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Text style={[s.sellerName, { color: colors.text.primary }]}>
                  @{product.seller_username}
                </Text>
                {product.seller_verified && (
                  <BadgeCheck size={14} color={colors.text.primary} strokeWidth={2} />
                )}
              </View>
              <Text style={[s.sellerSub, { color: colors.text.muted }]}>{product.sold_count} Verkäufe</Text>
            </View>
          </Pressable>

          {/* Chat-Button (Icon-Circle) — DM öffnen, nicht eigenes Produkt */}
          {product.seller_id !== currentUserId && (
            <Pressable
              onPress={handleChatSeller}
              disabled={isChatOpening}
              style={[s.sellerChatBtn, {
                borderColor: colors.border.subtle,
                backgroundColor: bgAccent,
              }]}
              hitSlop={6}
            >
              {isChatOpening
                ? <ActivityIndicator color={colors.text.primary} size="small" />
                : <MessageCircle size={18} color={colors.text.primary} strokeWidth={2} />
              }
            </Pressable>
          )}

          {/* Shop-Button — führt zum Profil (Shop-Tab) */}
          <Pressable
            onPress={() => router.push({ pathname: '/user/[id]', params: { id: product.seller_id } } as any)}
            style={[s.sellerShopBtn, { backgroundColor: colors.text.primary }]}
          >
            <Text style={[s.sellerShopText, { color: colors.bg.primary }]}>Shop</Text>
          </Pressable>
        </View>

        <View style={[s.divider, { backgroundColor: colors.border.subtle }]} />

        {/* 4. Produktinfos */}
        <View style={s.section}>
          {/* Titel */}
          <Text style={[s.title, { color: colors.text.primary }]}>{product.title}</Text>

          {/* Kategorie + WOZ Chips */}
          <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>
            <View style={[s.chip, { backgroundColor: bgAccent, borderColor: colors.border.subtle }]}>
              <CatIcon size={11} color={colors.text.muted} strokeWidth={2} />
              <Text style={[s.chipText, { color: colors.text.muted }]}>{catMeta?.label}</Text>
            </View>
            {product.women_only && (
              <View style={[s.chip, { backgroundColor: bgAccent, borderColor: colors.border.subtle }]}>
                <Text style={{ fontSize: 11 }}>🌸</Text>
                <Text style={[s.chipText, { color: colors.text.muted }]}>Women-Only</Text>
              </View>
            )}
          </View>

          {/* Beschreibung */}
          {product.description && <Description text={product.description} colors={colors} />}
        </View>

        {/* 5. Stock-Bar */}
        {product.stock >= 0 && (
          <>
            <View style={[s.divider, { backgroundColor: colors.border.subtle }]} />
            <View style={s.section}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={[s.sectionLabel, { color: colors.text.primary }]}>Verfügbarkeit</Text>
                <View style={[s.stockLabel, {
                  backgroundColor: product.stock === 0
                    ? 'rgba(239,68,68,0.12)'
                    : isLowStock
                    ? 'rgba(245,158,11,0.12)'
                    : 'rgba(34,197,94,0.12)',
                }]}>
                  <Text style={{
                    fontSize: 11, fontWeight: '600',
                    color: product.stock === 0 ? '#EF4444' : isLowStock ? '#F59E0B' : '#22C55E',
                  }}>
                    {product.stock === 0 ? 'Ausverkauft' : `${product.stock} auf Lager`}
                  </Text>
                </View>
              </View>
              <View style={[s.stockBg, { backgroundColor: bgAccent }]}>
                <View style={[s.stockFill, {
                  width: product.stock === 0 ? ('100%' as any)
                    : (`${Math.min(100, product.stock / Math.max(product.stock + product.sold_count, 1) * 100)}%` as any),
                  backgroundColor: product.stock === 0 ? '#EF4444' : isLowStock ? '#F59E0B' : '#22C55E',
                }]} />
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* ─── Sticky Buy-Bar: Qty-Stepper + Merken + Big-CTA (Preis-Pill) ── */}
      <View style={[s.buyBar, {
        paddingBottom: Math.max(insets.bottom, 14) + 6,
        backgroundColor: bgMain,
        borderTopColor: colors.border.subtle,
      }]}>
        {/* Zeile 1: Quantity-Stepper (nur für physisch/digital mit stock > 1) */}
        {product.stock !== 0 && maxQty > 1 && (
          <View style={s.qtyRow}>
            <Text style={[s.qtyLabel, { color: colors.text.muted }]}>Menge</Text>
            <View style={[s.qtyStepper, { backgroundColor: bgAccent, borderColor: colors.border.subtle }]}>
              <Pressable
                onPress={() => {
                  if (quantity <= 1) return;
                  impactAsync(ImpactFeedbackStyle.Light);
                  setQuantity((q) => Math.max(1, q - 1));
                }}
                hitSlop={8}
                style={s.qtyBtn}
                disabled={quantity <= 1}
              >
                <Minus
                  size={15}
                  color={quantity <= 1 ? colors.text.muted : colors.text.primary}
                  strokeWidth={2.5}
                />
              </Pressable>
              <Text style={[s.qtyNum, { color: colors.text.primary }]}>{String(quantity).padStart(2, '0')}</Text>
              <Pressable
                onPress={() => {
                  if (quantity >= maxQty) return;
                  impactAsync(ImpactFeedbackStyle.Light);
                  setQuantity((q) => Math.min(maxQty, q + 1));
                }}
                hitSlop={8}
                style={s.qtyBtn}
                disabled={quantity >= maxQty}
              >
                <Plus
                  size={15}
                  color={quantity >= maxQty ? colors.text.muted : colors.text.primary}
                  strokeWidth={2.5}
                />
              </Pressable>
            </View>
          </View>
        )}

        {/* Zeile 2: Merken (kleiner Circle) + Big Buy-CTA mit Preis-Pill innen */}
        <View style={s.buyBarInner}>
          <Pressable
            style={[s.saveCircle, {
              borderColor: saved ? colors.text.primary : colors.border.subtle,
              backgroundColor: saved ? colors.text.primary : bgAccent,
            }]}
            onPress={async () => {
              impactAsync(ImpactFeedbackStyle.Light);
              await toggleSave();
            }}
          >
            <Bookmark
              size={19}
              color={saved ? colors.bg.primary : colors.text.primary}
              fill={saved ? colors.bg.primary : 'transparent'}
              strokeWidth={2}
            />
          </Pressable>

          <Pressable
            style={[s.buyBtn, {
              backgroundColor: isOutOfStock
                ? colors.border.subtle
                : !canAfford
                ? bgAccent
                : colors.text.primary,
              borderWidth: !canAfford && !isOutOfStock ? 1.5 : 0,
              borderColor: colors.text.primary,
            }]}
            onPress={() => {
              if (isOutOfStock) return;
              if (!canAfford) { router.push('/coin-shop' as any); return; }
              impactAsync(ImpactFeedbackStyle.Medium);
              setShowConfirm(true);
            }}
            disabled={isBuying || isOutOfStock}
          >
            {isBuying ? (
              <ActivityIndicator color={canAfford ? colors.bg.primary : colors.text.primary} />
            ) : isOutOfStock ? (
              <Text style={[s.buyBtnText, { color: colors.text.muted }]}>Ausverkauft</Text>
            ) : !canAfford ? (
              <Text style={[s.buyBtnText, { color: colors.text.primary }]}>🪙 Aufladen</Text>
            ) : (
              // v1.26.4: Preis-Pill links | Trennstrich | "Jetzt kaufen" rechts
              <View style={s.buyBtnSplit}>
                <View style={s.buyPricePill}>
                  <Text style={[s.buyPriceText, { color: colors.bg.primary }]}>
                    🪙 {totalCost.toLocaleString('de-DE')}
                  </Text>
                </View>
                <View style={[s.buyDivider, { backgroundColor: colors.bg.primary, opacity: 0.25 }]} />
                <Text style={[s.buyCtaText, { color: colors.bg.primary }]}>Jetzt kaufen</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* ─── Bestätigungs-Modal ── */}
      <Modal visible={showConfirm} transparent animationType="slide" onRequestClose={() => setShowConfirm(false)}>
        <Pressable style={ss.overlay} onPress={() => setShowConfirm(false)}>
          <View style={[mm.sheet, { backgroundColor: colors.bg.elevated }]}>
            <View style={[mm.handle, { backgroundColor: colors.border.subtle }]} />
            <Text style={[{ fontSize: 18, fontWeight: '600', color: colors.text.primary, textAlign: 'center', marginBottom: 18 }]}>
              Kauf bestätigen
            </Text>
            <View style={[s.confirmProduct, { backgroundColor: bgAccent, borderColor: colors.border.subtle }]}>
              {product.cover_url ? (
                <Image source={{ uri: product.cover_url }} style={s.confirmThumb} contentFit="cover" />
              ) : (
                <View style={[s.confirmThumb, { backgroundColor: bgAccent, alignItems: 'center', justifyContent: 'center' }]}>
                  <ShoppingBag size={20} color={colors.text.muted} />
                </View>
              )}
              <View style={{ flex: 1, gap: 8 }}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text.primary }} numberOfLines={2}>{product.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                  <PriceDisplay coins={totalCost} color={colors.text.primary} size="medium" />
                  {quantity > 1 && (
                    <Text style={{ fontSize: 11, fontWeight: '600', color: colors.text.muted }}>
                      ({quantity}× 🪙 {effPrice.toLocaleString('de-DE')})
                    </Text>
                  )}
                </View>
              </View>
            </View>
            <View style={[s.confirmBalance, { backgroundColor: bgAccent, borderColor: colors.border.subtle }]}>
              <Text style={{ fontSize: 12, color: colors.text.muted }}>Guthaben nach Kauf</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text.primary }}>
                🪙 {(coins - totalCost).toLocaleString('de-DE')}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable style={[s.confirmCancelBtn, { borderColor: colors.border.subtle }]} onPress={() => setShowConfirm(false)}>
                <Text style={{ color: colors.text.muted, fontSize: 15, fontWeight: '600' }}>Abbrechen</Text>
              </Pressable>
              <Pressable style={[s.confirmBuyBtn, { backgroundColor: colors.text.primary }]} onPress={handleBuy} disabled={isBuying}>
                {isBuying
                  ? <ActivityIndicator color={colors.bg.primary} />
                  : <Text style={{ color: colors.bg.primary, fontSize: 15, fontWeight: '600' }}>Kaufen</Text>
                }
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      {/* ─── Share-Sheet ── */}
      {showShare && <ShareSheet product={product} onClose={() => setShowShare(false)} colors={colors} />}

      {/* ─── More-Menu ── */}
      {showMore && (
        <MoreMenu
          onClose={() => setShowMore(false)}
          onSave={() => { setShowMore(false); router.push('/shop/saved' as any); }}
          onReport={() => { setShowMore(false); setShowReport(true); }}
          colors={colors}
        />
      )}

      {/* ─── Report-Modal ── */}
      {showReport && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setShowReport(false)}>
          <Pressable style={ss.overlay} onPress={() => setShowReport(false)}>
            <View style={[mm.sheet, { backgroundColor: colors.bg.elevated }]}>
              <View style={[mm.handle, { backgroundColor: colors.border.subtle }]} />
              <Text style={[{ fontSize: 17, fontWeight: '600', color: colors.text.primary, marginBottom: 16 }]}>Produkt melden</Text>
              {REPORT_REASONS.map((r) => (
                <Pressable
                  key={r.key}
                  style={[
                    mm.row,
                    { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.subtle },
                    reportReason === r.key && { backgroundColor: colors.bg.primary },
                  ]}
                  onPress={() => setReportReason(r.key)}
                >
                  <View style={[{
                    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
                    borderColor: reportReason === r.key ? colors.text.primary : colors.border.subtle,
                    backgroundColor: reportReason === r.key ? colors.text.primary : 'transparent',
                  }]} />
                  <Text style={[mm.rowText, { color: colors.text.primary }]}>{r.label}</Text>
                </Pressable>
              ))}
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <Pressable
                  style={[s.confirmCancelBtn, { borderColor: colors.border.subtle }]}
                  onPress={() => { setShowReport(false); setReportReason(null); }}
                >
                  <Text style={{ color: colors.text.muted, fontSize: 14, fontWeight: '600' }}>Abbrechen</Text>
                </Pressable>
                <Pressable
                  style={[s.confirmBuyBtn, {
                    backgroundColor: reportReason ? colors.text.primary : colors.border.subtle,
                  }]}
                  disabled={!reportReason || isReporting}
                  onPress={async () => {
                    if (!reportReason || !product) return;
                    const res = await report(product.id, reportReason);
                    setShowReport(false);
                    setReportReason(null);
                    if (res.success) {
                      setBuyResult('success');
                      setResultMsg('Gemeldet. Danke für deine Meldung.');
                      setTimeout(() => setBuyResult(null), 2500);
                    }
                  }}
                >
                  {isReporting
                    ? <ActivityIndicator color={colors.bg.primary} />
                    : <Text style={{ color: reportReason ? colors.bg.primary : colors.text.muted, fontSize: 14, fontWeight: '600' }}>Melden</Text>
                  }
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}

      {/* ─── Vollbild-Galerie ── */}
      {showFullscreen && (
        <FullscreenGallery
          images={images}
          startIndex={fullscreenIdx}
          onClose={() => setShowFullscreen(false)}
          colors={colors}
        />
      )}

      {/* ─── Toast ── */}
      {buyResult && (
        <View style={[s.toast, {
          bottom: buyBarH + 10,
          backgroundColor: buyResult === 'success' ? colors.text.primary : '#EF4444',
        }]}>
          {buyResult === 'success'
            ? <CheckCircle size={16} color={colors.bg.primary} strokeWidth={2} />
            : <AlertCircle size={16} color="#fff" strokeWidth={2} />
          }
          <Text style={[s.toastText, { color: buyResult === 'success' ? colors.bg.primary : '#fff' }]}>
            {resultMsg}
          </Text>
        </View>
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center', gap: 14 },
  backPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1 },

  // Header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 2,
  },
  headerBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  sellerHeaderWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 4 },
  sellerHeaderAvatar: { width: 26, height: 26, borderRadius: 13 },
  sellerHeaderName: { fontSize: 13, fontWeight: '700', flexShrink: 1 },

  // Preis
  priceSection: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 10 },
  priceRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },

  // Sale-Prozent-Badge über dem Preis
  saleBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EF4444',
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6,
  },
  saleBadgeText: {
    color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 0.2,
  },

  bookmarkBtn: {
    width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },

  // Promo Pills
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  pillText: { fontSize: 12, fontWeight: '700' },

  deliveryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  deliveryText: { fontSize: 12 },

  // v1.26.6: Hairline-Divider statt 8px-Block (TikTok-Style auf weißem bg)
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  // Seller
  sellerCard: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
  sellerInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  sellerAvatar: { width: 46, height: 46, borderRadius: 23 },
  sellerInfo: { flex: 1, gap: 3 },
  sellerName: { fontSize: 14, fontWeight: '700' },
  sellerSub: { fontSize: 11 },
  // v1.26.5: Chat-Icon-Circle neben dem Shop-Pill
  sellerChatBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  sellerShopBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  sellerShopText: { fontSize: 12, fontWeight: '600' },

  // Section
  section: { paddingHorizontal: 16, paddingVertical: 16, gap: 12 },
  sectionLabel: { fontSize: 14, fontWeight: '600' },

  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10, borderWidth: 1 },
  chipText: { fontSize: 11, fontWeight: '600' },
  title: { fontSize: 18, fontWeight: '600', lineHeight: 25 },

  // Stock
  stockBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
  stockFill: { height: 6, borderRadius: 3 },
  stockLabel: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

  // Buy Bar
  buyBar: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingTop: 10, paddingHorizontal: 16, borderTopWidth: StyleSheet.hairlineWidth },
  buyBarInner: { flexDirection: 'row', gap: 10, alignItems: 'center' },

  // Qty-Stepper-Zeile (über den Buttons)
  qtyRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingBottom: 10,
  },
  qtyLabel: { fontSize: 12, fontWeight: '700' },
  qtyStepper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderRadius: 22,
    paddingHorizontal: 4, paddingVertical: 4, gap: 0,
  },
  qtyBtn: {
    width: 30, height: 30, borderRadius: 15,
    alignItems: 'center', justifyContent: 'center',
  },
  qtyNum: {
    minWidth: 28, textAlign: 'center',
    fontSize: 14, fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },

  // Merken-Circle (klein, links) + Big Buy-Button (rechts)
  saveCircle: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  cartBtn: { flex: 1, height: 52, borderRadius: 26, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  cartBtnText: { fontSize: 14, fontWeight: '700' },
  buyBtn: {
    flex: 1, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  buyBtnText: { fontSize: 15, fontWeight: '600' },

  // Split-Layout im Buy-Button: [Preis-Pill] [|] [Jetzt kaufen]
  buyBtnSplit: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, gap: 12, flex: 1,
  },
  buyPricePill: {
    flexDirection: 'row', alignItems: 'center',
  },
  buyPriceText: {
    fontSize: 15, fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  buyDivider: {
    width: StyleSheet.hairlineWidth, height: 20,
  },
  buyCtaText: {
    fontSize: 15, fontWeight: '600', letterSpacing: 0.2,
  },

  // Confirm
  confirmProduct: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 12 },
  confirmThumb: { width: 60, height: 60, borderRadius: 12 },
  confirmBalance: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  confirmCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 26, borderWidth: 1, alignItems: 'center' },
  confirmBuyBtn: { flex: 1.6, paddingVertical: 15, borderRadius: 26, alignItems: 'center' },

  // Toast
  toast: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 16 },
  toastText: { flex: 1, fontSize: 13, fontWeight: '600' },
});
