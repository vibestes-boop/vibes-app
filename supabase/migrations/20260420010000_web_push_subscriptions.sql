-- =============================================================================
-- v1.w.12.4 — Web-Push-Subscriptions (DSGVO-konform, VAPID-signed)
-- =============================================================================
--
-- Kontext:
--   Die Native-App nutzt Expo-Push (Token = 1 String, push-service-dispatch).
--   Web-Push nutzt das W3C Push-API / VAPID-Protokoll — Subscription-Shape ist
--   ein 3-Tupel aus `endpoint` (URL des Push-Services: FCM/Mozilla/WNS),
--   `p256dh` (Client-Public-Key für Nachrichten-Verschlüsselung) und `auth`
--   (Client-Auth-Secret). Die Felder sind opaque aus Server-Sicht — wir
--   signieren JWT mit VAPID-Private-Key und fetchen `endpoint`.
--
-- Design-Entscheidung — SEPARATE Tabelle statt push_tokens zu erweitern:
--   (1) Push-Dispatch-Pfade bleiben Runtime-getrennt: Expo geht an den
--       Expo-Push-Service (Edge-Function `send-push-notification`), Web-Push
--       geht an die VAPID-Library (Edge-Function `send-web-push`, kommt in
--       Slice D). Eine gemeinsame Tabelle würde den Hot-Path-Trigger
--       `send_push_to_user()` mit Platform-Dispatch-Logik aufblähen.
--   (2) Schema-Form ist fundamentally different (1 Token vs 3 Felder +
--       optional metadata). CHECK-Constraints wären unterschiedlich.
--   (3) RLS bleibt per Tabelle sauber isoliert — kein Shared-Blast-Radius
--       bei Policy-Bugs.
--
-- Shape-Referenz: https://www.w3.org/TR/push-api/#pushsubscription-interface
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.web_push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

  -- W3C-PushSubscription-Felder
  endpoint     TEXT NOT NULL,          -- URL des Push-Services (FCM/Mozilla/WNS)
  p256dh       TEXT NOT NULL,          -- ECDH-Public-Key (base64url)
  auth         TEXT NOT NULL,          -- Client-Auth-Secret (base64url)

  -- Observability-Metadata (OPTIONAL — alle nullable)
  user_agent   TEXT,                   -- UA-String bei Subscribe (hilft Browser-Stats)
  device_label TEXT,                   -- User-selectable Label ("MacBook Pro", "Handy")

  -- Lifecycle
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Ein User kann denselben Endpoint nicht doppelt registrieren — Browser
  -- gibt ohnehin nur einen aktiven Subscription pro Origin zurück, aber
  -- safety-net gegen Race-Condition beim Re-Subscribe nach Permission-Reset.
  CONSTRAINT web_push_user_endpoint_unique UNIQUE (user_id, endpoint)
);

COMMENT ON TABLE public.web_push_subscriptions IS
  'W3C Web-Push-Subscriptions (VAPID). Getrennt von push_tokens (Expo) weil Shape + Dispatch-Pfad fundamental anders.';

CREATE INDEX IF NOT EXISTS idx_web_push_subs_user_id
  ON public.web_push_subscriptions(user_id);

-- Partial-Index für die Dispatch-Function: beim Batch-Fanout („send an alle
-- Geräte von User X") wollen wir stale Subscriptions (> 60 Tage nicht mehr
-- gesehen) ausfiltern, bevor wir sie dem VAPID-Signer überhaupt übergeben.
CREATE INDEX IF NOT EXISTS idx_web_push_subs_recent
  ON public.web_push_subscriptions(user_id, last_seen_at DESC);

-- =============================================================================
-- RLS — User verwaltet NUR seine eigenen Subscriptions.
-- =============================================================================
ALTER TABLE public.web_push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_manages_own_web_push_subs" ON public.web_push_subscriptions;
CREATE POLICY "user_manages_own_web_push_subs"
  ON public.web_push_subscriptions
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service-Role (Edge-Function `send-web-push`) braucht Read für Dispatch,
-- aber KEIN Write — Subscriptions werden ausschließlich vom Client selbst
-- angelegt. Kein explizites GRANT nötig (service_role bypasst RLS per Default).

-- =============================================================================
-- Heartbeat-RPC — Client ruft das bei jedem Page-Load auf damit
-- `last_seen_at` nachgeführt wird. Ohne Heartbeat würde die Cleanup-Logik
-- aktive Nutzer fälschlich als stale kategorisieren.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.touch_web_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  UPDATE public.web_push_subscriptions
     SET last_seen_at = NOW()
   WHERE user_id  = auth.uid()
     AND endpoint = p_endpoint;
END;
$$;

REVOKE ALL ON FUNCTION public.touch_web_push_subscription(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_web_push_subscription(TEXT) TO authenticated;

-- =============================================================================
-- Dispatch-Helper — gibt alle aktiven (< 60d stale) Subscriptions eines Users
-- zurück. Wird von der Edge-Function `send-web-push` (Slice D) konsumiert,
-- NICHT von Triggern (kein pg_net im Standard-Setup, Edge-Function ist der
-- HTTP-Dispatcher).
--
-- Rückgabe als Tabelle damit die Function keine Rows einzeln cursor-iteriert.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_active_web_push_subs(p_user_id UUID)
RETURNS TABLE (
  id        UUID,
  endpoint  TEXT,
  p256dh    TEXT,
  auth      TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  -- Stale-Filter: 60 Tage. Browser invalidieren Subscriptions ungeprompted
  -- wenn der User die Site lange nicht besucht, wir wollen nicht an tote
  -- Endpoints senden (410 Gone / 404 vom Push-Service wäre Quota-Verlust).
  SELECT s.id, s.endpoint, s.p256dh, s.auth
    FROM public.web_push_subscriptions s
   WHERE s.user_id      = p_user_id
     AND s.last_seen_at > NOW() - INTERVAL '60 days';
$$;

REVOKE ALL ON FUNCTION public.get_active_web_push_subs(UUID) FROM PUBLIC, anon, authenticated;
-- Nur service_role darf das rufen — ein regulärer User würde damit sehen
-- können, auf welchen Geräten ein ANDERER User subscribed ist. Das wäre
-- eine Privacy-Leak. Authenticated-Users haben über die RLS-Policy sowieso
-- Access auf ihre eigenen Subscriptions über normale SELECT.
GRANT EXECUTE ON FUNCTION public.get_active_web_push_subs(UUID) TO service_role;

-- =============================================================================
-- Prune-Helper — Edge-Function ruft das nach Dispatch wenn ein Endpoint
-- HTTP 404 oder 410 geliefert hat (Push-Service sagt „Subscription tot").
-- =============================================================================
CREATE OR REPLACE FUNCTION public.prune_web_push_subscription(p_endpoint TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.web_push_subscriptions
   WHERE endpoint = p_endpoint;
$$;

REVOKE ALL ON FUNCTION public.prune_web_push_subscription(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prune_web_push_subscription(TEXT) TO service_role;
