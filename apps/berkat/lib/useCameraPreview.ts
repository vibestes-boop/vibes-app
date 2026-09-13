import { useEffect, useRef, useState } from 'react';

export type CameraFacing = 'environment' | 'user';
export type PreviewTrack = { stop: () => void; restartTrack: (options: { facingMode: CameraFacing }) => Promise<unknown> };

/** Own only the local preview. Starting transmission remains an explicit caller action. */
export function useCameraPreview<T extends PreviewTrack>(create: (facing: CameraFacing) => Promise<T>, onStart: (facing: CameraFacing) => void, onClose: () => void) {
  const [track, setTrack] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraFacing>('environment');
  const [attempt, setAttempt] = useState(0);
  const current = useRef<T | null>(null);
  const face = useRef<CameraFacing>('environment');
  const generation = useRef(0);
  const lock = useRef(true);
  const closed = useRef(false);

  useEffect(() => {
    const version = ++generation.current;
    lock.current = true;
    setLoading(true); setBusy(false); setStarting(false); setError(null); setTrack(null);
    void create(face.current).then(created => {
      if (generation.current !== version) { created.stop(); return; }
      current.current = created;
      setTrack(created);
    }).catch(() => {
      if (generation.current === version) setError('Prüfe den Kamera-Zugriff in den Geräteeinstellungen und versuche es erneut.');
    }).finally(() => {
      if (generation.current === version) { lock.current = false; setLoading(false); }
    });
    return () => {
      generation.current++;
      current.current?.stop();
      current.current = null;
    };
  }, [attempt, create]);

  const retry = () => {
    if (lock.current) return;
    lock.current = true;
    setAttempt(value => value + 1);
  };
  const switchCamera = async () => {
    const active = current.current;
    if (lock.current || !active) return;
    lock.current = true;
    setBusy(true);
    const version = generation.current;
    const next = face.current === 'environment' ? 'user' : 'environment';
    try {
      await active.restartTrack({ facingMode: next });
      if (generation.current !== version) { active.stop(); return; }
      face.current = next; setFacing(next);
    } catch {
      if (generation.current !== version) return;
      active.stop(); current.current = null; setTrack(null);
      setError('Die Kamera ließ sich nicht wechseln. Öffne die Vorschau erneut.');
    } finally {
      if (generation.current === version) { lock.current = false; setBusy(false); }
    }
  };
  const start = () => {
    const active = current.current;
    if (lock.current || !active) return;
    lock.current = true;
    setStarting(true);
    current.current = null;
    active.stop();
    setTrack(null);
    onStart(face.current);
  };
  const close = () => {
    if (closed.current) return;
    closed.current = true;
    generation.current++;
    lock.current = true;
    current.current?.stop(); current.current = null;
    onClose();
  };
  return { track, loading, busy, starting, error, facing, retry, switchCamera, start, close };
}
