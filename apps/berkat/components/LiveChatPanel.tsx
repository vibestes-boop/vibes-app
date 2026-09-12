import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import { ActivityIndicator, Animated, Keyboard, PanResponder, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ChevronRight, MessageSquare, SendHorizontal } from 'lucide-react-native';
import type { LiveComment } from '../lib/useLiveChat';
import type { MiniProfile } from '../lib/useAuction';
import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, space, stage } from '../theme/tokens';
import { Avatar } from './Avatar';
import { PressFeedback } from './PressFeedback';

type Props = {
  comments: LiveComment[]; profiles: Record<string, MiniProfile>;
  hidden: boolean; onHiddenChange: (hidden: boolean) => void;
  inputRef: RefObject<TextInput | null>; draft: string; onChangeText: (text: string) => void;
  onSend: () => void; sending: boolean; sendDisabled: boolean;
};

export function LiveChatPanel({ comments, profiles, hidden, onHiddenChange, inputRef, draft, onChangeText, onSend, sending, sendDisabled }: Props) {
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
    <Animated.View style={[s.column, { transform: [{ translateX: x }] }]} {...pan.panHandlers}
      pointerEvents={hidden ? 'none' : 'auto'} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}>
      <ScrollView ref={history} style={s.history} contentContainerStyle={s.comments}
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" indicatorStyle="white"
        onContentSizeChange={scrollToLatest} onLayout={scrollToLatest}
        onScroll={({ nativeEvent: e }) => { atBottom.current = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height < 40; }} scrollEventThrottle={100}>
        {comments.map(comment => {
          const author = profiles[comment.user_id];
          return <View key={`${comment.id}:${fontScale}`} style={s.line}>
            <Avatar uri={author?.avatarUrl} name={author?.username} size={22} />
            <View style={s.bubble}>
              <Text style={s.name}>{author?.username ?? 'Zuschauer'}</Text>
              <Text style={s.text}>{comment.text}</Text>
            </View>
          </View>;
        })}
      </ScrollView>
      <View style={s.inputRow}>
        <TextInput ref={inputRef} value={draft} onChangeText={onChangeText} placeholder="Schreibe etwas …"
          accessibilityLabel="Live-Kommentar" placeholderTextColor={stage.textMuted} style={s.input}
          returnKeyType="send" onSubmitEditing={() => { if (!sendDisabled) onSend(); }} maxLength={300} />
        <PressFeedback onPress={onSend} disabled={sendDisabled} style={[s.send, sendDisabled && s.disabled]}
          accessibilityRole="button" accessibilityLabel={sending ? 'Kommentar wird gesendet' : 'Kommentar senden'}
          accessibilityState={{ disabled: sendDisabled, busy: sending }}>
          {sending ? <ActivityIndicator color={stage.ink} /> : <SendHorizontal size={18} color={stage.ink} />}
        </PressFeedback>
      </View>
    </Animated.View>
    {hidden ? <PressFeedback onPress={() => onHiddenChange(false)} style={s.reveal} accessibilityRole="button" accessibilityLabel="Kommentare einblenden">
      <MessageSquare size={18} color={stage.text} /><ChevronRight size={15} color={stage.textMuted} />
    </PressFeedback> : null}
  </View>;
}
const s = StyleSheet.create({
  wrap: { flex: 1, maxHeight: '100%', minHeight: 44, paddingLeft: space.md, paddingBottom: space.xs },
  column: { maxHeight: '100%', gap: space.sm },
  history: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  comments: { gap: space.xs, paddingBottom: space.xs },
  line: { flexDirection: 'row', alignItems: 'flex-end', gap: 6, maxWidth: '96%' },
  bubble: { flexShrink: 1, backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: radius.sm, paddingHorizontal: space.sm, paddingVertical: space.xs },
  name: { fontSize: 11, lineHeight: 16, color: stage.textMuted },
  text: { fontSize: 13, lineHeight: 19, fontWeight: '600', color: stage.text },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginRight: space.sm },
  input: { flex: 1, minWidth: 0, minHeight: 44, paddingVertical: 10, paddingHorizontal: space.md, borderRadius: radius.pill, borderWidth: 1, borderColor: stage.lineStrong, backgroundColor: stage.control, fontSize: 13, color: stage.text },
  send: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: stage.text, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.45 },
  reveal: { position: 'absolute', left: 0, bottom: space.sm, minWidth: 52, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: stage.control, borderTopRightRadius: radius.pill, borderBottomRightRadius: radius.pill },
});
