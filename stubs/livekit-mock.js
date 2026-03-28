/**
 * LiveKit Mock für Expo Go.
 * In Dev-Builds und Production-Builds wird der echte @livekit/react-native genutzt.
 */
const React = require('react');
const { View, Text, StyleSheet } = require('react-native');

const s = StyleSheet.create({
  placeholder: {
    flex: 1,
    backgroundColor: '#0a0010',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', textAlign: 'center' },
  sub:   { color: 'rgba(255,255,255,0.5)', fontSize: 14, textAlign: 'center', paddingHorizontal: 32 },
});

// Placeholder-Komponente
const DevBuildRequired = () =>
  React.createElement(View, { style: s.placeholder },
    React.createElement(Text, { style: s.title }, '🎥 Dev-Build erforderlich'),
    React.createElement(Text, { style: s.sub }, 'Live Studio läuft nicht in Expo Go.\nBitte einen Dev-Build oder Production-Build verwenden.')
  );

// Stub-Komponenten
const LiveKitRoom = ({ children }) => React.createElement(React.Fragment, null, children);
const VideoTrack  = () => React.createElement(View, { style: { flex: 1, backgroundColor: '#000' } });

// Stub-Hooks
const useLocalParticipant = () => ({
  localParticipant: {
    setMicrophoneEnabled: async () => {},
    setCameraEnabled:     async () => {},
    isMicrophoneEnabled:  false,
    isCameraEnabled:      false,
  },
});
const useTracks = () => [];

// Stub-Konstante
const Track = {
  Source: { Camera: 'camera_video', Microphone: 'microphone', ScreenShare: 'screenshare' },
};

module.exports = { LiveKitRoom, VideoTrack, useLocalParticipant, useTracks, Track, DevBuildRequired };
