-- v1.w.UI.63 — Notification channel preferences
--
-- Fügt `notif_prefs` JSONB-Spalte auf `profiles` hinzu.
-- Granulare Steuerung welche Notification-Typen Push-Alerts auslösen.
--
-- Default: alle Kanäle aktiv (opt-out statt opt-in, da bestehende User
-- sonst keine Notifications mehr bekämen bis sie Einstellungen öffnen).
--
-- Kanal-Keys müssen mit den `type`-Werten in notifications-Tabelle und
-- dem send-push-notification Edge-Function-Mapping übereinstimmen:
--   likes    → type = 'like'
--   comments → type = 'comment'
--   follows  → type = 'follow'
--   messages → type = 'dm'
--   live     → type IN ('live', 'live_invite', 'scheduled_live_reminder')
--   gifts    → type = 'gift'
--   orders   → type = 'new_order'

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notif_prefs JSONB NOT NULL DEFAULT '{
    "likes":    true,
    "comments": true,
    "follows":  true,
    "messages": true,
    "live":     true,
    "gifts":    true,
    "orders":   true
  }'::jsonb;

-- RLS: Jeder liest + schreibt nur seine eigenen Prefs.
-- Kein SECURITY DEFINER nötig — Profile hat bereits `auth.uid() = id` Policies.

COMMENT ON COLUMN public.profiles.notif_prefs IS
  'Per-channel push preference flags. Keys: likes | comments | follows | messages | live | gifts | orders. Default: all true.';
