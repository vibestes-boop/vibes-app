-- ================================================================
-- v1.27.2 — CoHost = Moderator-Authority (Chat-Moderation-Parity)
-- ================================================================
-- Problem: Ein aktiver CoHost (Viewer der vom Host als Duet-Partner
-- akzeptiert wurde und publisht) hatte bisher keinerlei Chat-Mod-Rechte.
-- Ein Troll in den Kommentaren konnte nur vom Host moderiert werden
-- während der CoHost tatenlos zuschauen musste, obwohl er eine
-- gleichberechtigte Präsenz im Stream ist.
--
-- Entscheidung: Aktiver CoHost erhält AUTOMATISCH dieselben
-- Chat-Moderation-Rechte wie ein expliziter Session-Moderator (Timeout,
-- Untimeout, Slow-Mode, Pin/Unpin-Comment). By-Default, ohne Toggle —
-- wer co-hostet wird implizit vertraut. Bei Revoke/Leave fällt das
-- automatisch wieder weg weil wir live gegen `live_cohosts.revoked_at`
-- prüfen.
--
-- Implementierung: Der Helper `is_live_session_moderator` (aus
-- 20260419000000_live_moderator_powers.sql) wird erweitert. Er gibt
-- jetzt zusätzlich zu echten Mod-Einträgen auch TRUE zurück wenn der
-- User in `live_cohosts` mit `revoked_at IS NULL` steht.
--
-- Dadurch greifen AUTOMATISCH alle 5 existierenden RPCs ohne weitere
-- Änderung:
--   - timeout_chat_user
--   - untimeout_chat_user
--   - set_live_slow_mode
--   - pin_live_comment
--   - unpin_live_comment
--
-- Die eingebauten Safety-Guards greifen ebenfalls automatisch:
--   - "Mods dürfen den Host nicht timeouten" → CoHost kann Host nicht timeouten
--   - "Mods dürfen andere Mods nicht timeouten" → CoHost kann Mods nicht
--     timeouten UND andere CoHosts nicht timeouten (beide werden von
--     is_live_session_moderator als Mod erkannt)
--
-- Semantische Anmerkung: Die Funktion heißt weiterhin
-- `is_live_session_moderator`, nicht `can_moderate_live_session`. Der
-- Name ist pragmatisch: CoHost hat Moderations-Autorität, also ist er
-- im Kontext dieser Funktion ein Moderator. Kein Rename aus Rücksicht
-- auf bestehende Aufrufer.
-- ================================================================

-- ─── 1. Helper erweitern ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_live_session_moderator(
  p_session_id uuid,
  p_user_id    uuid
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT
    -- (a) Expliziter Session-Moderator (vom Host ernannt)
    EXISTS (
      SELECT 1
        FROM public.live_moderators m
       WHERE m.session_id = p_session_id
         AND m.user_id    = p_user_id
    )
    OR
    -- (b) Aktiver CoHost (vom Host akzeptiert, noch nicht revoked)
    -- Nutzt den Partial-Index idx_live_cohosts_session WHERE revoked_at IS NULL.
    EXISTS (
      SELECT 1
        FROM public.live_cohosts c
       WHERE c.session_id = p_session_id
         AND c.user_id    = p_user_id
         AND c.revoked_at IS NULL
    );
$$;

-- Permissions unverändert übernehmen (gleich wie in der ursprünglichen
-- Definition). CREATE OR REPLACE erhält die bestehenden Grants nicht
-- automatisch auf allen Postgres-Versionen → explizit neu setzen.
REVOKE ALL ON FUNCTION public.is_live_session_moderator(uuid, uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.is_live_session_moderator(uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.is_live_session_moderator(uuid, uuid) IS
  'Prüft, ob ein User Moderations-Autorität in einer live_sessions-Zeile hat. '
  'TRUE für: explizite live_moderators-Einträge ODER aktive live_cohosts '
  '(revoked_at IS NULL). v1.27.2';

NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ v1.27.2 cohost_moderator_parity deployed — aktive CoHosts haben jetzt Mod-Rechte';
END $$;


-- ─── 2. Verifikations-Snippets ──────────────────────────────────
--
-- Test 1: Normaler Mod-Check funktioniert weiter
--   SELECT public.is_live_session_moderator('<session_mit_mod>', '<mod_user>');
--   → TRUE
--
-- Test 2: Aktiver CoHost wird jetzt als Mod erkannt
--   SELECT public.is_live_session_moderator('<session>', '<active_cohost_user>');
--   → TRUE (neu)
--
-- Test 3: Revoked CoHost nicht mehr als Mod
--   UPDATE live_cohosts SET revoked_at = now() WHERE ...;
--   SELECT public.is_live_session_moderator('<session>', '<former_cohost_user>');
--   → FALSE
--
-- Test 4: Random Viewer ist kein Mod
--   SELECT public.is_live_session_moderator('<session>', '<random_viewer>');
--   → FALSE
--
-- Test 5: CoHost kann jetzt timeouten (RPC-Ebene)
--   SET ROLE authenticated; SET request.jwt.claim.sub TO '<cohost_user>';
--   SELECT public.timeout_chat_user('<session>', '<troll_user>', 300, 'spam');
--   → Erfolg (vor v1.27.2: "Nicht Host oder Moderator dieser Session")
