-- Org-level color: all teams in an org share the org's color.

ALTER TABLE organizations ADD COLUMN color text NOT NULL DEFAULT '#1a6bab';

-- On team insert: inherit org color (overrides whatever was passed)
CREATE OR REPLACE FUNCTION fn_team_inherit_org_color()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  SELECT color INTO NEW.color FROM organizations WHERE id = NEW.org_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_team_inherit_org_color
BEFORE INSERT ON teams
FOR EACH ROW EXECUTE FUNCTION fn_team_inherit_org_color();

-- On org color update: cascade to all teams in that org
CREATE OR REPLACE FUNCTION fn_cascade_org_color()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.color IS DISTINCT FROM OLD.color THEN
    UPDATE teams SET color = NEW.color WHERE org_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_org_color_cascade
AFTER UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION fn_cascade_org_color();
