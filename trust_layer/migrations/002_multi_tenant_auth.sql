-- Multi-Tenant SaaS Auth Schema Migration
-- Creates users, accounts (OAuth), and verification_tokens tables, and associates agent_actions and system_settings with users.

-- ============================================================================
-- 1. PostgreSQL (Neon / Supabase / AWS RDS):
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id              VARCHAR(64) PRIMARY KEY,
    name            VARCHAR(255),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255),
    email_verified  TIMESTAMPTZ,
    image           VARCHAR(500),
    role            VARCHAR(50) DEFAULT 'user' NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS accounts (
    id                  VARCHAR(64) PRIMARY KEY,
    user_id             VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR(50) NOT NULL,
    provider            VARCHAR(50) NOT NULL,
    provider_account_id VARCHAR(255) NOT NULL,
    refresh_token       TEXT,
    access_token        TEXT,
    expires_at          BIGINT,
    token_type          VARCHAR(50),
    scope               TEXT,
    id_token            TEXT,
    session_state       TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_accounts_provider UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS verification_tokens (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) UNIQUE NOT NULL,
    token_type  VARCHAR(50) NOT NULL DEFAULT 'email_verification',
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add user_id column to agent_actions if not present (PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agent_actions' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE agent_actions ADD COLUMN user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Add user_id column to system_settings if not present (PostgreSQL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'system_settings' AND column_name = 'user_id'
    ) THEN
        ALTER TABLE system_settings ADD COLUMN user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens (token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user_id ON agent_actions (user_id, created_at DESC);

-- ============================================================================
-- 2. Oracle Database (23ai Autonomous Serverless / SQL Developer / Database Actions):
-- ============================================================================

-- CREATE TABLE IF NOT EXISTS users (
--     id              VARCHAR2(64) PRIMARY KEY,
--     name            VARCHAR2(255),
--     email           VARCHAR2(255) UNIQUE NOT NULL,
--     password_hash   VARCHAR2(255),
--     email_verified  TIMESTAMP WITH TIME ZONE,
--     image           VARCHAR2(500),
--     role            VARCHAR2(50) DEFAULT 'user' NOT NULL,
--     created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
--     updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );
-- 
-- CREATE TABLE IF NOT EXISTS accounts (
--     id                  VARCHAR2(64) PRIMARY KEY,
--     user_id             VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     type                VARCHAR2(50) NOT NULL,
--     provider            VARCHAR2(50) NOT NULL,
--     provider_account_id VARCHAR2(255) NOT NULL,
--     refresh_token       CLOB,
--     access_token        CLOB,
--     expires_at          NUMBER(19),
--     token_type          VARCHAR2(50),
--     scope               CLOB,
--     id_token            CLOB,
--     session_state       CLOB,
--     created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
--     CONSTRAINT uq_accounts_provider UNIQUE (provider, provider_account_id)
-- );
-- 
-- CREATE TABLE IF NOT EXISTS verification_tokens (
--     id          VARCHAR2(64) PRIMARY KEY,
--     user_id     VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--     token       VARCHAR2(255) UNIQUE NOT NULL,
--     token_type  VARCHAR2(50) DEFAULT 'email_verification' NOT NULL,
--     expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
--     created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
-- );
-- 
-- BEGIN
--     BEGIN
--         EXECUTE IMMEDIATE 'ALTER TABLE agent_actions ADD user_id VARCHAR2(64) REFERENCES users(id) ON DELETE CASCADE';
--     EXCEPTION
--         WHEN OTHERS THEN
--             IF SQLCODE != -1430 THEN RAISE; END IF;
--     END;
-- 
--     BEGIN
--         EXECUTE IMMEDIATE 'ALTER TABLE system_settings ADD user_id VARCHAR2(64) REFERENCES users(id) ON DELETE CASCADE';
--     EXCEPTION
--         WHEN OTHERS THEN
--             IF SQLCODE != -1430 THEN RAISE; END IF;
--     END;
-- END;
-- /
-- 
-- CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
-- CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens (token);
-- CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens (user_id);
-- CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
-- CREATE INDEX IF NOT EXISTS idx_agent_actions_user_id ON agent_actions (user_id, created_at DESC);
