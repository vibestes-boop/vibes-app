import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { ActivityIndicator, Animated, Keyboard, PanResponder, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ChevronRight, MessageSquare, SendHorizontal } from 'lucide-react-native';
import type { LiveComment } from '../lib/useLiveChat';
import type { MiniProfile } from '../lib/useAuction';
import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, space, stage } from '../theme/tokens';
import { StageSheet } from './StageSheet';
import { PressFeedback } from './PressFeedback';

type Props = {
  comments: LiveComment[]; profiles: Record<string, MiniProfile>;
  hidden: boolean; onHiddenChange: (hidden: boolean) => void; compact?: boolean;
};

export function LiveChatPanel({ comments, profiles, hidden, onHiddenChange, compact = false }: Props) {
  const { width, fontScale } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  const history = useRef<ScrollView>(null);
  const atBottom = useRef(true);
  const moveTo = useCallback((hide: boolean) => {
    x.stopAnimation();
    const toValue = hide ? -(width + space.lg) : 0;
    if (reducedMotion) x.setValue(toValue);
    else Animated.spring(x, { toValue, useNativeDriver: true, friction: 9, tension: 70 }).start();
  }, [x, width, reducedMotion]);
  useEffect(() => {
    if (hidden) Keyboard.dismiss();
    moveTo(hidden);
    return () => x.stopAnimation();
  }, [hidden, moveTo, x]);
  const pan = useMemo(() => PanResponder.create({
    // Claim horizontal swipes before the history ScrollView; vertical reading stays with it.
    onMoveShouldSetPanResponderCapture: (_event, gesture) => !hidden && gesture.dx < -14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
    onPanResponderMove: (_event, gesture) => { if (gesture.dx < 0 && !reducedMotion) x.setValue(gesture.dx); },
    onPanResponderRelease: (_event, gesture) => {
      if (gesture.dx < -70) onHiddenChange(true);
      else moveTo(false);
    },
    onPanResponderTerminate: () => moveTo(hidden),
  }), [hidden, moveTo, onHiddenChange, reducedMotion, x]);
  const scrollToLatest = () => { if (atBottom.current) history.current?.scrollToEnd({ animated: false }); };
  return <View style={s.wrap} pointerEvents="box-none">
    <Animated.View style={[s.column, hidden && { height: 0 }, { transform: [{ translateX: x }] }]} {...pan.panHandlers}
      pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
      <ScrollView ref={history} style={s.history} contentContainerStyle={s.comments}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" indicatorStyle="white"
        onContentSizeChange={scrollToLatest} onLayout={scrollToLatest}
        onScroll={({ nativeEvent: e }) => { atBottom.current = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height < 40; }} scrollEventThrottle={100}>
        {comments.slice(-(compact || fontScale > 1.4 ? 1 : 2)).map(comment => <View key={`${comment.id}:${fontScale}`} style={s.line}>
          <Text numberOfLines={compact && fontScale > 1.4 ? 1 : 2} style={s.text}><Text style={s.name}>{profiles[comment.user_id]?.username ?? 'Zuschauer'}  </Text>{comment.text}</Text>
        </View>)}
      </ScrollView>
      </Animated.View>
    {hidden ? <PressFeedback onPress={() => onHiddenChange(false)} style={s.reveal} accessibilityRole="button" accessibilityLabel="Kommentare einblenden">
      <MessageSquare size={18} color={stage.text} /><ChevronRight size={15} color={stage.textMuted} />
    </PressFeedback> : null}
  </View>;
}
/** This instance survives keyboard, font and auction changes, preserving selection and draft. */
export function LiveComposer({ inputRef, draft, onChangeText, onSend, sending, sendDisabled }: {
  inputRef: RefObject<TextInput | null>; draft: string; onChangeText: (text: string) => void;
  onSend: () => void; sending: boolean; sendDisabled: boolean;
}) {
  const { fontScale } = useWindowDimensions();
  const submit = () => { if (!sendDisabled && !sending) onSend(); };
  return <View style={s.inputRow} testID="live-composer">
    <TextInput ref={inputRef} value={draft} onChangeText={onChangeText} placeholder="Schreibe etwas …"
      accessibilityLabel="Live-Kommentar" placeholderTextColor={stage.textMuted}
      style={[s.input, { fontSize: 14 * fontScale }]} allowFontScaling={false}
      returnKeyType="send" submitBehavior="submit" onSubmitEditing={submit} maxLength={300} />
    <PressFeedback onPress={submit} disabled={sendDisabled || sending} style={[s.send, !sendDisabled && s.sendReady]}
      accessibilityRole="button" accessibilityLabel={sending ? 'Kommentar wird gesendet' : 'Kommentar senden'}
      accessibilityState={{ disabled: sendDisabled || sending, busy: sending }}>
      {sending ? <ActivityIndicator color={stage.text} /> : <SendHorizontal size={19} color={sendDisabled ? stage.textMuted : stage.ink} />}
    </PressFeedback>
  </View>;
}

export function LiveChatHistory({ visible, onClose, comments, profiles }: {
  visible: boolean; onClose: () => void; comments: LiveComment[]; profiles: Record<string, MiniProfile>;
}) {
  const { fontScale } = useWindowDimensions();
  return <StageSheet visible={visible} onClose={onClose} title="Chatverlauf">
    {comments.length ? comments.map(comment => <Text key={`${comment.id}:${fontScale}`} style={s.historyText}>
      <Text style={s.name}>{profiles[comment.user_id]?.username ?? 'Zuschauer'}  </Text>{comment.text}
    </Text>) : <Text key={fontScale} style={s.historyText}>Hier erscheinen die Kommentare dieser Show.</Text>}
  </StageSheet>;
}
const s = StyleSheet.create({
  wrap: { maxHeight: '100%', minHeight: 0, paddingHorizontal: space.md, paddingBottom: space.xs },
  column: { maxHeight: '100%' },
  history: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  comments: { gap: space.xs, paddingBottom: space.xs },
  line: { alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: stage.scrim, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  name: { fontWeight: '700', color: stage.text },
  text: { fontSize: 13, lineHeight: 19, color: stage.text },
  historyText: { fontSize: 15, lineHeight: 23, color: stage.text, paddingVertical: space.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: stage.lineStrong, backgroundColor: stage.control, paddingRight: 3 },
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 10, paddingHorizontal: space.md, color: stage.text },
  send: { width: 44, height: 44, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  sendReady: { backgroundColor: stage.text },
  reveal: { minWidth: 52, minHeight: 44, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: stage.control, borderRadius: radius.pill },
});
