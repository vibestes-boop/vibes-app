'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// OBS-WHIP-Ingest Server-Actions (v1.w.UI.35 — Phase 6b der WEB_ROADMAP).
//
// Wrapper um die `livekit-whip-ingress` Edge-Function. Wir delegieren den
// gesamten LiveKit-Twirp-Flow an die Function (Admin-JWT-Sigung,
// Session-Insert, Ingress-Create) — hier macht die Server-Action nur:
//   1. User-JWT besorgen (via Supabase Server-Client)
//   2. Function via supabase.functions.invoke() rufen
//   3. Antwort in einen für die UI lesbaren Shape mappen
//
// Warum Server-Action statt Direkt-Fetch im Client:
//   - User-JWT bleibt server-side, wandert nie ins Bundle
//   - Bei Erfolg können wir gezielt Cache-Tags revalidieren (zB
//     /studio/live falls dort offene Streams gelistet sind)
//   - Konsistent mit dem Rest der Web-Auth-Architektur (action-based)
// -----------------------------------------------------------------------------

const createSchema = z.object({
  title: z.string().trim().min(1, 'Titel erforderlich.').max(140, 'Maximal 140 Zeichen.'),
  privacy: z.enum(['public', 'private']).default('public'),
});

const sessionIdSchema = z.object({
  sessionId: z.string().uuid('Ungültige Session-ID.'),
});

export type CreateWhipResult =
  | {
      ok: true;
      sessionId: string;
      roomName: string;
      ingressUrl: string;
      ingressStreamKey: string;
    }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

export type StatusResult =
  | { ok: true; isPublishing: boolean }
  | { ok: false; error: string };

type InvokeResult<T> = { error: string } | (T & { error?: never });

async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<InvokeResult<T>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Bitte zuerst anmelden.' };

  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) return { error: error.message ?? 'Function-Aufruf fehlgeschlagen.' };
  // Edge-Function kann ein eigenes `error`-Feld zurückgeben (z.B. bei
  // Auth-Fail) — als String-Error normalisieren.
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return { error: (data as { error: string }).error };
  }
  return data as InvokeResult<T>;
}

// -----------------------------------------------------------------------------
// createWhipIngress — legt Session + WHIP-Ingress an.
//
// Returns ingressUrl + ingressStreamKey die der User in OBS eintragen muss.
// Diese Werte werden auch in der live_sessions-Row persistiert (für späteren
// Re-Read via get_my_ingress_credentials RPC, falls der User die Seite
// reloadet bevor er OBS konfiguriert hat).
// -----------------------------------------------------------------------------
export async function createWhipIngress(input: {
  title: string;
  privacy?: 'public' | 'private';
}): Promise<CreateWhipResult> {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' };
  }

  const result = await invokeFunction<{
    sessionId: string;
    roomName: string;
    ingressUrl: string;
    ingressStreamKey: string;
  }>('livekit-whip-ingress', {
    action: 'create',
    title: parsed.data.title,
    privacy: parsed.data.privacy,
  });

  if ('error' in result && typeof result.error === 'string') {
    return { ok: false, error: result.error };
  }
  if (!result.sessionId || !result.ingressUrl || !result.ingressStreamKey || !result.roomName) {
    return { ok: false, error: 'Antwort vom Server unvollständig.' };
  }

  return {
    ok: true,
    sessionId: result.sessionId,
    roomName: result.roomName,
    ingressUrl: result.ingressUrl,
    ingressStreamKey: result.ingressStreamKey,
  };
}

// -----------------------------------------------------------------------------
// deleteWhipIngress — beendet die Session + räumt den LiveKit-Ingress auf.
//
// Wird vom UI gerufen wenn der User „Stream beenden" klickt (oder beim
// Page-Unload als best-effort cleanup). Idempotent — doppel-Call schadet
// nicht.
// -----------------------------------------------------------------------------
export async function deleteWhipIngress(sessionId: string): Promise<SimpleResult> {
  const parsed = sessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Session-ID.' };
  }

  const result = await invokeFunction<{ ok: boolean }>('livekit-whip-ingress', {
    action: 'delete',
    sessionId: parsed.data.sessionId,
  });

  if ('error' in result && typeof result.error === 'string') {
    return { ok: false, error: result.error };
  }
  return { ok: true };
}

// -----------------------------------------------------------------------------
// getWhipStatus — pollt LiveKit ob der Ingress aktuell empfängt.
//
// Vom UI im 3s-Intervall gerufen während der „Wartet auf Stream"-Phase.
// Sobald isPublishing=true, weiß der UI dass OBS verbunden ist und der
// Stream live ist → Redirect auf /live/host/[id] (Host-Watch-View).
// -----------------------------------------------------------------------------
export async function getWhipStatus(sessionId: string): Promise<StatusResult> {
  const parsed = sessionIdSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Session-ID.' };
  }

  const result = await invokeFunction<{ isPublishing: boolean }>('livekit-whip-ingress', {
    action: 'status',
    sessionId: parsed.data.sessionId,
  });

  if ('error' in result && typeof result.error === 'string') {
    return { ok: false, error: result.error };
  }
  return { ok: true, isPublishing: !!result.isPublishing };
}
