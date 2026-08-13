// Die Ähre als Vektor — gleiche Geometrie wie assets/mark.svg und
// scripts/generate-icons.mjs. Wer eine der drei Stellen ändert, ändert alle.

import Svg, { Ellipse, Path } from 'react-native-svg';
import { stage } from '../theme/tokens';

const KERNELS = [
  { cx: 24, cy: 46, rotate: -45 },
  { cx: 40, cy: 46, rotate: 45 },
  { cx: 24.8, cy: 35, rotate: -45 },
  { cx: 39.2, cy: 35, rotate: 45 },
  { cx: 25.6, cy: 24, rotate: -45 },
  { cx: 38.4, cy: 24, rotate: 45 },
];

export function BerkatMark({ size = 24, color = stage.gold }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64">
      <Path d="M32 56 L32 18" stroke={color} strokeWidth={3.2} strokeLinecap="round" fill="none" />
      {KERNELS.map((k) => (
        <Ellipse
          key={`${k.cx}-${k.cy}`}
          cx={k.cx}
          cy={k.cy}
          rx={3.6}
          ry={7.2}
          fill={color}
          origin={`${k.cx}, ${k.cy}`}
          rotation={k.rotate}
        />
      ))}
      <Ellipse cx={32} cy={13} rx={3.4} ry={7} fill={color} />
    </Svg>
  );
}
