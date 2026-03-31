export type ProfileTab = 'vibes' | 'saved' | 'analytics' | 'drafts';

export type ProfilePostGridItem = {
  id: string;
  media_url: string | null;
  media_type: string;
  caption: string | null;
  dwell_time_score?: number;
};
