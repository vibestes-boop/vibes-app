/**
 * CoHostRequestSheet.tsx
 *
 * TikTok-Style Bottom-Sheet für eingehende Co-Host-Anfragen beim Host.
 * Ersetzt den alten `Alert.alert()`-Flow (grauer iOS-Default-Dialog).
 *
 * Flow:
 *   1. Viewer klickt "Duet anfragen" → pendingRequest wird in host.tsx gesetzt
 *   2. Host sieht dieses Sheet: Avatar, @username, Layout-Picker, Battle-Dauer
 *   3. Host wählt Layout + tippt "Annehmen" → onAccept(layout, battleDuration?)
 *      oder "Ablehnen" → onDecline()
 *
 * Design:
 *   - Vollflächiges Bottom-Sheet (dunkles Glass-Gefühl)
 *   - Avatar mit Gradient-Ring + Pulse-Animation
 *   - 4 Layout-Optionen als Tile-Cards mit Preview-Icons
 *   - Battle-Dauer-Presets erscheinen inline wenn 'battle' gewählt
 *   - Gradient-CTA "Annehmen" (pink→rot) + Outline "Ablehnen"
 *   - Spring-Slide-in + Haptics beim Öffnen
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check,
  Columns2,
  PictureInPicture2,
  Rows2,
  Swords,
  Video,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import type { DuetLayout } from '@/lib/useCoHost';

interface Props {
  visible: boolean;
  username: string | null;
  avatarUrl: string | null;
  onAccept: (layout: DuetLayout, battleDurationSecs?: number) => void;
  onDecline: () => void;
  onDismiss: () => void;
}

interface LayoutOption {
  id:    DuetLayout;
  label: string;
  hint:  string;
  Icon:  typeof Rows2;
}

const LAYOUTS: LayoutOption[] = [
  { id: 'side-by-side', label: 'Nebeneinander',     hint: '50/50 horizontal',          Icon: Columns2 },
  { id: 'top-bottom',   label: 'Oben / Unten',      hint: 'Du oben, Gast unten',       Icon: Rows2 },
  { id: 'pip',          label: 'Picture-in-Picture',hint: 'Du Vollbild, Gast kompakt', Icon: PictureInPicture2 },
  { id: 'battle',       label: 'Battle',            hint: 'Score-Duell mit Countdown', Icon: Swords },
];

const BATTLE_PRESETS = [
  { secs: 60,  label: '1 Min' },
  { secs: 180, label: '3 Min' },
  { secs: 300, label: '5 Min' },
];

export function CoHostRequestSheet({
  visible,
  username,
  avatarUrl,
  onAccept,
  onDecline,
  onDismiss,
}: Props) {
  const [selected, setSelected] = useState<DuetLayout>('side-by-side');
  const [battleDuration, setBattleDuration] = useState<number>(60);

  // Slide + Fade Animations
  const slideY = useRef(new Animated.Value(500)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Avatar-Pulse (TikTok-Feeling)
  const pulseScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Reset-State bei neuer Anfrage
      setSelected('side-by-side');
      setBattleDuration(60);

      Animated.parallel([
        Animated.spring(slideY, { toValue: 0, useNativeDriver: true, bounciness: 6, speed: 14 }),
        Animated.timing(backdropOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();

      // Pulse-Loop für Avatar
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseScale, { toValue: 1.08, duration: 900, useNativeDriver: true }),
          Animated.timing(pulseScale, { toValue: 1.00, duration: 900, useNativeDriver: true }),
        ]),
      ).start();

      // Soft-Haptic für eingehende Anfrage
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    } else {
      Animated.parallel([
        Animated.timing(slideY, { toValue: 500, duration: 200, useNativeDriver: true }),
        Animated.timing(backdropOpacity, { toValue: 0, duration: 160, useNativeDriver: true }),
      ]).start();
      pulseScale.stopAnimation();
    }
  }, [visible, slideY, backdropOpacity, pulseScale]);

  const handleAccept = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (selected === 'battle') {
      onAccept('battle', battleDuration);
    } else {
      onAccept(selected);
    }
  }, [selected, battleDuration, onAccept]);

  const handleDecline = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    onDecline();
  }, [onDecline]);

  const handleSelect = useCallback((id: DuetLayout) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected(id);
  }, []);

  if (!visible && (slideY as unknown as { _value: number })._value >= 499) {
    // Short-circuit: Modal ganz unmounten wenn komplett weg
    return null;
  }

  const displayName = username?.trim() || 'User';
  const initial = displayName[0]?.toUpperCase() ?? '?';

  return (
    <Modal transparent visible animationType="none" onRequestClose={onDismiss}>
      {/* Backdrop */}
      <Animated.View style={[s.backdrop, { opacity: backdropOpacity }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleDecline} />
      </Animated.View>

      {/* Sheet */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: slideY }] }]}>
        {/* Glass-Header mit Gradient */}
        <LinearGradient
          colors={['rgba(236,72,153,0.18)', 'rgba(17,24,39,0)']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={s.headerGlow}
          pointerEvents="none"
        />

        <View style={s.handle} />

        <Pressable style={s.closeBtn} onPress={handleDecline} hitSlop={10}>
          <X size={18} color="rgba(255,255,255,0.55)" strokeWidth={2} />
        </Pressable>

        {/* Avatar mit Pulse-Ring */}
        <View style={s.avatarWrap}>
          <Animated.View
            style={[s.avatarRing, { transform: [{ scale: pulseScale }] }]}
          >
            <LinearGradient
              colors={['#EC4899', '#F43F5E', '#EC4899']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={s.avatar} contentFit="cover" />
          ) : (
            <View style={[s.avatar, s.avatarFallback]}>
              <Text style={s.avatarInitial}>{initial}</Text>
            </View>
          )}
          {/* Kleines "Video"-Badge unten rechts am Avatar */}
          <View style={s.videoBadge}>
            <Video size={12} color="#fff" strokeWidth={2.5} fill="#fff" />
          </View>
        </View>

        {/* Text */}
        <Text style={s.headline}>Duet-Anfrage</Text>
        <Text style={s.subline}>
          <Text style={s.usernameAccent}>@{displayName}</Text> möchte als Co-Host beitreten
        </Text>

        {/* Layout-Tiles */}
        <View style={s.tilesGrid}>
          {LAYOUTS.map((opt) => {
            const Icon = opt.Icon;
            const active = selected === opt.id;
            return (
              <Pressable
                key={opt.id}
                onPress={() => handleSelect(opt.id)}
                style={[s.tile, active && s.tileActive]}
              >
                {active && (
                  <LinearGradient
                    colors={['rgba(236,72,153,0.28)', 'rgba(244,63,94,0.15)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFillObject}
                  />
                )}
                <View style={[s.tileIcon, active && s.tileIconActive]}>
                  <Icon
                    size={22}
                    color={active ? '#fff' : 'rgba(255,255,255,0.85)'}
                    strokeWidth={2.2}
                  />
                </View>
                <Text style={[s.tileLabel, active && s.tileLabelActive]}>
                  {opt.label}
                </Text>
                <Text style={s.tileHint} numberOfLines={1}>{opt.hint}</Text>
                {active && (
                  <View style={s.tileCheck}>
                    <Check size={12} color="#fff" strokeWidth={3} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Battle-Dauer (nur wenn Battle) */}
        {selected === 'battle' && (
          <View style={s.battleRow}>
            <Text style={s.battleLabel}>Battle-Dauer</Text>
            <View style={s.battlePresets}>
              {BATTLE_PRESETS.map((p) => {
                const active = battleDuration === p.secs;
                return (
                  <Pressable
                    key={p.secs}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setBattleDuration(p.secs);
                    }}
                    style={[s.preset, active && s.presetActive]}
                  >
                    <Text style={[s.presetText, active && s.presetTextActive]}>
                      {p.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* CTAs */}
        <View style={s.actions}>
          <Pressable style={s.declineBtn} onPress={handleDecline}>
            <X size={18} color="rgba(255,255,255,0.85)" strokeWidth={2.2} />
            <Text style={s.declineText}>Ablehnen</Text>
          </Pressable>

          <Pressable style={s.acceptBtnWrap} onPress={handleAccept}>
            <LinearGradient
              colors={['#EC4899', '#F43F5E']}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={s.acceptBtnGrad}
            >
              <Check size={18} color="#fff" strokeWidth={2.8} />
              <Text style={s.acceptText}>Annehmen</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0B0F19',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  headerGlow: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 180,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 18,
  },
  closeBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 6,
    zIndex: 5,
  },

  // Avatar
  avatarWrap: {
    alignSelf: 'center',
    marginBottom: 14,
    width: 84,
    height: 84,
  },
  avatarRing: {
    position: 'absolute',
    inset: -4,
    width: 92,
    height: 92,
    borderRadius: 46,
    overflow: 'hidden',
  },
  avatar: {
    position: 'absolute',
    top: 0, left: 0,
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: '#0B0F19',
  },
  avatarFallback: {
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '800',
  },
  videoBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#EC4899',
    borderWidth: 2,
    borderColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Text
  headline: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subline: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
  },
  usernameAccent: {
    color: '#F9A8D4',
    fontWeight: '700',
  },

  // Tiles
  tilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  tile: {
    width: '48%',
    borderRadius: 16,
    padding: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  tileActive: {
    borderColor: 'rgba(236,72,153,0.6)',
    backgroundColor: 'rgba(236,72,153,0.08)',
  },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tileIconActive: {
    backgroundColor: 'rgba(236,72,153,0.35)',
  },
  tileLabel: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  tileLabelActive: {
    color: '#fff',
  },
  tileHint: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 2,
  },
  tileCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EC4899',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Battle-Dauer
  battleRow: {
    marginBottom: 16,
  },
  battleLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  battlePresets: {
    flexDirection: 'row',
    gap: 8,
  },
  preset: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  presetActive: {
    backgroundColor: 'rgba(236,72,153,0.15)',
    borderColor: 'rgba(236,72,153,0.55)',
  },
  presetText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 13,
    fontWeight: '700',
  },
  presetTextActive: {
    color: '#FBCFE8',
  },

  // Actions
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  declineBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  declineText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  acceptBtnWrap: {
    flex: 1.25,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#EC4899',
    shadowOpacity: 0.5,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  acceptBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
  },
  acceptText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
});
