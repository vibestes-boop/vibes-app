import React from 'react';
import { Pressable, Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming, withSpring } from 'react-native-reanimated';
import {
  Heart,
  MessageCircle,
  Bookmark,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useCommentCount } from '@/lib/useComments';
import { useBookmark } from '@/lib/useBookmark';
import { feedItemStyles as styles } from './feedStyles';

export function ActionButton({
  icon: Icon,
  count,
  color = '#FFFFFF',
  onPress,
  accessibilityLabel,
}: {
  icon: React.ElementType;
  count?: string;
  color?: string;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

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
        <Icon size={26} stroke={color} strokeWidth={1.8} />
      </Animated.View>
      {count !== undefined && <Text style={styles.actionCount}>{count}</Text>}
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
}: {
  accentColor: string;
  liked: boolean;
  formattedCount: string;
  onToggle: () => void;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    scale.value = withSequence(
      withTiming(0.7, { duration: 60 }),
      withTiming(1.3, { duration: 80 }),
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
      <Animated.View style={[styles.actionBtnInner, animStyle]}>
        <Heart
          size={26}
          stroke={liked ? '#F472B6' : '#FFFFFF'}
          strokeWidth={1.8}
          fill={liked ? '#F472B6' : 'transparent'}
        />
      </Animated.View>
      <Text style={[styles.actionCount, liked && { color: '#F472B6' }]}>{formattedCount}</Text>
    </Pressable>
  );
}
