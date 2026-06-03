-- Add logo_url column to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Create public storage bucket for org logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Anyone can view org logos
CREATE POLICY "Public read org logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

-- Org admins can upload/overwrite their org's logo
CREATE POLICY "Org admins can upload logo"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'org-logos' AND
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = split_part(name, '/', 1)::uuid
        AND user_id = auth.uid()
        AND role = 'org_admin'
    )
  );

CREATE POLICY "Org admins can update logo"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'org-logos' AND
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = split_part(name, '/', 1)::uuid
        AND user_id = auth.uid()
        AND role = 'org_admin'
    )
  );

CREATE POLICY "Org admins can delete logo"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'org-logos' AND
    EXISTS (
      SELECT 1 FROM public.org_members
      WHERE org_id = split_part(name, '/', 1)::uuid
        AND user_id = auth.uid()
        AND role = 'org_admin'
    )
  );
