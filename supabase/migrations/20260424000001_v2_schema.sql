-- =============================================================================
-- LaxStats v2 — Phase 1: Database Foundation
-- Additive DDL only. All existing v1 rows and RLS are untouched.
-- =============================================================================

-- ── Helper: parse "M:SS" -> seconds remaining ─────────────────────────────────
CREATE OR REPLACE FUNCTION parse_clock_secs(t text)
RETURNS int IMMUTABLE LANGUAGE sql AS $$
  SELECT SPLIT_PART(t, ':', 1)::int * 60 + SPLIT_PART(t, ':', 2)::int;
$$;

-- ── Helper: quarter duration in seconds ───────────────────────────────────────
CREATE OR REPLACE FUNCTION quarter_duration_secs(q smallint)
RETURNS int IMMUTABLE LANGUAGE sql AS $$
  SELECT CASE WHEN q > 4 THEN 240 ELSE 720 END;
$$;

-- ── organizations ─────────────────────────────────────────────────────────────
CREATE TABLE organizations (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name               text        NOT NULL,
  slug               text        UNIQUE NOT NULL,
  created_at         timestamptz DEFAULT now(),
  created_by         uuid        REFERENCES auth.users,
  -- Payment tier scaffolding (not active in v2.0.0 — all orgs launch as pro)
  stripe_customer_id text        UNIQUE,
  stripe_sub_id      text        UNIQUE,
  plan               text        NOT NULL DEFAULT 'pro'
                                 CHECK (plan IN ('free','starter','pro','enterprise')),
  plan_status        text        NOT NULL DEFAULT 'active'
                                 CHECK (plan_status IN ('active','past_due','canceled','trialing')),
  trial_ends_at      timestamptz
);

-- ── org_members ───────────────────────────────────────────────────────────────
CREATE TABLE org_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations,
  user_id    uuid        NOT NULL REFERENCES auth.users,
  role       text        NOT NULL
             CHECK (role IN ('org_admin','coach','scorekeeper','viewer')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (org_id, user_id)
);

-- ── seasons ───────────────────────────────────────────────────────────────────
CREATE TABLE seasons (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations,
  name       text        NOT NULL,
  start_date date,
  end_date   date,
  created_at timestamptz DEFAULT now()
);

-- ── teams ─────────────────────────────────────────────────────────────────────
CREATE TABLE teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#1a6bab',
  created_at timestamptz DEFAULT now()
);

-- ── players ───────────────────────────────────────────────────────────────────
CREATE TABLE players (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid        NOT NULL REFERENCES organizations,
  name       text        NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ── team_season_roster ────────────────────────────────────────────────────────
CREATE TABLE team_season_roster (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id    uuid NOT NULL REFERENCES teams,
  season_id  uuid NOT NULL REFERENCES seasons,
  player_id  uuid NOT NULL REFERENCES players,
  jersey_num text NOT NULL,
  UNIQUE (team_id, season_id, player_id)
);

-- ── plan_features ─────────────────────────────────────────────────────────────
CREATE TABLE plan_features (
  id               text PRIMARY KEY,
  description      text,
  free_limit       int,   -- null = unlimited, 0 = disabled
  starter_limit    int,
  pro_limit        int,
  enterprise_limit int
);

INSERT INTO plan_features (id, description, free_limit, starter_limit, pro_limit, enterprise_limit) VALUES
  ('personal_games',    'Personal games (no org)',       10,   10,   10,   NULL),
  ('org_games',         'Org games per season',           0,   20, NULL,   NULL),
  ('org_members',       'Org members',                    0,   10, NULL,   NULL),
  ('season_stats',      'Season stats / aggregation',     0,    1,    1,      1),
  ('multi_scorekeeper', 'Multi-user scorekeeper',         0,    0,    1,      1),
  ('pressbox',          'Press Box',                      0,    1,    1,      1);

-- ── org_feature_overrides ─────────────────────────────────────────────────────
-- Platform admins can grant custom limits without touching Stripe
CREATE TABLE org_feature_overrides (
  org_id         uuid NOT NULL REFERENCES organizations,
  feature_id     text NOT NULL REFERENCES plan_features,
  override_limit int,
  expires_at     timestamptz,  -- null = permanent
  PRIMARY KEY (org_id, feature_id)
);

-- ── game_events ───────────────────────────────────────────────────────────────
-- Normalized event log — replaces games.state.log[] for schema_ver=2 games.
-- v1 games (personal, schema_ver=1) continue using the JSONB state column.
CREATE SEQUENCE IF NOT EXISTS game_events_seq;

CREATE TABLE game_events (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id               uuid        NOT NULL REFERENCES games,
  group_id              uuid        NOT NULL,  -- links related entries (goal+assist, shot+save)
  seq                   int         NOT NULL DEFAULT nextval('game_events_seq'),
  quarter               smallint    NOT NULL,
  event_type            text        NOT NULL,  -- mirrors EVENTS[].id + derived types
  team_idx              smallint    NOT NULL CHECK (team_idx IN (0, 1)),
  is_team_stat          boolean     DEFAULT false,
  player_num            text,
  player_name           text,
  player_id             uuid        REFERENCES players,  -- nullable for ad-hoc players
  goal_time             text,       -- "M:SS"
  penalty_time          text,       -- "M:SS"
  timeout_time          text,       -- "M:SS"
  is_non_releasable     boolean,
  penalty_minutes       smallint,
  shot_outcome          text        CHECK (shot_outcome IN ('missed','saved','post','blocked')),
  invite_token          text,       -- set for guest scorekeeper events
  is_possible_duplicate boolean     DEFAULT false,  -- set by DB trigger in Phase 4
  deleted_at            timestamptz,
  deleted_by            uuid        REFERENCES auth.users,
  created_at            timestamptz DEFAULT now(),
  created_by            uuid        REFERENCES auth.users
);

CREATE INDEX idx_game_events_game_seq   ON game_events (game_id, seq);
CREATE INDEX idx_game_events_game_qtr   ON game_events (game_id, quarter);
CREATE INDEX idx_game_events_group      ON game_events (group_id);
CREATE INDEX idx_game_events_game_type  ON game_events (game_id, event_type);

-- ── game_scorekeepers ─────────────────────────────────────────────────────────
-- Invite links for guest scorekeepers (Phase 4 feature, table created now)
CREATE TABLE game_scorekeepers (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id      uuid        NOT NULL REFERENCES games,
  user_id      uuid        REFERENCES auth.users,  -- null = token-only guest
  invite_token text        UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  invited_by   uuid        NOT NULL REFERENCES auth.users,
  label        text,       -- optional note, e.g. "Dad with iPad"
  role         text        NOT NULL DEFAULT 'scorekeeper',
  expires_at   timestamptz NOT NULL DEFAULT now() + interval '24 hours',
  used_at      timestamptz
);

-- ── New columns on games ──────────────────────────────────────────────────────
ALTER TABLE games
  ADD COLUMN IF NOT EXISTS org_id        uuid    REFERENCES organizations,
  ADD COLUMN IF NOT EXISTS away_org_id   uuid    REFERENCES organizations,
  ADD COLUMN IF NOT EXISTS season_id     uuid    REFERENCES seasons,
  ADD COLUMN IF NOT EXISTS home_team_id  uuid    REFERENCES teams,
  ADD COLUMN IF NOT EXISTS away_team_id  uuid    REFERENCES teams,
  ADD COLUMN IF NOT EXISTS game_type     text    CHECK (game_type IN ('regular','playoff','tournament','scrimmage')),
  ADD COLUMN IF NOT EXISTS schema_ver    int     NOT NULL DEFAULT 1;

-- ── Platform helper functions ─────────────────────────────────────────────────

-- Returns the caller's role in an org (null = not a member)
CREATE OR REPLACE FUNCTION get_org_role(p_org_id uuid)
RETURNS text STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT role FROM org_members
  WHERE org_id = p_org_id AND user_id = auth.uid()
  LIMIT 1;
$$;

-- Returns true if the caller is a platform admin
CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Returns the effective feature limit for an org (override → plan → null)
-- During v2.0.0 launch, all orgs default to 'pro' so all features are open.
-- When billing is introduced, flip new orgs to 'free'; no schema change needed.
CREATE OR REPLACE FUNCTION org_feature_limit(p_org_id uuid, p_feature_id text)
RETURNS int STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT COALESCE(
    -- Manual override takes precedence
    (SELECT override_limit FROM org_feature_overrides
     WHERE org_id = p_org_id AND feature_id = p_feature_id
       AND (expires_at IS NULL OR expires_at > now())),
    -- Fall back to plan limit
    (SELECT
       CASE o.plan
         WHEN 'free'       THEN pf.free_limit
         WHEN 'starter'    THEN pf.starter_limit
         WHEN 'pro'        THEN pf.pro_limit
         WHEN 'enterprise' THEN pf.enterprise_limit
       END
     FROM organizations o
     JOIN plan_features pf ON pf.id = p_feature_id
     WHERE o.id = p_org_id)
  );
$$;

-- ── EMO / MDD helpers ─────────────────────────────────────────────────────────

-- Returns true if the opposing team (1 - p_team_idx) had at least one active
-- releasable penalty at the moment of this goal. Used to derive EMO goals.
-- For MDD goals (scoring team has an active penalty), call with (game_id, 1-team_idx, ...).
CREATE OR REPLACE FUNCTION is_emo_goal(
  p_game_id  uuid,
  p_team_idx smallint,   -- the SCORING team
  p_goal_time text,      -- "M:SS" remaining
  p_quarter  smallint
) RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  goal_remaining  int := parse_clock_secs(p_goal_time);
  opp_idx         smallint := 1 - p_team_idx;
  v_pen           record;
  pen_remaining   int;
  to_serve        int;
  pen_expires_q   smallint;
  pen_expires_r   int;
  q               smallint;
  q_dur           int;
BEGIN
  FOR v_pen IN
    SELECT id, penalty_time, penalty_minutes, quarter AS pen_q
    FROM game_events
    WHERE game_id = p_game_id
      AND team_idx = opp_idx
      AND event_type = 'penalty'
      AND is_non_releasable IS NOT TRUE  -- NR penalties don't release on a goal
      AND deleted_at IS NULL
  LOOP
    pen_remaining := parse_clock_secs(v_pen.penalty_time);
    to_serve      := v_pen.penalty_minutes * 60;

    -- Compute expiry: walk forward through quarters until to_serve is exhausted
    IF pen_remaining >= to_serve THEN
      pen_expires_q := v_pen.pen_q;
      pen_expires_r := pen_remaining - to_serve;
    ELSE
      to_serve := to_serve - pen_remaining;
      q        := v_pen.pen_q + 1;
      LOOP
        q_dur := quarter_duration_secs(q);
        EXIT WHEN to_serve <= q_dur;
        to_serve := to_serve - q_dur;
        q        := q + 1;
      END LOOP;
      pen_expires_q := q;
      pen_expires_r := quarter_duration_secs(q) - to_serve;
    END IF;

    -- Is the goal within the penalty window?
    -- Goal must be at or after penalty started
    IF p_quarter < v_pen.pen_q THEN CONTINUE; END IF;
    IF p_quarter = v_pen.pen_q AND goal_remaining > pen_remaining THEN CONTINUE; END IF;
    -- Goal must be before penalty expired
    IF p_quarter > pen_expires_q THEN CONTINUE; END IF;
    IF p_quarter = pen_expires_q AND goal_remaining < pen_expires_r THEN CONTINUE; END IF;

    -- Penalty is active. Was it already released by a prior goal by the scoring team?
    IF NOT EXISTS (
      SELECT 1 FROM game_events prev
      WHERE prev.game_id = p_game_id
        AND prev.team_idx = p_team_idx
        AND prev.event_type = 'goal'
        AND prev.deleted_at IS NULL
        AND (
          -- Earlier goal in same quarter, after penalty started, before current goal
          (prev.quarter = v_pen.pen_q
           AND prev.quarter = p_quarter
           AND parse_clock_secs(prev.goal_time) <= pen_remaining
           AND parse_clock_secs(prev.goal_time) > goal_remaining)
          OR
          -- Goal in a quarter strictly between penalty start and current goal quarter
          (prev.quarter > v_pen.pen_q AND prev.quarter < p_quarter)
          OR
          -- Goal in penalty-start quarter, earlier than current goal's quarter
          (prev.quarter = v_pen.pen_q
           AND prev.quarter < p_quarter
           AND parse_clock_secs(prev.goal_time) <= pen_remaining)
          OR
          -- Goal in same quarter as current goal but earlier (higher remaining), penalty started earlier
          (prev.quarter = p_quarter
           AND prev.quarter > v_pen.pen_q
           AND parse_clock_secs(prev.goal_time) > goal_remaining)
        )
    ) THEN
      RETURN true;  -- active, unreleased releasable penalty → EMO goal
    END IF;
  END LOOP;

  RETURN false;
END;
$$;

-- Returns true if the SCORING team (p_team_idx) had any active penalty at goal time.
-- Includes NR penalties (they count toward man-count even though they don't release).
CREATE OR REPLACE FUNCTION is_mdd_goal(
  p_game_id  uuid,
  p_team_idx smallint,
  p_goal_time text,
  p_quarter  smallint
) RETURNS boolean STABLE SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  goal_remaining  int := parse_clock_secs(p_goal_time);
  v_pen           record;
  pen_remaining   int;
  to_serve        int;
  pen_expires_q   smallint;
  pen_expires_r   int;
  q               smallint;
  q_dur           int;
BEGIN
  FOR v_pen IN
    SELECT id, penalty_time, penalty_minutes, is_non_releasable, quarter AS pen_q
    FROM game_events
    WHERE game_id = p_game_id
      AND team_idx = p_team_idx   -- scoring team's own penalties
      AND event_type = 'penalty'
      AND deleted_at IS NULL
  LOOP
    pen_remaining := parse_clock_secs(v_pen.penalty_time);
    to_serve      := v_pen.penalty_minutes * 60;

    -- Compute expiry
    IF pen_remaining >= to_serve THEN
      pen_expires_q := v_pen.pen_q;
      pen_expires_r := pen_remaining - to_serve;
    ELSE
      to_serve := to_serve - pen_remaining;
      q        := v_pen.pen_q + 1;
      LOOP
        q_dur := quarter_duration_secs(q);
        EXIT WHEN to_serve <= q_dur;
        to_serve := to_serve - q_dur;
        q        := q + 1;
      END LOOP;
      pen_expires_q := q;
      pen_expires_r := quarter_duration_secs(q) - to_serve;
    END IF;

    -- Is goal within penalty window?
    IF p_quarter < v_pen.pen_q THEN CONTINUE; END IF;
    IF p_quarter = v_pen.pen_q AND goal_remaining > pen_remaining THEN CONTINUE; END IF;
    IF p_quarter > pen_expires_q THEN CONTINUE; END IF;
    IF p_quarter = pen_expires_q AND goal_remaining < pen_expires_r THEN CONTINUE; END IF;

    -- For releasable penalties, check if already released by prior opponent goal
    IF v_pen.is_non_releasable IS NOT TRUE THEN
      IF EXISTS (
        SELECT 1 FROM game_events prev
        WHERE prev.game_id = p_game_id
          AND prev.team_idx = 1 - p_team_idx  -- opponent goal would release this
          AND prev.event_type = 'goal'
          AND prev.deleted_at IS NULL
          AND (
            (prev.quarter = v_pen.pen_q AND prev.quarter = p_quarter
             AND parse_clock_secs(prev.goal_time) <= pen_remaining
             AND parse_clock_secs(prev.goal_time) > goal_remaining)
            OR (prev.quarter > v_pen.pen_q AND prev.quarter < p_quarter)
            OR (prev.quarter = v_pen.pen_q AND prev.quarter < p_quarter
                AND parse_clock_secs(prev.goal_time) <= pen_remaining)
            OR (prev.quarter = p_quarter AND prev.quarter > v_pen.pen_q
                AND parse_clock_secs(prev.goal_time) > goal_remaining)
          )
      ) THEN
        CONTINUE;  -- already released
      END IF;
    END IF;

    RETURN true;  -- active penalty on scoring team → MDD goal
  END LOOP;

  RETURN false;
END;
$$;
