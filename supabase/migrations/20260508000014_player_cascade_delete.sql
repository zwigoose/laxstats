-- Add ON DELETE CASCADE to team_season_roster.player_id so deleting a player
-- from the org also removes their season roster entries.

ALTER TABLE team_season_roster
  DROP CONSTRAINT team_season_roster_player_id_fkey,
  ADD CONSTRAINT team_season_roster_player_id_fkey
    FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE;
