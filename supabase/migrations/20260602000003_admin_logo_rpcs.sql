-- Add logo_url to admin_get_orgs return type
DROP FUNCTION IF EXISTS admin_get_orgs();
CREATE OR REPLACE FUNCTION admin_get_orgs()
RETURNS TABLE (
  id           uuid,
  name         text,
  slug         text,
  plan         text,
  plan_status  text,
  color        text,
  logo_url     text,
  created_at   timestamptz,
  member_count bigint,
  game_count   bigint,
  season_count bigint,
  team_count   bigint
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT
      o.id, o.name, o.slug, o.plan, o.plan_status, o.color, o.logo_url, o.created_at,
      COUNT(DISTINCT om.id)  AS member_count,
      COUNT(DISTINCT g.id)   AS game_count,
      COUNT(DISTINCT s.id)   AS season_count,
      COUNT(DISTINCT t.id)   AS team_count
    FROM organizations o
    LEFT JOIN org_members  om ON om.org_id = o.id
    LEFT JOIN games         g ON g.org_id  = o.id
    LEFT JOIN seasons       s ON s.org_id  = o.id
    LEFT JOIN teams         t ON t.org_id  = o.id
    GROUP BY o.id
    ORDER BY o.created_at DESC;
END;
$$;

-- Add logo_url to admin_get_all_rosters return type
DROP FUNCTION IF EXISTS admin_get_all_rosters();
CREATE OR REPLACE FUNCTION admin_get_all_rosters()
RETURNS TABLE (
  id         uuid,
  user_id    uuid,
  name       text,
  roster     text,
  color      text,
  logo_url   text,
  created_at timestamptz,
  owner_name text
)
SECURITY DEFINER SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT is_platform_admin() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
    SELECT st.id, st.user_id, st.name, st.roster, st.color, st.logo_url, st.created_at,
           u.email::text AS owner_name
    FROM saved_teams st
    LEFT JOIN auth.users u ON u.id = st.user_id
    ORDER BY u.email, st.name;
END;
$$;

-- Allow platform admins to manage any file in org-logos bucket
CREATE POLICY "Platform admins can upload org logos"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'org-logos' AND is_platform_admin());

CREATE POLICY "Platform admins can update org logos"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'org-logos' AND is_platform_admin());

CREATE POLICY "Platform admins can delete org logos"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'org-logos' AND is_platform_admin());
