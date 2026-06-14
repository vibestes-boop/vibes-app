-- ══════════════════════════════════════════════════════════════════════════════
-- SERLO — Hotfix: 3 fehlende Prod-Migrations für Gift-Send (v1.22.1)
--
-- Zweck: Die lokalen Migrations für `allow_gifts`, `notifications.session_id`
-- und `chechen_tower*` sind nicht in Prod-Supabase eingespielt. Dadurch
-- wirft `send_gift` intern → Client zeigt "Verbindungsfehler".
--
-- Dieses Snippet ist **idempotent** — kann beliebig oft ausgeführt werden.
-- In Supabase Dashboard → SQL Editor einfügen und ausführen.
-- ══════════════════════════════════════════════════════════════════════════════

-- ─── 1. live_sessions: allow_comments + allow_gifts Columns ──────────────────
-- Quelle: supabase/migrations/20260413010000_live_session_settings.sql
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS allow_comments BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS allow_gifts    BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.live_sessions.allow_comments IS
  'Host-Einstellung: ob Zuschauer während des Livestreams kommentieren dürfen';
COMMENT ON COLUMN public.live_sessions.allow_gifts IS
  'Host-Einstellung: ob Zuschauer virtuelle Geschenke (Coins) senden dürfen';

-- ─── 2. notifications: type-CHECK + session_id ───────────────────────────────
-- Quelle: supabase/migrations/20260414070000_notifications_extend.sql
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN ('like', 'comment', 'follow', 'dm', 'live', 'live_invite', 'gift'));

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_id UUID
    REFERENCES public.live_sessions(id) ON DELETE SET NULL;

-- gift_name + gift_emoji (aus 20260414060000_gift_notification_trigger.sql)
-- — auch idempotent einspielen für den Fall dass nur der Trigger fehlte
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS gift_name  TEXT,
  ADD COLUMN IF NOT EXISTS gift_emoji TEXT;

-- ─── 3. gift_catalog: chechen_tower + chechen_tower_premium ──────────────────
-- Quelle: supabase/migrations/20260416000000_fix_missing_gifts.sql
INSERT INTO public.gift_catalog (id, name, emoji, coin_cost, diamond_value, color, sort_order, lottie_url)
VALUES
  ('chechen_tower',         'Башня',         '🏰',  750,  660, '#b45309', 9,  NULL),
  ('chechen_tower_premium', 'Башня Премиум', '🏯', 2000, 1760, '#92400e', 10, NULL)
ON CONFLICT (id) DO UPDATE
  SET name          = EXCLUDED.name,
      emoji         = EXCLUDED.emoji,
      coin_cost     = EXCLUDED.coin_cost,
      diamond_value = EXCLUDED.diamond_value,
      color         = EXCLUDED.color,
      sort_order    = EXCLUDED.sort_order;

-- ─── 4. Gift-Push-Notification Trigger (Sicherheitshalber neu deployen) ──────
-- Quelle: supabase/migrations/20260414060000_gift_notification_trigger.sql
CREATE OR REPLACE FUNCTION public.notify_on_gift()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gift_name  TEXT;
  v_gift_emoji TEXT;
BEGIN
  SELECT name, emoji INTO v_gift_name, v_gift_emoji
    FROM public.gift_catalog WHERE id = NEW.gift_id;

  IF NEW.sender_id = NEW.recipient_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    recipient_id, sender_id, type, gift_name, gift_emoji, session_id, created_at
  ) VALUES (
    NEW.recipient_id, NEW.sender_id, 'gift', v_gift_name, v_gift_emoji,
    NEW.live_session_id::uuid, NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_on_gift ON public.gift_transactions;
CREATE TRIGGER trg_notify_on_gift
  AFTER INSERT ON public.gift_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_gift();

-- ─── Sanity-Check Logs ───────────────────────────────────────────────────────
DO $$
BEGIN
  RAISE NOTICE '✅ Hotfix deployed: allow_gifts column, notifications schema, chechen_tower gifts, gift trigger';
END $$;

-- Optional: Prüf-Queries (nach dem Deploy laufen lassen)
-- SELECT column_name, data_type FROM information_schema.columns
--   WHERE table_name = 'live_sessions' AND column_name IN ('allow_gifts', 'allow_comments');
-- SELECT id FROM public.gift_catalog WHERE id LIKE 'chechen%';
-- SELECT constraint_name, check_clause FROM information_schema.check_constraints
--   WHERE constraint_name = 'notifications_type_check';
