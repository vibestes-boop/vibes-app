import type { ReactNode } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView } from '@livekit/react-native';
import { createLocalVideoTrack } from 'livekit-client';
import { ChevronLeft, Radio, SwitchCamera } from 'lucide-react-native';
import { useCameraPreview, type CameraFacing } from '../lib/useCameraPreview';
import { PressFeedback } from './PressFeedback';
import { StageFeedback } from './StageFeedback';
import { stage, radius, space } from '../theme/tokens';

const createPreview = (facingMode: CameraFacing) => createLocalVideoTrack({ facingMode });

/** Local camera only. The live provider starts publishing after the explicit action. */
export function GoLiveGate({ onGoLive, onClose }: { onGoLive: (facing: CameraFacing) => void; onClose: () => void }) {
  const preview = useCameraPreview(createPreview, onGoLive, onClose);
  return <CameraPreviewView
    video={preview.track ? <VideoView videoTrack={preview.track} style={StyleSheet.absoluteFillObject} objectFit="cover" mirror={preview.facing === 'user'} /> : null}
    loading={preview.loading} busy={preview.busy} starting={preview.starting} error={preview.error}
    canStart={Boolean(preview.track) && !preview.loading && !preview.busy && !preview.starting}
    onRetry={preview.retry} onSwitch={() => void preview.switchCamera()} onStart={preview.start} onClose={preview.close} />;
}

export function CameraPreviewView({ video, loading, busy, starting, error, canStart, onRetry, onSwitch, onStart, onClose }: {
  video?: ReactNode; loading: boolean; busy: boolean; starting: boolean; error: string | null; canStart: boolean;
  onRetry: () => void; onSwitch: () => void; onStart: () => void; onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { fontScale } = useWindowDimensions();
  return <View style={s.screen}>
    {video}
    <View key={`head-${fontScale}`} style={[s.header, { paddingTop: insets.top + space.sm }]}>
      <PressFeedback onPress={onClose} style={s.back} accessibilityRole="button" accessibilityLabel="Zurück zur Vorbereitung">
        <ChevronLeft size={22} color={stage.text} />
      </PressFeedback>
      <View style={s.identity}>
        <Text style={s.title}>Kameravorschau</Text>
        <Text style={s.hint}>Nur du siehst das</Text>
      </View>
    </View>
    {error || loading ? <ScrollView style={s.feedback} contentContainerStyle={s.feedbackContent}>
      <StageFeedback title={loading ? 'Kamera wird geöffnet' : 'Kamera gerade nicht verfügbar'} loading={loading}
        body={error ?? undefined} action={error ? { label: 'Erneut versuchen', onPress: onRetry } : undefined} />
    </ScrollView> : <View style={s.space} pointerEvents="none" />}
    <View style={[s.controls, { paddingBottom: insets.bottom || space.lg }]}>
      <PressFeedback onPress={onSwitch} disabled={!canStart} style={s.switchButton}
        accessibilityRole="button" accessibilityLabel="Kamera wechseln" accessibilityState={{ disabled: !canStart, busy }}>
        {busy ? <ActivityIndicator color={stage.text} /> : <SwitchCamera size={22} color={stage.text} />}
      </PressFeedback>
      <PressFeedback onPress={onStart} disabled={!canStart} style={[s.start, !canStart && s.disabled]}
        accessibilityRole="button" accessibilityLabel="Live gehen" accessibilityState={{ disabled: !canStart, busy: starting }}>
        {starting ? <ActivityIndicator color={stage.ink} /> : <Radio size={20} color={stage.ink} />}
        <Text key={fontScale} style={s.startText}>{starting ? 'Wird verbunden …' : 'Live gehen'}</Text>
      </PressFeedback>
    </View>
  </View>;
}
const s = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFillObject, backgroundColor: stage.ink },
  header: { paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.md, backgroundColor: stage.control },
  back: { width: 44, minHeight: 44, borderRadius: radius.pill, backgroundColor: stage.control, alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: stage.text },
  hint: { fontSize: 12, lineHeight: 18, color: stage.textMuted },
  feedback: { flex: 1 },
  feedbackContent: { flexGrow: 1, justifyContent: 'center', padding: space.lg },
  space: { flex: 1 },
  controls: { paddingTop: space.md, paddingHorizontal: space.md, flexDirection: 'row', alignItems: 'stretch', gap: space.sm, backgroundColor: stage.control },
  switchButton: { width: 56, minHeight: 56, borderRadius: radius.pill, backgroundColor: stage.control, alignItems: 'center', justifyContent: 'center' },
  start: { flex: 1, minHeight: 56, borderRadius: radius.pill, backgroundColor: stage.text, paddingVertical: space.md, paddingHorizontal: space.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  startText: { flexShrink: 1, fontSize: 17, lineHeight: 23, fontWeight: '700', color: stage.ink, textAlign: 'center' },
  disabled: { opacity: 0.45 },
});
