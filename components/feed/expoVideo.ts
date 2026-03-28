// expo-video: natives Video für Dev/Production Builds — Expo Go nutzt Fallback in FeedVideo
let VideoView: any = null;
let useVideoPlayer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- optionales natives Modul (Expo Go ohne expo-video)
  const ev = require('expo-video');
  VideoView = ev.VideoView;
  useVideoPlayer = ev.useVideoPlayer;
} catch {
  /* Expo Go */
}

export const USE_EXPO_VIDEO = VideoView !== null && useVideoPlayer !== null;
export { VideoView, useVideoPlayer };
