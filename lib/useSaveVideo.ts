/**
 * lib/useSaveVideo.ts
 * Lädt ein Video herunter und speichert es in der Kamera-Galerie des Nutzers.
 * Nutzt die neue expo-file-system Klassen-API (v18+: File.downloadFileAsync)
 * und expo-media-library zum Speichern in der Galerie.
 */
import { useState } from 'react';
import { Alert } from 'react-native';
import { File, Paths, Directory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

type SaveState = 'idle' | 'downloading' | 'saving' | 'done' | 'error';

export function useSaveVideo() {
  const [state, setState] = useState<SaveState>('idle');

  const saveVideo = async (videoUrl: string) => {
    if (state === 'downloading' || state === 'saving') return;

    try {
      // 1. Berechtigung anfragen
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Berechtigung erforderlich',
          'Bitte erlaube Vibes den Zugriff auf deine Galerie in den Einstellungen.'
        );
        return;
      }

      setState('downloading');
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      // 2. Datei in den Cache-Ordner herunterladen
      const ext = videoUrl.includes('.mp4') ? 'mp4'
        : videoUrl.includes('.mov') ? 'mov'
        : videoUrl.includes('.webm') ? 'webm'
        : 'mp4';

      const cacheDir = new Directory(Paths.cache);
      const cacheFile = new File(cacheDir, `vibes_${Date.now()}.${ext}`);

      // Überspringe Download falls schon vorhanden (idempotent)
      const downloaded = await File.downloadFileAsync(videoUrl, cacheFile, { idempotent: true });

      setState('saving');

      // 3. In Galerie speichern
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);

      // 4. Temporären Cache aufräumen
      try { downloaded.delete(); } catch { /* ignorieren */ }

      setState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Gespeichert ✓', 'Das Video wurde in deiner Galerie gespeichert.');

      setTimeout(() => setState('idle'), 2000);
    } catch (err: any) {
      setState('error');
      __DEV__ && console.warn('[useSaveVideo]', err?.message);
      if (!String(err?.message ?? '').includes('cancel')) {
        Alert.alert('Fehler', 'Video konnte nicht gespeichert werden.');
      }
      setTimeout(() => setState('idle'), 2000);
    }
  };

  return {
    saveVideo,
    isSaving: state === 'downloading' || state === 'saving',
    isDone: state === 'done',
    isError: state === 'error',
  };
}
