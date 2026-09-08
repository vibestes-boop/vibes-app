// Die Vollbild-Bühne für Stories UND Highlights.
//
// ── WARUM EINE KOMPONENTE UND NICHT ZWEI BILDSCHIRME ─────────────────────────
//
// Stories und Highlights sehen identisch aus: formatfüllendes Bild, ein Balken
// je Foto, zwei Tippflächen, Kopfzeile mit Verkäufer. Nur die QUELLE ist
// verschieden — 24 Stunden alt gegen dauerhaft. Zwei Dateien mit demselben
// Aufbau driften auseinander, und zwar genau dann, wenn an einer davon etwas
// behoben wird; dieselbe Begründung wie „Kein zweiter Weg, wo Serlo schon einen
// hat" (Übergabe, Abschnitt 4), nur eine Ebene tiefer.
//
// ⚠️ SIE LIEGT AUF DER BÜHNE (`stage`), nicht auf der hellen Fläche. Das ist
// keine Geschmacksfrage: Ein formatfüllendes Foto braucht einen dunklen Rand,
// sonst leuchtet der Bildschirm um das Bild herum und die Ware sieht flau aus.
// Deshalb setzt sie die Statusleiste auch selbst auf hell.
//
// ── WAS SIE BEWUSST NICHT KANN ───────────────────────────────────────────────
//
// Keine Reaktionen, keine Antworten, keine Umfragen. Berkats These bleibt: der
// Abend ist das Produkt. Eine Story macht neugierig und zeigt auf einen Termin;
// sie soll kein Aufenthaltsort werden. Der einzige Weg hier heraus führt
// deshalb ZUM VERKÄUFER — nicht in einen Chat.

import { useCallback, useEffect, useRef, useState } from 'react';

import { useWindowDimensions, ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';

import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';

import { useIsFocused } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, ImageOff, Pause, Play, RotateCcw, Trash2, X } from 'lucide-react-native';

import { useReducedMotion } from '../lib/useReducedMotion';
import { radius, space, stage } from '../theme/tokens';
import { Avatar } from './Avatar';
import { PressFeedback } from './PressFeedback';
import { StoryProgress } from './StoryProgress';

export type StageItem = { id: string; media_url: string };

type Props = {
  items: StageItem[];
  who: { username: string | null; avatarUrl: string | null } | null;
  caption?: string | null;
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  /** Called only after the current image is displayed in the foreground. */
  onSeen?: (itemId: string) => void;
  onDelete?: (itemId: string) => void;
  deleteLabel?: string;
  onOpenProfile: () => void;
  onClose: () => void;
};

export function StoryStage(props: Props) {
  const { items, loading, error, onClose, onSeen } = props;
  const focused = useIsFocused();
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [closed, setClosed] = useState(false);
  const [selection, setSelection] = useState({ id: '', index: 0, visit: 0 });
  const leaving = useRef(false);
  const seen = useRef(new Set<string>());
  const found = items.findIndex(item => item.id === selection.id);
  const index = found >= 0 ? found : Math.min(selection.index, Math.max(0, items.length - 1));
  const current = items[index];

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => setForeground(state === 'active'));
    return () => subscription.remove();
  }, []);
  // Preserve the visible image when a query refresh reorders or removes items.
  useEffect(() => {
    if (current) setSelection(value => value.id === current.id && value.index === index
      ? value : { ...value, id: current.id, index });
  }, [current?.id, index]);

  const leave = useCallback((action: () => void) => {
    if (leaving.current) return;
    leaving.current = true;
    setClosed(true);
    action();
  }, []);
  const close = useCallback(() => leave(onClose), [leave, onClose]);
  useEffect(() => {
    if (!loading && !error && items.length === 0) close();
  }, [loading, error, items.length, close]);

  const navigate = (offset: number) => {
    if (closed) return;
    const next = index + offset;
    if (next >= items.length) { close(); return; }
    if (next < 0) return;
    setSelection(value => ({ id: items[next].id, index: next, visit: value.visit + 1 }));
  };
  const markSeen = (id: string) => {
    if (seen.current.has(id)) return;
    seen.current.add(id);
    onSeen?.(id);
  };

  return <StoryFrame key={current ? JSON.stringify([current.id, current.media_url, selection.visit]) : 'pending'}
    {...props} current={current} index={index} active={focused && foreground && !closed}
    onClose={close} onOpenProfile={() => leave(props.onOpenProfile)} onSeen={markSeen}
    onPrevious={() => navigate(-1)} onNext={() => navigate(1)} />;
}

function StoryFrame({ current, index, active, items, who, caption, loading, error, onRetry,
  onClose, onOpenProfile, onSeen, onDelete, deleteLabel = 'Löschen', onPrevious, onNext }: Props & {
  current?: StageItem; index: number; active: boolean; onPrevious: () => void; onNext: () => void;
}) {
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const [imageState, setImageState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [paused, setPaused] = useState(false);
  const [held, setHeld] = useState(false);
  const request = useRef(0);
  const outcome = useRef<'loading' | 'ready' | 'error'>('loading');
  const mounted = useRef(true);
  const ready = Boolean(current && imageState === 'ready');
  const running = ready && active && !paused && !held && !reduced;
  useEffect(() => {
    if (ready && active && current) onSeen?.(current.id);
  }, [ready, active, current?.id, onSeen]);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const retry = () => {
    request.current++;
    outcome.current = 'loading';
    setImageState('loading');
    setAttempt(request.current);
  };
  const failed = current ? imageState === 'error' : error;

  return <View style={[s.screen, { paddingTop: insets.top + space.sm, paddingBottom: Math.max(insets.bottom, space.sm) }]}>
    <StatusBar style="light" />
    <View style={s.head}>
      {current ? <StoryProgress key={attempt} count={items.length} index={index} running={running} onComplete={onNext} /> : null}
      <View style={s.headRow}>
        <PressFeedback style={s.who} onPress={onOpenProfile} disabled={!who}
          accessibilityRole="button" accessibilityLabel={`Profil von ${who?.username ?? 'Verkäufer'}`}>
          <Avatar uri={who?.avatarUrl ?? null} name={who?.username} size={36} />
          <View style={s.whoText}>
            <Text key={`copy-0-${fontScale}`} numberOfLines={1} style={s.name}>{who?.username ?? 'Story'}</Text>
            <Text key={`copy-1-${fontScale}`} numberOfLines={2} style={s.caption}>{caption || 'Ein Einblick für dich'}</Text>
          </View>
        </PressFeedback>
        {current && !reduced ? <PressFeedback style={s.headBtn} onPress={() => setPaused(value => !value)}
          accessibilityRole="button" accessibilityLabel={paused ? 'Story fortsetzen' : 'Story pausieren'}>
          {paused ? <Play size={19} color={stage.text} /> : <Pause size={19} color={stage.text} />}
        </PressFeedback> : null}
        {onDelete && current ? <PressFeedback style={s.headBtn}
          onPress={() => { setPaused(true); onDelete(current.id); }} accessibilityRole="button" accessibilityLabel={deleteLabel}>
          <Trash2 size={19} color={stage.text} />
        </PressFeedback> : null}
        <PressFeedback style={s.headBtn} onPress={onClose} accessibilityRole="button" accessibilityLabel="Schließen">
          <X size={21} color={stage.text} />
        </PressFeedback>
      </View>
    </View>

    <View style={s.media}>
      {current ? <Image key={attempt} source={{ uri: current.media_url }} style={StyleSheet.absoluteFill}
        contentFit="contain" transition={0} cachePolicy="memory-disk" recyclingKey={current.media_url}
        onDisplay={() => { if (mounted.current && request.current === attempt && outcome.current === 'loading') {
          outcome.current = 'ready'; setImageState('ready');
        } }}
        onError={() => { if (mounted.current && request.current === attempt) {
          outcome.current = 'error'; setImageState('error');
        } }} /> : null}
      {current ? <View style={StyleSheet.absoluteFill} pointerEvents="box-none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Pressable style={[s.tap, { left: 0 }]} accessible={false} onPress={onPrevious}
          onPressIn={() => setHeld(true)} onLongPress={() => {}} onPressOut={() => setHeld(false)} />
        <Pressable style={[s.tap, { right: 0 }]} accessible={false} onPress={onNext}
          onPressIn={() => setHeld(true)} onLongPress={() => {}} onPressOut={() => setHeld(false)} />
      </View> : null}
      {!ready ? <View style={s.state} pointerEvents="box-none">
        <View style={s.stateIcon}>
          {failed ? <ImageOff size={26} color={stage.textMuted} /> : <ActivityIndicator color={stage.text} />}
        </View>
        <Text key={`copy-2-${fontScale}`} style={s.stateTitle}>{failed ? 'Das Bild kam nicht an' : loading || current ? 'Dein Bild lädt …' : 'Diese Story ist nicht mehr da'}</Text>
        {failed ? <>
          <Text key={`copy-3-${fontScale}`} style={s.stateBody}>Versuch es noch einmal oder blättere weiter.</Text>
          {current || onRetry ? <PressFeedback style={s.retry} onPress={current ? retry : onRetry}
            accessibilityRole="button" accessibilityLabel="Erneut laden">
            <RotateCcw size={17} color={stage.text} /><Text key={`copy-4-${fontScale}`} style={s.retryText}>Erneut laden</Text>
          </PressFeedback> : null}
        </> : null}
      </View> : null}
    </View>

    {current ? <View style={s.footer}>
      <PressFeedback style={s.headBtn} onPress={onPrevious} disabled={index === 0}
        accessibilityRole="button" accessibilityLabel="Vorheriges Bild" accessibilityState={{ disabled: index === 0 }}>
        <ChevronLeft size={22} color={index === 0 ? stage.textMuted : stage.text} />
      </PressFeedback>
      <View style={s.position}>
        <Text key={`copy-5-${fontScale}`} style={s.count}>{index + 1} von {items.length}</Text>
        <Text key={`copy-6-${fontScale}`} style={s.footerHint}>{reduced ? 'Zum Weiterblättern tippen' : paused || held ? 'Pausiert' : 'Zum Anhalten gedrückt halten'}</Text>
      </View>
      <PressFeedback style={s.headBtn} onPress={onNext} accessibilityRole="button"
        accessibilityLabel={index + 1 === items.length ? 'Story schließen' : 'Nächstes Bild'}>
        <ChevronRight size={22} color={stage.text} />
      </PressFeedback>
    </View> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: stage.ink },
  head: { paddingHorizontal: space.lg, gap: space.md, paddingBottom: space.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  who: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.sm, minWidth: 0 },
  whoText: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: '700', color: stage.text },
  caption: { fontSize: 12, color: stage.textMuted, marginTop: 2 },
  headBtn: { width: 44, height: 44, borderRadius: radius.pill, backgroundColor: stage.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  media: { flex: 1, minHeight: 0, marginHorizontal: space.md, borderRadius: radius.phone, backgroundColor: stage.surface, overflow: 'hidden' },
  tap: { position: 'absolute', top: 0, bottom: 0, width: '50%' },
  state: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.md },
  stateIcon: { width: 64, height: 64, borderRadius: radius.phone, backgroundColor: stage.surfaceHigh, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { fontSize: 18, fontWeight: '700', color: stage.text, textAlign: 'center' },
  stateBody: { fontSize: 14, lineHeight: 21, color: stage.textMuted, textAlign: 'center' },
  retry: { flexDirection: 'row', gap: space.sm, minHeight: 48, paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.pill, backgroundColor: stage.surfaceHigh, alignItems: 'center' },
  retryText: { fontSize: 14, fontWeight: '600', color: stage.text },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.md },
  position: { flex: 1, minWidth: 0, alignItems: 'center', gap: 3 },
  count: { fontSize: 14, fontWeight: '700', color: stage.text, fontVariant: ['tabular-nums'] },
  footerHint: { fontSize: 11, color: stage.textMuted, textAlign: 'center' },
});
