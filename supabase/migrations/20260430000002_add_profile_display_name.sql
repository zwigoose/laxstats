-- Add display_name to profiles so users can set a human-readable name.
-- We previously revoked all UPDATE on profiles to prevent is_admin self-elevation.
-- Re-grant only the display_name column and add the necessary RLS UPDATE policy.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS display_name text;

-- Allow authenticated users to UPDATE only display_name on their own row.
-- Column-level GRANT + RLS together ensure is_admin remains unwritable.
GRANT UPDATE (display_name) ON profiles TO authenticated;

CREATE POLICY profiles_update_display_name
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
