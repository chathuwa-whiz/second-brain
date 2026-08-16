-- Trust layer & Multi-Tenant SaaS schema.
-- Compatible with PostgreSQL and Oracle Autonomous AI Database (23ai Serverless).

-- ============================================================================
-- PostgreSQL (Neon / Supabase / Self-Hosted) Schema:
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

CREATE TABLE IF NOT EXISTS api_keys (
    id          VARCHAR(64) PRIMARY KEY,
    user_id     VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(100) NOT NULL,
    key_hash    VARCHAR(255) NOT NULL,
    key_preview VARCHAR(20) NOT NULL,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_actions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
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
    key             VARCHAR(100) NOT NULL,
    user_id         VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    value           JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens (token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user_id ON agent_actions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_module ON agent_actions (module);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions (status);
