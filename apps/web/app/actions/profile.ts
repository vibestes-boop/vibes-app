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
