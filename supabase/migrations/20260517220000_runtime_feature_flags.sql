-- Runtime kill switches for high variable-cost features.
--
-- These rows extend the generic feature_flags table introduced with the
-- AI-image safeguards. ON CONFLICT avoids re-enabling a flag that an operator
-- has intentionally disabled in production.

INSERT INTO public.feature_flags (flag_key, enabled, description)
VALUES
  (
    'ai_image_enabled',
    true,
    'Master-Kill-Switch für AI-Image-Generation. Bereits von AI-Quota-RPCs und Edge Function beachtet.'
  ),
  (
    'live_streaming_enabled',
    true,
    'Master-Kill-Switch für neue Live-Sessions. Auf false setzen, um LiveKit-Minuten sofort zu stoppen.'
  ),
  (
    'live_whip_ingress_enabled',
    true,
    'Kill-Switch für OBS/WHIP-Ingress-Erstellung und Credential-Rotation.'
  ),
  (
    'live_recording_enabled',
    true,
    'Kill-Switch für neue Live-Aufnahmen und LiveKit-Egress-Kosten. Stoppen bestehender Aufnahmen bleibt möglich.'
  ),
  (
    'live_shop_enabled',
    true,
    'Kill-Switch für Aktivierung des Live-Shopping-Modus in Streams.'
  )
ON CONFLICT (flag_key) DO NOTHING;
