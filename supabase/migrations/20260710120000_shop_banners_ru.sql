-- ─────────────────────────────────────────────────────────────────────────────
-- Shop-Banner: russische Textspalten (App-i18n).
--
-- Die Banner-Texte sind DB-Content (vermietbare Werbefläche) — die App kann
-- sie nicht über den t()-Katalog übersetzen. Lösung: optionale *_ru-Spalten;
-- der Client zeigt sie bei Locale ru, sonst (oder wenn NULL) den deutschen
-- Basis-Text. Die RPC get_active_shop_banners nutzt `select *` und liefert
-- die neuen Spalten automatisch mit — KEIN RPC-Umbau nötig.
--
-- Idempotent (IF NOT EXISTS + Update über feste Seed-UUIDs).
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.shop_banners add column if not exists tag_ru      text;
alter table public.shop_banners add column if not exists title_ru    text;
alter table public.shop_banners add column if not exists subtitle_ru text;

comment on column public.shop_banners.tag_ru      is 'Russische Variante von tag (NULL → Fallback auf tag)';
comment on column public.shop_banners.title_ru    is 'Russische Variante von title (NULL → Fallback auf title)';
comment on column public.shop_banners.subtitle_ru is 'Russische Variante von subtitle (NULL → Fallback auf subtitle)';

-- ── Seed-Banner (Migration 20260626120000) russisch nachrüsten ──────────────
update public.shop_banners set
  tag_ru      = 'ИДЁТ ПРЕДЗАКАЗ',
  title_ru    = 'Масляный парфюм · халяль · 10 мл',
  subtitle_ru = 'Предзакажи сейчас → от 9,90 €'
where id = '11111111-1111-1111-1111-111111111111';

update public.shop_banners set
  tag_ru      = 'НОВОЕ ДЛЯ ТЕБЯ',
  title_ru    = 'Открой 30 ароматов',
  subtitle_ru = 'Дюпы · без спирта · Мюнхен'
where id = '22222222-2222-2222-2222-222222222222';

update public.shop_banners set
  tag_ru      = 'КОМЬЮНИТИ',
  title_ru    = 'Открой свой магазин',
  subtitle_ru = 'Начни продавать за 2 минуты'
where id = '33333333-3333-3333-3333-333333333333';
