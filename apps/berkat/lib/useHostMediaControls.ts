import { useEffect, useRef, useState } from 'react';
import type { CameraFacing } from './useCameraPreview';

type CameraTrack = {
  restartTrack: (options: { facingMode: CameraFacing }) => Promise<unknown>;
  mediaStreamTrack?: { getSettings: () => { facingMode?: string } };
};
type Participant = {
  setCameraEnabled: (enabled: boolean) => Promise<unknown>;
  setMicrophoneEnabled: (enabled: boolean) => Promise<unknown>;
};
type Command = { kind: 'camera' | 'mic'; enabled: boolean } | { kind: 'switch'; facing: CameraFacing };
export type HostMediaInput = {
  participant: Participant | undefined; track: CameraTrack | undefined;
  connected: boolean; cameraEnabled: boolean; micEnabled: boolean; initialFacing: CameraFacing;
};

/** The room owns tracks. Controls only issue serialized commands and use confirmed publication state. */
export function useHostMediaControls(input: HostMediaInput) {
  const latest = useRef(input); latest.current = input;
  const facing = useRef(input.initialFacing);
  const generation = useRef(0);
  const alive = useRef(true);
  const lock = useRef(false);
  const retryCommand = useRef<Command | null>(null);
  const [pending, setPending] = useState<Command['kind'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    alive.current = true; generation.current++; lock.current = false; retryCommand.current = null;
    facing.current = input.initialFacing; setPending(null); setError(null);
    return () => { alive.current = false; generation.current++; };
  }, [input.participant]);

  const run = async (command: Command) => {
    const current = latest.current;
    if (!alive.current || lock.current || !current.participant || !current.connected) return;
    if (command.kind === 'switch' && (!current.track || !current.cameraEnabled)) return;
    lock.current = true; setPending(command.kind); setError(null);
    const version = generation.current;
    try {
      if (command.kind === 'switch') await current.track!.restartTrack({ facingMode: command.facing });
      else if (command.kind === 'camera') await current.participant.setCameraEnabled(command.enabled);
      else await current.participant.setMicrophoneEnabled(command.enabled);
      if (version !== generation.current) return;
      if (command.kind === 'switch' && current.track === latest.current.track) facing.current = command.facing;
      retryCommand.current = null;
    } catch {
      if (version !== generation.current) return;
      retryCommand.current = command;
      setError(command.kind === 'mic' ? 'Mikrofon nicht umgeschaltet. Bitte erneut versuchen.'
        : command.kind === 'switch' ? 'Kamera nicht gewechselt. Bitte erneut versuchen.' : 'Kamera nicht umgeschaltet. Bitte erneut versuchen.');
    } finally {
      if (version === generation.current) { lock.current = false; setPending(null); }
    }
  };
  const switchCamera = () => {
    let actual: string | undefined;
    try { actual = latest.current.track?.mediaStreamTrack?.getSettings().facingMode; } catch { /* A replaced native track may already be released. */ }
    const current = actual === 'user' || actual === 'environment' ? actual : facing.current;
    return run({ kind: 'switch', facing: current === 'user' ? 'environment' : 'user' });
  };
  return { pending, error, toggleCamera: () => run({ kind: 'camera', enabled: !latest.current.cameraEnabled }),
    toggleMic: () => run({ kind: 'mic', enabled: !latest.current.micEnabled }), switchCamera,
    retry: () => {
      const command = retryCommand.current;
      if (command?.kind === 'switch' && (!latest.current.track || !latest.current.cameraEnabled)) {
        setError('Kamera noch nicht bereit. Öffne die Kamera-Werkzeuge und schalte sie erneut ein.');
        return Promise.resolve();
      }
      return command ? run(command) : Promise.resolve();
    },
  };
}
