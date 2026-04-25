# Web UI Phase 1 — Foundation + 4 Screen-Quick-Wins

Erster, sauberer PR der UI-Audit-Empfehlungen aus `UI_AUDIT_WEB.md` (Benchmark: TikTok). Bewusst klein gehalten damit jede Änderung für sich reviewbar bleibt und Regressionen isoliert auffallen.

## Was drin ist

### Foundation — Design-System-Layer
- **CC-1 · Inter-Font via `next/font/google`** — self-hosted bundled, `display: swap`, Gewichte 400/500/600/700, Subsets `latin/latin-ext/cyrillic`. CSS-Var `--font-inter` mountet am `<html>`, Tailwind `fontFamily.sans` kriegt sie als ersten Eintrag vor dem bisherigen System-Font-Stack (kompletter Fallback-Path bleibt unverändert).
- **CC-2 · Shadow-Elevation-Tokens** in `tailwind.config.ts` — 4-Stufen-Skala `shadow-elevation-1/2/3/4`. Tiefe via breiter Blur + niedriger Opacity (4–14 %), nicht via pauschalem 8 %-Stempel wie Tailwind-Default-`shadow-*`. Dark-Mode greift stattdessen auf `border-border/30` für den Lift-Effekt (Shadow-Alpha auf dunklem Canvas unsichtbar).
- **CC-3 · Motion-System** — `transitionDuration.fast/base/slow/slower` (120/200/320/500 ms) + `transitionTimingFunction.out-expo` (`cubic-bezier(0.16, 1, 0.3, 1)`) — iOS/TikTok-Snap-Easing.
- **CC-4 · MobileBottomNav** — neue Komponente `components/mobile-bottom-nav.tsx`, nur `<md` sichtbar. 5-Slot-Tab-Bar (Feed/Explore/Create/Shop/Profile) mit Glas-Effekt-Header, iOS-Safe-Area-Respect, Primary-Slot `Create` als Filled-Button. Root-Layout bekommt `pb-[calc(3.5rem+env(safe-area-inset-bottom))]` unter md damit Scroll-Content nicht unter der Bar verschwindet.
- **i18n-Key `nav.profile`** in allen vier Locale-Dateien (de/en/ru/ce).

### Screen-Quick-Wins — bauen auf Foundation auf
- **A1 · Dark-Canvas-Wrapper um Feed** (`components/feed/home-feed-shell.tsx`) — Center-Column kriegt `bg-zinc-950 text-white`, auf `xl+` mit `rounded-2xl shadow-elevation-3` als „Phone-Viewport"-Illusion. Tabs adaptieren ihre Farben (`text-white`/`text-white/60`) — vorherige `text-foreground`-Tokens wären auf Dark-Canvas unsichtbar.
- **C1 · Shop Product-Card Elevation + Lift-on-Hover** (`components/shop/product-card.tsx`) — `shadow-elevation-1` ruhend, `shadow-elevation-2 + -translate-y-0.5` auf Hover (GPU-composited), `duration-base ease-out-expo`. Preis von `font-semibold` → `font-bold`. Skeleton parallel geupgradet. Grid gap 3 → 4, Cap bei `lg:grid-cols-4` (vorher `2xl:grid-cols-5` produzierte auf 2560px-Displays ~200px-Breite-Tiles wo der Blur-Fill-Aesthetic zerbröselte).
- **D1 · Messages-Liste edge-to-edge** (`app/messages/page.tsx`) — Card-Wrapper (`rounded-xl border bg-card`) raus, `divide-y divide-border/60` + `-mx-4 md:mx-0` damit die Liste auf Mobile bis an den Viewport-Rand läuft. Hover-Transition auf `duration-fast`, zusätzlich `active:bg-muted` für Touch-Feedback. WhatsApp/iMessage-Parität.
- **D4 · Profile-Tab-Bar Bold-Underline** (`components/profile/profile-tabs.tsx`) — Container `border-b-2`, aktiver Tab bekommt `::after`-Pseudo-Underline (kein Extra-Node in der A11y-Tree), Icon-Stroke wechselt `1.75 → 2.25` bei Active, Label `font-semibold` statt `font-medium`. Deutlichere visuelle Hierarchie als vorher.

### Kleiner Fix als Nebenprodukt
- `HomeFeedShellProps.initialTab` als optionales Prop eingeführt. Der bereits existierende (aber untracked) `/following/page.tsx` Route-File ruft `<HomeFeedShell initialTab="following" />` auf — ohne dieses Prop war der Typecheck dort broken. Jetzt typecheckt sauber. Default bleibt `'foryou'`, also **null Verhaltens-Change** für alle existierenden Aufrufer (Home-Feed auf `/`).

## Was NICHT drin ist
Phase-2-Items aus dem Audit (Feed-Side-Panel-Polish, Live-UI, Profile-Header-Redesign, DM-Thread-Bubbles, Settings-Two-Pane) bleiben separaten PRs vorbehalten. Dieser PR ist bewusst Foundation + minimal-invasive Screen-Touches.

## Testing-Plan
**Automated:**
- [x] `tsc --noEmit` → grün für alle Phase-1-Dateien (verbleibende 5 Errors sind pre-existing: `lib/data/__tests__/feed.test.ts` + `shared/schemas/*.ts` zod-module-not-found; keines von Phase 1 verursacht).
- [ ] `next lint` → lokal durchlaufen lassen (Sandbox-Env konnte nicht, registry-403).

**Manual — Checkliste für Reviewer:**
- [ ] **Font:** Auf Win/Linux rendert Text in Inter (nicht Segoe UI / DejaVu). Fallback greift wenn Inter blockt (Network-Throttling-Test).
- [ ] **Mobile-Bottom-Nav:** auf Viewport <768px sichtbar, desktop unsichtbar. Tab-Highlight folgt Pfad-Prefix. Create-Slot nur bei authed.
- [ ] **Feed Dark-Canvas:** Light-Theme zeigt Feed als schwarze Fläche mit hellem Video-Content. Desktop: rounded corners + Shadow. Mobile: edge-to-edge.
- [ ] **Shop-Cards:** Hover lifted sichtbar ~2px hoch, Shadow intensiviert. Preis in Bold. Max 4 Karten pro Reihe auf großen Displays.
- [ ] **Messages:** keine Card-Outline mehr, Rows edge-to-edge auf Mobile, hover-State weich.
- [ ] **Profile-Tabs:** Active-Underline deutlich dicker, Icon wird bei Active fetter.

## How to review
Am schnellsten geht es, wenn du mit der `tailwind.config.ts`-Diff startest (Design-Tokens definieren die Ästhetik aller nachfolgenden Änderungen), danach `app/layout.tsx` (Font-Wire-Up + Bottom-Nav-Mount), dann die einzelnen Screen-Touches — jede davon ist eine self-contained Änderung, Reihenfolge egal.

## Folge-Aufgaben
- [ ] UI-Phase 2 planen (siehe `UI_AUDIT_WEB.md` → A2-A7, B1-B6, C2-C7, D2-D7).
- [ ] In der Diff vom Sandbox nicht gecatchtes: `next lint` lokal und optional `next build` als Smoke-Test.
