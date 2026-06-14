-- ================================================
-- VIBES APP - Dwell Time RPC
-- Ausführen im Supabase SQL Editor
-- ================================================

-- Exponential Moving Average Update für dwell_time_score
-- Formel: new_score = old_score * 0.85 + observation * 0.15
-- Normalisierung: 20.000ms (20s) Verweildauer = perfekter Score 1.0
-- Cap: max. 60.000ms (1min) um Ausreißer zu dämpfen

create or replace function update_dwell_time(post_id uuid, dwell_ms integer)
returns void as $$
begin
  update public.posts
  set dwell_time_score = dwell_time_score * 0.85 + 
      (least(dwell_ms, 60000)::float / 20000.0) * 0.15
  where id = post_id;
end;
$$ language plpgsql security definer;
