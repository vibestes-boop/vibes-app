# Migrations-Tracking begradigen

**Das Problem:** 61 Migrationen (`20260614190000` bis `20260716130000`) gelten im
Tracking als nicht eingespielt, obwohl sie damals von Hand im SQL-Editor liefen.
Solange das so bleibt, ist **jedes `supabase db push` eine Falle** — es würde
alle 61 erneut fahren und bei der ersten nicht-idempotenten Anweisung mittendrin
abbrechen.

**Warum nicht einfach markieren:** Eine Migration als eingespielt zu markieren,
die es nicht ist, macht eine echte Schema-Lücke **für immer unsichtbar**. Bei
`drop_debug_coin_backdoors` hieße das zum Beispiel: Die Hintertüren lägen weiter
in der Produktivdatenbank, und niemand würde es je wieder bemerken.

Deshalb erst prüfen, dann markieren.

---

## Schritt 1 — Prüfen (nur lesen)

`tracking-pruefung.sql` im Supabase-SQL-Editor ausführen. Die Abfrage schreibt
nichts: kein `INSERT`, kein `UPDATE`, kein `DROP`. Sie schlägt 75 Funktionen,
24 Policies, 21 Indizes, 2 Speicher-Eimer, 6 gelöschte Indizes, 3 gelöschte
Funktionen und eine Spalten-Nullbarkeit in den Systemtabellen nach.

| Ergebnis | Bedeutung |
|---|---|
| **leer** | Alle geprüften Objekte sind da. Weiter mit Schritt 2. |
| **Zeilen** | Genau diese Objekte fehlen. Die betroffene Migration **nicht** markieren, sondern ihre Datei erst im SQL-Editor nachziehen. |

Zwei Befunde sind umgekehrt zu lesen und wiegen schwer:
`Funktion noch da (haette geloescht sein muessen)` und `Index nicht geloescht`
bedeuten, dass eine Aufräum-Migration **nicht** gelaufen ist.

## Schritt 2 — Markieren

Nur bei leerem Ergebnis. Ein Aufruf für alle 61:

```bash
supabase migration repair --status applied $(ls supabase/migrations/*.sql | sed -n 's#.*/\([0-9]\{14\}\)_.*#\1#p' | awk '$1>="20260614190000" && $1<="20260716130000"')
```

Danach `supabase migration list` — die mittlere Spalte muss überall gefüllt sein.

## Schritt 3 — Schema-Abzug erneuern

`supabase/schema_live.sql` ist vom **14.06.2026** und damit älter als fast alle
61 Migrationen — obwohl CLAUDE.md ihn als Quelle der Wahrheit führt. Nach der
Reparatur neu ziehen, sonst prüft die nächste Spalten-Frage gegen einen
zwei Monate alten Stand.

```bash
supabase db dump --schema public -f supabase/schema_live.sql
```

Braucht Docker Desktop (auf diesem Rechner nicht installiert). Alternativ direkt
mit `pg_dump` und der Verbindungs-URI, wie in CLAUDE.md beschrieben.

**Ohne beides geht es nicht.** Am 14.08. probiert: Die REST-Schnittstelle
liefert unter `/rest/v1/` zwar eine vollständige Beschreibung aller Tabellen und
Spalten — aber nur gegen einen **geheimen** Schlüssel („Only secret API keys can
be used for this endpoint"), nicht gegen den öffentlichen. Einzelne Tabellen und
Spalten lassen sich mit dem öffentlichen Schlüssel gezielt abfragen, eine
vollständige Liste aufzählen nicht.

---

## Was die Prüfung NICHT abdeckt

Vier der 61 ändern nur bestehende Dinge und haben kein Objekt, dessen bloße
Existenz etwas beweist:

| Datei | ändert |
|---|---|
| `20260614190000_pin_definer_search_path.sql` | `search_path` bestehender Funktionen |
| `20260619140000_collectible_and_web_coin_prices.sql` | Preis-Daten |
| `20260627140000_notification_types_orders.sql` | CHECK-Bedingung auf `notifications.type` |
| `20260707120000_fix_account_deletion_fks.sql` | Lösch-Regeln bestehender Fremdschlüssel |

Bei diesen vieren würde ein Fehlen als **Verhaltensfehler** auffallen, nicht als
fehlendes Objekt — eine Benachrichtigung, die abgelehnt wird, ein Konto, das
sich nicht löschen lässt. Sie mitzumarkieren ist vertretbar; wer ganz sicher
gehen will, sieht sich die vier Dateien einzeln an.
