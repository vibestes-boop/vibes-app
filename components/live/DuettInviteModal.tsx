/**
 * DuettInviteModal.tsx
 *
 * Zeigt eingehende Duett-Einladungen als Modal-Karte mit Countdown.
 * Funktioniert für beide Richtungen:
 *
 *   host-to-viewer  → Ich (Viewer) sehe: "Host X lädt dich in sein Duett ein"
 *   viewer-to-host  → Ich (Host)  sehe:  "User X will mit dir duetten"
 *
 * Nach Accept:
 *   - invite wird in DB als 'accepted' markiert
 *   - Co-Host Whitelist-Entry wird atomar angelegt (via RPC)
 *   - Parent-Komponente bekommt `onAccepted` callback und triggert
 *     den normalen Co-Host-Join-Flow (LiveKit Token + Publish).
 *
 * Nach Decline:
 *   - Invite-Status → 'declined'
 *   - Modal schließt sich
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { Swords, X, Check, Rows2, Columns2, PictureInPicture2 } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { DuetInvite } from '@/lib/useDuett';
import { duetLayoutLabel, inviteSecondsLeft } from '@/lib/useDuett';
import type { DuetLayout } from '@/lib/useCoHost';

interface AcceptedPayload {
  invite:    DuetInvite;
  sessionId: string;
  hostId:    string;
  guestId:   string;
  layout:    DuetLayout;
}

interface Props {
  invite:   DuetInvite | null;
  onAccept: (inviteId: string) => Promise<unknown>;
  onDecline:(inviteId: string, reason?: string) => Promise<unknown>;
  onAccepted?: (payload: AcceptedPayload) => void;
  onDismiss: () => void;   // wird bei Timeout oder Decline aufgerufen
  isResponding?: boolean;
}

function LayoutIcon({ layout, size = 18 }: { layout: DuetLayout; size?: number }) {
  const props = { size, color: '#fff', strokeWidth: 2.2 } as const;
  switch (layout) {
    case 'top-bottom':   return <Rows2 {...props} />;
    case 'side-by-side': return <Columns2 {...props} />;
    case 'pip':          return <PictureInPicture2 {...props} />;
    case 'battle':       return <Swords {...props} />;
    default:             return <Columns2 {...props} />;
  }
}

export function DuettInviteModal({
  invite,
  onAccept,
  onDecline,
  onAccepted,
  onDismiss,
  isResponding = false,
}: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() =>
    invite ? Math.max(0, inviteSecondsLeft(invite)) : 0,
  );
  const slideY = useRef(new Animated.Value(300)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  // Reset + Animate on invite change
  useEffect(() => {
    if (invite) {
      setSecondsLeft(Math.max(0, inviteSecondsLeft(invite)));
      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 5, speed: 16 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      // Haptic für eingehende Einladung
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
    }
  }, [invite, slideY, opacity]);

  // Countdown-Timer
  useEffect(() => {
    if (!invite) return;
    const interval = setInterval(() => {
      const left = Math.max(0, inviteSecondsLeft(invite));
      setSecondsLeft(left);
      if (left <= 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [invite, onDismiss]);

  const handleAccept = useCallback(async () => {
    if (!invite) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await onAccept(invite.id);
      onAccepted?.({
        invite,
        sessionId: invite.sessionId,
        hostId:    invite.hostId,
        guestId:   invite.inviteeId,
        layout:    invite.layout,
      });
    } catch (err) {
      __DEV__ && console.warn('[DuettInviteModal] accept failed:', err);
    }
  }, [invite, onAccept, onAccepted]);

  const handleDecline = useCallback(async () => {
    if (!invite) return;
    try {
      Haptics.selectionAsync().catch(() => {});
      await onDecline(invite.id);
    } catch (err) {
      __DEV__ && console.warn('[DuettInviteModal] decline failed:', err);
    } finally {
      onDismiss();
    }
  }, [invite, onDecline, onDismiss]);

  if (!invite) return null;

  // Wer lädt mich ein?
  //   host-to-viewer  → Host lädt mich ein → zeige Host-Infos
  //   viewer-to-host  → Viewer will beitreten → zeige Viewer-Infos
  const senderName =
    invite.direction === 'host-to-viewer'
      ? invite.hostUsername
      : invite.inviteeUsername;
  const senderAvatar =
    invite.direction === 'host-to-viewer'
      ? invite.hostAvatarUrl
      : invite.inviteeAvatarUrl;
  const headline =
    invite.direction === 'host-to-viewer'
      ? 'Einladung zum Duett'
      : 'Duett-Anfrage';
  const subline =
    invite.direction === 'host-to-viewer'
      ? `@${senderName ?? '…'} möchte mit dir duetten`
      : `@${senderName ?? '…'} will in dein Duett einsteigen`;

  return (
    <Modal transparent visible animationType="none" onRequestClose={handleDecline}>
      <Animated.View style={[s.backdrop, { opacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDecline} />
      </Animated.View>

      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        <View style={s.handle} />

        <Pressable style={s.closeBtn} onPress={handleDecline} hitSlop={10}>
          <X size={16} color="rgba(255,255,255,0.5)" strokeWidth={2} />
        </Pressable>

        <View style={s.header}>
          {senderAvatar ? (
            <Image source={{ uri: senderAvatar }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>
                {(senderName?.[0] ?? '?').toUpperCase()}
              </Text>
            </View>
          )}

          <View style={s.headerText}>
            <Text style={s.headline}>{headline}</Text>
            <Text style={s.subline} numberOfLines={2}>{subline}</Text>
          </View>
        </View>

        {/* Layout-Info */}
        <View style={s.layoutRow}>
          <View style={s.layoutChip}>
            <LayoutIcon layout={invite.layout} size={14} />
            <Text style={s.layoutText}>{duetLayoutLabel(invite.layout)}</Text>
          </View>
          {invite.layout === 'battle' && invite.battleDuration && (
            <View style={s.layoutChip}>
              <Text style={s.layoutText}>
                {Math.round(invite.battleDuration / 60)} Min Battle
              </Text>
            </View>
          )}
          <View style={[s.layoutChip, s.countdownChip]}>
            <Text style={s.countdownText}>{secondsLeft}s</Text>
          </View>
        </View>

        {invite.message ? (
          <Text style={s.message}>{`"${invite.message}"`}</Text>
        ) : null}

        {/* Buttons */}
        <View style={s.actions}>
          <Pressable
            style={[s.declineBtn, isResponding && s.btnDisabled]}
            onPress={handleDecline}
            disabled={isResponding}
          >
            <X size={18} color="#fff" strokeWidth={2.2} />
            <Text style={s.declineText}>Ablehnen</Text>
          </Pressable>

          <Pressable
            style={[s.acceptBtn, isResponding && s.btnDisabled]}
            onPress={handleAccept}
            disabled={isResponding}
          >
            {isResponding ? (
              <ActivityIndicator size="small" color="#111827" />
            ) : (
              <>
                <Check size={18} color="#111827" strokeWidth={2.5} />
                <Text style={s.acceptText}>Annehmen</Text>
              </>
            )}
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
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
    paddingTop: 12,
    paddingBottom: 36,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: 16,
  },
  closeBtn: { position: 'absolute', top: 14, right: 14, padding: 6 },

  header: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#EC4899',
  },
  avatarFallback: {
    backgroundColor: '#4B5563',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { color: '#fff', fontWeight: '800', fontSize: 22 },
  headerText: { flex: 1, gap: 3 },
  headline: { color: '#fff', fontWeight: '800', fontSize: 16 },
  subline: { color: 'rgba(255,255,255,0.65)', fontSize: 13, lineHeight: 18 },

  layoutRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  layoutChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
  },
  layoutText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  countdownChip: { backgroundColor: 'rgba(236,72,153,0.25)' },
  countdownText: { color: '#FBCFE8', fontSize: 12, fontWeight: '800' },

  message: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontStyle: 'italic',
    marginBottom: 16,
    paddingHorizontal: 4,
  },

  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  declineText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  acceptBtn: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 24,
    backgroundColor: '#fff',
  },
  acceptText: { color: '#111827', fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.5 },
});
