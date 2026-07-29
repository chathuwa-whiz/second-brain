import os

# LLM gateway (reuses the same self-hosted 9router pattern as your n8n workflows)
LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "http://62.171.163.6:20128/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "GeminiALL")
LLM_API_KEY = os.environ.get("LLM_API_KEY", "not-needed")

# MCP servers the orchestrator can route to, each launched as a local
# subprocess over stdio by default. "module" is what gets written to the
# trust-layer log's `module` column for any tool call landing on that server.
# When a server moves to the VPS instead, switch its entry from
# {"command", "args"} to {"url"} and update mcp_client.py's session-opening
# logic accordingly (see that file's docstring).
MCP_SERVERS = [
    {
        "name": "task-mcp",
        "module": "tasks",
        "command": os.environ.get("TASK_MCP_COMMAND", "python"),
        "args": os.environ.get(
            "TASK_MCP_ARGS", "../mcp-servers/task-mcp/server.py"
        ).split(),
    },
    {
        "name": "job-tracker-mcp",
        "module": "job_finding",
        "command": os.environ.get("JOB_TRACKER_MCP_COMMAND", "python"),
        "args": os.environ.get(
            "JOB_TRACKER_MCP_ARGS", "../mcp-servers/job-tracker-mcp/server.py"
        ).split(),
    },
]

# Below this confidence, the planner's decision is logged as "pending" instead
# of "auto_executed" — i.e. it waits for a human to approve it from the dashboard.
AUTO_EXECUTE_CONFIDENCE_THRESHOLD = float(
    os.environ.get("AUTO_EXECUTE_CONFIDENCE_THRESHOLD", "0.75")
)
