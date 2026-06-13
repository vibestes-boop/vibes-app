// Skia sicher laden — alle Export-Pfade ausprobieren (Metro vs. ESM interop).
// Hermes HBC ist inkompatibel mit direkten ES-Imports von @shopify/react-native-skia.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _skiaRaw: any = (() => {
  try { return require('@shopify/react-native-skia'); }
  catch { return {}; }
})();

const _resolveSkia = (key: string): any =>
  _skiaRaw[key] ?? _skiaRaw?.default?.[key] ?? undefined;

export const SkiaCanvas      = _resolveSkia('Canvas')      as any;
export const SkiaImage       = _resolveSkia('Image')        as any;
export const SkiaColorMatrix = _resolveSkia('ColorMatrix')  as any;
export const Skia            = _resolveSkia('Skia')         as any;
export const useSkiaImage: (uri: string | null) => any = _resolveSkia('useImage') ?? (() => null);
export const SKIA_READY      = !!(SkiaCanvas && SkiaImage && Skia);
