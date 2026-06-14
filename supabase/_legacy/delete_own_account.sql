-- delete_own_account.sql
-- Löscht den eigenen Account inkl. aller Daten via Cascade.
-- Im Supabase SQL-Editor ausführen.

-- Hilfsfunktion: löscht Auth-User → profiles/posts/etc. cascaden durch FK automatisch
CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth AS $$
BEGIN
  -- Sicherheitscheck: nur eingeloggte User dürfen sich selbst löschen
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Auth-User löschen → Supabase cascadet automatisch auf profiles (via FK)
  -- profiles → posts, follows, likes, notifications, etc. cascaden weiter
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Zugriff: jeder authentifizierte User darf seine eigene Funktion aufrufen
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;
