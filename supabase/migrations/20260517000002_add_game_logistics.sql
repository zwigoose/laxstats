ALTER TABLE games ADD COLUMN referee_names text;
ALTER TABLE games ADD COLUMN weather_conditions text;
ALTER TABLE games ADD COLUMN field_location text;
COMMENT ON COLUMN games.referee_names IS 'Names of officiating crew';
COMMENT ON COLUMN games.weather_conditions IS 'Weather conditions during game';
COMMENT ON COLUMN games.field_location IS 'Specific field or facility name';