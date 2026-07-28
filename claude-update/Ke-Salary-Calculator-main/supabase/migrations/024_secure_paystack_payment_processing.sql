CREATE TABLE IF NOT EXISTS public.payment_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reference TEXT NOT NULL UNIQUE,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL CHECK (currency = 'KES'),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processed', 'failed', 'expired')),
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '30 minutes',
  CHECK ((status = 'processed') = (consumed_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference TEXT NOT NULL UNIQUE REFERENCES public.payment_intents(reference),
  paystack_transaction_id BIGINT UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount_kobo BIGINT NOT NULL CHECK (amount_kobo > 0),
  currency TEXT NOT NULL CHECK (currency = 'KES'),
  plan TEXT NOT NULL CHECK (plan IN ('monthly', 'yearly')),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_payment_intents_user_created ON public.payment_intents (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_intents_pending_expiry ON public.payment_intents (expires_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_payments_user_processed ON public.payments (user_id, processed_at DESC);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_intents_select_own" ON public.payment_intents;
CREATE POLICY "payment_intents_select_own" ON public.payment_intents
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
DROP POLICY IF EXISTS "payments_select_own" ON public.payments;
CREATE POLICY "payments_select_own" ON public.payments
  FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.payment_intents, public.payments FROM anon, authenticated;
GRANT SELECT ON public.payment_intents, public.payments TO authenticated;

CREATE OR REPLACE FUNCTION public.process_verified_paystack_payment(
  p_reference TEXT,
  p_paystack_transaction_id BIGINT,
  p_amount_kobo BIGINT,
  p_currency TEXT,
  p_plan TEXT,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_intent public.payment_intents%ROWTYPE;
  v_current_expiry TIMESTAMPTZ;
  v_expires_at TIMESTAMPTZ;
BEGIN
  SELECT * INTO v_intent
  FROM public.payment_intents
  WHERE reference = p_reference
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown payment reference' USING ERRCODE = 'P0001';
  END IF;
  IF v_intent.status = 'processed' THEN
    RETURN FALSE;
  END IF;
  IF v_intent.status <> 'pending' OR v_intent.expires_at <= now() THEN
    RAISE EXCEPTION 'Payment intent is no longer valid' USING ERRCODE = 'P0001';
  END IF;
  IF p_amount_kobo <> v_intent.amount_kobo OR p_currency <> v_intent.currency OR p_plan <> v_intent.plan THEN
    RAISE EXCEPTION 'Verified payment does not match its intent' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.payments (reference, paystack_transaction_id, user_id, amount_kobo, currency, plan, metadata)
  VALUES (p_reference, p_paystack_transaction_id, v_intent.user_id, p_amount_kobo, p_currency, p_plan, COALESCE(p_metadata, '{}'::jsonb));

  SELECT premium_expires_at INTO v_current_expiry
  FROM public.user_profiles WHERE id = v_intent.user_id FOR UPDATE;
  v_expires_at := greatest(now(), coalesce(v_current_expiry, now()))
    + CASE v_intent.plan WHEN 'yearly' THEN interval '365 days' ELSE interval '30 days' END;

  UPDATE public.user_profiles
  SET premium = TRUE, premium_expires_at = v_expires_at, premium_source = 'paystack',
      premium_activated_at = now(), paystack_reference = p_reference
  WHERE id = v_intent.user_id;

  UPDATE public.payment_intents SET status = 'processed', consumed_at = now() WHERE id = v_intent.id;
  RETURN TRUE;
EXCEPTION WHEN unique_violation THEN
  RETURN FALSE;
END;
$$;

REVOKE ALL ON FUNCTION public.process_verified_paystack_payment(TEXT, BIGINT, BIGINT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_verified_paystack_payment(TEXT, BIGINT, BIGINT, TEXT, TEXT, JSONB) TO service_role;
