# Monitoring — Wer wacht worüber (Zaurs Überblick)

> Stand: 3. Juli 2026. In einfacher Sprache — das ist dein Spickzettel.
> **Grundprinzip: Du überwachst nichts aktiv. Die Systeme wachen — du reagierst nur, wenn es klingelt. Stille = alles grün.**

---

## Die 4 Ebenen (von außen nach innen)

### 1️⃣ Erreichbarkeit — „Ist Serlo überhaupt da?"
- **Wer wacht:** UptimeRobot (uptimerobot.com, dein Konto)
- **Was genau:** 3 Monitore, alle 5 Minuten:
  - `serlo-web.vercel.app/` (Startseite)
  - `serlo-web.vercel.app/shop` (Verkaufsseite)
  - `…supabase.co/auth/v1/health` (Backend/Datenbank-Gateway)
- **Alarm:** E-Mail. Optional: UptimeRobot-App fürs Handy (Push).
- **Bedeutet bei Alarm:** Die Seite ist für ALLE down — schlimmster Fall, sofort reagieren.

### 2️⃣ Nutzer-Fehler — „Kracht es bei jemandem?"
- **Wer wacht:** Sentry — `brandwerkx.sentry.io`, Projekt `javascript-react` (App **und** Web zusammen)
- **Was genau:** Jeder Crash/Fehler bei echten Nutzern, mit lesbarem Stack-Trace (Source Maps seit 2.7.), bei Web-Fehlern sogar Session-Replay (Video-artige Aufzeichnung).
- **Alarm:** E-Mail bei High-Priority-Issues (Regel „Send a notification for high priority issues").
- **Verkabelung:** App: `EXPO_PUBLIC_SENTRY_DSN` in `.env`/EAS · Web: 4 Variablen in **Vercel** (`NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG=brandwerkx`, `SENTRY_PROJECT=javascript-react`, `SENTRY_AUTH_TOKEN`). ⚠️ Ohne DSN in Vercel ist Web-Sentry AUS (so war's bis 2.7.!).

### 3️⃣ Code & System — „Ist ein Fehler in den Code gerutscht? Läuft das System sauber?"
- **Wer wacht:** 5 GitHub-Actions-Wächter (github.com/vibestes-boop/vibes-app → Actions):
  | Wächter | Wann | Prüft |
  |---|---|---|
  | `typecheck` | jeder Push | TypeScript App + Web |
  | `test` | jeder Push | Jest-Tests App + Web |
  | `stability` | jeder Push + **5:17 & 17:17 Uhr täglich** | Routen, API-Verträge, Media-Budget, Backend-Integrität, Auth-Interaktionen |
  | `e2e-smoke` | jeder Push + 2× täglich | echte Browser-Prüfung der Live-Website |
  | `weekly-integrity` | sonntags 7:43 | Daten-Tiefenprüfung + R2-Speicher; öffnet GitHub-Issue bei Rot |
- **Alarm:** **Telegram-Ping** aufs Handy (eigener Alert-Bot; Secrets `TELEGRAM_BOT_TOKEN`/`TELEGRAM_CHAT_ID` im Repo). Verkabelung: `.github/actions/telegram-alert` + `telegram-alert`-Job in allen 5 Workflows.
- **Wichtig:** Seit 2.7. ist die Baseline **0 Fehler** (alles grün). Rot ist ab jetzt IMMER ein echtes Signal — nie ignorieren, nie „das ist halt so" werden lassen.

### 4️⃣ Geld — „Kommt Geld sauber an?"
- **Wer wacht:** Stripe selbst (Kommunikationseinstellungen → Tab API → Webhook-Fehler ✓)
- **Bedeutet bei Alarm:** Stripe konnte deiner App eine Zahlung nicht melden → eine Bestellung hängt evtl. auf „Zahlung wird bestätigt". Diagnose: Stripe → Entwickler → Webhooks → Ereignisübermittlungen (401 = Gate-Problem, 200 = ok). Details: Memory/Doku `vibes-edge-webhook-verify-jwt`.
- **Wahrheit über Zahlungen:** immer das Stripe-Dashboard, nicht die App.
- RevenueCat (App-Coins): **geparkt** bis Coin-Launch; Webhook ist fail-closed abgesichert.

---

## Dein Alarm-Spickzettel: Kanal → Bedeutung → erster Schritt

| Es klingelt… | Absender | Bedeutet | Dein erster Schritt |
|---|---|---|---|
| 📱 Telegram | Alert-Bot | CI-Wächter rot (Code/System) | Link im Ping öffnen → Workflow-Name + Fehlerzeile an Claude geben |
| 📧 UptimeRobot | „Monitor is DOWN" | Website/Backend nicht erreichbar | Selbst Seite öffnen; Vercel-Status + Supabase-Status-Seite prüfen; Claude holen |
| 📧 Sentry | „New issue" | Ein Nutzer hatte einen Crash/Fehler | Issue-Link öffnen → an Claude geben (Stack-Trace ist jetzt lesbar) |
| 📧 Stripe | Webhook-Fehler | Zahlungs-Meldung an die App scheitert | Stripe → Webhooks → Deliveries anschauen → Claude holen |
| 📧 GitHub | Issue „stability-alert" | Wöchentliche Tiefenprüfung rot | Issue lesen → an Claude geben |

## Dein Rhythmus

- **Täglich:** nichts. Ehrlich. Kein Dashboard-Ritual — die Alarme kommen zu dir.
- **Wöchentlich (2 Min, optional):** GitHub → Actions → alles grün? · Sentry → Issues → was Neues?
- **Vor Invite-Wellen / Launch-Entscheidungen:** im Repo `npm run launch:scorecard` (sagt dir GO oder WARUM NICHT) und `npm run health:dashboard` (14 Bereiche auf einen Blick).

## Wo alles konfiguriert ist (falls du je etwas ändern musst)

| Was | Wo |
|---|---|
| UptimeRobot-Monitore | uptimerobot.com → dein Konto |
| Sentry-Projekt + Alert-Regeln | brandwerkx.sentry.io (Projekt javascript-react) |
| Sentry-Web-Verkabelung | Vercel → serlo-web → Settings → Environment Variables (4 Stück) |
| Telegram-Alarm | GitHub-Repo → Settings → Secrets → `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID`; Code in `.github/actions/telegram-alert/` |
| CI-Wächter | `.github/workflows/*.yml` |
| Health-Skripte | `package.json` (`health:dashboard`, `launch:scorecard`, …) + `docs/stability/` |
| Stripe-Mails | Stripe-Dashboard → Kommunikationseinstellungen → Tab API |
| Supabase-Logs (Detektiv-Arbeit) | supabase.com Dashboard → Logs |
