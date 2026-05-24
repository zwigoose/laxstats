-- Add game_meta_events to the supabase_realtime publication so that
-- postgres_changes subscriptions on this table deliver events to subscribers.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'game_meta_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE game_meta_events;
  END IF;
END $$;
