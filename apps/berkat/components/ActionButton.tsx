import { ActivityIndicator, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { PressFeedback } from './PressFeedback';
import { radius, space, ui } from '../theme/tokens';

/** One action pattern for contact, sign-in and retry; amber stays with purchases. */
export function ActionButton({ label, onPress, busy = false, disabled = false, quiet = false, style }: {
  label: string; onPress: () => void; busy?: boolean; disabled?: boolean; quiet?: boolean; style?: StyleProp<ViewStyle>;
}) {
  return <PressFeedback onPress={onPress} disabled={disabled || busy}
    accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: disabled || busy, busy }}
    style={[s.button, quiet && s.quiet, disabled && s.disabled, style]}>
    {busy ? <ActivityIndicator color={quiet ? ui.brand : ui.card} /> : null}
    <Text style={[s.label, quiet && s.quietLabel]}>{label}</Text>
  </PressFeedback>;
}
const s = StyleSheet.create({
  button: { minHeight: 48, paddingVertical: space.md, paddingHorizontal: space.lg, borderRadius: radius.pill, backgroundColor: ui.brand, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  label: { flexShrink: 1, fontSize: 15, lineHeight: 21, fontWeight: '700', color: ui.card, textAlign: 'center' },
  quiet: { backgroundColor: ui.bg },
  quietLabel: { color: ui.brand },
  disabled: { opacity: 0.45 },
});
