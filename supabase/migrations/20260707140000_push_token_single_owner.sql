-- ============================================================================
-- Ein Push-Token gehört immer nur EINEM User (dem zuletzt auf diesem Gerät
-- eingeloggten). Bisher blieb beim Account-Wechsel der Token beim alten Account
-- (profiles.push_token + push_tokens-Zeile wurden nie bereinigt) → Account A
-- bekam nach dem Wechsel auf B weiter Push-Nachrichten auf dasselbe Gerät.
--
-- RLS erlaubt dem Client nicht, fremde Zeilen zu bereinigen — deshalb per
-- SECURITY-DEFINER-Trigger: sobald ein Token einem User zugewiesen wird, wird
-- er bei ALLEN anderen entfernt. Wirkt egal ob der Client via REST oder RPC
-- schreibt.
-- ============================================================================

-- 1) profiles.push_token wird gesetzt → Token bei allen anderen Profilen +
--    push_tokens-Zeilen entfernen.
CREATE OR REPLACE FUNCTION public.enforce_single_owner_push_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.push_token IS NOT NULL
     AND NEW.push_token IS DISTINCT FROM OLD.push_token THEN
    UPDATE public.profiles
       SET push_token = NULL
     WHERE push_token = NEW.push_token
       AND id <> NEW.id;
    DELETE FROM public.push_tokens
     WHERE token = NEW.push_token
       AND user_id <> NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_single_owner_push_token ON public.profiles;
CREATE TRIGGER trg_single_owner_push_token
  AFTER UPDATE OF push_token ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_owner_push_token();

-- 2) Neue push_tokens-Zeile → gleicher Token bei anderen Usern entfernen
--    (auch das profiles.push_token-Feld der anderen bereinigen).
CREATE OR REPLACE FUNCTION public.enforce_single_owner_push_tokens_row()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.push_tokens
   WHERE token = NEW.token
     AND user_id <> NEW.user_id;
  UPDATE public.profiles
     SET push_token = NULL
   WHERE push_token = NEW.token
     AND id <> NEW.user_id;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_single_owner_push_tokens_row ON public.push_tokens;
CREATE TRIGGER trg_single_owner_push_tokens_row
  AFTER INSERT ON public.push_tokens
  FOR EACH ROW EXECUTE FUNCTION public.enforce_single_owner_push_tokens_row();
