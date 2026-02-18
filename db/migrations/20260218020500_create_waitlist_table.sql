-- Migration: Create waitlist table

CREATE TABLE public.waitlist (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  email text NOT NULL,
  first_name text,
  role text NOT NULL,
  primary_problem text NOT NULL,
  urgency text NOT NULL,
  early_access_payment text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT waitlist_pkey PRIMARY KEY (id),
  CONSTRAINT waitlist_email_unique UNIQUE (email),
  CONSTRAINT waitlist_role_check CHECK (role IN ('union', 'team', 'coach', 'player')),
  CONSTRAINT waitlist_urgency_check CHECK (urgency IN ('exploring', '3_months', 'asap')),
  CONSTRAINT waitlist_early_access_payment_check CHECK (early_access_payment IN ('yes', 'maybe', 'not_now'))
);

CREATE INDEX idx_waitlist_created_at ON public.waitlist(created_at DESC);
