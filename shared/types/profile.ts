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
  // v1.w.UI.149 (Web-only): Privates Konto — Follow-Anfragen statt direktem Follow.
  is_private?: boolean;
  // v1.w.UI.160 (Web-only): Website-URL.
  website?: string | null;
  // Kein `teip` (Тейп / tschetschenischer Clan): verrät die Herkunft (Art. 9
  // DSGVO) und ist ohne Anmeldung nicht lesbar. Dieses Profil ist öffentlich
  // und wird im Web für alle Besucher geteilt gecacht. Wie in der App steht der
  // Teip auf keiner Profilseite, nur in den Einstellungen.
}
