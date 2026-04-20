/**
 * ViewerListSheet.tsx
 * TikTok-style multi-layer viewer system:
 * 1. Viewer List (bottom sheet with all viewers)
 * 2. User Profile Mini-Sheet (opens on top when viewer is tapped)
 * 3. Report Flow (flag icon → select what to report)
 */
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,

  Image,
  Modal,
  Alert,
  FlatList,
  ActivityIndicator,
} from 'react-native';
// react-native-reanimated: CJS require() vermeidet Hermes HBC Crash
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import {
  X,
  Flag,
  AtSign,
  UserPlus,
  UserCheck,
  Shield,
  ShieldOff,
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';
import { useFollow } from '@/lib/useFollow';
import { useTopGifters, type TopGifter } from '@/lib/useGifts';
import { useLiveModerators, useLiveModeratorActions } from '@/lib/useLiveModerators';

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewerUser = {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
};

/** Merged row für die Sheet-Liste: entweder ranked Top-Gifter oder nur Viewer. */
type AudienceRow = {
  id: string;
  username: string;
  avatarUrl: string | null;
  rank: number | null;        // 1..N für Top-Gifter, null für Non-Gifter
  totalCoins: number;         // 0 wenn Non-Gifter
  giftsCount: number;         // 0 wenn Non-Gifter
  bio?: string | null;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  /** Callback: fügt @username in Kommentar-Input ein */
  onMention?: (username: string) => void;
  /**
   * v1.22.2 — true wenn das Sheet vom Host geöffnet wird. Blendet die
   * Self-CTA "Sende ein Geschenk, um Top-Zuschauer*in zu werden" aus,
   * weil der Host sich nicht selbst beschenken kann.
   */
  isHost?: boolean;
  /**
   * v1.22.2 — wenn gesetzt: Self-CTA unten tappbar, öffnet Gift-Picker
   * (Sheet schließt sich vorher automatisch).
   */
  onOpenGiftPicker?: () => void;
  /**
   * v1.22.3 — Host-Identität. Wird für das "❤️ {hostName}" Follower-Badge
   * pro Row gebraucht: batch-Query auf follows(following_id=hostId) ermittelt,
   * welche der sichtbaren User dem Host folgen.
   */
  hostId?: string | null;
  hostName?: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtGiftCount(n: number): string {
  if (n <= 0) return '-';
  if (n >= 10) return '10+';
  return String(n);
}

function fmtCoins(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ─── Report-Optionen ──────────────────────────────────────────────────────────
const REPORT_REASONS = [
  { key: 'name', label: 'Unangemessener Name' },
  { key: 'photo', label: 'Unangemessenes Profilbild' },
  { key: 'spam', label: 'Spam / Werbung' },
  { key: 'hate', label: 'Hassrede / Belästigung' },
  { key: 'impersonation', label: 'Identitätsdiebstahl' },
  { key: 'other', label: 'Anderer Grund' },
];

// ─── User Profile Mini-Sheet ──────────────────────────────────────────────────
function UserProfileSheet({
  user,
  visible,
  onClose,
  onMention,
  // v1.22.3 — Host-Only Moderator-Actions für diese Session
  modSessionId,
  isModerator,
  onGrantMod,
  onRevokeMod,
  isModBusy,
}: {
  user: ViewerUser;
  visible: boolean;
  onClose: () => void;
  onMention?: (username: string) => void;
  modSessionId?: string | null;
  isModerator?: boolean;
  onGrantMod?: (userId: string) => Promise<unknown> | void;
  onRevokeMod?: (userId: string) => Promise<unknown> | void;
  isModBusy?: boolean;
}) {
  const { isFollowing, toggle, isLoading, isOwnProfile } = useFollow(user.id);
  const [showReport, setShowReport] = useState(false);

  const handleReport = (reason: string) => {
    setShowReport(false);
    // Fire & forget: Report in DB speichern
    const { profile } = useAuthStore.getState();
    if (!profile) return;
    supabase
      .from('reports')
      .insert({
        reporter_id: profile.id,
        reported_user_id: user.id,
        reason,
      })
      .then();
    Alert.alert('Gemeldet', 'Deine Meldung wurde eingereicht. Danke!');
  };

  // v1.22.3 — Grant/Revoke Handler mit Confirm-Alert
  const canShowModAction = !!modSessionId && !isOwnProfile;
  const handleToggleMod = () => {
    if (!modSessionId) return;
    if (isModerator) {
      Alert.alert(
        'Moderator entfernen?',
        `@${user.username} verliert sofort die Mod-Rechte für diese Session.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Entfernen',
            style: 'destructive',
            onPress: async () => {
              try { await onRevokeMod?.(user.id); onClose(); }
              catch (e) { __DEV__ && console.warn('[ViewerListSheet] revoke failed:', e); }
            },
          },
        ],
      );
    } else {
      Alert.alert(
        'Moderator ernennen?',
        `@${user.username} erhält ein Mod-Badge im Chat und in der Zuschauer*innen-Liste.`,
        [
          { text: 'Abbrechen', style: 'cancel' },
          {
            text: 'Ernennen',
            onPress: async () => {
              try { await onGrantMod?.(user.id); onClose(); }
              catch (e) { __DEV__ && console.warn('[ViewerListSheet] grant failed:', e); }
            },
          },
        ],
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(150)}
        exiting={FadeOut.duration(150)}
        style={s.profileBackdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Profile Card */}
      <Animated.View
        entering={SlideInDown.springify().damping(20).stiffness(160)}
        exiting={SlideOutDown.duration(200)}
        style={s.profileSheet}
      >
        {/* Header mit Melden-Fahne */}
        <View style={s.profileHeader}>
          <View style={s.profileHandle} />
          <Pressable onPress={() => setShowReport(true)} style={s.flagBtn} hitSlop={12}>
            <Flag size={18} stroke="#888" strokeWidth={1.8} />
          </Pressable>
          <Pressable onPress={onClose} style={s.profileCloseBtn} hitSlop={12}>
            <X size={18} stroke="#aaa" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Avatar + Name */}
        <View style={s.profileInfo}>
          {user.avatar_url ? (
            <Image source={{ uri: user.avatar_url }} style={s.profileAvatar} />
          ) : (
            <View style={[s.profileAvatar, s.profileAvatarFallback]}>
              <Text style={s.profileAvatarLetter}>
                {user.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
          <Text style={s.profileUsername}>@{user.username}</Text>
          {user.bio ? (
            <Text style={s.profileBio} numberOfLines={2}>
              {user.bio}
            </Text>
          ) : null}
        </View>

        {/* Action Buttons */}
        <View style={s.profileActions}>
          {/* Follow/Unfollow */}
          {!isOwnProfile && (
            <Pressable
              style={[s.profileActionBtn, isFollowing && s.profileActionBtnActive]}
              onPress={toggle}
              disabled={isLoading}
            >
              {isFollowing ? (
                <>
                  <UserCheck size={16} stroke="#FFFFFF" strokeWidth={2} />
                  <Text style={[s.profileActionText, s.profileActionTextActive]}>
                    Folge ich
                  </Text>
                </>
              ) : (
                <>
                  <UserPlus size={16} stroke="#fff" strokeWidth={2} />
                  <Text style={s.profileActionText}>Folgen</Text>
                </>
              )}
            </Pressable>
          )}

          {/* @ Mention */}
          {onMention && (
            <Pressable
              style={s.profileActionBtn}
              onPress={() => {
                onMention(user.username);
                onClose();
              }}
            >
              <AtSign size={16} stroke="#fff" strokeWidth={2} />
              <Text style={s.profileActionText}>Erwähnen</Text>
            </Pressable>
          )}

          {/* v1.22.3 — Host-Only: Moderator ernennen/entfernen */}
          {canShowModAction && (
            <Pressable
              style={[
                s.profileActionBtn,
                isModerator ? s.profileModBtnRevoke : s.profileModBtnGrant,
                isModBusy && s.profileModBtnBusy,
              ]}
              onPress={handleToggleMod}
              disabled={!!isModBusy}
            >
              {isModerator ? (
                <ShieldOff size={16} stroke="#fff" strokeWidth={2} />
              ) : (
                <Shield size={16} stroke="#fff" strokeWidth={2} />
              )}
              <Text style={s.profileActionText}>
                {isModerator ? 'Mod entfernen' : 'Zum Mod'}
              </Text>
            </Pressable>
          )}
        </View>

        {/* Report Options (stacked) */}
        {showReport && (
          <Animated.View entering={FadeIn.duration(150)} style={s.reportOverlay}>
            <Text style={s.reportTitle}>Was möchtest du melden?</Text>
            {REPORT_REASONS.map((r) => (
              <Pressable
                key={r.key}
                style={s.reportOption}
                onPress={() => handleReport(r.key)}
              >
                <Text style={s.reportOptionText}>{r.label}</Text>
              </Pressable>
            ))}
            <Pressable
              style={s.reportCancel}
              onPress={() => setShowReport(false)}
            >
              <Text style={s.reportCancelText}>Abbrechen</Text>
            </Pressable>
          </Animated.View>
        )}
      </Animated.View>
    </Modal>
  );
}

// ─── Main Viewer List Sheet ───────────────────────────────────────────────────
export default function ViewerListSheet({
  visible,
  onClose,
  sessionId,
  onMention,
  isHost,
  onOpenGiftPicker,
  hostId,
  hostName,
}: Props) {
  const [viewers, setViewers] = useState<ViewerUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<ViewerUser | null>(null);

  // v1.22.2 — Realtime Top-Gifter (Ranking nach Coin-Summe in dieser Session)
  const { topGifters } = useTopGifters(visible ? sessionId : null, 20);

  // Self (Viewer selbst) — für die sticky CTA-Row unten
  const selfProfile = useAuthStore((st) => st.profile);

  // v1.22.3 — Set der Nutzer-IDs die dem Host folgen (für "❤️ {hostName}" Chip)
  const [hostFollowers, setHostFollowers] = useState<Set<string>>(new Set());

  // v1.22.3 — Realtime Moderator-Set für diese Session (für "Moderator" Chip)
  const { modIds } = useLiveModerators(visible ? sessionId : null);

  // v1.22.3 — Moderator-Grant/Revoke — nur für Host aktiv (RPC enforcet host==auth.uid())
  const modActionsSessionId = isHost && visible ? sessionId : null;
  const { grant: grantMod, revoke: revokeMod, isBusy: isModBusy } =
    useLiveModeratorActions(modActionsSessionId);

  // Zuschauer laden (aktive Kommentatoren als beste Datenquelle)
  useEffect(() => {
    if (!visible) return;
    setLoading(true);

    (async () => {
      const { data: commentUsers } = await supabase
        .from('live_comments')
        .select('user_id, profiles!live_comments_user_id_fkey(id, username, avatar_url, bio)')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (commentUsers) {
        const seen = new Set<string>();
        const uniqueViewers: ViewerUser[] = [];
        for (const row of commentUsers) {
          const p = row.profiles as unknown as ViewerUser;
          if (p && !seen.has(p.id)) {
            seen.add(p.id);
            uniqueViewers.push(p);
          }
        }
        setViewers(uniqueViewers);
      }
      setLoading(false);
    })();
  }, [visible, sessionId]);

  // v1.22.3 — Batch-Query: welche sichtbaren User folgen dem Host?
  // Läuft nur, wenn hostId gesetzt ist und das Sheet sichtbar. Re-läuft
  // wenn sich die Audience-Liste ändert (neuer Kommentator, neues Gift).
  const audienceIds = useMemo(() => {
    const set = new Set<string>();
    viewers.forEach((v) => set.add(v.id));
    topGifters.forEach((g) => set.add(g.userId));
    if (selfProfile?.id) set.add(selfProfile.id);
    // host selbst raus (er folgt sich nicht selbst)
    if (hostId) set.delete(hostId);
    return Array.from(set).sort();
  }, [viewers, topGifters, selfProfile?.id, hostId]);

  useEffect(() => {
    if (!visible || !hostId || audienceIds.length === 0) {
      setHostFollowers(new Set());
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', hostId)
        .in('follower_id', audienceIds);
      if (cancelled) return;
      if (error) {
        __DEV__ && console.warn('[ViewerListSheet] host-followers query failed:', error.message);
        setHostFollowers(new Set());
        return;
      }
      setHostFollowers(new Set((data ?? []).map((r: { follower_id: string }) => r.follower_id)));
    })();
    return () => { cancelled = true; };
    // audienceIds kommt aus useMemo → stabile Referenz solange IDs gleich bleiben
  }, [visible, hostId, audienceIds]);

  // Merge: Top-Gifter (ranked) zuerst, dann Rest-Viewer (non-gifter) ohne Rank.
  // Self wird aus der Hauptliste entfernt — erscheint nur unten in der CTA-Row.
  const rows: AudienceRow[] = (() => {
    const topSet = new Set(topGifters.map((g) => g.userId));
    const ranked: AudienceRow[] = topGifters.map((g: TopGifter, i) => ({
      id:         g.userId,
      username:   g.username,
      avatarUrl:  g.avatarUrl ?? null,
      rank:       i + 1,
      totalCoins: g.totalCoins,
      giftsCount: g.giftsCount,
    }));
    const unranked: AudienceRow[] = viewers
      .filter((v) => !topSet.has(v.id))
      .map((v) => ({
        id:         v.id,
        username:   v.username,
        avatarUrl:  v.avatar_url,
        rank:       null,
        totalCoins: 0,
        giftsCount: 0,
        bio:        v.bio,
      }));
    const merged = [...ranked, ...unranked];
    // Self raus — wird unten sticky dargestellt
    return selfProfile ? merged.filter((r) => r.id !== selfProfile.id) : merged;
  })();

  // Eigener Rank (falls in Top-Gifter) — zur Anzeige in der Sticky-CTA-Row
  const selfInTop = selfProfile
    ? topGifters.find((g) => g.userId === selfProfile.id) ?? null
    : null;
  const selfRank = selfInTop
    ? topGifters.findIndex((g) => g.userId === selfProfile!.id) + 1
    : null;

  const totalCount = rows.length + (selfProfile ? 1 : 0);

  if (!visible) return null;

  // Row-Renderer — ranked oder unranked
  const renderRow = (item: AudienceRow) => (
    <Pressable
      style={s.viewerRow}
      onPress={() =>
        setSelectedUser({
          id:         item.id,
          username:   item.username,
          avatar_url: item.avatarUrl,
          bio:        item.bio ?? null,
        })
      }
    >
      {/* Rank links: "1" / "2" / "3" pink, ab 4 grau, "-" für non-gifter */}
      <View style={s.rankCol}>
        {item.rank === null ? (
          <Text style={s.rankDash}>-</Text>
        ) : item.rank <= 3 ? (
          <Text style={[s.rankNum, s.rankTop]}>{item.rank}</Text>
        ) : (
          <Text style={[s.rankNum, s.rankRest]}>{item.rank}</Text>
        )}
      </View>

      {/* Avatar */}
      {item.avatarUrl ? (
        <Image source={{ uri: item.avatarUrl }} style={s.viewerAvatar} />
      ) : (
        <View style={[s.viewerAvatar, s.viewerAvatarFallback]}>
          <Text style={s.viewerAvatarLetter}>
            {item.username?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
      )}

      {/* Name + Chip-Row: Top-Rank (1..3) + Follower-Badge + Moderator-Badge */}
      <View style={s.viewerInfo}>
        <Text style={s.viewerName}>@{item.username}</Text>
        {(item.rank !== null && item.rank <= 3) ||
        hostFollowers.has(item.id) ||
        modIds.has(item.id) ? (
          <View style={s.rankChipRow}>
            {item.rank !== null && item.rank <= 3 && (
              <View
                style={[
                  s.rankChip,
                  item.rank === 1 ? s.rankChipGold : s.rankChipRest3,
                ]}
              >
                <Text style={s.rankChipText}>👑 Nr. {item.rank}</Text>
              </View>
            )}
            {/* v1.22.3 — Moderator-Badge: vom Host ernannte Moderatoren */}
            {modIds.has(item.id) ? (
              <View style={[s.rankChip, s.moderatorChip]}>
                <Text style={s.moderatorChipText}>🛡 Moderator</Text>
              </View>
            ) : null}
            {/* v1.22.3 — Follower-Badge: User folgt dem Host */}
            {hostFollowers.has(item.id) && hostName ? (
              <View style={[s.rankChip, s.followerChip]}>
                <Text style={s.followerChipText}>❤️ {hostName}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Rechts: Gift-Count (10+/5/1) + Coin-Tooltip für Ranked */}
      {item.rank !== null ? (
        <View style={s.rightCol}>
          <Text style={s.giftCountText}>{fmtGiftCount(item.giftsCount)}</Text>
          <Text style={s.coinHint}>{fmtCoins(item.totalCoins)} 💎</Text>
        </View>
      ) : null}
    </Pressable>
  );

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={s.backdrop}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View
        entering={SlideInDown.springify().damping(18).stiffness(140)}
        exiting={SlideOutDown.duration(250)}
        style={s.sheet}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.handle} />
          <Text style={s.headerTitle}>Top-Zuschauer*innen</Text>
          <Pressable onPress={onClose} style={s.closeBtn} hitSlop={12}>
            <X size={20} stroke="#aaa" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Count */}
        <Text style={s.viewerCountLabel}>
          {totalCount} {totalCount === 1 ? 'Zuschauer' : 'Zuschauer'}
        </Text>

        {/* List */}
        {loading ? (
          <ActivityIndicator color="#FFFFFF" style={{ paddingVertical: 40 }} />
        ) : rows.length === 0 ? (
          <View style={s.emptyState}>
            <Text style={s.emptyEmoji}>👀</Text>
            <Text style={s.emptyText}>Noch keine Zuschauer</Text>
          </View>
        ) : (
          <FlatList
            data={rows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingBottom: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => renderRow(item)}
          />
        )}

        {/* v1.22.2 — Sticky Self-CTA (nicht für Host). Öffnet Gift-Picker. */}
        {!isHost && selfProfile && (
          <View style={s.selfDivider} />
        )}
        {!isHost && selfProfile && (
          <Pressable
            style={s.selfCtaRow}
            onPress={() => {
              if (onOpenGiftPicker) {
                onClose();
                // kleines Delay: Close-Animation zuerst, dann Picker öffnen
                setTimeout(onOpenGiftPicker, 220);
              }
            }}
          >
            <View style={s.rankCol}>
              {selfRank ? (
                <Text
                  style={[
                    s.rankNum,
                    selfRank <= 3 ? s.rankTop : s.rankRest,
                  ]}
                >
                  {selfRank}
                </Text>
              ) : (
                <Text style={s.rankDash}>-</Text>
              )}
            </View>
            {selfProfile.avatar_url ? (
              <Image source={{ uri: selfProfile.avatar_url }} style={s.viewerAvatar} />
            ) : (
              <View style={[s.viewerAvatar, s.viewerAvatarFallback]}>
                <Text style={s.viewerAvatarLetter}>
                  {selfProfile.username?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View style={s.viewerInfo}>
              <Text style={s.viewerName}>
                @{selfProfile.username ?? 'du'}
              </Text>
              {/* v1.22.3 — Chips in Self-Row: Moderator + Follower */}
              {modIds.has(selfProfile.id) ||
              (hostFollowers.has(selfProfile.id) && hostName) ? (
                <View style={s.rankChipRow}>
                  {modIds.has(selfProfile.id) ? (
                    <View style={[s.rankChip, s.moderatorChip]}>
                      <Text style={s.moderatorChipText}>🛡 Moderator</Text>
                    </View>
                  ) : null}
                  {hostFollowers.has(selfProfile.id) && hostName ? (
                    <View style={[s.rankChip, s.followerChip]}>
                      <Text style={s.followerChipText}>❤️ {hostName}</Text>
                    </View>
                  ) : null}
                </View>
              ) : (
                <Text style={s.selfCtaHint}>
                  Sende ein Geschenk, um Top-Zuschauer*in zu werden
                </Text>
              )}
            </View>
            <View style={s.selfCtaBtn}>
              <Text style={s.selfCtaBtnText}>Geschenk</Text>
            </View>
          </Pressable>
        )}
      </Animated.View>

      {/* User Profile Mini-Sheet (stacked on top) */}
      {selectedUser && (
        <UserProfileSheet
          user={selectedUser}
          visible={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          onMention={onMention}
          /* v1.22.3 — Host kann direkt aus der Liste Moderatoren ernennen */
          modSessionId={isHost ? sessionId : null}
          isModerator={modIds.has(selectedUser.id)}
          onGrantMod={grantMod}
          onRevokeMod={revokeMod}
          isModBusy={isModBusy}
        />
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  // ── Main Sheet ──
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingBottom: 34,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  handle: {
    position: 'absolute',
    top: 8,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerCountLabel: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  emptyEmoji: { fontSize: 36 },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
  },

  // ── v1.22.2 — Rank-Column + Gift-Count-Column ──
  rankCol: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: {
    fontSize: 13,
    fontWeight: '800',
  },
  rankTop: { color: '#FF2E63' },           // Top 3 → pink
  rankRest: { color: 'rgba(255,255,255,0.45)' }, // Ab Platz 4 → grau
  rankDash: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.25)',
  },
  rankChipRow: { flexDirection: 'row', marginTop: 3 },
  rankChip: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  rankChipGold:  { backgroundColor: 'rgba(255,46,99,0.18)' },
  rankChipRest3: { backgroundColor: 'rgba(255,138,76,0.18)' },
  rankChipText: {
    color: '#FF6B8A',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // v1.22.3 — Follower-Badge (User folgt dem Host)
  followerChip: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    marginLeft: 6,
  },
  followerChipText: {
    color: '#F87171',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  // v1.22.3 — Moderator-Badge (vom Host ernannt, session-scoped)
  moderatorChip: {
    backgroundColor: 'rgba(59,130,246,0.18)',
    marginLeft: 6,
  },
  moderatorChipText: {
    color: '#60A5FA',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  rightCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    minWidth: 52,
  },
  giftCountText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  coinHint: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 1,
  },

  // ── Self-CTA Sticky Row (unten) ──
  selfDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginHorizontal: 16,
  },
  selfCtaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    backgroundColor: '#1a1a1a',
  },
  selfCtaHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  selfCtaBtn: {
    backgroundColor: '#FF2E63',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  selfCtaBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },

  // ── Viewer Row ──
  viewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  viewerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  viewerAvatarFallback: {
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewerAvatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  viewerInfo: {
    flex: 1,
    gap: 2,
  },
  viewerName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  viewerBio: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },

  // ── User Profile Mini-Sheet ──
  profileBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  profileSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#222',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingTop: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  profileHandle: {
    position: 'absolute',
    top: 8,
    left: '50%',
    marginLeft: -18,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  flagBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Profile Content ──
  profileInfo: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  profileAvatarFallback: {
    backgroundColor: '#CCCCCC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatarLetter: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '900',
  },
  profileUsername: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  profileBio: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 32,
  },

  // ── Action Buttons ──
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  profileActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#CCCCCC',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  profileActionBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  profileActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  profileActionTextActive: {
    color: '#FFFFFF',
  },
  // v1.22.3 — Moderator-Action-Varianten (grant = blau, revoke = rot)
  profileModBtnGrant:  { backgroundColor: '#3B82F6' },
  profileModBtnRevoke: { backgroundColor: 'rgba(239,68,68,0.85)' },
  profileModBtnBusy:   { opacity: 0.5 },

  // ── Report Overlay ──
  reportOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: '#222',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
    paddingBottom: 34,
  },
  reportTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
  },
  reportOption: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  reportOptionText: {
    color: '#fff',
    fontSize: 15,
  },
  reportCancel: {
    paddingVertical: 16,
    marginTop: 8,
    alignItems: 'center',
  },
  reportCancelText: {
    color: '#EF4444',
    fontSize: 15,
    fontWeight: '700',
  },
});
