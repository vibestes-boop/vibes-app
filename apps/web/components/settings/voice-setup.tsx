'use client';

// -----------------------------------------------------------------------------
// VoiceSetup — v1.w.UI.217 — KI-Stimme (Voice Clone) Web-Pendant zu
// `components/profile/VoiceSetupSheet.tsx` (Native).
//
// Web-spezifische Unterschiede zur Native-Impl:
//   • MediaRecorder API statt expo-av
//   • Audio-Format: audio/webm;codecs=opus (breiteste Browser-Unterstützung)
//     Safari → audio/mp4;codecs=aac als Fallback
//   • Waveform: CSS-Keyframe-Animation statt Reanimated-Shared-Values
//   • Upload: requestR2UploadUrl('voice-samples/') + PUT → saveVoiceSample()
//   • Design: Theme-variables (light + dark compatible)
//
// State-Machine:
//   idle → recording → recorded → uploading → saved
//          ↑                                   ↓
//          └──────────── reset ────────────────┘
// -----------------------------------------------------------------------------

import { useState, useRef, useEffect, useCallback, useTransition } from 'react';
import {
  Mic,
  Square,
  Play,
  Pause,
  Trash2,
  Upload,
  Check,
  AlertCircle,
  Loader2,
  Volume2,
} from 'lucide-react';
import { requestR2UploadUrl } from '@/app/actions/posts';
import { saveVoiceSample, deleteVoiceSample } from '@/app/actions/profile';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────

type CloneState = 'idle' | 'recording' | 'recorded' | 'uploading' | 'saved' | 'error';

interface Props {
  userId: string;
  initialVoiceUrl: string | null;
}

// ── Waveform ──────────────────────────────────────────────────────────────────

function WaveBar({ active, index }: { active: boolean; index: number }) {
  return (
    <span
      className={cn(
        'inline-block w-[3px] rounded-full transition-colors duration-200',
        active
          ? 'animate-voice-bar bg-destructive'
          : 'bg-border',
      )}
      style={
        active
          ? {
              animationDelay: `${(index * 37) % 400}ms`,
              animationDuration: `${400 + (index * 73) % 400}ms`,
            }
          : { height: '4px' }
      }
    />
  );
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className="flex h-14 items-center justify-center gap-[3px]" aria-hidden="true">
      {Array.from({ length: 28 }, (_, i) => (
        <WaveBar key={i} active={active} index={i} />
      ))}
    </div>
  );
}

// ── Timer ──────────────────────────────────────────────────────────────────────

function Timer({ ms }: { ms: number }) {
  const secs = Math.floor(ms / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return (
    <span className="font-mono text-2xl font-bold tabular-nums text-destructive">
      {String(secs).padStart(2, '0')}.{tenths}
      <span className="text-sm font-normal text-muted-foreground"> / 15s</span>
    </span>
  );
}

// ── Pick best supported MIME type ─────────────────────────────────────────────

function getBestMime(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const m of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) {
      return m;
    }
  }
  return 'audio/webm';
}

function mimeToExt(mime: string): string {
  if (mime.startsWith('audio/mp4')) return 'mp4';
  if (mime.startsWith('audio/ogg')) return 'ogg';
  return 'webm';
}

// ── Main Component ─────────────────────────────────────────────────────────────

const MAX_MS = 15_000;

export function VoiceSetup({ userId, initialVoiceUrl }: Props) {
  const [state, setState] = useState<CloneState>('idle');
  const [durationMs, setDurationMs] = useState(0);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [savedUrl, setSavedUrl] = useState<string | null>(initialVoiceUrl);
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startMsRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mimeRef = useRef('audio/webm');

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      if (timerRef.current !== null) clearInterval(timerRef.current);
    };
  }, []);

  // ── Recording ───────────────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      const mime = getBestMime();
      mimeRef.current = mime;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const url = URL.createObjectURL(blob);
        setLocalUrl(url);
        setState('recorded');
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
      startMsRef.current = Date.now();
      setState('recording');
      setDurationMs(0);
      timerRef.current = window.setInterval(() => {
        const elapsed = Date.now() - startMsRef.current;
        setDurationMs(elapsed);
        if (elapsed >= MAX_MS) stopRecording();
      }, 100);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Mikrofon-Zugriff verweigert.';
      setErrorMsg(msg);
      setState('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // ── Playback ─────────────────────────────────────────────────────────────────

  const togglePlay = useCallback(() => {
    if (!localUrl) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio(localUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => setIsPlaying(false));
    setIsPlaying(true);
  }, [localUrl, isPlaying]);

  // ── Upload + Save ─────────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!localUrl) return;
    startSaveTransition(async () => {
      setState('uploading');
      setErrorMsg(null);
      try {
        const resp = await fetch(localUrl);
        const blob = await resp.blob();
        const mime = mimeRef.current;
        const ext = mimeToExt(mime);
        const key = `voice-samples/${userId}/${Date.now()}.${ext}`;

        const signed = await requestR2UploadUrl({ key, contentType: mime });
        if (!signed.ok) throw new Error(signed.error || 'Signieren fehlgeschlagen.');

        const put = await fetch(signed.data.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': mime },
          body: blob,
        });
        if (!put.ok) throw new Error(`Upload HTTP ${put.status}`);

        const saved = await saveVoiceSample(signed.data.publicUrl);
        if (!saved.ok) throw new Error(saved.error || 'Speichern fehlgeschlagen.');

        setSavedUrl(signed.data.publicUrl);
        setState('saved');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Fehler aufgetreten.';
        setErrorMsg(msg);
        setState('error');
      }
    });
  }, [localUrl, userId]);

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(() => {
    startDeleteTransition(async () => {
      setErrorMsg(null);
      const result = await deleteVoiceSample();
      if (!result.ok) {
        setErrorMsg(result.error || 'Löschen fehlgeschlagen.');
        return;
      }
      setSavedUrl(null);
      setLocalUrl(null);
      setState('idle');
    });
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────────

  const handleReset = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setLocalUrl(null);
    setDurationMs(0);
    setIsPlaying(false);
    setErrorMsg(null);
    setState('idle');
  }, []);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const isRecording = state === 'recording';
  const isRecorded = state === 'recorded';
  const isUploading = state === 'uploading' || isSaving;
  const isSaved = state === 'saved';
  const isError = state === 'error';
  const busyDisk = isUploading || isDeleting;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="flex gap-3 rounded-xl border bg-card/50 p-4 text-sm text-muted-foreground">
        <Volume2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p>
          Nimm einen kurzen Text (5–15 Sek.) in deiner natürlichen Stimme auf.
          Chatterbox nutzt ihn, um Kommentare in{' '}
          <strong className="text-foreground">deiner Stimme</strong> vorzulesen.
        </p>
      </div>

      {/* Saved badge */}
      {savedUrl && !isSaved && (
        <div className="flex items-center gap-3 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2.5 text-sm">
          <Check className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden="true" />
          <span className="flex-1 font-medium text-emerald-600 dark:text-emerald-400">
            Stimme gespeichert ✓
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={busyDisk}
            aria-label="Gespeicherte Stimme löschen"
            className="rounded-full p-1 text-destructive hover:bg-destructive/10 disabled:opacity-40"
          >
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </button>
        </div>
      )}

      {/* Waveform */}
      <div className="flex justify-center">
        <Waveform active={isRecording} />
      </div>

      {/* Record button */}
      <div className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center">
          {isRecording && (
            <span
              className="absolute h-[88px] w-[88px] animate-ping rounded-full border-2 border-destructive opacity-50"
              aria-hidden="true"
            />
          )}

          {isRecording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-destructive shadow-[0_4px_20px_hsl(var(--destructive)/0.5)] transition-transform active:scale-95"
              aria-label="Aufnahme stoppen"
            >
              <Square className="h-7 w-7 fill-white text-white" strokeWidth={0} />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={isUploading || isSaved}
              className="relative flex h-[88px] w-[88px] items-center justify-center rounded-full bg-destructive shadow-[0_4px_20px_hsl(var(--destructive)/0.4)] transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:shadow-none disabled:cursor-not-allowed"
              aria-label="Aufnahme starten"
            >
              <Mic className="h-8 w-8 text-white" />
            </button>
          )}
        </div>

        {/* Status / Timer */}
        <div className="flex min-h-7 items-center justify-center">
          {isRecording && <Timer ms={durationMs} />}
          {isRecorded && (
            <span className="text-sm text-muted-foreground">
              Aufnahme bereit —{' '}
              <strong className="text-foreground">{(durationMs / 1000).toFixed(1)}s</strong>
            </span>
          )}
          {isUploading && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird hochgeladen…
            </span>
          )}
          {isSaved && (
            <span className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Stimme gespeichert!
            </span>
          )}
          {isError && (
            <span className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {errorMsg ?? 'Fehler aufgetreten.'}
            </span>
          )}
          {state === 'idle' && (
            <span className="text-sm text-muted-foreground">
              {savedUrl ? 'Tippe zum Neu-Aufnehmen' : 'Tippe auf den Mikrofon-Button zum Aufnehmen'}
            </span>
          )}
        </div>
      </div>

      {/* Action row after recording */}
      {isRecorded && localUrl && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-semibold transition-colors hover:bg-muted"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4 fill-foreground" />
            )}
            {isPlaying ? 'Pause' : 'Anhören'}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
          >
            <Mic className="h-4 w-4" />
            Neu aufnehmen
          </button>
        </div>
      )}

      {/* Save button */}
      {isRecorded && (
        <button
          type="button"
          onClick={handleSave}
          disabled={isUploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-4 text-sm font-bold text-background shadow transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Stimme speichern
        </button>
      )}

      {/* Done state */}
      {isSaved && (
        <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-4 text-sm font-bold text-white">
          <Check className="h-4 w-4" />
          Super! Stimme gespeichert ✓
        </div>
      )}

      {/* Hint */}
      <p className="text-center text-xs leading-relaxed text-muted-foreground">
        Beispiel-Text zum Vorlesen:{' '}
        <em>„Hey, ich bin dabei! Schau dir meinen neuesten Vibe an – du wirst es lieben."</em>
      </p>
    </div>
  );
}
