import type { Profile } from '@/lib/authStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft,BarChart,BarChart2,Bookmark,CheckCircle2,ChevronRight,Edit3,FileText,Flower2,Grid3X3,Heart,Link,Package,Repeat2,Share2,Shield,ShoppingBag,Sparkles,Star,Swords,X } from 'lucide-react-native';
import { useState } from 'react';
import { Linking,Modal,Pressable,ScrollView,Text,View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';


import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { AvatarZoomViewer } from '@/components/ui/AvatarZoomViewer';
import { useBattleStats } from '@/lib/useBattleStats';
import { useOrderRating } from '@/lib/useShop';
import { useTheme } from '@/lib/useTheme';
import { useI18n, type TranslationKey } from '@/lib/i18n';
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
      accessibilityRole="button"
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

function ProfileActionRow({ profile, colors, onEditProfile, onBuyCoins, onMyShop, onSavedProducts, onMyOrders, onCreatorStudio, onCreatorStats, onTabChange, showBattles }: {
  profile: Profile | null; colors: any; onEditProfile: () => void; onBuyCoins?: () => void;
  onMyShop?: () => void; onSavedProducts?: () => void; onMyOrders?: () => void;
  onCreatorStudio?: () => void; onCreatorStats?: () => void; onTabChange: (tab: ProfileTab) => void; showBattles: boolean;
}) {
  const { t } = useI18n(); const insets = useSafeAreaInsets();
  const [toolsOpen, setToolsOpen] = useState(false); const [shareOpen, setShareOpen] = useState(false);
  const openTab = (tab: ProfileTab) => { setToolsOpen(false); onTabChange(tab); };
  return <>
    <View style={msx.row}>
      <Pressable accessibilityRole="button" style={[msx.primaryBtn, { backgroundColor: colors.text.primary }]} onPress={onEditProfile}><Edit3 size={15} color={colors.bg.primary} /><Text style={[msx.primaryText, { color: colors.bg.primary, flexShrink: 1 }]}>{t('profile.editProfile')}</Text></Pressable>
      <Pressable accessibilityRole="button" style={[msx.secondaryBtn, { borderColor: colors.border.strong }]} onPress={() => setShareOpen(true)}><Share2 size={15} color={colors.text.primary} /><Text style={[msx.secondaryText, { color: colors.text.primary, flexShrink: 1 }]}>{t('profile.share')}</Text></Pressable>
    </View>
    <Pressable accessibilityRole="button" onPress={() => setToolsOpen(true)} style={{ marginHorizontal: 16, marginTop: 8, marginBottom: 6, minHeight: 48, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.bg.elevated, borderRadius: 14, borderWidth: 1, borderColor: colors.border.default }}>
      <Sparkles size={18} color={colors.accent.primary} /><Text style={{ flex: 1, color: colors.text.primary, fontSize: 14, fontWeight: '600' }}>{t('ux.studioTools')}</Text><ChevronRight size={18} color={colors.icon.muted} />
    </Pressable>
    {profile?.id && <ProfileShareSheet visible={shareOpen} onClose={() => setShareOpen(false)} userId={profile.id} username={profile.username} avatarUrl={profile.avatar_url} isOwnProfile />}
    <Modal visible={toolsOpen} transparent animationType="slide" onRequestClose={() => setToolsOpen(false)}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} onPress={() => setToolsOpen(false)} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} />
        <View accessibilityViewIsModal style={[msx.sheet, { maxHeight: '85%', backgroundColor: colors.bg.secondary, borderColor: colors.border.strong, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[msx.handle, { backgroundColor: colors.border.strong }]} />
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}><Text style={[msx.sheetTitle, { color: colors.text.primary, flex: 1, marginBottom: 0 }]}>{t('ux.studioTools')}</Text><Pressable onPress={() => setToolsOpen(false)} accessibilityRole="button" accessibilityLabel={t('mobileDesign.close')} style={{ padding: 12 }}><X size={22} color={colors.text.primary} /></Pressable></View>
          <ScrollView contentContainerStyle={{ gap: 18, paddingBottom: 12 }}>
            <ToolSection title={t('ux.yourActivity')} colors={colors} items={[
              { icon: Heart, tint: '', label: t('nativeUi.likes'), onPress: () => openTab('likes') },
              { icon: FileText, tint: '', label: t('nativeUi.drafts'), onPress: () => openTab('drafts') },
              { icon: BarChart2, tint: '', label: t('nativeUi.analytics'), onPress: () => openTab('analytics') },
              ...(showBattles ? [{ icon: Swords, tint: '', label: t('nativeUi.battles'), onPress: () => openTab('battles') }] : []),
            ]} />
            <ToolSection title={t('tabs.shop')} colors={colors} items={[
              onMyShop && { icon: Package, tint: '', label: t('profile.myShop'), onPress: () => { setToolsOpen(false); onMyShop(); } },
              onSavedProducts && { icon: Bookmark, tint: '', label: t('profile.savedProducts'), onPress: () => { setToolsOpen(false); onSavedProducts(); } },
              onMyOrders && { icon: ShoppingBag, tint: '', label: t('profile.ordersSales'), onPress: () => { setToolsOpen(false); onMyOrders(); } },
              onBuyCoins && { icon: Star, tint: '', label: t('ux.buyCoins'), onPress: () => { setToolsOpen(false); onBuyCoins(); } },
            ].filter(Boolean) as ToolItem[]} />
            <ToolSection title={t('profile.creatorStudio')} colors={colors} items={[
              onCreatorStudio && { icon: Sparkles, tint: '', label: t('profile.creatorStudio'), onPress: () => { setToolsOpen(false); onCreatorStudio(); } },
              onCreatorStats && { icon: BarChart, tint: '', label: t('profile.creatorDashboard'), onPress: () => { setToolsOpen(false); onCreatorStats(); } },
            ].filter(Boolean) as ToolItem[]} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}

const msx = {
  row: {
    flexDirection: 'row' as const,
    gap: 8, paddingHorizontal: 16, marginBottom: 4,
  },
  primaryBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 6,
    minHeight: 44, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
  },
  primaryText: { fontSize: 13, fontWeight: '600' as const },
  secondaryBtn: {
    flex: 1, flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'center' as const, gap: 6,
    minHeight: 44, paddingVertical: 10, paddingHorizontal: 8, borderRadius: 12,
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
  const { t } = useI18n();
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
  const realName = profile?.display_name?.trim() ?? '';
  const displayName = realName
    || (uname ? uname.charAt(0).toUpperCase() + uname.slice(1) : '…');
  // @handle nur zeigen, wenn ein echter Anzeigename existiert. Ohne Anzeigename
  // IST der große Name schon der (kapitalisierte) Username → die separate
  // „@zaur"-Zeile wäre reine Dopplung/Platzverschwendung.
  const showHandle = !!realName && !!uname;

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
                ? [colors.accent.primary, colors.accent.secondary]   // Silver ring marks unseen stories.
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
                <LinearGradient colors={[colors.bg.elevated, colors.bg.input]} style={s.avatarFallback}>
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
            <Text style={s.statLabel}>{t('profile.posts')}</Text>
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
            <Text style={s.statLabel}>{t('profile.followers')}</Text>
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
            <Text style={s.statLabel}>{t('profile.followingCount')}</Text>
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
        {showHandle ? (
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

        {/* Identitäts-Chips: nur echte Signale (Women-Only · Battle-Bilanz).
            Teip/Clan entfernt (Zaur-Wunsch — keine Pflichtangabe, nicht auf dem
            öffentlichen Profil). „Resonanz" (avgDwell) entfernt — interner
            Creator-Jargon. Battle nur bei echter Bilanz (sonst sah „0–0 · 0%"
            leer/kaputt aus). */}
        {(profile?.women_only_verified || showBattleRecord) ? (
          <View style={s.metaRow}>
            {profile?.women_only_verified ? (
              <View style={[s.metaChip, { backgroundColor: 'rgba(244,114,182,0.12)', borderColor: 'rgba(244,114,182,0.3)' }]}>
                <Flower2 size={13} color="#F472B6" strokeWidth={2} />
                <Text style={[s.metaChipText, { color: '#F472B6' }]}>{t('profile.womenOnly')}</Text>
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
                <Text style={{ fontSize: 12.5, color: colors.text.muted }}>{t('profile.asSeller', { count: orderRating.sellerCount })}</Text>
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
        onTabChange={onTabChange}
        showBattles={showBattleTab}
      />

      {/* ── Story Highlights ── */}
      <ProfileHighlightsRow userId={profile?.id ?? null} isOwn />

      <View style={[s.tabRow, { flexDirection: 'row' }]}>
        {([{ tab: 'vibes', Icon: Grid3X3, label: t('nativeUi.posts') }, { tab: 'reposts', Icon: Repeat2, label: t('nativeUi.reposts') }, { tab: 'saved', Icon: Bookmark, label: t('nativeUi.saved') }, { tab: 'shop', Icon: ShoppingBag, label: t('tabs.shop') }] as const).map(({ tab, Icon, label }) =>
          <Pressable key={tab} onPress={() => onTabChange(tab)} accessibilityRole="tab" accessibilityState={{ selected: activeTab === tab }} accessibilityLabel={label}
            style={[s.tabBtn, { flex: 1, minWidth: 0, paddingHorizontal: 2 }, activeTab === tab && s.tabBtnActive]}>
            <Icon size={22} color={activeTab === tab ? colors.accent.primary : colors.icon.inactive} />
            <Text numberOfLines={2} style={[s.tabLabel, { color: activeTab === tab ? colors.accent.primary : colors.text.secondary, textAlign: 'center' }]}>{label}</Text>
          </Pressable>)}
      </View>
      {!['vibes', 'reposts', 'saved', 'shop'].includes(activeTab) && <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12, backgroundColor: colors.bg.elevated }}>
        <Pressable onPress={() => onTabChange('vibes')} accessibilityRole="button" accessibilityLabel={t('ux.backToPosts')} style={{ minHeight: 52, justifyContent: 'center', paddingRight: 12 }}><ArrowLeft size={22} color={colors.accent.primary} /></Pressable>
        <Text accessibilityRole="header" style={{ color: colors.text.primary, fontSize: 17, fontWeight: '600', flex: 1 }}>{t(`nativeUi.${activeTab}` as TranslationKey)}</Text>
      </View>}

    </>
  );
}
