# Admin Command Center Ausbauwellen

Ziel: Die Web-Admin-Konsole bleibt die zentrale Operations-Oberflaeche fuer Web,
Mobile-Web und App-Betrieb. Native Admin bleibt Companion/Link-Hub und bekommt
keine eigene kritische Mutationslogik.

## Welle 0: Release-Stabilitaet

Status: umgesetzt.

- `npm run release:gate` prueft Web-Mutations-Audit, Typecheck, Lint,
  Supabase-Migrationsdrift und Production-Smokes.
- `scripts/audit-web-post-mutations.sh` nutzt `rg`, faellt aber auf `git grep`
  oder `grep` zurueck, wenn `rg` in der Shell fehlt.
- Supabase-Drift muss vor Deploy gruen sein.

## Welle 1: Nutzerverwaltung

Status: erste operative Version umgesetzt.

- `/admin/users` nutzt echte Backend-Daten.
- Suche, Status, Rolle, Verifizierung, Aktivitaet und Risiko laufen ueber
  `admin_user_directory_page`.
- Pagination ist serverseitig.
- Admin kann Rollen aendern.
- Admin kann Nutzer sperren, verifizieren, restricten und shadowbannen.
- Identity- und Audit-Daten kommen aus `admin_user_detail_snapshot`.

## Welle 2: Command Center

Status: erste operative Version umgesetzt.

- Health-Bereiche zeigen echte Snapshots.
- Gelbe/rote Bereiche erscheinen als aktive Warnkarten.
- Warnkarten nennen Ursache und naechsten Schritt.
- Quick Actions verlinken auf spezialisierte Admin-Seiten.
- Mutationen bleiben ausserhalb des Dashboards auf fokussierten Seiten.

## Welle 3: Product Recovery

Status: Monitoring und Review-Pfad umgesetzt, Produktentscheidung offen.

Wenn `Product Metrics` gelb ist:

- North Star pruefen.
- Creator mit Account aber ohne Post finden.
- Creator mit Post aber ohne sinnvolle Interaktion finden.
- Onboarding-Funnel pruefen: Registrierung -> Profil -> erster Post ->
  erste sinnvolle Interaktion.
- Nicht-Activation-Features pausieren, wenn North Star wiederholt 0 bleibt.

## Welle 4: Push & Feed Recovery

Status: Monitoring und Review-Pfad umgesetzt, Ursachenanalyse offen.

Wenn `Push/Feed` gelb ist:

- Unread-Backlog pruefen.
- Native Push Tokens und aktive 30d Tokens pruefen.
- Feed Endpoint, Empty Feed und Thumbnail Health pruefen.
- Bei hohem Backlog entscheiden: Cleanup, Mark-as-read-Strategie oder
  Produktverhalten korrigieren.

## Welle 5: Trust & Safety

Status: erste operative Version umgesetzt.

- Reports laufen zentral ueber `content_reports`.
- Admin kann Reports pruefen und Enforcement ausloesen.
- User-Detail erlaubt direkte Safety-Aktionen fuer Admins.
- Audit-Log dokumentiert Admin-Aktionen.
- Oeffentliche Feeds/Profile muessen banned/shadowbanned Autoren ausblenden.

## Welle 6: Governance & Ownership

Status: erste operative Version umgesetzt.

- Owner-Matrix liegt in `docs/stability/ownership.json`.
- Weekly Review nutzt Product, Push/Feed, Moderation, Cost und Governance Health.
- Neue Features brauchen Zielmetrik, Kostenrisiko, Rollback, Monitoring und
  Feature Flag.

## Spaeter Manuell Durch Den Account-Owner

Diese Punkte brauchen externe Accounts oder echte Produktentscheidungen:

- Vercel Production Deploy ausloesen.
- Supabase Auth SMTP/Provider so konfigurieren, dass Invite-Mails direkt
  zugestellt werden.
- Provider-Kosten aus Cloudflare, Supabase, Vercel und LiveKit durch echte APIs
  ersetzen, sobald die passenden Tokens/Billing Exports verfuegbar sind.
- Product Recovery entscheiden: Welche Creator werden aktiviert, welche Features
  werden pausiert?
- Push/Feed Recovery entscheiden: Unread-Backlog bereinigen oder Produktlogik
  anpassen?
