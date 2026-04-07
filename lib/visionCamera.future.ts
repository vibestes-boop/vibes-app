/**
 * VisionCamera Setup — Zukunfts-Kamera für AR-Filter
 *
 * STATUS: Vorkonfiguriert (Paket installiert, Plugin in app.json)
 * AKTIVIERUNG: Wenn AR-Filter Feature gebaut wird
 *
 * Was damit möglich ist:
 * - 60 FPS Kamera
 * - Frame Processors (Echtzeit ML auf Kamera-Frames)
 * - Google ML Kit Face Detection (478 Gesichtspunkte)
 * - Skia AR-Filter Rendering
 * - Tiefenkarte (iPhone Pro)
 *
 * Migration von expo-camera:
 * - app/create/camera.tsx: CameraView → Camera (Vision Camera)
 * - Permissions: useCameraPermissions → Camera.requestCameraPermission()
 * - Recording: recordAsync → startRecording / stopRecording
 *
 * Dependencies die noch installiert werden müssen WENN es gebraucht wird:
 *   npm install @react-native-ml-kit/face-detection
 *   npm install @shopify/react-native-skia
 *   npm install react-native-worklets-core   ← Frame Processor Engine
 *
 * Dokumentation: https://react-native-vision-camera.com/docs/guides
 */

// ─── Beispiel: Frame Processor mit ML Kit Face Detection ──────────────────
// Dieses File ist noch NICHT aktiv — nur als Referenz für die spätere Migration

/*
import { Camera, useCameraDevice, useFrameProcessor } from 'react-native-vision-camera';
import { useFaceDetector } from '@react-native-ml-kit/face-detection';
import { Skia, Canvas, Circle } from '@shopify/react-native-skia';
import { runAtTargetFps } from 'react-native-vision-camera';

export function ARCamera() {
  const device = useCameraDevice('front');
  const { detectFaces } = useFaceDetector({
    performanceMode: 'fast',
    landmarkMode: 'all',   // 468 Gesichtspunkte
  });

  const frameProcessor = useFrameProcessor((frame) => {
    'worklet';
    runAtTargetFps(15, () => {  // 15fps für ML Kit (spart Akku)
      const faces = detectFaces(frame);
      // faces[0].landmarks = { leftEye, rightEye, noseTip, ... }
      // → Skia zeichnet Brille/Filter über die Koordinaten
    });
  }, [detectFaces]);

  if (!device) return null;

  return (
    <Camera
      device={device}
      isActive={true}
      frameProcessor={frameProcessor}
      style={{ flex: 1 }}
    />
  );
}
*/

export {}; // Verhindert TypeScript-Fehler (leeres Modul)
