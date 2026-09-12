import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardKit } from '../lib/keyboardKit';
import { space } from '../theme/tokens';

const KeyboardBody = keyboardKit?.KeyboardAvoidingView ?? KeyboardAvoidingView;
/** Shared live geometry. Slots keep server actions in the room and allow native layout checks. */
export function LiveRoomLayout({ header, banner, chat, rail, effects, auction, onHeaderLayout }: {
  header: ReactNode; banner?: ReactNode; chat: ReactNode; rail: ReactNode; effects?: ReactNode;
  auction: (detailsMaxHeight: number | undefined) => ReactNode;
  onHeaderLayout?: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const [keyboardUp, setKeyboardUp] = useState(Keyboard.isVisible());
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setKeyboardUp(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardUp(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const safeBottom = insets.bottom || space.sm;
  const available = height - insets.top - insets.bottom;
  return <KeyboardBody style={[s.column, { paddingTop: insets.top + space.xs }]}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    keyboardVerticalOffset={Platform.OS === 'ios' ? -Math.max(safeBottom - space.sm, 0) : 0}
    pointerEvents="box-none">
    <ScrollView onLayout={onHeaderLayout}
      style={{ flexGrow: 0, flexShrink: 0, maxHeight: available * (keyboardUp ? 0.25 : 0.32) }}
      keyboardShouldPersistTaps="handled" indicatorStyle="white">
      {header}
      {banner}
    </ScrollView>
    <View style={s.middle} pointerEvents="box-none">
      <View style={{ flex: 1, maxHeight: keyboardUp ? '100%' : Math.min(280, available * 0.36) }} pointerEvents="box-none">{chat}</View>
      <ScrollView style={s.rail} contentContainerStyle={s.railContent} indicatorStyle="white" keyboardShouldPersistTaps="handled">{rail}</ScrollView>
      {effects}
    </View>
    {!keyboardUp ? <ScrollView style={{ flexGrow: 0, flexShrink: 1, maxHeight: available * 0.7 }}
      contentContainerStyle={{ paddingTop: space.sm }} keyboardShouldPersistTaps="handled" indicatorStyle="white">
      {auction(Math.max(fontScale > 1.3 ? 160 : 120, available * 0.52 - 220 * fontScale))}
    </ScrollView> : null}
    {/* A constant bottom inset shares the native keyboard animation instead of switching padding values. */}
    <View style={{ height: safeBottom }} pointerEvents="none" />
  </KeyboardBody>;
}
const s = StyleSheet.create({
  column: { flex: 1 },
  middle: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'flex-end' },
  rail: { flexGrow: 0, flexShrink: 0, maxHeight: '100%' },
  railContent: { paddingRight: space.sm, paddingBottom: space.md, gap: 14 },
});
