// Welche Show gerade läuft, ob verbunden wird und ob sie groß oder klein zu
// sehen ist.
//
// Der Zustand liegt AUSSERHALB der Navigation, weil die LiveKit-Verbindung im
// Wurzel-Layout hängt. Nur so überlebt das Video den Wechsel auf die
// Startseite — vorher starb es, sobald der Raum-Bildschirm abgebaut wurde.

import { create } from 'zustand';

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

  open: (session: LiveSessionInfo) => void;
  goLive: () => void;
  minimize: () => void;
  restore: () => void;
  close: () => void;
};

export const useLivePlayer = create<LivePlayerState>((set) => ({
  session: null,
  connected: false,
  minimized: false,

  // Idempotent über die Show-ID: der Raum meldet die Session bei jedem
  // Datenabruf neu an (alle 15 s). Würde das `connected` zurücksetzen, flöge
  // der Gastgeber im Takt aus seiner eigenen Sendung.
  open: (session) =>
    set((state) => {
      const same = state.session?.id === session.id;
      return {
        session,
        minimized: same ? state.minimized : false,
        // Zuschauer verbinden sofort, der Gastgeber erst auf Knopfdruck.
        connected: same ? state.connected : !session.isHost,
      };
    }),
  goLive: () => set({ connected: true }),
  minimize: () => set((s) => (s.session ? { minimized: true } : s)),
  restore: () => set({ minimized: false }),
  close: () => set({ session: null, connected: false, minimized: false }),
}));
