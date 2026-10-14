-- ─────────────────────────────────────────────────────────────────────────────
-- Der Push-Rückfall wird abgeschaltet — Berkat hat jetzt eigene Geräte
--
-- ── WAS ER WAR UND WARUM ES IHN GAB ─────────────────────────────────────────
--
-- `send_push_to_user` filtert seit `20260814190000` auf die App. Findet sich
-- KEIN Gerät der Ziel-App, ging die Meldung bisher an **alle** Geräte des
-- Nutzers. Der Rumpf begründet das selbst:
--
--   „Solange Berkat noch keinen Token registriert (braucht expo-notifications
--    und damit einen EAS-Rebuild), bekommt ein Nutzer mit beiden Apps den
--    Zuschlag so wenigstens in Serlo. Unschön, aber besser als Stille."
--
-- Er nennt auch die Bedingung, unter der er weg soll: „Sobald Berkat Tokens
-- registriert, greift der Filter und dieser Zweig läuft leer."
--
-- ── ⚠️ DIE BEDINGUNG IST GEMESSEN, NICHT ANGENOMMEN ─────────────────────────
--
-- Am 26.08.2026 im SQL-Editor:
--
--     SELECT app, count(*) FROM push_tokens GROUP BY app;
--     serlo  | 5
--     berkat | 1
--
-- **Zwei Zeilen, keine mit `NULL`.** Jedes registrierte Gerät trägt einen
-- App-Wert; es gibt also keinen Token, der durch das Abschalten stumm würde.
-- Hätte dort eine `NULL`-Zeile gestanden, wären genau diese Geräte ab sofort
-- ohne Meldung — und zwar lautlos.
--
-- ⚠️ Das war der einzige Grund, warum diese Migration nicht schon gestern kam:
-- Die Zahl liess sich von aussen nicht messen (`push_tokens` gibt `anon`
-- nichts heraus), und blind entfernt hätte der Rückfall still Meldungen
-- abgeschnitten.
--
-- ── WAS SICH ÄNDERT ─────────────────────────────────────────────────────────
--
-- Vorher: Berkat-Meldung an einen Nutzer ohne Berkat-Gerät → landete in SERLO.
-- Nachher: sie kommt nicht an.
--
-- Das ist die richtige Antwort. Eine Berkat-Meldung in Serlos App ist keine
-- Zustellung, sondern eine Verwechslung — der Empfänger tippt darauf und landet
-- in einer App, die den Artikel gar nicht kennt (Übergabe 78).
--
-- ⚠️ Rumpf ZEICHENGLEICH aus dem Abzug übernommen. Geändert ist genau eine
-- Bedingung in der Schleife, und der Kommentar darüber. Signatur unverändert →
-- `CREATE OR REPLACE` statt DROP+CREATE: keine Rechte-Rücksetzung auf PUBLIC
-- (die `credit_coins`-Falle vom 14.08.), keine zweite Überladung, kein HTTP 300.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION "public"."send_push_to_user"("p_user_id" "uuid", "p_title" "text", "p_body" "text", "p_data" "jsonb" DEFAULT '{}'::"jsonb", "p_app" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'extensions', 'pg_temp'
    AS $$
DECLARE
  v_token TEXT;
  v_count INT;
BEGIN
  -- Stale Tokens (> 90 Tage nicht gesehen) aufräumen
  DELETE FROM public.push_tokens
   WHERE user_id = p_user_id
     AND last_seen_at < NOW() - INTERVAL '90 days';

  -- Gibt es Geräte der Ziel-App?
  --
  -- ⚠️ `v_count` wird weiterhin gezählt, obwohl der Rückfall weg ist. Die Zeile
  -- kostet nichts und hält die Diagnose offen: Wer je wissen will, ob eine
  -- Meldung mangels Gerät verpuffte, hat die Zahl hier stehen. Sie zu streichen
  -- hiesse, die Frage „warum kam nichts an?" unbeantwortbar zu machen.
  SELECT COUNT(*) INTO v_count
    FROM public.push_tokens
   WHERE user_id = p_user_id
     AND (p_app IS NULL OR app = p_app);

  -- ⚠️ KEIN RÜCKFALL MEHR (26.08.2026). Hier stand `OR v_count = 0` — damit
  -- ging eine Berkat-Meldung an ein SERLO-Gerät, wenn der Nutzer Berkat nicht
  -- installiert oder Mitteilungen nicht erlaubt hatte. Das ist keine
  -- Zustellung, sondern eine Verwechslung: Der Empfänger tippt darauf und
  -- landet in einer App, die den Artikel nicht kennt (Übergabe 78).
  --
  -- Abgeschaltet wurde er erst, nachdem gemessen war, dass JEDES registrierte
  -- Gerät einen App-Wert trägt (serlo 5, berkat 1, kein NULL). Ohne diese
  -- Messung hätte das Abschalten stumme Geräte erzeugt, und zwar lautlos.
  FOR v_token IN
    SELECT token FROM public.push_tokens
     WHERE user_id = p_user_id
       AND (p_app IS NULL OR app = p_app)
  LOOP
    PERFORM send_expo_push(
      token := v_token,
      title := p_title,
      body  := p_body,
      data  := p_data
    );
  END LOOP;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- GEGENPROBEN
-- ─────────────────────────────────────────────────────────────────────────────
--
-- 1 · Die Bedingung ist wirklich weg — nicht nur der Kommentar:
--     SELECT prosrc LIKE '%v_count = 0%' AS rueckfall_noch_da
--       FROM pg_proc WHERE proname = 'send_push_to_user';
--     → erwartet `false`
--
-- 2 · ⚠️ Die Probe am Gerät, und sie braucht beide Apps: Eine Berkat-Meldung
--     auslösen für ein Konto OHNE Berkat-Token. Erwartet: **nichts** kommt an —
--     insbesondere nicht in Serlo. Vorher wäre sie dort gelandet.
--
-- 3 · Gegenkontrolle, sonst beweist Probe 2 nichts: Dasselbe Konto MIT
--     Berkat-Token → die Meldung kommt in Berkat an. Ohne diese Hälfte lässt
--     sich „nichts kam an" nicht von „Push ist kaputt" unterscheiden.
-- ─────────────────────────────────────────────────────────────────────────────
