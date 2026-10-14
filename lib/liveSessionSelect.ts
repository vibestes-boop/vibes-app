import type { LiveSession } from './useLiveSession';

// Keep in sync with the readable columns granted in
// 20260814260000_live_sessions_hide_ingress.sql. SELECT * includes the OBS
// ingress credentials and is rejected (42501) for anon and authenticated alike.
//
// One key per LiveSession field except the profiles embed: tsc rejects a
// missing or an extra column, so the type and the query cannot drift apart.
const LIVE_SESSION_COLUMNS: Record<Exclude<keyof LiveSession, 'profiles'>, true> = {
  id: true,
  host_id: true,
  title: true,
  status: true,
  viewer_count: true,
  peak_viewers: true,
  like_count: true,
  comment_count: true,
  room_name: true,
  started_at: true,
  ended_at: true,
  replay_url: true,
  is_replayable: true,
  thumbnail_url: true,
  category: true,
  moderation_enabled: true,
  moderation_words: true,
  slow_mode_seconds: true,
  followers_only_chat: true,
  allow_comments: true,
  allow_gifts: true,
  women_only: true,
  followers_only: true,
};

export const LIVE_SESSION_SELECT = Object.keys(LIVE_SESSION_COLUMNS).join(',');
