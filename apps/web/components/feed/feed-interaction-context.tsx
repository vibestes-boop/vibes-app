'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

// -----------------------------------------------------------------------------
// FeedInteractionContext — zentraler State für Feed-Interaktionen, die aus der
// Karte heraus ausgelöst werden, aber Shell-Level-Layout-Effekte haben
// (v1.w.UI.11 Phase C).
//
// Erster Consumer: „Kommentare öffnen" — TikTok-Parity-Push-Layout. Wenn ein
// User den Kommentar-Button in einer FeedCard drückt, soll auf Desktop (xl+)
// die Center-Spalte schmaler werden und ein Comment-Panel die rechte Sidebar
// ablösen. Auf Mobile / < xl bleibt das bisherige Sheet-Overlay bestehen. Der
// Switch passiert in `HomeFeedShell` — und HomeFeedShell ist der State-Owner,
// nicht die einzelne Karte (FeedCard darf nicht auf Shell-Layout zugreifen).
//
// Warum Context und nicht Prop-Drilling?
// - FeedList iteriert dynamisch über viele FeedCards (Virtualized-Ready). Pro-
//   Drilling eines `onOpenComments(postId)` wäre machbar, aber der Shell muss
//   ohnehin den aktuellen `commentsOpenForPostId` kennen (für Grid-Switch +
//   Panel-Content). Context bündelt Read + Write an einer Stelle.
// - Ein gestubter Fallback (`useFeedInteraction` ohne Provider → no-op-Ref
//   zurückgeben) hält FeedCard in Isolation testbar. Für die Unit-Tests der
//   Karte (Like-Button, Heart-Overlay, Mute-Toggle) war kein Provider nötig
//   und soll auch weiterhin nicht nötig sein.
// -----------------------------------------------------------------------------

interface FeedInteractionContextValue {
  /** `null` wenn kein Panel offen, sonst die Post-ID deren Kommentare angezeigt werden. */
  commentsOpenForPostId: string | null;
  openCommentsFor: (postId: string) => void;
  closeComments: () => void;
}

const FeedInteractionContext = createContext<FeedInteractionContextValue | null>(null);

export function FeedInteractionProvider({ children }: { children: ReactNode }) {
  const [commentsOpenForPostId, setCommentsOpenForPostId] = useState<string | null>(null);

  const openCommentsFor = useCallback((postId: string) => {
    setCommentsOpenForPostId(postId);
  }, []);

  const closeComments = useCallback(() => {
    setCommentsOpenForPostId(null);
  }, []);

  const value = useMemo<FeedInteractionContextValue>(
    () => ({ commentsOpenForPostId, openCommentsFor, closeComments }),
    [commentsOpenForPostId, openCommentsFor, closeComments],
  );

  return <FeedInteractionContext.Provider value={value}>{children}</FeedInteractionContext.Provider>;
}

/**
 * Gibt den Feed-Interaction-State zurück. Wenn kein Provider den Subtree
 * umhüllt (z.B. in isolierten Karten-Tests), liefert der Hook einen
 * no-op-Fallback zurück — openComments/closeComments sind dann leere
 * Funktionen und commentsOpenForPostId bleibt `null`. Das Component-Code
 * muss also nicht defensiv auf `null` prüfen.
 */
export function useFeedInteraction(): FeedInteractionContextValue {
  const ctx = useContext(FeedInteractionContext);
  if (ctx) return ctx;
  return NOOP_CONTEXT;
}

const NOOP_CONTEXT: FeedInteractionContextValue = {
  commentsOpenForPostId: null,
  openCommentsFor: () => undefined,
  closeComments: () => undefined,
};
