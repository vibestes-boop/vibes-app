import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, space, stage } from '../theme/tokens';
import { SheetHeader } from './SheetHeader';

/** Details leave the stage only on request. The close target never scrolls away. */
export function StageSheet({ visible, title, onClose, onDismiss, children }: {
  visible: boolean; title: string; onClose: () => void; onDismiss?: () => void; children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const [contentHeight, setContentHeight] = useState(240);
  const [headerHeight, setHeaderHeight] = useState(90);
  const sheetHeight = Math.min(height - insets.top - space.md, headerHeight + contentHeight + insets.bottom + space.sm);
  const wasVisible = useRef(visible);
  useEffect(() => {
    if (Platform.OS !== 'ios' && wasVisible.current && !visible) onDismiss?.();
    wasVisible.current = visible;
  }, [visible, onDismiss]);
  return <Modal transparent visible={visible} animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} onDismiss={onDismiss}>
    <View style={s.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Blatt schließen" accessibilityRole="button" />
      <View style={[s.sheet, { height: sheetHeight, paddingBottom: insets.bottom + space.sm }]}>
        <View onLayout={event => setHeaderHeight(event.nativeEvent.layout.height)}>
          <SheetHeader title={title} surface="stage" onClose={onClose} />
        </View>
        <ScrollView style={s.scroll} contentContainerStyle={s.content} onContentSizeChange={(_width, size) => setContentHeight(size)} keyboardShouldPersistTaps="handled" indicatorStyle="white">{children}</ScrollView>
      </View>
    </View>
  </Modal>;
}
const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: stage.scrim },
  sheet: { backgroundColor: stage.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingHorizontal: space.lg },
  scroll: { flex: 1, minHeight: 0 },
  content: { paddingBottom: space.md, gap: space.sm },
});
