import { Camera, CameraOff, Mic, MicOff, RotateCcw } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLocalParticipant } from '@livekit/react-native';
import { Room, Track } from 'livekit-client';

export function HostControls({ onCameraSwitch }: { onCameraSwitch?: (isFront: boolean) => void }) {
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();

  const toggleMic = async () => {
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch { /* ignore */ }
  };

  const toggleCamera = async () => {
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch { /* ignore */ }
  };

  const switchCamera = async () => {
    try {
      const devices = await Room.getLocalDevices('videoinput');
      if (devices.length < 2) return;
      const currentTrack = localParticipant.getTrackPublication(Track.Source.Camera);
      if (!currentTrack?.track) return;
      const currentDeviceId = currentTrack.track.mediaStreamTrack?.getSettings()?.deviceId;
      const nextDevice = devices.find((d) => d.deviceId !== currentDeviceId) ?? devices[0];
      await currentTrack.track.setDeviceId(nextDevice.deviceId);
      await new Promise<void>((r) => setTimeout(r, 150));
      const facingMode = currentTrack.track.mediaStreamTrack?.getSettings()?.facingMode;
      onCameraSwitch?.(!facingMode || facingMode === 'user');
    } catch { /* Fallback: einfach Camera neu starten */ }
  };

  return (
    <View style={s.controls}>
      <Pressable
        style={[s.controlBtn, !isMicrophoneEnabled && s.controlBtnOff]}
        onPress={toggleMic}
        hitSlop={8}
      >
        {isMicrophoneEnabled ? (
          <Mic size={18} stroke="#fff" strokeWidth={2} />
        ) : (
          <MicOff size={18} stroke="#EF4444" strokeWidth={2} />
        )}
      </Pressable>
      <Pressable
        style={[s.controlBtn, !isCameraEnabled && s.controlBtnOff]}
        onPress={toggleCamera}
        hitSlop={8}
      >
        {isCameraEnabled ? (
          <Camera size={18} stroke="#fff" strokeWidth={2} />
        ) : (
          <CameraOff size={18} stroke="#EF4444" strokeWidth={2} />
        )}
      </Pressable>
      <Pressable style={s.controlBtn} onPress={switchCamera} hitSlop={8}>
        <RotateCcw size={18} stroke="#fff" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  controls: { flexDirection: 'row', gap: 8 },
  controlBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  controlBtnOff: { backgroundColor: 'rgba(239,68,68,0.25)' },
});
