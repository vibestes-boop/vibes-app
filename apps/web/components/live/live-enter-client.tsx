'use client';

import { useEffect } from 'react';
import { joinLiveSession, leaveLiveSession } from '@/app/actions/live';

// -----------------------------------------------------------------------------
// LiveEnterClient — Side-Effect-only-Komponente. Ruft `joinLiveSession` beim
// Mount, `leaveLiveSession` beim Unmount. Rendert kein DOM. Dedup in der RPC
// garantiert: wenn der Viewer schon eingetragen ist, wird der Counter NICHT
// erhöht (Phase-2-Hotfix v1.27.0, `live_session_viewers` PK).
//
// Fire-and-forget: Fehler werden bewusst geschluckt. Der Counter ist Nice-
// to-have-Analytics, nicht sicherheitskritisch. Bei Netz-Fehler: Viewer
// schaut trotzdem.
// -----------------------------------------------------------------------------

export function LiveEnterClient({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    joinLiveSession(sessionId).catch(() => {});

    // Bei Tab-Close ein best-effort `leave` senden. `beforeunload` ist nicht
    // zuverlässig für async — wir nutzen `visibilitychange` + Navigator-Beacon-
    // Pattern fehlt hier (Server-Action kann kein Beacon). Daher: Standard-
    // Unmount + Session-Timeout auf DB-Seite putzt Zombie-Einträge.
    return () => {
      leaveLiveSession(sessionId).catch(() => {});
    };
  }, [sessionId]);

  return null;
}
