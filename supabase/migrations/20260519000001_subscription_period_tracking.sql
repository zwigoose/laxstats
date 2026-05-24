-- Track cancel_at_period_end and current_period_end from Stripe subscription events.
-- cancel_at_period_end: true when user requested cancellation but grace period hasn't ended
-- current_period_end:   when the active billing period ends; used to show "Cancels on [date]"

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end    TIMESTAMPTZ;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_end    TIMESTAMPTZ;
