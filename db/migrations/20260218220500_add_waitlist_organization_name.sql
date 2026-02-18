-- Migration: Add organization/team field to waitlist

ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS organization_name text;
