import { create } from 'zustand';

type VibeStore = {
  // Live-Werte: aktualisieren sich beim Drag (für UI-Anzeige)
  exploreVibe: number;
  brainVibe: number;
  setExploreVibe: (v: number) => void;
  setBrainVibe: (v: number) => void;

  // Committed-Werte: nur beim Loslassen des Sliders (für React-Query-Key)
  // → Triggern den Feed-Re-fetch
  committedExplore: number;
  committedBrain: number;
  commitVibes: () => void;
};

export const useVibeStore = create<VibeStore>((set, get) => ({
  exploreVibe: 0.5,
  brainVibe: 0.5,
  setExploreVibe: (v) => set({ exploreVibe: v }),
  setBrainVibe: (v) => set({ brainVibe: v }),

  committedExplore: 0.5,
  committedBrain: 0.5,
  commitVibes: () =>
    set((s) => ({
      committedExplore: s.exploreVibe,
      committedBrain: s.brainVibe,
    })),
}));
