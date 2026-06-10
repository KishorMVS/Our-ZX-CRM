-- SalestrailCall was renamed to CallyzerCall by migration 20260415000000.
-- Drop the old table if it somehow still exists (e.g. on DBs that missed the rename).
DROP TABLE IF EXISTS "SalestrailCall";
