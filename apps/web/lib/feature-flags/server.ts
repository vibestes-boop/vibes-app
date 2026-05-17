import { createClient } from '@/lib/supabase/server';

export const RUNTIME_FEATURE_FLAGS = [
  'ai_image_enabled',
  'live_streaming_enabled',
  'live_whip_ingress_enabled',
  'live_recording_enabled',
  'live_shop_enabled',
] as const;

export type RuntimeFeatureFlag = (typeof RUNTIME_FEATURE_FLAGS)[number];

export const RUNTIME_FEATURE_DISABLED_MESSAGES: Record<RuntimeFeatureFlag, string> = {
  ai_image_enabled: 'AI-Bilder sind aktuell deaktiviert.',
  live_streaming_enabled: 'Live-Streaming ist aktuell deaktiviert.',
  live_whip_ingress_enabled: 'OBS/WHIP-Streaming ist aktuell deaktiviert.',
  live_recording_enabled: 'Live-Aufnahmen sind aktuell deaktiviert.',
  live_shop_enabled: 'Live-Shopping ist aktuell deaktiviert.',
};

export async function isRuntimeFeatureEnabled(flag: RuntimeFeatureFlag): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('is_feature_enabled', {
    p_flag_key: flag,
  });

  if (error) {
    console.warn(`[feature-flags] ${flag} check failed: ${error.message}`);
    return false;
  }

  return data === true;
}

export async function requireRuntimeFeature(
  flag: RuntimeFeatureFlag,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const enabled = await isRuntimeFeatureEnabled(flag);
  if (!enabled) {
    return {
      ok: false,
      error: RUNTIME_FEATURE_DISABLED_MESSAGES[flag],
    };
  }

  return { ok: true };
}
