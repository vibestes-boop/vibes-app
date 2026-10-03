import { COLOR_FILTERS, type ColorFilterId } from './cameraFilters';

export type ImageAdjustments = { brightness: number; contrast: number; saturation: number };
export const NEUTRAL_ADJUSTMENTS: ImageAdjustments = { brightness: 0, contrast: 0, saturation: 0 };
export function hasImageAdjustments(values: ImageAdjustments) {
  return values.brightness !== 0 || values.contrast !== 0 || values.saturation !== 0;
}
const bounded = (value: number) => Number.isFinite(value) ? Math.max(-50, Math.min(50, value)) : 0;

// Matrices use a 0–255 bias column, just like COLOR_FILTERS. Apply b, then a.
function compose(a: number[], b: number[]): number[] {
  return Array.from({ length: 20 }, (_, i) => {
    const row = Math.floor(i / 5), column = i % 5;
    let result = column === 4 ? a[row * 5 + 4] : 0;
    for (let k = 0; k < 4; k++) result += a[row * 5 + k] * b[k * 5 + column];
    return result;
  });
}

/** The same transform drives the preview and the exported photo. */
export function imageColorMatrix(filterId: ColorFilterId | null, values = NEUTRAL_ADJUSTMENTS): number[] {
  const saturation = 1 + bounded(values.saturation) / 50;
  const contrast = 1 + bounded(values.contrast) / 100;
  const offset = 127.5 * (1 - contrast) + bounded(values.brightness) * 2.55;
  const luma = [0.2126, 0.7152, 0.0722];
  const adjustment = Array.from({ length: 20 }, (_, i) => {
    const row = Math.floor(i / 5), column = i % 5;
    if (row === 3) return column === 3 ? 1 : 0;
    if (column === 4) return offset;
    if (column === 3) return 0;
    return contrast * (luma[column] * (1 - saturation) + (row === column ? saturation : 0));
  });
  return compose(adjustment, COLOR_FILTERS[filterId ?? 'none']);
}

export function normalizedImageMatrix(filterId: ColorFilterId | null, values = NEUTRAL_ADJUSTMENTS) {
  return imageColorMatrix(filterId, values).map((value, i) => i % 5 === 4 ? value / 255 : value);
}
