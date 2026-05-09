-- Add Stripe subscription tracking columns to profiles (personal plans).
-- organizations already has stripe_customer_id and stripe_sub_id from the v2 schema.
alter table profiles
  add column if not exists stripe_customer_id text unique,
  add column if not exists stripe_sub_id text unique;
