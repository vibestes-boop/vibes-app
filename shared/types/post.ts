export interface Post {
  id: string;
  user_id: string;
  caption: string | null;
  video_url: string;
  thumbnail_url: string | null;
  duration_secs: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  share_count: number;
  hashtags: string[];
  music_id: string | null;
  allow_comments: boolean;
  allow_duet: boolean;
  allow_stitch: boolean;
  /** Optional — populated by web queries; undefined for legacy mobile rows. */
  women_only?: boolean;
  /** v1.w.UI.179 — pinned to author's profile (max 1 per user). */
  is_pinned?: boolean;
  /** v1.w.UI.205 — video frame aspect ratio stored at upload time. */
  aspect_ratio?: 'portrait' | 'landscape' | 'square';
  /** v1.w.UI.211 — optional background audio track played alongside the video. */
  audio_url?: string | null;
  /** v1.w.UI.211 — volume of the audio track (0–1). Null = creator default 0.8. */
  audio_volume?: number | null;
  created_at: string;
}

export interface Story {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  duration_secs: number;
  expires_at: string;
  view_count: number;
  created_at: string;
}
