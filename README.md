# Vibes – Frontend (Expo)

## Setup

```bash
npm install
cp .env.example .env   # Platzhalter ausfüllen (Supabase Dashboard → API)
npm start
```

Benötigte Umgebungsvariablen in `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

> **Wichtig:** `.env` ist in `.gitignore` – nur `.env.example` ins Repo committen.

## Qualität

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # expo lint (ESLint)
```

## Hinweise

- **Supabase Edge Functions** liegen unter `supabase/functions/` und sind vom App-`tsconfig` ausgeschlossen (Deno).
- Auth & Routing: `app/_layout.tsx` (`AuthGuard`).
- Feature-UI: `components/feed/`, `components/profile/`, `components/guild/`, `components/explore/`, `components/create/`; Daten-Hooks z. B. `lib/useExplore.ts`, `lib/useGuildMemberCount.ts`.
