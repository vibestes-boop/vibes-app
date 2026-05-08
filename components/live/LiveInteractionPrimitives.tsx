import { Image } from 'expo-image';
import { memo,useCallback,useEffect,useRef } from 'react';
import {
  Dimensions,
  ImageStyle,
  Pressable,
  StyleProp,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import {
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { LiveReactionIcon } from '@/components/live/LiveReactionIcon';
import type { LiveComment,LiveReaction } from '@/lib/useLiveSession';

// react-native-reanimated: CJS require() vermeidet _interopRequireDefault Crash in Hermes HBC.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any;
const _animNS = _animMod?.default ?? _animMod;
const Animated = {
  View: _animNS?.View ?? _animMod?.View,
};

const { width: SCREEN_W } = Dimensions.get('window');

export type TapHeart = {
  id: number;
  x: number;
  y: number;
};

type LivePrimitiveStyles = {
  floatingHeartWrap: StyleProp<ViewStyle>;
  reactionBubble: StyleProp<ViewStyle>;
  commentRow: StyleProp<ViewStyle>;
  systemText: StyleProp<TextStyle>;
  commentInner: StyleProp<ViewStyle>;
  commentAvatar: StyleProp<ImageStyle>;
  commentAvatarFallback: StyleProp<ViewStyle>;
  commentAvatarInitial: StyleProp<TextStyle>;
  commentStack: StyleProp<ViewStyle>;
  commentUserRow: StyleProp<ViewStyle>;
  commentUser: StyleProp<TextStyle>;
  commentBadge: StyleProp<ViewStyle>;
  commentBadgeHost: StyleProp<ViewStyle>;
  commentBadgeMod: StyleProp<ViewStyle>;
  commentBadgeGifter: StyleProp<ViewStyle>;
  commentBadgeText: StyleProp<TextStyle>;
  commentText: StyleProp<TextStyle>;
};

function FloatingHeart({
  reaction,
  styles,
}: {
  reaction: LiveReaction;
  styles: LivePrimitiveStyles;
}) {
  const x = SCREEN_W * 0.52 + Math.random() * (SCREEN_W * 0.28);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 7, stiffness: 140 });
    translateY.value = withTiming(-300, { duration: 2600 });
    opacity.value = withDelay(1800, withTiming(0, { duration: 800 }));
    rotate.value = withRepeat(
      withSequence(
        withTiming(-0.18, { duration: 280 }),
        withTiming(0.18, { duration: 280 }),
      ),
      -1,
      true,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}rad` },
    ],
    opacity: opacity.value,
    left: x,
  }));

  return (
    <Animated.View style={[styles.floatingHeartWrap, animStyle]}>
      <LiveReactionIcon emoji="❤️" size={36} />
    </Animated.View>
  );
}

function OtherReactionBubble({
  reaction,
  styles,
  leftRange,
}: {
  reaction: LiveReaction;
  styles: LivePrimitiveStyles;
  leftRange: number;
}) {
  const left = 20 + Math.random() * leftRange;
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    translateY.value = withTiming(-220, { duration: 2800 });
    opacity.value = withSequence(
      withTiming(1, { duration: 100 }),
      withTiming(0, { duration: 2700 }),
    );
  }, [opacity, translateY]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
    left,
  }));

  return (
    <Animated.View style={[styles.reactionBubble, style]}>
      <LiveReactionIcon emoji={reaction.emoji} size={42} />
    </Animated.View>
  );
}

export function LiveReactionBubble({
  reaction,
  styles,
  leftRange = 80,
}: {
  reaction: LiveReaction;
  styles: LivePrimitiveStyles;
  leftRange?: number;
}) {
  if (reaction.emoji === '❤️') return <FloatingHeart reaction={reaction} styles={styles} />;
  return <OtherReactionBubble reaction={reaction} styles={styles} leftRange={leftRange} />;
}

export function TapHeartBurst({
  tapHeart,
  onDone,
}: {
  tapHeart: TapHeart;
  onDone: (id: number) => void;
}) {
  return (
    <TapHeartParticle
      x={tapHeart.x}
      y={tapHeart.y}
      onDone={() => onDone(tapHeart.id)}
    />
  );
}

function TapHeartParticle({
  x,
  y,
  onDone,
}: {
  x: number;
  y: number;
  onDone: () => void;
}) {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue((Math.random() - 0.5) * 0.6);

  const params = useRef({
    driftY: 180 + Math.random() * 140,
    driftX: (Math.random() - 0.5) * 80,
    swayMag: 12 + Math.random() * 16,
    swayPeriod: 600 + Math.random() * 500,
    duration: 1100 + Math.random() * 500,
    peakScale: 1.1 + Math.random() * 0.3,
    rotateEnd: (Math.random() - 0.5) * 1.0,
  }).current;

  useEffect(() => {
    const doneTimer = setTimeout(onDone, params.duration + 200);

    scale.value = withSequence(
      withSpring(params.peakScale, { damping: 5, stiffness: 260 }),
      withTiming(0.85, { duration: 200 }),
    );
    opacity.value = withSequence(
      withTiming(1, { duration: 80 }),
      withDelay(params.duration * 0.55, withTiming(0, { duration: params.duration * 0.45 })),
    );
    translateY.value = withTiming(-params.driftY, { duration: params.duration });
    rotate.value = withTiming(params.rotateEnd, { duration: params.duration });
    translateX.value = withRepeat(
      withSequence(
        withTiming(params.driftX + params.swayMag, { duration: params.swayPeriod }),
        withTiming(params.driftX - params.swayMag, { duration: params.swayPeriod }),
      ),
      -1,
      true,
    );

    return () => clearTimeout(doneTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x - 18,
    top: y - 18,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}rad` },
    ],
    opacity: opacity.value,
    zIndex: 200,
  }));

  return (
    <Animated.View style={style} pointerEvents="none">
      <LiveReactionIcon emoji="❤️" size={36} />
    </Animated.View>
  );
}

type LiveCommentWithSystem = LiveComment & { isSystem?: boolean };

function LiveCommentRowComponent({
  comment,
  styles,
  isHost,
  isModerator,
  isTopGifter,
  onUserSelect,
  onModerate,
  withExitAnimation = false,
}: {
  comment: LiveCommentWithSystem;
  styles: LivePrimitiveStyles;
  isHost?: boolean;
  isModerator?: boolean;
  isTopGifter?: boolean;
  onUserSelect: (userId: string) => void;
  onModerate: ((comment: LiveCommentWithSystem) => void) | null;
  withExitAnimation?: boolean;
}) {
  const isSystem = Boolean(comment.isSystem);
  const avatar = comment.profiles?.avatar_url;
  const username = comment.profiles?.username ?? 'User';
  const initials = username[0]?.toUpperCase() ?? '?';

  const handlePress = useCallback(() => {
    if (isSystem) return;
    onUserSelect(comment.user_id);
  }, [isSystem, onUserSelect, comment.user_id]);

  const handleLongPress = useCallback(() => {
    if (isSystem || !onModerate) return;
    onModerate(comment);
  }, [isSystem, onModerate, comment]);

  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={withExitAnimation ? FadeOutUp.duration(150) : undefined}
      style={styles.commentRow}
    >
      {isSystem ? (
        <Text style={styles.systemText}>{comment.text}</Text>
      ) : (
        <Pressable
          onPress={handlePress}
          onLongPress={onModerate ? handleLongPress : undefined}
          delayLongPress={500}
          style={styles.commentInner}
        >
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.commentAvatar} contentFit="cover" />
          ) : (
            <View style={[styles.commentAvatar as StyleProp<ViewStyle>, styles.commentAvatarFallback]}>
              <Text style={styles.commentAvatarInitial}>{initials}</Text>
            </View>
          )}
          <View style={styles.commentStack}>
            <View style={styles.commentUserRow}>
              <Text style={styles.commentUser} numberOfLines={1}>{username}</Text>
              {isHost ? (
                <View style={[styles.commentBadge, styles.commentBadgeHost]}>
                  <Text style={styles.commentBadgeText}>HOST</Text>
                </View>
              ) : null}
              {isModerator ? (
                <View style={[styles.commentBadge, styles.commentBadgeMod]}>
                  <Text style={styles.commentBadgeText}>🛡 MOD</Text>
                </View>
              ) : null}
              {isTopGifter ? (
                <View style={[styles.commentBadge, styles.commentBadgeGifter]}>
                  <Text style={styles.commentBadgeText}>★ TOP</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.commentText}>{comment.text}</Text>
          </View>
        </Pressable>
      )}
    </Animated.View>
  );
}

export const LiveCommentRow = memo(LiveCommentRowComponent);
