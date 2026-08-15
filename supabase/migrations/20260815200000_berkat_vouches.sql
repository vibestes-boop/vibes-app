-- Berkat: Bürgen — Vertrauen mit Namen statt Sterne-Durchschnitt
--
-- WARUM
-- Die Whatnot-Analyse (apps/berkat/WHATNOT-ANALYSE.md) führt am Ende sieben
-- Stellen auf, an denen Berkat besser sein kann. Sechs davon sind gebaut. Der
-- erste stand bisher nur auf dem Papier:
--
--   „Vertrauen statt Sterne — Bürgen und Verkaufszahl direkt unter dem Namen.
--    Whatnot zeigt ‚5,0 ★' in Winzschrift; in deiner Community entscheidet,
--    WER für jemanden bürgt."
--
-- Und § B5: „Vertrauen ist personal, nicht institutionell. Ein 5-Sterne-
-- Durchschnitt bedeutet in der Community weniger als ‚mein Cousin kennt ihn.'
-- … etwas, das Whatnot strukturell nicht bauen kann."
--
-- DIE ENTWURFSENTSCHEIDUNGEN — sozial, nicht technisch
--
-- 1. **Namen, keine Zahl.** Die Oberfläche zeigt Gesichter und Namen, sortiert
--    danach, wem der Betrachter selbst folgt. Eine reine Anzahl wäre wieder ein
--    Sterne-Durchschnitt unter anderem Namen.
--
-- 2. **Keine Hürde vorm Bürgen.** Ein Filter „nur wer schon gekauft hat" wäre
--    ausgerechnet am Anfang tot, wenn noch niemand gekauft hat — also genau
--    dann, wenn die ersten Verkäufer Vertrauen brauchen. Stattdessen wird neben
--    jedem Bürgen sichtbar, was er selbst wiegt (Käufe/Verkäufe). Damit
--    entscheidet der Leser, nicht die Datenbank.
--
-- 3. **Öffentlich und zurechenbar.** Ein anonymer Bürge ist wertlos. Wer bürgt,
--    steht mit Namen da — und trägt das Risiko, sich zu blamieren. Genau das ist
--    der Mechanismus, nicht die Zeile in der Tabelle.
--
-- 4. **Jederzeit widerrufbar.** Vertrauen kann enden. Ein Bürge, der nicht mehr
--    bürgen kann, wäre eine Falle.

BEGIN;

CREATE TABLE IF NOT EXISTS public.berkat_vouches (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  voucher_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- „Kenne ihn seit Jahren." Kurz gehalten: Das Gewicht liegt auf dem NAMEN,
  -- der Satz ist Beiwerk. Ein langes Feld lädt zu Werbung ein.
  note        text CHECK (note IS NULL OR char_length(trim(note)) BETWEEN 3 AND 140),
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- Ein Mensch bürgt für einen Verkäufer genau einmal. Ohne das ließe sich die
  -- Liste durch Wiederholung aufblähen.
  CONSTRAINT berkat_vouches_once UNIQUE (seller_id, voucher_id),
  -- Für sich selbst zu bürgen ist keine Aussage.
  CONSTRAINT berkat_vouches_not_self CHECK (seller_id <> voucher_id)
);

CREATE INDEX IF NOT EXISTS idx_berkat_vouches_seller
  ON public.berkat_vouches (seller_id, created_at DESC);

ALTER TABLE public.berkat_vouches ENABLE ROW LEVEL SECURITY;

-- Lesen darf jeder, auch ohne Konto: Der Sinn eines Bürgen ist, dass ein
-- Fremder ihn sieht, bevor er Geld schickt.
DROP POLICY IF EXISTS "berkat_vouches_read" ON public.berkat_vouches;
CREATE POLICY "berkat_vouches_read" ON public.berkat_vouches
  FOR SELECT TO anon, authenticated USING (true);

-- Schreiben und Zurückziehen nur in eigenem Namen. `voucher_id = auth.uid()`
-- ist die ganze Sicherheit, die es hier braucht — und sie muss in BEIDEN
-- Richtungen stehen (USING für DELETE, WITH CHECK für INSERT), sonst könnte
-- jemand fremde Bürgschaften löschen.
DROP POLICY IF EXISTS "berkat_vouches_write_own" ON public.berkat_vouches;
CREATE POLICY "berkat_vouches_write_own" ON public.berkat_vouches
  FOR ALL TO authenticated
  USING (voucher_id = auth.uid())
  WITH CHECK (voucher_id = auth.uid());

-- ─── Was ein Bürge selbst wiegt ──────────────────────────────────────────────
-- Neben jedem Namen soll stehen, ob dieser Mensch hier schon gehandelt hat.
-- Ohne das ist „Amir bürgt" für einen Fremden nicht unterscheidbar von einem
-- Konto, das vor zehn Minuten angelegt wurde.
--
-- `SECURITY DEFINER`, weil `product_orders` und `live_auctions` für Dritte
-- gesperrt sind (zu Recht — dort stehen Adressen und Beträge). Herausgegeben
-- werden ausschließlich zwei Zähler, keine Beträge, keine Namen von Gegenseiten.
CREATE OR REPLACE FUNCTION public.get_vouch_weights(p_user_ids uuid[])
RETURNS TABLE(user_id uuid, purchases integer, sales integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    u.id,
    (SELECT COUNT(*)::integer FROM public.product_orders o
      WHERE o.buyer_id = u.id AND o.status IN ('paid','shipped','delivered')),
    (SELECT COUNT(*)::integer FROM public.live_auctions a
      WHERE a.seller_id = u.id AND a.status = 'sold')
  FROM unnest(p_user_ids) AS u(id);
$$;

REVOKE ALL ON FUNCTION public.get_vouch_weights(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vouch_weights(uuid[]) TO authenticated;

COMMIT;
