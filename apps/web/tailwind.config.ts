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
      /**
       * Elevation-Skala (v1.w.UI.1). Definiert eine bewusste 4-Stufen-Hierarchie:
       *   elevation-1 — ruhender Zustand, fast unsichtbar (Cards, Listen-Rows)
       *   elevation-2 — Hover / leichter Fokus (hover:shadow-elevation-2)
       *   elevation-3 — Sticky Bars, Dropdown-Menus, Popovers
       *   elevation-4 — Dialoge, Sheets, Modal-Overlays (max. Lift)
       *
       * Warum eigene Tokens statt Tailwind-Default-Shadows (`shadow-sm`, `shadow-md`):
       * Die Default-Werte nutzen eine pauschale 8%-Opacity und y-Offsets die auf
       * weißem Canvas zu hart wirken. TikTok/Apple-Stil ist bewusst sanfter —
       * niedrige Opacity (4-12%), breiter Blur, minimaler y-Offset. Dadurch wirken
       * Cards „float" statt „stamp".
       *
       * Dark-Mode-Hinweis: Shadows mit schwarzem `rgba(0,0,0,x)` sind auf dunklem
       * Canvas visuell fast unsichtbar. Dark-Mode greift stattdessen via
       * `dark:border-border/40`-Outline auf die existierende Border-Token-Skala
       * zurück — der Lift-Effekt kommt dort aus dem Border-Kontrast statt Shadow.
       */
      boxShadow: {
        'elevation-1': '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 3px 0 rgb(0 0 0 / 0.05)',
        'elevation-2': '0 2px 4px -1px rgb(0 0 0 / 0.06), 0 4px 8px -2px rgb(0 0 0 / 0.08)',
        'elevation-3': '0 4px 8px -2px rgb(0 0 0 / 0.08), 0 8px 16px -4px rgb(0 0 0 / 0.10)',
        'elevation-4': '0 8px 16px -4px rgb(0 0 0 / 0.10), 0 16px 32px -8px rgb(0 0 0 / 0.14)',
      },
      /**
       * Motion-System (v1.w.UI.1). Vier Duration-Stufen + eine Easing-Kurve.
       * `out-expo` ist die TikTok/iOS-typische „schnell raus, sanft rein"-
       * Bewegung — Finger-Snap-Feel, nicht linear-träge.
       *
       * Usage-Konvention:
       *   duration-fast (120ms) — Pressed-Feedback, Icon-Color-Change
       *   duration-base (200ms) — Hover-Transitions, Button-States (Default)
       *   duration-slow (320ms) — Card-Lift, Sheet-In, Drawer-Open
       *   duration-slower (500ms) — Celebrate-Animations (seltene Verwendung)
       */
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        fast:    '120ms',
        base:    '200ms',
        slow:    '320ms',
        slower:  '500ms',
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
       * Inter als Primary-Font (v1.w.UI.1 — UI-Audit-Phase-1). Via `next/font/google`
       * in `app/layout.tsx` self-hosted bundled — kein externer Network-Call zur
       * Laufzeit. Der Stack fällt bei Font-Block/-Fail sauber auf System-UI zurück
       * (dieselbe Fallback-Kette wie vorher), deshalb ist der Wechsel non-breaking
       * auf Browsern/Netzen die `woff2` nicht servieren können.
       *
       * Warum Inter und nicht weiter System-Font: TikTok/Instagram/Twitter/LinkedIn
       * nutzen alle eine proprietäre Sans mit enger Metrik + stark ausgeglichenem
       * x-Height (TikTok Sans, Proxima Nova, Twitter Chirp, Inter bei LinkedIn).
       * System-Font rendert auf macOS/iOS als SF-Pro (okay), auf Windows als Segoe
       * UI (zu wide), auf Linux als DejaVu (visuell bricht sofort als „nicht
       * consumer-grade"). Inter gibt uns visuelle Konsistenz cross-platform.
       *
       * Native-App bleibt bei System-Font — Konsistenz dort kommt über iOS-SF-Pro /
       * Android-Roboto, die beide exzellent sind. Web hat das Problem NICHT der
       * Plattform-Varianz sondern der Cross-OS-Varianz.
       */
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
