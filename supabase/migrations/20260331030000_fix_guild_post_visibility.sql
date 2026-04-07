-- ── Fix: is_guild_post war fälschlicherweise TRUE für Posts von Guild-Mitgliedern ───
-- Das führte dazu, dass diese Posts NICHT im Vibe-Feed erschienen.
-- Der Guild-Feed filtert nach author guild_id, NICHT nach is_guild_post.
-- Daher: Alle Posts auf is_guild_post = false setzen damit sie im Vibe-Feed erscheinen.

UPDATE public.posts
SET is_guild_post = false
WHERE is_guild_post = true;

-- Verification
SELECT 
  COUNT(*) FILTER (WHERE is_guild_post IS NOT TRUE) AS "Im Vibe-Feed sichtbar",
  COUNT(*) FILTER (WHERE is_guild_post IS TRUE)     AS "Noch ausgeblendet (sollte 0 sein)"
FROM public.posts;
