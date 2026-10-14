import { Text } from 'react-native';
import { darkColors } from '@/lib/theme';
import { useTheme } from '@/lib/useTheme';

export function SerloWordmark({ size = 30, inverse = false }: { size?: number; inverse?: boolean }) {
  const { colors } = useTheme();
  return <Text accessibilityLabel="Serlo" allowFontScaling={false} numberOfLines={1} style={{ fontFamily: 'Inter_800ExtraBold', fontSize: size, lineHeight: size * 1.2, letterSpacing: -size * 0.06, color: inverse ? darkColors.text.primary : colors.text.primary }}>serlo<Text style={{ color: inverse ? darkColors.accent.primary : colors.accent.primary }}>.</Text></Text>;
}
