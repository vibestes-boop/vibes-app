import { create } from 'zustand';

/**
 * Beiträge, die ein Raster (z. B. Entdecken) an den senkrechten Feed
 * (user-posts) übergibt. So zeichnet der Feed sofort mit Bild und Text, statt
 * während des Hereinschiebens einen Ladekreis zu zeigen; die übrigen Felder
 * lädt er im Hintergrund nach.
 */
export type PagerSeed = {
  id: string;
  author_id?: string | null;
  media_url: string | null;
  media_type: string;
  thumbnail_url?: string | null;
  bunny_video_id?: string | null;
  caption: string | null;
  username?: string | null;
  avatar_url?: string | null;
  view_count?: number | null;
};

interface PostPagerStore {
  seed: PagerSeed[];
  setSeed: (seed: PagerSeed[]) => void;
}

export const usePostPagerStore = create<PostPagerStore>((set) => ({
  seed: [],
  setSeed: (seed) => set({ seed }),
}));
