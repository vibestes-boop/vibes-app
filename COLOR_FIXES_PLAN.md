# COLOR_FIXES_PLAN.md — Systematische Farbpaletten-Bereinigung

## Gefundene Probleme

| ID | Problem | Dateien betroffen | Priorität |
|---|---|---|---|
| C-01 | `#F43F5E` (Rose/WOZ) ist kein Token — überall hardcoded | 8 Dateien | 🔴 HOCH |
| C-02 | `#8b5cf6` vs `#A855F7` — zwei verschiedene Lila-Töne in Live | host.tsx, replay/[id].tsx | 🔴 HOCH |
| C-03 | `lib/theme.ts` = Kopie von `shared/theme/colors.ts` — stilles Drift-Risiko | beide Dateien | 🔴 HOCH |
| C-04 | Hardcoded `#A855F7` / `rgba(168,85,247,x)` in app-Dateien — kein Token | index.tsx, settings.tsx, camera.tsx | 🟡 MITTEL |
| C-05 | Web: `text-slate-600` statt `text-muted-foreground` | landing-page.tsx, mobile-bottom-nav.tsx | 🟡 MITTEL |
| C-06 | Web Live: `#FF2D6D` / `#00D4FF` Battle-Farben ohne CSS-Variablen | live-battle-bar.tsx, live-gift-picker.tsx, live-cohost-queue.tsx | 🟡 MITTEL |
| C-07 | Web Live: Hardcoded Gradient-Hex in live-host-deck.tsx | live-host-deck.tsx | 🟢 NIEDRIG |

---

## Ausführungsplan

### Phase 1 — Token-System erweitern
- [x] C-01a: `accent.rose` zu `shared/theme/colors.ts` hinzufügen (`#F43F5E` / `#E11D48`)
- [x] C-01b: `accent.rose` zu `lib/theme.ts` spiegeln
- [x] C-02: `LC.accent.purple` auf `#A855F7` normalisieren (war `#8b5cf6`)
- [x] C-03: `lib/theme.ts` → Re-Export aus `shared/theme/colors.ts` (Duplikation eliminieren)
- [x] C-06a: Battle-Farben als CSS-Variablen in `globals.css`

### Phase 2 — Native App: Hardcoded → Tokens
- [x] C-01c: `#F43F5E` in explore.tsx, settings.tsx, live/start.tsx → `colors.accent.rose`
- [x] C-01d: `#F43F5E` in live/watch/[id].tsx, live/host.tsx → `LC.accent.rose`
- [x] C-01e: `#F43F5E` in women-only/index.tsx, edit-post/[id].tsx, guild-post/[id].tsx → tokens
- [x] C-02b: `#8b5cf6` in live/replay/[id].tsx, live/host.tsx → `LC.accent.purple`
- [x] C-04: `#A855F7` in index.tsx, settings.tsx → `colors.accent.secondary`

### Phase 3 — Web: Hardcoded → Tokens
- [x] C-05: `text-slate-600` → `text-muted-foreground` in landing-page.tsx, mobile-bottom-nav.tsx
- [x] C-06b: Battle-Farben in live-gift-picker.tsx, live-cohost-queue.tsx, live-battle-bar.tsx → CSS vars
- [x] C-07: Hardcoded Gradient in live-host-deck.tsx → CSS vars

---

## Token-Definitionen

```typescript
// NEU in shared/theme/colors.ts + lib/theme.ts:
accent: {
  ...
  rose: string;  // WOZ / Women-Only-Zone / Liked-Heart Brand-Farbe
}

// Dark:  '#F43F5E'  (Rose-500 — leuchtstark auf dunklem BG)
// Light: '#E11D48'  (Rose-600 — etwas dunkler für Kontrast auf weiß)

// LC.accent.rose: '#F43F5E'  (Live-Screens immer Dark)
// LC.accent.purple: '#A855F7'  (normalisiert von #8b5cf6)
```

```css
/* NEU in globals.css */
--battle-host:   351 100% 59%;   /* #FF2D6D — Battle Team Host */
--battle-guest:  190 100% 42%;   /* #00D4FF — Battle Team Guest */
```
