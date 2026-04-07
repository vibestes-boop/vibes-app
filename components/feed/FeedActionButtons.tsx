import React from 'react';
import { Pressable, Text, View, ActivityIndicator, StyleSheet } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { useAnimatedStyle, useSharedValue, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import {
  Heart,
  MessageCircle,
  Bookmark,
  Volume2,
  VolumeX,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useQuery } from '@tanstack/react-query';
import { useCommentCount } from '@/lib/useComments';
import { useBookmark } from '@/lib/useBookmark';
import { useVoiceReader } from '@/lib/useVoiceReader';
import { useCreatorVoiceSample } from '@/lib/useCreatorVoiceSample';
import { supabase } from '@/lib/supabase';
import { feedItemStyles as styles } from './feedStyles';

export function ActionButton({
  icon: Icon,
  count,
  color = '#FFFFFF',
  active = false,
  activeColor,
  onPress,
  accessibilityLabel,
}: {
  icon: React.ElementType;
  count?: string;
  color?: string;
  active?: boolean;
  activeColor?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const iconColor = active && activeColor ? activeColor : color;

  return (
    <Pressable
      onPressIn={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
          withTiming(0.8, { duration: 50 }),
          withSpring(1, { damping: 12, stiffness: 300 })
        );
      }}
      onPress={onPress}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[styles.actionBtnInner, animStyle]}>
        <Icon size={26} stroke={iconColor} strokeWidth={1.8} />
      </Animated.View>
      {count !== undefined && (
        <Text style={[styles.actionCount, active && activeColor ? { color: activeColor } : undefined]}>
          {count}
        </Text>
      )}
    </Pressable>
  );
}

export function CommentButton({
  postId,
  onPress,
  batchCount,
}: {
  postId: string;
  onPress: () => void;
  batchCount?: number;
}) {
  const { data: count = 0 } = useCommentCount(postId, batchCount);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const formatted = count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);

  return (
    <Pressable
      onPressIn={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        scale.value = withSequence(
          withTiming(0.75, { duration: 60 }),
          withTiming(1.2, { duration: 80 }),
          withTiming(1, { duration: 80 })
        );
      }}
      onPress={onPress}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={`Kommentare anzeigen, ${formatted} Kommentare`}
    >
      <Animated.View style={[styles.actionBtnInner, animStyle]}>
        <MessageCircle size={26} stroke="#FFFFFF" strokeWidth={1.8} />
      </Animated.View>
      <Text style={styles.actionCount}>{formatted}</Text>
    </Pressable>
  );
}

export function BookmarkButton({ postId, batchBookmarked }: { postId: string; batchBookmarked?: boolean }) {
  const { bookmarked, toggle } = useBookmark(postId, batchBookmarked);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withTiming(0.7, { duration: 60 }),
      withTiming(1.3, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
    toggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={bookmarked ? 'Lesezeichen entfernen' : 'Lesezeichen setzen'}
      accessibilityState={{ selected: bookmarked }}
    >
      <Animated.View style={[styles.actionBtnInner, animStyle]}>
        <Bookmark
          size={26}
          stroke={bookmarked ? '#FBBF24' : '#FFFFFF'}
          strokeWidth={1.8}
          fill={bookmarked ? '#FBBF24' : 'transparent'}
        />
      </Animated.View>
    </Pressable>
  );
}

export function LikeButton({
  accentColor: _accentColor,
  liked,
  formattedCount,
  onToggle,
  onCountPress,
}: {
  accentColor: string;
  liked: boolean;
  formattedCount: string;
  onToggle: () => void;
  onCountPress?: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(
      withTiming(0.7, { duration: 60 }),
      withTiming(1.35, { duration: 80 }),
      withTiming(1, { duration: 80 })
    );
    onToggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={liked ? `Gefällt mir entfernen, ${formattedCount} Likes` : `Gefällt mir, ${formattedCount} Likes`}
      accessibilityState={{ selected: liked }}
    >
      <Animated.View style={[
        styles.actionBtnInner,
        animStyle,
        liked && { backgroundColor: 'rgba(238,29,82,0.18)' },
      ]}>
        <Heart
          size={26}
          stroke={liked ? '#EE1D52' : '#FFFFFF'}
          strokeWidth={1.8}
          fill={liked ? '#EE1D52' : 'transparent'}
        />
      </Animated.View>
      {onCountPress ? (
        <Pressable onPress={onCountPress} hitSlop={8}>
          <Text style={[styles.actionCount, liked && { color: '#EE1D52' }]}>{formattedCount}</Text>
        </Pressable>
      ) : (
        <Text style={[styles.actionCount, liked && { color: '#EE1D52' }]}>{formattedCount}</Text>
      )}
    </Pressable>
  );
}

// ── VoiceButton ──────────────────────────────────────────────────────────────
// TTS-Button: liest den Post-Caption laut vor via Chatterbox (Replicate API)
// Wenn creatorUserId → voice_sample_url aus profiles → Creator-Stimme klonen

export function VoiceButton({
  postId,
  caption,
  creatorUserId,
}: {
  postId: string;
  caption: string;
  creatorUserId?: string | null;
}) {
  const voiceRefUrl = useCreatorVoiceSample(creatorUserId);
  const { isLoading, isPlaying, toggle } = useVoiceReader(postId, caption, 0.5, voiceRefUrl);
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePress = () => {
    if (isLoading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    scale.value = withSequence(
      withTiming(0.75, { duration: 60 }),
      withTiming(1.15, { duration: 80 }),
      withTiming(1, { duration: 80 }),
    );
    toggle();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.actionBtn}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Audio stoppen' : 'Text vorlesen'}
      accessibilityState={{ busy: isLoading }}
    >
      <Animated.View style={[
        styles.actionBtnInner,
        animStyle,
        isPlaying && voiceStyles.activeBg,
      ]}>
        {isLoading ? (
          <ActivityIndicator size={18} color="rgba(255,255,255,0.7)" />
        ) : isPlaying ? (
          <VolumeX size={24} stroke="#22D3EE" strokeWidth={1.8} />
        ) : (
          <Volume2 size={24} stroke="rgba(255,255,255,0.75)" strokeWidth={1.8} />
        )}
      </Animated.View>
    </Pressable>
  );
}

const voiceStyles = StyleSheet.create({
  activeBg: {
    backgroundColor: 'rgba(34,211,238,0.12)',
  },
});
