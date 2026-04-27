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
