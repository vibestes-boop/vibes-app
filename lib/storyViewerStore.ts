import { create } from 'zustand';
import type { StoryGroup } from './useStories';

type StoryViewerStore = {
  visible: boolean;
  group: StoryGroup | null;
  allGroups: StoryGroup[];
  open: (group: StoryGroup, allGroups: StoryGroup[]) => void;
  close: () => void;
  setGroup: (group: StoryGroup) => void;
};

export const useStoryViewerStore = create<StoryViewerStore>((set) => ({
  visible: false,
  group: null,
  allGroups: [],
  open: (group, allGroups) => set({ visible: true, group, allGroups }),
  close: () => set({ visible: false, group: null }),
  setGroup: (group) => set({ group }),
}));
