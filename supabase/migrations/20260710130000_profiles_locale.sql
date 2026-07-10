-- ─────────────────────────────────────────────────────────────────────────────
-- profiles.locale — App-Sprache des Users für lokalisierte Push-Texte.
--
-- Die App synct ihre aktive Sprache (i18nStore) fire-and-forget in diese
-- Spalte; die Edge Function send-push-notification liest sie und wählt
-- deutsche oder russische Push-Texte. Default 'de' = bisheriges Verhalten.
--
-- CHECK deckt schon en/ce mit ab (App-Kataloge existieren als Stub) —
-- die Push-Funktion behandelt vorerst nur 'ru' gesondert, Rest fällt auf de.
-- Idempotent (IF NOT EXISTS / Constraint-Guard).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles
  add column if not exists locale text not null default 'de';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_locale_check' and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_locale_check check (locale in ('de', 'ru', 'en', 'ce'));
  end if;
end $$;

comment on column public.profiles.locale is
  'App-Sprache des Users (von der App gesynct); Push-Texte werden danach lokalisiert.';
