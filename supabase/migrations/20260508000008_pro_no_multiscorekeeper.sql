-- Pro orgs do not have multi-scorekeeper access.
UPDATE plan_features SET pro_limit = 0 WHERE id = 'multi_scorekeeper';
