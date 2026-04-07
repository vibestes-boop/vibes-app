/**
 * useFaceDetection — ML Kit Gesichtserkennung
 *
 * Detektiert Gesicht auf einem aufgenommenen Foto-Pfad.
 * Gibt Landmark-Koordinaten zurück für präzise Sticker-Positionierung.
 *
 * Verwendung:
 *   const { detectFace, isDetecting } = useFaceDetection();
 *   await detectFace('file:///path/to/photo.jpg');
 */

import FaceDetection, { Face } from '@react-native-ml-kit/face-detection';
import { useState, useCallback } from 'react';

export interface FaceLandmarks {
  /** Bounding Box des Gesichts (relativ zum Bild, 0-1) */
  faceLeft: number;
  faceTop: number;
  faceRight: number;
  faceBottom: number;
  faceWidth: number;
  faceHeight: number;
  /** Augen-Mittelpunkte (relativ zum Bild, 0-1) */
  leftEyeX: number;
  leftEyeY: number;
  rightEyeX: number;
  rightEyeY: number;
  /** Nasen-Basis (relativ zum Bild, 0-1) */
  noseX: number;
  noseY: number;
  /** Mund (relativ zum Bild, 0-1) */
  mouthX: number;
  mouthY: number;
}

export interface FaceDetectionResult {
  found: boolean;
  landmarks?: FaceLandmarks;
  rawFace?: Face;
}

export function useFaceDetection() {
  const [isDetecting, setIsDetecting] = useState(false);
  // faceResult State entfernt — war totes Code (nie von Consumer gelesen)

  const detectFace = useCallback(async (
    imagePath: string,
    imageWidth: number,
    imageHeight: number,
  ): Promise<FaceDetectionResult> => {
    setIsDetecting(true);
    try {
      const faces = await FaceDetection.detect(imagePath, {
        landmarkMode: 'all',
        classificationMode: 'none',
        performanceMode: 'accurate',
        minFaceSize: 0.10,
      });

      if (faces.length === 0) {
        const result: FaceDetectionResult = { found: false };
        return result;
      }

      const face = faces[0];
      // Frame API (aus ML Kit Typen): { left, top, width, height }
      // Landmark API: { position: { x, y } }  ← NICHT direkt .x/.y!
      // LandmarkType: 'mouthBottom' (NICHT 'bottomMouth')
      const b = face.frame;

      const norm = (px: number, dim: number) => Math.max(0, Math.min(1, px / dim));

      const landmarks: FaceLandmarks = {
        faceLeft:   norm(b.left,           imageWidth),
        faceTop:    norm(b.top,            imageHeight),
        faceRight:  norm(b.left + b.width, imageWidth),
        faceBottom: norm(b.top + b.height, imageHeight),
        faceWidth:  norm(b.width,          imageWidth),
        faceHeight: norm(b.height,         imageHeight),

        // Landmarks: .position.x / .position.y (laut ML Kit Landmark-Interface)
        leftEyeX:  norm(face.landmarks?.leftEye?.position.x  ?? (b.left + b.width * 0.35), imageWidth),
        leftEyeY:  norm(face.landmarks?.leftEye?.position.y  ?? (b.top  + b.height * 0.4),  imageHeight),
        rightEyeX: norm(face.landmarks?.rightEye?.position.x ?? (b.left + b.width * 0.65), imageWidth),
        rightEyeY: norm(face.landmarks?.rightEye?.position.y ?? (b.top  + b.height * 0.4),  imageHeight),
        noseX:     norm(face.landmarks?.noseBase?.position.x  ?? (b.left + b.width * 0.5),  imageWidth),
        noseY:     norm(face.landmarks?.noseBase?.position.y  ?? (b.top  + b.height * 0.55), imageHeight),
        // Richtiger Key: 'mouthBottom' (nicht 'bottomMouth')
        mouthX:    norm(face.landmarks?.mouthBottom?.position.x ?? (b.left + b.width * 0.5),  imageWidth),
        mouthY:    norm(face.landmarks?.mouthBottom?.position.y ?? (b.top  + b.height * 0.75), imageHeight),
      };


      const result: FaceDetectionResult = { found: true, landmarks, rawFace: face };
      return result;

    } catch (err) {
      console.error('[FaceDetection] Fehler:', err);
      return { found: false };
    } finally {
      setIsDetecting(false);
    }
  }, []);

  return { detectFace, isDetecting };
}

/**
 * Berechnet Sticker-Position basierend auf Gesichts-Landmarks
 * Gibt absolute Pixel-Koordinaten für einen gegebenen Canvas zurück
 */
export function getStickerPosition(
  filterId: string,
  landmarks: FaceLandmarks,
  canvasWidth: number,
  canvasHeight: number,
): { x: number; y: number; size: number } {
  const eyeMidX = ((landmarks.leftEyeX + landmarks.rightEyeX) / 2) * canvasWidth;
  const eyeMidY = ((landmarks.leftEyeY + landmarks.rightEyeY) / 2) * canvasHeight;
  // Minimum 60px: verhindert unsichtbaren Sticker wenn Augenabstand zu gering
  const eyeSpan = Math.max(
    Math.abs(landmarks.rightEyeX - landmarks.leftEyeX) * canvasWidth,
    60,
  );
  const faceH = landmarks.faceHeight * canvasHeight;

  switch (filterId) {
    case 'sunglasses':
      return { x: eyeMidX, y: eyeMidY, size: eyeSpan * 1.6 };
    case 'crown':
      return {
        x: landmarks.faceLeft * canvasWidth + (landmarks.faceWidth * canvasWidth) / 2,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.25),
        size: landmarks.faceWidth * canvasWidth * 1.2,
      };
    case 'hearts':
      return { x: eyeMidX, y: Math.max(0, eyeMidY - faceH * 0.15), size: eyeSpan * 0.7 };
    case 'stars':
      return { x: eyeMidX, y: landmarks.faceTop * canvasHeight, size: eyeSpan * 0.8 };
    case 'dogears':
      return {
        x: landmarks.faceLeft * canvasWidth + (landmarks.faceWidth * canvasWidth) / 2,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.15),
        size: landmarks.faceWidth * canvasWidth * 1.4,
      };
    // ── Neue Sticker v2.0 ────────────────────────────────────────────────────
    case 'rainbow':
      return {
        x: landmarks.faceLeft * canvasWidth + (landmarks.faceWidth * canvasWidth) / 2,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.3),
        size: landmarks.faceWidth * canvasWidth * 1.6,
      };
    case 'fire':
      return {
        x: landmarks.faceLeft * canvasWidth + (landmarks.faceWidth * canvasWidth) / 2,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.1),
        size: landmarks.faceWidth * canvasWidth * 0.9,
      };
    case 'butterfly':
      return { x: landmarks.noseX * canvasWidth, y: landmarks.noseY * canvasHeight, size: eyeSpan * 1.2 };
    case 'ghost':
      return { x: eyeMidX, y: Math.max(0, eyeMidY - faceH * 0.2), size: eyeSpan * 1.1 };
    case 'lightning':
      return {
        x: landmarks.faceRight * canvasWidth + eyeSpan * 0.3,
        y: landmarks.faceTop * canvasHeight,
        size: eyeSpan * 0.9,
      };
    case 'sakura':
      return {
        x: landmarks.faceLeft * canvasWidth + (landmarks.faceWidth * canvasWidth) / 2,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.2),
        size: landmarks.faceWidth * canvasWidth * 1.1,
      };
    case 'diamond':
      return {
        x: eyeMidX,
        y: Math.max(0, landmarks.faceTop * canvasHeight + faceH * 0.05),
        size: eyeSpan * 0.8,
      };
    case 'moon_s':
      return {
        x: landmarks.faceRight * canvasWidth,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.15),
        size: eyeSpan * 0.9,
      };
    case 'alien':
      return {
        x: eyeMidX,
        y: Math.max(0, eyeMidY - faceH * 0.25),
        size: landmarks.faceWidth * canvasWidth * 1.0,
      };
    case 'angel':
      return {
        x: landmarks.faceLeft * canvasWidth + (landmarks.faceWidth * canvasWidth) / 2,
        y: Math.max(0, landmarks.faceTop * canvasHeight - faceH * 0.35),
        size: landmarks.faceWidth * canvasWidth * 0.9,
      };

    default:
      return { x: eyeMidX, y: eyeMidY, size: 80 };
  }
}
