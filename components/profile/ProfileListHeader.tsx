import type { Profile } from '@/lib/authStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BarChart,BarChart2,Bookmark,CheckCircle2,ChevronRight,Edit3,FileText,Flower2,Grid3X3,Heart,Link,MoreHorizontal,Mountain,Package,Repeat2,Share2,Shield,ShoppingBag,Sparkles,Star,Swords } from 'lucide-react-native';
import { useState } from 'react';
import { Dimensions,Linking,Modal,Pressable,ScrollView,Text,View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Fixe Tab-Breite: 5 Tabs füllen die Zeile, weitere scrollen horizontal —
// skaliert für die wachsende Tab-Zahl (Parität durch Ergänzen).
const TAB_WIDTH = Dimensions.get('window').width / 5;

import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { AvatarZoomViewer } from '@/components/ui/AvatarZoomViewer';
import { useBattleStats } from '@/lib/useBattleStats';
import { useOrderRating } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { ProfileHighlightsRow } from './ProfileHighlightsRow';
import { getProfileStyles } from './profileStyles';
import type { ProfileTab } from './types';

// ─── Tools Bottom-Sheet mit Menü-Einträgen (Foto-Feed/Short-Video Pattern) ──────────
type ToolItem = {
  icon: any; tint: string;
  label: string; sub?: string; onPress: () => void;
};

function MenuRow({
  item, colors, showDivider,
}: {
  item: ToolItem; colors: any; showDivider: boolean;
}) {
  const { icon: Icon, label, sub, onPress } = item;
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [
        msx.menuRow,
        showDivider && { borderTopWidth: 1, borderTopColor: colors.border.subtle },
        pressed && { backgroundColor: colors.bg.subtle },
      ]}
    >
      <View style={msx.menuIcon}>
        <Icon size={24} color={colors.text.primary} strokeWidth={2} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[msx.menuLabel, { color: colors.text.primary }]}>{label}</Text>
        {sub ? <Text style={[msx.menuSub, { color: colors.text.secondary }]}>{sub}</Text> : null}
      </View>
      <ChevronRight size={18} color={colors.text.muted} strokeWidth={2} />
    </Pressable>
  );
}

function ToolSection({
  title, items, colors, style,
}: {
  title: string; items: ToolItem[]; colors: any; style?: any;
}) {
  if (items.length === 0) return null;
  return (
    <View style={style}>
      <Text style={[msx.sectionLabel, { color: colors.text.muted }]}>{title}</Text>
      <View style={[msx.card, { backgroundColor: colors.bg.elevated, borderColor: colors.border.subtle }]}>
        {items.map((item, i) => (
          <MenuRow key={item.label} item={item} colors={colors} showDivider={i > 0} />
        ))}
      </View>
    </View>
  );
}

function ProfileActionRow({
  profile, colors,
  onEditProfile, onBuyCoins, onMyShop,
  onSavedProducts, onMyOrders, onCreatorStudio, onCreatorStats,
}: {
  profile: Profile | null; colors: any;
  onEditProfile: () => void; onBuyCoins?: () => void;
  onMyShop?: () => void; onSavedProducts?: () => void;
  onMyOrders?: () => void; onCreatorStudio?: () => void; onCreatorStats?: () => void;
}) {
  const [toolsOpen, setToolsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const hasShopTools = !!(onMyShop || onSavedProducts || onMyOrders);
  const hasCreatorTools = !!(onCreatorStudio || onCreatorStats);
  const hasTools = hasShopTools || hasCreatorTools;

  return (
    <>
      {/* ── 3 Primär-Buttons + Tools-Button ─────────────────────────── */}
      <View style={msx.row}>
        {/* Edit — gefüllter Primär-Button (Theme-invertiert: dunkel→hell/hell→dunkel) */}
        <Pressable
          style={({ pressed }) => [msx.primaryBtn, { backgroundColor: colors.text.primary, borderColor: 'transparent' }, pressed && { opacity: 0.8 }]}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEditProfile(); }}
        >
          <Edit3 size={14} color={colors.bg.primary} strokeWidth={2.5} />
          <Text style={[msx.primaryText, { color: colors.bg.primary }]}>Profil bearbeiten</Text>
        </Pressable>

        {/* Teilen — Outline */}
        <Pressable
          style={({ pressed }) => [msx.secondaryBtn, { backgroundColor: 'transparent', borderColor: colors.border.strong }, pressed && { opacity: 0.75 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShareOpen(true);
          }}
        >
          <Share2 size={14} color={colors.text.primary} strokeWidth={2} />
          <Text style={[msx.secondaryText, { color: colors.text.primary }]}>Teilen</Text>
        </Pressable>

        {/* ProfileShareSheet für eigenes Profil */}
        {profile?.id && (
          <ProfileShareSheet
            visible={shareOpen}
            onClose={() => setShareOpen(false)}
            userId={profile.id}
            username={profile.username}
            avatarUrl={profile.avatar_url}
            isOwnProfile
          />
        )}

        {/* Coins — randlos, damit die Münze größer wirkt (wie im Shop-Header) */}
        {onBuyCoins && (
          <Pressable
            style={({ pressed }) => [msx.iconBtn, pressed && { opacity: 0.6 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBuyCoins(); }}
            accessibilityLabel="Coins kaufen"
          >
            <Image source={require('@/assets/serlo-coin.png')} style={{ width: 32, height: 32 }} contentFit="contain" />
          </Pressable>
        )}

        {/* ⋯ Tools — nur anzeigen wenn sekundäre Aktionen vorhanden */}
        {hasTools && (
          <Pressable
            style={({ pressed }) => [msx.iconBtn, pressed && { opacity: 0.6 },
              { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 14 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setToolsOpen(true); }}
            accessibilityLabel="Weitere Tools"
          >
            <MoreHorizontal size={20} color={colors.text.primary} />
          </Pressable>
        )}
      </View>

      {/* ── Bottom-Sheet Modal ──────────────────────────────────────── */}
      <Modal
        visible={toolsOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setToolsOpen(false)}
      >
        <Pressable style={msx.backdrop} onPress={() => setToolsOpen(false)} />
        <View style={[
          msx.sheet,
          { backgroundColor: colors.bg.secondary, borderColor: colors.border.subtle, paddingBottom: insets.bottom + 12 },
        ]}>
          <View style={[msx.handle, { backgroundColor: colors.border.strong }]} />
          <Text style={[msx.sheetTitle, { color: colors.text.primary }]}>Tools</Text>

          <ToolSection
            title="Shop"
            colors={colors}
            items={[
              onMyShop && {
                icon: Package, tint: colors.accent.secondary,
                label: 'Mein Shop', sub: 'Produkte verwalten & erstellen',
                onPress: () => { setToolsOpen(false); onMyShop(); },
              },
              onSavedProducts && {
                icon: Bookmark, tint: '#1D9BF0',
                label: 'Gespeicherte Produkte', sub: 'Merkliste anzeigen',
                onPress: () => { setToolsOpen(false); onSavedProducts(); },
              },
              onMyOrders && {
                icon: ShoppingBag, tint: colors.accent.warning,
                label: 'Bestellungen & Verkäufe', sub: 'Käufe und Einnahmen',
                onPress: () => { setToolsOpen(false); onMyOrders(); },
              },
            ].filter(Boolean) as ToolItem[]}
          />

          <ToolSection
            title="Creator"
            colors={colors}
            style={hasShopTools ? { marginTop: 18 } : undefined}
            items={[
              onCreatorStudio && {
                icon: Sparkles, tint: colors.accent.secondary,
                label: 'Creator Studio', sub: 'Live-Einstellungen, Duet & mehr',
                onPress: () => { setToolsOpen(false); onCreatorStudio(); },
              },
              onCreatorStats && {
                icon: BarChart, tint: colors.accent.success,
                label: 'Creator Dashboard', sub: 'Statistiken, Follower & Einnahmen',
                onPress: () => { setToolsOpen(false); onCreatorStats(); },
              },
            ].filter(Boolean) as ToolItem[]}
          />
        </View>
      </Modal>
    </>
  );
}

const msx = {
  row: {
    flexDirection: 'row' as const,
    gap: 8, paddingHorizontal: 16, marginBottom: 4,
  },
  primaryBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 6,
    height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  primaryText: { fontSize: 13, fontWeight: '600' as const },
  secondaryBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 6,
    height: 38, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  secondaryText: { fontSize: 13, fontWeight: '600' as const },
  iconBtn: {
    width: 38, height: 38,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 16, paddingTop: 10,
    borderTopWidth: 1,
  },
  handle: {
    alignSelf: 'center' as const, width: 40, height: 5,
    borderRadius: 3, marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 22, fontWeight: '600' as const,
    letterSpacing: -0.4, marginBottom: 18, paddingHorizontal: 2,
  },
  sectionLabel: {
    fontSize: 12, fontWeight: '700' as const,
    letterSpacing: 0.5, textTransform: 'uppercase' as const,
    marginBottom: 8, paddingHorizontal: 4,
  },
  card: {
    borderRadius: 18, borderWidth: 1, overflow: 'hidden' as const,
  },
  menuRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 14,
    paddingVertical: 13, paddingHorizontal: 14,
  },
  menuIcon: {
    width: 30,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  menuLabel: { fontSize: 15.5, fontWeight: '600' as const, letterSpacing: -0.1 },
  menuSub: { fontSize: 12.5, marginTop: 2 },
};

export function ProfileListHeader({
  profile,
  followCounts,
  hasStories,
  hasUnviewedStories,
  onAvatarPress,
  onCreateStory,
  onEditProfile,
  onBuyCoins,
  onMyShop,
  onSavedProducts,
  onCreatorStudio,
  onCreatorStats,
  onMyOrders,
  avatarInitial,
  postCount,
  loadingPosts,
  activeTab,
  onTabChange,
}: {
  profile: Profile | null;
  followCounts: { followers: number; following: number } | undefined;
  hasStories: boolean;
  hasUnviewedStories: boolean;
  onAvatarPress: () => void;  // → Stories ansehen
  onCreateStory: () => void;  // → Story erstellen (+ Badge)
  onEditProfile: () => void;
  onBuyCoins?: () => void;
  onMyShop?: () => void;
  onSavedProducts?: () => void;
  onCreatorStudio?: () => void;
  onCreatorStats?: () => void;
  onMyOrders?: () => void;
  avatarInitial: string;
  postCount: number;
  loadingPosts: boolean;
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const { colors } = useTheme();
  const s = getProfileStyles(colors);
  const [avatarZoomed, setAvatarZoomed] = useState(false);
  const formatCount = (n: number) =>
    n >= 1000000 ? `${(n / 1000000).toFixed(1)}M`
      : n >= 1000 ? `${(n / 1000).toFixed(1)}K`
        : String(n);

  // v1.16.0: Battle-Bilanz aus dem user_battle_stats View.
  // showBattleTab: der Battles-Tab erscheint sobald teilgenommen wurde.
  // showBattleRecord: der Bilanz-Chip nur bei echtem W/L — „0–0" sah kaputt aus.
  const { data: battleStats } = useBattleStats(profile?.id);
  const showBattleTab = !!battleStats && battleStats.totalBattles > 0;
  const showBattleRecord = !!battleStats && (battleStats.wins > 0 || battleStats.losses > 0);

  // Order-Reputation (Verkäufer-/Käufer-Bewertung) — Parität mit Web /u/[username]
  // und mit fremden Profilen (UserProfileContent). Nur zeigen wenn es Bewertungen gibt.
  const { data: orderRating } = useOrderRating(profile?.id);

  // Name-Hierarchie (TikTok-Muster): großer Name + kleiner @handle. Ohne
  // gesetzten Anzeigenamen fällt der Name auf den kapitalisierten Username
  // zurück (z. B. „Zaur") — verhindert das doppelte „@zaur" (oben im Header
  // UND hier), das ohne Anzeigename entstand. @handle steht immer klein drunter.
  const uname = profile?.username ?? '';
  const displayName = profile?.display_name?.trim()
    || (uname ? uname.charAt(0).toUpperCase() + uname.slice(1) : '…');

  return (
    <>
      <AvatarZoomViewer
        visible={avatarZoomed}
        avatarUrl={profile?.avatar_url}
        initials={avatarInitial}
        onClose={() => setAvatarZoomed(false)}
      />
      {/* ── Avatar + Info (Foto-Feed-Style) ── */}
      <View style={s.profileTop}>
        {/* Avatar — Klick = Stories ansehen */}
        <Pressable
          onPress={hasStories ? onAvatarPress : undefined}
          onLongPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setAvatarZoomed(true);
          }}
          delayLongPress={350}
          style={s.avatarWrap}
        >
          <LinearGradient
            colors={
              hasStories && hasUnviewedStories
                ? ['#F472B6', '#A855F7']                          // Pink → Lila (ungesehen) — sichtbar auf hell + dunkel
                : hasStories
                  ? ['#9CA3AF', '#6B7280']                        // Grau (gesehen) — sichtbar auf hell + dunkel
                  : ['rgba(120,120,120,0.15)', 'rgba(120,120,120,0.05)'] // fast unsichtbar (keine Stories)
            }
            style={s.avatarRing}
            start={{ x: 0, y: 1 }}
            end={{ x: 1, y: 0 }}
          >
            <View style={s.avatarGap}>
              {profile?.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} style={s.avatarImg} />
              ) : (
                <LinearGradient colors={['#0e4a58', '#083344']} style={s.avatarFallback}>
                  <Text style={s.avatarInitial}>{avatarInitial}</Text>
                </LinearGradient>
              )}
            </View>
          </LinearGradient>
          {/* "+" Badge — eigener Pressable, immer sichtbar → Story erstellen */}
          <Pressable
            onPress={(e) => { e.stopPropagation?.(); onCreateStory(); }}
            style={s.storyAddBadge}
            hitSlop={6}
          >
            <Text style={s.storyAddBadgeText}>+</Text>
          </Pressable>
        </Pressable>

        {/* Stats-Reihe */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{loadingPosts ? '–' : formatCount(postCount)}</Text>
            <Text style={s.statLabel}>Posts</Text>
          </View>
          <View style={s.statDivider} />
          <Pressable
            style={s.statItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (profile?.id) router.push({
                pathname: '/follow-list',
                params: { userId: profile.id, mode: 'followers', username: profile.username },
              });
            }}
          >
            <Text style={s.statNum}>{formatCount(followCounts?.followers ?? 0)}</Text>
            <Text style={s.statLabel}>Follower</Text>
          </Pressable>
          <View style={s.statDivider} />
          <Pressable
            style={s.statItem}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (profile?.id) router.push({
                pathname: '/follow-list',
                params: { userId: profile.id, mode: 'following', username: profile.username },
              });
            }}
          >
            <Text style={s.statNum}>{formatCount(followCounts?.following ?? 0)}</Text>
            <Text style={s.statLabel}>Following</Text>
          </Pressable>
        </View>
      </View>

      {/* ── Name + Bio ── */}
      <View style={s.bioSection}>
        {/* Name-Hierarchie wie Web: Anzeigename groß + @username dezent. Ein Badge,
            neutrale Farbe (text.primary) — konsistent mit Web (fill-foreground). */}
        <View style={s.nameRow}>
          <Text style={s.displayName} numberOfLines={1}>{displayName}</Text>
          {profile?.is_verified ? (
            <View style={s.verifiedBadge}>
              <CheckCircle2 size={13} color={colors.text.primary} strokeWidth={2.5} />
            </View>
          ) : profile?.guild_id ? (
            <View style={s.verifiedBadge}>
              <Shield size={11} color={colors.text.secondary} strokeWidth={2.5} />
            </View>
          ) : null}
        </View>
        {uname ? (
          <Text style={{ color: colors.text.muted, fontSize: 13 }}>@{uname}</Text>
        ) : null}

        {profile?.bio ? (
          <Text style={s.bio} numberOfLines={3}>{profile.bio}</Text>
        ) : null}
        {profile?.website ? (
          <Pressable
            onPress={() => {
              const url = profile.website!;
              const full = url.startsWith('http') ? url : `https://${url}`;
              Linking.openURL(full).catch(() => { });
            }}
            style={s.websiteRow}
            hitSlop={8}
          >
            <Link size={12} color={colors.accent.primary} strokeWidth={2} />
            <Text style={s.websiteText} numberOfLines={1}>
              {profile.website!.replace(/^https?:\/\//, '')}
            </Text>
          </Pressable>
        ) : null}

        {/* Identitäts-Chips: nur echte Signale (Teip · Women-Only · Battle-Bilanz).
            „Resonanz" (avgDwell) entfernt — interner Creator-Jargon, gehört in
            Analytics, nicht auf das öffentliche Profil. Battle nur bei echter
            Bilanz (sonst sah „0–0 · 0%" leer/kaputt aus). */}
        {(profile?.teip || profile?.women_only_verified || showBattleRecord) ? (
          <View style={s.metaRow}>
            {profile?.teip ? (
              <View style={s.metaChip}>
                <Mountain size={13} color={colors.text.secondary} strokeWidth={2} />
                <Text style={s.metaChipText}>{profile.teip}</Text>
              </View>
            ) : null}
            {profile?.women_only_verified ? (
              <View style={[s.metaChip, { backgroundColor: 'rgba(244,114,182,0.12)', borderColor: 'rgba(244,114,182,0.3)' }]}>
                <Flower2 size={13} color="#F472B6" strokeWidth={2} />
                <Text style={[s.metaChipText, { color: '#F472B6' }]}>Women-Only</Text>
              </View>
            ) : null}
            {showBattleRecord && battleStats ? (
              <View style={s.metaChip}>
                <Swords size={13} color={colors.text.secondary} strokeWidth={2} />
                <Text style={s.metaChipText}>
                  {battleStats.wins}–{battleStats.losses}
                  {battleStats.winRate !== null && battleStats.totalBattles >= 3 ? ` · ${battleStats.winRate}%` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Order-Reputation: Verkäufer-/Käufer-Bewertung (Parität mit Web + fremden Profilen) */}
        {orderRating && (orderRating.sellerCount > 0 || orderRating.buyerCount > 0) ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 }}>
            {orderRating.sellerCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Star size={14} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.primary }}>{orderRating.sellerAvg?.toFixed(1)}</Text>
                <Text style={{ fontSize: 12.5, color: colors.text.muted }}>als Verkäufer · {orderRating.sellerCount}</Text>
              </View>
            ) : null}
            {orderRating.buyerCount > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                <Star size={14} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text.primary }}>{orderRating.buyerAvg?.toFixed(1)}</Text>
                <Text style={{ fontSize: 12.5, color: colors.text.muted }}>als Käufer · {orderRating.buyerCount}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>



      {/* ── Action-Buttons (Foto-Feed-Style: 3 Primär + Tools-Menu) ── */}
      <ProfileActionRow
        profile={profile}
        colors={colors}
        onEditProfile={onEditProfile}
        onBuyCoins={onBuyCoins}
        onMyShop={onMyShop}
        onSavedProducts={onSavedProducts}
        onMyOrders={onMyOrders}
        onCreatorStudio={onCreatorStudio}
        onCreatorStats={onCreatorStats}
      />

      {/* ── Story Highlights ── */}
      <ProfileHighlightsRow userId={profile?.id ?? null} isOwn />

      {/* ── Tab-Bar (horizontal scrollbar — skaliert mit wachsender Tab-Zahl) ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.tabRow}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {((showBattleTab
            ? ['vibes', 'likes', 'saved', 'shop', 'analytics', 'drafts', 'reposts', 'battles']
            : ['vibes', 'likes', 'saved', 'shop', 'analytics', 'drafts', 'reposts']) as ProfileTab[]
        ).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTabChange(tab);
              }}
              style={[s.tabBtn, { width: TAB_WIDTH }, active && s.tabBtnActive]}
            >
              {tab === 'vibes' ? (
                <Grid3X3 size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
              ) : tab === 'likes' ? (
                <Heart size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} fill={active ? colors.accent.primary : 'transparent'} />
              ) : tab === 'saved' ? (
                <Bookmark size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} fill={active ? colors.accent.primary : 'transparent'} />
              ) : tab === 'analytics' ? (
                <BarChart2 size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
              ) : tab === 'drafts' ? (
                <FileText size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
              ) : tab === 'reposts' ? (
                <Repeat2 size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
              ) : tab === 'shop' ? (
                <ShoppingBag size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
              ) : (
                <Swords size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
              )}
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}
