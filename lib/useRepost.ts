/**
 * useRepost — Repost (In-App Teilen) Toggle
 * Optimistic Update: UI reagiert sofort, Supabase wird im Hintergrund aktualisiert.
 */
import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/lib/authStore';

interface RepostState {
  isReposted: boolean;
  count:      number;
  isLoading:  boolean;
  toggle:     () => void;
}

export function useRepost(postId: string): RepostState {
  const currentUserId = useAuthStore((s) => s.profile?.id);
  const [isReposted, setIsReposted] = useState(false);
  const [count,      setCount]      = useState(0);
  const [isLoading,  setIsLoading]  = useState(false);
  // Ref für stale-closure-sicheres toggle
  const stateRef = useRef({ isReposted, count });
  stateRef.current = { isReposted, count };

  useEffect(() => {
    if (!postId || !currentUserId) return;
    let canceled = false;

    Promise.all([
      // Hat aktuell eingeloggter User diesen Post gerepostet?
      supabase
        .from('reposts')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', currentUserId)
        .maybeSingle(),
      // Gesamtanzahl Reposts dieses Posts
      supabase
        .from('reposts')
        .select('id', { count: 'exact', head: true })
        .eq('post_id', postId),
    ]).then(([{ data: myRepost }, { count: total }]) => {
      if (canceled) return;
      setIsReposted(!!myRepost);
      setCount(total ?? 0);
    });

    return () => { canceled = true; };
  }, [postId, currentUserId]);

  const toggle = () => {
    if (!currentUserId || isLoading) return;
    const prev = stateRef.current.isReposted;

    // Optimistic update
    setIsReposted(!prev);
    setCount((c) => prev ? Math.max(0, c - 1) : c + 1);
    setIsLoading(true);

    const op = prev
      ? supabase.from('reposts').delete().eq('post_id', postId).eq('user_id', currentUserId)
      : supabase.from('reposts').insert({ post_id: postId, user_id: currentUserId });

    op.then(({ error }) => {
      if (error) {
        // Rollback bei Fehler
        setIsReposted(prev);
        setCount((c) => prev ? c + 1 : Math.max(0, c - 1));
        __DEV__ && console.warn('[useRepost] Fehler:', error.message);
      }
      setIsLoading(false);
    });
  };

  return { isReposted, count, isLoading, toggle };
}
