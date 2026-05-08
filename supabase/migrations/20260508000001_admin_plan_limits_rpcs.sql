-- Admin RPCs for reading and editing global plan_features limits.

CREATE OR REPLACE FUNCTION admin_get_plan_features()
RETURNS TABLE (
  feature_id  text,
  description text,
  free_limit  int,
  pro_limit   int,
  max_limit   int,
  giga_limit  int
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT pf.id, pf.description, pf.free_limit, pf.pro_limit, pf.max_limit, pf.giga_limit
    FROM plan_features pf
    ORDER BY pf.id;
END;
$$;

-- p_limit: NULL = unlimited, 0 = disabled, positive int = cap
CREATE OR REPLACE FUNCTION admin_set_plan_limit(
  p_feature_id text,
  p_plan       text,
  p_limit      int
)
RETURNS void SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF p_plan NOT IN ('free', 'pro', 'max', 'giga') THEN
    RAISE EXCEPTION 'invalid plan: %', p_plan;
  END IF;
  EXECUTE format('UPDATE plan_features SET %I = $1 WHERE id = $2', p_plan || '_limit')
    USING p_limit, p_feature_id;
END;
$$;
