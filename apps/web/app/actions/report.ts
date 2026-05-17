'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import {
  POST_REPORT_REASON_VALUES,
  USER_REPORT_REASON_VALUES,
  type PostReportReason,
  type UserReportReason,
} from '@/lib/moderation/report-reasons';

export type { PostReportReason, UserReportReason } from '@/lib/moderation/report-reasons';

// -----------------------------------------------------------------------------
// Post Reports / Not-Interested Server Actions (v1.w.UI.34)
//
// Moderationsmeldungen laufen zentral in `content_reports` via `create_report`.
// Not-interested bleibt bewusst in `post_reports`, weil es Feed-Feedback ist:
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
  reason: z.enum(POST_REPORT_REASON_VALUES).default('other'),
});

async function insertReport(
  postId: string,
  action: 'report' | 'not_interested',
  reportReason: PostReportReason = 'other',
): Promise<ReportActionResult> {
  const parsed = inputSchema.safeParse({ postId, reason: reportReason });
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

  const { error, data } =
    action === 'report'
      ? await supabase.rpc('create_report', {
          p_target_type: 'post',
          p_target_id: parsed.data.postId,
          p_reason: parsed.data.reason,
        })
      : await supabase.from('post_reports').insert({
          reporter_id: user.id,
          post_id: parsed.data.postId,
          reason: action,
        });

  // 23505 = Unique-Constraint = bereits gemeldet → silent success (idempotent).
  if (error && error.code !== '23505') {
    return {
      ok: false,
      error: error.message ?? 'Aktion fehlgeschlagen.',
    };
  }
  if (!error && action === 'report' && (data as { error?: string } | null)?.error) {
    return { ok: false, error: (data as { error: string }).error };
  }

  // Bei not_interested: Feed-Cache revalidieren, damit der Post beim nächsten
  // Page-Load (oder router.refresh()) nicht mehr im For-You auftaucht.
  if (action === 'not_interested') {
    revalidatePath('/');
  }

  return { ok: true };
}

export async function reportPost(
  postId: string,
  reason: PostReportReason = 'other',
): Promise<ReportActionResult> {
  return insertReport(postId, 'report', reason);
}

export async function markPostNotInteresting(postId: string): Promise<ReportActionResult> {
  return insertReport(postId, 'not_interested');
}

// -----------------------------------------------------------------------------
// reportUser — Meldet ein Nutzerprofil (v1.w.UI.116).
//
// Schreibt zentral in `content_reports` via `create_report`.
// -----------------------------------------------------------------------------

const userReportSchema = z.object({
  targetUserId: z.string().uuid('Ungültige User-ID.'),
  reason: z.enum(USER_REPORT_REASON_VALUES),
  note: z.string().max(500).optional(),
});

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

  const reportReason = parsed.data.note
    ? `${parsed.data.reason}: ${parsed.data.note.slice(0, 80)}`
    : parsed.data.reason;
  const { error, data } = await supabase.rpc('create_report', {
    p_target_type: 'profile',
    p_target_id: parsed.data.targetUserId,
    p_reason: reportReason,
  });

  if (error && error.code !== '23505') {
    return { ok: false, error: error.message ?? 'Meldung fehlgeschlagen.' };
  }
  if (!error && (data as { error?: string } | null)?.error) {
    return { ok: false, error: (data as { error: string }).error };
  }

  revalidatePath(`/u/`);
  return { ok: true };
}
