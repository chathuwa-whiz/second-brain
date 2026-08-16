-- Multi-Tenant SaaS Auth Schema Migration for Oracle Database (23ai / 26ai Autonomous Serverless)
-- Creates users, accounts (OAuth), verification_tokens, and alters agent_actions & system_settings.

-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
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

-- 2. Create accounts table
CREATE TABLE IF NOT EXISTS accounts (
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

-- 3. Create verification_tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
    id          VARCHAR2(64) PRIMARY KEY,
    user_id     VARCHAR2(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR2(255) UNIQUE NOT NULL,
    token_type  VARCHAR2(50) DEFAULT 'email_verification' NOT NULL,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 4. Add user_id column to agent_actions and system_settings (Idempotent PL/SQL block)
BEGIN
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE agent_actions ADD user_id VARCHAR2(64) REFERENCES users(id) ON DELETE CASCADE';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE != -1430 THEN -- Ignore ORA-01430: column being added already exists
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE system_settings ADD user_id VARCHAR2(64) REFERENCES users(id) ON DELETE CASCADE';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE != -1430 THEN
                RAISE;
            END IF;
    END;
END;
/

-- 5. Create Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_token ON verification_tokens (token);
CREATE INDEX IF NOT EXISTS idx_verification_tokens_user ON verification_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
CREATE INDEX IF NOT EXISTS idx_agent_actions_user_id ON agent_actions (user_id, created_at DESC);
