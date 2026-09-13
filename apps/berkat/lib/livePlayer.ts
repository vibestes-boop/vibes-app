// Welche Show gerade läuft, ob verbunden wird und ob sie groß oder klein zu
// sehen ist.
//
// Der Zustand liegt AUSSERHALB der Navigation, weil die LiveKit-Verbindung im
// Wurzel-Layout hängt. Nur so überlebt das Video den Wechsel auf die
// Startseite — vorher starb es, sobald der Raum-Bildschirm abgebaut wurde.

import { create } from 'zustand';
import type { CameraFacing } from './useCameraPreview';

export type LiveSessionInfo = {
  id: string;
  title: string | null;
  thumbnailUrl: string | null;
  /** LiveKit-Raum. Ohne ihn gibt es kein Token und kein Video. */
  roomName: string | null;
  hostId: string;
  isHost: boolean;
};

type LivePlayerState = {
  session: LiveSessionInfo | null;
  /**
   * Erst wenn true wird ein Token geholt und verbunden. Zuschauer sind das
   * sofort, der Gastgeber erst nach „Live gehen" — vorher soll nichts nach
   * draußen gehen.
   */
  connected: boolean;
  /** true = läuft als kleines Fenster weiter */
  minimized: boolean;
  cameraFacing: CameraFacing;

  open: (session: LiveSessionInfo) => void;
  goLive: (facing?: CameraFacing) => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;
};

export const useLivePlayer = create<LivePlayerState>((set) => ({
  session: null,
  connected: false,
  minimized: false,
  cameraFacing: 'environment',

  // Idempotent über die Show-ID: der Raum meldet die Session bei jedem
  // Datenabruf neu an (alle 15 s). Würde das `connected` zurücksetzen, flöge
  // der Gastgeber im Takt aus seiner eigenen Sendung.
  open: (session) =>
    set((state) => {
      // A role change must require the host's explicit camera-start action again.
      const same = state.session?.id === session.id && state.session?.isHost === session.isHost;
      return {
        session,
        minimized: same ? state.minimized : false,
        // Zuschauer verbinden sofort, der Gastgeber erst auf Knopfdruck.
        connected: same ? state.connected : !session.isHost,
        cameraFacing: same ? state.cameraFacing : 'environment',
      };
    }),
  goLive: (cameraFacing = 'environment') => set({ connected: true, cameraFacing }),
  minimize: () => set((s) => (s.session ? { minimized: true } : s)),
  restore: () => set({ minimized: false }),
  close: () => set({ session: null, connected: false, minimized: false, cameraFacing: 'environment' }),
}));
