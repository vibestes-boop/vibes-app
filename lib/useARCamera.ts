/**
 * useARCamera — AR-Filter Infrastruktur
 *
 * STATUS: Phase 1 implementiert ✅
 *
 * ✅ react-native-vision-camera@4.7.3  → Kamera + Frame Processors
 * ✅ react-native-worklets-core@1.6.3  → Frame Processor Engine
 * ✅ @shopify/react-native-skia@2.6.2  → Color-Filter Rendering
 * ✅ @react-native-ml-kit/face-detection@2.0.1 → Face Detection
 * ✅ deploymentTarget "16.0"           → erforderlich für ML Kit
 *
 * Was Phase 1 liefert:
 * - Live Color-Filter via useSkiaFrameProcessor (Pixel-Level)
 * - ML Kit Face Detection auf aufgenommenen Fotos
 * - Präzise Sticker-Positionierung via Landmarks (leftEye, rightEye, noseBase, mouthBottom)
 *
 * ⚠️ Bekannte Architektur-Limitierung (Phase 3):
 * startRecording() nimmt RAW Kamera-Daten → aufgenommenes VIDEO hat KEINEN Color-Filter.
 * Für gefilterte Video-Aufnahmen wäre AVFoundation/Metal Shader nötig.
 *
 * Die eigentliche Implementierung ist in:
 *   components/camera/ARCameraScreen.tsx  (Haupt-Screen)
 *   lib/cameraFilters.ts                  (Filter-Definitionen + ColorMatrices)
 *   lib/useFaceDetection.ts               (ML Kit Face Detection Hook)
 *   components/camera/FilterBar.tsx       (Filter-Auswahl UI)
 */

export type ARFilter = 'sunglasses' | 'dogears' | 'crown' | 'hearts' | 'stars' | null;

export {};
