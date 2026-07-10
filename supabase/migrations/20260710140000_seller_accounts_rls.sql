-- ─────────────────────────────────────────────────────────────────────────────
-- seller_accounts: Lese-RLS einschränken (Security-Review-Restpunkt).
--
-- Bisher: `for select using (true)` — JEDER (auch anon) konnte alle
-- Verkäufer-Zeilen lesen, inkl. platform_fee_bps (individuelle Provision),
-- kyc_status und später stripe_connect_id. Solange Zaur der einzige
-- Verkäufer ist harmlos, vor Phase 2 (Drittverkäufer) ein Leak von
-- Geschäftskonditionen.
--
-- Neu: Verkäufer liest NUR die eigene Zeile. Schreiben bleibt wie gehabt
-- ausschließlich service_role (die bestehende for-all-Policy deckt für
-- service_role auch SELECT ab — Admin-Tools/Webhooks unbeeinflusst).
--
-- Verifiziert vor dieser Migration: KEIN Client-Code (App/Web), keine
-- Edge Function und keine RPC liest seller_accounts — Anzeige-Daten des
-- Verkäufers kommen überall aus `profiles`. Nichts bricht.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists seller_accounts_read on public.seller_accounts;

create policy seller_accounts_read_own on public.seller_accounts
  for select using (auth.uid() = user_id);

-- Defense-in-depth: anon hat ohnehin kein auth.uid(), aber explizit ist besser.
revoke select on public.seller_accounts from anon;
