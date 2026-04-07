export type ProfileTab = 'vibes' | 'saved' | 'analytics' | 'drafts' | 'reposts';


export type ProfilePostGridItem = {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  dwell_time_score?: number;
  thumbnail_url?: string | null;  // Statisches Thumbnail für Videos
  is_pinned?: boolean;
  view_count?: number;            // View-Zähler — wird im Grid angezeigt
  reposted_at?: string | null;    // ISO-Datum wann repostet — nur im Reposts-Tab
};
