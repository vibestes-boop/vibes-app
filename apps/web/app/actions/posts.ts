'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  getTrendingHashtagSuggestions,
  getMentionSuggestions,
  type MentionSuggestion,
} from '@/lib/data/posts';

// -----------------------------------------------------------------------------
// Posts-Server-Actions — Create-/Publish-/Schedule-/Draft-Flows für `/create`.
//
// Design:
//  1. Cross-Platform-Parität: Alle Mutationen schreiben in dieselben Tabellen
//     und delegieren an die Native-RPCs (`schedule_post`, `upsert_post_draft`,
//     `delete_post_draft`, `cancel_scheduled_post`, `reschedule_post`).
//  2. Direkter Publish-Path (`publishPost`) schreibt mit RLS-Policy direkt in
//     `posts` — kein Server-RPC nötig, Native macht's gleich.
//  3. R2-Upload: client-side via `supabase.functions.invoke('r2-sign')`. Wir
//     stellen hier nur einen Server-Side-Proxy zur Verfügung (requestR2UploadUrl)
//     für Flows die Server-Action-Kontext brauchen (Rate-Limit-Tracking).
//  4. Rate-Limits: 1 Publish/5s und 1 Schedule/2s pro User (defensiv, weil
//     R2-Uploads teuer und `posts`-Inserts in `vibe_feed_views` propagieren).
// -----------------------------------------------------------------------------

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

const PUBLISH_COOLDOWN_MS = 5000;
const SCHEDULE_COOLDOWN_MS = 2000;
const DRAFT_COOLDOWN_MS = 500;
const CAPTION_MAX_LEN = 2200;
const TAG_MAX_COUNT = 10;
const TAG_MAX_LEN = 64;

const lastPublish = new Map<string, number>();
const lastSchedule = new Map<string, number>();
const lastDraft = new Map<string, number>();

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
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function sanitizeTags(raw: string[] | undefined | null): string[] {
  if (!raw || !Array.isArray(raw)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const cleaned = t.trim().replace(/^#+/, '').toLowerCase().slice(0, TAG_MAX_LEN);
    if (!cleaned) continue;
    const withHash = `#${cleaned}`;
    if (seen.has(withHash)) continue;
    seen.add(withHash);
    out.push(withHash);
    if (out.length >= TAG_MAX_COUNT) break;
  }
  return out;
}

// v1.w.UI.65 — Caption-Hashtag auto-extraction.
//
// Parst #word tokens aus dem Freitext der Caption und gibt normalisierte
// Tag-Strings zurück. Wird in publishPost/schedulePost mit den expliziten
// Tag-Picker-Einträgen gemergt — explicit tags haben Vorrang (kommen zuerst
// in die deduplizierte Liste → verbrauchen TAG_MAX_COUNT-Slots zuerst).
//
// Regex: #[\p{L}\p{N}_]+ — Unicode-aware (unterstützt Kyrillisch, Arabisch,
// CE-Zeichen). Mindestlänge 2 Zeichen nach dem #, max TAG_MAX_LEN.
const CAPTION_HASHTAG_RE = /#([\p{L}\p{N}_]{2,})/gu;

function extractCaptionHashtags(caption: string): string[] {
  if (!caption) return [];
  const tags: string[] = [];
  const seen = new Set<string>();
  for (const m of caption.matchAll(CAPTION_HASHTAG_RE)) {
    const tag = m[1].toLowerCase().slice(0, TAG_MAX_LEN);
    const withHash = `#${tag}`;
    if (!seen.has(withHash)) {
      seen.add(withHash);
      tags.push(withHash);
    }
  }
  return tags;
}

// Mergt explizite Tag-Picker-Tags mit Caption-Hashtags, dedupliciert, normalisiert.
function mergeTags(explicitTags: string[] | undefined | null, caption: string): string[] {
  const explicit = sanitizeTags(explicitTags);
  const fromCaption = extractCaptionHashtags(caption);
  // explicit zuerst — sie sind intentional und füllen den Limit-Slot bevorzugt
  return sanitizeTags([...explicit, ...fromCaption]);
}

export type Privacy = 'public' | 'friends' | 'private';
export type MediaType = 'image' | 'video';

export interface PublishInput {
  caption?: string | null;
  tags?: string[];
  mediaUrl: string;
  mediaType: MediaType;
  thumbnailUrl?: string | null;
  privacy?: Privacy;
  allowComments?: boolean;
  allowDownload?: boolean;
  allowDuet?: boolean;
  womenOnly?: boolean;
  audioUrl?: string | null;
  audioVolume?: number | null;
  coverTimeMs?: number | null;
  isGuildPost?: boolean;
  guildId?: string | null;
  /** Wenn gesetzt → nach Publish wird der Draft gelöscht. */
  draftId?: string | null;
  /** Auto-erkannt beim Upload aus Video/Bild-Dimensionen. Default: 'portrait'. */
  aspectRatio?: 'portrait' | 'landscape' | 'square';
}

// -----------------------------------------------------------------------------
// publishPost — direkter Post in die `posts`-Tabelle. RLS prüft author_id.
// -----------------------------------------------------------------------------

export async function publishPost(
  input: PublishInput,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!checkCooldown(lastPublish, viewer, PUBLISH_COOLDOWN_MS)) {
    return { ok: false, error: 'Kurz warten — Post läuft noch.' };
  }

  const caption = (input.caption ?? '').trim();
  if (caption.length > CAPTION_MAX_LEN) {
    return { ok: false, error: `Caption max ${CAPTION_MAX_LEN} Zeichen.` };
  }
  if (!input.mediaUrl) {
    return { ok: false, error: 'Kein Medium angehängt.' };
  }
  if (input.mediaType !== 'image' && input.mediaType !== 'video') {
    return { ok: false, error: 'Ungültiger Medientyp.' };
  }

  const supabase = await createClient();

  const row = {
    author_id: viewer,
    caption: caption.length > 0 ? caption : null,
    tags: mergeTags(input.tags, caption),
    media_url: input.mediaUrl,
    media_type: input.mediaType,
    thumbnail_url: input.thumbnailUrl ?? null,
    audio_url: input.audioUrl ?? null,
    audio_volume: typeof input.audioVolume === 'number' ? input.audioVolume : null,
    privacy: input.privacy ?? 'public',
    allow_comments: input.allowComments ?? true,
    allow_download: input.allowDownload ?? false,
    allow_duet: input.allowDuet ?? true,
    women_only: input.womenOnly ?? false,
    cover_time_ms: typeof input.coverTimeMs === 'number' ? input.coverTimeMs : null,
    is_guild_post: input.isGuildPost ?? false,
    guild_id: input.guildId ?? null,
    aspect_ratio: input.aspectRatio ?? 'portrait',
  };

  const { data, error } = await supabase
    .from('posts')
    .insert(row)
    .select('id')
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Post fehlgeschlagen.' };
  }

  // Draft nach erfolgreichem Publish entfernen (wenn aus Draft gepostet).
  if (input.draftId) {
    await supabase.rpc('delete_post_draft', { p_id: input.draftId });
  }

  revalidatePath('/');
  revalidatePath('/explore');

  return { ok: true, data: { id: data.id } };
}

// -----------------------------------------------------------------------------
// schedulePost — delegiert an Native-RPC `schedule_post`. Akzeptiert UNIX-ms
// oder ISO-String; RPC macht Server-Side-Validierung (≥1 Min, ≤60 Tage).
// -----------------------------------------------------------------------------

export interface ScheduleInput extends PublishInput {
  publishAt: string; // ISO-String oder RFC-3339
}

export async function schedulePost(
  input: ScheduleInput,
): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!checkCooldown(lastSchedule, viewer, SCHEDULE_COOLDOWN_MS)) {
    return { ok: false, error: 'Kurz warten.' };
  }

  const caption = (input.caption ?? '').trim();
  if (caption.length > CAPTION_MAX_LEN) {
    return { ok: false, error: `Caption max ${CAPTION_MAX_LEN} Zeichen.` };
  }
  if (!input.mediaUrl && !caption) {
    return { ok: false, error: 'Weder Caption noch Medium.' };
  }

  const publishAtDate = new Date(input.publishAt);
  if (Number.isNaN(publishAtDate.getTime())) {
    return { ok: false, error: 'Ungültiger Zeitpunkt.' };
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('schedule_post', {
    p_publish_at: publishAtDate.toISOString(),
    p_caption: caption.length > 0 ? caption : null,
    p_media_url: input.mediaUrl ?? null,
    p_media_type: input.mediaType ?? null,
    p_thumbnail_url: input.thumbnailUrl ?? null,
    p_tags: mergeTags(input.tags, caption),
    p_is_guild_post: input.isGuildPost ?? false,
    p_guild_id: input.guildId ?? null,
    p_audio_url: input.audioUrl ?? null,
    p_audio_volume: typeof input.audioVolume === 'number' ? input.audioVolume : null,
    p_privacy: input.privacy ?? 'public',
    p_allow_comments: input.allowComments ?? true,
    p_allow_download: input.allowDownload ?? false,
    p_allow_duet: input.allowDuet ?? true,
    p_women_only: input.womenOnly ?? false,
    p_cover_time_ms: typeof input.coverTimeMs === 'number' ? input.coverTimeMs : null,
    p_aspect_ratio: input.aspectRatio ?? 'portrait',
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Planen fehlgeschlagen.' };
  }

  // Draft nach Schedule entfernen (wenn aus Draft geplant).
  if (input.draftId) {
    await supabase.rpc('delete_post_draft', { p_id: input.draftId });
  }

  revalidatePath('/create');
  revalidatePath('/create/scheduled');

  return { ok: true, data: { id: String(data) } };
}

// -----------------------------------------------------------------------------
// reschedulePost — Native-RPC-Delegate.
// -----------------------------------------------------------------------------

export async function reschedulePost(
  scheduledId: string,
  newPublishAt: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const d = new Date(newPublishAt);
  if (Number.isNaN(d.getTime())) return { ok: false, error: 'Ungültiger Zeitpunkt.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('reschedule_post', {
    p_id: scheduledId,
    p_new_time: d.toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/create/scheduled');
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// cancelScheduledPost — Native-RPC-Delegate.
// -----------------------------------------------------------------------------

export async function cancelScheduledPost(
  scheduledId: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('cancel_scheduled_post', {
    p_id: scheduledId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/create/scheduled');
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// saveDraft — wrapper um `upsert_post_draft`-RPC. Wenn `id` gesetzt → UPDATE,
// sonst INSERT. Nach Save kein revalidatePath nötig (Drafts-Liste lädt beim
// Öffnen neu), aber für /create/drafts sicherheitshalber.
// -----------------------------------------------------------------------------

export interface SaveDraftInput {
  id?: string | null;
  caption?: string | null;
  tags?: string[];
  mediaType?: MediaType | null;
  mediaUrl?: string | null;
  thumbnailUrl?: string | null;
  settings?: {
    privacy?: Privacy;
    allowComments?: boolean;
    allowDownload?: boolean;
    allowDuet?: boolean;
    womenOnly?: boolean;
    audioUrl?: string | null;
    audioVolume?: number | null;
    coverTimeMs?: number | null;
    isGuildPost?: boolean;
    guildId?: string | null;
  };
}

export async function saveDraft(input: SaveDraftInput): Promise<ActionResult<{ id: string }>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  if (!checkCooldown(lastDraft, viewer, DRAFT_COOLDOWN_MS)) {
    return { ok: false, error: 'Kurz warten.' };
  }

  const caption = (input.caption ?? '').trim();
  if (caption.length > CAPTION_MAX_LEN) {
    return { ok: false, error: `Caption max ${CAPTION_MAX_LEN} Zeichen.` };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('upsert_post_draft', {
    p_id: input.id ?? null,
    p_caption: caption.length > 0 ? caption : null,
    p_tags: sanitizeTags(input.tags),
    p_media_type: input.mediaType ?? null,
    p_media_url: input.mediaUrl ?? null,
    p_thumbnail_url: input.thumbnailUrl ?? null,
    p_settings: input.settings ?? {},
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Entwurf speichern fehlgeschlagen.' };
  }

  revalidatePath('/create/drafts');
  return { ok: true, data: { id: String(data) } };
}

// -----------------------------------------------------------------------------
// deletePost — Löscht einen eigenen Post (RLS: author_id = auth.uid()).
// Löscht nur wenn der eingeloggte User der Autor ist — die RLS-Policy in
// `post_management.sql` erzwingt das serverseitig zusätzlich.
// Nach erfolgreichem Delete wird der Profil-Feed revalidiert.
// -----------------------------------------------------------------------------

export async function deletePost(postId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('author_id', viewer);
  if (error) return { ok: false, error: error.message };

  // Feed-Routen invalidieren — der Post taucht im For-You und Following-Feed
  // nicht mehr auf nach dem nächsten SSR-Request.
  revalidatePath('/');
  revalidatePath('/following');
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// togglePinPost — v1.w.UI.179: Pin/Unpin eines Posts an das eigene Profil.
//
// Delegiert an DB-RPC `toggle_pin_post(p_post_id, p_user_id)` die atomisch:
//   1. Alle is_pinned=true Rows des Users zurücksetzt
//   2. Den gewählten Post pinniert WENN er vorher nicht gepinnt war
// → max. 1 gepinnter Post pro User, zweiter Klick auf denselben löst den Pin.
// -----------------------------------------------------------------------------

export async function togglePinPost(postId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('toggle_pin_post', {
    p_post_id: postId,
    p_user_id: viewer,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/'); // feed may show profile grid
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// updatePost — vollständiges Post-Bearbeiten: Caption, Privacy, Toggles.
//
// RLS auf `posts`: UPDATE erlaubt nur wenn `author_id = auth.uid()`. Wir
// fügen zusätzlich `.eq('author_id', viewer)` hinzu (defense-in-depth).
//
// Hashtag-Extraktion: alle #token aus dem Caption-Text (1-50 Zeichen, nur
// \w-Chars) — identisches Pattern wie `publishPost`. Die `tags`-Spalte wird
// synchron aktualisiert.
// -----------------------------------------------------------------------------

export interface UpdatePostInput {
  caption: string;
  privacy: 'public' | 'friends' | 'private';
  allowComments: boolean;
  allowDownload: boolean;
  allowDuet: boolean;
  womenOnly: boolean;
  aspectRatio: 'portrait' | 'landscape' | 'square';
  // v1.w.UI.162: Explicit tag-picker tags — merged with caption-extracted hashtags.
  tags?: string[];
}

export async function updatePost(
  postId: string,
  input: UpdatePostInput,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const trimmed = input.caption.trim();
  if (trimmed.length > 2000) return { ok: false, error: 'Caption zu lang (max. 2000 Zeichen).' };

  const validPrivacy = ['public', 'friends', 'private'] as const;
  if (!validPrivacy.includes(input.privacy)) return { ok: false, error: 'Ungültige Privacy-Option.' };

  const validAspect = ['portrait', 'landscape', 'square'] as const;
  if (!validAspect.includes(input.aspectRatio)) return { ok: false, error: 'Ungültiges Format.' };

  // v1.w.UI.162: Merge explicit picker tags with caption-extracted hashtags.
  const tags = mergeTags(input.tags, trimmed);

  const supabase = await createClient();
  const { error } = await supabase
    .from('posts')
    .update({
      caption: trimmed || null,
      tags,
      privacy: input.privacy,
      allow_comments: input.allowComments,
      allow_download: input.allowDownload,
      allow_duet: input.allowDuet,
      women_only: input.womenOnly,
      aspect_ratio: input.aspectRatio,
    })
    .eq('id', postId)
    .eq('author_id', viewer);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/p/${postId}`);
  return { ok: true, data: null };
}

// v1.w.UI.146 — Nur Caption + Tags patchen, KEINE anderen Felder anfassen.
// Anders als updatePostCaption (deprecated, überschreibt Privacy/Toggles auf Defaults)
// tut diese Funktion ein chirurgisches UPDATE das nur caption + tags ändert.
export async function patchPostCaption(
  postId: string,
  caption: string,
): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const trimmed = caption.trim();
  if (trimmed.length > 2000) return { ok: false, error: 'Caption zu lang (max. 2000 Zeichen).' };

  const tags = Array.from(
    new Set((trimmed.match(/#(\w{1,50})/g) ?? []).map((t) => t.slice(1).toLowerCase())),
  );

  const supabase = await createClient();
  const { error } = await supabase
    .from('posts')
    .update({ caption: trimmed || null, tags })
    .eq('id', postId)
    .eq('author_id', viewer);

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/p/${postId}`);
  return { ok: true, data: null };
}

// Backwards-compat alias (wird von post-author-menu genutzt, solange kein anderer Aufrufer)
export async function updatePostCaption(
  postId: string,
  caption: string,
): Promise<ActionResult<null>> {
  return updatePost(postId, {
    caption,
    privacy: 'public',
    allowComments: true,
    allowDownload: true,
    allowDuet: true,
    womenOnly: false,
    aspectRatio: 'portrait',
  });
}

// -----------------------------------------------------------------------------
// deleteDraft — Native-RPC-Delegate.
// -----------------------------------------------------------------------------

export async function deleteDraft(draftId: string): Promise<ActionResult<null>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();
  const { error } = await supabase.rpc('delete_post_draft', { p_id: draftId });
  if (error) return { ok: false, error: error.message };

  revalidatePath('/create/drafts');
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// requestR2UploadUrl — Proxy für Supabase-Edge-Function `r2-sign`. Wir rufen
// die Function aus dem Server-Context, damit (a) der User-JWT sauber weiter-
// gereicht wird und (b) ein Server-Rate-Limit den missbräuchlichen Upload-
// Spam abfangen kann. Client ruft direkt diese Action, bekommt `{ uploadUrl,
// publicUrl }` zurück und macht danach das PUT-Fetch direkt an R2.
// -----------------------------------------------------------------------------

export interface R2SignInput {
  /** z.B. "posts/videos/{userId}/{ts}.mp4" — wir verifizieren den Prefix. */
  key: string;
  /** MIME-Type für AWS-Sig-V4-Signatur (muss beim PUT identisch sein). */
  contentType: string;
}

export interface R2SignResult {
  uploadUrl: string;
  publicUrl: string;
  key: string;
}

const ALLOWED_KEY_PREFIXES = [
  'posts/videos/',
  'posts/images/',
  'thumbnails/',
  // v1.w.UI.21 — Avatar-Upload (Profil-Editor). Key-Pattern:
  // `avatars/{userId}/{timestamp}.{ext}`. Die `ownerOk`-Check unten
  // erzwingt dass `{userId}` == Viewer-ID — ein manipulierter Client
  // kann also nicht in den Avatar-Ordner eines anderen Users schreiben.
  'avatars/',
];

export async function requestR2UploadUrl(
  input: R2SignInput,
): Promise<ActionResult<R2SignResult>> {
  const viewer = await getViewerId();
  if (!viewer) return { ok: false, error: 'Bitte einloggen.' };

  // Key muss mit einem erlaubten Prefix beginnen UND die viewerId enthalten
  // — verhindert dass ein Client in fremde Ordner uploadet.
  const prefixOk = ALLOWED_KEY_PREFIXES.some((p) => input.key.startsWith(p));
  const ownerOk = input.key.includes(`/${viewer}/`);
  if (!prefixOk || !ownerOk) {
    return { ok: false, error: 'Ungültiger Upload-Pfad.' };
  }

  if (!input.contentType || input.contentType.length > 127) {
    return { ok: false, error: 'Ungültiger Content-Type.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke('r2-sign', {
    body: { key: input.key, contentType: input.contentType },
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? 'Signieren fehlgeschlagen.' };
  }

  const { uploadUrl, publicUrl } = data as {
    uploadUrl?: string;
    publicUrl?: string;
  };
  if (!uploadUrl || !publicUrl) {
    return { ok: false, error: 'Unvollständige Signatur.' };
  }

  return { ok: true, data: { uploadUrl, publicUrl, key: input.key } };
}

// -----------------------------------------------------------------------------
// Autocomplete-Actions — werden von Client-Komponenten beim Tippen gerufen.
// -----------------------------------------------------------------------------

export async function searchHashtagSuggestions(prefix: string): Promise<string[]> {
  if (!prefix || prefix.length < 1) return [];
  return getTrendingHashtagSuggestions(prefix, 8);
}

export async function searchMentionSuggestions(
  prefix: string,
): Promise<MentionSuggestion[]> {
  if (!prefix || prefix.length < 1) return [];
  return getMentionSuggestions(prefix, 8);
}
