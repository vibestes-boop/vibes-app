# Serlo Web

Desktop-first Web-Version der Serlo-App. Next.js 15 App Router + Supabase SSR.

Die komplette Roadmap liegt unter [`../../WEB_ROADMAP.md`](../../WEB_ROADMAP.md).
Diese README deckt nur das Dev-Setup ab.

---

## 🚀 Erster Start

```bash
cd apps/web

# 1. Dependencies installieren
npm install

# 2. Environment-Variablen setzen
cp .env.local.example .env.local
# → fülle SUPABASE_URL, SUPABASE_ANON_KEY aus Supabase-Dashboard ein
#   (gleiche Keys wie Native: supabase/project/<id>/settings/api)

# 3. Dev-Server
npm run dev
# → http://localhost:3000
```

Für einen funktionierenden Auth-Flow brauchst du mindestens `NEXT_PUBLIC_SUPABASE_URL` und `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Alle anderen Keys (LiveKit, Stripe, R2) sind in Phase 0 optional — ihre Features werden erst ab Phase 5 (Live), Phase 8 (Upload), Phase 10 (Payments) genutzt.

---

## 📁 Struktur

```
apps/web/
├── app/                 # Next.js App Router
│   ├── layout.tsx       # Root-Layout (Theme, Query, PostHog, Toaster)
│   ├── page.tsx         # Landing-Page
│   ├── globals.css      # Tailwind + shadcn CSS-Variablen
│   ├── login/           # Platzhalter — Phase 1
│   ├── signup/          # Platzhalter — Phase 1
│   └── not-found.tsx    # 404
│
├── components/
│   └── ui/              # shadcn/ui Primitives (button, avatar, dialog)
│
├── lib/
│   ├── utils.ts         # cn() für Class-Merging
│   └── supabase/
│       ├── client.ts    # Browser-Client
│       ├── server.ts    # Server-Components-Client
│       └── middleware.ts # Session-Refresh-Helper
│
├── providers/
│   ├── query-provider.tsx    # TanStack Query
│   ├── theme-provider.tsx    # next-themes (dark/light)
│   └── posthog-provider.tsx  # Analytics
│
├── middleware.ts        # Root-Middleware (Supabase-Session-Refresh + Protected-Route-Gate)
├── tailwind.config.ts
├── next.config.mjs
├── components.json      # shadcn/ui Config
└── .env.local.example
```

### Shared Code

Cross-Platform-Code lebt unter `../../shared/` und wird via `@shared/*` Alias importiert:

```ts
import { darkColors } from '@shared/theme/colors';
import { productCreateSchema } from '@shared/schemas';
import { containsBlockedWord } from '@shared/moderation/words';
import type { Product, LiveSession } from '@shared/types';
```

Diese Module dürfen **keine** React-Native- oder DOM-Abhängigkeiten haben.

---

## 🎨 Theme

Dark/Light kommt via `next-themes` Provider. User-Wahl wird in localStorage persistiert, System-Preference greift als Default.

Brand-Farben aus `shared/theme/colors.ts` sind in `globals.css` als HSL-CSS-Variablen gespiegelt. Tailwind-Klassen: `bg-background`, `text-foreground`, `bg-primary`, `text-muted-foreground`, `bg-brand-gold`, `bg-brand-danger` etc.

Theme-Toggle kommt in Phase 1 (Header-Component).

---

## 🔐 Auth

Supabase-SSR nutzt Cookies statt localStorage → funktioniert in Server Components out of the box.

**Protected Routes** werden in `lib/supabase/middleware.ts` gegated:
- `/studio/*` → Login nötig
- `/messages/*` → Login nötig
- `/settings/*` → Login nötig
- `/create/*` → Login nötig

Alles andere (`/`, `/u/[username]`, `/p/[id]`, `/shop/*`, `/live/*`) ist public — wichtig für SEO.

---

## 🧪 Scripts

```bash
npm run dev         # Dev-Server mit HMR
npm run build       # Production-Build
npm run start       # Production-Server nach Build
npm run lint        # ESLint
npm run typecheck   # TypeScript ohne Emit
```

---

## 📝 Nächste Schritte

Nach dem ersten Start (Phase 0 abgeschlossen) kommt Phase 1 — Auth & Onboarding. Details in [`WEB_ROADMAP.md`](../../WEB_ROADMAP.md#phase-1--auth--onboarding).
