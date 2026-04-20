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
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { UserPlus, UserCheck, AtSign, Flag, X, ExternalLink, Swords, Hourglass, Shield, ShieldOff } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useFollow } from '@/lib/useFollow';
import { useDuettInviter } from '@/lib/useDuett';
import type { DuetLayout } from '@/lib/useCoHost';
import { DuettLayoutPicker } from './DuettLayoutPicker';
import { useLiveModerators, useLiveModeratorActions } from '@/lib/useLiveModerators';

const { height: SCREEN_H } = Dimensions.get('window');

interface UserInfo {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
}


interface Props {
  userId: string | null;            // null = Sheet geschlossen
  onClose: () => void;
  onMention?: (username: string) => void;  // @ Erwähnen im Chat
  onReport?: (userId: string) => void;     // User melden
  /**
   * Wenn gesetzt, wird der "Zum Duett einladen"-Button angezeigt.
   * Zweck: Host-Modus — nur der Host einer aktiven Session sollte das
   * sehen. Die Eltern-Komponente prüft `me === session.host` + liefert
   * dann die Session-ID hier durch.
   */
  duetInviteSessionId?: string | null;
  /**
   * v1.22.3 — Wenn gesetzt, wird der "Moderator ernennen/entfernen"-Button
   * angezeigt. Nur der Host einer aktiven Session darf das setzen; die
   * Server-RPCs (grant_moderator / revoke_moderator) enforcen host == auth.uid().
   * Nützlich v.a. im ViewerListSheet-Flow wo der Host einen Viewer tappt.
   */
  moderatorSessionId?: string | null;
}

export function LiveUserSheet({ userId, onClose, onMention, onReport, duetInviteSessionId, moderatorSessionId }: Props) {
  const router = useRouter();
  const { profile: me } = useAuthStore();
  const { isFollowing, toggle: toggleFollow } = useFollow(userId);

  const [userInfo, setUserInfo]     = useState<UserInfo | null>(null);
  const [loading, setLoading]       = useState(false);
  const [loadError, setLoadError]   = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);

  // Duet-Invite-State (nur aktiv wenn duetInviteSessionId gesetzt)
  const {
    inviteUser,
    isInviting,
    hasPendingInviteFor,
  } = useDuettInviter(duetInviteSessionId ?? null);
  const hasPendingInvite = !!userId && hasPendingInviteFor(userId);
  const canShowDuetInvite = !!duetInviteSessionId && !!userId && userId !== me?.id;

  // v1.22.3 — Moderator-State (nur aktiv wenn moderatorSessionId gesetzt)
  const { modIds } = useLiveModerators(moderatorSessionId ?? null);
  const { grant: grantMod, revoke: revokeMod, isBusy: isModBusy } =
    useLiveModeratorActions(moderatorSessionId ?? null);
  const canShowModAction = !!moderatorSessionId && !!userId && userId !== me?.id;
  const isModerator = !!userId && modIds.has(userId);

  const handleToggleModerator = useCallback(() => {
    if (!moderatorSessionId || !userId) return;
    if (isModerator) {
      Alert.alert(
        'Moderator entfernen?',
        'Dieser Nutzer verliert sofort seine Mod-Rechte für diese Session.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Entfernen',
            style: 'destructive',
            onPress: async () => {
              try { await revokeMod(userId); onClose(); }
              catch (e) { __DEV__ && console.warn('[LiveUserSheet] revoke mod failed:', e); }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Moderator ernennen?',
        'Dieser Nutzer erhält ein Mod-Badge im Chat und in der Zuschauer*innen-Liste.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Ernennen',
            onPress: async () => {
              try { await grantMod(userId); onClose(); }
              catch (e) { __DEV__ && console.warn('[LiveUserSheet] grant mod failed:', e); }
            },
          },
        ],
      );
    }
  }, [moderatorSessionId, userId, isModerator, grantMod, revokeMod, onClose]);

  const handleInviteDuet = useCallback(
    async (layout: DuetLayout, battleDuration?: number) => {
      setPickerVisible(false);
      if (!duetInviteSessionId || !userId) return;
      try {
        await inviteUser({
          sessionId:      duetInviteSessionId,
          inviteeId:      userId,
          layout,
          battleDuration,
        });
        // Sheet nach erfolgreichem Invite schließen → UI zeigt pending-Chip im Host-Screen.
        onClose();
      } catch (err) {
        __DEV__ && console.warn('[LiveUserSheet] invite failed:', err);
      }
    },
    [duetInviteSessionId, userId, inviteUser, onClose],
  );


  const slideY = useRef(new Animated.Value(SCREEN_H)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const isOpen = !!userId;
  const isOwnProfile = userId === me?.id;

  // Profil-Daten laden wenn Sheet öffnet
  useEffect(() => {
    if (!userId) { setUserInfo(null); setLoadError(false); return; }

    let canceled = false;
    setLoading(true);
    setLoadError(false);

    // async/await statt .then().catch() — Supabase gibt PromiseLike zurück,
    // kein echtes Promise mit .catch()
    (async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, bio')
          .eq('id', userId)
          .single();
        if (canceled) return;
        if (error || !data) setLoadError(true);
        else setUserInfo(data as UserInfo);
      } catch {
        if (!canceled) setLoadError(true);
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => { canceled = true; };
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

        {loading ? (
          <View style={s.loaderWrap}>
            <ActivityIndicator color="#FFFFFF" />
          </View>
        ) : loadError || !userInfo ? (
          <View style={s.loaderWrap}>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Profil nicht gefunden</Text>
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
                    ? <UserCheck size={18} color="#FFFFFF" strokeWidth={2.2} />
                    : <UserPlus size={18} color="#fff" strokeWidth={2.2} />
                  }
                  <Text style={[s.followBtnText, isFollowing && s.followBtnTextActive]}>
                    {isFollowing ? 'Gefolgt' : 'Folgen'}
                  </Text>
                </Pressable>
              )}

              {/* Host-Modus: Duett einladen */}
              {canShowDuetInvite && (
                <Pressable
                  style={[
                    s.duetBtn,
                    hasPendingInvite && s.duetBtnPending,
                    isInviting && s.duetBtnDisabled,
                  ]}
                  disabled={hasPendingInvite || isInviting}
                  onPress={() => setPickerVisible(true)}
                >
                  {hasPendingInvite ? (
                    <Hourglass size={18} color="#fff" strokeWidth={2.2} />
                  ) : (
                    <Swords size={18} color="#fff" strokeWidth={2.2} />
                  )}
                  <Text style={s.duetBtnText}>
                    {hasPendingInvite ? 'Einladung läuft…' : 'Zum Duett einladen'}
                  </Text>
                </Pressable>
              )}

              {/* v1.22.3 — Host-Modus: Moderator ernennen / entfernen */}
              {canShowModAction && (
                <Pressable
                  style={[
                    s.modBtn,
                    isModerator && s.modBtnActive,
                    isModBusy && s.modBtnDisabled,
                  ]}
                  disabled={isModBusy}
                  onPress={handleToggleModerator}
                >
                  {isModerator ? (
                    <ShieldOff size={18} color="#fff" strokeWidth={2.2} />
                  ) : (
                    <Shield size={18} color="#fff" strokeWidth={2.2} />
                  )}
                  <Text style={s.modBtnText}>
                    {isModerator ? 'Moderator entfernen' : 'Zum Moderator ernennen'}
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

      {/* Duett-Layout-Picker (nur Host-Modus) */}
      {canShowDuetInvite && (
        <DuettLayoutPicker
          visible={pickerVisible}
          onCancel={() => setPickerVisible(false)}
          onConfirm={handleInviteDuet}
          submitLabel={isInviting ? 'Wird gesendet…' : 'Einladen'}
          title="Als Duett einladen"
        />
      )}
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
    borderColor: '#FFFFFF',
  },
  avatarFallback: {
    backgroundColor: '#CCCCCC',
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 22,
    flex: 1,
    justifyContent: 'center',
  },
  followBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  followBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  followBtnTextActive: { color: '#FFFFFF' },

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

  // Host-Only: Duett-Einladung
  duetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#EC4899',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    flexBasis: '100%',
    justifyContent: 'center',
    marginTop: 4,
  },
  duetBtnPending: {
    backgroundColor: 'rgba(236,72,153,0.35)',
  },
  duetBtnDisabled: {
    opacity: 0.5,
  },
  duetBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
  },

  // v1.22.3 — Host-Only: Moderator ernennen / entfernen
  modBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    flexBasis: '100%',
    justifyContent: 'center',
    marginTop: 4,
  },
  modBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.85)',
  },
  modBtnDisabled: {
    opacity: 0.5,
  },
  modBtnText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 14,
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
