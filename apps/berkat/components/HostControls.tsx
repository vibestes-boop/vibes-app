import { useState } from 'react';
import { ActivityIndicator, Keyboard, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useConnectionState, useLocalParticipant } from '@livekit/react-native';
import { ConnectionState, type LocalVideoTrack } from 'livekit-client';
import { Mic, MicOff, SwitchCamera, Video, VideoOff } from 'lucide-react-native';
import { useLivePlayer } from '../lib/livePlayer';
import { useHostMediaControls } from '../lib/useHostMediaControls';
import { PressFeedback } from './PressFeedback';
import { StageSheet } from './StageSheet';
import { stage, radius, space } from '../theme/tokens';

export function HostControls() {
  const connection = useConnectionState();
  const { localParticipant, isCameraEnabled, isMicrophoneEnabled, cameraTrack } = useLocalParticipant();
  const initialFacing = useLivePlayer(s => s.cameraFacing);
  const media = useHostMediaControls({ participant: localParticipant, track: cameraTrack?.track as LocalVideoTrack | undefined,
    connected: connection === ConnectionState.Connected, cameraEnabled: isCameraEnabled, micEnabled: isMicrophoneEnabled, initialFacing });
  return <HostControlsView connection={connection} cameraEnabled={isCameraEnabled} micEnabled={isMicrophoneEnabled}
    hasCamera={Boolean(cameraTrack?.track)} {...media} />;
}

/** The real controls and native QA use the same complete layout. */
export function HostControlsView({ connection, cameraEnabled, micEnabled, hasCamera, pending, error, toggleCamera, toggleMic, switchCamera, retry }: {
  connection: string; cameraEnabled: boolean; micEnabled: boolean; hasCamera: boolean;
  pending: 'camera' | 'mic' | 'switch' | null; error: string | null;
  toggleCamera: () => unknown; toggleMic: () => unknown; switchCamera: () => unknown; retry: () => unknown;
}) {
  const { fontScale } = useWindowDimensions();
  const [toolsOpen, setToolsOpen] = useState(false);
  const connected = connection === 'connected';
  const disabled = !connected || Boolean(pending);
  const status = connected ? cameraEnabled ? 'Du sendest' : 'Kamera aus'
    : ['connecting', 'reconnecting', 'signalReconnecting'].includes(connection) ? 'Verbinden …' : 'Nicht verbunden';
  return <View style={s.wrap} testID="host-controls">
    <View style={s.row}>
      <View style={s.status}>
        <View style={[s.dot, { backgroundColor: connected && cameraEnabled ? stage.lead : stage.live }]} />
        <Text key={`status-${fontScale}`} style={s.statusText}>{status}</Text>
      </View>
      <PressFeedback onPress={() => void toggleMic()} disabled={disabled} style={s.button} accessibilityRole="button"
        accessibilityLabel={micEnabled ? 'Mikrofon stumm' : 'Mikrofon an'} accessibilityState={{ disabled, busy: pending === 'mic' }}>
        {pending === 'mic' ? <ActivityIndicator color={stage.text} /> : micEnabled ? <Mic size={18} color={stage.text} /> : <MicOff size={18} color={stage.live} />}
      </PressFeedback>
      <PressFeedback onPress={() => { Keyboard.dismiss(); setToolsOpen(true); }} style={s.button} accessibilityRole="button" accessibilityLabel="Kamera-Werkzeuge öffnen">
        {cameraEnabled ? <Video size={19} color={stage.text} /> : <VideoOff size={19} color={stage.live} />}
      </PressFeedback>
    </View>
    {error ? <PressFeedback onPress={() => void retry()} disabled={disabled} style={s.error} accessibilityRole="button" accessibilityLabel={`${error} Wiederholen`}>
      <Text key={`error-${fontScale}`} style={s.errorText} accessibilityLiveRegion="polite">{error}</Text>
    </PressFeedback> : null}
    <StageSheet visible={toolsOpen} title="Kamera & Mikrofon" onClose={() => setToolsOpen(false)}>
      {[
        { label: cameraEnabled ? 'Kamera ausschalten' : 'Kamera einschalten', action: toggleCamera, Icon: cameraEnabled ? Video : VideoOff, kind: 'camera' },
        { label: micEnabled ? 'Mikrofon stummschalten' : 'Mikrofon einschalten', action: toggleMic, Icon: micEnabled ? Mic : MicOff, kind: 'mic' },
        { label: 'Kamera wechseln', action: switchCamera, Icon: SwitchCamera, kind: 'switch' },
      ].map(({ label, action, Icon, kind }) => <PressFeedback key={`${kind}-${fontScale}`} onPress={() => void action()}
        disabled={disabled || kind === 'switch' && (!hasCamera || !cameraEnabled)} style={s.tool} accessibilityRole="button"
        accessibilityState={{ disabled: disabled || kind === 'switch' && (!hasCamera || !cameraEnabled), busy: pending === kind }}>
        {pending === kind ? <ActivityIndicator color={stage.text} /> : <Icon size={21} color={stage.text} />}
        <Text style={s.toolText}>{label}</Text>
      </PressFeedback>)}
      {!connected ? <Text key={`connection-${fontScale}`} style={s.errorText}>Die Steuerung ist wieder verfügbar, sobald die Show verbunden ist.</Text> : null}
      {error ? <PressFeedback onPress={() => void retry()} disabled={disabled} style={s.tool} accessibilityRole="button">
        <Text key={`retry-${fontScale}`} style={s.errorText}>{error} Wiederholen</Text>
      </PressFeedback> : null}
    </StageSheet>
  </View>;
}
const s = StyleSheet.create({
  wrap: { paddingHorizontal: space.md, paddingTop: space.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1, backgroundColor: stage.control, borderRadius: radius.pill, paddingHorizontal: space.sm, paddingVertical: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { flexShrink: 1, fontSize: 11, lineHeight: 16, fontWeight: '600', color: stage.text },
  button: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, backgroundColor: stage.control },
  error: { borderRadius: radius.sm, backgroundColor: stage.control, padding: space.sm, minHeight: 44, justifyContent: 'center' },
  errorText: { flexShrink: 1, fontSize: 13, lineHeight: 19, color: stage.text },
  tool: { minHeight: 52, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: stage.line },
  toolText: { flex: 1, fontSize: 16, lineHeight: 23, color: stage.text },
});
