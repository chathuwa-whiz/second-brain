-- Run this once against your existing Neon database to add the columns
-- schema.sql now expects. schema.sql itself uses CREATE TABLE IF NOT
-- EXISTS, which won't retroactively add columns to a table that already
-- exists — this migration does that part.
--
-- Run via the Neon SQL editor (console.neon.tech -> your project -> SQL
-- Editor), or locally with psql:
--   psql "$LOG_DATABASE_URL" -f trust_layer/migrations/001_add_execution_columns.sql

ALTER TABLE agent_actions
    ADD COLUMN IF NOT EXISTS executed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS execution_result JSONB;

CREATE INDEX IF NOT EXISTS idx_agent_actions_pending_execution
    ON agent_actions (status, executed_at)
    WHERE status = 'approved' AND executed_at IS NULL;
