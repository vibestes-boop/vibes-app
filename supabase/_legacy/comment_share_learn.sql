-- ══════════════════════════════════════════════════════════════════════════════
-- VIBES — Comment & Share Learning v1
--
-- Schließt die Lücke: Comments und Shares fehlen im Lernprofil.
-- Comments: Tippen kostet Aufwand → alpha=0.10 (zwischen Bookmark und Like)
-- Shares:   "Das ist so gut ich teile es" → alpha=0.10 (stärkstes Engagement)
--
-- Was diese Datei macht:
--   1. Trigger auf comments → _learn_from_post() wenn User kommentiert
--   2. RPC record_share_learn → aufgerufen vom Client nach erfolgreichem Share
--
-- Ausführen nach: advanced_signals.sql
-- ══════════════════════════════════════════════════════════════════════════════


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  Comment-Trigger → Lernprofil                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public._on_comment_learn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._learn_from_post(NEW.user_id, NEW.post_id, 0.10);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_learn ON public.comments;
CREATE TRIGGER trg_comment_learn
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public._on_comment_learn();


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  record_share_learn — RPC für Share-Signal                              ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

CREATE OR REPLACE FUNCTION public.record_share_learn(p_post_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN RETURN; END IF;
  IF p_post_id IS NULL THEN RETURN; END IF;
  PERFORM public._learn_from_post(v_user_id, p_post_id, 0.10);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_share_learn(UUID) TO authenticated;


-- ╔══════════════════════════════════════════════════════════════════════════╗
-- ║  VERIFIKATION                                                           ║
-- ╚══════════════════════════════════════════════════════════════════════════╝

SELECT
  'Comment-Trigger'                          AS signal,
  'trg_comment_learn'                        AS trigger_name,
  'alpha=0.10 — Kommentar schreiben'         AS lernrate
UNION ALL SELECT 'Share-RPC', 'record_share_learn()', 'alpha=0.10 — Teilen (native + DM)'
UNION ALL SELECT '── Vollständige Signal-Tabelle ──', '', ''
UNION ALL SELECT 'Bookmark',  'trg_bookmark_learn', 'alpha=0.12 ← stärkster'
UNION ALL SELECT 'Comment',   'trg_comment_learn',  'alpha=0.10 ← neu'
UNION ALL SELECT 'Share',     'record_share_learn', 'alpha=0.10 ← neu'
UNION ALL SELECT 'Like',      'trg_like_learn',     'alpha=0.08'
UNION ALL SELECT 'Dwell 60s', 'update_dwell_time',  'alpha=0.05 (max)'
UNION ALL SELECT 'Dwell 5s',  'update_dwell_time',  'alpha=0.004 (min)'
UNION ALL SELECT 'Skip <2s',  'record_skip',        'alpha=-0.02 (negativ)';
