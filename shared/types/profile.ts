export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  coins_balance: number;
  follower_count: number;
  following_count: number;
  post_count: number;
  verified: boolean;
  created_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  follower_count: number;
  following_count: number;
  post_count: number;
  verified: boolean;
}
