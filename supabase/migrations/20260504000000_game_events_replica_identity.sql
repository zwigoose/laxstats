-- Supabase Realtime filtered postgres_changes subscriptions require REPLICA
-- IDENTITY FULL on tables where the filter column is not the primary key.
-- game_events filters on game_id (not the PK), so without this the server
-- stalls on the phx_join for game-events channels and never responds.
ALTER TABLE game_events REPLICA IDENTITY FULL;
