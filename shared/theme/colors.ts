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
    onAccent:  string;  // Text and icons on accent.solid, in either theme.
  };
  accent: {
    primary:   string;  // Links and icons on neutral surfaces.
    solid:     string;  // Filled actions; pair with text.onAccent.
    secondary: string;
    danger:    string;
    success:   string;
    warning:   string;
    gold:      string;
    rose:      string;  // Women-Only-Zone / Like-Heart.
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

// Glossy white, neutral silver and graphite. Color belongs to the content.
export const darkColors: ThemeColors = {
  bg: {
    primary: '#0C0D10',
    secondary: '#191B20',
    elevated: '#30333A',
    input: '#25282E',
    subtle: 'rgba(225,232,244,0.06)',
  },
  text: {
    primary: '#F8F9FB',
    secondary: '#CED1D8',
    muted: '#A8ADB8',
    inverse: '#FFFFFF',
    onAccent: '#191C22',
  },
  accent: {
    primary: '#DEE2E9',
    solid: '#F4F6FA',
    secondary: '#AEB5C1',
    danger: '#EF6B62',
    success: '#7FA688',
    warning: '#D9AF68',
    gold: '#D9AF68',
    rose: '#E68C9C',
  },
  border: {
    default: 'rgba(225,232,244,0.10)',
    subtle: 'rgba(225,232,244,0.06)',
    strong: 'rgba(225,232,244,0.20)',
  },
  icon: {
    default: '#CED1D8',
    muted: '#A8ADB8',
    active: '#F8F9FB',
    inactive: '#A8ADB8',
  },
  tabBar: {
    bg: '#17191E',
    border: 'rgba(225,232,244,0.08)',
    active: '#F8F9FB',
    inactive: '#A8ADB8',
  },
};

export const lightColors: ThemeColors = {
  bg: {
    primary: '#F5F6F8',
    secondary: '#FFFFFF',
    elevated: '#FFFFFF',
    input: '#E8EBEF',
    subtle: 'rgba(40,54,75,0.045)',
  },
  text: {
    primary: '#181B20',
    secondary: '#4C535E',
    muted: '#626975',
    inverse: '#FFFFFF',
    onAccent: '#FFFFFF',
  },
  accent: {
    primary: '#424A56',
    solid: '#20242A',
    secondary: '#6A7585',
    danger: '#BF493F',
    success: '#497354',
    warning: '#91631F',
    gold: '#91631F',
    rose: '#AF5166',
  },
  border: {
    default: 'rgba(31,43,62,0.10)',
    subtle: 'rgba(31,43,62,0.06)',
    strong: 'rgba(31,43,62,0.18)',
  },
  icon: {
    default: '#4C535E',
    muted: '#626975',
    active: '#181B20',
    inactive: '#626975',
  },
  tabBar: {
    bg: '#FFFFFF',
    border: 'rgba(31,43,62,0.09)',
    active: '#181B20',
    inactive: '#626975',
  },
};

export type ThemeMode = 'dark' | 'light' | 'system';
