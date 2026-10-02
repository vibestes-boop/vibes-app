import { BlurView } from 'expo-blur';
import type { GlassViewProps } from 'expo-glass-effect';
import { LinearGradient } from 'expo-linear-gradient';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { useEffect, useState, type ComponentType } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { useTheme } from '@/lib/useTheme';

// Older development binaries can lack this module even after the JS update.
// Resolve it only when both the compiled app and runtime support Liquid Glass.
let NativeGlassView: ComponentType<GlassViewProps> | undefined;
if (Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26) {
  try {
    const native = requireOptionalNativeModule('ExpoGlassEffect');
    if (native?.isLiquidGlassAvailable && native?.isGlassEffectAPIAvailable) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      NativeGlassView = (require('expo-glass-effect') as typeof import('expo-glass-effect')).GlassView;
    }
  } catch {
    // Frosted glass remains usable on older app binaries.
  }
}

function useReducedTransparency() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceTransparencyEnabled().then(value => {
      if (mounted) setReduced(value);
    }).catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceTransparencyChanged', setReduced);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return reduced;
}

type Props = ViewProps & {
  radius?: number;
  tone?: 'auto' | 'light' | 'dark';
  material?: 'glass' | 'solid';
  elevated?: boolean;
};

/** Controls use native glass; content cards use an opaque studio-lit surface.
 * Keep opacity at 1 on this component and its ancestors: native glass needs it.
 */
export function GlassSurface({ children, style, radius = 24, tone = 'auto', material = 'glass', elevated = true, ...props }: Props) {
  const { isDark } = useTheme();
  const dark = tone === 'auto' ? isDark : tone === 'dark';
  const reduced = useReducedTransparency();
  const native = material === 'glass' && !reduced && !!NativeGlassView;
  const frosted = material === 'glass' && !reduced && !native;
  const base = dark ? '#202227' : '#FFFFFF';

  return <View {...props} style={[
    { borderRadius: radius, borderCurve: 'continuous' },
    elevated && { shadowColor: '#121923', shadowOffset: { width: 0, height: 6 }, shadowRadius: 14, shadowOpacity: dark ? 0.2 : 0.09, elevation: 4 },
    style,
  ]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[StyleSheet.absoluteFill, { borderRadius: radius, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: native || frosted ? 'transparent' : base }]}>
      {native && NativeGlassView ? <NativeGlassView key={dark ? 'dark' : 'light'} colorScheme={dark ? 'dark' : 'light'} glassEffectStyle="regular" tintColor={dark ? 'rgba(24,26,31,0.2)' : 'rgba(255,255,255,0.18)'} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} /> : frosted ? <BlurView intensity={65} tint={dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} /> : null}
      {!reduced && <LinearGradient
        colors={dark ? ['rgba(255,255,255,0.11)', 'rgba(255,255,255,0.015)', 'rgba(0,0,0,0.06)'] : native ? ['rgba(255,255,255,0.4)', 'rgba(255,255,255,0.04)', 'rgba(230,234,240,0.16)'] : ['rgba(255,255,255,0.98)', 'rgba(255,255,255,0.55)', 'rgba(231,235,241,0.68)']}
        locations={[0, 0.52, 1]} start={{ x: 0.15, y: 0 }} end={{ x: 0.9, y: 1 }} style={StyleSheet.absoluteFill}
      />}
      <View style={[StyleSheet.absoluteFill, { borderRadius: radius, borderWidth: StyleSheet.hairlineWidth, borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(133,146,164,0.25)', borderTopColor: dark ? 'rgba(255,255,255,0.36)' : '#FFFFFF', borderLeftColor: dark ? 'rgba(255,255,255,0.23)' : 'rgba(255,255,255,0.95)' }]} />
    </View>
    {children}
  </View>;
}
