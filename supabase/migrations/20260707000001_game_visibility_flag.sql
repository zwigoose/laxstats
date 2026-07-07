-- =============================================================================
-- Per-game public visibility flag
--
-- Every game gets an is_public flag with different defaults by kind:
--   * personal games — PRIVATE by default; the owner opts in from the home page
--   * org games      — PUBLIC by default (org dashboards and season pages are
--     public routes fans follow without accounts); org admins/coaches can hide
--     individual games
-- The logged-out home page lists only flagged-public games. A hidden game is
-- visible to its owner, org members (home or away), invited scorekeepers, and
-- platform admins.
-- =============================================================================

ALTER TABLE games ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;

-- Existing org games keep today's behavior (publicly viewable)
UPDATE games SET is_public = true WHERE org_id IS NOT NULL AND NOT is_public;

-- Fast path for the logged-out home page listing (public games, newest first)
CREATE INDEX IF NOT EXISTS idx_games_public_created
  ON games (created_at DESC) WHERE is_public;

-- ── Default visibility by game kind ───────────────────────────────────────────
-- Inserts never set is_public explicitly, so org games start public here. When
-- a personal game is moved into an org (org_id null → set) it also flips public
-- unless the same UPDATE explicitly sets is_public.
CREATE OR REPLACE FUNCTION games_default_visibility()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.org_id IS NOT NULL THEN
      NEW.is_public := true;
    END IF;
  ELSIF NEW.org_id IS NOT NULL AND OLD.org_id IS NULL
        AND NEW.is_public = OLD.is_public THEN
    NEW.is_public := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS games_default_visibility ON games;
CREATE TRIGGER games_default_visibility
  BEFORE INSERT OR UPDATE OF org_id ON games
  FOR EACH ROW EXECUTE FUNCTION games_default_visibility();

-- ── Shared visibility predicate ───────────────────────────────────────────────
-- Used by the SELECT policies on games, game_events, and game_meta_events so a
-- game's events are exactly as visible as the game row itself. SECURITY DEFINER
-- so policy evaluation does not recurse through each referenced table's own RLS
-- (game_scorekeepers' SELECT policy references games, which would otherwise
-- create a policy cycle).
CREATE OR REPLACE FUNCTION can_view_game(p_game_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = p_game_id
      AND (
        g.is_public
        OR g.user_id = auth.uid()
        OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.is_admin)
        OR EXISTS (                          -- members of the home or away org
          SELECT 1 FROM org_members om
          WHERE om.user_id = auth.uid()
            AND om.org_id IN (g.org_id, g.away_org_id)
        )
        OR EXISTS (                          -- invited scorekeepers (incl. anonymous auth)
          SELECT 1 FROM game_scorekeepers gs
          WHERE gs.game_id = g.id
            AND gs.user_id = auth.uid()
            AND gs.expires_at > now()
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION can_view_game(uuid) TO anon, authenticated;

-- ── set_game_visibility RPC ───────────────────────────────────────────────────
-- games UPDATE is deliberately owner-only (plus platform admin), so org
-- admins/coaches toggle visibility through this definer RPC instead of a
-- broadened UPDATE policy.
CREATE OR REPLACE FUNCTION set_game_visibility(p_game_id uuid, p_public boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM games g
    WHERE g.id = p_game_id
      AND (
        g.user_id = auth.uid()
        OR is_platform_admin()
        OR EXISTS (
          SELECT 1 FROM org_members om
          WHERE om.org_id = g.org_id
            AND om.user_id = auth.uid()
            AND om.role IN ('org_admin', 'coach')
        )
      )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE games SET is_public = p_public WHERE id = p_game_id;
END;
$$;

GRANT EXECUTE ON FUNCTION set_game_visibility(uuid, boolean) TO authenticated;

-- ── games ─────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS games_select_public ON games;
DROP POLICY IF EXISTS games_select_visible ON games;
CREATE POLICY games_select_visible ON games FOR SELECT USING (can_view_game(id));

-- ── game_events ───────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "gevents_select_public" ON game_events;
DROP POLICY IF EXISTS "gevents_select_visible" ON game_events;
CREATE POLICY "gevents_select_visible"
  ON game_events FOR SELECT USING (can_view_game(game_id));

-- ── game_meta_events ──────────────────────────────────────────────────────────
-- Was: TO authenticated USING (true). Scoping to game visibility also lets
-- logged-out fans of a public game derive quarter state.
DROP POLICY IF EXISTS "game_meta_events_select" ON game_meta_events;
CREATE POLICY "game_meta_events_select"
  ON game_meta_events FOR SELECT USING (can_view_game(game_id));

-- ── v_game_team_totals ────────────────────────────────────────────────────────
-- Run the score-totals view with the caller's permissions so hidden games'
-- scores are filtered by the game_events policy above. Definer-owned views
-- that join this view are unaffected (the owner bypasses RLS).
ALTER VIEW v_game_team_totals SET (security_invoker = on);
