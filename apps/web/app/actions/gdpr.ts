'use server';

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
    runner: () => Promise<{ data: T | null; error: { message: string } | null }>,
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
      supabase.from('profiles').select('*').eq('id', uid).maybeSingle() as any,
    ),
    safeSelect('posts', () =>
      supabase.from('posts').select('*').eq('user_id', uid) as any,
    ),
    safeSelect('comments', () =>
      supabase.from('comments').select('*').eq('user_id', uid) as any,
    ),
    safeSelect('likes', () =>
      supabase.from('likes').select('*').eq('user_id', uid) as any,
    ),
    safeSelect('following', () =>
      supabase.from('follows').select('*').eq('follower_id', uid) as any,
    ),
    safeSelect('followers', () =>
      supabase.from('follows').select('*').eq('following_id', uid) as any,
    ),
    safeSelect('messages', () =>
      supabase.from('messages').select('*').eq('sender_id', uid) as any,
    ),
    safeSelect('stories', () =>
      supabase.from('stories').select('*').eq('user_id', uid) as any,
    ),
    safeSelect('guild_memberships', () =>
      supabase.from('guild_memberships').select('*').eq('user_id', uid) as any,
    ),
    safeSelect('live_sessions', () =>
      supabase.from('live_sessions').select('*').eq('host_id', uid) as any,
    ),
    safeSelect('coin_purchases', () =>
      supabase.from('coin_purchases').select('*').eq('user_id', uid) as any,
    ),
    safeSelect('shop_products', () =>
      supabase.from('products').select('*').eq('seller_id', uid) as any,
    ),
    safeSelect('shop_orders', () =>
      supabase.from('shop_orders').select('*').eq('buyer_id', uid) as any,
    ),
    safeSelect('saved_products', () =>
      supabase.from('saved_products').select('*').eq('user_id', uid) as any,
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

  // Session explizit invalidieren (das Auth-Cookie wird sonst bis Refresh
  // weitergetragen und würde auf einen 404-User zeigen).
  await supabase.auth.signOut();

  revalidatePath('/', 'layout');
  redirect('/?account-deleted=1');
}
