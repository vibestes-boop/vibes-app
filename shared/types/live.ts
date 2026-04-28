export type LiveSessionStatus = 'active' | 'ended' | 'failed';

export interface LiveSession {
  id: string;
  host_id: string;
  room_name: string;
  title: string | null;
  thumbnail_url: string | null;
  category: string | null;
  status: LiveSessionStatus;
  viewer_count: number;
  peak_viewer_count: number;
  started_at: string;
  ended_at: string | null;
  updated_at: string;
  moderation_enabled: boolean;
  moderation_words: string[] | null;
  // v1.w.UI.185 — Host-set session flags (parity with mobile v1.w.UI.184)
  allow_comments: boolean;
  allow_gifts: boolean;
  women_only: boolean;
  // v1.w.UI.188 — Followers-only chat (parity with mobile toggle_followers_only_chat)
  followers_only_chat: boolean;
}

export interface LiveComment {
  id: string;
  session_id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  text: string;
  is_pinned: boolean;
  created_at: string;
}

export type DuetLayout =
  | 'top-bottom'
  | 'side-by-side'
  | 'pip'
  | 'battle'
  | 'grid-2x2'
  | 'grid-3x3';

export interface ActiveCoHost {
  userId: string;
  username: string;
  avatarUrl: string | null;
  slotIndex: number;
  approvedAt: string;
}
