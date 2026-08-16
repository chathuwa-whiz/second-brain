-- Migration: 003_api_keys.sql
-- Creates the api_keys table for user-specific external automation (n8n, scrapers, bots)
-- Compatible with PostgreSQL and Oracle Autonomous AI Database (23ai Serverless)

-- ============================================================================
-- PostgreSQL:
-- ============================================================================
CREATE TABLE IF NOT EXISTS api_keys (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    key_hash    VARCHAR(255) NOT NULL,
    key_preview VARCHAR(20) NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);

-- ============================================================================
-- Oracle 23ai Autonomous Database Schema:
-- ============================================================================
-- CREATE TABLE api_keys (
--     id          VARCHAR2(64) PRIMARY KEY,
--     user_id     VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     name        VARCHAR2(100) NOT NULL,
--     key_hash    VARCHAR2(255) NOT NULL,
--     key_preview VARCHAR2(20) NOT NULL,
--     last_used_at TIMESTAMP WITH TIME ZONE,
--     created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );
-- CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
-- CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
