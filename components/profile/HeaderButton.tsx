import { type ElementType } from 'react';
import { View, Text, Pressable } from 'react-native';
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };
import { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getProfileStyles } from './profileStyles';
import { useTheme } from '@/lib/useTheme';


export function HeaderButton({
  icon: Icon,
  onPress,
  badge,
}: {
  icon: ElementType;
  onPress: () => void;
  badge?: number;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { colors } = useTheme();
  const s = getProfileStyles(colors);

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withTiming(0.82, { duration: 80 });
      }}
      onPressOut={() => {
        scale.value = withTiming(1, { duration: 80 });
      }}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
    >
      <Animated.View style={[s.hBtn, anim]}>
        <Icon size={17} color={colors.icon.default} strokeWidth={1.8} />
        {badge != null && badge > 0 && (
          <View style={s.hBadge}>
            <Text style={s.hBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
