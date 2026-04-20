-- S2: Creator-Stimme klonen
-- Speichert die öffentliche URL des Sprach-Samples (R2) im Profil

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS voice_sample_url text DEFAULT NULL;

COMMENT ON COLUMN profiles.voice_sample_url IS
  'Öffentliche URL des Chatterbox-Voice-Samples (Cloudflare R2). Wird als audio_prompt an die generate-voice Edge Function übergeben.';
