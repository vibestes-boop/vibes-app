-- toggle_pin_post: Nutzer-Identität aus auth.uid(), nicht aus dem Parameter.
--
-- BEFUND 14.08.2026 (Nachtrag zu 20260814160000): Die Funktion nahm die Nutzer-ID
-- als Parameter und prüfte sie nie gegen auth.uid(). Sie filtert intern durchgehend
-- auf `author_id = p_user_id` — mit einer fremden ID konnte ein angemeldetes Konto
-- also nicht nur fremde Beiträge an- und abpinnen, sondern über die mittlere
-- Anweisung
--     UPDATE posts SET is_pinned = false WHERE author_id = p_user_id
-- auch jedem beliebigen Nutzer seinen angehefteten Beitrag stillschweigend
-- abräumen. Nutzer-IDs sind überall sichtbar (Beiträge, Kommentare, Follows).
--
-- Die Vorgänger-Migration hat `anon` entzogen; ein Konto genügte aber weiterhin.
--
-- FIX: `p_user_id` wird ignoriert, maßgeblich ist ausschließlich auth.uid().
--
-- WARUM DIE SIGNATUR BLEIBT — und der Parameter nicht gestrichen wird:
--   1. Die Mobil-App ist im Store. Alte Binaries rufen weiter die Zwei-Parameter-
--      Fassung. Ein DROP würde das Anpinnen für jeden brechen, der nicht
--      aktualisiert hat.
--   2. Eine zusätzliche Ein-Parameter-Überladung wäre keine Lösung: PostgREST
--      kann dann nicht mehr entscheiden und antwortet mit HTTP 300
--      ("Could not choose the best candidate function") — genau das Verhalten,
--      das am 14.08. bei publish_due_scheduled_posts zu sehen war.
--   3. Beide Aufrufstellen (lib/usePostManagement.ts, apps/web/app/actions/posts.ts)
--      übergeben ohnehin die eigene ID. Der Client braucht KEINE Änderung, und der
--      Parameter darf auch nicht aus ihm entfernt werden, solange die Signatur
--      zwei Argumente hat — PostgREST findet die Funktion sonst nicht mehr.
--
-- Aufräumen später möglich (eigener Schritt, wenn die alten App-Versionen
-- ausgelaufen sind): 2-Parameter-Fassung droppen, 1-Parameter-Fassung anlegen,
-- beide Aufrufstellen anpassen. Bis dahin ist der Parameter totes Gewicht — aber
-- harmloses.
--
-- Verhalten für legitime Aufrufer unverändert: eigener Beitrag wird an-/abgepinnt,
-- höchstens einer gepinnt. Ein Aufruf mit fremder ID trifft jetzt nichts mehr und
-- endet in 'Post nicht gefunden oder kein Zugriff'.
--
-- Idempotent (CREATE OR REPLACE, Signatur unverändert → Grants bleiben erhalten).

CREATE OR REPLACE FUNCTION public.toggle_pin_post("p_post_id" uuid, "p_user_id" uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'pg_temp'
AS $$
DECLARE
  -- p_user_id wird bewusst NICHT gelesen. Sie bleibt nur in der Signatur, damit
  -- ausgelieferte App-Versionen die Funktion weiterhin finden.
  v_user_id          uuid := auth.uid();
  v_currently_pinned boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'not_authenticated' USING ERRCODE = '42501';
  END IF;

  -- Aktuellen Status ermitteln — nur am eigenen Beitrag.
  SELECT is_pinned INTO v_currently_pinned
  FROM public.posts
  WHERE id = p_post_id AND author_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Post nicht gefunden oder kein Zugriff';
  END IF;

  -- Alle Pins dieses Users entfernen
  UPDATE public.posts
  SET is_pinned = false
  WHERE author_id = v_user_id AND is_pinned = true;

  -- Wenn vorher nicht gepinnt → jetzt pinnen
  IF NOT v_currently_pinned THEN
    UPDATE public.posts
    SET is_pinned = true
    WHERE id = p_post_id AND author_id = v_user_id;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.toggle_pin_post("p_post_id" uuid, "p_user_id" uuid) IS
  'Pinnt den eigenen Beitrag an/ab (max. 1 pro Nutzer). p_user_id wird IGNORIERT — '
  'maßgeblich ist auth.uid(). Der Parameter bleibt nur aus Kompatibilität zu '
  'ausgelieferten App-Versionen in der Signatur, siehe Migration 20260814170000.';
