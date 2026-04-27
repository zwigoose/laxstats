-- All new games should be v2. Change the column default and fix admin_create_game.

ALTER TABLE games ALTER COLUMN schema_ver SET DEFAULT 2;

CREATE OR REPLACE FUNCTION admin_create_game(p_user_id uuid, p_name text)
RETURNS uuid
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO games (name, user_id, state, schema_ver)
    VALUES (p_name, p_user_id, NULL, 2)
    RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
