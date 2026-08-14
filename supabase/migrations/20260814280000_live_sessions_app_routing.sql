-- Live-Sessions pro App trennen — eine Berkat-Show gehört nicht in Serlos Live-Bereich.
--
-- BEFUND: `live_sessions` ist eine geteilte Tabelle. Eine Berkat-Auktions-Show ist
-- darin eine ganz normale Zeile (`apps/berkat/lib/useStudio.ts`, `useCreateShow` →
-- INSERT mit status='active', category='shopping'). Serlos Listen-Queries holen
-- aber ALLE aktiven Sessions ohne App-Unterscheidung. Folge:
--
--   * Wer in Berkat eine Auktion startet, erscheint für echte Serlo-Nutzer im
--     Live-Bereich der Produktions-App — in einer App ohne Gebots-Oberfläche.
--   * Jeder Berkat-Testlauf ist damit öffentlich sichtbar.
--   * Umgekehrt genauso: Berkats Startseite listete bisher auch Serlo-Lives.
--
-- LÖSUNG: Dieselbe App-Dimension wie beim Push-Routing vom 14.08.2026
-- (20260814190000_push_app_routing.sql). DEFAULT 'serlo' ist bewusst gewählt,
-- nicht NULL — die überwiegende Mehrheit der Bestandszeilen stammt aus Serlo.
--
-- ABER anders als beim Push-Routing reicht der Default hier NICHT: Berkat hat
-- bereits Sessions angelegt. Abschnitt 1b ordnet die über das room_name-Präfix
-- nachträglich zu. Am 14.08.2026 gegen die Live-DB gezählt: 197 `vibes-…`
-- (Serlo nativ + Web), 9 `obs-…` (Serlos WHIP-Ingress), 20 `berkat-…`, keine
-- ohne room_name. Der Backfill betrifft also genau die 20 Berkat-Zeilen.
--
-- ⚠️ Serlo liegt im App Store. Ausgelieferte Versionen kennen die Spalte nicht
-- und filtern nicht darauf — die dürfen nicht brechen. Deshalb NOT NULL nur MIT
-- Default, und keine Änderung an bestehenden Signaturen oder Rückgabetypen.
-- Alte Clients sehen nach dieser Migration weiterhin alles; erst der neue
-- Client-Code filtert. Das ist der gewollte, schrittweise Rollout.

BEGIN;

-- ─── 1. App-Dimension ────────────────────────────────────────────────────────
ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS app text NOT NULL DEFAULT 'serlo';

ALTER TABLE public.live_sessions DROP CONSTRAINT IF EXISTS live_sessions_app_check;
ALTER TABLE public.live_sessions ADD CONSTRAINT live_sessions_app_check
  CHECK (app IN ('serlo', 'berkat'));

COMMENT ON COLUMN public.live_sessions.app IS
  'Herkunfts-App der Session: serlo | berkat. Steuert, in welcher App die Session '
  'gelistet wird. Default serlo — Bestandszeilen wurden am 14.08.2026 über das '
  'room_name-Präfix zugeordnet.';

-- ─── 1b. Backfill für die bereits existierenden Berkat-Shows ─────────────────
-- ABWEICHUNG zum Push-Routing (20260814190000): Dort war „kein Backfill nötig"
-- korrekt, weil Berkat bis heute keinen einzigen Push-Token registriert hat.
-- Hier gilt das NICHT — Berkat hat sehr wohl schon Sessions angelegt, und genau
-- deren Sichtbarkeit in Serlo ist ja der Anlass für diese Migration. Ohne
-- Backfill behielten alle bisherigen Testläufe das Default 'serlo' und blieben
-- in Serlos Liste stehen.
--
-- Zuordnung über das room_name-Präfix, das beide Apps stabil und
-- unterschiedlich vergeben:
--   Berkat  → `berkat-<uid8>-<base36>`      (apps/berkat/lib/useStudio.ts:60 —
--                                            die EINZIGE Stelle, an der Berkat
--                                            eine Session anlegt)
--   Serlo   → `vibes-live-<uuid>-<ms>`      (lib/useLiveSession.ts:353,
--                                            apps/web/app/actions/live-host.ts:85)
--   Serlo   → `obs-perm-<uid8>`             (WHIP-Ingress, bleibt auf 'serlo')
-- Kein Überlappungsrisiko: Weder 'vibes-live-…' noch 'obs-perm-…' kann mit
-- 'berkat-' beginnen, und Berkat vergibt kein anderes Präfix.
-- Zeilen ohne room_name (NULL) bleiben bewusst auf 'serlo' — die stammen aus
-- Serlos Frühzeit, bevor room_name gesetzt wurde.
UPDATE public.live_sessions
   SET app = 'berkat'
 WHERE room_name LIKE 'berkat-%'
   AND app <> 'berkat';

-- ─── 2. Index für die gefilterte Listen-Abfrage ──────────────────────────────
-- Es gibt bereits `idx_live_sessions_active_listing (viewer_count DESC,
-- started_at ASC, id) WHERE status = 'active'`. Der bliebe nutzbar, Postgres
-- müsste `app` aber als Filter nachlagern. Dieselbe Form mit `app` als
-- führender Spalte bedient die neue Query direkt — gleiche Kosten beim
-- Schreiben, ein Filter-Schritt weniger beim Lesen.
CREATE INDEX IF NOT EXISTS idx_live_sessions_app_active_listing
  ON public.live_sessions (app, viewer_count DESC, started_at ASC, id)
  WHERE status = 'active';

-- ─── 3. Live-Badge auf dem Serlo-Web-Profil ──────────────────────────────────
-- `get_public_profile_web` berechnet `is_live` SERVERSEITIG. Ein `.eq()` im
-- Web-Client hilft hier also nicht — ohne diesen Zweig zeigt das Serlo-Web-Profil
-- eines Berkat-Verkäufers weiterhin den LIVE-Ring und verlinkt auf eine
-- Serlo-Live-Seite, die die Auktion gar nicht darstellen kann.
--
-- Rumpf ist der LIVE-Stand aus 20260517230000_hide_moderated_profiles_from_
-- public_discovery.sql, maschinell übernommen und an GENAU EINER Stelle ergänzt
-- (`AND ls.app = 'serlo'`). Nicht abgetippt — bei geteilten Funktionen sind in
-- diesem Projekt schon einmal spätere Änderungen verlorengegangen.
CREATE OR REPLACE FUNCTION public.get_public_profile_web(p_username text)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_url text,
  bio text,
  is_verified boolean,
  is_private boolean,
  website text,
  teip text,
  follower_count bigint,
  following_count bigint,
  post_count bigint,
  is_live boolean,
  live_session_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH profile AS (
    SELECT
      p.id,
      p.username,
      p.display_name,
      p.avatar_url,
      p.bio,
      COALESCE(p.is_verified, false) AS is_verified,
      COALESCE(p.is_private, false) AS is_private,
      p.website,
      p.teip
    FROM public.profiles p
    WHERE lower(p.username) = lower(p_username)
      AND COALESCE(p.is_banned, false) = false
      AND COALESCE(p.is_shadow_banned, false) = false
    LIMIT 1
  )
  SELECT
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    p.bio,
    p.is_verified,
    p.is_private,
    p.website,
    p.teip,
    (SELECT count(*) FROM public.follows f WHERE f.following_id = p.id)::bigint AS follower_count,
    (SELECT count(*) FROM public.follows f WHERE f.follower_id = p.id)::bigint AS following_count,
    (
      SELECT count(*)
      FROM public.posts po
      WHERE po.author_id = p.id
        AND COALESCE(po.privacy, 'public') = 'public'
        AND COALESCE(po.women_only, false) = false
    )::bigint AS post_count,
    (live.id IS NOT NULL) AS is_live,
    live.id AS live_session_id
  FROM profile p
  LEFT JOIN LATERAL (
    SELECT ls.id
    FROM public.live_sessions ls
    WHERE ls.host_id = p.id
      AND ls.status = 'active'
      AND COALESCE(ls.women_only, false) = false
      -- NEU: Berkat-Shows erzeugen keinen LIVE-Ring auf dem Serlo-Profil.
      AND ls.app = 'serlo'
    ORDER BY ls.started_at DESC
    LIMIT 1
  ) live ON true;
$$;

-- CREATE OR REPLACE behält Grants bei gleicher Signatur normalerweise bei —
-- in diesem Projekt wird das trotzdem explizit neu gesetzt, seit am 14.08. ein
-- DROP+CREATE die Rechte von `credit_coins` still an PUBLIC (inkl. anon)
-- zurückgegeben hat. Hier unverändert gegenüber 20260517230000.
GRANT EXECUTE ON FUNCTION public.get_public_profile_web(text) TO anon, authenticated;

COMMIT;

-- ─── Reihenfolge beim Ausrollen ──────────────────────────────────────────────
-- Die Migration allein ist unkritisch und kann sofort laufen: Sie ändert keine
-- Signatur und keinen Rückgabetyp, alte Clients merken nichts. ABER sie schließt
-- für sich genommen noch nichts:
--
--   1. Migration einspielen (SQL-Editor + `supabase migration repair --status
--      applied 20260814280000`, siehe apps/berkat/HANDOFF.md Abschnitt 3).
--      Der Backfill oben räumt die bisherigen Testläufe sofort aus Serlo.
--   2. BERKAT ausrollen. Bis der neue Berkat-Build/OTA draußen ist, legt die
--      alte Berkat-Version weiter Shows OHNE `app` an — die landen per Default
--      auf 'serlo' und tauchen trotz Filter wieder in Serlo auf. Berkat zuerst.
--   3. SERLO ausrollen. Die Serlo-Änderungen sind reines JS (nur .eq()-Filter,
--      kein natives Modul) — geht also per `eas update` als OTA, ohne
--      App-Store-Review. ⚠️ Dabei EAS_BUILD=1 setzen, sonst landen
--      Expo-Go-Stubs im Produktions-OTA.
--   4. apps/web deployen (Vercel) — schließt /live, Landing, Gilden-Rail,
--      Studio und den LIVE-Ring auf dem Web-Profil.
--
-- ─── Was diese Migration NICHT tut ───────────────────────────────────────────
-- * Kein RLS-Eingriff. Die App-Trennung ist eine Sichtbarkeits-/Produktgrenze,
--   keine Sicherheitsgrenze: Eine Berkat-Show ist nicht geheim, sie gehört nur
--   nicht in Serlos Liste. Wer die session_id kennt, darf sie weiterhin laden
--   (sonst bräche der Deep-Link zwischen den Apps).
-- * Kein Filter im DSGVO-Export (`apps/web/app/actions/gdpr.ts`). Dort ist der
--   Nutzer Auskunftsberechtigter über SEINE Daten — die Berkat-Zeilen gehören
--   ausdrücklich mit hinein.
-- * `get_admin_stats` / `cost_health_snapshot` bleiben app-übergreifend: Das sind
--   Betriebskennzahlen über beide Apps, gewollt.
