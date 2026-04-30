-- Add a DB-level length constraint on profiles.display_name.
-- The frontend maxLength={60} is client-side only and can be bypassed via direct API calls.

ALTER TABLE profiles
  ADD CONSTRAINT profiles_display_name_length
  CHECK (display_name IS NULL OR char_length(display_name) <= 60);
