/**
 * useModerateImage — fire-and-forget NSFW check nach dem Post-Upload
 *
 * Ruft die `moderate-image` Supabase Edge Function asynchron auf.
 * Blockiert den User-Flow NICHT — läuft im Hintergrund.
 *
 * Usage:
 *   const { moderate } = useModerateImage();
 *   // nach supabase.from('posts').insert(...)
 *   if (mediaUrl && mediaType === 'image') {
 *     moderate(postId, mediaUrl);
 *   }
 */

import { supabase } from './supabase';

interface ModerateResult {
  ok: boolean;
  result?: 'safe' | 'nsfw';
  score?: number;
  error?: string;
}

export function useModerateImage() {
  /**
   * Startet NSFW-Check asynchron (fire-and-forget).
   * Fehler werden geloggt aber nicht als Exception weitergegeben.
   */
  const moderate = async (postId: string, imageUrl: string): Promise<void> => {
    try {
      const { data, error } = await supabase.functions.invoke<ModerateResult>('moderate-image', {
        body: { post_id: postId, image_url: imageUrl },
      });

      if (error) {
        __DEV__ && console.warn('[moderate] Edge Function error:', error.message);
        return;
      }

      if (data?.result === 'nsfw') {
        __DEV__ && console.warn(`[moderate] Post ${postId} flagged as NSFW (score: ${data.score?.toFixed(3)})`);
      } else {
        __DEV__ && console.log(`[moderate] Post ${postId} is safe (score: ${data?.score?.toFixed(3)})`);
      }
    } catch (err) {
      // Moderation-Fehler sollen den User-Flow nie blockieren
      __DEV__ && console.warn('[moderate] Unexpected error:', err);
    }
  };

  return { moderate };
}
