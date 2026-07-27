-- Add currency column to chargers table.
-- Existing chargers default to 'USD' via the DEFAULT clause.
-- The CHECK constraint limits values to USD, UYU, or ARS.

ALTER TABLE public.chargers
  ADD COLUMN currency text NOT NULL DEFAULT 'USD'
  CHECK (currency IN ('USD', 'UYU', 'ARS'));
