# `shared/` — Cross-Platform Code

Dieser Ordner enthält Code, der von **beiden** Plattformen importiert wird:

- **Native-App** (Expo) — Pfade via relativem Import: `import { … } from '../../shared/types'`
- **Web-App** (Next.js, `apps/web/`) — Pfade via Alias: `import { … } from '@shared/types'`

## Regeln

1. **Kein `react-native` Import erlaubt.** Alles hier muss platform-agnostisch sein.
2. **Keine DOM-APIs.** Kein `window`, `document`, `fetch` ohne Polyfill-Guard.
3. **Nur TypeScript-Types, Zod-Schemas, pure Functions, reine Daten-Kataloge.**
4. **Keine State-Management-Hooks.** `zustand` / `react-query` bleiben pro-App.

## Struktur

```
shared/
├── types/          — TypeScript Interfaces (Profile, LiveSession, Gift, Product, Poll)
├── schemas/        — Zod-Schemas für Form-Validation
├── catalog/        — Statische Kataloge (Gift-Definitionen)
├── moderation/     — Wortlisten (DE/EN/RU/CE) + Regex-Utilities
└── theme/          — Design-Tokens (Farben, Spacing) — gemeinsame Quelle
```
