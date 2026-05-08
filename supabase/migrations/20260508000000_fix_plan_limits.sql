-- Fix incorrect plan_features limits seeded in phase 1.
UPDATE plan_features SET pro_limit = 2, max_limit = 6    WHERE id = 'org_active_teams';
UPDATE plan_features SET pro_limit = 2, max_limit = 5    WHERE id = 'org_members';
UPDATE plan_features SET                max_limit = 2    WHERE id = 'org_active_seasons';
UPDATE plan_features SET                max_limit = 25   WHERE id = 'org_games_per_season';
UPDATE plan_features SET pro_limit = 10, max_limit = 20  WHERE id = 'org_member_personal_games';
