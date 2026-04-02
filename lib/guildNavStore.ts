import { create } from 'zustand';
import type { GuildPost } from './usePosts';

/**
 * Speichert alle Guild-Feed-Posts für Echtzeit-Swipe-Navigation in der Detail-Ansicht.
 * guild.tsx befüllt den Store, guild-post/[id].tsx liest daraus.
 */
interface GuildNavStore {
  posts: GuildPost[];
  guildColors: [string, string];
  setPosts: (posts: GuildPost[], colors: [string, string]) => void;
}

export const useGuildNavStore = create<GuildNavStore>((set) => ({
  posts: [],
  guildColors: ['#7C3AED', '#06B6D4'],
  setPosts: (posts, colors) => set({ posts, guildColors: colors }),
}));
