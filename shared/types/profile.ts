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
  // v1.w.UI.16 (Web-only): Live-Status für Avatar-Gradient-Ring auf der Profil-
  // Seite (und später Messages-Liste / Feed-Card). Optional + nullable damit
  // Mobile-Clients die ihre eigenen `useLiveSession`-Hooks nutzen nicht
  // brechen — die Felder sind nur auf Rows gesetzt die vom Web-Adapter
  // (`apps/web/lib/data/public.ts`) kommen.
  is_live?: boolean;
  live_session_id?: string | null;
}
