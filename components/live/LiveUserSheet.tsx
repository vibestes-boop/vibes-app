/**
 * LiveUserSheet.tsx
 * TikTok-Style Bottom Sheet: Öffnet sich wenn man auf einen Kommentar-User tippt.
 * Zeigt Profil-Info, Follow-Button, @ Erwähnen, Profil öffnen und User melden.
 * User bleibt dabei im Live-Stream — kein Navigation-Leave.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { UserPlus, UserCheck, AtSign, Flag, X, ExternalLink } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useFollow } from '@/lib/useFollow';

const { height: SCREEN_H } = Dimensions.get('window');

interface UserInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
}

interface Props {
  userId: string | null;            // null = Sheet geschlossen
  onClose: () => void;
  onMention?: (username: string) => void;  // @ Erwähnen im Chat
  onReport?: (userId: string) => void;     // User melden
}

export function LiveUserSheet({ userId, onClose, onMention, onReport }: Props) {
  const router = useRouter();
  const { profile: me } = useAuthStore();
  const { isFollowing, toggle: toggleFollow } = useFollow(userId);

  const [userInfo, setUserInfo]     = useState<UserInfo | null>(null);
  const [loading, setLoading]       = useState(false);

  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const isOpen = !!userId;
  const isOwnProfile = userId === me?.id;

  // Profil-Daten laden wenn Sheet öffnet
  useEffect(() => {
    if (!userId) { setUserInfo(null); return; }
    setLoading(true);
    supabase
      .from('profiles')
      .select('id, username, avatar_url, bio, follower_count, following_count')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setUserInfo(data as UserInfo ?? null);
        setLoading(false);
      });
  }, [userId]);

  // Sheet animieren rein/raus
  useEffect(() => {
    if (isOpen) {
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 4, speed: 18 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: SCREEN_H, duration: 240, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen, slideY, backdropOpacity]);

  const handleOpenProfile = useCallback(() => {
    onClose();
    router.push({ pathname: '/user/[id]' as any, params: { id: userId } });
  }, [onClose, router, userId]);

  const handleMention = useCallback(() => {
    if (userInfo?.username) {
      onMention?.(userInfo.username);
      onClose();
    }
  }, [userInfo, onMention, onClose]);

  const handleReport = useCallback(() => {
    if (userId) {
      onReport?.(userId);
      onClose();
    }
  }, [userId, onReport, onClose]);

  if (!isOpen && !userInfo) return null;

  return (
    <Modal transparent visible={isOpen} animationType="none" onRequestClose={onClose}>
      {/* Backdrop: tippen schließt Sheet */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Drag Handle */}
        <View style={s.handle} />

        {loading || !userInfo ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color="#22D3EE" />
          </View>
        ) : (
          <>
            {/* Header: Avatar + Info */}
            <View style={s.header}>
              {userInfo.avatar_url ? (
                <Image source={{ uri: userInfo.avatar_url }} style={s.avatar} contentFit="cover" />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}>
                  <Text style={s.avatarInitial}>{userInfo.username[0]?.toUpperCase()}</Text>
                </View>
              )}

              <View style={s.userInfo}>
                <Text style={s.username}>@{userInfo.username}</Text>
                {userInfo.bio ? (
                  <Text style={s.bio} numberOfLines={2}>{userInfo.bio}</Text>
                ) : null}
                <View style={s.statsRow}>
                  <Text style={s.stat}>
                    <Text style={s.statVal}>{fmt(userInfo.follower_count)}</Text>
                    {' '}Follower
                  </Text>
                  <Text style={s.statDot}>·</Text>
                  <Text style={s.stat}>
                    <Text style={s.statVal}>{fmt(userInfo.following_count)}</Text>
                    {' '}Following
                  </Text>
                </View>
              </View>
            </View>

            {/* Aktions-Buttons */}
            <View style={s.actions}>
              {/* Folgen / Entfolgen */}
              {!isOwnProfile && (
                <Pressable
                  style={[s.followBtn, isFollowing && s.followBtnActive]}
                  onPress={toggleFollow}
                >
                  {isFollowing
                    ? <UserCheck size={18} color="#22D3EE" strokeWidth={2.2} />
                    : <UserPlus size={18} color="#fff" strokeWidth={2.2} />
                  }
                  <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                    {isFollowing ? 'Gefolgt' : 'Folgen'}
                  </Text>
                </Pressable>
              )}

              {/* @ Erwähnen */}
              {onMention && (
                <Pressable style={s.iconBtn} onPress={handleMention}>
                  <AtSign size={20} color="#fff" strokeWidth={2} />
                  <Text style={s.iconBtnLabel}>Erwähnen</Text>
                </Pressable>
              )}

              {/* Profil öffnen */}
              <Pressable style={s.iconBtn} onPress={handleOpenProfile}>
                <ExternalLink size={20} color="#fff" strokeWidth={2} />
                <Text style={s.iconBtnLabel}>Profil</Text>
              </Pressable>

              {/* Melden */}
              {!isOwnProfile && (
                <Pressable style={[s.iconBtn, s.iconBtnDanger]} onPress={handleReport}>
                  <Flag size={20} color="#EF4444" strokeWidth={2} />
                  <Text style={[s.iconBtnLabel, s.iconBtnLabelDanger]}>Melden</Text>
                </Pressable>
              )}
            </View>
          </>
        )}

        {/* Close Button */}
        <Pressable style={s.closeBtn} onPress={onClose} hitSlop={12}>
          <X size={18} color="rgba(255,255,255,0.5)" strokeWidth={2} />
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

function fmt(n: number): string {
  if (!n) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#111827',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 40,
    paddingTop: 12,
    minHeight: 220,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  loaderWrap: {
    paddingVertical: 32,
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 20,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#22D3EE',
  },
  avatarFallback: {
    backgroundColor: '#0891B2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 22 },
  userInfo: { flex: 1, gap: 3 },
  username: { color: '#fff', fontWeight: '800', fontSize: 16 },
  bio: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
  statsRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  stat: { color: 'rgba(255,255,255,0.55)', fontSize: 12 },
  statVal: { color: '#fff', fontWeight: '700' },
  statDot: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

  // Aktionen
  actions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#22D3EE',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    flex: 1,
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderWidth: 1.5,
    borderColor: '#22D3EE',
  },
  followBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  followBtnTextActive: { color: '#22D3EE' },

  iconBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    minWidth: 72,
  },
  iconBtnDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  iconBtnLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' },
  iconBtnLabelDanger: { color: '#EF4444' },

  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
  },
});
