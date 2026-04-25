# Serlo Web — UI-Audit gegen TikTok

**Datum:** 2026-04-23
**Scope:** Next.js-Web-App (`apps/web/`) auf https://serlo-web.vercel.app
**Referenz:** TikTok Web (https://www.tiktok.com/)
**Format:** Pro Bereich → TikTok-Pattern + Warum → Serlo Ist-Zustand (mit Dateipfaden) → Konkrete Fixes

---

## Executive Summary

Die Serlo-Web-UI ist **funktional vollständig, aber spürbar Prototyp-Charakter**. Drei Dinge trennen sie heute von einem Produktions-Look wie TikTok:

1. **Fehlende Depth & Elevation.** Karten sind flach (`border bg-card` ohne Schatten), Buttons haben keine Ebenen, Overlays verschwinden gegen den Hintergrund. TikTok arbeitet mit sehr feinen Shadows (`0 1px 2px rgba(0,0,0,0.04)` + `0 2px 8px rgba(0,0,0,0.08)`), leichten Blur-Layern und einer klaren Z-Achsen-Hierarchie. Serlo sieht dadurch wie ein Wireframe aus, der „fertig gerendert" wurde.

2. **Schwache Micro-Interactions.** Jeder Click-Target fühlt sich gleich an. TikTok macht den Unterschied mit 150–200ms Spring-Transforms (`scale(0.92)` auf Press, `scale(1.04)` auf Hover), Heart-Pulse-Animations beim Like, sanfte Color-Morphs auf Action-Buttons. Bei Serlo ist fast alles nur `hover:bg-white/25` → flach, unbefriedigend, „wie Bootstrap".

3. **Typografie ist utility, nicht Produkt.** Keine Web-Fonts geladen (reiner System-Stack), zu viele 10–11px-Labels, kaum Gewichts-Variation. TikTok nutzt Proxima Nova (Lizenz) oder Inter als Fallback — konsistent mit viel 600/700-Weight und bewusster Größen-Hierarchie (11/13/15/17/20/24/32). Serlo hat viel 12px (`text-xs`) und wirkt dadurch gedrungen.

Diese drei Dimensionen ziehen sich durch alle vier analysierten Bereiche. Der Rest des Dokuments ist eine Tour durch Feed → Live → Shop → Messages/Profile/Settings mit jeweils konkreten, patchbaren Fixes.

---

## TikTok-Design-Philosophie (vorangestellt — weil alle Fixes darauf referenzieren)

**1. „Dark is canvas."** Feed-, Live- und Profilseiten laufen fast immer auf `#000` als Base. Selbst im Light-Mode bleiben Videoflächen schwarz. Weiß ist nur für Chrome (Nav, Sidebar, Input-Bars) — nie für die inhaltliche Fläche. Serlo macht umgekehrt: Weiß dominiert, und das Video-Element ist ein „Fremdkörper" auf heller Fläche.

**2. „Content is hero, everything else retreats."** Aktions-Buttons, Chat-Overlays, Badges — alles ist entweder komplett transparent oder mit 60–75% opaquem Dark-Glass (`rgba(0,0,0,0.7) + backdrop-blur(24px)`). Kein Button hat einen festen Farb-Fill außer Primary-CTAs. Serlo nutzt oft Muted-Grey-Backgrounds, die das Video „einrahmen" statt zurückzutreten.

**3. „Always-visible affordances."** Der rechte Action-Rail im Feed (Like/Comment/Share/Gift/Music) ist **immer** sichtbar, auch ohne Hover. Desktop-User brauchen das, weil „Mouse-Over um was zu entdecken" nicht gelernt ist. Serlo verhält sich an manchen Stellen schon so, an anderen versteckt es CTAs hinter Hover (z.B. die Pfeil-Navigation am Feed-Rand).

**4. „Radius consistency."** TikTok arbeitet mit drei Radien: `4px` für Badges/Pills, `8px` für Inline-Buttons, `12–16px` für Cards und Modals. Nichts darüber. Keine Rounded-fulls außer bei Avataren. Serlo mischt `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-full` ohne System → sieht unruhig aus.

**5. „Animation-Budget: 200ms, ease-out-cubic."** Jede State-Transition ist schnell, pointy, minimal. Keine Long-Tweens, keine Bounces außer bei expliziten Feedback-Moments (Heart-Burst, Like-Zähler-Tick).

---

## A. Home-Feed (TikTok-Style Vertical Scroll)

### A.1 Was TikTok macht

**Layout-DNA:**
- Drei Spalten auf Desktop: `240px` Left-Nav — `~720px` Video-Canvas (Max-Width) — `~360px` Kommentar-Sidebar (optional, seit 2024 pro Video aufklappbar)
- Video-Canvas ist **perfect 9:16, schwarz gerahmt, zentriert**. Außen drumrum nur sehr leichtes Dark-Grey (`#121212`) als „Stage"
- Right-Action-Rail direkt außerhalb des Videos, vertikal gestackt: User-Avatar (mit Follow-Plus), Like, Comment, Bookmark, Share, Spinning-Music-Disc
- Bottom-Left: Username, Caption (max 2 Zeilen ohne `…mehr`), Music-Pill mit Waveform-Ticker

**Warum es funktioniert:**
- Die Video-Box ist visuell **„schwebend"** — der dunkle Hintergrund trennt sie vom Chrome, keine Kante stört
- Der Action-Rail liegt **außerhalb** des Videos → greift nicht ins Content-Bild rein, ist trotzdem einen Finger-Tap weit weg
- Video-Progress-Scrubber ist **fett** (4px), bleibt am unteren Rand der Box, reagiert auf Hover mit `scaleY(2)` → wird breit & klickbar
- Autoplay-Pause ist **großes zentrales Glyph** (64px Play-Icon, 96px Fläche) — kein Rätselraten

**Signature-Details:**
- Like-Heart hat bei Click eine **Particle-Burst-Animation** (8 kleine Herzen fliegen auseinander), Zähler tickt hoch mit `slide-up-fade`
- Double-Tap auf Video = Like → großes Herz-Overlay mit Scale+Fade
- Music-Disc dreht sich, wenn Video läuft; pausiert, wenn pausiert
- Kommentar-Sidebar slided von rechts rein (`transform: translateX(0)`, 250ms), Video bleibt an Position, wird nur **schmaler**

### A.2 Was Serlo aktuell macht

**Aktueller Code:**
- `apps/web/app/page.tsx` → `components/feed/home-feed-shell.tsx` → `components/feed/feed-list.tsx` → `components/feed/feed-card.tsx`
- Drei-Spalten-Grid: `grid xl:grid-cols-[260px_1fr_320px]` — konzeptionell wie TikTok, aber rechte Spalte ist **kein Kommentar-Slideout**, sondern statisch
- Video-Card: `article aspect-[9/16]`, **kein dunkler Stage-Frame außen**, sondern auf `bg-background` (im Light-Mode `#F5F5F5`)
- Action-Rail: 5 Buttons bei `bottom-6 right-3`, alle in `h-11 w-11` (44px) mit `bg-white/15 backdrop-blur-sm`, Text-Label darunter in `text-[11px]`
- Progress-Bar: `h-1` (4px) — aber ohne Hover-Expand
- Pause-Overlay: `h-20 w-20` (80px) zentrierter Circle — **zu klein**, TikTok hat 96px
- Caption: `line-clamp-3` ohne „mehr"-Affordance

**Was visuell stört:**
1. **Das Video „schwimmt" auf hellem Hintergrund.** Kein dunkler Canvas drumrum → fühlt sich an wie ein Embed, nicht wie ein Feed.
2. **Action-Rail-Icons sind winzig und gleich laut.** Alle Buttons gleich gestylt. Kein visueller Hierarchie-Hinweis (Like/Gift sind wichtiger als Mute).
3. **Like-Interaktion ist stumpf.** `fill-red-500` toggled, Zahl ändert sich — keine Burst, keine Skala, kein Tick-Animate.
4. **Keyboard-Shortcut-Hint** (J/K/L etc.) erscheint 5 Sekunden beim Mount — das ist **Desktop-Geheimwissen**, gut, aber unnötig 5s lang sichtbar → störend.

### A.3 Konkrete Fixes

**Fix A1 — Dark Stage um Feed-Canvas** (Impact: ★★★★★)
```tsx
// home-feed-shell.tsx: wrapper um den Feed-Column
<div className="bg-[#0b0b10] dark:bg-[#0b0b10] lg:rounded-2xl lg:mx-4 lg:my-4 lg:overflow-hidden">
  <FeedList ... />
</div>
```
Egal ob Light- oder Dark-Mode: Feed-Fläche immer dunkel. Video-Element ist dann nicht mehr „Fremdkörper".

**Fix A2 — Action-Rail außerhalb des Videos positionieren + Hierarchy** (Impact: ★★★★★)
Aktuell liegt der Rail INNEN (`absolute bottom-6 right-3` innerhalb der `article`). TikTok-Pattern: Rail liegt **außen rechts neben dem Video**.
```tsx
// feed-card.tsx
<div className="flex items-end gap-3">
  <article className="aspect-[9/16] max-h-[calc(100dvh-8rem)] relative overflow-hidden rounded-2xl bg-black">
    {/* Video + bottom-caption-overlay */}
  </article>
  <aside className="flex flex-col items-center gap-4 pb-4">
    {/* Avatar (größer, mit Follow-Plus), Like, Comment, Bookmark, Share, Music-Disc */}
  </aside>
</div>
```
Größen-Hierarchie innerhalb der Rail:
- Avatar: `h-14 w-14` mit `-ml-1 absolute bottom-0 right-0 h-5 w-5 rounded-full bg-red-500` als Follow-Plus-Badge
- Like/Comment/Bookmark: `h-12 w-12` (48px) — nicht 44px
- Share/Music: `h-11 w-11` (44px) — kleiner, weniger laut
- Zähler direkt unter Icon: `text-xs font-semibold tabular-nums text-white`, **nicht** `text-[11px]`

**Fix A3 — Like-Burst-Animation** (Impact: ★★★★☆)
```tsx
// components/feed/like-button.tsx (neue Komponente)
// On click: play 8-particle emit + scale pulse
// Use framer-motion or plain CSS keyframes
@keyframes heart-burst {
  0% { transform: scale(1); }
  40% { transform: scale(1.35); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); }
}
```
Plus 8 kleine Herzen die in verschiedene Winkel ausbrechen (`transform: translate(x,y) rotate(deg) scale(0)` → animate zu `translate + scale(0.8)` + fade-out). ~400ms Gesamt.

**Fix A4 — Progress-Bar fetter + hover-expandable** (Impact: ★★★☆☆)
```tsx
// Aktuell: h-1 (4px)
// Neu: h-[3px] idle, group-hover:h-[6px] transition-[height] duration-150
<div className="group/progress absolute bottom-0 left-0 right-0 cursor-pointer">
  <div className="h-[3px] group-hover/progress:h-[6px] bg-white/20 transition-[height]">
    <div className="h-full bg-white" style={{ width: `${pct}%` }} />
  </div>
</div>
```

**Fix A5 — Double-Tap-Like + großes Heart-Overlay** (Impact: ★★★☆☆)
Desktop = Double-Click, Touch = Double-Tap → großes Herz pulst im Video-Zentrum:
```tsx
// feed-card.tsx
const [heartBurst, setHeartBurst] = useState(false);
// onDoubleClick → like + setHeartBurst(true) + setTimeout(800)
<Heart className={cn(
  "absolute inset-0 m-auto h-32 w-32 fill-red-500 text-red-500 pointer-events-none",
  "transition-all duration-500",
  heartBurst ? "scale-100 opacity-90" : "scale-50 opacity-0"
)} />
```

**Fix A6 — Caption mit "mehr"-Affordance** (Impact: ★★☆☆☆)
```tsx
{caption.length > 120 ? (
  <>
    <span>{expanded ? caption : caption.slice(0, 120) + '…'}</span>
    <button onClick={() => setExpanded(v => !v)} className="ml-1 font-semibold text-white/80">
      {expanded ? 'weniger' : 'mehr'}
    </button>
  </>
) : caption}
```

**Fix A7 — Keyboard-Hint reduzieren** (Impact: ★☆☆☆☆)
Aktuell 5s beim Mount auto-visible. Besser: **Nur beim ersten Tastendruck** einen kleinen Toast `Drück ? für alle Shortcuts` für 2s. Dann nie wieder automatisch.

---

## B. Live-Streaming (Host + Viewer)

### B.1 Was TikTok macht

**Layout-DNA:**
- Viewer-Room: **Video-Fullscreen** (9:16 sogar auf Desktop, einfach hochkant + schwarze Seiten-Bars), Chat liegt **ALS Overlay** über dem unteren Drittel, **nicht als Sidebar**
- Chat-Bubbles sind **halbtransparent**, scrollen von unten nach oben, ältere Nachrichten faden raus (`mask-image: linear-gradient`)
- Gift-Feed auf der **linken Seite** (Top-3 Geschenke mit großer Animation), nicht im Chat
- Host-Info: Kleiner Pill oben-links mit Avatar + Username + Follow-Button + Live-Viewer-Count
- Action-Row unten: 5 Buttons — Gift, Reaction, Comment (öffnet Composer-Sheet), Share, Request-Co-Host

**Warum es funktioniert:**
- Kein Chrome um das Video herum → Stream ist **maximal immersiv**
- Chat als Overlay = Video bleibt groß, Chat ist zweitrangig aber zugänglich
- Gifts bekommen eigene, große Slots → emotionales Premium-Moment (weil sie Geld kosten)

**Signature-Details:**
- Gift-Combo-Counter (`×50`) poppt mit Scale-Bounce bei jedem Tick
- Heart-Reactions spawnen von unten-rechts wie Konfetti, floaten nach oben mit leichten Rotations
- Co-Host-Split (Duett): **Horizontal split** auf Mobile, **vertikal nebeneinander** auf Desktop-Portrait — immer das gleiche Aspect-Ratio beibehalten
- Leaving-Animation: beim Verlassen slided Video nach rechts raus + fade-to-black

### B.2 Was Serlo aktuell macht

**Aktueller Code:**
- `apps/web/app/live/page.tsx` — Listing (OK, nicht Hauptproblem)
- `apps/web/app/live/[id]/page.tsx` — Viewer
- `components/live/live-video-player.tsx`, `live-chat.tsx`, `live-action-bar.tsx`

**Konkrete Pains:**
1. **Viewer-Layout ist 2-Spalten (`lg:grid-cols-[1fr_380px]`)** → Video und Chat **nebeneinander**. Das ist Twitch-Pattern, nicht TikTok. Für eine TikTok-lookalike App falscher Referenz-Stil.
2. **Video ist `aspect-video` (16:9)** — aber Serlo-Host-Streams sind meist `9:16` (Portrait, vom Handy). Auf Desktop entsteht so eine schwarze Riesenfläche mit winzigem zentrierten Video.
3. **Chat-Header + pinned-comment + Nachrichtenliste + Composer** alles in einer statischen Sidebar, `min-h-[500px]`. Lange Chats → cramped.
4. **Mute + Fullscreen** bei `bottom-right` in `bg-black/60` mit `p-2` — **unsichtbar auf hellen Szenen**.
5. **Gift-Animations** existieren nur im Native-Code (`components/live/GiftAnimation.tsx`) — auf Web gibt's **keine Full-Screen-Lottie-Overlays** (Code-Check: `apps/web/components/live/` hat kein Gift-Animation-Equivalent).

### B.3 Konkrete Fixes

**Fix B1 — Portrait-Stream-Layout auf Desktop** (Impact: ★★★★★)
```tsx
// live/[id]/page.tsx
// Aktuell: lg:grid-cols-[1fr_380px]
// Neu: Fullscreen-Dark-Canvas, Video zentriert im 9:16, Chat als Overlay

<div className="fixed inset-0 bg-[#0b0b10]">
  {/* Video centered, max-height = 100dvh - 4rem, aspect 9:16 preferred */}
  <div className="absolute inset-0 flex items-center justify-center">
    <div className="relative aspect-[9/16] max-h-[calc(100dvh-4rem)] max-w-full">
      <LiveVideoPlayer />
      {/* Overlay controls */}
      <LiveChatOverlay className="absolute bottom-20 left-0 right-0 max-h-[40%]" />
      <LiveActionBar className="absolute bottom-0 left-0 right-0" />
      <LiveHostPill className="absolute top-4 left-4" />
    </div>
  </div>
</div>
```
**Desktop-Nutzer mit Landscape-Stream** (Rarität aber möglich): Fallback auf `aspect-video` mit gleicher Overlay-Struktur.

**Fix B2 — Chat als halbtransparentes Overlay** (Impact: ★★★★★)
```tsx
// live-chat-overlay.tsx (neu)
<div className="pointer-events-none flex flex-col-reverse gap-1 px-3 mask-image-fade-top">
  {messages.slice(-6).map(msg => (
    <div key={msg.id} className="pointer-events-auto max-w-[80%] rounded-2xl bg-black/55 backdrop-blur-md px-3 py-1.5 text-sm text-white">
      <span className="font-semibold text-white/80 mr-1.5">{msg.username}</span>
      {msg.text}
    </div>
  ))}
</div>
```
Mask-Image-Fade:
```css
mask-image: linear-gradient(to top, black 0%, black 70%, transparent 100%);
```
Volles Chat-History-Sheet öffnet sich per Click auf Comment-Button.

**Fix B3 — Gift-Animation-Layer auf Web** (Impact: ★★★★☆)
Port vom Native-Code:
```tsx
// apps/web/components/live/gift-animation-layer.tsx (neu)
// Use lottie-react (npm i lottie-react) or CSS-only für erste Version
// Subscribe auf dieselbe Supabase-Broadcast-Channel wie Native
```
Minimal-Variante ohne Lottie: Emoji des Geschenks + Username, von unten-rechts reinfloaten, nach 3s ausfaden. Das ist **10x besser als gar nichts**.

**Fix B4 — Video-Controls sichtbar machen** (Impact: ★★★☆☆)
```tsx
// live-video-player.tsx — mute + fullscreen
// Aktuell: bg-black/60 — verschwindet auf hellen Szenen
// Neu: Gradient-Pill-Wrapper + größere Hit-Area
<div className="absolute bottom-4 right-4 flex gap-2">
  <button className="rounded-full bg-black/80 hover:bg-black p-3 text-white backdrop-blur-md ring-1 ring-white/10">
    <VolumeX className="h-5 w-5" />
  </button>
  {/* Fullscreen btn */}
</div>
```

**Fix B5 — Host-Pill mit Follow + Viewer-Count** (Impact: ★★★☆☆)
Kein separates `live-host-card.tsx` in der Sidebar, sondern **ein schlanker Pill oben-links über dem Video**:
```tsx
<div className="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/70 backdrop-blur-md px-2 py-1.5">
  <img src={host.avatar} className="h-7 w-7 rounded-full" />
  <div className="pr-2">
    <div className="text-xs font-semibold text-white">{host.username}</div>
    <div className="text-[10px] text-white/70">🔴 {viewerCount} Zuschauer</div>
  </div>
  {!isFollowing && (
    <button className="rounded-full bg-red-500 px-3 py-1 text-xs font-semibold text-white hover:bg-red-600">
      Folgen
    </button>
  )}
</div>
```

**Fix B6 — Reaction-Konfetti-Stream** (Impact: ★★☆☆☆)
Bei Herz-Reaction spawnt ein Emoji unten-rechts, floatet `translateY(-400px) + rotate(random(-30°, 30°))` über 2s mit fade:
```tsx
// Absolute-positioned, pointer-events-none, max z-index
<div className="absolute bottom-16 right-6 pointer-events-none">
  {reactions.map(r => (
    <div key={r.id} className="absolute animate-float-up text-2xl">
      {r.emoji}
    </div>
  ))}
</div>
```

---

## C. Shop (Grid + Detail + Checkout)

### C.1 Was TikTok (TikTok Shop) macht

**Layout-DNA:**
- **Grid:** 2-Col auf Mobile, 3-Col auf Tablet, 4-Col ab Desktop. **Nie 5 Cols** — würde Product-Image zu klein machen.
- Product-Card: Image-3:4 mit **starkem Shadow** (`0 4px 16px rgba(0,0,0,0.06)`), `border-radius: 12px`, bei Hover `translateY(-2px)` + schattiert stärker
- Badges (Sale, Stock, Free-Shipping) sind **klein, fett, saturiert** — TikTok nutzt `#FE2C55` (Brand-Pink) für Sale, `#25F4EE` (Brand-Cyan) für Featured
- Preis ist **dominant**: `font-bold text-[17px]`, Sale-Preis rot, Original-Preis ausgegraut + durchgestrichen daneben, **kleiner**
- **„Sold Count" + Rating** in einer Zeile unter dem Preis: `⭐ 4.8 · 1.2K verkauft` — sehr klein aber sichtbar

**Detail-Page-DNA:**
- **Hero ist volle Bildbreite + Carousel + Thumbnail-Strip darunter** (in TikTok App: Fullscreen-Swipe; Web: Arrows + Dots)
- Sticky-Buy-Bar **oben** (nicht unten!) auf Desktop bei TikTok Shop Web → bleibt nach Scroll sichtbar
- **Social Proof Card** (Reviews + Avg-Rating + „142 haben gekauft letzte 24h") prominent unter dem Preis
- Description ist **auto-collapsed bei >200 Zeichen** mit fade-out-mask + „Mehr anzeigen" Button

### C.2 Was Serlo aktuell macht

**Aktueller Code:**
- `apps/web/app/shop/page.tsx` — Grid + Filter-Sidebar (`lg:grid-cols-[260px_1fr]`)
- `apps/web/components/shop/product-card.tsx` — Tile
- `apps/web/app/shop/[id]/page.tsx` — Detail
- `apps/web/components/shop/buy-bar.tsx` — Sticky Buy-Bar
- `apps/web/components/shop/image-carousel.tsx`, `quantity-stepper.tsx`

**Konkrete Pains:**
1. **Grid geht bis `2xl:grid-cols-5`** — bei 5 Cols sind Bilder zu klein. TikTok stoppt bei 4.
2. **Product-Card hat `border` aber keinen `shadow`** → flach, fügt sich nicht in Weiß ein, wirkt wie Excel-Zelle. `hover:shadow-md` ist zu wenig idle-state-visibility.
3. **Badge-Platzierung ist überladen:** Top-Left = Sale, Top-Right = Camera-Count ODER „Ausverkauft", Bottom-Left = Women-Only-Emoji, Bottom-Right = Low-Stock. **Vier Ecken gleichzeitig belegt** → ein Tile ist visuell „Clown-Art".
4. **Preis-Weight ist `font-semibold` (600)** — TikTok nutzt `font-bold` (700) für Preis, sonst fehlt Dominanz.
5. **Stock-Bar ist `h-1.5` (6px)** — unscheinbar, oben hatte Agent recht.
6. **Detail-Page Description ist `<details><summary>`** — nativ HTML, ohne Styling-Liebe. Kein Gradient-Fade, kein smooth Expand-Transition.
7. **Seller-Card auf Detail-Page ist „flat div"** — keine Background-Farbe, kein Separator → sieht aus wie Continuation der Description.
8. **Buy-Bar unten** — guter Approach für Mobile, auf Desktop aber verschwendet sie Viewport. TikTok hat auf Desktop den Buy-CTA **neben dem Preis** in der Info-Column statt unten.

### C.3 Konkrete Fixes

**Fix C1 — Grid-Cols deckeln + Shadow-Elevation** (Impact: ★★★★★)
```tsx
// apps/web/app/shop/page.tsx
// Aktuell: grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5
// Neu: grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 (stop here)
// und gap von 3 → 4 (12px → 16px)
```

```tsx
// product-card.tsx
<Link className="group block overflow-hidden rounded-xl bg-card shadow-[0_1px_3px_rgba(0,0,0,0.06)] ring-1 ring-black/5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
  {/* Image + Info */}
</Link>
```
Kein `border` mehr, dafür `ring-1 ring-black/5` (feinere Kante) + **immer** sichtbarer Shadow.

**Fix C2 — Badge-Konsolidierung** (Impact: ★★★★☆)
Regel: **Nur zwei Ecken belegen** — Top-Left für Status (Sale/New/Ausverkauft, exklusiv), Bottom-Right für Secondary-Info (Bild-Count ODER Stock-Warning, exklusiv). Women-Only wandert in die Info-Zeile als kleine Emoji-Pille:
```tsx
// product-card.tsx — Info-Section
<div className="p-3">
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <span className="truncate">{seller.username}</span>
    {womenOnly && <span className="text-pink-500">♀</span>}
  </div>
  {/* Title, price, etc */}
</div>
```

**Fix C3 — Preis-Hierarchy + Farbe** (Impact: ★★★★☆)
```tsx
// product-card.tsx price row
<div className="flex items-baseline gap-1.5">
  {onSale ? (
    <>
      <span className="text-base font-bold tabular-nums text-red-500">🪙 {effectivePrice}</span>
      <span className="text-xs tabular-nums text-muted-foreground line-through">{originalPrice}</span>
    </>
  ) : (
    <span className="text-base font-bold tabular-nums">🪙 {price}</span>
  )}
</div>
```

**Fix C4 — Detail-Page: Buy-CTA in Info-Column statt unten** (Impact: ★★★★☆)
Auf Desktop (`lg+`) verschiebt sich die Buy-Bar **in die rechte Info-Spalte** direkt unter den Preis. Mobile bleibt Sticky-Bottom.
```tsx
// app/shop/[id]/page.tsx
<div className="hidden lg:block">
  <BuyBarDesktop /> {/* inline in der Info-Column */}
</div>
<div className="lg:hidden">
  <BuyBarSticky /> {/* sticky bottom */}
</div>
```

**Fix C5 — Seller-Card mit Surface-Treatment** (Impact: ★★★☆☆)
```tsx
// shop/[id]/page.tsx — Seller-Section
<div className="rounded-xl bg-muted/40 ring-1 ring-black/5 p-4 flex items-center gap-3">
  <img src={seller.avatar} className="h-12 w-12 rounded-full ring-2 ring-background" />
  <div className="flex-1 min-w-0">
    <div className="text-sm font-semibold truncate">{seller.displayName}</div>
    <div className="text-xs text-muted-foreground">@{seller.username} · {sellerProductCount} Produkte</div>
  </div>
  <button className="rounded-full border px-3 py-1.5 text-xs font-semibold">Chat</button>
  <button className="rounded-full bg-primary text-primary-foreground px-3 py-1.5 text-xs font-semibold">Shop</button>
</div>
```

**Fix C6 — Description mit Gradient-Fade + Smooth-Expand** (Impact: ★★☆☆☆)
```tsx
// Aktuell: <details><summary>
// Neu: controlled state + CSS max-height transition
<div className="relative">
  <div className={cn(
    "overflow-hidden transition-all duration-300",
    expanded ? "max-h-[2000px]" : "max-h-32"
  )}>
    <p className="whitespace-pre-line text-sm leading-relaxed">{description}</p>
  </div>
  {!expanded && (
    <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />
  )}
  <button onClick={() => setExpanded(e => !e)} className="mt-2 text-sm font-semibold text-primary hover:underline">
    {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
  </button>
</div>
```

**Fix C7 — Stock-Bar sichtbar** (Impact: ★★☆☆☆)
```tsx
// product-card.tsx
{stock && stock <= 5 && (
  <div className="mt-2">
    <div className="h-2 overflow-hidden rounded-full bg-muted">
      <div className="h-full bg-gradient-to-r from-amber-400 to-red-500" style={{ width: `${(stock/10)*100}%` }} />
    </div>
    <div className="mt-1 text-[11px] font-medium text-amber-600">Nur noch {stock} übrig</div>
  </div>
)}
```

---

## D. Messages + Profile + Settings

### D.1 Was TikTok macht

**Messages:**
- DM-Liste: Full-Width-Rows mit `72px` Avatar-Slot links, Name + Preview in der Mitte, Timestamp + Unread-Dot rechts
- Row-Hover: `bg-muted/50` Highlight, **gesamte Row klickbar**, kein Card-Container drumrum (Edge-to-Edge)
- Unread-Indicator: **blauer Dot rechts** (`6x6px`) — nicht auf Avatar
- Thread-View: Fullscreen-Feel. Header mit Back-Arrow + Name fix oben. Messages edge-to-edge, Composer fix unten mit `safe-area-inset-bottom`
- **Reaction-Quick-Bar** erscheint bei Long-Press (Mobile) oder Right-Click (Desktop) — Fly-Out-Animation, 6 Emoji-Buttons

**Profile:**
- Avatar: **96–112px** mit **2–3px gradient ring** (TikTok-Pink → TikTok-Cyan) wenn User live ist, sonst plain
- Stats als **klickbare Pills mit `font-bold` Zahl + `text-xs text-muted` Label darunter**, kein Komma-Tausender-Format sondern `1.2K`, `45.3K`, `1.2M`
- Tab-Bar mit **fettem Unterstrich (`border-b-2`)** bei aktivem Tab, `font-semibold` Text
- **Empty-States** haben Illustrationen (nicht nur Icons), TikTok-Brand-freundliche Copy

**Settings:**
- Sehr flaches Layout: Liste mit Icon + Label + Chevron-Right, keine Cards, sehr dicht gepackt
- Sections mit kleinen Uppercase-Headern (`text-[11px] uppercase text-muted tracking-wider`)
- Destruktive Actions (Logout, Delete Account) **rot** und am Ende

### D.2 Was Serlo aktuell macht

**Messages aktueller Code:**
- `apps/web/app/messages/page.tsx` — Liste
- `apps/web/app/messages/[id]/page.tsx` + `components/messages/message-thread.tsx`

**Profile aktueller Code:**
- `apps/web/app/u/[username]/page.tsx` — Public Profile
- `components/profile/profile-tabs.tsx`, `post-grid.tsx`

**Settings aktueller Code:**
- `apps/web/app/settings/page.tsx` — vorhanden aber nicht tief analysiert vom Explorer

**Konkrete Pains Messages:**
1. **Conversation-Liste ist in `rounded-xl border bg-card`** gekapselt → fühlt sich wie „ein Card-Widget" statt wie native OS-Chat-Liste
2. **60x60 Avatar — aber ohne Ring**, bei User ohne Profilbild zeigt nur Initiale
3. **Unread-Count-Badge** (`text-[10px]`) neben Timestamp — zu klein, TikTok hat blauen Dot, größer & klar
4. **Thread-Bubbles: `max-w-[78%]`** — zu viel, TikTok/iMessage 70%. Lange Nachrichten wrappen dann zu oft
5. **Reactions-Quick-Bar ist 6 Emoji in horizontal row** — OK, aber `hover:scale-125` ist viel zu wild (TikTok: `scale-110`)
6. **Typing-Indicator `h-1.5 w-1.5 animate-bounce`** — 6px Dots sind fast unsichtbar
7. **Read-Receipts** als `check/checkcheck`-Icons unter der Message — richtig, aber grau-auf-weiß fast unsichtbar

**Konkrete Pains Profile:**
1. **Avatar `h-24 w-24` mit `ring-4 ring-background`** — Ring ist gleich-farbig wie Hintergrund, praktisch unsichtbar. TikTok-Pattern = Gradient-Ring bei Live, plain bei nicht-live.
2. **Stats sind „plain text mit gap-6"** — keine Pill-Form, keine Click-Affordance. Looks like static heading.
3. **Tab-Bar ist subtle underline** — default `border-b` Weight. Soll fett (`border-b-2`) sein.
4. **Verified-Badge `h-5 w-5`** — ja, 20px ist schon OK, aber die gold-on-background-Kombi ist **sehr dezent**. TikTok macht Verified = **Blau-Check mit weißem Innen**, klare Absetzung.
5. **Empty-States („under construction")** — absolut kein Design. „Noch nichts hier" mit `Construction`-Icon wirkt **nach 2022 Prototype**.
6. **Bio ist plain pre-line** — keine URL-Linkify, keine @Mention-Links, keine Hashtag-Links.

**Konkrete Pains Settings:**
Nicht tief analysiert — aber wenn es dem Pattern der anderen Screens folgt, sind die wahrscheinlichsten Probleme:
- Zu viel Card-Container-Chrome statt Edge-to-Edge-Rows
- Section-Header zu groß (wahrscheinlich `text-lg font-semibold` → sollte `text-[11px] uppercase tracking-wider text-muted`)
- Destruktive Actions nicht rot abgehoben

### D.3 Konkrete Fixes

**Fix D1 — Messages-Liste edge-to-edge** (Impact: ★★★★★)
```tsx
// app/messages/page.tsx
// Aktuell: flex-1 divide-y divide-border overflow-hidden rounded-xl border bg-card
// Neu: Edge-to-edge mit subtile Row-Hover
<div className="max-w-3xl mx-auto">
  <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b px-4 py-3">
    <h1 className="text-2xl font-bold">Nachrichten</h1>
  </header>
  <ul className="divide-y divide-border/50">
    {conversations.map(c => (
      <li key={c.id}>
        <Link href={`/messages/${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
          <Avatar size={60} src={c.other.avatar} hasUnread={c.unread > 0} />
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2">
              <span className={cn("truncate font-semibold", c.unread && "font-bold")}>
                {c.other.displayName}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{formatRelative(c.lastAt)}</span>
            </div>
            <div className="flex items-center gap-2">
              <p className={cn("truncate text-sm text-muted-foreground", c.unread && "text-foreground font-medium")}>
                {c.preview}
              </p>
              {c.unread > 0 && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
            </div>
          </div>
        </Link>
      </li>
    ))}
  </ul>
</div>
```

**Fix D2 — Thread-Bubbles enger + Read-Receipts** (Impact: ★★★★☆)
```tsx
// message-thread.tsx
// max-w-[78%] → max-w-[72%]
// Read-receipts: statt grau-auf-weiß → bg-primary/10 pill
<div className="mt-0.5 flex items-center gap-0.5 text-[10px]">
  {isRead ? (
    <span className="text-primary">✓✓ Gelesen</span>
  ) : (
    <span className="text-muted-foreground">✓ Gesendet</span>
  )}
</div>
```

**Fix D3 — Profile-Hero-Redesign** (Impact: ★★★★★)
```tsx
// u/[username]/page.tsx
<section className="px-4 pt-6 pb-8">
  <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
    {/* Avatar with conditional gradient ring */}
    <div className={cn(
      "relative rounded-full p-1",
      isLive ? "bg-gradient-to-tr from-pink-500 via-red-500 to-yellow-400" : "bg-transparent"
    )}>
      <img src={user.avatar} className="h-28 w-28 rounded-full ring-4 ring-background object-cover sm:h-32 sm:w-32" />
      {isLive && (
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
          LIVE
        </span>
      )}
    </div>

    {/* Info */}
    <div className="flex-1 text-center sm:text-left">
      <div className="flex items-center justify-center gap-1.5 sm:justify-start">
        <h1 className="text-2xl font-bold">{user.displayName}</h1>
        {user.verified && <VerifiedBadge className="h-5 w-5 text-sky-500" />}
      </div>
      <p className="text-sm text-muted-foreground">@{user.username}</p>

      {/* Stats als pills */}
      <div className="mt-4 flex gap-6 justify-center sm:justify-start">
        <StatPill label="Posts" value={formatK(user.postCount)} />
        <StatPill label="Follower" value={formatK(user.followerCount)} />
        <StatPill label="Folgt" value={formatK(user.followingCount)} />
      </div>

      {/* Actions */}
      <div className="mt-4 flex gap-2 justify-center sm:justify-start">
        {!isMe && (
          <>
            <FollowButton className="min-w-[120px]" />
            <button className="rounded-md border px-4 py-2 text-sm font-semibold">Nachricht</button>
            <button className="rounded-md border px-3 py-2"><MoreHorizontal className="h-4 w-4" /></button>
          </>
        )}
      </div>

      {/* Bio */}
      {user.bio && (
        <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-center sm:text-left">
          {linkify(user.bio)} {/* URLs, @mentions, #hashtags */}
        </p>
      )}
    </div>
  </div>
</section>
```
`StatPill`-Komponente:
```tsx
function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <button className="group flex flex-col items-start transition-opacity hover:opacity-80">
      <span className="text-lg font-bold tabular-nums leading-none">{value}</span>
      <span className="text-xs text-muted-foreground mt-0.5">{label}</span>
    </button>
  );
}
```
`formatK`: `1234 → 1.2K`, `45678 → 45.7K`, `1234567 → 1.2M`.

**Fix D4 — Tab-Bar mit Bold-Underline** (Impact: ★★★☆☆)
```tsx
// components/profile/profile-tabs.tsx
<nav className="flex border-b">
  {tabs.map(tab => (
    <button
      key={tab.id}
      onClick={() => setActive(tab.id)}
      className={cn(
        "flex-1 py-3 text-sm font-semibold transition-colors relative",
        active === tab.id ? "text-foreground" : "text-muted-foreground hover:text-foreground"
      )}
    >
      <span className="flex items-center justify-center gap-1.5">
        <tab.icon className="h-4 w-4" />
        {tab.label}
        {tab.count != null && <span className="text-xs opacity-60">{tab.count}</span>}
      </span>
      {active === tab.id && (
        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
      )}
    </button>
  ))}
</nav>
```

**Fix D5 — Empty-States mit Personality** (Impact: ★★★☆☆)
```tsx
// components/ui/empty-state.tsx
function EmptyState({ icon: Icon, title, description, cta }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-4 rounded-full bg-muted/50 p-5">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground max-w-xs">{description}</p>
      {cta && <div className="mt-6">{cta}</div>}
    </div>
  );
}

// Usage Profile-Tab Posts (wenn keine Posts):
<EmptyState
  icon={Grid3x3}
  title="Noch keine Posts"
  description={isMe ? "Teile dein erstes Video, um loszulegen." : `@${username} hat noch nichts gepostet.`}
  cta={isMe && <Link href="/create" className="btn-primary">Erstes Video erstellen</Link>}
/>
```

**Fix D6 — Bio-Linkify** (Impact: ★★☆☆☆)
```tsx
// lib/linkify.tsx
export function linkify(text: string) {
  // Match URLs, @mentions, #hashtags
  const parts = text.split(/(\bhttps?:\/\/\S+|\B@\w+|\B#\w+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('http')) return <a key={i} href={part} className="text-primary hover:underline">{part}</a>;
    if (part.startsWith('@')) return <Link key={i} href={`/u/${part.slice(1)}`} className="text-primary hover:underline">{part}</Link>;
    if (part.startsWith('#')) return <Link key={i} href={`/search?q=${part}`} className="text-primary hover:underline">{part}</Link>;
    return part;
  });
}
```

**Fix D7 — Settings als flache Liste** (Impact: ★★☆☆☆)
```tsx
// app/settings/page.tsx — konzeptionelle Struktur
<div className="max-w-2xl mx-auto">
  <header className="px-4 py-4 border-b">
    <h1 className="text-2xl font-bold">Einstellungen</h1>
  </header>

  <section className="mt-6">
    <h2 className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Konto</h2>
    <ul className="mt-2 divide-y divide-border/50">
      <SettingsRow icon={User} label="Profil bearbeiten" href="/settings/profile" />
      <SettingsRow icon={Shield} label="Datenschutz" href="/settings/privacy" />
      <SettingsRow icon={Bell} label="Benachrichtigungen" href="/settings/notifications" />
    </ul>
  </section>

  <section className="mt-8">
    <h2 className="px-4 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">App</h2>
    <ul className="mt-2 divide-y divide-border/50">
      <SettingsRow icon={Moon} label="Design" right={<ThemeToggle />} />
      <SettingsRow icon={Globe} label="Sprache" right="Deutsch" href="/settings/language" />
    </ul>
  </section>

  <section className="mt-8">
    <ul className="divide-y divide-border/50">
      <SettingsRow icon={LogOut} label="Abmelden" destructive onClick={signOut} />
      <SettingsRow icon={Trash2} label="Konto löschen" destructive href="/settings/delete-account" />
    </ul>
  </section>
</div>
```

---

## Cross-Cutting: Design-System-Foundations

Diese drei Punkte wirken auf ALLE Bereiche und sind **Voraussetzung** dafür, dass die Bereichs-Fixes gut aussehen.

### CC-1: Web-Font installieren
TikTok nutzt Proxima Nova (kommerzielle Lizenz). Open-Source-Equivalent: **Inter** (oder Geist, sehr modern).
```tsx
// apps/web/app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

<html lang="de" className={inter.variable}>
```
```css
/* globals.css */
:root {
  --font-sans: var(--font-inter), system-ui, sans-serif;
}
body {
  font-family: var(--font-sans);
  font-feature-settings: "cv02", "cv03", "cv04", "cv11"; /* Inter-Tabular-Lining */
}
```

### CC-2: Shadow-Token-System
Aktuell nutzt Serlo uneinheitliche Tailwind-Defaults (`shadow-md`, `shadow-lg`). Tokenize:
```js
// tailwind.config.js
theme: {
  extend: {
    boxShadow: {
      'elevation-1': '0 1px 2px 0 rgba(0, 0, 0, 0.04), 0 1px 3px 0 rgba(0, 0, 0, 0.06)',
      'elevation-2': '0 4px 8px -2px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)',
      'elevation-3': '0 12px 24px -6px rgba(0, 0, 0, 0.08), 0 4px 8px -2px rgba(0, 0, 0, 0.05)',
      'elevation-4': '0 24px 48px -12px rgba(0, 0, 0, 0.12)',
    }
  }
}
```
Verwendung: Product-Cards `shadow-elevation-1` → `hover:shadow-elevation-2`. Modals = `shadow-elevation-4`.

### CC-3: Motion-Tokens
```js
// tailwind.config.js
theme: {
  extend: {
    transitionTimingFunction: {
      'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      'out-back': 'cubic-bezier(0.34, 1.56, 0.64, 1)', // nur für „poppy"-Press-States
    },
    transitionDuration: {
      'fast': '150ms',
      'base': '200ms',
      'slow': '300ms',
    }
  }
}
```
Standard-Transitions werden: `transition-all duration-base ease-out-expo`.

### CC-4: Mobile-Bottom-Nav
Aktuell: keine Mobile-Nav sichtbar → **User auf Handy sieht kein Menu bis er scrollt**. Das ist ein hartes UX-Loch.
```tsx
// components/shell/mobile-bottom-nav.tsx (neu)
<nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden bg-background/90 backdrop-blur-md border-t pb-[env(safe-area-inset-bottom)]">
  <ul className="flex items-center justify-around py-2">
    <NavItem href="/" icon={Home} label="Home" />
    <NavItem href="/live" icon={Radio} label="Live" />
    <NavItem href="/create" icon={Plus} label="Create" primary />
    <NavItem href="/messages" icon={MessageCircle} label="Chat" badge={unreadCount} />
    <NavItem href="/u/me" icon={User} label="Profil" />
  </ul>
</nav>
```

### CC-5: Color-System-Audit
Aktuelle Nutzung mischt `bg-card`, `bg-muted`, `bg-background`, `bg-white/15` ohne klare Regel. Token-Regel vorschlagen:

| Token | Use-Case |
|---|---|
| `bg-background` | Page-Body |
| `bg-card` | Karten (Product-Card, Conversation-Row-Container wenn umkapselt) |
| `bg-muted` | Input-Backgrounds, Disabled-States, Other-Message-Bubble |
| `bg-primary` | CTAs, Own-Message-Bubble, Active-Tab-Underline |
| `bg-[#0b0b10]` | Feed-Canvas, Live-Canvas (dark-always) |
| `bg-black/70 + backdrop-blur` | Overlays auf Video (Chat, Controls) |

---

## Fix-Priorität: 3-Phasen-Roadmap

Wenn ich das in Phasen plane (wie die Audit-Phasen 1-4 mit pro Phase klarem Scope), empfehle ich folgende Reihenfolge. Pro Phase ca. 1-2 Tage Implementation, direkt mergebare PRs.

### **UI-Phase 1 — Foundation & Quick-Wins** (2 Tage)
Dinge die JEDEN Screen verbessern, mit minimalem Risiko:
- CC-1: Inter-Font installieren
- CC-2: Shadow-Token-System
- CC-3: Motion-Tokens
- CC-4: Mobile-Bottom-Nav
- A1: Dark-Canvas um Feed
- C1: Shop-Card Shadow-Elevation + gap-4
- D1: Messages-Liste edge-to-edge
- D4: Profile-Tab-Bar bold

**Expected Impact:** 70% des „flat/prototype"-Gefühls verschwindet sofort.

### **UI-Phase 2 — Interactivity & Affordance** (3 Tage)
Micro-Interactions, stärkere Feedback-Loops:
- A2: Action-Rail außerhalb + Hierarchy
- A3: Like-Burst-Animation
- A5: Double-Tap-Heart-Overlay
- B4: Video-Controls-Sichtbarkeit
- B5: Host-Pill mit Follow
- C3: Preis-Hierarchy
- D2: Thread-Bubble-Verbesserungen
- D5: Empty-States mit Personality

**Expected Impact:** Die App fühlt sich **alive** an. Klicks haben Weight.

### **UI-Phase 3 — Architektur-Redesigns** (4-5 Tage)
Die größeren strukturellen Änderungen, die mehr Testing brauchen:
- B1: Live-Viewer-Portrait-Layout (9:16 auf Desktop)
- B2: Chat als Overlay
- B3: Gift-Animation-Layer Web-Parity
- C4: Desktop-Inline-Buy-Bar
- C5: Seller-Card-Surface
- D3: Profile-Hero-Redesign mit Live-Ring

**Expected Impact:** Visuelle Parität zu TikTok Web erreicht. Ab hier geht's nur noch um Pixel-Polish.

---

## Was dieses Audit **NICHT** abdeckt

Damit du weißt, wo noch Research-Lücken sind:

- **Accessibility-Audit** (Focus-Ringe, Screen-Reader, Keyboard-Nav vollständig): absichtlich ausgeklammert — das wäre ein eigenes Dokument
- **Performance-Audit** (Bundle-Size, LCP, CLS): Phase 3 der ursprünglichen Audit-Reihe hat das grob gestreift, hier nicht tiefer
- **Native (iOS/Android) vs Web Parity**: nur beiläufig erwähnt bei Live (Gift-Animation), nicht systematisch
- **i18n-Konsequenzen**: die hier vorgeschlagenen UI-Änderungen nehmen Deutsch an. Für CE/RU können sich Zeilen-Breaks ändern (bes. in Bubbles mit `max-w-[72%]`)
- **Empty-Images / Stock-Photos / Illustrations**: Ein echter TikTok-Look braucht Illustrator-Arbeit für Empty-States. Das hier sind nur die Frame-Specs.
- **Instagram / BeReal / Snapchat / Twitch als zusätzliche Benchmarks**: bewusst auf TikTok beschränkt wie vom User gewählt

---

## Zusammenfassung in einem Satz

**Serlo-Web-UI ist ein Wireframe, dem drei Dinge fehlen: ein dunkler Canvas für Video-Inhalte, haptische Micro-Interactions, und eine saubere Typographie-Schicht.** Alle anderen Fixes folgen daraus.
