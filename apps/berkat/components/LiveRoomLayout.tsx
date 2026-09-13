import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { keyboardKit } from '../lib/keyboardKit';
import { space } from '../theme/tokens';

const KeyboardBody = keyboardKit?.KeyboardAvoidingView ?? KeyboardAvoidingView;
/** One keyboard owner; composer is a bottom sibling, never part of the chat's intrinsic height. */
export function LiveRoomLayout({ header, banner, chat, composer, rail, effects, auction, onHeaderLayout }: {
  header: ReactNode; banner?: ReactNode; chat: (typing: boolean) => ReactNode;
  composer: ReactNode; rail: ReactNode; effects?: ReactNode;
  auction: (compact: boolean) => ReactNode;
  onHeaderLayout?: (event: LayoutChangeEvent) => void;
}) {
  const insets = useSafeAreaInsets();
  const { height, fontScale } = useWindowDimensions();
  const [keyboardHeight, setKeyboardHeight] = useState(Keyboard.metrics()?.height ?? 0);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow', event => {
      setKeyboardHeight(Platform.OS === 'ios' ? Math.max(0, Math.min(event.endCoordinates.height, height - event.endCoordinates.screenY)) : event.endCoordinates.height);
    });
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, [height]);
  const typing = keyboardHeight > 0;
  const available = Math.max(120, height - insets.top - (Platform.OS === 'ios' ? Math.max(keyboardHeight, insets.bottom) : typing ? 0 : insets.bottom));
  return <KeyboardBody style={[s.column, { paddingTop: insets.top + space.xs }]}
    behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0} pointerEvents="box-none">
    <ScrollView onLayout={onHeaderLayout} style={{ flexGrow: 0, flexShrink: 0, maxHeight: available * (typing ? 0.3 : 0.28) }}
      keyboardShouldPersistTaps="handled" indicatorStyle="white">
      {header}{banner}
    </ScrollView>
    <View style={s.middle} pointerEvents="box-none">
      <View style={[s.chat, { maxHeight: Math.min(typing ? 78 : fontScale > 1.4 ? 112 : 124, available * 0.22) }]} pointerEvents="box-none">
        {chat(typing)}
      </View>
      {!typing ? <View style={s.rail} pointerEvents="box-none">{rail}</View> : null}
      {effects}
    </View>
    <View style={s.dock} pointerEvents="box-none" testID="live-dock">
      <LinearGradient colors={['rgba(21,12,24,0)', 'rgba(21,12,24,0.65)']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      {/* The only auction scroll surface is a fallback for large type / short windows. */}
      <ScrollView style={{ flexGrow: 0, flexShrink: 1, maxHeight: available * (typing ? 0.28 : 0.42) }}
        contentContainerStyle={s.auction} keyboardShouldPersistTaps="handled" indicatorStyle="white">
        {auction(typing)}
      </ScrollView>
      <View testID="live-composer-slot">{composer}</View>
      <View style={{ height: typing ? space.xs : Math.max(insets.bottom, space.sm) }} pointerEvents="none" />
    </View>
  </KeyboardBody>;
}
const s = StyleSheet.create({
  column: { flex: 1 },
  middle: { flex: 1, minHeight: 0, flexDirection: 'row', alignItems: 'flex-end', overflow: 'hidden' },
  chat: { flex: 1, minWidth: 0, flexShrink: 1 },
  rail: { paddingHorizontal: space.sm, paddingBottom: space.sm, gap: 8 },
  dock: { flexShrink: 0 },
  auction: { paddingTop: space.xs, paddingBottom: space.xs },
});
