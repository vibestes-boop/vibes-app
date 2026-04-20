'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Messages-Server-Actions — DM-Flows für `/messages` und `/messages/[id]`.
//
// Design:
//  1. Cross-Platform-Parität: Web schreibt in dieselben Tabellen (`messages`,
//     `message_reactions`, `conversations`) wie Native. Die realtime-Listener
//     beider Plattformen hängen am selben `messages-{conversationId}`-Channel,
//     daher werden Web-Messages sofort in der iOS-App sichtbar und umgekehrt.
//  2. Conversation-Invariant `participant_1 < participant_2`: Beim Create
//     MÜSSEN wir die IDs lexikographisch sortieren, sonst schlägt der
//     UNIQUE-CHECK-Constraint zu. Pattern kommt aus `useOrCreateConversation`
//     (Native).
//  3. Rate-Limits: 500ms/Message (serverseitig), Content max 500 Zeichen
//     (Native-Parity). DM sind bewusst entspannter als Live-Chat (1s), weil
//     DMs nicht zum Spam-Broadcasten neigen.
// -----------------------------------------------------------------------------

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const MESSAGE_COOLDOWN_MS = 500;
const MESSAGE_MAX_LEN = 500;
const lastMessage = new Map<string, number>();

function checkCooldown(map: Map<string, number>, key: string, cooldownMs: number): boolean {
  const now = Date.now();
  const last = map.get(key) ?? 0;
  if (now - last < cooldownMs) return false;
  map.set(key, now);
  if (map.size > 5000) {
    const firstKey = map.keys().next().value;
    if (firstKey !== undefined) map.delete(firstKey);
  }
  return true;
}

async function getViewerId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

// -----------------------------------------------------------------------------
// getOrCreateConversation — idempotente DM-Erstellung. Normalisiert
// Participant-Reihenfolge (lexikographisch) um PK-Invariant zu erfüllen.
// Bei Self-Chat ist participant_1 = participant_2 = viewerId (Supabase erlaubt
// das; Native nutzt es für "Meine Notizen").
// -----------------------------------------------------------------------------

export async function getOrCreateConversation(
  otherUserId: string,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  // Participants lexikographisch sortieren (UNIQUE-Index-Friendly).
  const [p1, p2] = viewer < otherUserId ? [viewer, otherUserId] : [otherUserId, viewer];

  const supabase = await createClient();

  // Bestehende Conversation suchen
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .eq('participant_1', p1)
    .eq('participant_2', p2)
    .maybeSingle();

  if (existing) return { ok: true, data: { id: existing.id } };

  // Neu erstellen
  const { data: created, error } = await supabase
    .from('conversations')
    .insert({ participant_1: p1, participant_2: p2 })
    .select('id')
    .single();

  if (error || !created) {
    return { ok: false, error: error?.message ?? 'Konnte Unterhaltung nicht erstellen.' };
  }

  revalidatePath('/messages');
  return { ok: true, data: { id: created.id } };
}

// -----------------------------------------------------------------------------
// sendDirectMessage — Hauptflow. Validiert Membership via RLS (INSERT-Policy
// prüft dass sender_id = auth.uid() und Conversation-Membership).
// -----------------------------------------------------------------------------

export interface SendMessageInput {
  conversationId: string;
  content?: string | null;
  imageUrl?: string | null;
  postId?: string | null;
  replyToId?: string | null;
  storyMediaUrl?: string | null;
}

export async function sendDirectMessage(
  input: SendMessageInput,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!checkCooldown(lastMessage, viewer, MESSAGE_COOLDOWN_MS)) {
    return { ok: false, error: 'Kurz Luft holen.' };
  }

  const content = input.content?.trim() ?? '';
  if (!content && !input.imageUrl && !input.postId && !input.storyMediaUrl) {
    return { ok: false, error: 'Nachricht ist leer.' };
  }
  if (content.length > MESSAGE_MAX_LEN) {
    return { ok: false, error: `Max ${MESSAGE_MAX_LEN} Zeichen.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: input.conversationId,
      sender_id: viewer,
      content: content || null,
      image_url: input.imageUrl ?? null,
      post_id: input.postId ?? null,
      reply_to_id: input.replyToId ?? null,
      story_media_url: input.storyMediaUrl ?? null,
    })
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Senden fehlgeschlagen.' };
  }

  // Kein revalidatePath hier — Realtime-Channel `messages-{conversationId}`
  // aktualisiert den Client sofort. Conversation-Liste wird beim nächsten
  // Besuch neu gezogen (auch via Trigger `on_new_message` → last_message_at).
  return { ok: true, data: { id: data.id } };
}

// -----------------------------------------------------------------------------
// markConversationRead — delegiert an Native-RPC `mark_messages_read`. RPC
// läuft SECURITY DEFINER und umgeht die Sender-Only-UPDATE-Policy für den
// `read`-Flag (nur der EMPFÄNGER darf markRead für inbound Messages).
// -----------------------------------------------------------------------------

export async function markConversationRead(
  conversationId: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_messages_read', {
    p_conversation_id: conversationId,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// toggleMessageReaction — Emoji-Reaction an/aus-toggle. Unique-Index
// (message_id, user_id, emoji) verhindert Duplikate auf DB-Ebene; wir lesen
// vorher um zu entscheiden INSERT vs. DELETE.
// -----------------------------------------------------------------------------

export async function toggleMessageReaction(
  messageId: string,
  emoji: string,
): Promise<ActionResult<{ added: boolean }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from('message_reactions')
    .select('id')
    .eq('message_id', messageId)
    .eq('user_id', viewer)
    .eq('emoji', emoji)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase.from('message_reactions').delete().eq('id', existing.id);
    if (error) return { ok: false, error: error.message };
    return { ok: true, data: { added: false } };
  }

  const { error } = await supabase.from('message_reactions').insert({
    message_id: messageId,
    user_id: viewer,
    emoji,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { added: true } };
}

// -----------------------------------------------------------------------------
// deleteMessage — Soft-Delete (DB-Row raus). Sender-Only via RLS-Policy
// (`DELETE` erlaubt auf `messages` wenn `sender_id = auth.uid()`).
// -----------------------------------------------------------------------------

export async function deleteMessage(messageId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_id', viewer);

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// sendTypingPresence — Broadcast-only via Supabase Presence-Channel
// `typing-{conversationId}`. Kein DB-Write. 3s Client-Side-Auto-Stop via
// Timer im Composer.
//
// HINWEIS: Server-Action kann keine Presence senden (Presence läuft nur über
// Browser-WebSocket). Wir exponieren daher nur den "NICHT-typend"-Broadcast-
// Fallback. Der echte Typing-Indicator wird clientseitig vom Composer selber
// via `supabase.channel().track()` getrackt.
//
// Platzhalter hier zur API-Symmetrie — Client ruft direkt Supabase-JS.
// -----------------------------------------------------------------------------
// (kein Export — bewusst weggelassen)

// -----------------------------------------------------------------------------
// uploadMessageImage — signed Upload-URL für R2/Supabase-Storage-Bucket
// `message-images`. Client lädt Datei direkt hoch und übergibt die public-URL
// an sendDirectMessage.
//
// Fürs erste Slice: wir nutzen den bereits existierenden Supabase-Storage-
// Bucket `chat-images` (Native) und den Auth-Token des Users für den Upload.
// Signing-Flow kommt Phase 7b wenn R2-Deltagate aktiv ist.
// -----------------------------------------------------------------------------

export async function requestImageUploadPath(): Promise<
  ActionResult<{ path: string; bucket: string }>
> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };
  const path = `${viewer}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  return { ok: true, data: { path, bucket: 'chat-images' } };
}
