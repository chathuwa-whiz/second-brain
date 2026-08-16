-- ============================================================================
-- Oracle Autonomous AI Database (23ai Serverless) Schema
-- Multi-Tenant SaaS Tables: Users, Accounts, Verification Tokens, API Keys, Actions, Settings
-- ============================================================================

CREATE TABLE users (
    id              VARCHAR2(64) PRIMARY KEY,
    name            VARCHAR2(255),
    email           VARCHAR2(255) UNIQUE NOT NULL,
    password_hash   VARCHAR2(255),
    email_verified  TIMESTAMP WITH TIME ZONE,
    image           VARCHAR2(500),
    role            VARCHAR2(50) DEFAULT 'user' NOT NULL,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE accounts (
    id                  VARCHAR2(64) PRIMARY KEY,
    user_id             VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type                VARCHAR2(50) NOT NULL,
    provider            VARCHAR2(50) NOT NULL,
    provider_account_id VARCHAR2(255) NOT NULL,
    refresh_token       CLOB,
    access_token        CLOB,
    expires_at          NUMBER(19),
    token_type          VARCHAR2(50),
    scope               CLOB,
    id_token            CLOB,
    session_state       CLOB,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uq_accounts_provider UNIQUE (provider, provider_account_id)
);

CREATE TABLE verification_tokens (
    id          VARCHAR2(64) PRIMARY KEY,
    user_id     VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR2(255) UNIQUE NOT NULL,
    token_type  VARCHAR2(50) DEFAULT 'email_verification' NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE api_keys (
    id          VARCHAR2(64) PRIMARY KEY,
    user_id     VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR2(100) NOT NULL,
    key_hash    VARCHAR2(255) NOT NULL,
    key_preview VARCHAR2(20) NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE agent_actions (
    id              NUMBER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id         VARCHAR2(64) REFERENCES users(id) ON DELETE CASCADE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    module          VARCHAR2(100) NOT NULL,
    action          VARCHAR2(150) NOT NULL,
    reasoning       CLOB NOT NULL,
    confidence      NUMBER(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
    status          VARCHAR2(50) DEFAULT 'pending' NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'auto_executed', 'failed')),
    metadata        JSON DEFAULT '{}' NOT NULL,
    reviewed_at     TIMESTAMP WITH TIME ZONE,
    reviewed_by     VARCHAR2(100),
    executed_at     TIMESTAMP WITH TIME ZONE,
    execution_result JSON
);

CREATE TABLE system_settings (
    key             VARCHAR2(100) NOT NULL,
    user_id         VARCHAR2(64) REFERENCES users(id) ON DELETE CASCADE,
    value           JSON DEFAULT '{}' NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (key, user_id)
);

CREATE INDEX idx_users_email ON users (email);
CREATE INDEX idx_accounts_user_id ON accounts (user_id);
CREATE INDEX idx_verif_tokens_token ON verification_tokens (token);
CREATE INDEX idx_verif_tokens_user ON verification_tokens (user_id);
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);
CREATE INDEX idx_api_keys_key_hash ON api_keys (key_hash);
CREATE INDEX idx_agent_actions_created ON agent_actions (created_at DESC);
CREATE INDEX idx_agent_actions_user_id ON agent_actions (user_id, created_at DESC);
CREATE INDEX idx_agent_actions_module ON agent_actions (module);
CREATE INDEX idx_agent_actions_status ON agent_actions (status);
