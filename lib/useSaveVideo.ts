import { useState, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { File, Paths, Directory } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as Haptics from 'expo-haptics';

type SaveState = 'idle' | 'downloading' | 'saving' | 'done' | 'error';

export function useSaveVideo() {
  const [state, setState] = useState<SaveState>('idle');
  const mountedRef  = useRef(true);
  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount — verhindert setState auf unmounted component
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const safeSetState = (s: SaveState) => {
    if (mountedRef.current) setState(s);
  };

  const scheduleReset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => safeSetState('idle'), 2000);
  };

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

      safeSetState('downloading');
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

      safeSetState('saving');

      // 3. In Galerie speichern
      await MediaLibrary.saveToLibraryAsync(downloaded.uri);

      // 4. Temporären Cache aufräumen
      try { downloaded.delete(); } catch { /* ignorieren */ }

      safeSetState('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Gespeichert ✓', 'Das Video wurde in deiner Galerie gespeichert.');

      scheduleReset();
    } catch (err: any) {
      safeSetState('error');
      __DEV__ && console.warn('[useSaveVideo]', err?.message);
      if (!String(err?.message ?? '').includes('cancel')) {
        Alert.alert('Fehler', 'Video konnte nicht gespeichert werden.');
      }
      scheduleReset();
    }
  };

  return {
    saveVideo,
    isSaving: state === 'downloading' || state === 'saving',
    isDone: state === 'done',
    isError: state === 'error',
  };
}
