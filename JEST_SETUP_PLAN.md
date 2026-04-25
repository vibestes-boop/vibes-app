# Jest-Setup-Plan — Monorepo (Native + Web)

> Entwurf für Audit Phase 3 — erster Baustein. Ziel: Test-Fundament, das den heutigen
> Feed-Cache-Bug und den Grid-Layout-Bug beim Schreiben gefangen hätte.
> **Status**: Draft · Entscheidungen bereits eingebaut, offene Fragen unten.

---

## Scope

Zwei separate Jest-Configs für die zwei Apps im Monorepo:

- **Native** (`vibes-app/` Root, React Native / Expo SDK 54)
- **Web**   (`vibes-app/apps/web/`, Next.js 15 App Router)

Kein geteiltes Root-Config — die zwei Umgebungen brauchen unterschiedliche Preset/Renderer/jsdom-vs-native-Setup. Ein gemeinsamer Root wäre Scheinparität, die am ersten Hook-Test bricht.

---

## Architektur-Entscheidungen

### 1. Ordner-Layout → Co-located `__tests__/`

Test-Files liegen neben dem getesteten Code in einem `__tests__/`-Ordner:

```
vibes-app/
├── lib/
│   ├── useFeed.ts
│   ├── liveModerationWords.ts
│   └── __tests__/
│       ├── useFeed.test.ts
│       └── liveModerationWords.test.ts
└── apps/web/
    ├── hooks/
    │   ├── use-engagement.ts
    │   └── __tests__/
    │       └── use-engagement.test.tsx
    └── components/feed/
        ├── feed-list.tsx
        └── __tests__/
            └── feed-list.test.tsx
```

Warum: Refactors/Moves nehmen den Test automatisch mit (Git sieht rename). Entwickler sehen sofort, was getestet ist und was nicht. Ein globaler `tests/`-Ordner dupliziert die Struktur und driftet schnell auseinander.

### 2. Framework-Stack

| Umgebung | Runner | Library | Umgebung |
|---|---|---|---|
| Native | `jest-expo` (preset) | `@testing-library/react-native` + `@testing-library/jest-native` | `jsdom` nicht nötig, expo-preset liefert RN-Environment |
| Web | `jest` + `next/jest` (SWC-based config) | `@testing-library/react` + `@testing-library/user-event` + `@testing-library/jest-dom` | `jest-environment-jsdom` |

Jest statt Vitest: Jest ist Standard im React-Native-Ökosystem (jest-expo setzt es voraus), und für Web bringt `next/jest` SWC-Transpilation sodass wir kein Babel-Config pflegen. Vitest wäre schneller, aber das ist keine relevante Größenordnung für unsere aktuelle Repo-Size und würde zwei unterschiedliche Tools im Monorepo bedeuten.

### 3. Mocks-Strategie

Zentrale `__mocks__/`-Ordner auf Config-Level, nicht co-located:

**Native (`vibes-app/__mocks__/`):**
- `@supabase/supabase-js.ts` — chainable Builder-Mock (`.from().select().eq().single()` etc.) mit Inject-Point für Resolve-Werte
- `expo-router.ts` — No-op `Link`, stub `useRouter`/`useLocalSearchParams`
- `expo-image.ts` — Mapped auf native `<Image>`
- `react-native-reanimated.ts` — Official `react-native-reanimated/mock`
- `@livekit/react-native.ts` — No-op Room/Track-Classes (für Live-Feature-Tests ohne WebRTC)

**Web (`apps/web/__mocks__/`):**
- `@supabase/ssr.ts` — mock `createClient` für beide Seiten (Server-Client + Browser-Client getrennt)
- `next/image.ts` — plain `<img>` Replacement (vermeidet Layout-Shift-Warnings in jsdom)
- `next/navigation.ts` — `useRouter`/`usePathname`/`useSearchParams` Mocks

### 4. TanStack-Query in Tests

Helper `renderWithQueryClient()` in `apps/web/__tests__/setup/query-client.tsx`:

```tsx
export function renderWithQueryClient(ui: React.ReactElement, client?: QueryClient) {
  const qc = client ?? new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}
```

Jeder Test bekommt einen frischen `QueryClient` — keine Cross-Test-Leaks. `retry: false` verhindert dass Fehler-Tests 3× retrien und den Jest-Timeout sprengen.

### 5. CI — GitHub Actions

Neuer Workflow `.github/workflows/test.yml`:

- Trigger: PR zu `main` + Push auf `main`
- Zwei parallele Jobs:
  - `native`: `cd . && npm test`
  - `web`: `cd apps/web && npm test`
- Block merge bei Red

Vercel-Preview-Builds bleiben separat (reiner Build, keine Tests) — wir wollen Tests als harten Gate, nicht als flaky Build-Step.

### 6. Coverage

**Phase 1 (dieser Plan):** Keine Threshold. Nur Report generieren um Baseline zu sehen.

**Phase 2 (Follow-up PR nach den ersten Tests):** Threshold auf `lib/`-Ordner:
- Native `vibes-app/lib/`: 60% lines (konservativ, Hook-Tests sind aufwändig)
- Web `apps/web/lib/` + `apps/web/hooks/`: 70% lines (pure Data-Layer testbarer)
- `app/` UI-Layer explizit **ausgenommen** — Snapshot-Tests für komplexe Feed-Screens sind zu flaky

Coverage-Report via `jest --coverage` + Codecov-Integration optional in Phase 3.

---

## Erste Test-Targets (nach Impact sortiert)

Priorisierung: "Wenn das bricht, ist die User-sichtbare Schaden am größten" + "Wir hatten da schon Bugs".

### P1 — `apps/web/hooks/use-engagement.ts`
**Warum:** Die gestrigen `setQueriesData`-Migrationen (partial-match API) sind logik-dicht und haben Optimistic-Rollback-Pfade. Ein Mock-Supabase-Reject muss den Cache zurückrollen.

Testfälle:
- `useTogglePostLike` — optimistic update, erfolgreicher Commit
- Dito, aber mit Reject → Cache rollt zurück auf pre-Update-State
- Mit zwei aktiven Queries (`['feed', 'foryou']` + `['feed', 'following']`): Mutation updated beide
- Follow-Toggle: `following_author` Flag in ALLEN Feed-Caches der viewer

### P2 — `apps/web/components/feed/feed-list.tsx`
**Warum:** Hier lebte der v1.27.5-Bug (shared `queryKey: ['feed']`). Regression-Test: Zwei `FeedList`-Instanzen mit unterschiedlichen `feedKey`s dürfen sich nicht gegenseitig den Cache überschreiben.

Testfälle:
- Render 2× `<FeedList>` mit `feedKey="foryou"` (10 Posts) und `feedKey="following"` (0 Posts) — nach Mount: beide Caches unabhängig
- Leerer `initialPosts` → Empty-State rendert
- `useEffect`-Sync bei `initialPosts`-Change überschreibt Cache nur für den eigenen `feedKey`

### P3 — `lib/liveModerationWords.ts`
**Warum:** Die v1.27.0-Regex-Härtung ist regex-lastig. Parametrische Tests verhindern dass wir bei Wort-Additions die Boundary-Logik brechen.

Testfälle (parametric):
- Positive: `"fuck"`, `"FUCK"`, `"Ｆｕｃｋ"` (full-width), `"f̴u̴c̴k̴"` (zalgo) → alle blocked
- Negative: `"Narsch"` matcht NICHT `"arsch"`, `"spasticity"` matcht NICHT `"spasti"`, `"Schweinwichser"` matcht NICHT `"wichse"` (dokumentierter Trade-off)
- Host-Words FIFO: 257. Host-Word verdrängt das 1.
- `shadow_ban`-Rückgabewert korrekt für beide Fälle

### P4 — `lib/useGifts.ts` (pure helpers)
**Warum:** Die FIFO-Caps aus v1.27.0 (comboRef 256, comboKeyToId 512) sind reine Logik — leicht testbar ohne Supabase-Channel-Mock.

Testfälle:
- Combo-Key-Generation deterministisch
- FIFO-Eviction bei Cap-Erreichen
- Sender+Receiver-Caches unabhängig

### P5 — `apps/web/lib/data/feed.ts`
**Warum:** Data-Layer zwischen Supabase und Feed-Hooks. Row-Mapping (Viewer-Flags: `liked_by_me`, `saved_by_me`, `following_author`) war mehrfach Bug-Quelle.

Testfälle:
- `getForYouFeed` mit Mock-Supabase-Response: Viewer-Flags korrekt gesetzt
- `getFollowingFeed` ohne Follows: returned null/leeres Array (je nach Signature)
- Algorithm-v4-Ranking-Felder vorhanden in Row

---

## Explizit Nicht-Ziele

- **E2E-Tests** (Playwright/Cypress) — Separates Projekt, Phase 4+
- **Visual-Regression / Snapshot-Tests** für komplexe UI — zu flaky, bis Design stabilisiert
- **LiveKit-Room-Integration-Tests** — braucht Mock-WebRTC, riesige Surface. Irgendwann, nicht jetzt
- **Supabase-Realtime-Subscription-Tests** — Channel-Mocking ist Aufwand/Ertrag schlecht. Stattdessen: logik-fähige Teile rauszupfen in pure Funktionen und die testen

---

## Implementation-Sequenz

| PR | Scope | Ergebnis |
|---|---|---|
| **PR 1** | Jest-Config Native + Web, `renderWithQueryClient`, `__mocks__/` Skelett, erste Tests für P1 (`use-engagement`) + P2 (`feed-list`) | Muster etabliert, CI noch lokal |
| **PR 2** | P3 (`liveModerationWords`) parametric + P4 (`useGifts` pure helpers) | Logik-schwere Module abgesichert |
| **PR 3** | `.github/workflows/test.yml`, Coverage-Report, Codecov optional | Tests blocken Merge |
| **PR 4** | P5 (`feed.ts` data layer) + Threshold enforce auf `lib/`/`hooks/` | Baseline-Coverage gelockt |

Je PR ~1 Tag geschätzt, alle 4 zusammen ~4 Arbeitstage bei Fokus.

---

## Package-Additions

### Native (Root `package.json`, devDependencies)
```
jest@^29
jest-expo@~54
@testing-library/react-native@^12
@testing-library/jest-native@^5
@types/jest
```

### Web (`apps/web/package.json`, devDependencies)
```
jest@^29
jest-environment-jsdom@^29
@testing-library/react@^15
@testing-library/jest-dom@^6
@testing-library/user-event@^14
@types/jest
```

`next/jest` ist Teil von Next.js selbst — kein extra Install.

---

## Offene Fragen (brauchen Deine Entscheidung)

1. **GitHub Actions als CI-Host** — OK? Oder willst Du CircleCI / nur lokales `npm test` als Hook?
2. **Erste PR Scope** — Config + 2 erste Test-Files (wie oben)? Oder lieber nur Config als "trockener" Setup-PR und Tests im nächsten PR?
3. **Coverage-Threshold** — 60/70 % wie vorgeschlagen oder andere Zahlen?

Default-Annahme wenn Du nicht widersprichst: GitHub Actions · Config + 2 Test-Files in PR 1 · 60/70 % in PR 4.
