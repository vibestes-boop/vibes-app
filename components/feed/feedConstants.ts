import { Dimensions } from 'react-native';

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

export { SCREEN_HEIGHT, SCREEN_WIDTH };

/**
 * Viewability nur fürs aktive Video: ohne minimumViewTime (Dwell nutzt weiter 500ms).
 * So wechselt Playback direkt beim Scrollen – TikTok-ähnlich.
 */
export const FEED_VIDEO_VIEWABILITY = {
  itemVisiblePercentThreshold: 55,
  minimumViewTime: 0,
  waitForInteraction: false,
} as const;
