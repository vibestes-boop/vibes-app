import { useWindowDimensions, StyleSheet, Text, View } from 'react-native';

import { ChevronLeft, X } from 'lucide-react-native';

import { radius, space, stage, ui } from '../theme/tokens';
import { PressFeedback } from './PressFeedback';

/** A stable heading and close target, outside a sheet's scrolling content. */
export function SheetHeader({ title, subtitle, surface = 'ui', onClose, onBack, closeLabel = 'Schließen', closeText }: {
  title: string;
  subtitle?: string;
  surface?: 'ui' | 'stage';
  onClose: () => void;
  onBack?: () => void;
  closeLabel?: string;
  closeText?: string;
}) {
  const { fontScale } = useWindowDimensions();
  const dark = surface === 'stage';
  const color = dark ? stage.text : ui.text;
  const muted = dark ? stage.textMuted : ui.textMuted;
  const button = { backgroundColor: dark ? stage.surfaceHigh : ui.bg };
  return (
    <View style={[s.header, { borderBottomColor: dark ? stage.line : ui.line }]}>
      <View style={s.row}>
        {onBack ? <PressFeedback style={[s.button, button]} onPress={onBack}
          accessibilityRole="button" accessibilityLabel="Zurück">
          <ChevronLeft size={21} color={color} />
        </PressFeedback> : null}
        <View style={s.copy}>
          <Text key={`copy-0-${fontScale}`} accessibilityRole="header" style={[s.title, { color }]}>{title}</Text>
          {subtitle ? <Text key={`copy-1-${fontScale}`} style={[s.subtitle, { color: muted }]}>{subtitle}</Text> : null}
        </View>
        <PressFeedback style={[s.button, button, closeText ? s.textButton : null]} onPress={onClose}
          accessibilityRole="button" accessibilityLabel={closeLabel}>
          {closeText ? <Text key={`copy-2-${fontScale}`} style={[s.closeText, { color }]}>{closeText}</Text> : <X size={20} color={color} />}
        </PressFeedback>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: { paddingTop: space.md, paddingBottom: space.md, marginBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  copy: { flex: 1, minWidth: 0, paddingVertical: space.xs },
  title: { fontSize: 20, fontWeight: '700', letterSpacing: -0.4 },
  subtitle: { fontSize: 13, lineHeight: 19, marginTop: space.xs },
  button: { minWidth: 44, minHeight: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  textButton: { paddingHorizontal: space.md, paddingVertical: space.sm, maxWidth: '38%' },
  closeText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
