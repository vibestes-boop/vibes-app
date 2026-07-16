-- ─────────────────────────────────────────────────────────────────────────────
-- Women-Only Zone: von Selbstdeklaration → geprüfte Freigabe (WOZ-Audit Gap 3).
--
-- Problem: Bisher konnte JEDER Account per Client-UPDATE
--   profiles SET gender='female', women_only_verified=true
-- setzen und sofort in die Frauen-Zone. Für einen Women-Only-Space ist das die
-- Kern-Schwäche. Der Gate-Boolean bleibt (`women_only_verified` + Helper
-- `is_women_only_verified()` unverändert → alle ~15 RLS-Flächen unberührt) —
-- wir ändern nur, WER ihn setzen darf: künftig ausschließlich die Admin-Freigabe.
--
-- Mechanik:
--   1) BEFORE-UPDATE-Trigger sperrt `women_only_verified` gegen direkte
--      Client-Writes (role-unabhängig via transaction-local Session-Flag).
--      Nur SECURITY-DEFINER-RPCs, die das Flag setzen, dürfen die Spalte ändern.
--   2) Antrags-Tabelle `women_only_requests` (pending/approved/rejected/revoked)
--      mit Audit-Feldern.
--   3) RPCs: request (User) · approve/reject/revoke (Admin) · Queue + Eigenstatus.
--   4) Bestehende verifizierte Accounts werden als 'approved' übernommen
--      (Grandfathering) — aktuell nur 2 Testaccounts, kein echtes Mitglied betroffen.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1) Gate-Spalte gegen direkte Client-Writes sperren ──────────────────────
CREATE OR REPLACE FUNCTION public.guard_women_only_verified()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.women_only_verified IS DISTINCT FROM OLD.women_only_verified
     AND current_setting('app.woz_bypass', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'women_only_verified darf nur über die Freigabe-RPCs geändert werden';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_women_only_verified ON public.profiles;
CREATE TRIGGER trg_guard_women_only_verified
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_women_only_verified();

-- ── 2) Antrags-/Audit-Tabelle ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.women_only_requests (
  user_id      uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
  method       text NOT NULL DEFAULT 'self'
               CHECK (method IN ('self', 'admin', 'grandfather')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at  timestamptz,
  reviewed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  note         text
);

CREATE INDEX IF NOT EXISTS idx_woz_requests_pending
  ON public.women_only_requests (requested_at)
  WHERE status = 'pending';

ALTER TABLE public.women_only_requests ENABLE ROW LEVEL SECURITY;

-- User sieht nur den eigenen Antrag; Admin sieht alle. Writes nur via RPC.
DROP POLICY IF EXISTS woz_requests_select_own ON public.women_only_requests;
CREATE POLICY woz_requests_select_own ON public.women_only_requests
  FOR SELECT USING (user_id = auth.uid() OR public.is_admin());

REVOKE ALL ON public.women_only_requests FROM anon;
GRANT SELECT ON public.women_only_requests TO authenticated;

-- ── 3a) Antrag stellen (User) ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_women_only()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_existing text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  SELECT status INTO v_existing FROM women_only_requests WHERE user_id = v_uid;
  IF v_existing = 'approved' THEN
    RETURN jsonb_build_object('success', true, 'status', 'approved');
  END IF;

  -- Selbstdeklaration: Geschlecht + Level 1 (Antrag gestellt), ABER KEIN Zugang.
  -- women_only_verified bleibt false bis zur Admin-Freigabe.
  UPDATE profiles
     SET gender = 'female', verification_level = 1
   WHERE id = v_uid;

  INSERT INTO women_only_requests (user_id, status, method, requested_at)
       VALUES (v_uid, 'pending', 'self', now())
  ON CONFLICT (user_id) DO UPDATE
       SET status = 'pending', method = 'self', requested_at = now(),
           reviewed_at = NULL, reviewed_by = NULL, note = NULL;

  RETURN jsonb_build_object('success', true, 'status', 'pending');
END;
$$;

-- ── 3b) Freigeben (Admin) ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.approve_women_only(p_user uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  PERFORM set_config('app.woz_bypass', 'on', true);
  UPDATE profiles
     SET women_only_verified = true, verification_level = 2, gender = 'female'
   WHERE id = p_user;

  INSERT INTO women_only_requests (user_id, status, method, reviewed_at, reviewed_by)
       VALUES (p_user, 'approved', 'admin', now(), v_uid)
  ON CONFLICT (user_id) DO UPDATE
       SET status = 'approved', reviewed_at = now(), reviewed_by = v_uid, note = NULL;

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES (v_uid, 'woz_approve', 'profile', p_user, '{}'::jsonb);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 3c) Ablehnen (Admin) — kein Zugang, Antrag als rejected markiert ────────
CREATE OR REPLACE FUNCTION public.reject_women_only(p_user uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  UPDATE women_only_requests
     SET status = 'rejected', reviewed_at = now(), reviewed_by = v_uid, note = p_note
   WHERE user_id = p_user;

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES (v_uid, 'woz_reject', 'profile', p_user,
               jsonb_build_object('note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 3d) Aberkennen (Admin) — bereits Verifizierten den Zugang entziehen ─────
CREATE OR REPLACE FUNCTION public.revoke_women_only(p_user uuid, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_admin');
  END IF;

  PERFORM set_config('app.woz_bypass', 'on', true);
  UPDATE profiles
     SET women_only_verified = false, verification_level = 0
   WHERE id = p_user;

  UPDATE women_only_requests
     SET status = 'revoked', reviewed_at = now(), reviewed_by = v_uid, note = p_note
   WHERE user_id = p_user;

  INSERT INTO admin_audit_log (actor_id, action, target_type, target_id, metadata)
       VALUES (v_uid, 'woz_revoke', 'profile', p_user,
               jsonb_build_object('note', p_note));

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 3e) Freigabe-Queue (Admin) ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_women_only_requests(p_status text DEFAULT 'pending')
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT COALESCE(public.is_admin(), false) THEN
    RETURN '[]'::jsonb;
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'user_id',      r.user_id,
             'status',       r.status,
             'method',       r.method,
             'requested_at', r.requested_at,
             'reviewed_at',  r.reviewed_at,
             'note',         r.note,
             'username',     p.username,
             'display_name', p.display_name,
             'avatar_url',   p.avatar_url
           ) ORDER BY r.requested_at DESC)
    FROM women_only_requests r
    JOIN profiles p ON p.id = r.user_id
    WHERE p_status = 'all' OR r.status = p_status
  ), '[]'::jsonb);
END;
$$;

-- ── 3f) Eigenstatus (User) — für die Antrags-UI ─────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_women_only_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_verified boolean;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('status', 'none', 'verified', false);
  END IF;
  SELECT women_only_verified INTO v_verified FROM profiles WHERE id = v_uid;
  SELECT status INTO v_status FROM women_only_requests WHERE user_id = v_uid;
  RETURN jsonb_build_object(
    'status', COALESCE(v_status, 'none'),
    'verified', COALESCE(v_verified, false)
  );
END;
$$;

-- ── 4) Grandfathering + Permissions ─────────────────────────────────────────
INSERT INTO women_only_requests (user_id, status, method, requested_at, reviewed_at)
SELECT id, 'approved', 'grandfather', now(), now()
FROM profiles
WHERE women_only_verified = true
ON CONFLICT (user_id) DO NOTHING;

REVOKE ALL ON FUNCTION public.request_women_only()                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.approve_women_only(uuid)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reject_women_only(uuid, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.revoke_women_only(uuid, text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_women_only_requests(text)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_women_only_status()           FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_women_only()              TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_women_only(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_women_only(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_women_only(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_women_only_requests(text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_women_only_status()        TO authenticated;

-- ── 3g) Selbst verlassen (User) — freiwilliger Austritt, nicht Admin-Aberkennung ─
CREATE OR REPLACE FUNCTION public.leave_women_only()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'not_authenticated');
  END IF;

  PERFORM set_config('app.woz_bypass', 'on', true);
  UPDATE profiles
     SET women_only_verified = false, verification_level = 0
   WHERE id = v_uid;

  -- Antrag entfernen → sauberer Neustart, falls die Nutzerin später neu beitritt.
  DELETE FROM women_only_requests WHERE user_id = v_uid;

  RETURN jsonb_build_object('success', true);
END;
$$;

REVOKE ALL ON FUNCTION public.leave_women_only() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.leave_women_only() TO authenticated;
