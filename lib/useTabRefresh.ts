import { create } from 'zustand';

interface TabRefreshStore {
  // Vibes
  vibesRefreshTick: number;
  isVibesRefreshing: boolean;
  triggerVibesRefresh: () => void;
  setVibesRefreshing: (v: boolean) => void;
  // Guild
  guildRefreshTick: number;
  isGuildRefreshing: boolean;
  triggerGuildRefresh: () => void;
  setGuildRefreshing: (v: boolean) => void;
}

export const useTabRefreshStore = create<TabRefreshStore>((set) => ({
  // Vibes
  vibesRefreshTick: 0,
  isVibesRefreshing: false,
  triggerVibesRefresh: () =>
    set((s) => ({ vibesRefreshTick: s.vibesRefreshTick + 1, isVibesRefreshing: true })),
  setVibesRefreshing: (v) => set({ isVibesRefreshing: v }),
  // Guild
  guildRefreshTick: 0,
  isGuildRefreshing: false,
  triggerGuildRefresh: () =>
    set((s) => ({ guildRefreshTick: s.guildRefreshTick + 1, isGuildRefreshing: true })),
  setGuildRefreshing: (v) => set({ isGuildRefreshing: v }),
}));

/** Globale Aktion-Refs: direkte Aufrufe ohne React-Rendering-Delay */
export const vibesFeedActions = {
  refresh: null as (() => void) | null,
};

export const guildFeedActions = {
  refresh: null as (() => void) | null,
};
