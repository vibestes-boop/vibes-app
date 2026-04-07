/**
 * useVoiceClone — Chatterbox S2: Creator-Stimme klonen
 *
 * Zustandsmaschine:
 *   idle → recording → recorded → uploading → saved
 *                  ↑                    ↓
 *                  └─────── reset ───────┘
 *
 * Nutzt expo-av für Aufnahme + Vorschau-Wiedergabe.
 * Upload läuft über uploadVoiceSample (→ Cloudflare R2).
 */

import { useState, useCallback, useRef } from 'react';
import { Audio } from 'expo-av';
import { Platform } from 'react-native';
import { supabase } from './supabase';
import { useAuthStore } from './authStore';
import { uploadVoiceSample } from './uploadMedia';

export type CloneState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'saved' | 'error';

const MAX_DURATION_MS = 15_000; // 15 Sekunden max

export interface UseVoiceCloneReturn {
  cloneState: CloneState;
  durationMs: number;
  localUri: string | null;
  savedUrl: string | null;
  isPlaying: boolean;
  errorMsg: string | null;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<void>;
  playPreview: () => Promise<void>;
  stopPreview: () => void;
  uploadAndSave: () => Promise<void>;
  deleteVoice: () => Promise<void>;
  reset: () => void;
}

export function useVoiceClone(): UseVoiceCloneReturn {
  const { profile, setProfile } = useAuthStore();

  const [cloneState, setCloneState] = useState<CloneState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(
    (profile as any)?.voice_sample_url ?? null,
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recordingRef = useRef<Audio.Recording | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startMsRef = useRef(0);
  const stoppingRef = useRef(false); // Verhindert Doppel-Stop

  // ── Aufnahme starten ─────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      setErrorMsg(null);
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Mikrofon-Berechtigung verweigert. Bitte in den Einstellungen aktivieren.');
        setCloneState('error');
        return;
      }

      // Aufnahme-Mode setzen (iOS: In-Ear aus, Lautsprecher an)
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        // interruptionModeIOS: InterruptionModeIOS.DoNotMix (SDK 53+ enum)
        staysActiveInBackground: false,
      });

      // WAV (LinearPCM) — Chatterbox/Replicate erfordert WAV als audio_prompt
      // iOS: LINEARPCM → .wav | Android: fallback auf m4a dann WAV-Wrapper
      const wavOptions: Audio.RecordingOptions = {
        isMeteringEnabled: true,
        android: {
          extension: '.m4a',
          outputFormat: 2,  // MPEG_4
          audioEncoder: 3,  // AAC
          sampleRate: 44100,
          numberOfChannels: 1,
          bitRate: 128000,
        },
        ios: {
          extension: '.wav',
          audioQuality: Audio.IOSAudioQuality.HIGH,
          outputFormat: Audio.IOSOutputFormat.LINEARPCM,
          sampleRate: 22050,       // 22kHz reicht für Sprachaufnahme
          numberOfChannels: 1,     // Mono (kleiner, tut Chatterbox gut)
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: { mimeType: 'audio/wav' },
      };
      const { recording } = await Audio.Recording.createAsync(wavOptions);
      recordingRef.current = recording;
      stoppingRef.current = false;
      startMsRef.current = Date.now();
      setCloneState('recording');
      setDurationMs(0);

      // Ticker + Auto-Stop nach MAX_DURATION_MS
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startMsRef.current;
        setDurationMs(elapsed);
        if (elapsed >= MAX_DURATION_MS) {
          stopRecording();
        }
      }, 100);
    } catch (err: any) {
      console.error('[useVoiceClone] startRecording:', err);
      setErrorMsg(err?.message ?? 'Aufnahme konnte nicht gestartet werden.');
      setCloneState('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Aufnahme stoppen ─────────────────────────────────────────────────────
  const stopRecording = useCallback(async () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const rec = recordingRef.current;
    if (!rec) return;

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      recordingRef.current = null;

      // Audio-Mode zurücksetzen → Lautsprecher
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      if (uri) {
        setLocalUri(uri);
        setCloneState('recorded');
      } else {
        throw new Error('Keine Aufnahme-URI');
      }
    } catch (err: any) {
      console.error('[useVoiceClone] stopRecording:', err);
      setErrorMsg(err?.message ?? 'Aufnahme konnte nicht gespeichert werden.');
      setCloneState('error');
    }
  }, []);

  // ── Vorschau abspielen ────────────────────────────────────────────────────
  const playPreview = useCallback(async () => {
    if (!localUri) return;
    try {
      if (soundRef.current) {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
        soundRef.current = null;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: localUri },
        { shouldPlay: true },
      );
      soundRef.current = sound;
      setIsPlaying(true);
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setIsPlaying(false);
        }
      });
    } catch (err) {
      console.error('[useVoiceClone] playPreview:', err);
      setIsPlaying(false);
    }
  }, [localUri]);

  // ── Vorschau stoppen ─────────────────────────────────────────────────────
  const stopPreview = useCallback(() => {
    soundRef.current?.stopAsync().catch(() => { });
    setIsPlaying(false);
  }, []);

  // ── Upload + Speichern ───────────────────────────────────────────────────
  const uploadAndSave = useCallback(async () => {
    if (!localUri || !profile) return;
    setCloneState('uploading');
    setErrorMsg(null);
    try {
      // WAV auf iOS, m4a auf Android (Chatterbox braucht WAV)
      const mimeType = Platform.OS === 'ios' ? 'audio/wav' : 'audio/mp4';

      const publicUrl = await uploadVoiceSample(profile.id, localUri, mimeType);
      __DEV__ && console.log('[VoiceClone] ✅ R2 Upload OK, publicUrl:', publicUrl);

      // In profiles speichern
      const { error } = await supabase
        .from('profiles')
        .update({ voice_sample_url: publicUrl })
        .eq('id', profile.id);

      __DEV__ && console.log('[VoiceClone] DB update result:', error ? `❌ ${error.message}` : '✅ OK');
      if (error) throw error;

      // Lokalen Store aktualisieren
      setProfile({ ...profile, voice_sample_url: publicUrl } as any);
      __DEV__ && console.log('[VoiceClone] ✅ setProfile called with voice_sample_url:', publicUrl);
      setSavedUrl(publicUrl);
      setCloneState('saved');
    } catch (err: any) {
      console.error('[useVoiceClone] uploadAndSave:', err);
      setErrorMsg(err?.message ?? 'Upload fehlgeschlagen.');
      setCloneState('error');
    }
  }, [localUri, profile, setProfile]);


  // ── Stimme löschen ───────────────────────────────────────────────────────
  const deleteVoice = useCallback(async () => {
    if (!profile) return;
    try {
      await supabase
        .from('profiles')
        .update({ voice_sample_url: null })
        .eq('id', profile.id);

      setProfile({ ...profile, voice_sample_url: null } as any);
      setSavedUrl(null);
      setLocalUri(null);
      setCloneState('idle');
    } catch (err: any) {
      console.error('[useVoiceClone] deleteVoice:', err);
    }
  }, [profile, setProfile]);

  // ── Reset ────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    soundRef.current?.unloadAsync().catch(() => { });
    soundRef.current = null;
    setCloneState('idle');
    setLocalUri(null);
    setDurationMs(0);
    setIsPlaying(false);
    setErrorMsg(null);
  }, []);

  return {
    cloneState,
    durationMs,
    localUri,
    savedUrl,
    isPlaying,
    errorMsg,
    startRecording,
    stopRecording,
    playPreview,
    stopPreview,
    uploadAndSave,
    deleteVoice,
    reset,
  };
}
