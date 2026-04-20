'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Guild-Server-Actions
//
// `switchGuild(guildId)` — setzt `profiles.guild_id` auf den neuen Pod.
// Rate-Limit: max 1× pro 24h damit User nicht durch Pods hüpfen können und
// dadurch das Feed-Cachen + Leaderboard-Score instabil wird. Wir speichern
// `last_guild_switch_at` in `profiles` — wenn die Spalte noch nicht existiert,
// greift der Rate-Limit-Check nicht (graceful degradation), aber die Mutation
// selbst funktioniert. Migration als Follow-Up empfohlen.
// -----------------------------------------------------------------------------

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const SWITCH_COOLDOWN_MS = 24 * 60 * 60 * 1000;

export async function switchGuild(guildId: string): Promise<ActionResult<{ guildId: string }>> {
  if (!guildId || typeof guildId !== 'string') {
    return { ok: false, error: 'Guild-ID fehlt.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Bitte einloggen.' };

  // Existiert der Pod?
  const { data: guild, error: guildErr } = await supabase
    .from('guilds')
    .select('id')
    .eq('id', guildId)
    .maybeSingle();
  if (guildErr || !guild) {
    return { ok: false, error: 'Pod nicht gefunden.' };
  }

  // Rate-Limit via last_guild_switch_at (falls Spalte existiert)
  // Falls select 400 wirft weil Spalte fehlt, skippen wir den Check und
  // verlassen uns auf UI-Disable. Kein Break für Legacy-Schemas.
  try {
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('guild_id, last_guild_switch_at')
      .eq('id', user.id)
      .maybeSingle();

    if (profileRow) {
      const row = profileRow as {
        guild_id: string | null;
        last_guild_switch_at: string | null;
      };
      if (row.guild_id === guildId) {
        return { ok: false, error: 'Du bist bereits in diesem Pod.' };
      }
      if (row.last_guild_switch_at) {
        const last = new Date(row.last_guild_switch_at).getTime();
        const elapsed = Date.now() - last;
        if (elapsed < SWITCH_COOLDOWN_MS) {
          const hrs = Math.ceil((SWITCH_COOLDOWN_MS - elapsed) / (60 * 60 * 1000));
          return {
            ok: false,
            error: `Pods können nur 1× pro Tag gewechselt werden. Noch ca. ${hrs}h warten.`,
          };
        }
      }
    }
  } catch {
    // Legacy-Schema ohne last_guild_switch_at — weitermachen
  }

  // Update profiles.guild_id — RLS muss INSERT/UPDATE auf eigene Row erlauben
  const updatePayload: Record<string, unknown> = { guild_id: guildId };
  // Versuch mit Timestamp; bei Fehler (Spalte fehlt) Fallback ohne
  let err: { message: string } | null = null;
  {
    const withTs = { ...updatePayload, last_guild_switch_at: new Date().toISOString() };
    const { error } = await supabase.from('profiles').update(withTs).eq('id', user.id);
    err = error;
  }
  if (err) {
    // Fallback ohne Timestamp-Spalte
    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath('/guilds');
  revalidatePath(`/g/${guildId}`);
  return { ok: true, data: { guildId } };
}
