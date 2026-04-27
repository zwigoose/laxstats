-- Replace gen_random_bytes (requires pgcrypto, not enabled) with gen_random_uuid().
-- Two UUIDs concatenated, dashes stripped → 32-char hex token, URL-safe.

CREATE OR REPLACE FUNCTION create_scorekeeper_invite(
  p_game_id uuid,
  p_label   text DEFAULT NULL
)
RETURNS text
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_token text;
BEGIN
  -- Caller must be the game owner, an org scorekeeper+, or platform admin
  IF NOT (
    is_platform_admin()
    OR EXISTS (SELECT 1 FROM games WHERE id = p_game_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM games g
      JOIN org_members om ON om.org_id = g.org_id
      WHERE g.id = p_game_id
        AND om.user_id = auth.uid()
        AND om.role IN ('org_admin','coach','scorekeeper')
    )
  ) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Two UUIDs, dashes stripped → 32-char hex, URL-safe, ~122 bits of entropy
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO game_scorekeepers (game_id, invited_by, label, invite_token, expires_at)
    VALUES (p_game_id, auth.uid(), p_label, v_token, now() + interval '24 hours');

  RETURN v_token;
END;
$$;

GRANT EXECUTE ON FUNCTION create_scorekeeper_invite(uuid, text) TO authenticated;
