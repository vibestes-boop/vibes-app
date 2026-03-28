import { useEffect, useCallback, useRef } from 'react';
import { router } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useStoryViewerStore } from '@/lib/storyViewerStore';
import { StoryViewer } from '@/components/ui/StoryViewer';

export default function StoryViewerScreen() {
  const { group, allGroups, close, setGroup } = useStoryViewerStore();
  const queryClient = useQueryClient();
  const closingRef = useRef(false);

  const handleClose = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    close();
    // Stories-Cache sofort invalidieren → Ring-Status aktualisiert sich beim Rückkehr
    queryClient.invalidateQueries({ queryKey: ['guild-stories'] });
    // router.back() statt replace → bleibt dort wo man war (wie TikTok), Scroll-Position bleibt erhalten
    router.back();
  }, [close, queryClient]);

  // Falls group unerwartet null ist, zurück navigieren
  useEffect(() => {
    if (!group && !closingRef.current) {
      closingRef.current = true;
      router.back();
    }
  }, [group]);

  if (!group) return null;

  const idx = allGroups.findIndex((g) => g.userId === group.userId);

  return (
    <StoryViewer
      group={group}
      allGroups={allGroups}
      visible={true}
      onClose={handleClose}
      onNextGroup={() => {
        const next = allGroups[idx + 1];
        if (next) setGroup(next);
        else handleClose();
      }}
      onPrevGroup={() => {
        const prev = allGroups[idx - 1];
        if (prev) setGroup(prev);
      }}
    />
  );
}
