-- ── Drop migration_errors ───────────────────────────────────────────────────
-- v1 → v2 migration tooling was retired in v2.12.0; the migration_errors log
-- table is no longer written to. Drop it. The is_emo_goal / is_mdd_goal
-- functions that were also defined in the v5 migration support file are kept
-- (they live in the public schema and back stat computation paths).

DROP TABLE IF EXISTS public.migration_errors;

-- ── Enable RLS on personal_plan_limits ──────────────────────────────────────
-- Reference table holding personal-tier game caps (free=3, basic=10, plus=20).
-- Without RLS, anyone with the anon key (shipped in the client bundle) could
-- UPDATE the limits and bypass billing. Reads stay public; writes are denied
-- to anon/authenticated and only flow through admin_set_personal_plan_limit(),
-- which is SECURITY DEFINER and bypasses RLS.

ALTER TABLE public.personal_plan_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Plan limits are public-read"
  ON public.personal_plan_limits
  FOR SELECT
  TO public
  USING (true);
