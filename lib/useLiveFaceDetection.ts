/**
 * useLiveFaceDetection v2 — Echtzeit Gesichtserkennung für Live-Kamera-Sticker
 *
 * Fixes v2:
 * - Snapshot-Fotos werden nach ML Kit Analyse sofort gelöscht (kein Storage-Leak)
 * - `as any` Cast entfernt (enableShutterSound ist echtes TakePhotoOptions-Feld)
 * - filterId als ref um stale closure in setInterval zu vermeiden
 * - Saubereres Interval-Management mit AbortFlag für race conditions
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import type { Camera } from 'react-native-vision-camera';
import * as FileSystem from 'expo-file-system';
import { getStickerPosition, type FaceLandmarks } from './useFaceDetection';
import FaceDetection from '@react-native-ml-kit/face-detection';

export interface LiveStickerPosition {
  x: number;
  y: number;
  size: number;
}

interface UseLiveFaceDetectionOptions {
  cameraRef: React.RefObject<Camera>;
  filterId: string;
  enabled: boolean;
  canvasWidth: number;
  canvasHeight: number;
}

export function useLiveFaceDetection({
  cameraRef,
  filterId,
  enabled,
  canvasWidth,
  canvasHeight,
}: UseLiveFaceDetectionOptions): {
  stickerPos: LiveStickerPosition | null;
  isTracking: boolean;
} {
  const [stickerPos, setStickerPos] = useState<LiveStickerPosition | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Refs um stale closures in setInterval zu vermeiden
  const isBusyRef    = useRef(false);
  const filterIdRef  = useRef(filterId);
  const canvasWRef   = useRef(canvasWidth);
  const canvasHRef   = useRef(canvasHeight);

  // Refs synchron halten
  useEffect(() => { filterIdRef.current  = filterId;    }, [filterId]);
  useEffect(() => { canvasWRef.current   = canvasWidth; }, [canvasWidth]);
  useEffect(() => { canvasHRef.current   = canvasHeight; }, [canvasHeight]);

  const runDetectionCycle = useCallback(async (cancelled: { value: boolean }) => {
    if (!cameraRef.current || isBusyRef.current || cancelled.value) return;
    isBusyRef.current = true;

    let photoPath: string | null = null;
    try {
      const photo = await cameraRef.current.takePhoto({
        flash: 'off',
        enableShutterSound: false,
      });
      photoPath = `file://${photo.path}`;

      if (cancelled.value) return; // Abbruch nach takePhoto

      const faces = await FaceDetection.detect(photoPath, {
        landmarkMode: 'all',
        classificationMode: 'none',
        performanceMode: 'fast',
        minFaceSize: 0.08,
      });

      if (cancelled.value) return; // Abbruch nach detect

      const w = canvasWRef.current;
      const h = canvasHRef.current;
      const norm = (px: number, dim: number) => Math.max(0, Math.min(1, px / dim));

      if (faces.length > 0) {
        const face = faces[0];
        const b = face.frame;

        const landmarks: FaceLandmarks = {
          faceLeft:   norm(b.left,           w),
          faceTop:    norm(b.top,            h),
          faceRight:  norm(b.left + b.width, w),
          faceBottom: norm(b.top + b.height, h),
          faceWidth:  norm(b.width,          w),
          faceHeight: norm(b.height,         h),
          leftEyeX:  norm(face.landmarks?.leftEye?.position.x  ?? (b.left + b.width * 0.35), w),
          leftEyeY:  norm(face.landmarks?.leftEye?.position.y  ?? (b.top  + b.height * 0.4),  h),
          rightEyeX: norm(face.landmarks?.rightEye?.position.x ?? (b.left + b.width * 0.65), w),
          rightEyeY: norm(face.landmarks?.rightEye?.position.y ?? (b.top  + b.height * 0.4),  h),
          noseX:     norm(face.landmarks?.noseBase?.position.x  ?? (b.left + b.width * 0.5),  w),
          noseY:     norm(face.landmarks?.noseBase?.position.y  ?? (b.top  + b.height * 0.55), h),
          mouthX:    norm(face.landmarks?.mouthBottom?.position.x ?? (b.left + b.width * 0.5),  w),
          mouthY:    norm(face.landmarks?.mouthBottom?.position.y ?? (b.top  + b.height * 0.75), h),
        };

        const pos = getStickerPosition(filterIdRef.current, landmarks, w, h);
        if (!cancelled.value) {
          setStickerPos(pos);
          setIsTracking(true);
        }
      } else {
        if (!cancelled.value) {
          setIsTracking(false);
          // stickerPos beibehalten → kein visueller Flash wenn Gesicht kurz weg
        }
      }
    } catch {
      // Nächster Zyklus versucht es erneut — kein State-Update nötig
    } finally {
      isBusyRef.current = false;
      // Temp-Foto sofort löschen → kein Storage-Leak
      if (photoPath) {
        FileSystem.deleteAsync(photoPath, { idempotent: true }).catch(() => {});
      }
    }
  }, [cameraRef]); // cameraRef ist stabil (useRef) — keine anderen deps nötig dank Refs

  useEffect(() => {
    if (!enabled) {
      setStickerPos(null);
      setIsTracking(false);
      return;
    }

    // AbortFlag verhindert State-Updates nach Unmount / disabled
    const cancelled = { value: false };

    // Erste Detection sofort
    runDetectionCycle(cancelled);

    // Danach alle 1500ms
    const intervalId = setInterval(() => runDetectionCycle(cancelled), 1500);

    return () => {
      cancelled.value = true;
      clearInterval(intervalId);
    };
  }, [enabled, runDetectionCycle]);

  return { stickerPos, isTracking };
}
