'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Loader2,
  RefreshCw,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { startLiveSession } from '@/app/actions/live-host';

// -----------------------------------------------------------------------------
// LiveSetupForm — Device-Picker + Title-Input + Go-Live. Das eigentliche
// Publishing passiert erst auf `/live/host/[id]`, diese Seite testet nur die
// Devices und lädt dann mit den ausgewählten deviceIds in sessionStorage weiter.
// -----------------------------------------------------------------------------

export function LiveSetupForm() {
  const router = useRouter();
  const previewRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);
  const [selectedCam, setSelectedCam] = useState<string>('');
  const [selectedMic, setSelectedMic] = useState<string>('');
  const [camEnabled, setCamEnabled] = useState(true);
  const [micEnabled, setMicEnabled] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('other');
  const [moderationEnabled, setModerationEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();

  // -----------------------------------------------------------------------------
  // Device-Permission + Enumeration
  // -----------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function initDevices() {
      try {
        // Einmal `getUserMedia` rufen, um Permissions zu triggern. Danach liefert
        // `enumerateDevices` die echten Device-Labels (sonst generisch "camera 1").
        const initialStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        if (cancelled) {
          initialStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = initialStream;
        if (previewRef.current) previewRef.current.srcObject = initialStream;

        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoIn = devices.filter((d) => d.kind === 'videoinput');
        const audioIn = devices.filter((d) => d.kind === 'audioinput');
        setCams(videoIn);
        setMics(audioIn);

        const activeVideoTrack = initialStream.getVideoTracks()[0];
        const activeAudioTrack = initialStream.getAudioTracks()[0];
        setSelectedCam(activeVideoTrack?.getSettings().deviceId ?? videoIn[0]?.deviceId ?? '');
        setSelectedMic(activeAudioTrack?.getSettings().deviceId ?? audioIn[0]?.deviceId ?? '');
      } catch (err) {
        setPermissionError(
          err instanceof Error
            ? `Kamera/Mikro-Zugriff verweigert: ${err.message}`
            : 'Kamera/Mikro-Zugriff verweigert.',
        );
      }
    }

    initDevices();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // -----------------------------------------------------------------------------
  // Bei Device-Wechsel neu einholen
  // -----------------------------------------------------------------------------
  const applyDeviceChange = async (camId: string, micId: string) => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    try {
      const next = await navigator.mediaDevices.getUserMedia({
        video: camId ? { deviceId: { exact: camId } } : true,
        audio: micId ? { deviceId: { exact: micId } } : true,
      });
      streamRef.current = next;
      if (previewRef.current) previewRef.current.srcObject = next;
      // Mute-States anwenden
      next.getVideoTracks().forEach((t) => (t.enabled = camEnabled));
      next.getAudioTracks().forEach((t) => (t.enabled = micEnabled));
    } catch (err) {
      setPermissionError(
        err instanceof Error ? `Gerät nicht nutzbar: ${err.message}` : 'Gerät nicht nutzbar.',
      );
    }
  };

  const handleCamChange = (id: string) => {
    setSelectedCam(id);
    applyDeviceChange(id, selectedMic);
  };
  const handleMicChange = (id: string) => {
    setSelectedMic(id);
    applyDeviceChange(selectedCam, id);
  };

  const toggleCam = () => {
    const next = !camEnabled;
    setCamEnabled(next);
    streamRef.current?.getVideoTracks().forEach((t) => (t.enabled = next));
  };
  const toggleMic = () => {
    const next = !micEnabled;
    setMicEnabled(next);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = next));
  };

  // -----------------------------------------------------------------------------
  // Go-Live
  // -----------------------------------------------------------------------------
  const handleGoLive = () => {
    if (!title.trim() || title.trim().length < 3) {
      setFormError('Titel muss mindestens 3 Zeichen haben.');
      return;
    }
    setFormError(null);

    startTransition(async () => {
      const result = await startLiveSession({
        title: title.trim(),
        category,
        moderationEnabled,
      });
      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      // Device-Präferenzen für den Host-Deck übergeben via sessionStorage.
      // URL-Query wäre lesbar, aber deviceIds sind Privat-Hinweise → sessionStorage
      // bleibt tab-lokal und räumt sich selbst beim Close auf.
      try {
        sessionStorage.setItem(
          `live-host-prefs-${result.data.sessionId}`,
          JSON.stringify({
            cam: selectedCam,
            mic: selectedMic,
            camEnabled,
            micEnabled,
          }),
        );
      } catch {
        // sessionStorage kann in Private-Mode blockiert sein — egal
      }

      // Eigene Preview-Tracks stoppen, damit LiveKit sauber anfordern kann
      streamRef.current?.getTracks().forEach((t) => t.stop());

      router.push(`/live/host/${result.data.sessionId}` as Route);
    });
  };

  // -----------------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------------
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* Preview-Panel */}
      <div className="flex flex-col gap-3">
        <div className="relative aspect-video w-full overflow-hidden rounded-xl border bg-black">
          {permissionError ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-6 text-center text-white">
              <VideoOff className="h-10 w-10 text-white/40" />
              <p className="text-sm">{permissionError}</p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Neu versuchen
              </button>
            </div>
          ) : (
            <video
              ref={previewRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
          )}

          {!camEnabled && !permissionError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 text-white/60">
              <VideoOff className="h-10 w-10" />
            </div>
          )}
        </div>

        {/* Device-Toggles */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCam}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              camEnabled
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
            Kamera
          </button>
          <button
            type="button"
            onClick={toggleMic}
            className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              micEnabled
                ? 'border-primary bg-primary/10 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
            Mikro
          </button>
        </div>

        {/* Device-Selectors */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Kamera</span>
            <select
              value={selectedCam}
              onChange={(e) => handleCamChange(e.target.value)}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              disabled={cams.length === 0}
            >
              {cams.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label || `Kamera ${cams.indexOf(cam) + 1}`}
                </option>
              ))}
              {cams.length === 0 && <option>Keine Kamera gefunden</option>}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">Mikro</span>
            <select
              value={selectedMic}
              onChange={(e) => handleMicChange(e.target.value)}
              className="rounded-md border bg-background px-2 py-1.5 text-sm"
              disabled={mics.length === 0}
            >
              {mics.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Mikro ${mics.indexOf(mic) + 1}`}
                </option>
              ))}
              {mics.length === 0 && <option>Kein Mikro gefunden</option>}
            </select>
          </label>
        </div>
      </div>

      {/* Form-Panel */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className="text-sm font-medium">
            Titel
          </label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, 120))}
            placeholder="Worüber geht's heute?"
            maxLength={120}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <p className="text-[11px] text-muted-foreground">{title.length}/120</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="category" className="text-sm font-medium">
            Kategorie
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          >
            <option value="gaming">Gaming</option>
            <option value="music">Musik</option>
            <option value="talk">Talk / Podcast</option>
            <option value="lifestyle">Lifestyle</option>
            <option value="sport">Sport</option>
            <option value="education">Bildung</option>
            <option value="creative">Kreativ / Art</option>
            <option value="other">Sonstiges</option>
          </select>
        </div>

        <label className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2">
          <input
            type="checkbox"
            checked={moderationEnabled}
            onChange={(e) => setModerationEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <div className="flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <ShieldCheck className="h-4 w-4 text-green-500" />
              Chat-Moderation aktiv
            </p>
            <p className="text-xs text-muted-foreground">
              Globale Wortliste filtert Beleidigungen automatisch (Shadow-Ban).
            </p>
          </div>
        </label>

        {formError && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
            {formError}
          </div>
        )}

        <button
          type="button"
          onClick={handleGoLive}
          disabled={isPending || !!permissionError}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-br from-red-500 to-red-600 px-4 py-3 text-sm font-semibold text-white shadow-md transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Starte…
            </>
          ) : (
            <>
              <Radio className="h-4 w-4" />
              Live gehen
            </>
          )}
        </button>

        <p className="text-xs text-muted-foreground">
          Mit dem Klick stimmst du den <a className="underline hover:text-foreground">Community-Regeln</a>{' '}
          zu. Streams können jederzeit von Moderatoren beendet werden.
        </p>
      </div>
    </div>
  );
}
