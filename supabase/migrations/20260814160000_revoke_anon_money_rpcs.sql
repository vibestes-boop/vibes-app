-- Ausführungsrechte zurücknehmen, die nie gewollt waren.
--
-- BEFUND 14.08.2026, beim Sicherheits-Durchgang vor dem Berkat-Push gefunden:
-- `credit_coins(uuid, integer)` war für die Rolle `anon` freigegeben. Die Funktion
-- ist SECURITY DEFINER, prüft NICHTS — kein auth.uid(), kein is_admin() — und
-- schreibt direkt in `coins_wallets`. Mit dem öffentlichen Client-Schlüssel, der in
-- jedem App-Bundle steckt, konnte damit JEDER — auch ohne Anmeldung — beliebig
-- vielen Konten beliebig viele Coins gutschreiben.
--
-- Belegt (zerstörungsfrei, ohne Anmeldung, mit erfundener Nutzer-ID):
--   POST /rest/v1/rpc/credit_coins  {"p_user_id":"000…000","p_coins":0}
--   -> HTTP 409, 23503 "violates foreign key constraint coins_wallets_user_id_fkey"
-- Der Aufruf lief also bis zum Fremdschlüssel durch. Kein 401, kein 403. Nur die
-- erfundene ID hat ihn gestoppt — mit einer echten hätte er geschrieben.
--
-- URSACHE: Die Ursprungs-Migration 20260409000000_coin_purchases.sql hatte es
-- richtig gemacht ("Nur Service Role darf credit_coins aufrufen",
-- `revoke all … from public` + `grant execute … to service_role`). Irgendwann
-- danach hat ein DROP+CREATE die Rechte auf den Postgres-Standard zurückgesetzt:
-- EXECUTE für PUBLIC — und PUBLIC schließt `anon` ein. Genau die Falle, die
-- CLAUDE.md bei v1.27.2 schon einmal notiert hat.
--
-- BRICHT NICHTS: Beide Webhooks (revenuecat-webhook, stripe-webhook) rufen
-- credit_coins mit SUPABASE_SERVICE_ROLE_KEY. Kein Client-Code ruft sie.
--
-- Idempotent, gefahrlos wiederholbar.

BEGIN;

-- ─── 1. Geldpfad: nur noch der Server ────────────────────────────────────────
REVOKE ALL ON FUNCTION public.credit_coins("p_user_id" uuid, "p_coins" integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_coins("p_user_id" uuid, "p_coins" integer)
  TO service_role;

-- ─── 2. Weitere RPCs ohne jede Prüfung, die nur Server-Code aufruft ──────────
-- Alle SECURITY DEFINER, alle schreibend, alle ohne Berechtigungsprüfung.
-- Aufrufer laut Code-Suche: ausschließlich Edge Functions bzw. interne Trigger.
REVOKE ALL ON FUNCTION public.delete_ai_image_generations("p_ids" uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_ai_image_generations("p_ids" uuid[]) TO service_role;

REVOKE ALL ON FUNCTION public.decay_dwell_scores() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decay_dwell_scores() TO service_role;

REVOKE ALL ON FUNCTION public.archive_expired_stories() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_expired_stories() TO service_role;

REVOKE ALL ON FUNCTION public.production_integrity_snapshot() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.production_integrity_snapshot() TO service_role;

REVOKE ALL ON FUNCTION public._learn_from_post("p_user_id" uuid, "p_post_id" uuid, "p_alpha" double precision)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._learn_from_post("p_user_id" uuid, "p_post_id" uuid, "p_alpha" double precision)
  TO service_role;

-- Beide Überladungen — sonst bleibt die andere offen.
REVOKE ALL ON FUNCTION public.publish_due_scheduled_posts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_scheduled_posts() TO service_role;

REVOKE ALL ON FUNCTION public.publish_due_scheduled_posts("p_batch_size" integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_due_scheduled_posts("p_batch_size" integer) TO service_role;

-- ─── 3. Vom Client gerufen: nur `anon` weg, `authenticated` bleibt ───────────
-- Diese drei ruft die App legitim auf (Herz-Zähler, Aufruf-Zähler, Anpinnen).
-- Ein nicht angemeldeter Aufrufer hat dort trotzdem nichts verloren.
REVOKE ALL ON FUNCTION public.increment_live_likes("p_session_id" uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_live_likes("p_session_id" uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.increment_live_recording_views("p_recording_id" uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_live_recording_views("p_recording_id" uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.toggle_pin_post("p_post_id" uuid, "p_user_id" uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.toggle_pin_post("p_post_id" uuid, "p_user_id" uuid)
  TO authenticated, service_role;

COMMIT;

-- ─── NICHT erledigt, bewusst offen gelassen ──────────────────────────────────
-- `toggle_pin_post(p_post_id, p_user_id)` nimmt die Nutzer-ID als PARAMETER und
-- prüft sie nicht gegen auth.uid(). Nach dieser Migration braucht ein Angreifer
-- zwar ein Konto, kann damit aber weiterhin fremde Beiträge an- und abpinnen.
-- Der saubere Fix ist ein Eingriff in den Rumpf (p_user_id streichen, auth.uid()
-- verwenden) und ändert die Signatur — das berührt zwei Aufrufstellen im
-- Client-Code und gehört deshalb in einen eigenen, getesteten Schritt.
