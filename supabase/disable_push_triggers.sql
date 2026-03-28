-- ================================================
-- Push-Trigger deaktivieren (pg_net fehlt/fehlerhaft)
-- Folgen, Likes und Kommentare funktionieren danach wieder.
-- Benachrichtigungen landen weiterhin in der notifications-Tabelle.
-- ================================================

DROP TRIGGER IF EXISTS on_like_insert ON public.likes;
DROP TRIGGER IF EXISTS on_comment_insert ON public.comments;
DROP TRIGGER IF EXISTS on_follow_insert ON public.follows;
