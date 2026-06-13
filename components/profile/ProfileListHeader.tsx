import type { Profile } from '@/lib/authStore';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { BarChart,BarChart2,Bookmark,CheckCircle2,ChevronRight,Edit3,FileText,Flower2,Grid3X3,Link,MoreHorizontal,Mountain,Package,Repeat2,Share2,Shield,ShoppingBag,Sparkles,Swords,Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Linking,Modal,Pressable,Text,View } from 'react-native';

import { ProfileShareSheet } from '@/components/profile/ProfileShareSheet';
import { AvatarZoomViewer } from '@/components/ui/AvatarZoomViewer';
import { useBattleStats } from '@/lib/useBattleStats';
import { useTheme } from '@/lib/useTheme';
import { ProfileHighlightsRow } from './ProfileHighlightsRow';
import { getProfileStyles } from './profileStyles';
import type { ProfileTab } from './types';

// ─── Tools Bottom-Sheet mit Menü-Einträgen (Instagram/TikTok Pattern) ──────────
function MenuRow({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  sub,
  onPress,
}: {
  icon: any; iconColor: string; iconBg: string;
  label: string; sub?: string; onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPress(); }}
      style={({ pressed }) => [msx.menuRow, pressed && { backgroundColor: 'rgba(255,255,255,0.04)' }]}
    >
      <View style={[msx.menuIcon, { backgroundColor: iconBg }]}>
        <Icon size={18} color={iconColor} strokeWidth={1.8} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={msx.menuLabel}>{label}</Text>
        {sub ? <Text style={msx.menuSub}>{sub}</Text> : null}
      </View>
      <ChevronRight size={16} color="rgba(255,255,255,0.2)" />
    </Pressable>
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

        {/* Coins — gleich große Icon-Button wie Tools (einheitliche Reihe) */}
        {onBuyCoins && (
          <Pressable
            style={({ pressed }) => [msx.iconBtn, { backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.subtle, borderRadius: 14 }, pressed && { opacity: 0.6 }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onBuyCoins(); }}
            accessibilityLabel="Coins kaufen"
          >
            <Image source={require('@/assets/borz-coin.png')} style={{ width: 22, height: 22 }} contentFit="contain" />
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
        <View style={msx.sheet}>
          {/* Handle */}
          <View style={msx.handle} />
          <Text style={msx.sheetTitle}>Tools</Text>

          {/* Shop-Bereich */}
          {hasShopTools && (
            <>
              <Text style={msx.sectionLabel}>🛍️ Shop</Text>
              {onMyShop && (
                <MenuRow
                  icon={Package} iconColor="#A855F7" iconBg="rgba(168,85,247,0.12)"
                  label="Mein Shop" sub="Produkte verwalten & erstellen"
                  onPress={() => { setToolsOpen(false); onMyShop(); }}
                />
              )}
              {onSavedProducts && (
                <MenuRow
                  icon={Bookmark} iconColor="#1D9BF0" iconBg="rgba(29,155,240,0.12)"
                  label="Gespeicherte Produkte" sub="Merkliste anzeigen"
                  onPress={() => { setToolsOpen(false); onSavedProducts(); }}
                />
              )}
              {onMyOrders && (
                <MenuRow
                  icon={ShoppingBag} iconColor="#F59E0B" iconBg="rgba(245,158,11,0.12)"
                  label="Bestellungen & Verkäufe" sub="Käufe und Einnahmen"
                  onPress={() => { setToolsOpen(false); onMyOrders(); }}
                />
              )}
            </>
          )}

          {/* Creator-Bereich */}
          {hasCreatorTools && (
            <>
              <Text style={[msx.sectionLabel, hasShopTools && { marginTop: 8 }]}>⚡ Creator</Text>
              {onCreatorStudio && (
                <MenuRow
                  icon={Sparkles} iconColor="#A855F7" iconBg="rgba(168,85,247,0.12)"
                  label="Creator Studio" sub="Live-Einstellungen, Duet & mehr"
                  onPress={() => { setToolsOpen(false); onCreatorStudio(); }}
                />
              )}
              {onCreatorStats && (
                <MenuRow
                  icon={BarChart} iconColor="#22C55E" iconBg="rgba(34,197,94,0.12)"
                  label="Creator Dashboard" sub="Statistiken, Follower & Einnahmen"
                  onPress={() => { setToolsOpen(false); onCreatorStats(); }}
                />
              )}
            </>
          )}

          <View style={{ height: 24 }} />
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
    backgroundColor: '#141419',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingTop: 12,
    borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  handle: {
    alignSelf: 'center' as const, width: 36, height: 4,
    borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)', marginBottom: 14,
  },
  sheetTitle: {
    color: '#fff', fontSize: 16, fontWeight: '700' as const,
    letterSpacing: 0.2, marginBottom: 12,
  },
  sectionLabel: {
    color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700' as const,
    letterSpacing: 0.6, textTransform: 'uppercase' as const,
    marginBottom: 4, marginTop: 4, paddingHorizontal: 4,
  },
  menuRow: {
    flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 14,
  },
  menuIcon: {
    width: 40, height: 40, borderRadius: 12,
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  menuLabel: { color: '#fff', fontSize: 15, fontWeight: '600' as const },
  menuSub: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 1 },
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
  avgDwell,
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
  avgDwell: number;
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
  // Nur anzeigen wenn der User schon mal an einem Battle teilgenommen hat — sonst Clutter.
  const { data: battleStats } = useBattleStats(profile?.id);
  const showBattleStats = !!battleStats && battleStats.totalBattles > 0;

  return (
    <>
      <AvatarZoomViewer
        visible={avatarZoomed}
        avatarUrl={profile?.avatar_url}
        initials={avatarInitial}
        onClose={() => setAvatarZoomed(false)}
      />
      {/* ── Avatar + Info (Instagram-Style) ── */}
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
          <Text style={s.displayName} numberOfLines={1}>{profile?.display_name ?? `@${profile?.username ?? '…'}`}</Text>
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
        {profile?.display_name ? (
          <Text style={{ color: colors.text.muted, fontSize: 13 }}>@{profile.username}</Text>
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

        {/* Konsolidierte Meta-Zeile: ein Icon-System, dezent (Resonanz · Battle · Teip · WOZ) */}
        <View style={s.metaRow}>
          <View style={s.metaItem}>
            <Zap size={12} color={colors.text.muted} strokeWidth={2} />
            <Text style={s.metaText}>{loadingPosts ? '…' : `${avgDwell}%`} Resonanz</Text>
          </View>
          {showBattleStats && battleStats && (
            <View style={s.metaItem}>
              <Swords size={12} color={colors.text.muted} strokeWidth={2} />
              <Text style={s.metaText}>
                {battleStats.wins}–{battleStats.losses}
                {battleStats.winRate !== null && battleStats.totalBattles >= 3 ? ` · ${battleStats.winRate}%` : ''}
              </Text>
            </View>
          )}
          {profile?.teip ? (
            <View style={s.metaItem}>
              <Mountain size={12} color={colors.text.muted} strokeWidth={2} />
              <Text style={s.metaText}>{profile.teip}</Text>
            </View>
          ) : null}
          {profile?.women_only_verified ? (
            <View style={s.metaItem}>
              <Flower2 size={12} color="#F472B6" strokeWidth={2} />
              <Text style={s.metaText}>Women-Only</Text>
            </View>
          ) : null}
        </View>
      </View>



      {/* ── Action-Buttons (Instagram-Style: 3 Primär + Tools-Menu) ── */}
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

      {/* ── Tab-Bar ── */}
      <View style={s.tabRow}>
        {((showBattleStats
            ? ['vibes', 'saved', 'shop', 'analytics', 'drafts', 'reposts', 'battles']
            : ['vibes', 'saved', 'shop', 'analytics', 'drafts', 'reposts']) as ProfileTab[]
        ).map((tab) => {
          const active = activeTab === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onTabChange(tab);
              }}
              style={[s.tabBtn, active && s.tabBtnActive]}
            >
              {tab === 'vibes' ? (
                <Grid3X3 size={24} color={active ? colors.accent.primary : colors.icon.inactive} strokeWidth={2} />
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
      </View>
    </>
  );
}
