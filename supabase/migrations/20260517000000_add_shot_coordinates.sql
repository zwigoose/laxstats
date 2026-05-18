ALTER TABLE public.game_events 
ADD COLUMN shot_x FLOAT,
ADD COLUMN shot_y FLOAT;

COMMENT ON COLUMN public.game_events.shot_x IS 'Normalized x-coordinate of shot location (0.0 to 1.0)';
COMMENT ON COLUMN public.game_events.shot_y IS 'Normalized y-coordinate of shot location (0.0 to 1.0)';
