// ─── CoinIcon — zentrale SERLO-Münze (ersetzt den 🪙-Emoji überall) ──────────
// Eine Quelle für das Coin-Icon in der ganzen App. Rendert assets/serlo-coin.png.
// `dim` für inaktive/durchgestrichene Zustände (z. B. alter Preis bei Sale).
import { Image } from 'expo-image';
import type { StyleProp, ImageStyle } from 'react-native';

const SERLO_COIN = require('@/assets/serlo-coin.png');

export function CoinIcon({
  size = 16,
  dim = false,
  style,
}: {
  size?: number;
  dim?: boolean;
  style?: StyleProp<ImageStyle>;
}) {
  return (
    <Image
      source={SERLO_COIN}
      style={[{ width: size, height: size, opacity: dim ? 0.45 : 1 }, style]}
      contentFit="contain"
    />
  );
}
