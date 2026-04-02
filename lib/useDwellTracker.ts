import { useRef, useCallback, useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { type ViewToken } from 'react-native';
import { supabase } from './supabase';

// ─── Konstanten ────────────────────────────────────────────
const BATCH_FLUSH_THRESHOLD = 5;   // Nach 5 neuen Messungen flushen
const FLUSH_INTERVAL_MS = 30_000;  // Fallback: alle 30s flushen
const MAX_DWELL_MS = 60_000;       // Cap: 60s = Score 1.0 (Backend: score/60000 * α)

// UUID-Check: Demo-Posts (z.B. id='1') überspringen
const isRealPostId = (id: string) => id.includes('-');

// ─── Typen ──────────────────────────────────────────────────
type DwellBatch = Map<string, number>; // postId → akkumulierte ms

// ─── Hook ───────────────────────────────────────────────────
export function useDwellTracker() {
  const startTimes  = useRef<Map<string, number>>(new Map());
  const batch       = useRef<DwellBatch>(new Map());
  const skips       = useRef<Set<string>>(new Set());
  const batchCount  = useRef(0);
  const flushTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Flush: Batch an Supabase senden ──────────────────────
  const flush = useCallback(async () => {
    if (batch.current.size === 0 && skips.current.size === 0) return;

    const records = Array.from(batch.current.entries()).filter(([id]) =>
      isRealPostId(id)
    );
    const skipRecords = Array.from(skips.current).filter(isRealPostId);

    // Batch sofort leeren – nächste Messungen gehen in neuen Batch
    batch.current = new Map();
    skips.current = new Set();
    batchCount.current = 0;

    if (records.length === 0 && skipRecords.length === 0) return;

    // Parallel senden – Fehler loggen, nicht crashen
    await Promise.allSettled([
      ...records.map(([postId, dwellMs]) =>
        supabase.rpc('update_dwell_time', {
          post_id: postId,
          dwell_ms: Math.min(Math.round(dwellMs), MAX_DWELL_MS),
        })
      ),
      ...skipRecords.map((postId) =>
        supabase.rpc('record_skip', { p_post_id: postId })
      )
    ]);
  }, []);

  // ── Sichtbare Posts in Batch übertragen ──────────────────
  // Wird vor jedem Flush aufgerufen der NICHT durch Viewport-Wechsel ausgelöst wird.
  // Grund: Posts in startTimes sind AKTIV sichtbar — ihre Zeit landet erst
  // im Batch wenn sie den Viewport verlassen. Geht die App vorher in den
  // Hintergrund, gehen diese Messungen verloren. Dieser Schritt verhindert das.
  const captureVisiblePosts = useCallback(() => {
    const now = Date.now();
    startTimes.current.forEach((startTime, postId) => {
      const dwellMs = now - startTime;
      if (dwellMs < 500) return;

      // Skip-Bereich: negatives Signal, kein positives Dwell
      if (dwellMs < 2_000) {
        if (isRealPostId(postId)) skips.current.add(postId);
        return;
      }

      const prev = batch.current.get(postId) ?? 0;
      batch.current.set(postId, prev + dwellMs);
      batchCount.current += 1;
    });
    // Hintergrund-Zeit zählt nicht → Timer zurücksetzen
    // Wenn App wieder aktiv wird, beginnen sichtbare Posts neu
    startTimes.current = new Map();
  }, []);

  // ── AppState: Flush wenn App in Hintergrund geht ─────────
  useEffect(() => {
    const appStateSub = AppState.addEventListener(
      'change',
      (state: AppStateStatus) => {
        if (state === 'background' || state === 'inactive') {
          captureVisiblePosts(); // ← FIX: sichtbare Posts sichern
          flush();
        }
      }
    );

    // Fallback-Intervall: alle 30s flushen
    flushTimer.current = setInterval(flush, FLUSH_INTERVAL_MS);

    return () => {
      appStateSub.remove();
      if (flushTimer.current) clearInterval(flushTimer.current);
      captureVisiblePosts(); // ← FIX: auch beim Unmount sichern
      flush();
    };
  }, [flush, captureVisiblePosts]);

  // ── onViewableItemsChanged: Kern-Tracker ─────────────────
  const onViewableItemsChanged = useCallback(
    ({ changed }: { changed: ViewToken[] }) => {
      const now = Date.now();

      changed.forEach(({ item, isViewable }) => {
        const postId = item?.id as string | undefined;
        if (!postId) return;

        if (isViewable) {
          // Post tritt in den Viewport → Timer starten
          startTimes.current.set(postId, now);
        } else {
          // Post verlässt Viewport → Dwell berechnen
          const start = startTimes.current.get(postId);
          if (!start) return;

          const dwellMs = now - start;
          startTimes.current.delete(postId);

          if (dwellMs < 500) return; // Accidental scroll → ignorieren

          // ── Skip-Erkennung (500ms – 2000ms) ─────────────
          // Kurz gesehen aber weggeschrollt → negatives Signal
          if (dwellMs < 2_000) {
            if (isRealPostId(postId)) skips.current.add(postId);
            return; // Nicht als positives Dwell-Signal werten
          }

          // ── Positives Dwell-Signal (>= 2 Sekunden) ───────
          const prev = batch.current.get(postId) ?? 0;
          batch.current.set(postId, prev + dwellMs);
          batchCount.current += 1;

          // Schwelle erreicht → Flush auslösen
          if (batchCount.current >= BATCH_FLUSH_THRESHOLD) flush();
        }
      });
    },
    [flush]
  );

  // viewabilityConfig liegt jetzt in app/(tabs)/index.tsx (Dwell-Paar in viewabilityConfigCallbackPairs)

  return { onViewableItemsChanged };
}
