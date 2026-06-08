# Master-Fix-Plan — Serlo / Vibes App
> Erstellt: 2026-06-08 | Kombiniert alle offenen SW-XX + neue UI-XX Findings
> Ziel: Systematische Beseitigung aller bekannten Bugs, UX-Schwächen und Tech-Debt

---

## Übersicht aller offenen Punkte

| ID | Titel | Kategorie | Prio | Aufwand | Status |
|---|---|---|---|---|---|
| **FIX-01** | settings.tsx: AGB-Link zeigt Datenschutz | Bug | 🔴 P1 | 5 Min | ⛔ Offen |
| **FIX-02** | host.tsx: Alert.prompt → Android-Modal | Bug | 🔴 P1 | 2h | ⛔ Offen |
| **FIX-03** | profile.tsx: Grid ohne vertikalen Gap | Bug | 🔴 P1 | 10 Min | ⛔ Offen |
| **FIX-04** | GIPHY Key Fallback hardcoded entfernen | Security | 🔴 P1 | 15 Min | ⛔ Offen |
| **FIX-05** | r2-delete Edge Function ins Repo | Sicherheit | 🔴 P1 | 1h | ⛔ Offen |
| **FIX-06** | messages.tsx: ItemSeparator ohne useCallback | Perf | 🟡 P2 | 10 Min | ⛔ Offen |
| **FIX-07** | messages.tsx: kein keyboardDismissMode | UX | 🟡 P2 | 5 Min | ⛔ Offen |
| **FIX-08** | messages.tsx: kein ListEmptyComponent | UX | 🟡 P2 | 30 Min | ⛔ Offen |
| **FIX-09** | coin-shop.tsx: generische Fehlermeldungen | UX | 🟡 P2 | 30 Min | ⛔ Offen |
| **FIX-10** | profile.tsx: identische accessibilityLabel | A11y | 🟡 P2 | 15 Min | ⛔ Offen |
| **FIX-11** | host.tsx: doppelte Alert.prompt für Goal | UX | 🟡 P2 | 1h | ⛔ Offen |
| **FIX-12** | MusicVinylBadge: Infinite-Anim auf inaktiven Items | Perf | 🟡 P2 | 20 Min | ⛔ Offen |
| **FIX-13** | explore.tsx: fragmentierte StyleSheet-Blöcke | Code-Q | 🟡 P2 | 30 Min | ⛔ Offen |
| **FIX-14** | Design-Token-System: SPACING, RADII, FONT | Design | 🟡 P2 | 3h | ⛔ Offen |
| **FIX-15** | 236 Pressables ohne accessibilityLabel | A11y | 🟢 P3 | 4h | ⛔ Offen |
| **FIX-16** | console.* ohne __DEV__ Guard (12 Stellen) | Code-Q | 🟢 P3 | 30 Min | ⛔ Offen |
| **FIX-17** | Sentry Edge Function testen + aktivieren | Ops | 🟢 P3 | 1h | ⛔ Offen |
| **FIX-18** | LC-Token-Migration Live-Screens | Design | 🟢 P3 | 4h | ⛔ Offen |
| **FIX-19** | Loading-Skelette einführen | UX | 🟢 P3 | 6h | ⛔ Offen |
| **FIX-20** | Stripe Webhook: aktiv oder dead code? | Klärung | 🟢 P3 | 30 Min | ⛔ Offen |
| **FIX-21** | Scheduled Jobs Failure Alerting | Ops | 🟢 P3 | 1h | ⛔ Offen |
| **FIX-22** | Success-Haptics hinzufügen | Polish | 🟢 P4 | 1h | ⛔ Offen |
| **FIX-23** | Vage 'Unbekannter Fehler' Meldungen verbessern | UX | 🟢 P4 | 2h | ⛔ Offen |

---

## PHASE 1 — Kritische Bugs (Sofort, max. 1 Tag)

### FIX-01 · `app/settings.tsx` — AGB-Link ist doppelter Datenschutz-Link

**Problem:**
```tsx
// L693 — korrekt:
onPress={() => Linking.openURL('https://serlo.social/privacy')}  // Datenschutz ✅
// L702 — FALSCH (identische URL!):
onPress={() => Linking.openURL('https://serlo.social/privacy')}  // sollte /terms sein ❌
```
User der Nutzungsbedingungen lesen will sieht Datenschutzerklärung. Rechtlich relevant.

**Fix:**
```tsx
// L702 ändern auf:
onPress={() => Linking.openURL('https://serlo.social/terms').catch(() => {})}
```

**Datei:** `app/settings.tsx` L702  
**Aufwand:** 5 Minuten  
**Test:** Settings öffnen → "Nutzungsbedingungen" antippen → Browser öffnet /terms

---

### FIX-02 · `app/live/host.tsx` — Alert.prompt (3 Stellen) → Android-Modal

**Problem:** SW-07 war nur für `settings.tsx` abgeschlossen. `host.tsx` hat noch **3 Alert.prompt Aufrufe**:
- **L414** `addHostWords()` — Moderationswörter hinzufügen  
- **L1127** `promptGoalDetails()` — Coin/Like-Ziel setzen (erster Prompt)
- **L1133** (verschachtelt) — Belohnungs-Beschreibung (zweiter Prompt)

Auf Android: **silenter Fail** — kein Dialog, kein Callback, Feature komplett broken.

**Strategie — 3 separate Modal-Lösungen:**

#### A) `addHostWords` → TextInput-Modal (bereits `usePrompt` Hook vorhanden!)

Der `usePrompt` Hook aus SW-07 Migration liefert ein Cross-Platform Modal. Diesen nutzen.

```tsx
// VORHER:
const addHostWords = () => {
  Alert.prompt('Eigene Wörter sperren', '...', async (input) => { ... });
};

// NACHHER:
const { showPrompt } = usePrompt();
const addHostWords = () => {
  showPrompt({
    title: 'Eigene Wörter sperren',
    message: 'Wörter kommagetrennt eingeben (z.B. Schimpfwort1, Schimpfwort2)',
    onConfirm: async (input) => {
      if (!input?.trim()) return;
      const newWords = input.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      const merged = [...new Set([...hostWords, ...newWords])];
      setHostWords(merged);
      await updateModeration(sessionId, moderationEnabled, merged);
    },
  });
};
```

#### B) `promptGoalDetails` → Dediziertes Bottom-Sheet

Zwei aufeinanderfolgende Alert.prompts sind UX-Antipattern selbst auf iOS. Ersetzen durch ein `LiveGoalSheet` (neues Component) mit zwei TextInput-Feldern + Submit-Button in einem einzigen Sheet.

```tsx
// Neues State:
const [showGoalSheet, setShowGoalSheet] = useState(false);
const [goalType, setGoalType] = useState<'gift_value' | 'likes'>('gift_value');

// UI: GoalSheet aufrufen statt Alert.prompt:
const promptGoalDetails = useCallback((type: 'gift_value' | 'likes') => {
  setGoalType(type);
  setShowGoalSheet(true);
}, []);

// Im JSX am Ende des Screens:
{showGoalSheet && (
  <LiveGoalSheet
    type={goalType}
    onClose={() => setShowGoalSheet(false)}
    onSubmit={async ({ target, title }) => {
      await setLiveGoal(sessionId, { type: goalType, target, title });
      sendSystemEvent(`🎯 Neues Ziel: ${title} — ${target} ${goalType === 'gift_value' ? '💎 Coins' : '❤️ Likes'}!`);
      setShowGoalSheet(false);
    }}
  />
)}
```

**Neues File:** `components/live/LiveGoalSheet.tsx`
```tsx
// Props: type, onClose, onSubmit({ target: number, title: string })
// Felder: Zielwert (numPad), Belohnungs-Beschreibung (text)
// Layout: Modal + KeyboardAvoidingView + zwei TextInput + Submit-Button
// Style: LC-Tokens (dunkles Overlay, weißer Text)
```

**Dateien:** `app/live/host.tsx`, `components/live/LiveGoalSheet.tsx` (neu)  
**Aufwand:** 2 Stunden  

---

### FIX-03 · `app/(tabs)/profile.tsx` L309 — Grid ohne vertikalen Zeilenabstand

**Problem:**
```tsx
<FlatList
  columnWrapperStyle={{ gap: GRID_GAP }}  // ← nur horizontale Lücke!
  // contentContainerStyle hat kein rowGap
```
Posts kleben vertikal aneinander. Horizontal korrekt — vertikal inkorrekt.

**Fix:**
```tsx
// Option A — contentContainerStyle mit gap (einfachster Fix):
contentContainerStyle={{ paddingBottom: insets.bottom + 100, gap: GRID_GAP }}

// Option B — ItemSeparatorComponent (wenn A nicht reicht wegen FlatList numColumns):
// Bei numColumns > 1 und FlatList: columnWrapperStyle gap + eigenes rowStyle
// Sauberste Lösung: contentContainerStyle + rowGap
```

Konkreter Fix an Stelle L308–310:
```tsx
columnWrapperStyle={{ gap: GRID_GAP, marginBottom: GRID_GAP }}
```
Alternativ wenn FlatList kein rowGap unterstützt: `ItemSeparatorComponent={() => <View style={{ height: GRID_GAP }} />}`

**Datei:** `app/(tabs)/profile.tsx` L309  
**Aufwand:** 10 Minuten

---

### FIX-04 · GIPHY Key Fallback entfernen (SW-04)

**Problem:** `app/create/index.tsx` — hardcoded API-Key als Fallback in Source Code

**Fix:**
```tsx
// VORHER:
const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '9Kp17xdnCuF9EsveCTQNmKplwF1PRmHY';
// NACHHER:
const GIPHY_KEY = process.env.EXPO_PUBLIC_GIPHY_API_KEY ?? '';
// + Sticker-Button disablen wenn kein Key:
const giphyEnabled = Boolean(GIPHY_KEY);
```

**Datei:** `app/create/index.tsx`  
**Aufwand:** 15 Minuten

---

### FIX-05 · r2-delete Edge Function versionieren (SW-02)

**Problem:** Deployed aber nicht im Repo — nicht nachvollziehbar, nicht rollback-fähig.

**Schritte:**
```bash
# 1. Aktuellen Stand aus Supabase holen
npx supabase functions download r2-delete

# 2. Unter korrektem Pfad einchecken
# → supabase/functions/r2-delete/index.ts

# 3. In CLAUDE.md unter "Externe Services" dokumentieren

# 4. Smoke-Test für products/images/... Pfad
```

**Aufwand:** 1 Stunde

---

## PHASE 2 — UX / Performance Probleme (2–3 Tage)

### FIX-06 · `messages.tsx` — ItemSeparatorComponent als Inline-Closure

**Problem:**
```tsx
// Neue Funktion bei JEDEM Render — FlashList re-mounted Separators:
ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: colors.border.subtle }]} />}
```

**Fix:** `useCallback` + stable StyleSheet

```tsx
// Außerhalb Component oder in useMemo:
const SeparatorItem = useCallback(
  () => <View style={[s.separator, { backgroundColor: colors.border.subtle }]} />,
  [colors.border.subtle]
);

// In FlashList:
ItemSeparatorComponent={SeparatorItem}
```

**Datei:** `app/(tabs)/messages.tsx` L458  
**Aufwand:** 10 Minuten

---

### FIX-07 · `messages.tsx` — FlashList ohne keyboardDismissMode

**Problem:** Tastatur bleibt beim Scrollen der Konversationsliste geöffnet. WhatsApp/iMessage-Standard.

**Fix:**
```tsx
<FlashList
  keyboardDismissMode="on-drag"    // ← hinzufügen
  keyboardShouldPersistTaps="handled"
  ...
```

**Datei:** `app/(tabs)/messages.tsx`  
**Aufwand:** 5 Minuten

---

### FIX-08 · `messages.tsx` — Kein Empty-State mit CTA

**Problem:** Keine Nachrichten → leere Fläche ohne Erklärung oder Call-to-Action.

**Fix — `ListEmptyComponent` erweitern:**
```tsx
ListEmptyComponent={
  isLoading ? null : (
    <View style={s.emptyWrap}>
      <MessageCircle size={52} stroke={colors.icon.muted} strokeWidth={1.5} />
      <Text style={[s.emptyTitle, { color: colors.text.primary }]}>Noch keine Nachrichten</Text>
      <Text style={[s.emptySub, { color: colors.text.muted }]}>
        Fange ein Gespräch an — schreib jemandem!
      </Text>
      <Pressable
        style={[s.emptyBtn, { backgroundColor: colors.accent.primary }]}
        onPress={() => setShowNew(true)}
        accessibilityRole="button"
        accessibilityLabel="Neue Nachricht starten"
      >
        <Text style={s.emptyBtnText}>Nachricht schreiben</Text>
      </Pressable>
    </View>
  )
}
```

**Datei:** `app/(tabs)/messages.tsx`  
**Aufwand:** 30 Minuten

---

### FIX-09 · `coin-shop.tsx` — Generische Fehlermeldungen

**Problem:**
```tsx
Alert.alert('Fehler', 'Kauf konnte nicht abgeschlossen werden.');
```
Kein Error-Code, keine Hilfestellung, kein Retry-Button. RevenueCat liefert strukturierte Errors.

**Fix — RevenueCat Error Codes nutzen:**
```tsx
import Purchases, { PurchasesErrorCode } from 'react-native-purchases';

const handlePurchase = async () => {
  try {
    ...
  } catch (e: unknown) {
    if (Purchases.isConfigured) {
      const rcError = e as { code?: PurchasesErrorCode; message?: string };
      if (rcError.code === PurchasesErrorCode.PurchaseCancelledError) {
        return; // User hat abgebrochen — kein Alert
      }
      if (rcError.code === PurchasesErrorCode.NetworkError) {
        Alert.alert(
          'Keine Verbindung',
          'Prüfe deine Internetverbindung und versuche es erneut.',
          [{ text: 'Erneut versuchen', onPress: handlePurchase }, { text: 'Abbrechen' }]
        );
        return;
      }
      if (rcError.code === PurchasesErrorCode.PaymentPendingError) {
        Alert.alert('Zahlung ausstehend', 'Deine Zahlung wird gerade verarbeitet. Coins werden bald gutgeschrieben.');
        return;
      }
    }
    Alert.alert(
      'Kauf fehlgeschlagen',
      'Ein unerwarteter Fehler ist aufgetreten. Versuche es in ein paar Minuten erneut oder kontaktiere den Support.',
      [{ text: 'OK' }]
    );
  }
};
```

**Datei:** `app/coin-shop.tsx`  
**Aufwand:** 30 Minuten

---

### FIX-10 · `profile.tsx` — accessibilityLabel für Grid-Items

**Problem:**
```tsx
// Video-Post und Foto-Post haben identisches Label:
accessibilityLabel={`Post von ${username}`}
```
Screen-Reader kann nicht unterscheiden ob Video oder Bild.

**Fix:**
```tsx
accessibilityLabel={
  item.video_url
    ? `Video-Post von ${username}: ${item.caption?.slice(0, 60) || 'Kein Titel'}`
    : `Foto-Post von ${username}: ${item.caption?.slice(0, 60) || 'Kein Titel'}`
}
accessibilityHint={item.video_url ? 'Doppeltippen um Video abzuspielen' : 'Doppeltippen um Foto zu öffnen'}
```

**Datei:** `app/(tabs)/profile.tsx`  
**Aufwand:** 15 Minuten

---

### FIX-11 · `host.tsx` — Doppelter Alert.prompt für Gift-Goal (UX-Antipattern)

Bereits in FIX-02 adressiert — `LiveGoalSheet.tsx` ersetzt beide verschachtelten Prompts durch ein einziges Bottom-Sheet. Kein separater Fix nötig.

---

### FIX-12 · `FeedItem.tsx` — MusicVinylBadge: Infinite Animation auf inaktiven Items

**Problem:**
```tsx
function MusicVinylBadge({ trackTitle }) {
  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withRepeat(  // ← läuft IMMER, auch wenn Item off-screen
      withTiming(360, { duration: 4000, easing: Easing.linear }),
      -1, false
    );
  }, []);
}
```
Bei 5 sichtbaren Feed-Items: 5 parallel laufende Reanimated-Loops auf dem UI-Thread.

**Fix — Animation nur starten wenn Item aktiv/sichtbar:**
```tsx
function MusicVinylBadge({ trackTitle, isActive }: { trackTitle: string; isActive: boolean }) {
  const rotation = useSharedValue(0);
  
  useEffect(() => {
    if (isActive) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 4000, easing: Easing.linear }), -1, false
      );
    } else {
      cancelAnimation(rotation);  // ← Animation stoppen wenn nicht aktiv
    }
  }, [isActive]);
  ...
}
```

`isActive` prop wird vom Parent `FeedItem` übergeben (der bereits weiß ob das Video abgespielt wird).

**Datei:** `components/feed/FeedItem.tsx`  
**Aufwand:** 20 Minuten

---

### FIX-13 · `explore.tsx` — Fragmentierte StyleSheet-Blöcke nach Component-Ende

**Problem:** 3 separate `StyleSheet.create({})` Blöcke (`emptyBtnStyle`, `shopChipStyle`, `wozBannerStyle`) nach der Component-Definition. Styles sind verstreut, schwer zu übersehen, teilweise nicht durch `useTheme()` zugänglich.

**Fix:** Alle in einen einzigen `const s = StyleSheet.create({})` Block am Ende der Datei zusammenführen. Wo Farben nötig: als inline-prop übergeben (wie es `shopChipStyle.chip` bereits tut — `backgroundColor: colors.bg.elevated` inline).

**Datei:** `app/(tabs)/explore.tsx`  
**Aufwand:** 30 Minuten

---

## PHASE 3 — Design-Token-System (3–4 Tage)

### FIX-14 · Design-Tokens: SPACING, RADII, FONT_SIZE

**Problem — Chaos im aktuellen Stand:**
- **19 verschiedene borderRadius-Werte:** 2, 3, 4, 6, 8, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 999
- **20 verschiedene fontSize-Werte:** 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 20, 22, 24, 26, 28, 32, 36, 48
- **25 verschiedene padding-Kombinationen** in Tabs allein

Jeder Screen sieht leicht anders aus — kein Design-Raster, kein visuelles System.

**Lösung — `lib/tokens.ts` erstellen:**

```typescript
// lib/tokens.ts — Design System Foundation

/** Spacing — 4px Grid (Apple HIG: "use multiples of 4") */
export const SPACE = {
  xs:  4,
  sm:  8,
  md:  12,
  base: 16,
  lg:  20,
  xl:  24,
  '2xl': 32,
  '3xl': 48,
} as const;

/** Border Radius — 4 semantische Stufen */
export const RADII = {
  sm:   6,    // kleine Elemente: Tags, Chips
  md:   12,   // Cards, Sheets, Inputs
  lg:   20,   // Buttons, Karten-Hauptelemente
  full: 999,  // Pill-Buttons, Avatare
} as const;

/** Font Sizes — 6 Stufen (TikTok-Niveau) */
export const FONT_SIZE = {
  xs:   11,   // Timestamps, Meta-Infos
  sm:   13,   // Sekundärtext, Labels
  md:   15,   // Standard-Fließtext (iOS default: 17, aber für Dense-UI: 15)
  lg:   17,   // Headlines, wichtige Labels
  xl:   22,   // Titel, Screen-Headers
  '2xl': 28,  // Hero-Zahlen, große Displays
} as const;

/** Font Weights */
export const FONT_WEIGHT = {
  regular:   '400' as const,
  medium:    '500' as const,
  semibold:  '600' as const,
  bold:      '700' as const,
} as const;

/** Line Heights */
export const LINE_HEIGHT = {
  tight:  1.2,
  normal: 1.4,
  loose:  1.6,
} as const;
```

**Migrations-Strategie:**
1. `lib/tokens.ts` erstellen (fertig mit diesem Plan)
2. Neue Komponenten: sofort `SPACE`, `RADII`, `FONT_SIZE` importieren
3. Bestehende Komponenten: bei Anfassen einer Datei migrieren (opportunistisch)
4. Kein Big-Bang-Rewrite — zu riskant

**Aufwand:** 3 Stunden (Token-File + 5 Haupt-Screens migrieren)

---

## PHASE 4 — Accessibility (1–2 Tage)

### FIX-15 · 236 Pressables ohne `accessibilityLabel`

**Problem:** WCAG 2.1 Level AA, Apple App Store Review Guidelines §8 (Accessibility). Betrifft besonders:
- Feed-Item-Aktionen (Like, Comment, Share, Gift)
- Tab-Bar-Icons
- Header-Back-Buttons
- Live-Stream-Controls

**Migrations-Strategie:**

```tsx
// Priorität 1 — alle Icon-only Pressables (keine sichtbare Text-Beschriftung):
<Pressable
  onPress={handleLike}
  accessibilityRole="button"
  accessibilityLabel={isLiked ? 'Gefällt mir entfernen' : 'Gefällt mir'}
  accessibilityState={{ selected: isLiked }}
>
  <Heart />
</Pressable>

// Priorität 2 — Navigation-Buttons:
<Pressable
  onPress={() => router.back()}
  accessibilityRole="button"
  accessibilityLabel="Zurück"
>
  <ChevronLeft />
</Pressable>
```

**Reihenfolge:** FeedItem → LiveHost Controls → LiveWatch Controls → TabBar → Profile → Messages

**Aufwand:** 4 Stunden

---

## PHASE 5 — Performance & Polish (2–3 Tage)

### FIX-16 · console.* ohne `__DEV__` Guard (SW-08)

**Betroffene Stellen:**
```
lib/useVoiceReader.ts    — 4 console.log/warn Calls
lib/useVoiceClone.ts     — 5 console.log/warn Calls  
lib/useGenerateImage.ts  — 1 console.error Call
lib/useFaceDetection.ts  — 1 console.error Call
app/live/start.tsx       — 1 console.log Call
```

**Fix (alle gleich):**
```tsx
// VORHER:
console.log('LiveKit token:', token);
console.error('Voice clone failed:', err);

// NACHHER:
__DEV__ && console.log('LiveKit token:', token);
if (!__DEV__) { Sentry.captureException(err); } else { console.error('Voice clone failed:', err); }
```

**Aufwand:** 30 Minuten

---

### FIX-17 · Sentry Edge Function testen (SW-15)

**Schritte:**
```bash
# 1. Preview-Branch deployment mit SENTRY_ENABLE_EDGE=1
vercel env add SENTRY_ENABLE_EDGE preview

# 2. Edge-Route aufrufen und prüfen ob __dirname crash
# 3. Wenn ok → Production aktivieren:
vercel env add SENTRY_ENABLE_EDGE production
```

**Aufwand:** 1 Stunde (inkl. Test-Deployment)

---

### FIX-18 · Live-Screens auf LC-Tokens migrieren (SW-13)

**Strategie:**
Token-System in `lib/liveColors.ts` ist fertig (Erstellt 2026-06-08).
Migration muss manuell pro Datei erfolgen (Bulk-Replace zu riskant für StyleSheet-Inline-Objekte).

**Reihenfolge:**
1. `app/live/start.tsx` — kleinste Datei, gutes Warm-Up
2. Neue Komponenten die aus FIX-02 (`LiveGoalSheet.tsx`) entstehen → direkt mit LC
3. `components/live/GiftPicker.tsx` — viele hardcoded Farben
4. `app/live/host.tsx` — größte Datei, letzter Schritt
5. `app/live/watch/[id].tsx`

**Pro-Datei-Vorgehen:**
```bash
# Alle hardcoded Farben in Datei finden:
grep -n "'#\|rgba(\|rgb(" app/live/start.tsx

# Dann manuell ersetzen:
# '#FFFFFF' → LC.text.primary
# '#000000' → LC.black
# 'rgba(0,0,0,0.45)' → LC.bg.chat
# '#ef4444' → LC.accent.danger
# ... usw.
```

**Aufwand:** 4 Stunden gesamt (alle Live-Dateien)

---

### FIX-19 · Loading-Skelette für Haupt-Screens

**Problem:** Alle Screens zeigen nur `ActivityIndicator`. Layout-Shift auf Daten-Eingang ist jarring.
TikTok/Instagram: Skeleton-Screens zeigen exakte Layout-Form, wirken 2× schneller.

**Scope — 3 Screens zuerst:**

#### A) Feed-Screen Skeleton (höchste Visibility)
```tsx
// components/feed/FeedSkeleton.tsx — bereits vorhanden! Prüfen ob korrekt eingebunden.
// Falls nicht: in app/(tabs)/index.tsx während Loading zeigen
```

#### B) Profile-Grid Skeleton
```tsx
// components/profile/ProfileGridSkeleton.tsx
// 3×N Grau-Squares in Grid-Layout (gleiche Dimensionen wie Posts)
// Shimmer-Animation via Reanimated (bereits in FeedSkeleton-Pattern)
```

#### C) Messages-Liste Skeleton
```tsx
// components/messages/MessagesSkeleton.tsx
// Avatar-Kreis + Textzeilen (breite + schmale) mit Shimmer
// 8–10 Einträge
```

**Aufwand:** 6 Stunden (3 Skeleton-Komponenten + Integration)

---

## PHASE 6 — Ops / Monitoring (1 Tag)

### FIX-20 · Stripe Webhook: Klären ob aktiv (SW-18)

**Schritte:**
```bash
# 1. Edge Function prüfen:
cat supabase/functions/stripe-webhook/index.ts

# 2. Supabase Dashboard: Webhook-Logs der letzten 30 Tage
# 3. Codebase nach Stripe-Imports suchen:
grep -r "stripe\|Stripe" app/ lib/ --include="*.ts" --include="*.tsx" -l

# 4. Wenn tot: löschen + in CLAUDE.md dokumentieren
# 5. Wenn aktiv: tests + dokumentieren
```

**Aufwand:** 30 Minuten

---

### FIX-21 · Scheduled Jobs Failure Alerting (SW-19)

**Problem:** `pg_cron` Jobs für `publish-scheduled-posts` und `scheduled-lives-cron` laufen ohne Monitoring. Nach 3 Fehlversuchen → Status `failed` in DB, aber kein Push an Admins.

**Lösung:**
```sql
-- supabase/migrations/20260608120000_scheduled_jobs_alert.sql
-- Trigger auf scheduled_posts.status = 'failed':
CREATE OR REPLACE FUNCTION notify_on_job_failure()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.status = 'failed' AND OLD.status != 'failed' THEN
    -- Admin-Push via send-push-notification Edge Function
    PERFORM http_post(
      current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
      json_build_object(
        'userId', NEW.user_id,
        'title', '⚠️ Geplanter Post fehlgeschlagen',
        'body', 'Ein geplanter Post konnte nicht veröffentlicht werden. Öffne Creator Studio.'
      )::text,
      'application/json'
    );
  END IF;
  RETURN NEW;
END;
$$;
```

**Aufwand:** 1 Stunde

---

### FIX-22 · Success-Haptics hinzufügen (Polish)

**Problem:** Haptics gibt es nur beim Tippen (`.Light`), nie beim Abschluss einer Aktion.

**Wo hinzufügen:**
```tsx
// Nach erfolgreichem Kauf (coin-shop.tsx):
import * as Haptics from 'expo-haptics';
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Nach Nachricht gesendet (messages):
Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);  // schon vorhanden ✓

// Nach Gift gesendet (watch/[id].tsx):
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Nach Live-Stream gestartet (host.tsx):
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

// Nach Post veröffentlicht (create/index.tsx):
Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
```

**Aufwand:** 1 Stunde

---

### FIX-23 · Vage 'Unbekannter Fehler' Meldungen verbessern

**Betroffene Stellen (grep-basiert):**
```
app/(tabs)/profile.tsx    — "Fehler beim Laden"
app/live/host.tsx         — "Stream konnte nicht gestartet werden" (gut) 
app/live/watch/[id].tsx   — "Fehler beim Beitreten" (zu generisch)
lib/useGifts.ts           — kein User-Feedback bei Gift-Fehlern
app/create/index.tsx      — "Upload fehlgeschlagen" (fehlt retry)
```

**Fix-Pattern für alle:**
```tsx
// Fehler-Klassifizierung:
function getErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message.includes('network') || err.message.includes('fetch')) {
      return 'Keine Internetverbindung. Prüfe deine Verbindung und versuche es erneut.';
    }
    if (err.message.includes('timeout')) {
      return 'Zeitüberschreitung. Die Verbindung ist zu langsam.';
    }
    if (err.message.includes('permission') || err.message.includes('RLS')) {
      return 'Keine Berechtigung für diese Aktion.';
    }
  }
  return 'Ein unerwarteter Fehler ist aufgetreten. Versuche es erneut.';
}
```

**Aufwand:** 2 Stunden

---

## Ausführungsreihenfolge (empfohlen)

```
Tag 1 — Kritische Bugs (Phase 1):
  ✦ FIX-01  settings.tsx AGB-Link          (5 Min)
  ✦ FIX-03  profile.tsx Grid-Gap           (10 Min)
  ✦ FIX-04  GIPHY Key Fallback             (15 Min)
  ✦ FIX-16  console.* __DEV__ Guards       (30 Min)
  ✦ FIX-07  messages keyboardDismissMode   (5 Min)
  ✦ FIX-06  messages ItemSeparator         (10 Min)
  ✦ FIX-10  profile accessibilityLabel     (15 Min)
  ✦ FIX-12  MusicVinylBadge Animation      (20 Min)
  ✦ FIX-02  host.tsx Alert.prompt → Modal  (2h) ← größter Task

Tag 2 — UX & Features (Phase 2):
  ✦ FIX-08  messages EmptyState            (30 Min)
  ✦ FIX-09  coin-shop Fehlermeldungen      (30 Min)
  ✦ FIX-13  explore.tsx StyleSheets        (30 Min)
  ✦ FIX-14  lib/tokens.ts erstellen        (3h) ← Design System Foundation
  ✦ FIX-22  Success-Haptics               (1h)

Tag 3 — Performance & Design (Phase 3+4):
  ✦ FIX-18  LC-Token-Migration start.tsx   (1h)
  ✦ FIX-19  Skeleton-Screens (Feed+Profile)(4h)
  ✦ FIX-05  r2-delete ins Repo            (1h)

Tag 4–5 — Accessibility + Ops (Phase 4+5+6):
  ✦ FIX-15  236 accessibilityLabels        (4h)
  ✦ FIX-17  Sentry Edge testen            (1h)
  ✦ FIX-20  Stripe Webhook klären         (30 Min)
  ✦ FIX-21  Scheduled Jobs Alerting       (1h)
  ✦ FIX-23  Vage Fehlermeldungen          (2h)
```

---

## Tracking

| ID | Titel | Prio | Phase | Aufwand | Status |
|---|---|---|---|---|---|
| FIX-01 | settings.tsx: AGB-Link | 🔴 P1 | 1 | 5 Min | ✅ 2026-06-08 |
| FIX-02 | host.tsx: Alert.prompt → LiveGoalSheet | 🔴 P1 | 1 | 2h | ✅ 2026-06-08 |
| FIX-03 | profile.tsx: Grid rowGap | 🔴 P1 | 1 | 10 Min | ✅ 2026-06-08 |
| FIX-04 | GIPHY Key Fallback entfernen | 🔴 P1 | 1 | 15 Min | ✅ 2026-06-08 |
| FIX-05 | r2-delete ins Repo | 🔴 P1 | 3 | 1h | ⛔ |
| FIX-06 | messages ItemSeparator useCallback | 🟡 P2 | 1 | 10 Min | ✅ 2026-06-08 |
| FIX-07 | messages keyboardDismissMode | 🟡 P2 | 1 | 5 Min | ✅ 2026-06-08 |
| FIX-08 | messages ListEmptyComponent | 🟡 P2 | 2 | 30 Min | ✅ war schon vorhanden |
| FIX-09 | coin-shop Fehlermeldungen | 🟡 P2 | 2 | 30 Min | ✅ 2026-06-08 |
| FIX-10 | profile accessibilityLabel differenziert | 🟡 P2 | 1 | 15 Min | ✅ 2026-06-08 |
| FIX-11 | host.tsx Goal: doppelter Prompt (via FIX-02) | 🟡 P2 | 1 | — | ✅ via FIX-02 |
| FIX-12 | MusicVinylBadge Infinite-Anim | 🟡 P2 | 1 | 20 Min | ✅ 2026-06-08 |
| FIX-13 | explore.tsx StyleSheet-Fragmente | 🟡 P2 | 2 | 30 Min | ✅ 2026-06-08 |
| FIX-14 | lib/tokens.ts Design-Token-System | 🟡 P2 | 2 | 3h | ✅ 2026-06-08 — tokens.ts + messages.tsx migriert |
| FIX-15 | 236 Pressables accessibilityLabel | 🟢 P3 | 4 | 4h | ⛔ |
| FIX-16 | console.* __DEV__ Guards | 🟢 P3 | 1 | 30 Min | ⛔ |
| FIX-17 | Sentry Edge testen | 🟢 P3 | 5 | 1h | ⛔ |
| FIX-18 | LC-Token-Migration Live-Screens | 🟢 P3 | 3 | 4h | ✅ 2026-06-08 — start.tsx vollständig migriert |
| FIX-19 | Loading-Skelette (Feed, Profile, Messages) | 🟢 P3 | 3 | 6h | ✅ 2026-06-08 — Feed war schon da; ProfileGridSkeleton + MessagesSkeleton neu |
| FIX-20 | Stripe Webhook klären | 🟢 P3 | 6 | 30 Min | ✅ 2026-06-08 — AKTIV: Web-Checkout für Coins |
| FIX-21 | Scheduled Jobs Alerting | 🟢 P3 | 6 | 1h | ✅ 2026-06-08 — Migration 20260608130000_scheduled_jobs_failure_alert.sql |
| FIX-22 | Success-Haptics | 🟢 P4 | 2 | 1h | ✅ 2026-06-08 — coin-shop, create, watch, host |
| FIX-23 | Vage Fehlermeldungen verbessern | 🟢 P4 | 6 | 2h | ✅ 2026-06-08 — coin-shop, create, messages/[id].tsx verbessert |

**Gesamt-Aufwand:** ~35 Stunden verteilt auf 5 Tage
