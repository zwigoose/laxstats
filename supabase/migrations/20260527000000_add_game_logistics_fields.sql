ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS referee_names      text,
  ADD COLUMN IF NOT EXISTS weather_conditions text,
  ADD COLUMN IF NOT EXISTS field_location     text;
