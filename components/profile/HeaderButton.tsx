import { GlassSurface } from '@/components/ui/GlassSurface';
import { useTheme } from '@/lib/useTheme';
import * as Haptics from 'expo-haptics';
import { type ElementType } from 'react';
import { Pressable,StyleSheet,Text,View } from 'react-native';
import { useAnimatedStyle,useSharedValue,withTiming } from 'react-native-reanimated';
import { getProfileStyles } from './profileStyles';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _animMod = require('react-native-reanimated') as any; const _animNS = _animMod?.default ?? _animMod;
const Animated = { View: _animNS?.View ?? _animMod?.View };


export function HeaderButton({
  icon: Icon,
  onPress,
  badge,
  label,
}: {
  icon: ElementType;
  onPress: () => void;
  badge?: number;
  label: string;
}) {
  const scale = useSharedValue(1);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const { colors } = useTheme();
  const s = getProfileStyles(colors);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
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
      <Animated.View style={[s.hBtn, { backgroundColor: 'transparent', borderWidth: 0 }, anim]}>
        <GlassSurface radius={22} style={StyleSheet.absoluteFill} />
        <Icon size={20} color={colors.icon.default} strokeWidth={1.8} />
        {badge != null && badge > 0 && (
          <View style={s.hBadge}>
            <Text style={s.hBadgeText}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </Animated.View>
    </Pressable>
  );
}
