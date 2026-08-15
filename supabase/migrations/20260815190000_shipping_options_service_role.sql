-- Nachtrag zu 20260815180000: `get_cart_shipping_options` wird von der Edge
-- Function aufgerufen, und die läuft als `service_role` — nicht als
-- `authenticated`.
--
-- In `20260815180000` steht ausdrücklich `REVOKE ALL … FROM PUBLIC, anon` und
-- `GRANT EXECUTE … TO authenticated`. Ob `service_role` das Recht über die
-- Standard-Rechte von Supabase ohnehin mitbekommt, hängt an den
-- `ALTER DEFAULT PRIVILEGES` des Projekts — darauf soll sich der Geldweg nicht
-- verlassen. Ein ausdrücklicher GRANT kostet nichts und nimmt die Frage raus.
--
-- Ohne ihn scheitert die Kasse mit `42501 permission denied for function` —
-- und zwar erst zur Laufzeit, im Moment des Bezahlens.

GRANT EXECUTE ON FUNCTION public.get_cart_shipping_options(uuid) TO service_role;
