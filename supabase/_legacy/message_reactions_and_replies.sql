-- ================================================
-- VIBES APP - Message Reactions + Reply Support
-- Ausführen in Supabase SQL Editor
-- ================================================

-- 1) Reactions auf einzelne Nachrichten
create table if not exists public.message_reactions (
  id uuid default gen_random_uuid() primary key,
  message_id uuid references public.messages(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;
create policy "reactions public read"  on public.message_reactions for select using (true);
create policy "reactions insert own"   on public.message_reactions for insert with check (auth.uid() = user_id);
create policy "reactions delete own"   on public.message_reactions for delete using (auth.uid() = user_id);

-- 2) Reply-to Feld auf messages (soft-Referenz — kein hard FK für Performance)
alter table public.messages
  add column if not exists reply_to_id uuid references public.messages(id) on delete set null;

-- Index für schnelle Reply-Lookups
create index if not exists messages_reply_to_id_idx on public.messages(reply_to_id);
