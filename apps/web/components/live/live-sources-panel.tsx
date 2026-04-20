'use client';

import { useEffect, useState } from 'react';
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  ScreenShare,
  ScreenShareOff,
} from 'lucide-react';

// -----------------------------------------------------------------------------
// LiveSourcesPanel — Cam/Mic/Screen-Toggles + Device-Auswahl.
//
// Hält KEINE LiveKit-Tracks selbst — nur UI. Parent `LiveHostDeck` hat die
// Track-Ownership und reicht Toggle-Handler runter. Dieses Panel kümmert sich
// nur um:
//   • MediaDevices-Enumeration (aktualisiert auf `devicechange` Event)
//   • Passthrough der selected-deviceIds nach oben via onSwitchCam/onSwitchMic
//   • Visuelles Feedback (aktiv = gefüllt, inaktiv = outline)
// -----------------------------------------------------------------------------

export interface LiveSourcesPanelProps {
  camEnabled: boolean;
  micEnabled: boolean;
  screenEnabled: boolean;
  selectedCam: string;
  selectedMic: string;
  onToggleCam: () => void | Promise<void>;
  onToggleMic: () => void | Promise<void>;
  onToggleScreen: () => void | Promise<void>;
  onSwitchCam: (deviceId: string) => void | Promise<void>;
  onSwitchMic: (deviceId: string) => void | Promise<void>;
}

export function LiveSourcesPanel({
  camEnabled,
  micEnabled,
  screenEnabled,
  selectedCam,
  selectedMic,
  onToggleCam,
  onToggleMic,
  onToggleScreen,
  onSwitchCam,
  onSwitchMic,
}: LiveSourcesPanelProps) {
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  const [mics, setMics] = useState<MediaDeviceInfo[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (cancelled) return;
        setCams(devices.filter((d) => d.kind === 'videoinput'));
        setMics(devices.filter((d) => d.kind === 'audioinput'));
      } catch {
        // Permissions noch nicht erteilt → leere Liste, weiter ist unkritisch
      }
    }

    refresh();
    const listener = () => refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', listener);

    return () => {
      cancelled = true;
      navigator.mediaDevices?.removeEventListener?.('devicechange', listener);
    };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Quellen
      </h3>

      {/* Cam-Row */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <button
          type="button"
          onClick={() => void onToggleCam()}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-32 ${
            camEnabled
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground'
          }`}
          aria-pressed={camEnabled}
          title="Kamera an/aus (V)"
        >
          {camEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
          Kamera
        </button>
        <select
          value={selectedCam}
          onChange={(e) => void onSwitchCam(e.target.value)}
          disabled={cams.length === 0}
          className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
        >
          {cams.length === 0 && <option>Keine Kamera gefunden</option>}
          {cams.map((cam, i) => (
            <option key={cam.deviceId} value={cam.deviceId}>
              {cam.label || `Kamera ${i + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Mic-Row */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <button
          type="button"
          onClick={() => void onToggleMic()}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-32 ${
            micEnabled
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground'
          }`}
          aria-pressed={micEnabled}
          title="Mikro an/aus (M)"
        >
          {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          Mikro
        </button>
        <select
          value={selectedMic}
          onChange={(e) => void onSwitchMic(e.target.value)}
          disabled={mics.length === 0}
          className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs disabled:opacity-50"
        >
          {mics.length === 0 && <option>Kein Mikro gefunden</option>}
          {mics.map((mic, i) => (
            <option key={mic.deviceId} value={mic.deviceId}>
              {mic.label || `Mikro ${i + 1}`}
            </option>
          ))}
        </select>
      </div>

      {/* Screen-Row */}
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
        <button
          type="button"
          onClick={() => void onToggleScreen()}
          className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-32 ${
            screenEnabled
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground'
          }`}
          aria-pressed={screenEnabled}
          title="Bildschirm teilen (S)"
        >
          {screenEnabled ? (
            <ScreenShareOff className="h-4 w-4" />
          ) : (
            <ScreenShare className="h-4 w-4" />
          )}
          Screen
        </button>
        <p className="text-[11px] text-muted-foreground sm:flex-1">
          {screenEnabled
            ? 'Dein Bildschirm ist live. Klick zum Beenden.'
            : 'Teile Tab, Fenster oder ganzen Bildschirm.'}
        </p>
      </div>
    </div>
  );
}
