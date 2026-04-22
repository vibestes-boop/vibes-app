import type { Config } from 'tailwindcss';

/**
 * Tailwind-Config mit shadcn/ui-konformen CSS-Variablen.
 *
 * Die konkreten Farb-Werte werden in `app/globals.css` als CSS-Variablen gesetzt
 * (`--background`, `--foreground`, etc.) und dort zwischen Dark/Light per
 * `[data-theme="dark"]` Selector umgeschaltet. Quelle der Tokens:
 * `shared/theme/colors.ts` (gespiegelt in globals.css).
 */
export default {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx,mdx}',
    './components/**/*.{ts,tsx,mdx}',
    './lib/**/*.{ts,tsx}',
    '../../shared/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '1.5rem',
      screens: {
        '2xl': '1440px',
      },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Serlo Brand-Akzente (direkt aus shared/theme/colors.ts)
        brand: {
          gold:    'hsl(var(--brand-gold))',
          success: 'hsl(var(--brand-success))',
          warning: 'hsl(var(--brand-warning))',
          danger:  'hsl(var(--brand-danger))',
          purple:  'hsl(var(--brand-purple))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to:   { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to:   { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up':   'accordion-up 0.2s ease-out',
      },
      /**
       * Bewusste Design-Entscheidung: **System-Font-Stack ohne Web-Font-Load**.
       * Grund: (a) Native-App nutzt auch die System-Font, Cross-Platform-Parität.
       * (b) Zero bytes transferred → Zero CLS, keine `font-display`-Strategie nötig.
       * (c) TikTok-nahes Look-and-Feel (TikTok verwendet ebenfalls Systemfont im Web).
       * Die vorigen Einträge `var(--font-geist-sans)` / `var(--font-geist-mono)` waren
       * Cargo-Cult aus dem create-next-app-Scaffold — die Variablen wurden NIE
       * irgendwo definiert, sodass Tailwind still auf den nächsten Wert
       * (`system-ui`) fiel. Jetzt explizit dokumentiert statt implizit.
       * Wer später doch eine Web-Font will: `next/font/local` oder `next/font/google`
       * im root-`layout.tsx`, daraus die CSS-Var `--font-*` setzen, Stack hier
       * vorne wieder ergänzen.
       */
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
