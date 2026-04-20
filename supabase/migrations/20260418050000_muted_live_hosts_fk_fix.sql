-- ================================================================
-- v1.17.0 — Fixup: muted_live_hosts FKs → profiles
-- ================================================================
-- Die ursprüngliche Migration 020 hat die FKs auf auth.users(id)
-- gelegt. PostgREST kann dadurch aber nicht `host:profiles(...)`
-- via FK-Hint embedden (FK-Ziel ist auth.users, nicht profiles).
--
-- Fix: FKs auf public.profiles(id) re-pointen. Die IDs sind identisch
-- (profiles.id = auth.users.id via 1:1 Trigger), daher keine Daten-
-- Migration nötig — nur Constraint-Austausch.
-- ================================================================

ALTER TABLE public.muted_live_hosts
  DROP CONSTRAINT IF EXISTS muted_live_hosts_user_id_fkey,
  DROP CONSTRAINT IF EXISTS muted_live_hosts_host_id_fkey;

ALTER TABLE public.muted_live_hosts
  ADD CONSTRAINT muted_live_hosts_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  ADD CONSTRAINT muted_live_hosts_host_id_fkey
    FOREIGN KEY (host_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- PostgREST schema-Reload erzwingen, damit die neuen FK-Beziehungen
-- sofort im Embed-Graph sichtbar sind.
NOTIFY pgrst, 'reload schema';

DO $$
BEGIN
  RAISE NOTICE '✅ muted_live_hosts FKs → profiles fixed (v1.17.0)';
END $$;
