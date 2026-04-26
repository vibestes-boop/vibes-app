'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// OBS-WHIP-Ingest Server-Actions (v1.w.UI.35 — Phase 6b der WEB_ROADMAP).
// v1.w.UI.36 — Persistenter WHIP-Ingress (Bearer Token ändert sich nie).
//
// Wrapper um die `livekit-whip-ingress` Edge-Function. Wir delegieren den
// gesamten LiveKit-Twirp-Flow an die Function (Admin-JWT-Sigung,
// Session-Insert, Ingress-Create) — hier macht die Server-Action nur:
//   1. User-JWT besorgen (via Supabase Server-Client)
//   2. Function via supabase.functions.invoke() rufen
//   3. Antwort in einen für die UI lesbaren Shape mappen
//
// v1.w.UI.36 Ergänzungen:
//   - getMyWhipIngress(): liest persistente Credentials via SECURITY DEFINER
//     RPC (get_my_whip_ingress). Wird vom OBS-Setup-Form on-mount aufgerufen
//     damit der User seine Credentials sofort sieht ohne einen neuen Stream
//     starten zu müssen.
//   - rotateWhipIngress(): löscht alten LiveKit-Ingress, erstellt neuen,
//     aktualisiert user_whip_ingresses. Gibt neue Credentials zurück.
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
      isPersistent: boolean;
    }
  | { ok: false; error: string };

export type SimpleResult = { ok: true } | { ok: false; error: string };

export type StatusResult =
  | { ok: true; isPublishing: boolean }
  | { ok: false; error: string };

export type WhipIngressInfo = {
  ingressId: string;
  ingressUrl: string;
  streamKey: string;
  roomName: string;
} | null;

export type GetMyWhipIngressResult =
  | { ok: true; ingress: WhipIngressInfo }
  | { ok: false; error: string };

export type RotateWhipResult =
  | { ok: true; ingressUrl: string; ingressStreamKey: string }
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
// getMyWhipIngress — liest persistente Ingress-Credentials aus der DB.
//
// Nutzt den SECURITY DEFINER RPC get_my_whip_ingress() der die column-level
// REVOKE auf stream_key umgeht (nur für den eigenen User).
//
// Gibt null zurück wenn noch kein Ingress existiert (erster Stream).
// -----------------------------------------------------------------------------
export async function getMyWhipIngress(): Promise<GetMyWhipIngressResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bitte zuerst anmelden.' };

  const { data, error } = await supabase.rpc('get_my_whip_ingress');
  if (error) return { ok: false, error: error.message };

  const row = (data as Array<{
    ingress_id: string;
    ingress_url: string;
    stream_key: string;
    room_name: string;
  }>)?.[0];

  if (!row) return { ok: true, ingress: null };

  return {
    ok: true,
    ingress: {
      ingressId: row.ingress_id,
      ingressUrl: row.ingress_url,
      streamKey: row.stream_key,
      roomName: row.room_name,
    },
  };
}

// -----------------------------------------------------------------------------
// createWhipIngress — legt Session + ggf. WHIP-Ingress an.
//
// v1.w.UI.36: Die Edge-Function prüft jetzt selbst ob ein persistenter Ingress
// existiert. Falls ja, wird nur eine neue Session angelegt und die
// gespeicherten Credentials zurückgegeben — kein neuer LiveKit-Ingress.
// Falls nein, wird ein neuer Ingress erstellt.
//
// Returns ingressUrl + ingressStreamKey die der User in OBS eintragen muss
// (bei vorhandenem Ingress: dieselben Werte wie beim letzten Mal).
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
    isPersistent: boolean;
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
    isPersistent: result.isPersistent ?? true,
  };
}

// -----------------------------------------------------------------------------
// deleteWhipIngress — beendet die Session.
//
// v1.w.UI.36: Der LiveKit-Ingress bleibt erhalten — nur die Session wird auf
// status='ended' gesetzt. Idempotent — doppel-Call schadet nicht.
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

// -----------------------------------------------------------------------------
// rotateWhipIngress — erstellt frische Credentials (neuer Stream-Key).
//
// Löscht den alten LiveKit-Ingress und erstellt einen neuen mit demselben
// room_name. Nützlich wenn der Stream-Key kompromittiert wurde.
//
// Hinweis: Falls gerade ein Stream läuft, wird OBS getrennt. Der User sollte
// vorher „Stream beenden" klicken.
// -----------------------------------------------------------------------------
export async function rotateWhipIngress(): Promise<RotateWhipResult> {
  const result = await invokeFunction<{
    ingressUrl: string;
    ingressStreamKey: string;
    ingressId: string;
  }>('livekit-whip-ingress', {
    action: 'rotate',
  });

  if ('error' in result && typeof result.error === 'string') {
    return { ok: false, error: result.error };
  }
  if (!result.ingressUrl || !result.ingressStreamKey) {
    return { ok: false, error: 'Antwort vom Server unvollständig.' };
  }

  return { ok: true, ingressUrl: result.ingressUrl, ingressStreamKey: result.ingressStreamKey };
}
