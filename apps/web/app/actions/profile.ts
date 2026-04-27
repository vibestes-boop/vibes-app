'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getUser } from '@/lib/auth/session';

// -----------------------------------------------------------------------------
// v1.w.UI.20 D7-Follow-up — Profil-Editor Server-Actions.
//
// Scope dieses Slices: `display_name` und `bio` editieren. Bewusst NICHT dabei:
//   • `username` — Rename wäre ein Cascade-Risiko (URLs `/u/{username}`,
//     @-Mentions in Captions/Comments, Linkify-Regexes in D6). Bleibt readonly
//     auf dem Editor. Falls ein User seinen Handle ändern will → Onboarding-
//     Flow `claimUsername` oder künftiger dedizierter Rename-Slice mit
//     Redirect-History.
//   • `avatar_url` — R2-Upload-UX ist ein eigener Slice (File-Input, Preview,
//     Crop, Upload-Progress). Hier würde ein reines URL-Feld den Editor
//     überfordern und gleichzeitig das Feature nicht wirklich abliefern.
//
// Validierungs-Regel folgt dem bestehenden `profileUpdateSchema` aus
// `shared/schemas/profile.ts` (display_name max 60, bio max 200) — dort ist
// die Source-of-Truth, die schon von Native-App und anderen Actions geteilt
// wird. Wir re-validieren hier zusätzlich mit einer engeren Shape weil das
// gemeinsame Schema alle Felder `optional` macht und wir für den Web-Editor
// eine präzisere Fehlermeldung pro Feld brauchen.
// -----------------------------------------------------------------------------

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string; field?: string };

// Minimaler trim()-Helper — zod's `trim()` macht das implizit, aber der leere-
// String-Check danach ist klarer wenn wir das Ergebnis explizit sehen.
const displayNameSchema = z
  .string({ required_error: 'Anzeigename fehlt.' })
  .trim()
  .min(1, 'Anzeigename darf nicht leer sein.')
  .max(60, 'Maximal 60 Zeichen.');

const bioSchema = z
  .string()
  .trim()
  .max(200, 'Bio darf maximal 200 Zeichen haben.');

const updateProfileSchema = z.object({
  display_name: displayNameSchema,
  // Bio darf leer sein — dann speichern wir `null`, damit die DB-Spalte
  // nicht zwischen "leerer String" und "kein Eintrag" unterscheiden muss.
  bio: bioSchema,
});

export async function updateProfile(formData: FormData): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: 'Bitte einloggen.' };
  }

  const parsed = updateProfileSchema.safeParse({
    display_name: formData.get('display_name'),
    bio: formData.get('bio'),
  });

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? 'Eingabe ungültig.',
      field: (issue?.path?.[0] as string | undefined) ?? undefined,
    };
  }

  const supabase = await createClient();

  // Username wird NICHT geschrieben (readonly im Editor) — explizit weglassen
  // damit ein manipulierter FormData-Body ihn nicht über die Hintertür ändert.
  // `avatar_url` bleibt ebenfalls unberührt (separater Slice).
  const { error } = await supabase
    .from('profiles')
    .update({
      display_name: parsed.data.display_name,
      bio: parsed.data.bio.length > 0 ? parsed.data.bio : null,
    })
    .eq('id', user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Profil-Daten leben in zwei Ebenen: dem Editor selbst (muss den frisch
  // gespeicherten Stand zeigen, nicht den alten) und überall wo der Display-
  // Name rendert (eigenes Public-Profile, Nav-Sidebar via getProfile). Wir
  // revalidieren den Editor direkt und die Layout-Ebene die auf `getProfile`
  // aufsetzt (FeedSidebar, MobileBottomNav).
  revalidatePath('/settings/profile');
  revalidatePath('/', 'layout');

  // Eigenes Public-Profile. Username kennen wir nicht ohne extra Query — wir
  // revalidieren stattdessen das Route-Segment /u/[username] pauschal per
  // `'page'`-Scope, Next trifft dann beim nächsten Request die Cache-
  // Invalidation selbst. Günstiger als ein zusätzlicher Roundtrip.
  revalidatePath('/u/[username]', 'page');

  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// v1.w.UI.21 — Avatar-Update Server-Action.
//
// Frontend-Flow:
//   (1) Client wählt Datei → clientseitig komprimieren (compressImage,
//       maxEdge 512, quality 0.85 → typisch 30-80 kB JPEG/WebP)
//   (2) Client ruft `requestR2UploadUrl({ key: 'avatars/{userId}/{ts}.{ext}',
//       contentType })` → bekommt `{ uploadUrl, publicUrl }`
//   (3) Client macht `PUT uploadUrl` direkt an R2
//   (4) Client ruft **diese** Action mit `publicUrl` → `profiles.avatar_url`
//       wird geschrieben
//
// `avatarUrl === null` = Avatar entfernen (DB-Spalte zurück auf NULL).
//
// Security-Gate: Wir können nicht verhindern, dass ein manipulierter Client
// beliebige Strings als `avatarUrl` reinreicht. Deshalb validiert diese Action
// drei Dinge:
//   (a) HTTPS (Plain-HTTP wäre ein Mixed-Content-Leck im Browser)
//   (b) Hostname ist R2 (`*.r2.dev` oder `*.r2.cloudflarestorage.com`) ODER
//       Supabase-Storage (`*.supabase.co`) — deckt alle Backends ab, die im
//       `next.config.mjs` → `images.remotePatterns` allowed sind
//   (c) Path enthält `/avatars/{userId}/` — verhindert dass User-A einen
//       fremden Avatar-Upload-Pfad (User-B) als sein eigenes Bild setzt
//
// Wir whitelisten EXPLIZIT nur `avatar_url` — `display_name`, `bio`,
// `username` werden hier nie angefasst (analog zum `updateProfile`-Pattern).
// -----------------------------------------------------------------------------

const AVATAR_MAX_URL_LENGTH = 2048;
const AVATAR_ALLOWED_HOST_SUFFIXES = [
  '.r2.dev',
  '.r2.cloudflarestorage.com',
  '.supabase.co',
];

function isAllowedAvatarUrl(url: string, userId: string): boolean {
  if (url.length > AVATAR_MAX_URL_LENGTH) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'https:') return false;

  const host = parsed.hostname.toLowerCase();
  const hostOk = AVATAR_ALLOWED_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
  if (!hostOk) return false;

  // Pfad MUSS den eigenen User-Ordner enthalten. Slashes am Anfang/Ende
  // verhindern Partial-Matches (z.B. `avatars/abc-foo/` könnte sonst für
  // User-ID `abc` durchrutschen).
  const ownerSegment = `/avatars/${userId}/`;
  if (!parsed.pathname.includes(ownerSegment)) return false;

  return true;
}

export async function updateAvatar(avatarUrl: string | null): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) {
    return { ok: false, error: 'Bitte einloggen.' };
  }

  // `null` = Avatar entfernen.
  if (avatarUrl !== null) {
    if (typeof avatarUrl !== 'string' || avatarUrl.length === 0) {
      return { ok: false, error: 'Ungültige Avatar-URL.', field: 'avatar_url' };
    }
    if (!isAllowedAvatarUrl(avatarUrl, user.id)) {
      return { ok: false, error: 'Ungültige Avatar-URL.', field: 'avatar_url' };
    }
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);

  if (error) {
    return { ok: false, error: error.message };
  }

  // Gleiche Revalidation-Scopes wie `updateProfile` — der Avatar erscheint
  // im Editor (eigenes Preview), in der Layout-Nav (FeedSidebar avatar) und
  // auf dem eigenen `/u/[username]`-Profile.
  revalidatePath('/settings/profile');
  revalidatePath('/', 'layout');
  revalidatePath('/u/[username]', 'page');

  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// setPrivateAccount — v1.w.UI.149 — privates Konto an/ausschalten.
//
// Bei Umschalten auf öffentlich werden ausstehende Follow-Requests automatisch
// in echte Follows konvertiert (Parität zu TikTok: wenn du dein Konto öffnest,
// werden ausstehende Anfragen direkt angenommen). Die DB hat dafür keine
// automatische Trigger-Logik, daher erledigen wir es hier.
// -----------------------------------------------------------------------------

export async function setPrivateAccount(isPrivate: boolean): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  const supabase = await createClient();

  const { error } = await supabase
    .from('profiles')
    .update({ is_private: isPrivate })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  // Bei Umschalten auf öffentlich: alle ausstehenden Follow-Requests → follows
  if (!isPrivate) {
    const { data: pendingRequests } = await supabase
      .from('follow_requests')
      .select('sender_id')
      .eq('receiver_id', user.id);

    if (pendingRequests && pendingRequests.length > 0) {
      const followRows = pendingRequests.map((r: { sender_id: string }) => ({
        follower_id: r.sender_id,
        following_id: user.id,
      }));
      await supabase.from('follows').upsert(followRows, {
        onConflict: 'follower_id,following_id',
        ignoreDuplicates: true,
      });
      await supabase
        .from('follow_requests')
        .delete()
        .eq('receiver_id', user.id);
    }
  }

  revalidatePath('/settings/privacy');
  revalidatePath('/u/[username]', 'page');
  return { ok: true, data: null };
}

// -----------------------------------------------------------------------------
// Notification channel preferences — v1.w.UI.63
//
// notif_prefs: JSONB-Spalte auf `profiles`.
// Keys: likes | comments | follows | messages | live | gifts | orders
// Default: alle true (opt-out-Modell, see DB migration 20260426200000).
// -----------------------------------------------------------------------------

export interface NotifPrefs {
  likes:    boolean;
  comments: boolean;
  follows:  boolean;
  messages: boolean;
  live:     boolean;
  gifts:    boolean;
  orders:   boolean;
}

const DEFAULT_PREFS: NotifPrefs = {
  likes: true, comments: true, follows: true,
  messages: true, live: true, gifts: true, orders: true,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  const user = await getUser();
  if (!user) return DEFAULT_PREFS;

  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('notif_prefs')
    .eq('id', user.id)
    .maybeSingle();

  if (!data?.notif_prefs) return DEFAULT_PREFS;

  // Merge mit Defaults damit fehlende Keys (zukünftige Erweiterungen) nicht
  // auf undefined laufen.
  return { ...DEFAULT_PREFS, ...(data.notif_prefs as Partial<NotifPrefs>) };
}

export async function updateNotifPrefs(
  prefs: Partial<NotifPrefs>,
): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: 'Nicht eingeloggt.' };

  const supabase = await createClient();

  // Bestehende Prefs laden und zusammenführen — Partial-Update statt Overwrite.
  const current = await getNotifPrefs();
  const merged: NotifPrefs = { ...current, ...prefs };

  const { error } = await supabase
    .from('profiles')
    .update({ notif_prefs: merged })
    .eq('id', user.id);

  if (error) return { ok: false, error: error.message };

  revalidatePath('/settings/notifications');
  return { ok: true, data: null };
}
