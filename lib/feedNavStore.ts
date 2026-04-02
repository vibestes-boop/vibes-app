import { create } from 'zustand';

/**
 * Speichert die aktuelle Feed-Post-ID-Liste für Swipe-Navigation in der Post-Detailseite.
 * Wird von index.tsx (Vibes Feed) befüllt, von post/[id].tsx gelesen.
 */
interface FeedNavStore {
  postIds: string[];
  source: 'vibes' | null;
  setPostIds: (ids: string[], source: 'vibes') => void;
}

export const useFeedNavStore = create<FeedNavStore>((set) => ({
  postIds: [],
  source: null,
  setPostIds: (ids, source) => set({ postIds: ids, source }),
}));
