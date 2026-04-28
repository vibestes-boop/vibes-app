'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

// -----------------------------------------------------------------------------
// Post Reports / Not-Interested Server Actions (v1.w.UI.34)
//
// Schreibt in `post_reports` (siehe supabase/reports.sql):
//   - reason='report'         → Moderations-Meldung
//   - reason='not_interested' → Algorithmus-Feedback (Post wird aus For-You
//                               raus-gefiltert)
//
// Die Tabelle hat einen UNIQUE-Constraint (reporter_id, post_id, reason) →
// Doppel-Klick nach bereits gemeldetem Post wirft 23505. Den fangen wir
// silent ab und behandeln ihn als Erfolg (User merkt nicht dass er schon
// gemeldet hatte; das Feedback bleibt konsistent).
//
// Native-App-Pattern: lib/useReport.ts macht das gleiche via TanStack-Query
// in React-Native. Hier replizieren wir das als Server-Actions weil das im
// Web-RSC-Kontext der idiomatische Weg ist.
// -----------------------------------------------------------------------------

export type ReportActionResult =
  | { ok: true }
  | { ok: false; error: string };

const inputSchema = z.object({
  postId: z.string().uuid('Ungültige Post-ID.'),
});

async function insertReport(
  postId: string,
  reason: 'report' | 'not_interested',
): Promise<ReportActionResult> {
  const parsed = inputSchema.safeParse({ postId });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Bitte zuerst anmelden.' };
  }

  const { error } = await supabase.from('post_reports').insert({
    reporter_id: user.id,
    post_id: parsed.data.postId,
    reason,
  });

  // 23505 = Unique-Constraint = bereits gemeldet → silent success (idempotent).
  if (error && error.code !== '23505') {
    return {
      ok: false,
      error: error.message ?? 'Aktion fehlgeschlagen.',
    };
  }

  // Bei not_interested: Feed-Cache revalidieren, damit der Post beim nächsten
  // Page-Load (oder router.refresh()) nicht mehr im For-You auftaucht.
  if (reason === 'not_interested') {
    revalidatePath('/');
  }

  return { ok: true };
}

export async function reportPost(postId: string): Promise<ReportActionResult> {
  return insertReport(postId, 'report');
}

export async function markPostNotInteresting(postId: string): Promise<ReportActionResult> {
  return insertReport(postId, 'not_interested');
}

// -----------------------------------------------------------------------------
// reportUser — Meldet ein Nutzerprofil (v1.w.UI.116).
//
// Schreibt in `user_reports` (supabase/user_reports.sql):
//   reason ∈ ('spam', 'harassment', 'inappropriate', 'fake_account', 'other')
//
// UNIQUE (reporter_id, reported_id, reason) → 23505 wird silent behandelt.
// -----------------------------------------------------------------------------

const userReportSchema = z.object({
  targetUserId: z.string().uuid('Ungültige User-ID.'),
  reason: z.enum(['spam', 'harassment', 'inappropriate', 'fake_account', 'other']),
  note: z.string().max(500).optional(),
});

export type UserReportReason =
  | 'spam'
  | 'harassment'
  | 'inappropriate'
  | 'fake_account'
  | 'other';

export async function reportUser(
  targetUserId: string,
  reason: UserReportReason,
  note?: string,
): Promise<ReportActionResult> {
  const parsed = userReportSchema.safeParse({ targetUserId, reason, note });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'Ungültige Eingabe.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: 'Bitte zuerst anmelden.' };
  }

  if (user.id === parsed.data.targetUserId) {
    return { ok: false, error: 'Du kannst dich nicht selbst melden.' };
  }

  const { error } = await supabase.from('user_reports').insert({
    reporter_id: user.id,
    reported_id: parsed.data.targetUserId,
    reason: parsed.data.reason,
    note: parsed.data.note ?? null,
  });

  if (error && error.code !== '23505') {
    return { ok: false, error: error.message ?? 'Meldung fehlgeschlagen.' };
  }

  revalidatePath(`/u/`);
  return { ok: true };
}
