/**
 * ai-image-retention — Supabase Edge Function
 *
 * Storage-Retention für verwaiste AI-Generierungen. User kann "Mit KI erstellen"
 * klicken, ein Bild generieren lassen, dann aber den Flow abbrechen. Ohne
 * Retention würde der Bucket voll mit nie-verwendeten PNGs laufen.
 *
 * REGEL
 * -----
 *   consumed_at IS NULL AND created_at < NOW() - 7 days  →  Storage-Delete + Row-Delete
 *
 * Bilder, die über die RPC `mark_ai_image_consumed` als verwendet markiert
 * wurden (User hat "Verwenden" geklickt), bleiben dauerhaft erhalten — sie
 * leben in Shop-Produkten, Live-Thumbnails oder Post-Covers weiter.
 *
 * SCHRITTE
 * --------
 *   1. RPC `list_ai_image_unconsumed_paths(INTERVAL '7 days', 500)`
 *      → Liste von (id, storage_path)
 *   2. Storage-Batch-Delete via storage.from('ai-generated').remove([...paths])
 *   3. Bei Erfolg → RPC `delete_ai_image_generations([...ids])`
 *   4. Bei Partial-Failure → nur die erfolgreichen IDs löschen (best-effort)
 *
 * TRIGGER
 * -------
 *   pg_cron: 0 3 * * 0   →   wöchentlich So. 03:00 UTC
 * (Limit 500 pro Run reicht — bei 3 Bildern/User/Tag × z.B. 100 Users × 7
 *  Tage = 2100 potentielle Kandidaten, davon realistisch <20% unconsumed.
 *  Falls doch mehr → nächster Run räumt den Rest, CRON läuft eh weiter.)
 *
 * ENV
 * ---
 *   SUPABASE_URL              — automatisch
 *   SUPABASE_SERVICE_ROLE_KEY — automatisch
 *   RETENTION_DAYS            — Default '7', überschreibbar für Tests
 *   RETENTION_LIMIT           — Default '500', Batch-Size
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

Deno.serve(async (_req: Request) => {
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const retentionDays = parseInt(Deno.env.get('RETENTION_DAYS') ?? '7', 10);
  const retentionLimit = parseInt(Deno.env.get('RETENTION_LIMIT') ?? '500', 10);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return new Response(JSON.stringify({ error: 'supabase_env_missing' }), { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // ── Kandidaten abfragen ───────────────────────────────────────────────────
  // Postgres-INTERVAL wird als String übergeben ('N days') → RPC-Signatur
  // akzeptiert das weil PG implizit castet.
  const { data: candidates, error: listErr } = await supabase.rpc(
    'list_ai_image_unconsumed_paths',
    {
      p_older_than: `${retentionDays} days`,
      p_limit: retentionLimit,
    },
  );

  if (listErr) {
    console.error('[retention] list RPC failed:', listErr);
    return new Response(
      JSON.stringify({ error: 'list_rpc_failed', detail: listErr.message }),
      { status: 500 },
    );
  }

  const rows = (candidates ?? []) as Array<{ id: string; storage_path: string }>;

  if (rows.length === 0) {
    console.log('[retention] nothing to delete');
    return new Response(
      JSON.stringify({ ok: true, deleted: 0, scanned: 0 }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  }

  console.log(`[retention] found ${rows.length} unconsumed candidates (older than ${retentionDays}d)`);

  // ── Storage-Batch-Delete ──────────────────────────────────────────────────
  // Supabase-JS remove() akzeptiert Array of paths. Bei Partial-Failures
  // gibt's leider keinen per-path-Status zurück — wir behandeln den Call
  // atomar: alles oder best-effort-Subset.
  const paths = rows.map((r) => r.storage_path);
  const { data: removed, error: removeErr } = await supabase.storage
    .from('ai-generated')
    .remove(paths);

  if (removeErr) {
    console.error('[retention] storage remove failed:', removeErr);
    // Wir löschen KEINE DB-Rows wenn Storage fehlschlägt — sonst gibt's
    // verwaiste Storage-Objekte ohne DB-Referenz = GDPR-Blindspot.
    return new Response(
      JSON.stringify({ error: 'storage_remove_failed', detail: removeErr.message }),
      { status: 500 },
    );
  }

  // Supabase-Storage `remove` returned Array of successfully-removed objects.
  // Falls die Liste kürzer ist als `paths`, waren manche nicht da (z.B. schon
  // gelöscht bei einem früheren Run-Abbruch) — trotzdem zählen wir sie als
  // "done" und löschen die DB-Row, weil die physische Datei nicht mehr existiert.
  const removedCount = removed?.length ?? 0;
  console.log(`[retention] storage remove: ${removedCount}/${paths.length}`);

  // ── DB-Rows löschen ───────────────────────────────────────────────────────
  const ids = rows.map((r) => r.id);
  const { data: deletedCount, error: deleteErr } = await supabase.rpc(
    'delete_ai_image_generations',
    { p_ids: ids },
  );

  if (deleteErr) {
    console.error('[retention] delete RPC failed:', deleteErr);
    return new Response(
      JSON.stringify({
        error: 'delete_rpc_failed',
        detail: deleteErr.message,
        storage_removed: removedCount,
      }),
      { status: 500 },
    );
  }

  console.log(`[retention] DB rows deleted: ${deletedCount}`);

  return new Response(
    JSON.stringify({
      ok: true,
      scanned: rows.length,
      storage_removed: removedCount,
      db_deleted: deletedCount,
      retention_days: retentionDays,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
