import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/lib/useTheme';

/** Neutral studio light, without a colored wash behind photos and people. */
export function StudioBackdrop() {
  const { isDark } = useTheme();
  return <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
    <LinearGradient colors={isDark ? ['#181A1F', '#0C0D10', '#17191D'] : ['#FFFFFF', '#F0F2F5', '#FAFBFD']} locations={[0, 0.55, 1]} start={{ x: 0.12, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill} />
    <LinearGradient colors={isDark ? ['rgba(255,255,255,0.035)', 'transparent'] : ['rgba(255,255,255,0.92)', 'rgba(255,255,255,0)']} start={{ x: 0, y: 0.3 }} end={{ x: 1, y: 0.8 }} style={StyleSheet.absoluteFill} />
  </View>;
}
