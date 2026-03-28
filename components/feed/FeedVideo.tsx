import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { USE_EXPO_VIDEO, VideoView, useVideoPlayer } from './expoVideo';

export function NativeFeedVideo({
  uri,
  shouldPlay,
  isMuted,
  onProgress,
}: {
  uri: string;
  shouldPlay: boolean;
  isMuted: boolean;
  onProgress: (p: number) => void;
}) {
  const player = useVideoPlayer(uri, (p: any) => {
    p.loop = true;
    p.muted = true;
  });

  useEffect(() => {
    if (!player) return;
    if (shouldPlay) player.play();
    else player.pause();
  }, [shouldPlay, player]);

  useEffect(() => {
    if (!player) return;
    player.muted = isMuted;
  }, [isMuted, player]);

  useEffect(() => {
    if (!player) return;
    const sub = player.addListener('timeUpdate', (e: any) => {
      const dur = player.duration;
      if (dur > 0) onProgress(e.currentTime / dur);
    });
    return () => sub.remove();
  }, [player, onProgress]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
    />
  );
}

export function FallbackFeedVideo({
  uri,
  shouldPlay,
  isMuted,
  onProgress,
}: {
  uri: string;
  shouldPlay: boolean;
  isMuted: boolean;
  onProgress: (p: number) => void;
}) {
  const handleStatus = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.durationMillis && status.durationMillis > 0) {
      onProgress((status.positionMillis ?? 0) / status.durationMillis);
    }
  };
  return (
    <Video
      source={{ uri }}
      style={StyleSheet.absoluteFill}
      resizeMode={ResizeMode.COVER}
      isLooping
      shouldPlay={shouldPlay}
      isMuted={isMuted}
      onPlaybackStatusUpdate={handleStatus}
    />
  );
}

export { USE_EXPO_VIDEO };
