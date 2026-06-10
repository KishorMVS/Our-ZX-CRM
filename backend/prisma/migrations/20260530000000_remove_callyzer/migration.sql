-- Remove Callyzer feature entirely.
-- Drops the call cache table and the hidden-call exclusion table.
DROP TABLE IF EXISTS "CallyzerCall";
DROP TABLE IF EXISTS "CallyzerExclusion";
