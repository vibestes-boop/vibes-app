# Live-Features Deployment Checklist — v1.15.2

> Alle 6 Phasen der DUETT-Roadmap sind im Code fertig.
> Code kompiliert sauber (`npx tsc --noEmit`). Hier die Schritte
> zum Rollout.

---

## 1. Supabase Migrations anwenden

Reihenfolge wichtig — Phase 5 muss vor Phase 3 laufen, weil
`approve_cohost` (Phase 3) die `is_cohost_blocked`-Funktion (Phase 5)
aufruft.

```bash
supabase migration up
```

Oder manuell über das Dashboard SQL-Editor (neueste zuerst):

| Reihenfolge | Datei | Phase |
|-------------|-------|-------|
| 1 | `supabase/migrations/20260417020000_live_cohosts.sql`        | Base (Phase 1) |
| 2 | `supabase/migrations/20260417210000_live_cohost_blocks.sql`  | Phase 5 — Persistente Blocklist |
| 3 | `supabase/migrations/20260417220000_live_chat_moderation.sql`| Phase 6 — Timeouts + Slow-Mode |
| 4 | `supabase/migrations/20260417230000_live_cohosts_multi.sql`  | Phase 3 — Multi-Guest slot_index |

### Verifikation

```sql
-- Slow-Mode Column existiert?
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'live_sessions' AND column_name = 'slow_mode_seconds';

-- slot_index Column existiert?
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'live_cohosts' AND column_name = 'slot_index';

-- Block-Tabelle da?
SELECT to_regclass('public.live_cohost_blocks') IS NOT NULL AS exists;

-- Chat-Timeout-Tabelle da?
SELECT to_regclass('public.live_chat_timeouts') IS NOT NULL AS exists;

-- approve_cohost hat Phase-3-Kapazität?
SELECT pg_get_functiondef('public.approve_cohost(uuid, uuid)'::regprocedure)
  LIKE '%Max. 8 Co-Hosts%';
```

Alle sollten `true` / nicht-null liefern.

---

## 2. Realtime-Publication

Phase 3 aktiviert `live_cohosts` automatisch für Supabase Realtime
(siehe Migration). Verifikation:

```sql
SELECT schemaname, tablename
  FROM pg_publication_tables
 WHERE pubname = 'supabase_realtime'
   AND tablename IN ('live_cohosts', 'live_chat_timeouts');
```

Erwartet: 2 Zeilen (falls `live_chat_timeouts` fehlt, lies die Phase-6
Migration nochmal — dort wurde sie NICHT zur Publication hinzugefügt;
stattdessen nutzen wir Broadcast-Channels für Timeouts).

---

## 3. EAS Build + Submit

```bash
# iOS Production Build
eas build --platform ios --profile production --non-interactive

# Nach erfolgreichem Build: App Store einreichen
eas submit --platform ios --latest
```

### Build-Metadaten (schon in `app.json` gesetzt):
- `version`:     **1.15.2**
- `buildNumber`: **242**
- `versionCode`: **27**

---

## 4. Smoke-Tests nach Release

| # | Test | Erwartet |
|---|------|----------|
| 1 | Host startet Live → Viewer fordert Co-Host an → Host akzeptiert | Split-Screen in < 3s |
| 2 | Host wechselt Layout (Grid 2×2) im laufenden Stream | Runtime-Switch ohne Remount, kein Black-Screen |
| 3 | Host lädt 3 weitere Co-Hosts in Grid 3×3 ein | 4 Tiles sichtbar, `slot_index` 0..3 stabil |
| 4 | 9. User versucht beizutreten | Fehler "Max. 8 Co-Hosts" mit HINT='capacity' |
| 5 | Host muted Co-Host Audio | Remote 🔇-Badge, Mic-Icon gestrichen |
| 6 | Host kickt mit "Beleidigung" + 24h Block | Co-Host sieht Alert, kann 24h nicht rejoinen |
| 7 | Host ruft `/cohost-blocks` auf | Blockierter User sichtbar, Unblock funktioniert |
| 8 | Host aktiviert Slow-Mode 30s | Viewer-TextInput zeigt Cool-Down, Spam blockiert |
| 9 | Host gibt User 5min Timeout | Betroffener User sieht "stumm für 5 min", andere nicht |
| 10 | Battle-Mode: 5-min Countdown | Victory-Animation am Ende, Force-End funktioniert |

---

## 5. Rollback-Plan

Falls ein Phase-3/6-Feature in Production Probleme macht:

- **Grid-Mode deaktivieren**: `UPDATE live_sessions SET duet_layout='top-bottom' WHERE status='active';`
- **Slow-Mode deaktivieren**: `UPDATE live_sessions SET slow_mode_seconds=0 WHERE status='active';`
- **Chat-Timeouts pausieren**: `DELETE FROM live_chat_timeouts WHERE until_ts > now();`
- **Blocklist flushen**: `UPDATE live_cohost_blocks SET unblocked_at=now() WHERE unblocked_at IS NULL;`

Die Migrations selbst sind rückwärts-kompatibel — alte Clients (vor v1.15.2)
ignorieren die neuen Spalten still.
