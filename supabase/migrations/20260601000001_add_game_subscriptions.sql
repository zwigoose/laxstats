CREATE TABLE public.game_subscriptions (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id           uuid        NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id           uuid        REFERENCES auth.users(id) ON DELETE CASCADE,
  push_subscription jsonb       NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.game_subscriptions ENABLE ROW LEVEL SECURITY;

-- Authenticated users manage their own subscriptions
CREATE POLICY "Users manage own subscriptions"
  ON public.game_subscriptions
  FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow unauthenticated follows (guest fans)
CREATE POLICY "Anyone can insert anonymous subscription"
  ON public.game_subscriptions
  FOR INSERT
  WITH CHECK (user_id IS NULL);

CREATE POLICY "Anyone can delete anonymous subscription by endpoint"
  ON public.game_subscriptions
  FOR DELETE
  USING (user_id IS NULL);
