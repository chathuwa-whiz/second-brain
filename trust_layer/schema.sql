-- Trust layer: every agent action gets a row here.
-- This table is what the dashboard's "approval queue" / activity feed reads from.
-- Compatible with Oracle Autonomous AI Database (23ai Serverless) and PostgreSQL.

-- ============================================================================
-- Oracle 23ai Autonomous Database Schema:
-- ============================================================================
-- CREATE TABLE agent_actions (
--     id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
--     created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
--     module          VARCHAR2(100) NOT NULL,
--     action          VARCHAR2(150) NOT NULL,
--     reasoning       CLOB NOT NULL,
--     confidence      NUMBER(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
--     status          VARCHAR2(50) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'auto_executed', 'failed')),
--     metadata        JSON DEFAULT '{}' NOT NULL,
--     reviewed_at     TIMESTAMP WITH TIME ZONE,
--     reviewed_by     VARCHAR2(100),
--     executed_at     TIMESTAMP WITH TIME ZONE,
--     execution_result JSON
-- );
--
-- CREATE TABLE system_settings (
--     key             VARCHAR2(100) PRIMARY KEY,
--     value           JSON DEFAULT '{}' NOT NULL,
--     updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );

-- ============================================================================
-- PostgreSQL (Neon) Schema:
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_actions (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    module          TEXT NOT NULL,
    action          TEXT NOT NULL,
    reasoning       TEXT NOT NULL,
    confidence      NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_executed', 'failed')),
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     TEXT,
    executed_at     TIMESTAMPTZ,
    execution_result JSONB
);

CREATE TABLE IF NOT EXISTS system_settings (
    key             VARCHAR(100) PRIMARY KEY,
    value           JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_module ON agent_actions (module);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions (status);
