-- Rewrite find_user_by_username as a SQL function with explicit ::text casts.
-- The plpgsql RETURN QUERY version caused "structure of query does not match
-- function result type" because auth.users.email is character varying, not text,
-- making the COALESCE return type ambiguous at runtime.
-- DROP + CREATE (not CREATE OR REPLACE) ensures a clean slate.

DROP FUNCTION IF EXISTS find_user_by_username(text);

CREATE FUNCTION find_user_by_username(p_username text)
RETURNS TABLE (id uuid, display_name text)
STABLE SECURITY DEFINER SET search_path = public
LANGUAGE sql AS $$
  SELECT
    u.id,
    COALESCE(
      CASE WHEN u.email LIKE '%@laxstats.app'
           THEN split_part(u.email, '@', 1)
           ELSE u.email::text
      END,
      u.id::text
    )::text AS display_name
  FROM auth.users u
  WHERE lower(u.email) = lower(
          CASE WHEN p_username LIKE '%@%'
               THEN p_username
               ELSE p_username || '@laxstats.app'
          END
        )
     OR (
          p_username NOT LIKE '%@%'
          AND lower(split_part(u.email, '@', 1)) = lower(p_username)
          AND lower(u.email) <> lower(p_username || '@laxstats.app')
        )
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_username(text) TO authenticated;
