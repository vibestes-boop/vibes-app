// Keep in sync with the readable columns granted in
// 20260814240000_profiles_hide_push_tokens.sql. SELECT * includes protected
// push tokens and is rejected, even when requesting the signed-in user's row.
export const PROFILE_SELECT = [
  'id', 'username', 'bio', 'website', 'avatar_url', 'guild_id', 'created_at',
  'onboarding_complete', 'preferred_tags', 'voice_sample_url', 'is_verified',
  'is_private', 'teip', 'gender', 'women_only_verified', 'verification_level',
  'is_creator', 'display_name', 'is_admin', 'nav_slot_2', 'nav_slot_4',
].join(',');
