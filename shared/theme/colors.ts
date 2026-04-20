/**
 * shared/theme/colors.ts
 *
 * Plattform-agnostisches Design-Token-System.
 * 1:1 Port von `lib/theme.ts` (Native) — beide Apps importieren HIER.
 *
 * Native: `import { darkColors, lightColors } from '../../shared/theme/colors'`
 * Web:    `import { darkColors, lightColors } from '@shared/theme/colors'`
 */

export interface ThemeColors {
  bg: {
    primary:   string;
    secondary: string;
    elevated:  string;
    input:     string;
    subtle:    string;
  };
  text: {
    primary:   string;
    secondary: string;
    muted:     string;
    inverse:   string;
  };
  accent: {
    primary:   string;
    secondary: string;
    danger:    string;
    success:   string;
    warning:   string;
    gold:      string;
  };
  border: {
    default: string;
    subtle:  string;
    strong:  string;
  };
  icon: {
    default:  string;
    muted:    string;
    active:   string;
    inactive: string;
  };
  tabBar: {
    bg:       string;
    border:   string;
    active:   string;
    inactive: string;
  };
}

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
    primary:   '#FFFFFF',
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

export const lightColors: ThemeColors = {
  bg: {
    primary:   '#F5F5F5',
    secondary: '#FFFFFF',
    elevated:  '#FFFFFF',
    input:     '#F8F8F8',
    subtle:    'rgba(0,0,0,0.05)',
  },
  text: {
    primary:   '#0F172A',
    secondary: '#374151',
    muted:     '#9CA3AF',
    inverse:   '#FFFFFF',
  },
  accent: {
    primary:   '#000000',
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
    default:  '#1F2937',
    muted:    '#6B7280',
    active:   '#0F172A',
    inactive: '#6B7280',
  },
  tabBar: {
    bg:       '#FFFFFF',
    border:   'rgba(0,0,0,0.08)',
    active:   '#0F172A',
    inactive: '#6B7280',
  },
};

export type ThemeMode = 'dark' | 'light' | 'system';
