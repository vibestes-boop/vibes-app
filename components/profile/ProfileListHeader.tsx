import { View, Text, Pressable, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Grid3X3, Bookmark, Share2, Edit3, Shield, BarChart2, FileText, Repeat2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import type { Profile } from '@/lib/authStore';
import { shareUser } from '@/lib/useShare';
import { profileStyles as s } from './profileStyles';
import type { ProfileTab } from './types';
import { ProfileHighlightsRow } from './ProfileHighlightsRow';

const { width: W } = Dimensions.get('window');

export function ProfileListHeader({
  profile,
  followCounts,
  hasStories,
  hasUnviewedStories,
  onAvatarPress,
  onEditProfile,
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
  onAvatarPress: () => void;
  onEditProfile: () => void;
  avatarInitial: string;
  avgDwell: number;
  postCount: number;
  loadingPosts: boolean;
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
}) {
  const formatCount = (n: number) =>
    n >= 1000000 ? `${(n / 1000000).toFixed(1)}M`
    : n >= 1000 ? `${(n / 1000).toFixed(1)}K`
    : String(n);

  return (
    <>
      {/* ── Avatar + Info (Instagram-Style) ── */}
      <View style={s.profileTop}>
        {/* Avatar */}
        <Pressable onPress={onAvatarPress} disabled={!hasStories} style={s.avatarWrap}>
          <LinearGradient
            colors={
              hasStories && hasUnviewedStories
                ? ['#22D3EE', '#A78BFA', '#F472B6']
                : ['rgba(255,255,255,0.15)', 'rgba(255,255,255,0.05)']
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
          {/* Story-Indikator */}
          {hasStories && (
            <View style={[s.storyDot, hasUnviewedStories && s.storyDotActive]} />
          )}
        </Pressable>

        {/* Stats-Reihe */}
        <View style={s.statsRow}>
          <View style={s.statItem}>
            <Text style={s.statNum}>{loadingPosts ? '–' : formatCount(postCount)}</Text>
            <Text style={s.statLabel}>Vibes</Text>
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
        <View style={s.nameRow}>
          <Text style={s.displayName}>
            {profile?.username ?? '…'}
          </Text>
          {profile?.guild_id && (
            <View style={s.verifiedBadge}>
              <Shield size={10} color="#22D3EE" strokeWidth={2.5} />
            </View>
          )}
        </View>
        {profile?.bio ? (
          <Text style={s.bio} numberOfLines={3}>{profile.bio}</Text>
        ) : null}

        {/* Vibescore / Resonanz */}
        <View style={s.resonanzChip}>
          <Text style={s.resonanzDot}>⚡</Text>
          <Text style={s.resonanzText}>
            {loadingPosts ? '…' : `${avgDwell}% Resonanz`}
          </Text>
        </View>
      </View>

      {/* ── Action-Buttons ── */}
      <View style={s.actionRow}>
        <Pressable
          style={s.btnPrimary}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onEditProfile();
          }}
        >
          <Edit3 size={14} color="#000" strokeWidth={2.5} />
          <Text style={s.btnPrimaryText}>Profil bearbeiten</Text>
        </Pressable>
        <Pressable
          style={s.btnSecondary}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (profile?.id) shareUser(profile.id, profile.username);
          }}
        >
          <Share2 size={16} color="#fff" strokeWidth={2} />
        </Pressable>
      </View>

      {/* ── Story Highlights ── */}
      <ProfileHighlightsRow userId={profile?.id ?? null} isOwn />

      {/* ── Tab-Bar ── */}
      <View style={s.tabRow}>
        {(['vibes', 'saved', 'analytics', 'drafts', 'reposts'] as const).map((tab) => {
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
                <Grid3X3 size={24} color={active ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} />
              ) : tab === 'saved' ? (
                <Bookmark size={24} color={active ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} fill={active ? '#22D3EE' : 'transparent'} />
              ) : tab === 'analytics' ? (
                <BarChart2 size={24} color={active ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} />
              ) : tab === 'drafts' ? (
                <FileText size={24} color={active ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} />
              ) : (
                <Repeat2 size={24} color={active ? '#22D3EE' : 'rgba(255,255,255,0.65)'} strokeWidth={2} />
              )}
            </Pressable>
          );
        })}
      </View>
    </>
  );
}
