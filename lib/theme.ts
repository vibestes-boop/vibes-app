/**
 * lib/theme.ts — Vibes Design Token System
 *
 * Alle Farben der App zentral definiert.
 * Nie direkt Hex-Werte in Komponenten — immer colors.xxx verwenden.
 */

export interface ThemeColors {
  // ── Hintergründe ──────────────────────────────────────────────────────────
  bg: {
    primary:   string;  // Haupt-App-Hintergrund
    secondary: string;  // Karten, Sheets, Tab-Bar
    elevated:  string;  // Modals, Overlays, Picker
    input:     string;  // Eingabefelder
    subtle:    string;  // Sehr dezente Trenner / Hover-States
  };

  // ── Text ──────────────────────────────────────────────────────────────────
  text: {
    primary:   string;  // Haupttext
    secondary: string;  // Untertext, Labels
    muted:     string;  // Platzhalter, Hints
    inverse:   string;  // Text auf farbigem Hintergrund (immer weiß)
  };

  // ── Brand / Akzent ────────────────────────────────────────────────────────
  accent: {
    primary:   string;  // Cyan — Haupt-Brand-Farbe
    secondary: string;  // Lila — Sekundär
    danger:    string;  // Rot — Fehler, Block, Delete
    success:   string;  // Grün — Bestätigung
    warning:   string;  // Gelb/Orange — Hinweis
    gold:      string;  // Gold — Coins, Premium
  };

  // ── Ränder / Trennlinien ──────────────────────────────────────────────────
  border: {
    default: string;
    subtle:  string;
    strong:  string;
  };

  // ── Icons ─────────────────────────────────────────────────────────────────
  icon: {
    default:  string;
    muted:    string;
    active:   string;   // Tab-Icon aktiv
    inactive: string;   // Tab-Icon inaktiv
  };

  // ── Tab-Bar ───────────────────────────────────────────────────────────────
  tabBar: {
    bg:         string;
    border:     string;
    active:     string;
    inactive:   string;
  };
}

// ─── Dark Theme ───────────────────────────────────────────────────────────────

export const darkColors: ThemeColors = {
  bg: {
    primary:   '#050508',
    secondary: '#0D0D0D',
    elevated:  '#1A1A1A',
    input:     '#111111',
    subtle:    'rgba(255,255,255,0.04)',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#9CA3AF',
    muted:     '#4B5563',
    inverse:   '#FFFFFF',
  },
  accent: {
    primary:   '#FFFFFF',   // TikTok-Stil: Weiß auf Dunkel
    secondary: '#A855F7',
    danger:    '#EF4444',
    success:   '#22C55E',
    warning:   '#F59E0B',
    gold:      '#FBBF24',
  },
  border: {
    default: 'rgba(255,255,255,0.08)',
    subtle:  'rgba(255,255,255,0.04)',
    strong:  'rgba(255,255,255,0.16)',
  },
  icon: {
    default:  '#9CA3AF',
    muted:    '#4B5563',
    active:   '#FFFFFF',
    inactive: '#6B7280',
  },
  tabBar: {
    bg:       '#050508',
    border:   'rgba(255,255,255,0.06)',
    active:   '#FFFFFF',
    inactive: '#6B7280',
  },
};

// ─── Light Theme ──────────────────────────────────────────────────────────────

export const lightColors: ThemeColors = {
  bg: {
    primary:   '#F5F5F5',   // helles iOS-Grau — heller als vorher
    secondary: '#FFFFFF',   // weiße Karten / Sheets
    elevated:  '#FFFFFF',   // Modals — auch weiß
    input:     '#F8F8F8',   // Eingabefelder leicht getint
    subtle:    'rgba(0,0,0,0.05)',  // sichtbarer Trenner
  },
  text: {
    primary:   '#0F172A',
    secondary: '#374151',
    muted:     '#9CA3AF',
    inverse:   '#FFFFFF',
  },
  accent: {
    primary:   '#000000',   // TikTok-Stil: Schwarz auf Weiß
    secondary: '#9333EA',
    danger:    '#DC2626',
    success:   '#16A34A',
    warning:   '#D97706',
    gold:      '#D97706',
  },
  border: {
    default: 'rgba(0,0,0,0.08)',
    subtle:  'rgba(0,0,0,0.04)',
    strong:  'rgba(0,0,0,0.16)',
  },
  icon: {
    default:  '#1F2937',   // deutlich dunkel — gut auf weiß
    muted:    '#6B7280',   // mittelgrau
    active:   '#0F172A',
    inactive: '#6B7280',   // dunkler als vorher (#9CA3AF)
  },
  tabBar: {
    bg:       '#FFFFFF',
    border:   'rgba(0,0,0,0.08)',
    active:   '#0F172A',
    inactive: '#6B7280',   // dunkler als vorher
  },
};

export type ThemeMode = 'dark' | 'light' | 'system';
