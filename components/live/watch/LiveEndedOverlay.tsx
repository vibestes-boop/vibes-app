import { Image } from 'expo-image';
import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { LiveSession } from '@/lib/useLiveSession';

export function LiveEndedOverlay({
  session,
  isFollowing,
  isOwnProfile,
  onFollow,
  onBack,
  isReplay = false,
}: {
  session: LiveSession | null | undefined;
  isFollowing: boolean;
  isOwnProfile: boolean;
  onFollow: () => void;
  onBack: () => void;
  isReplay?: boolean;
}) {
  const insets = useSafeAreaInsets();
  // Auto-navigate nach 5s — nicht im Replay-Modus (User ist freiwillig hier)
  useEffect(() => {
    if (isReplay) return;
    const t = setTimeout(onBack, 5000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const host = session?.profiles;

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* Blurried Avatar als Hintergrund */}
      {host?.avatar_url ? (
        <Image
          source={{ uri: host.avatar_url }}
          style={StyleSheet.absoluteFill as any}
          contentFit="cover"
          blurRadius={28}
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a14' }]} />
      )}
      {/* Dunkles Dim-Overlay */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.72)' }]} />

      {/* Content */}
      <View style={[s2.endedContent, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        {/* Host Avatar */}
        <View style={s2.endedAvatarWrap}>
          {host?.avatar_url ? (
            <Image
              source={{ uri: host.avatar_url }}
              style={s2.endedAvatar}
              contentFit="cover"
            />
          ) : (
            <View style={[s2.endedAvatar, { backgroundColor: '#CCCCCC', alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#fff', fontSize: 36, fontWeight: '600' }}>
                {host?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <View style={s2.endedAvatarRing} />
        </View>

        <Text style={s2.endedUsername}>@{host?.username ?? 'User'}</Text>
        <Text style={s2.endedTitle}>hat das Live beendet</Text>
        <Text style={s2.endedSubtitle}>Danke für deine Teilnahme 💜</Text>

        {/* Stats */}
        <View style={s2.endedStats}>
          <View style={s2.endedStat}>
            <Text style={s2.endedStatNum}>{session?.viewer_count ?? 0}</Text>
            <Text style={s2.endedStatLabel}>Zuschauer</Text>
          </View>
          <View style={s2.endedStatDivider} />
          <View style={s2.endedStat}>
            <Text style={s2.endedStatNum}>{session?.like_count ?? 0}</Text>
            <Text style={s2.endedStatLabel}>Likes</Text>
          </View>
          <View style={s2.endedStatDivider} />
          <View style={s2.endedStat}>
            <Text style={s2.endedStatNum}>{session?.comment_count ?? 0}</Text>
            <Text style={s2.endedStatLabel}>Kommentare</Text>
          </View>
        </View>

        {/* Follow-Button */}
        {!isOwnProfile && !isFollowing && (
          <Pressable onPress={onFollow} style={s2.endedFollowBtn}>
            <Text style={s2.endedFollowText}>+ Folgen</Text>
          </Pressable>
        )}
        {!isOwnProfile && isFollowing && (
          <View style={[s2.endedFollowBtn, { backgroundColor: 'rgba(74,222,128,0.18)', borderColor: '#4ade80' }]}>
            <Text style={[s2.endedFollowText, { color: '#4ade80' }]}>✓ Du folgst bereits</Text>
          </View>
        )}

        {/* Zurück-Button */}
        <Pressable onPress={onBack} style={s2.endedBackBtn}>
          <Text style={s2.endedBackText}>Zurück zum Feed</Text>
        </Pressable>

        <Text style={s2.endedAutoClose}>Weiterleitung in 5 Sekunden …</Text>
      </View>
    </View>
  );
}

const s2 = StyleSheet.create({
  endedContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 32,
  },
  endedAvatarWrap: { position: 'relative', marginBottom: 8 },
  endedAvatar: {
    width: 110, height: 110, borderRadius: 55,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.3)',
  },
  endedAvatarRing: {
    position: 'absolute',
    top: -6, left: -6, right: -6, bottom: -6,
    borderRadius: 67,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endedUsername: { color: '#fff', fontSize: 18, fontWeight: '600', letterSpacing: 0.3 },
  endedTitle: { color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  endedSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  endedStats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  endedStat: { alignItems: 'center', gap: 3, minWidth: 70 },
  endedStatNum: { color: '#fff', fontSize: 22, fontWeight: '600' },
  endedStatLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: '600' },
  endedStatDivider: { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 8 },
  endedFollowBtn: {
    width: '100%',
    backgroundColor: '#EE1D52',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endedFollowText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  endedBackBtn: {
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  endedBackText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, fontWeight: '600' },
  endedAutoClose: { color: 'rgba(255,255,255,0.3)', fontSize: 12, marginTop: 4 },
});
