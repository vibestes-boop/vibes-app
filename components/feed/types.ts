export type FeedItemData = {
  id: string;
  author: string;
  caption: string;
  tag: string;
  tags: string[];
  gradient: string[];
  accentColor: string;
  mediaUrl?: string | null;
  mediaType?: string;
  thumbnailUrl?: string | null;  // JPEG-Vorschau für Videos — sofort sichtbar während Video lädt
  authorId?: string;
  avatarUrl?: string | null;
  viewCount?: number;            // View-Zähler aus der posts Tabelle
  privacy?: 'public' | 'friends' | 'private';  // Zielgruppe des Posts
  allowComments?: boolean;       // Kommentare deaktiviert?
  allowDuet?: boolean;           // Duet deaktiviert?
  audioUrl?: string | null;      // Musik-Track URL (wenn vom Creator hinzugefügt)
  audioTitle?: string | null;    // Musik-Track Titel für Badge im Feed
  audioVolume?: number | null;   // Lautstärke 0..1 — vom Creator im Picker eingestellt
  isVerified?: boolean | null;   // Creator-Verifizierungs-Badge
  womenOnly?: boolean;           // Women-Only Zone Post 🌸
};
