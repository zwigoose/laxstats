-- =============================================================================
-- Entitlement Phase 1 — Schema & data migration
-- Plan tiers rename: free / starter / pro / enterprise  →  free / pro / max / giga
-- Adds personal plan on profiles, status on seasons/teams, rebuilds plan_features,
-- enforces one-org-per-user, and updates org_feature_limit to short-circuit for admins.
-- =============================================================================

-- ── 1. Rename org plan tier values ───────────────────────────────────────────
-- Step 1: Drop the old CHECK constraint (named constraint varies, so use NOT VALID trick)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_plan_check;

-- Migrate data first (while column has no CHECK)
UPDATE organizations SET plan = 'max'  WHERE plan = 'pro';
UPDATE organizations SET plan = 'pro'  WHERE plan = 'starter';
UPDATE organizations SET plan = 'giga' WHERE plan = 'enterprise';

-- Restore CHECK with new values
ALTER TABLE organizations
  ADD CONSTRAINT organizations_plan_check
  CHECK (plan IN ('free','pro','max','giga'));

-- Update the column default (was 'pro' meaning old-pro, now orgs launch as 'max')
ALTER TABLE organizations ALTER COLUMN plan SET DEFAULT 'max';

-- ── 2. Personal plan on profiles ─────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS personal_plan        text NOT NULL DEFAULT 'free'
    CHECK (personal_plan IN ('free','basic','plus')),
  ADD COLUMN IF NOT EXISTS personal_plan_status text NOT NULL DEFAULT 'active'
    CHECK (personal_plan_status IN ('active','past_due','canceled','trialing'));

-- ── 3. Status column on seasons ──────────────────────────────────────────────
ALTER TABLE seasons
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','archived'));

-- Default all existing rows to active (already handled by column default)

-- ── 4. Status column on teams ────────────────────────────────────────────────
ALTER TABLE teams
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','retired'));

-- ── 5. One-org-per-user constraint ───────────────────────────────────────────
-- Deduplicate first: keep the oldest membership row per user
DELETE FROM org_members
WHERE id NOT IN (
  SELECT DISTINCT ON (user_id) id
  FROM org_members
  ORDER BY user_id, created_at
);

ALTER TABLE org_members
  ADD CONSTRAINT org_members_user_id_unique UNIQUE (user_id);

-- ── 6. Rebuild plan_features ──────────────────────────────────────────────────
-- Drop all org_feature_overrides rows first (FK references plan_features.id),
-- then drop and recreate plan_features with new schema and seed data,
-- then restore org_feature_overrides structure.

-- Save existing overrides (feature IDs may change)
CREATE TEMP TABLE _saved_overrides AS
  SELECT org_id, feature_id, override_limit, expires_at FROM org_feature_overrides;

TRUNCATE org_feature_overrides;
DELETE FROM plan_features;

-- Drop old limit columns, add new ones
ALTER TABLE plan_features
  DROP COLUMN IF EXISTS starter_limit,
  DROP COLUMN IF EXISTS enterprise_limit;

ALTER TABLE plan_features
  ADD COLUMN IF NOT EXISTS max_limit  int,
  ADD COLUMN IF NOT EXISTS giga_limit int;

-- Ensure all columns exist (idempotent if partially applied)
ALTER TABLE plan_features
  ADD COLUMN IF NOT EXISTS free_limit int,
  ADD COLUMN IF NOT EXISTS pro_limit  int;

-- Seed new feature set
-- Limits: null = unlimited, 0 = disabled
--                                                 free  pro   max   giga
INSERT INTO plan_features (id, description,        free_limit, pro_limit, max_limit, giga_limit) VALUES
  ('org_active_teams',       'Active teams per org',         0,    3,  NULL,  NULL),
  ('org_members',            'Org members',                  0,    5,  NULL,  NULL),
  ('org_active_seasons',     'Active seasons per org',       0,    1,     3,  NULL),
  ('org_games_per_season',   'Games per season',             0,   20,  NULL,  NULL),
  ('org_member_personal_games', 'Personal games (org member)', 10, 25,  NULL,  NULL),
  ('pressbox',               'Press Box',                    0,    1,     1,     1),
  ('multi_scorekeeper',      'Multi-user scorekeeper',       0,    0,     1,     1),
  ('season_stats',           'Season stats / aggregation',   0,    1,     1,     1);

-- Restore overrides that map to surviving feature IDs
INSERT INTO org_feature_overrides (org_id, feature_id, override_limit, expires_at)
  SELECT s.org_id, s.feature_id, s.override_limit, s.expires_at
  FROM _saved_overrides s
  WHERE EXISTS (SELECT 1 FROM plan_features pf WHERE pf.id = s.feature_id);

DROP TABLE _saved_overrides;

-- ── 7. Update admin_get_org_features RPC ─────────────────────────────────────
-- Reflect new plan column names (pro/max/giga) and new plan_features columns.
CREATE OR REPLACE FUNCTION admin_get_org_features(p_org_id uuid)
RETURNS TABLE (
  feature_id       text,
  description      text,
  plan_limit       int,
  override_limit   int,
  override_expires timestamptz
)
SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    pf.id AS feature_id,
    pf.description,
    CASE o.plan
      WHEN 'free' THEN pf.free_limit
      WHEN 'pro'  THEN pf.pro_limit
      WHEN 'max'  THEN pf.max_limit
      WHEN 'giga' THEN pf.giga_limit
    END AS plan_limit,
    ov.override_limit,
    ov.expires_at AS override_expires
  FROM plan_features pf
  CROSS JOIN organizations o
  LEFT JOIN org_feature_overrides ov
    ON ov.org_id = o.id AND ov.feature_id = pf.id
  WHERE o.id = p_org_id
  ORDER BY pf.id;
$$;

-- ── 8. Update org_feature_limit RPC ──────────────────────────────────────────
-- Short-circuits to NULL (unlimited) for platform admins.
-- Uses new plan column names (pro/max/giga).
CREATE OR REPLACE FUNCTION org_feature_limit(p_org_id uuid, p_feature_id text)
RETURNS int STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    -- Platform admins: unlimited on everything
    CASE WHEN (SELECT COALESCE(is_admin, false) FROM profiles WHERE id = auth.uid()) THEN
      NULL
    ELSE
      COALESCE(
        -- Manual override takes precedence
        (SELECT override_limit FROM org_feature_overrides
         WHERE org_id = p_org_id AND feature_id = p_feature_id
           AND (expires_at IS NULL OR expires_at > now())),
        -- Fall back to plan limit
        (SELECT
           CASE o.plan
             WHEN 'free' THEN pf.free_limit
             WHEN 'pro'  THEN pf.pro_limit
             WHEN 'max'  THEN pf.max_limit
             WHEN 'giga' THEN pf.giga_limit
           END
         FROM organizations o
         JOIN plan_features pf ON pf.id = p_feature_id
         WHERE o.id = p_org_id)
      )
    END;
$$;
