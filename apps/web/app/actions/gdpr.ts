'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// GDPR-Server-Actions — Art. 15 (Auskunft), Art. 17 (Löschung), Art. 20
// (Datenübertragbarkeit).
//
//  `exportMyData()`        → Aggregiert alle User-bezogenen Rows in ein
//                             JSON-Dokument. RLS garantiert, dass nur die
//                             eigenen Daten zurückkommen. Rückgabe wird im
//                             Client als `application/json`-Blob heruntergeladen.
//
//  `deleteMyAccount(confirmation)` → Ruft `public.delete_own_account()` RPC auf.
//                             RPC ist `SECURITY DEFINER`, Gate: `auth.uid()`.
//                             Löscht `auth.users` → Cascade auf `profiles`,
//                             `posts`, `follows`, `likes`, etc. (FK ON DELETE
//                             CASCADE). Bestätigungs-String muss „ACCOUNT
//                             LÖSCHEN" sein — Tipp-Friktion gegen Misklicks.
// -----------------------------------------------------------------------------

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// -----------------------------------------------------------------------------
// Export — read-only aggregate
// -----------------------------------------------------------------------------

export interface UserDataExport {
  schemaVersion: 1;
  exportedAt: string;
  userId: string;
  profile: unknown;
  posts: unknown[];
  comments: unknown[];
  likes: unknown[];
  follows: {
    following: unknown[];
    followers: unknown[];
  };
  messages: unknown[];
  stories: unknown[];
  guildMemberships: unknown[];
  liveSessions: unknown[];
  coinPurchases: unknown[];
  shopProducts: unknown[];
  shopOrders: unknown[];
  savedProducts: unknown[];
  notes: string;
}

/**
 * Sammelt alle für den eingeloggten User verfügbaren Rows.
 *
 * Wichtig: Einzelne SELECTs können scheitern (neue Tabelle, Migrations-Drift).
 * Wir fangen das pro Tabelle ab und schreiben leere Arrays — ein unvollständiger
 * Export ist besser als ein komplett fehlgeschlagener. `notes` listet die
 * fehlgeschlagenen Quellen, damit der User sieht, was fehlt.
 */
export async function exportMyData(): Promise<ActionResult<UserDataExport>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Nicht eingeloggt.' };
  }

  const uid = user.id;
  const failures: string[] = [];

  async function safeSelect<T>(
    label: string,
    runner: () => PromiseLike<{ data: T | null; error: { message: string } | null }>,
  ): Promise<T | null> {
    try {
      const { data, error } = await runner();
      if (error) {
        failures.push(`${label}: ${error.message}`);
        return null;
      }
      return data;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      failures.push(`${label}: ${msg}`);
      return null;
    }
  }

  // Parallele Reads — RLS filtert auf den eingeloggten User.
  const [
    profile,
    posts,
    comments,
    likes,
    following,
    followers,
    messages,
    stories,
    guildMemberships,
    liveSessions,
    coinPurchases,
    shopProducts,
    shopOrders,
    savedProducts,
  ] = await Promise.all([
    safeSelect('profile', () =>
      supabase
        .from('profiles')
        // Ausdrückliche Liste statt `*`: Seit 20260814240000 hat `authenticated`
        // kein SELECT mehr auf push_token, expo_push_token, explore_vibe,
        // brain_vibe, consistency_score und referred_by — jene Spalten waren ohne
        // Anmeldung abrufbar und trugen echte Expo-Push-Tokens. Postgres verlangt
        // bei `*` das Recht auf JEDE Spalte, der Export würde sonst scheitern.
        //
        // Die entzogenen Spalten sind keine Angaben des Nutzers, sondern
        // Geräte-Kennungen und Algorithmus-Zwischenstände. Wer sie im Export
        // braucht, holt sie serverseitig mit service_role dazu.
        .select(
          'id, username, display_name, bio, avatar_url, website, guild_id, created_at, ' +
            'onboarding_complete, preferred_tags, is_private, voice_sample_url, is_verified, ' +
            'teip, gender, women_only_verified, verification_level, is_admin, is_creator, ' +
            'is_creator_ops, notif_prefs, is_banned, is_restricted, restricted_until, ' +
            'is_shadow_banned, is_moderator, is_operator, country_code, country_name, city, ' +
            'region_name, location_consent_at, nav_slot_2, nav_slot_4, locale',
        )
        .eq('id', uid)
        .maybeSingle(),
    ),
    safeSelect('posts', () =>
      supabase.from('posts').select('*').eq('author_id', uid),
    ),
    safeSelect('comments', () =>
      supabase.from('comments').select('*').eq('user_id', uid),
    ),
    safeSelect('likes', () =>
      supabase.from('likes').select('*').eq('user_id', uid),
    ),
    safeSelect('following', () =>
      supabase.from('follows').select('*').eq('follower_id', uid),
    ),
    safeSelect('followers', () =>
      supabase.from('follows').select('*').eq('following_id', uid),
    ),
    safeSelect('messages', () =>
      supabase.from('messages').select('*').eq('sender_id', uid),
    ),
    safeSelect('stories', () =>
      supabase.from('stories').select('*').eq('user_id', uid),
    ),
    safeSelect('guild_memberships', () =>
      supabase.from('guild_memberships').select('*').eq('user_id', uid),
    ),
    safeSelect('live_sessions', () =>
      supabase
        .from('live_sessions')
        // Ausdrückliche Liste statt `*`: Seit 20260814260000 hat
        // `authenticated` kein SELECT mehr auf ingress_url,
        // ingress_stream_key, ingress_id und ingress_type — das waren die
        // vollständigen OBS-Zugangsdaten und ohne Anmeldung abrufbar.
        // Postgres verlangt bei `*` das Recht auf JEDE Spalte.
        .select(
          'id, host_id, title, status, viewer_count, peak_viewers, room_name, started_at, ended_at, like_count, comment_count, pinned_comment, replay_url, is_replayable, replay_views, thumbnail_url, category, moderation_enabled, moderation_words, goal_type, goal_target, goal_current, goal_title, goal_reached, allow_comments, allow_gifts, women_only, followers_only_chat, slow_mode_seconds, updated_at, recording_enabled, recording_id, shop_enabled, followers_only',
        )
        .eq('host_id', uid),
    ),
    safeSelect('coin_purchases', () =>
      supabase.from('coin_purchases').select('*').eq('user_id', uid),
    ),
    safeSelect('shop_products', () =>
      supabase.from('products').select('*').eq('seller_id', uid),
    ),
    safeSelect('shop_orders', () =>
      supabase.from('shop_orders').select('*').eq('buyer_id', uid),
    ),
    safeSelect('saved_products', () =>
      supabase.from('saved_products').select('*').eq('user_id', uid),
    ),
  ]);

  const payload: UserDataExport = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    userId: uid,
    profile: profile ?? null,
    posts: (posts as unknown[]) ?? [],
    comments: (comments as unknown[]) ?? [],
    likes: (likes as unknown[]) ?? [],
    follows: {
      following: (following as unknown[]) ?? [],
      followers: (followers as unknown[]) ?? [],
    },
    messages: (messages as unknown[]) ?? [],
    stories: (stories as unknown[]) ?? [],
    guildMemberships: (guildMemberships as unknown[]) ?? [],
    liveSessions: (liveSessions as unknown[]) ?? [],
    coinPurchases: (coinPurchases as unknown[]) ?? [],
    shopProducts: (shopProducts as unknown[]) ?? [],
    shopOrders: (shopOrders as unknown[]) ?? [],
    savedProducts: (savedProducts as unknown[]) ?? [],
    notes:
      failures.length === 0
        ? 'Vollständiger Export aller zugreifbaren Datenquellen.'
        : `Teilexport — einzelne Quellen nicht verfügbar: ${failures.join('; ')}`,
  };

  return { ok: true, data: payload };
}

// -----------------------------------------------------------------------------
// Account-Löschung
// -----------------------------------------------------------------------------

const DELETE_CONFIRMATION = 'ACCOUNT LÖSCHEN';

/**
 * Löscht den eigenen Account via `public.delete_own_account()`-RPC.
 *
 * Die RPC ist `SECURITY DEFINER` und gated auf `auth.uid()` — sie kann nur den
 * eigenen Account löschen. Cascade via FKs purged alle User-Daten.
 *
 * Nach Erfolg: Session invalidieren + Redirect auf `/`. Wir geben bewusst KEIN
 * `ActionResult` zurück bei Erfolg, sondern triggern `redirect()` direkt — das
 * Cookie ist dann schon weg, jeder Re-Render wäre im „nicht mehr eingeloggt"-
 * State.
 */
export async function deleteMyAccount(
  confirmation: string,
): Promise<ActionResult<null>> {
  if (confirmation !== DELETE_CONFIRMATION) {
    return {
      ok: false,
      error: `Bitte tippe exakt „${DELETE_CONFIRMATION}" ein, um zu bestätigen.`,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: 'Nicht eingeloggt.' };
  }

  // RPC löscht `auth.users` row via SECURITY DEFINER → Cascade über alle FKs.
  const { error: rpcError } = await supabase.rpc('delete_own_account');

  if (rpcError) {
    return {
      ok: false,
      error: `Löschung fehlgeschlagen: ${rpcError.message}`,
    };
  }

  // Session-Cookies löschen. WICHTIG: scope 'local' — der Default ('global')
  // ruft Supabase server-seitig auf, um alle Sessions zu widerrufen; da der
  // User aber gerade gelöscht wurde, schlägt dieser Call fehl und die Cookies
  // blieben stehen → das noch gültige JWT ließ das Profil-Menü weiter anzeigen.
  // 'local' entfernt nur die lokalen Cookies (kein Server-Call) → sauber weg.
  await supabase.auth.signOut({ scope: 'local' });

  revalidatePath('/', 'layout');
  redirect('/?account-deleted=1' as Route);
}
