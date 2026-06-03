-- Add logo_url to org teams
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Add logo_url to saved teams (user-owned rosters)
ALTER TABLE public.saved_teams
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Create public storage bucket for per-game and saved-team logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('game-logos', 'game-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view game logos
CREATE POLICY "Public read game logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'game-logos');

-- Authenticated users can upload game logos
CREATE POLICY "Auth users can upload game logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'game-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can update game logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'game-logos' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users can delete game logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'game-logos' AND auth.uid() IS NOT NULL);
