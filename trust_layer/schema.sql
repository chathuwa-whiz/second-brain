-- Trust layer: every agent action gets a row here.
-- This table is what the dashboard's "approval queue" / activity feed reads from.

CREATE TABLE IF NOT EXISTS agent_actions (
    id              BIGSERIAL PRIMARY KEY,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- which module made the decision (e.g. 'job_finding', 'tasks', 'research')
    module          TEXT NOT NULL,

    -- short machine-readable action name (e.g. 'add_task', 'match_resume_to_posting')
    action          TEXT NOT NULL,

    -- free-text explanation of *why* the agent chose this action — this is the
    -- field that answers "how do you know it's not hallucinating an action?"
    reasoning       TEXT NOT NULL,

    -- 0.0 - 1.0, how confident the planner was in this decision
    confidence      NUMERIC(4,3) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),

    -- pending / approved / rejected / auto_executed
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_executed', 'failed')),

    -- whatever structured payload the action needs (tool args, MCP response, etc.)
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

    -- set when a human approves/rejects a pending action from the dashboard
    reviewed_at     TIMESTAMPTZ,
    reviewed_by     TEXT
);

CREATE INDEX IF NOT EXISTS idx_agent_actions_created_at ON agent_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_actions_module ON agent_actions (module);
CREATE INDEX IF NOT EXISTS idx_agent_actions_status ON agent_actions (status);
