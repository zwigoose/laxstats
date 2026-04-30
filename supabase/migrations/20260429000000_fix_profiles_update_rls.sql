-- Fix: profiles_update_own allowed any authenticated user to self-elevate to admin
-- by calling supabase.from("profiles").update({ is_admin: true }).eq("id", userId).
-- The policy had no column restriction, so is_admin was freely writable.
--
-- profiles has no user-editable fields (id=PK, is_admin=admin-only, created_at=auto).
-- Drop the UPDATE policy entirely; admin flag changes go through admin_set_admin RPC only.

DROP POLICY IF EXISTS profiles_update_own ON profiles;

-- Belt-and-suspenders: revoke table-level UPDATE privilege so even a future
-- permissive RLS policy cannot accidentally expose is_admin to direct writes.
-- admin_set_admin is SECURITY DEFINER and bypasses this restriction.
REVOKE UPDATE ON profiles FROM authenticated;
