# 🧠 Senior Developer Knowledge Base — AI Design & Development Skills

> Vollständig extrahiert aus den SKILL.md-Rohdateien der 4 Quellen
> Quellen: impeccable.style · ui-ux-pro-max-skill (54.2k⭐) · superpowers (123k⭐) · ibelick/ui-skills (1.1k⭐)
> Letzte Aktualisierung: 2026-03-30

---

## 📐 TEIL 1: BASELINE-UI REGELN (ibelick/ui-skills — SKILL.md)

> Verhindert "AI-generated interface slop" — generische, seelenlose UI

### Stack-Pflichten
```
✅ Tailwind CSS defaults (keine willkürlichen Werte)
✅ motion/react (framer-motion) für JS-Animationen
✅ tw-animate-css für entrance/micro-animationen
✅ cn() Utility (clsx + tailwind-merge) für class logic
✅ Accessible Primitives: Base UI / React Aria / Radix
✅ MUSS aria-label auf icon-only buttons setzen
```

### Interaction-Regeln (EXAKT)
```
✅ AlertDialog für destructive/irreversible Aktionen
✅ Structural Skeletons für Loading States (KEIN Spinner)
✅ h-dvh statt h-screen (NIEMALS h-screen!)
✅ safe-area-inset für fixed Elemente
✅ Fehler neben der Aktion anzeigen (nicht oben/unten)
❌ NIEMALS paste in input/textarea blockieren
❌ NIEMALS Keyboard/Focus-Verhalten selbst bauen
```

### Animation-Regeln (EXAKT — aus SKILL.md)
```
❌ NIEMALS Animation hinzufügen wenn nicht explizit angefordert
✅ NUR compositor props animieren: transform, opacity
❌ NIEMALS layout properties animieren: width, height, top, left, margin, padding
❌ NIEMALS paint properties animieren: background, color (außer kleine lokale UI)
✅ ease-out auf entrance (Standard)
❌ NIEMALS > 200ms für interaction feedback
✅ Looping animations pausieren wenn off-screen
✅ prefers-reduced-motion respektieren
❌ NIEMALS custom easing curves ohne explizite Anforderung
❌ NIEMALS große Bilder oder full-screen surfaces animieren
```

### Typography-Regeln (EXAKT)
```
✅ text-balance für Headings
✅ text-pretty für Body/Paragraphs
✅ tabular-nums für Daten/Zahlen
✅ truncate oder line-clamp für dense UI
❌ NIEMALS letter-spacing (tracking-*) ändern ohne Anforderung
```

### Layout-Regeln
```
✅ Fester z-index Scale (KEINE willkürlichen z-*-Werte)
✅ size-* für Quadrate statt w-* + h-* getrennt
```

### Performance-Regeln
```
❌ NIEMALS große blur() oder backdrop-filter Flächen animieren
❌ NIEMALS will-change außerhalb einer aktiven Animation
❌ NIEMALS useEffect für Logik die als render logic ausgedrückt werden kann
```

### Design-Regeln (EXAKT)
```
❌ NIEMALS Gradients ohne explizite Anforderung
❌ NIEMALS lila oder multicolor Gradients
❌ NIEMALS Glow-Effekte als primäre Affordances
✅ Tailwind CSS Default Shadow Scale
✅ Empty States: EIN klarer next action
✅ Max. EINE Akzentfarbe pro View
✅ Bestehende Theme/Color Tokens nutzen bevor neue eingeführt werden
```

---

## 🎬 TEIL 2: MOTION PERFORMANCE REGELN (ibelick — SKILL.md)

### Rendering-Pipeline (NIEMALS VERGESSEN)
```
COMPOSITE  → transform, opacity                (GPU — kostenlos)
PAINT      → color, borders, gradients, masks  (teuer)
LAYOUT     → size, position, flow, grid, flex  (sehr teuer)
```

### Never Patterns (KRITISCH)
```
❌ Layout reads und writes im selben Frame interleaven
❌ Layout-Properties auf großen Flächen kontinuierlich animieren
❌ Animation von scrollTop, scrollY, scroll events antreiben
❌ requestAnimationFrame loops ohne stop condition
❌ Mehrere Animation-Systeme mischen die beide Layout messen/mutieren
```

### Scroll-Animation Regeln
```
✅ Scroll/View Timelines für scroll-linked motion
✅ IntersectionObserver für visibility und pausing
❌ NIEMALS scroll position pollen für Animation
✅ Animationen pausieren wenn off-screen
```

### Blur & Filter Regeln
```
✅ Blur max. ≤ 8px
✅ Blur nur für kurze one-time effects
❌ NIEMALS Blur kontinuierlich animieren
❌ NIEMALS Blur auf großen Flächen animieren
✅ Opacity und Translate ZUERST nutzen, dann Blur als letztes Resort
```

### Common Fixes (Code)
```css
/* ❌ FALSCH: layout property animieren */
.panel { transition: width 0.3s; }

/* ✅ RICHTIG: transform animieren */
.panel { transition: transform 0.3s; }

/* ❌ FALSCH: JS scroll event */
window.addEventListener('scroll', () => el.style.opacity = scrollY / 500)

/* ✅ RICHTIG: CSS scroll-timeline */
.reveal { animation: fade-in linear; animation-timeline: view(); }
```

```js
// ❌ FALSCH: layout thrash
el.style.left = el.getBoundingClientRect().left + 10 + 'px';

// ✅ RICHTIG: FLIP-Technik (measure once, animate via transform)
const first = el.getBoundingClientRect();
el.classList.add('moved');
const last = el.getBoundingClientRect();
el.style.transform = `translateX(${first.left - last.left}px)`;
requestAnimationFrame(() => {
  el.style.transition = 'transform 0.3s';
  el.style.transform = '';
});
```

---

## ♿ TEIL 3: ACCESSIBILITY REGELN (ibelick — SKILL.md)

### Priority-Matrix
| Prio | Kategorie | Impact |
|------|-----------|--------|
| 1 | Accessible Names | Kritisch |
| 2 | Keyboard Access | Kritisch |
| 3 | Focus & Dialogs | Kritisch |
| 4 | Semantics | Hoch |
| 5 | Forms & Errors | Hoch |
| 6 | Announcements | Mittel-Hoch |
| 7 | Kontrast & States | Mittel |
| 8 | Media & Motion | Niedrig-Mittel |

### Kritische Regeln (EXAKT)
```
✅ JEDES interaktive Element MUSS accessible name haben
✅ Icon-only buttons: aria-label oder aria-labelledby PFLICHT
✅ Decorative icons: aria-hidden="true"
✅ Links: meaning text (KEIN "click here")
✅ ALLE Tab-erreichbaren Elemente fokussierbar
✅ Focus muss SICHTBAR sein
❌ NIEMALS tabindex > 0
✅ Escape schließt Dialoge/Overlays
✅ Modals: Focus-Trapping während offen
✅ Dialog schließen: Focus zurück zum Trigger
✅ Initiales Focus INNERHALB des Dialogs setzen
✅ Heading-Level NICHT überspringen
✅ Errors: aria-describedby + aria-invalid="true"
✅ Loading: aria-busy oder status text
✅ Expandable controls: aria-expanded + aria-controls
```

### Common Fixes (Code)
```html
<!-- ❌ FALSCH: icon-only button ohne label -->
<button><svg>...</svg></button>

<!-- ✅ RICHTIG: mit aria-label -->
<button aria-label="Schließen"><svg aria-hidden="true">...</svg></button>

<!-- ❌ FALSCH: div als button -->
<div onclick="save()">Speichern</div>

<!-- ✅ RICHTIG: natives Element -->
<button onclick="save()">Speichern</button>

<!-- ❌ FALSCH: error ohne Verknüpfung -->
<input id="email" /> <span>Ungültige Email</span>

<!-- ✅ RICHTIG: mit aria-describedby -->
<input id="email" aria-describedby="email-err" aria-invalid="true" />
<span id="email-err">Ungültige Email</span>
```

---

## 🧪 TEIL 4: TEST-DRIVEN DEVELOPMENT (obra/superpowers — SKILL.md)

### Das Eiserne Gesetz
```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST

Code vor dem Test geschrieben? → LÖSCHEN. Neu anfangen.
Kein "als Referenz behalten", kein "adaptieren"
DELETE = LÖSCHEN (wirklich)
```

### Red-Green-Refactor Zyklus (EXAKT)
```
1. RED    → Schreibe EINEN failing Test (ein Verhalten, klarer Name)
2. VERIFY → Sieh wie der Test FAILLT (PFLICHT — niemals überspringen!)
3. GREEN  → Schreibe MINIMALEN Code um Test zu bestehen (KEIN Feature-Creep)
4. VERIFY → Sieh wie der Test PASST (und alle anderen auch!)
5. REFACTOR → Säubern (Duplikate, Namen, Helpers)
6. COMMIT → Commit nach jedem Zyklus
```

### Guter vs. Schlechter Test (Beispiel)
```typescript
// ✅ GUT: Klar, testet echtes Verhalten
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  const result = await retryOperation(operation);
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});

// ❌ SCHLECHT: Vager Name, testet Mock nicht Code
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```

### Guter vs. Schlechter Code
```typescript
// ✅ MINIMAL — Just enough to pass
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try { return await fn(); }
    catch (e) { if (i === 2) throw e; }
  }
  throw new Error('unreachable');
}

// ❌ OVER-ENGINEERED — YAGNI verletzt
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: { maxRetries?: number; backoff?: 'linear' | 'exponential'; onRetry?: (attempt: number) => void; }
): Promise<T> { /* YAGNI */ }
```

### TDD Anti-Rationalizations (ALLE FALSCH)
| Ausrede | Wahrheit |
|---------|---------|
| "Zu simpel zum Testen" | Einfacher Code bricht auch. Test = 30 Sek. |
| "Ich teste danach" | Tests die sofort passen beweisen nichts |
| "Danach gleicht sich das aus" | Tests-danach: "Was tut es?" Tests-erst: "Was SOLL es tun?" |
| "Schon manuell getestet" | Ad-hoc ≠ systematisch. Keine Wiederholung möglich |
| "X Stunden löschen ist Verschwendung" | Sunk-Cost-Fallacy. Ungetesteter Code = technische Schulden |
| "TDD ist dogmatisch" | TDD ist pragmatisch: findet Bugs VOR dem Commit |

### Verification Checklist (vor "fertig" sagen)
```
[ ] Jede neue Funktion hat einen Test
[ ] Jeden Test FAILEN gesehen bevor implementiert
[ ] Test failed aus dem richtigen Grund (Feature fehlt, nicht Tippfehler)
[ ] Minimalen Code geschrieben
[ ] Alle Tests grün
[ ] Output sauber (keine Errors, keine Warnings)
[ ] Echten Code getestet (Mocks nur wenn unvermeidbar)
[ ] Edge cases und Fehler abgedeckt
```

---

## 📋 TEIL 5: IMPLEMENTATION PLANNING (obra/superpowers — SKILL.md)

### Wann anwenden
**Vor jeder Code-Änderung bei multi-step Tasks**

### Plan-Dokument Pflicht-Header
```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** [Ein Satz was gebaut wird]
**Architecture:** [2-3 Sätze zum Ansatz]
**Tech Stack:** [Key Technologies]
---
```

### Task-Granularität (2-5 Minuten pro Step)
```
Task N: [Component Name]

Files:
- Create: exact/path/to/file.ts
- Modify: exact/path/to/existing.ts:123-145
- Test:   tests/exact/path/test.ts

- [ ] Step 1: Write failing test [mit echtem Code]
- [ ] Step 2: Run test → verify it fails
- [ ] Step 3: Write minimal implementation [mit echtem Code]
- [ ] Step 4: Run test → verify it passes
- [ ] Step 5: Commit
```

### NIEMALS in einem Plan
```
❌ "TBD", "TODO", "implement later"
❌ "Add appropriate error handling" (ohne Code)
❌ "Write tests for the above" (ohne echten Test-Code)
❌ "Similar to Task N" (Code IMMER wiederholen — nicht auf andere Tasks verweisen)
❌ Steps die BESCHREIBEN ohne ZU ZEIGEN wie (Code-Blöcke Pflicht!)
```

### Self-Review vor Plan-Abgabe
```
1. Spec Coverage: Jede Anforderung → welcher Task implementiert sie?
2. Placeholder Scan: Keine TBDs, TODOs, vagen Requirements
3. Type Consistency: Funktionsname in Task 3 = Funktionsname in Task 7?
```

---

## 🧠 TEIL 6: BRAINSTORMING WORKFLOW (obra/superpowers — SKILL.md)

### HARD-GATE (NIEMALS verletzen)
```
KEIN Code, KEIN Scaffold, KEINE Implementation bevor:
1. Design präsentiert wurde
2. User hat es genehmigt

GILT FÜR JEDES PROJEKT — auch Todo-Listen, Single-Functions, Config-Changes
```

### Pflicht-Checkliste
```
1. Projekt-Kontext prüfen (Dateien, Docs, Recent Commits)
2. Klärungsfragen stellen — EINE nach der anderen, NIEMALS mehrere gleichzeitig
3. Multiple-Choice-Fragen bevorzugen
4. 2-3 Ansätze mit Trade-offs vorschlagen
5. Design in Sections präsentieren → nach jeder Section User-OK einholen
6. Design-Dokument schreiben → docs/superpowers/specs/YYYY-MM-DD-topic-design.md
7. Spec Self-Review (Placeholders, Widersprüche, Scope)
8. User reviewed Spec
9. → writing-plans skill aufrufen
```

### Design-Isolation Prinzip
```
Jede Unit muss beantworten können:
- Was tut sie?
- Wie benutze ich sie?
- Wovon hängt sie ab?

Kann jemand verstehen was sie tut ohne den Code zu lesen? → Gute Unit
Kann man die Internals ändern ohne Consumers zu brechen? → Gute Unit
```

### Schlüsselprinzipien
```
✅ Eine Frage nach der anderen
✅ Multiple Choice bevorzugen
✅ YAGNI rücksichtslos anwenden
✅ 2-3 Alternativen immer vorschlagen
✅ Inkrementelle Validierung
```

---

## 🎨 TEIL 7: UI/UX PRO MAX SYSTEM (54.2k⭐ — README destilliert)

### Design-System Generator (automatisch)
```
1. USER ANFRAGE → "Build a landing page for my beauty spa"
2. 5 PARALLELE SUCHEN:
   - Product type matching (161 categories)
   - Style recommendations (67 styles)
   - Color palette (161 palettes)
   - Landing page patterns (24 patterns)
   - Typography pairing (57 font combinations)
3. REASONING ENGINE → anti-patterns filtern
4. COMPLETE DESIGN SYSTEM OUTPUT:
   Pattern + Style + Colors + Typography + Effects
   + Anti-Patterns to avoid + Pre-Delivery Checklist
```

### Industry-Spezifische Regeln (161 Kategorien — wichtigste)

#### Social Media (Vibes App)
```
Pattern:       Story-Centric / Feed-First
Style:         Dark Mode + Glassmorphism + Motion
Colors:        Vibrant, High-Energy (KEINE Corporate Blue)
Typography:    Bold sans-serif (Inter Bold, Outfit, Sora)
Effects:       Fast micro-animations (150-250ms), Spring physics
Anti-Patterns: Weiße Hintergründe, Corporate Farben, Text-heavy layouts
```

#### Wellness/Beauty Spa
```
Colors:    Primary #E8B4B8 (Soft Pink) / Secondary #A8D5BA (Sage Green)
CTA:       #D4AF37 (Gold)
BG:        #FFF5F5 (Warm White)
Text:      #2D3436 (Charcoal)
Font:      Cormorant Garamond / Montserrat
Anti:      Dark Mode, Neon Colors, Harsh Animations, AI purple/pink gradients
```

#### Fintech/Banking
```
Style:     Trust-focused, Dark Elegant
Colors:    Deep Navy + Accent Gold
Anti:      Bright neon, Complex animations, Playful typography
```

### 67 UI-Stile (wichtigste mit Beschreibung)
| Stil | Beschreibung | Ideal für |
|------|-------------|-----------|
| Glassmorphism | Frosted glass, blur, transparency | Social, MediaTech |
| Dark Mode | Dark surfaces, glowing accents | Apps, Gaming, Tech |
| Soft UI/Neumorphism | Extruded, soft shadows | Wellness, Productivity |
| Minimalism | Whitespace-first, no decoration | SaaS, Editorial |
| Brutalism | Raw, bold typography, contrast | Portfolio, Art |
| Claymorphism | Puffy, rounded, colorful | Kids, Casual |
| Bento Grid | Card-based modular layout | Dashboard, Portfolio |
| AI-Native UI | Gradient mesh, ambient light effects | AI products |

### Pre-Delivery Checklist (PFLICHT vor Übergabe)
```
[ ] Keine Emojis als Icons (SVG: Heroicons/Lucide)
[ ] cursor-pointer auf ALLEN klickbaren Elementen
[ ] Hover States mit smooth transitions (150-300ms)
[ ] Light mode: Text-Kontrast min. 4.5:1
[ ] Focus States sichtbar für Keyboard-Navigation
[ ] prefers-reduced-motion respektiert
[ ] Responsive: 375px / 768px / 1024px / 1440px
[ ] Keine generischen Farben — kuratierte Paletten
[ ] Typographie-Scale konsistent
[ ] Empty States haben einen klaren next action
```

---

## 📝 TEIL 8: TYPOGRAPHY SYSTEM (57 Pairings)

### Fixed Scale für App UIs (NICHT fluid)
```
Display:  32–48px  700 weight  (Hero-Bereiche)
H1:       24–32px  700 weight
H2:       20–24px  600 weight
H3:       16–18px  600 weight
Body:     14–16px  400 weight  (MINIMUM 14px!)
Small:    12px     400 weight
Micro:    10–11px  500 weight  (Badges, Labels only)
```

### Kuratierte Font Pairings (Top 10)
| Mood | Heading Font | Body Font | Google Import |
|------|-------------|-----------|--------------|
| Modern/Tech | Inter | Inter | fonts.google.com |
| Startup/Energy | Sora | DM Sans | fonts.google.com |
| Premium/Dark | Clash Display | General Sans | fontshare.com |
| Elegant/Luxury | Cormorant Garamond | Montserrat | fonts.google.com |
| Minimal/Clean | Plus Jakarta Sans | Plus Jakarta Sans | fonts.google.com |
| Bold/Impact | Space Grotesk | Inter | fonts.google.com |
| Editorial | Fraunces | Libre Franklin | fonts.google.com |
| Friendly | Nunito | Open Sans | fonts.google.com |
| Corporate | Source Serif 4 | Source Sans 3 | fonts.google.com |
| Futuristic | Oxanium | IBM Plex Mono | fonts.google.com |

---

## 🔑 TEIL 9: KERNPRINZIPIEN (Gilt für ALLE Code)

### Die 5 Philosophien (aus obra/superpowers)
```
1. YAGNI          — You Aren't Gonna Need It (nicht über-engineeren)
2. DRY            — Don't Repeat Yourself
3. TDD            — Test First, immer
4. Evidence First — Verify before declaring success
5. Simplicity     — Komplexität ist der Feind
```

### Was State-of-the-Art aussieht (2026)
```
✅ Dark Mode + Glassmorphism mit echter Tiefe
✅ Micro-Animations (125–200ms, spring-physics)
✅ Skeleton Loaders statt Spinners
✅ Optimistische UI (Mutation vor Server-Response anzeigen)
✅ Haptic Feedback auf Mobile (KRITISCH für Premium-Feel)
✅ Smooth scroll + momentum-based physics
✅ High-contrast text auf dark backgrounds
✅ Nur SVG Icons (Lucide, Heroicons, Phosphor)
✅ Consistent spacing tokens (4/8/12/16/24/32/48px)
```

### Was NIEMALS gebaut werden darf
```
❌ Emojis als Icons
❌ Plain red/blue/green — nur kuratierte Paletten
❌ Generische AI-purple/pink Gradients
❌ Lorem Ipsum in fertigen Designs
❌ h-screen (stattdessen h-dvh)
❌ Tabindex > 0
❌ Animation von layout properties
❌ Blur > 8px animieren
❌ Kein focus-visible replacement nach outline: none
❌ Hover-only interactions ohne Keyboard-Equivalent
```

---

## 📚 Vollständige Quellen-Übersicht

| Quelle | Stars | Gelesen | Kerninhalt |
|--------|-------|---------|-----------|
| [impeccable.style](https://impeccable.style) | 13.3k⭐ | README + Cheatsheet | 20 Design-Commands Framework |
| [ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) | 54.2k⭐ | README + Design System | 161 industry rules, 67 styles, 57 fonts |
| [superpowers](https://github.com/obra/superpowers) | 123k⭐ | SKILL.md: brainstorming, writing-plans, TDD | Kompletter Entwicklungs-Workflow |
| [ibelick/ui-skills](https://github.com/ibelick/ui-skills) | 1.1k⭐ | SKILL.md: baseline-ui, accessibility, motion-performance | Präzise Code-Level Regeln |

**Fehlend / Nicht öffentlich zugänglich:**
- `nextlevelbuilder` SKILL.md (404 — nur als CLI-Tool verfügbar)
- `impeccable` SKILL.md (hinter npx skills install)
- `superpowers` übrige Skills: systematic-debugging, subagent-driven-development, code-review
